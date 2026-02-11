import { z } from 'zod';

import type { BookMetadata, MediaMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

/**
 * Zod schemas for Google Books API responses
 */

const GoogleBooksVolumeSchema = z.object({
  id: z.string(),
  selfLink: z.string(),
  volumeInfo: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    description: z.string().optional(),
    industryIdentifiers: z
      .array(
        z.object({
          type: z.string(),
          identifier: z.string(),
        })
      )
      .optional(),
    pageCount: z.number().optional(),
    categories: z.array(z.string()).optional(),
    averageRating: z.number().optional(),
    ratingsCount: z.number().optional(),
    imageLinks: z
      .object({
        smallThumbnail: z.string().optional(),
        thumbnail: z.string().optional(),
        small: z.string().optional(),
        medium: z.string().optional(),
        large: z.string().optional(),
        extraLarge: z.string().optional(),
      })
      .optional(),
    language: z.string().optional(),
    infoLink: z.string().optional(),
    canonicalVolumeLink: z.string().optional(),
  }),
  saleInfo: z
    .object({
      listPrice: z
        .object({
          amount: z.number(),
          currencyCode: z.string(),
        })
        .optional(),
    })
    .optional(),
});

const GoogleBooksSearchResponseSchema = z.object({
  kind: z.string(),
  totalItems: z.number(),
  items: z.array(GoogleBooksVolumeSchema).optional(),
});

/**
 * Google Books Adapter for fetching book metadata
 *
 * API Key required - get one free at:
 * https://developers.google.com/books/docs/v1/using#APIKey
 *
 * Free tier: 1,000 queries/day without key (limited), 100,000 queries/day with key
 */
export class GoogleBooksAdapter extends BaseMetadataAdapter {
  readonly type = 'book' as const;
  readonly source = 'google-books';

  private readonly baseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new Google Books adapter
   */
  constructor(apiKey = '') {
    super();
    this.baseUrl = '/api/worker/metadata/google-books';
    this.apiKey = apiKey;
  }

  /**
   * Fetch book details by Google Books ID
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    const url = this.buildVolumeUrl(id);
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Book not found: ${id}`);
      }
      throw new Error(
        `Google Books proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = GoogleBooksVolumeSchema.parse(await response.json());
    return this.transformToBookMetadata(data);
  }

  /**
   * Search for books by query
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query, limit);
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(
        `Google Books proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = GoogleBooksSearchResponseSchema.parse(await response.json());

    if (!data.items || data.items.length === 0) {
      return [];
    }

    const results = data.items
      .slice(0, limit)
      .map(volume => ({
        item: this.transformToBookMetadata(volume),
        score: this.calculateRelevanceScore(volume.volumeInfo.title, query),
      }))
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is a valid Google Books ID
   * Google Books IDs are alphanumeric strings
   */
  override isValidId(id: string): boolean {
    // Google Books IDs are typically alphanumeric with some special chars
    return id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id);
  }

  /**
   * Build URL for volume lookup
   */
  private buildVolumeUrl(id: string): string {
    return `${this.baseUrl}/volumes/${id}`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string, maxResults: number): string {
    const params = new URLSearchParams({
      q: query.trim(),
      maxResults: String(Math.min(maxResults, 40)), // Google allows max 40
      printType: 'books',
      orderBy: 'relevance',
      projection: 'full', // Get full volume data including descriptions
    });

    return `${this.baseUrl}/volumes?${params.toString()}`;
  }

  /**
   * Extract ISBN from Google Books volume data
   */
  private extractIsbn(
    data: z.infer<typeof GoogleBooksVolumeSchema>
  ): string | undefined {
    const identifiers = data.volumeInfo.industryIdentifiers;
    if (!identifiers || identifiers.length === 0) {
      return undefined;
    }

    // Prefer ISBN-13
    const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
    if (isbn13) {
      return isbn13.identifier;
    }

    // Fall back to ISBN-10
    const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
    if (isbn10) {
      return isbn10.identifier;
    }

    return undefined;
  }

  /**
   * Get best available image URL from Google Books image links
   * Converts HTTP to HTTPS to avoid mixed content issues
   */
  private getBestImageUrl(
    imageLinks: z.infer<
      typeof GoogleBooksVolumeSchema
    >['volumeInfo']['imageLinks']
  ): string | undefined {
    if (!imageLinks) {
      return undefined;
    }

    // Prefer larger images
    let imageUrl =
      imageLinks.extraLarge ||
      imageLinks.large ||
      imageLinks.medium ||
      imageLinks.small ||
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail;

    // Convert HTTP to HTTPS to avoid mixed content issues
    if (imageUrl && imageUrl.startsWith('http://')) {
      imageUrl = imageUrl.replace('http://', 'https://');
    }

    return imageUrl;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string | undefined): string | undefined {
    if (!html) return undefined;
    // Remove HTML tags
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Transform Google Books volume to BookMetadata
   */
  private transformToBookMetadata(
    data: z.infer<typeof GoogleBooksVolumeSchema>
  ): BookMetadata {
    const volumeInfo = data.volumeInfo;
    const isbn = this.extractIsbn(data);
    const image = this.getBestImageUrl(volumeInfo.imageLinks);

    // Build Google Books URL
    const url = volumeInfo.canonicalVolumeLink || volumeInfo.infoLink;

    // Strip HTML from description
    const description = this.stripHtml(volumeInfo.description);

    return {
      id: data.id,
      type: 'book',
      title: volumeInfo.title,
      description,
      image,
      url,
      authors: volumeInfo.authors,
      publisher: volumeInfo.publisher,
      publishDate: volumeInfo.publishedDate,
      pageCount: volumeInfo.pageCount,
      isbn,
    };
  }

  /**
   * Check if the adapter is properly configured with an API key
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }
}

/**
 * Factory function to create a Google Books adapter
 */
export function createGoogleBooksAdapter(apiKey?: string): GoogleBooksAdapter {
  return new GoogleBooksAdapter(apiKey);
}

/**
 * Default singleton instance
 */
let defaultGoogleBooksAdapter: GoogleBooksAdapter | null = null;

export function getDefaultGoogleBooksAdapter(): GoogleBooksAdapter {
  if (!defaultGoogleBooksAdapter) {
    defaultGoogleBooksAdapter = new GoogleBooksAdapter();
  }
  return defaultGoogleBooksAdapter;
}

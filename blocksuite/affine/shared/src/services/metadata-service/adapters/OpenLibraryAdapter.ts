import { z } from 'zod';

import type { BookMetadata, MediaMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

/**
 * Open Library API configuration
 * Open Library is an open project with a free API that doesn't require authentication
 * Docs: https://openlibrary.org/dev/docs/api
 */
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_WEB_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_COVER_BASE_URL = 'https://covers.openlibrary.org/b';

/**
 * Rate limiting: Open Library asks for no more than 1 request per second
 * We'll use a simple delay mechanism to respect this
 */
const REQUEST_DELAY_MS = 1000;

/**
 * Zod schemas for Open Library API responses
 */

const OpenLibraryBookSchema = z.object({
  key: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z
    .array(
      z.object({
        author: z.object({
          key: z.string(),
          name: z.string().optional(),
        }),
      })
    )
    .optional(),
  descriptions: z
    .array(
      z.object({
        value: z.string(),
        type: z.string().optional(),
      })
    )
    .optional(),
  // Description can be either a string or an object with value property
  description: z
    .union([
      z.string(),
      z.object({ value: z.string(), type: z.string().optional() }),
    ])
    .optional(),
  subjects: z.array(z.string()).optional(),
  subject: z.array(z.string()).optional(),
  publish_date: z.string().optional(),
  first_publish_date: z.string().optional(),
  publishers: z.array(z.string()).optional(),
  number_of_pages: z.number().optional(),
  covers: z.array(z.number()).optional(),
  isbn_10: z.array(z.string()).optional(),
  isbn_13: z.array(z.string()).optional(),
  languages: z
    .array(
      z.object({
        key: z.string(),
      })
    )
    .optional(),
});

const OpenLibrarySearchResponseSchema = z.object({
  start: z.number(),
  num_found: z.number(),
  docs: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      author_name: z.array(z.string()).optional(),
      first_publish_year: z.number().optional(),
      cover_i: z.number().optional(),
      isbn: z.array(z.string()).optional(),
      subject: z.array(z.string()).optional(),
    })
  ),
});

/**
 * Open Library Adapter for fetching book metadata
 */
export class OpenLibraryAdapter extends BaseMetadataAdapter {
  readonly type = 'book' as const;
  readonly source = 'openlibrary';

  private readonly baseUrl: string;
  private readonly coverBaseUrl: string;
  private readonly webUrl: string;

  /**
   * Instance-level rate limiter state
   * Each adapter instance maintains its own rate limiting state
   */
  private lastRequestTime = 0;

  /**
   * Create a new Open Library adapter
   * @param baseUrl - Custom base URL for API requests (useful for testing)
   * @param coverBaseUrl - Custom base URL for cover images
   * @param webUrl - Custom base URL for web links
   */
  constructor(baseUrl?: string, coverBaseUrl?: string, webUrl?: string) {
    super();
    this.baseUrl = baseUrl || OPEN_LIBRARY_BASE_URL;
    this.coverBaseUrl = coverBaseUrl || OPEN_LIBRARY_COVER_BASE_URL;
    this.webUrl = webUrl || OPEN_LIBRARY_WEB_URL;
  }

  /**
   * Fetch book details by Open Library ID (OLID)
   * The ID should be an Open Library ID like "OL2867580W" (works) or "OL17926419M" (editions)
   * Also accepts ISBN-10 or ISBN-13
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    // Rate limiting: wait before making request
    await this.rateLimitDelay();

    // Check if ID is an ISBN
    if (this.isIsbn(id)) {
      return this.fetchByIsbn(id, signal);
    }

    // Otherwise, treat as OLID (Open Library ID)
    const { type, olid } = this.parseOLID(id);
    const data = await this.fetchBookData(type, olid, signal);

    return this.transformToBookMetadata(data);
  }

  /**
   * Search for books by title
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    // Rate limiting: wait before making request
    await this.rateLimitDelay();

    const url = this.buildSearchUrl(query, limit);
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(
        `Open Library API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = OpenLibrarySearchResponseSchema.parse(await response.json());

    const results = data.docs
      .slice(0, limit)
      .map(doc => ({
        item: this.transformSearchDocToBookMetadata(doc),
        score: this.calculateRelevanceScore(doc.title, query),
      }))
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is valid for Open Library
   * Accepts OLID (Open Library ID), ISBN-10, or ISBN-13
   */
  override isValidId(id: string): boolean {
    return this.isOLID(id) || this.isIsbn(id);
  }

  /**
   * Check if ID is an Open Library ID (OLID)
   * Format: OL[0-9]+[MW] (e.g., OL2867580W for works, OL17926419M for editions)
   * Also accepts keys like "works/OL2867580W" or "books/OL17926419M"
   */
  private isOLID(id: string): boolean {
    // Handle keys with prefixes like "works/OL2867580W" or "books/OL17926419M"
    const cleanId = id.replace(/^(works|books)\//i, '');
    const olidRegex = /^OL\d+[MW]$/i;
    return olidRegex.test(cleanId);
  }

  /**
   * Check if ID is an ISBN (10 or 13 digit)
   */
  private isIsbn(id: string): boolean {
    // Remove hyphens and spaces
    const cleanId = id.replace(/[-\s]/g, '');
    // ISBN-10: 10 digits, may end with X
    const isbn10Regex = /^\d{9}[\dX]$/i;
    // ISBN-13: 13 digits
    const isbn13Regex = /^\d{13}$/;
    return isbn10Regex.test(cleanId) || isbn13Regex.test(cleanId);
  }

  /**
   * Parse OLID and determine its type (works or books/edition)
   * Handles keys like "works/OL2867580W" or "books/OL17926419M"
   * Returns the type and clean OLID
   */
  private parseOLID(id: string): { type: 'works' | 'books'; olid: string } {
    const trimmed = id.trim();

    // Check if it has a works/ prefix
    if (trimmed.match(/^works\//i)) {
      const olid = trimmed.replace(/^works\//i, '');
      if (!this.isOLID(olid)) {
        throw new Error(`Invalid Open Library ID format: ${id}`);
      }
      return { type: 'works', olid };
    }

    // Check if it has a books/ prefix
    if (trimmed.match(/^books\//i)) {
      const olid = trimmed.replace(/^books\//i, '');
      if (!this.isOLID(olid)) {
        throw new Error(`Invalid Open Library ID format: ${id}`);
      }
      return { type: 'books', olid };
    }

    // No prefix - assume it's just the OLID (default to works for W suffix, books for M suffix)
    if (!this.isOLID(trimmed)) {
      throw new Error(`Invalid Open Library ID format: ${id}`);
    }

    // Determine type by suffix: W = works, M = books/edition
    const type = trimmed.toUpperCase().endsWith('W') ? 'works' : 'books';
    return { type, olid: trimmed };
  }

  /**
   * Build URL for book lookup by OLID
   * Uses appropriate endpoint based on type (works or books)
   */
  private buildBookUrl(type: 'works' | 'books', olid: string): string {
    return `${this.baseUrl}/${type}/${olid}.json`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string, limit: number): string {
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(limit),
      fields: 'key,title,author_name,first_publish_year,cover_i,isbn,subject',
    });
    return `${this.baseUrl}/search.json?${params.toString()}`;
  }

  /**
   * Build URL for ISBN lookup
   */
  private buildIsbnUrl(isbn: string): string {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    return `${this.baseUrl}/isbn/${cleanIsbn}.json`;
  }

  /**
   * Build cover art URL
   * Open Library uses cover IDs: /b/ID/{size}.jpg or /b/ISBN/{size}.jpg
   * Sizes: S (small), M (medium), L (large)
   */
  private buildCoverUrl(
    id: string | number,
    size: 'S' | 'M' | 'L' = 'M'
  ): string {
    return `${this.coverBaseUrl}/id/${id}-${size}.jpg`;
  }

  /**
   * Build ISBN-specific cover URL
   */
  private buildIsbnCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    return `${this.coverBaseUrl}/isbn/${cleanIsbn}-${size}.jpg`;
  }

  /**
   * Rate limiting delay to respect Open Library's API guidelines
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, REQUEST_DELAY_MS - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch book data by OLID
   * If it's an edition, we also fetch the work data for additional metadata
   */
  private async fetchBookData(
    type: 'works' | 'books',
    olid: string,
    signal?: AbortSignal
  ): Promise<z.infer<typeof OpenLibraryBookSchema>> {
    const url = this.buildBookUrl(type, olid);
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Book not found: ${olid}`);
      }
      throw new Error(
        `Open Library API request failed: ${response.status} ${response.statusText}`
      );
    }

    return OpenLibraryBookSchema.parse(await response.json());
  }

  /**
   * Fetch book by ISBN
   */
  private async fetchByIsbn(
    isbn: string,
    signal?: AbortSignal
  ): Promise<BookMetadata> {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const url = this.buildIsbnUrl(cleanIsbn);
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Book not found for ISBN: ${isbn}`);
      }
      throw new Error(
        `Open Library API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = OpenLibraryBookSchema.parse(await response.json());
    return this.transformToBookMetadata(data);
  }

  /**
   * Extract description from Open Library data
   * Description can be a string or an object with value/type
   */
  private extractDescription(
    data: z.infer<typeof OpenLibraryBookSchema>
  ): string | undefined {
    // Check for descriptions array first
    if (data.descriptions && data.descriptions.length > 0) {
      const desc = data.descriptions.find(d => !d.type || d.type === '');
      return desc?.value || data.descriptions[0].value;
    }

    // Check for description string
    if (typeof data.description === 'string') {
      return data.description;
    }

    // Check for description object
    if (data.description && typeof data.description === 'object') {
      return 'value' in data.description ? data.description.value : undefined;
    }

    return undefined;
  }

  /**
   * Extract authors from Open Library data
   */
  private extractAuthors(
    data: z.infer<typeof OpenLibraryBookSchema>
  ): string[] | undefined {
    if (!data.authors || data.authors.length === 0) {
      return undefined;
    }

    const authors = data.authors
      .map(a => a.author?.name)
      .filter((name): name is string => !!name);

    return authors.length > 0 ? authors : undefined;
  }

  /**
   * Extract ISBN from Open Library data
   */
  private extractIsbn(
    data: z.infer<typeof OpenLibraryBookSchema>
  ): string | undefined {
    // Prefer ISBN-13
    if (data.isbn_13 && data.isbn_13.length > 0) {
      return data.isbn_13[0];
    }

    // Fall back to ISBN-10
    if (data.isbn_10 && data.isbn_10.length > 0) {
      return data.isbn_10[0];
    }

    return undefined;
  }

  /**
   * Transform Open Library response to BookMetadata
   */
  private transformToBookMetadata(
    data: z.infer<typeof OpenLibraryBookSchema>
  ): BookMetadata {
    const description = this.extractDescription(data);
    const authors = this.extractAuthors(data);
    const isbn = this.extractIsbn(data);

    // Get cover image
    // Open Library uses cover IDs which are stored in the covers array
    const coverId =
      data.covers && data.covers.length > 0 ? data.covers[0] : undefined;
    const image = coverId ? this.buildCoverUrl(coverId, 'L') : undefined;

    // If we have an ISBN and no cover, try ISBN-based cover
    const fallbackImage =
      !image && isbn ? this.buildIsbnCoverUrl(isbn, 'L') : undefined;

    // Build Open Library URL
    // The key is like "/books/OL17926419M" - we need to convert to web URL
    const webKey = data.key.startsWith('/') ? data.key.slice(1) : data.key;
    const url = `${this.webUrl}/${webKey}`;

    // Get publish date - prefer first_publish_date
    const publishDate = data.first_publish_date || data.publish_date;

    return {
      id: data.key,
      type: 'book',
      title: data.title,
      description,
      image: image || fallbackImage,
      url,
      authors,
      publisher:
        data.publishers && data.publishers.length > 0
          ? data.publishers[0]
          : undefined,
      publishDate,
      pageCount: data.number_of_pages,
      isbn,
    };
  }

  /**
   * Transform search result document to BookMetadata
   */
  private transformSearchDocToBookMetadata(
    doc: z.infer<typeof OpenLibrarySearchResponseSchema>['docs'][number]
  ): BookMetadata {
    const image = doc.cover_i
      ? this.buildCoverUrl(doc.cover_i, 'L')
      : undefined;
    const isbn = doc.isbn && doc.isbn.length > 0 ? doc.isbn[0] : undefined;
    const fallbackImage =
      !image && isbn ? this.buildIsbnCoverUrl(isbn, 'L') : undefined;

    // Clean the key - search results return keys like "/works/OL2867580W"
    const cleanKey = doc.key.startsWith('/') ? doc.key.slice(1) : doc.key;
    const url = `${this.webUrl}/${cleanKey}`;

    return {
      id: cleanKey,
      type: 'book',
      title: doc.title,
      image: image || fallbackImage,
      url,
      authors: doc.author_name,
      publishDate: doc.first_publish_year
        ? String(doc.first_publish_year)
        : undefined,
      isbn,
    };
  }
}

/**
 * Factory function to create an Open Library adapter with default configuration
 */
export function createOpenLibraryAdapter(): OpenLibraryAdapter {
  return new OpenLibraryAdapter();
}

/**
 * Default singleton instance
 */
let defaultOpenLibraryAdapter: OpenLibraryAdapter | null = null;

export function getDefaultOpenLibraryAdapter(): OpenLibraryAdapter {
  if (!defaultOpenLibraryAdapter) {
    defaultOpenLibraryAdapter = new OpenLibraryAdapter();
  }
  return defaultOpenLibraryAdapter;
}

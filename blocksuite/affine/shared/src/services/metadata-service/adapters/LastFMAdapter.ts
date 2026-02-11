import { z } from 'zod';

import type { MediaMetadata, MusicMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

/**
 * Zod schemas for Last.fm API responses
 */

const LastFmImageSchema = z.array(
  z.object({
    '#text': z.string(),
    size: z.string(),
  })
);

const TagSchema = z.object({
  name: z.string(),
  url: z.string(),
});

const LastFmTagsSchema = z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z
    .object({
      tag: z.union([z.array(TagSchema), TagSchema]),
    })
    .optional()
);

const LastFmWikiSchema = z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z
    .object({
      published: z.string().optional(),
      summary: z.string().optional(),
      content: z.string().optional(),
    })
    .optional()
);

const LastFmAlbumSchema = z.object({
  name: z.string(),
  artist: z.string(),
  url: z.string(),
  image: LastFmImageSchema.optional(),
  listeners: z.string().optional(),
  playcount: z.string().optional(),
  releasedate: z.string().optional(),
  tags: LastFmTagsSchema,
  wiki: LastFmWikiSchema,
});

const LastFmAlbumSearchResultSchema = z.object({
  name: z.string(),
  artist: z.string(),
  url: z.string(),
  image: LastFmImageSchema.optional(),
  listeners: z.string().optional(),
});

const LastFmSearchResponseSchema = z.object({
  results: z.object({
    albummatches: z.object({
      album: z.array(LastFmAlbumSearchResultSchema),
    }),
    'opensearch:totalResults': z.string(),
    'opensearch:startIndex': z.string(),
    'opensearch:itemsPerPage': z.string(),
  }),
});

const LastFmAlbumInfoResponseSchema = z.object({
  album: LastFmAlbumSchema,
});

/**
 * Last.fm Adapter for fetching music (album) metadata
 *
 * API Key required - get one free at:
 * https://www.last.fm/api/account/create
 *
 * Free tier: No explicit limits, but be respectful (don't exceed 5 requests/sec)
 */
export class LastFMAdapter extends BaseMetadataAdapter {
  readonly type = 'music' as const;
  readonly source = 'lastfm';

  private readonly baseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new Last.fm adapter
   */
  constructor(apiKey = '') {
    super();
    this.baseUrl = '/api/worker/metadata/lastfm';
    this.apiKey = apiKey;
  }

  /**
   * Fetch album details by Last.fm MBID (MusicBrainz ID) or artist+album name
   * The ID format is: "artist|album" (pipe-separated) or just MBID
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    // Check if ID contains pipe separator (artist|album)
    const pipeIndex = id.indexOf('|');
    if (pipeIndex > 0) {
      const artist = id.slice(0, pipeIndex);
      const album = id.slice(pipeIndex + 1);
      return this.fetchByName(artist, album, signal);
    }

    // Otherwise treat as MBID
    return this.fetchByMBID(id, signal);
  }

  /**
   * Search for albums by query
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
        `Last.fm proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = LastFmSearchResponseSchema.parse(await response.json());

    const albums = data.results.albummatches.album;
    if (!albums || albums.length === 0) {
      return [];
    }

    const results = albums
      .slice(0, limit)
      .map(album => ({
        item: this.transformSearchResultToMetadata(album),
        score: this.calculateRelevanceScore(album.name, query),
      }))
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is valid for Last.fm
   * Accepts MBID (UUID) or "artist|album" format
   */
  override isValidId(id: string): boolean {
    // Check for pipe-separated format
    if (id.includes('|') && id.length > 2) {
      return true;
    }
    // Check for MBID (UUID format)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Fetch album by MBID
   */
  private async fetchByMBID(
    mbid: string,
    signal?: AbortSignal
  ): Promise<MusicMetadata> {
    const params = new URLSearchParams({
      method: 'album.getInfo',
      mbid,
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Album not found: ${mbid}`);
      }
      throw new Error(
        `Last.fm proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = LastFmAlbumInfoResponseSchema.parse(await response.json());
    return this.transformToMusicMetadata(data.album);
  }

  /**
   * Fetch album by artist and album name
   */
  private async fetchByName(
    artist: string,
    album: string,
    signal?: AbortSignal
  ): Promise<MusicMetadata> {
    const params = new URLSearchParams({
      method: 'album.getInfo',
      artist,
      album,
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Album not found: ${artist} - ${album}`);
      }
      throw new Error(
        `Last.fm proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = LastFmAlbumInfoResponseSchema.parse(await response.json());
    return this.transformToMusicMetadata(data.album);
  }

  /**
   * Build URL for album search endpoint
   */
  private buildSearchUrl(query: string, limit: number): string {
    const params = new URLSearchParams({
      method: 'album.search',
      album: query.trim(),
      limit: String(limit),
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Get best available image URL from Last.fm image array
   */
  private getBestImageUrl(
    images: z.infer<typeof LastFmImageSchema> | undefined
  ): string | undefined {
    if (!images || images.length === 0) {
      return undefined;
    }

    // Prefer larger images (Last.fm sizes: small, medium, large, extralarge)
    let imageUrl: string | undefined;
    const sizeOrder = ['extralarge', 'large', 'medium', 'small'];
    for (const size of sizeOrder) {
      const image = images.find(img => img.size === size);
      if (image && image['#text']) {
        imageUrl = image['#text'];
        break;
      }
    }

    // Fall back to first image with a URL
    if (!imageUrl) {
      const firstImage = images.find(img => img['#text']);
      imageUrl = firstImage?.['#text'];
    }

    // Convert HTTP to HTTPS to avoid mixed content issues
    if (imageUrl && imageUrl.startsWith('http://')) {
      imageUrl = imageUrl.replace('http://', 'https://');
    }

    return imageUrl;
  }

  /**
   * Extract genres from Last.fm tags
   */
  private extractGenres(
    tags: z.infer<typeof LastFmAlbumSchema>['tags']
  ): string[] | undefined {
    if (!tags) {
      return undefined;
    }

    const tagArray = Array.isArray(tags.tag) ? tags.tag : [tags.tag];
    const genres = tagArray.map(t => t.name).filter(Boolean);

    return genres.length > 0 ? genres : undefined;
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
   * Transform Last.fm album to MusicMetadata
   */
  private transformToMusicMetadata(
    data: z.infer<typeof LastFmAlbumSchema>
  ): MusicMetadata {
    const image = this.getBestImageUrl(data.image);
    const genres = this.extractGenres(data.tags);

    // Use wiki content or summary as description, strip HTML
    const rawDescription = data.wiki?.content || data.wiki?.summary;
    let description = this.stripHtml(rawDescription);

    // If no wiki description, build one from available metadata
    if (!description) {
      const parts: string[] = [];
      if (data.listeners) {
        parts.push(`${Number(data.listeners).toLocaleString()} listeners`);
      }
      if (data.playcount) {
        parts.push(`${Number(data.playcount).toLocaleString()} plays`);
      }
      if (genres && genres.length > 0) {
        parts.push(`Genres: ${genres.slice(0, 3).join(', ')}`);
      }
      if (parts.length > 0) {
        description = parts.join(' • ');
      }
    }

    // Parse release date
    let releaseDate: string | undefined;
    if (data.releasedate && data.releasedate.trim()) {
      releaseDate = data.releasedate.trim();
    } else if (data.wiki?.published) {
      // Try to extract date from wiki published field
      const dateMatch = data.wiki.published.match(/\d{4}/);
      if (dateMatch) {
        releaseDate = dateMatch[0];
      }
    }

    // Build ID as "artist|album" for easy lookup
    const id = `${data.artist}|${data.name}`;

    return {
      id,
      type: 'music',
      title: data.name,
      artist: data.artist,
      album: data.name,
      description,
      image,
      url: data.url,
      genre: genres?.[0],
      releaseDate,
    };
  }

  /**
   * Transform search result to MusicMetadata (limited info)
   */
  private transformSearchResultToMetadata(
    data: z.infer<typeof LastFmAlbumSearchResultSchema>
  ): MusicMetadata {
    const image = this.getBestImageUrl(data.image);

    // Build ID as "artist|album" for fetching full details later
    const id = `${data.artist}|${data.name}`;

    // Include listeners count if available
    let description: string | undefined;
    if (data.listeners) {
      description = `${Number(data.listeners).toLocaleString()} listeners`;
    }

    return {
      id,
      type: 'music',
      title: data.name,
      artist: data.artist,
      album: data.name,
      description,
      image,
      url: data.url,
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
 * Factory function to create a Last.fm adapter
 */
export function createLastFMAdapter(apiKey?: string): LastFMAdapter {
  return new LastFMAdapter(apiKey);
}

/**
 * Default singleton instance
 */
let defaultLastFMAdapter: LastFMAdapter | null = null;

export function getDefaultLastFMAdapter(): LastFMAdapter {
  if (!defaultLastFMAdapter) {
    defaultLastFMAdapter = new LastFMAdapter();
  }
  return defaultLastFMAdapter;
}

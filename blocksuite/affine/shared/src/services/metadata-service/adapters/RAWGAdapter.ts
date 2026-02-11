import { z } from 'zod';

import type { GameMetadata, MediaMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

const RAWG_DB_URL = 'https://rawg.io/games';

/**
 * Zod schemas for RAWG API responses
 */

const RAWGPlatformSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

const RAWGDeveloperSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

const RAWGPublisherSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

const RAWGGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

const RAWGGameSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable().optional(),
  tba: z.boolean().optional(),
  background_image: z.string().nullable().optional(),
  background_image_additional: z.string().nullable().optional(),
  rating: z.number().optional(),
  rating_top: z.number().optional(),
  ratings_count: z.number().optional(),
  metacritic: z.number().optional(),
  playtime: z.number().optional(),
  platforms: z
    .array(
      z.object({
        platform: RAWGPlatformSchema,
        released_at: z.string().optional(),
        requirements_en: z.unknown().optional(),
        requirements_ru: z.unknown().optional(),
      })
    )
    .optional(),
  developers: z.array(RAWGDeveloperSchema).optional(),
  publishers: z.array(RAWGPublisherSchema).optional(),
  genres: z.array(RAWGGenreSchema).optional(),
  description: z.string().optional(),
  description_raw: z.string().optional(),
  website: z.string().optional(),
});

const RAWGSearchResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(
    z
      .object({
        slug: z.string(),
        name: z.string(),
        released: z.string().nullable().optional(),
        tba: z.boolean().optional(),
        background_image: z.string().nullable().optional(),
        rating: z.number().optional(),
        rating_top: z.number().optional(),
        platforms: z
          .array(
            z.object({
              platform: RAWGPlatformSchema,
            })
          )
          .optional(),
      })
      .passthrough()
  ),
  user_platforms: z.boolean().optional(),
});

/**
 * RAWG Adapter for fetching video game metadata
 */
export class RAWGAdapter extends BaseMetadataAdapter {
  readonly type = 'game' as const;
  readonly source = 'rawg';

  private readonly baseUrl: string;
  private readonly dbUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new RAWG adapter
   * @param apiKey - RAWG API key
   * @param baseUrl - Custom base URL for API requests (useful for testing)
   * @param dbUrl - Custom base URL for game pages
   */
  constructor(apiKey = '', baseUrl?: string, dbUrl?: string) {
    super();
    this.baseUrl = baseUrl || '/api/worker/metadata/rawg';
    this.dbUrl = dbUrl || RAWG_DB_URL;
    this.apiKey = apiKey;
  }

  /**
   * Fetch game details by RAWG ID
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    // RAWG uses numeric IDs or slugs
    const identifier = this.parseId(id);
    const url = this.buildDetailsUrl(identifier);

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`RAWG proxy request failed: ${response.status}`);
    }
    const data = RAWGGameSchema.parse(await response.json());

    return this.transformToGameMetadata(data);
  }

  /**
   * Search for games by title
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query);
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`RAWG proxy search failed: ${response.status}`);
    }
    const data = RAWGSearchResponseSchema.parse(await response.json());

    const results = data.results
      .slice(0, limit)
      .map(game => ({
        item: this.transformToGameMetadata(game),
        score: this.calculateRelevanceScore(game.name, query),
      }))
      .filter(result => result.item.image)
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is a valid RAWG ID (numeric or slug)
   */
  override isValidId(id: string): boolean {
    // Check for numeric ID
    const numericId = Number(id);
    if (!isNaN(numericId) && numericId > 0 && Number.isInteger(numericId)) {
      return true;
    }
    // Check for slug format (lowercase letters, numbers, hyphens, underscores)
    const slugRegex = /^[a-z0-9_-]+$/;
    return slugRegex.test(id) && id.length > 0 && id.length < 100;
  }

  /**
   * Parse ID - returns as-is since we support both numeric and slug IDs
   */
  private parseId(id: string): string {
    if (!this.isValidId(id)) {
      throw new Error(`Invalid RAWG ID: ${id}`);
    }
    return id;
  }

  /**
   * Build URL for game details endpoint
   */
  private buildDetailsUrl(id: string | number): string {
    return `${this.baseUrl}/games/${id}`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string, pageSize = 5): string {
    const params = new URLSearchParams({
      search: query.trim(),
      page_size: String(pageSize),
    });
    return `${this.baseUrl}/games?${params.toString()}`;
  }

  /**
   * Transform RAWG response to GameMetadata
   */
  private transformToGameMetadata(
    data:
      | z.infer<typeof RAWGGameSchema>
      | z.infer<typeof RAWGSearchResponseSchema>['results'][number]
  ): GameMetadata {
    // Extract cover image
    const imageUrl = data.background_image ?? undefined;

    // Extract platforms (unique names)
    let platforms: string[] | undefined = undefined;
    if ('platforms' in data && Array.isArray(data.platforms)) {
      const platformNames = data.platforms
        .map((p: any) => p?.platform?.name)
        .filter(
          (n: unknown): n is string => typeof n === 'string' && n.length > 0
        );
      if (platformNames.length > 0) {
        platforms = Array.from(new Set(platformNames));
      }
    }

    // Extract developers (unique names)
    let developers: string[] | undefined = undefined;
    if ('developers' in data && Array.isArray(data.developers)) {
      const devNames = data.developers
        .map((d: any) => d?.name)
        .filter(
          (n: unknown): n is string => typeof n === 'string' && n.length > 0
        );
      if (devNames.length > 0) {
        developers = Array.from(new Set(devNames));
      }
    }

    // Extract publishers (unique names)
    let publishers: string[] | undefined = undefined;
    if ('publishers' in data && Array.isArray(data.publishers)) {
      const pubNames = data.publishers
        .map((p: any) => p?.name)
        .filter(
          (n: unknown): n is string => typeof n === 'string' && n.length > 0
        );
      if (pubNames.length > 0) {
        publishers = Array.from(new Set(pubNames));
      }
    }

    // Extract genres
    let genres: string[] | undefined = undefined;
    if ('genres' in data && Array.isArray(data.genres)) {
      const genreNames = data.genres
        .map((g: any) => g?.name)
        .filter(
          (n: unknown): n is string => typeof n === 'string' && n.length > 0
        );
      if (genreNames.length > 0) {
        genres = genreNames;
      }
    }

    // RAWG uses 0-5 scale
    const rating = data.rating ? Math.round(data.rating * 10) / 10 : undefined;

    // Extract description
    let description: string | undefined = undefined;
    if ('description_raw' in data && typeof data.description_raw === 'string') {
      description = data.description_raw;
    } else if ('description' in data && typeof data.description === 'string') {
      description = data.description;
    }

    // Build URL (use slug for better URLs)
    const slug = (data as { slug: string }).slug ?? String(data.id);
    const url = `${this.dbUrl}/${slug}`;

    return {
      id: String(data.id),
      type: 'game',
      title: data.name,
      description,
      image: imageUrl,
      backdrop: imageUrl,
      date: data.released ?? undefined,
      url,
      genres,
      rating,
      developers,
      publishers,
      platforms,
      releaseDate: data.released ?? undefined,
    };
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }
}

/**
 * Factory function to create a RAWG adapter with default configuration
 */
export function createRAWGAdapter(apiKey?: string): RAWGAdapter {
  return new RAWGAdapter(apiKey);
}

/**
 * Default singleton instance (will use environment API key if available)
 */
let defaultRAWGAdapter: RAWGAdapter | null = null;

export function getDefaultRAWGAdapter(): RAWGAdapter {
  if (!defaultRAWGAdapter) {
    defaultRAWGAdapter = new RAWGAdapter();
  }
  return defaultRAWGAdapter;
}

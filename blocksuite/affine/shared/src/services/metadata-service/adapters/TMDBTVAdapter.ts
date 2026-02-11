import { z } from 'zod';

import type { MediaMetadata, MovieMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const TMDB_TV_URL = 'https://www.themoviedb.org/tv';

/**
 * Zod schemas for TMDB TV API responses
 */

const TMDBGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const TMDBTVShowSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  first_air_date: z.string().optional(),
  genre_ids: z.array(z.number()).optional(),
  vote_average: z.number().optional(),
  episode_run_time: z.array(z.number()).optional(),
  tagline: z.string().optional(),
  popularity: z.number().optional(),
});

const TMDBTVSearchResponseSchema = z.object({
  page: z.number(),
  results: z.array(TMDBTVShowSchema),
  total_pages: z.number(),
  total_results: z.number(),
});

const TMDBTVDetailsResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  first_air_date: z.string().optional(),
  genres: z.array(TMDBGenreSchema).optional(),
  vote_average: z.number().optional(),
  episode_run_time: z.array(z.number()).optional(),
  tagline: z.string().optional(),
  number_of_seasons: z.number().optional(),
  number_of_episodes: z.number().optional(),
});

/**
 * TMDB Adapter for fetching TV show metadata
 */
export class TMDBTVAdapter extends BaseMetadataAdapter {
  readonly type = 'tv' as const;
  readonly source = 'tmdb';

  private readonly baseUrl: string;
  private readonly imageBaseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new TMDB TV adapter
   * @param apiKey - TMDB API key
   * @param baseUrl - Custom base URL for API requests (useful for testing)
   * @param imageBaseUrl - Custom base URL for images
   */
  constructor(apiKey = '', baseUrl?: string, imageBaseUrl?: string) {
    super();
    this.baseUrl = baseUrl || '/api/worker/metadata/tmdb';
    this.imageBaseUrl = imageBaseUrl || TMDB_IMAGE_BASE_URL;
    this.apiKey = apiKey;
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Fetch TV show details by TMDB ID
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    const numericId = this.parseId(id);
    const url = this.buildDetailsUrl(numericId);

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`TMDB TV proxy request failed: ${response.status}`);
    }
    const data = TMDBTVDetailsResponseSchema.parse(await response.json());

    return this.transformToTVMetadata(data);
  }

  /**
   * Search for TV shows by title
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query);
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`TMDB TV proxy search failed: ${response.status}`);
    }
    const data = TMDBTVSearchResponseSchema.parse(await response.json());

    const results = data.results
      .slice(0, limit)
      .map(show => ({
        item: this.transformToTVMetadata(show),
        score: this.calculateRelevanceScore(show.name, query),
      }))
      .filter(result => result.item.image || result.item.backdrop)
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is a valid TMDB ID (numeric)
   */
  override isValidId(id: string): boolean {
    const numericId = Number(id);
    return !isNaN(numericId) && numericId > 0 && Number.isInteger(numericId);
  }

  /**
   * Parse ID to ensure it's a valid TMDB numeric ID
   */
  private parseId(id: string): number {
    if (!this.isValidId(id)) {
      throw new Error(`Invalid TMDB ID: ${id}`);
    }
    return Number(id);
  }

  /**
   * Build URL for TV show details endpoint
   */
  private buildDetailsUrl(id: number): string {
    return `${this.baseUrl}/tv/${id}`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string): string {
    const params = new URLSearchParams({
      query: query.trim(),
      include_adult: 'false',
    });
    return `${this.baseUrl}/search/tv?${params.toString()}`;
  }

  /**
   * Transform TMDB response to MovieMetadata (using type: 'tv')
   */
  private transformToTVMetadata(
    data:
      | z.infer<typeof TMDBTVShowSchema>
      | z.infer<typeof TMDBTVDetailsResponseSchema>
  ): MovieMetadata {
    const posterUrl = data.poster_path
      ? `${this.imageBaseUrl}/w500${data.poster_path}`
      : undefined;
    const backdropUrl = data.backdrop_path
      ? `${this.imageBaseUrl}/w780${data.backdrop_path}`
      : undefined;
    const genres =
      'genres' in data && data.genres
        ? data.genres.map(g => g.name)
        : undefined;

    // Get average runtime from episode_run_time array
    const runtime =
      'episode_run_time' in data &&
      data.episode_run_time &&
      data.episode_run_time.length > 0
        ? Math.round(
            data.episode_run_time.reduce((a, b) => a + b, 0) /
              data.episode_run_time.length
          )
        : undefined;

    return {
      id: String(data.id),
      type: 'tv',
      title: data.name,
      originalTitle: data.original_name || data.name,
      description: data.overview || undefined,
      image: posterUrl || backdropUrl,
      backdrop: backdropUrl || posterUrl,
      date: data.first_air_date || undefined,
      url: `${TMDB_TV_URL}/${data.id}`,
      genres,
      rating: data.vote_average
        ? Math.round(data.vote_average * 10) / 10
        : undefined,
      runtime,
      releaseDate: data.first_air_date,
      tagline: 'tagline' in data ? data.tagline : undefined,
    };
  }
}

/**
 * Factory function to create a TMDB TV adapter with default configuration
 */
export function createTMDBTVAdapter(apiKey?: string): TMDBTVAdapter {
  return new TMDBTVAdapter(apiKey);
}

/**
 * Default singleton instance (will use AFFiNE's API key)
 */
let defaultTMDBTVAdapter: TMDBTVAdapter | null = null;

export function getDefaultTMDBTVAdapter(): TMDBTVAdapter {
  if (!defaultTMDBTVAdapter) {
    defaultTMDBTVAdapter = new TMDBTVAdapter();
  }
  return defaultTMDBTVAdapter;
}

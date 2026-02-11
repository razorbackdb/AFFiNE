import { z } from 'zod';

import type { MediaMetadata, MovieMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const TMDB_MOVIE_DB_URL = 'https://www.themoviedb.org/movie';

/**
 * Zod schemas for TMDB API responses
 */

const TMDBGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const TMDBMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  genre_ids: z.array(z.number()).optional(),
  vote_average: z.number().optional(),
  runtime: z.number().optional(),
  tagline: z.string().optional(),
  popularity: z.number().optional(),
});

const TMDBSearchResponseSchema = z.object({
  page: z.number(),
  results: z.array(TMDBMovieSchema),
  total_pages: z.number(),
  total_results: z.number(),
});

const TMDBDetailsResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  genres: z.array(TMDBGenreSchema).optional(),
  vote_average: z.number().optional(),
  runtime: z.number().optional(),
  tagline: z.string().optional(),
});

/**
 * TMDB Adapter for fetching movie and TV metadata
 */
export class TMDBAdapter extends BaseMetadataAdapter {
  readonly type = 'movie' as const;
  readonly source = 'tmdb';

  private readonly baseUrl: string;
  private readonly imageBaseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new TMDB adapter
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
   * Fetch movie details by TMDB ID
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    const numericId = this.parseId(id);
    const url = this.buildDetailsUrl(numericId);

    const response = await fetch(url, { signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`TMDB proxy request failed: ${response.status} ${text}`);
    }
    const data = TMDBDetailsResponseSchema.parse(await response.json());

    return this.transformToMovieMetadata(data);
  }

  /**
   * Search for movies by title
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query);
    const response = await fetch(url, { signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`TMDB proxy search failed: ${response.status} ${text}`);
    }
    const data = TMDBSearchResponseSchema.parse(await response.json());

    const results = data.results
      .slice(0, limit)
      .map(movie => ({
        item: this.transformToMovieMetadata(movie),
        score: this.calculateRelevanceScore(movie.title, query),
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
   * Build URL for movie details endpoint
   */
  private buildDetailsUrl(id: number): string {
    return `${this.baseUrl}/movie/${id}`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string): string {
    const params = new URLSearchParams({
      query: query.trim(),
      include_adult: 'false',
    });
    return `${this.baseUrl}/search/movie?${params.toString()}`;
  }

  /**
   * Transform TMDB response to MovieMetadata
   */
  private transformToMovieMetadata(
    data:
      | z.infer<typeof TMDBMovieSchema>
      | z.infer<typeof TMDBDetailsResponseSchema>
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

    return {
      id: String(data.id),
      type: 'movie',
      title: data.title,
      originalTitle: data.original_title || data.title,
      description: data.overview || undefined,
      image: posterUrl || backdropUrl,
      backdrop: backdropUrl || posterUrl,
      date: data.release_date || undefined,
      url: `${TMDB_MOVIE_DB_URL}/${data.id}`,
      genres,
      rating: data.vote_average
        ? Math.round(data.vote_average * 10) / 10
        : undefined,
      runtime: data.runtime,
      releaseDate: data.release_date,
      tagline: 'tagline' in data ? data.tagline : undefined,
    };
  }

  /**
   * Get a poster URL at a specific size
   * @param posterPath - The poster path from TMDB
   * @param size - One of: 'w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'
   */
  getPosterUrl(
    posterPath: string,
    size:
      | 'w92'
      | 'w154'
      | 'w185'
      | 'w342'
      | 'w500'
      | 'w780'
      | 'original' = 'w500'
  ): string {
    return `${this.imageBaseUrl}/${size}${posterPath}`;
  }

  /**
   * Get a backdrop URL at a specific size
   * @param backdropPath - The backdrop path from TMDB
   * @param size - One of: 'w300', 'w780', 'w1280', 'original'
   */
  getBackdropUrl(
    backdropPath: string,
    size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'
  ): string {
    return `${this.imageBaseUrl}/${size}${backdropPath}`;
  }
}

/**
 * Factory function to create a TMDB adapter with default configuration
 */
export function createTMDBAdapter(apiKey?: string): TMDBAdapter {
  return new TMDBAdapter(apiKey);
}

/**
 * Default singleton instance (will use AFFiNE's API key)
 */
let defaultTMDBAdapter: TMDBAdapter | null = null;

export function getDefaultTMDBAdapter(): TMDBAdapter {
  if (!defaultTMDBAdapter) {
    defaultTMDBAdapter = new TMDBAdapter();
  }
  return defaultTMDBAdapter;
}

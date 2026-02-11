/**
 * Cache configuration constants
 */

/**
 * Default TTL for metadata cache entries
 */
export const DEFAULT_METADATA_CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Maximum number of items in the metadata cache
 */
export const DEFAULT_METADATA_CACHE_SIZE = 100;

/**
 * Storage key for IndexedDB/local storage persistence
 */
export const METADATA_CACHE_STORAGE_KEY = 'affine:metadata-cache';

/**
 * TMDB API configuration
 */
export const TMDB_CONFIG = {
  /** Base URL for TMDB API */
  BASE_URL: 'https://api.themoviedb.org/3',
  /** Base URL for TMDB images */
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
  /** Movie details URL format */
  MOVIE_URL: (id: number | string) => `https://www.themoviedb.org/movie/${id}`,
  /** Default poster image size */
  POSTER_SIZE: 'w500' as const,
  /** Default backdrop image size */
  BACKDROP_SIZE: 'w780' as const,
} as const;

/**
 * Supported image sizes for TMDB posters
 */
export const TMDB_POSTER_SIZES = [
  'w92',
  'w154',
  'w185',
  'w342',
  'w500',
  'w780',
  'original',
] as const;

/**
 * Supported image sizes for TMDB backdrops
 */
export const TMDB_BACKDROP_SIZES = [
  'w300',
  'w780',
  'w1280',
  'original',
] as const;

/**
 * Request timeout in milliseconds
 */
export const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Maximum retry attempts for failed requests
 */
export const MAX_RETRY_ATTEMPTS = 2;

/**
 * Default search result limit
 */
export const DEFAULT_SEARCH_LIMIT = 5;

/**
 * Maximum search result limit
 */
export const MAX_SEARCH_LIMIT = 20;

/**
 * RAWG API configuration
 */
export const RAWG_CONFIG = {
  /** Base URL for RAWG API */
  BASE_URL: 'https://api.rawg.io/api',
  /** Base URL for RAWG game pages */
  DB_URL: 'https://rawg.io/games',
  /** Default API key (users should provide their own) */
  DEFAULT_API_KEY: '',
  /** Get an API key at */
  SIGNUP_URL: 'https://rawg.io/apicontroller',
} as const;

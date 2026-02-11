import { z } from 'zod';

/**
 * Supported media types for metadata cards
 */
export type MediaType = 'movie' | 'tv' | 'game' | 'music' | 'book';

/**
 * Base metadata interface for all media types
 */
export interface BaseMediaMetadata {
  /** Unique identifier for the media item */
  id: string;
  /** Media type category */
  type: MediaType;
  /** Primary title/name */
  title: string;
  /** Optional original title (for non-English content) */
  originalTitle?: string;
  /** Brief description or summary */
  description?: string;
  /** Poster/image URL */
  image?: string;
  /** Backdrop/large image URL */
  backdrop?: string;
  /** Release/publish date */
  date?: string;
  /** URL to view more details */
  url?: string;
}

/**
 * Movie/TV specific metadata
 */
export interface MovieMetadata extends BaseMediaMetadata {
  type: 'movie' | 'tv';
  /** Genre list */
  genres?: string[];
  /** Rating (0-10 scale) */
  rating?: number;
  /** Runtime in minutes */
  runtime?: number;
  /** Release date */
  releaseDate?: string;
  /** Tagline */
  tagline?: string;
}

/**
 * Music specific metadata
 */
export interface MusicMetadata extends BaseMediaMetadata {
  type: 'music';
  /** Artist name */
  artist?: string;
  /** Album name */
  album?: string;
  /** Release date */
  releaseDate?: string;
  /** Genre */
  genre?: string;
  /** Track count */
  trackCount?: number;
}

/**
 * Book specific metadata
 */
export interface BookMetadata extends BaseMediaMetadata {
  type: 'book';
  /** Author name(s) */
  authors?: string[];
  /** Publisher */
  publisher?: string;
  /** Publish date */
  publishDate?: string;
  /** Page count */
  pageCount?: number;
  /** ISBN */
  isbn?: string;
}

/**
 * Game specific metadata
 */
export interface GameMetadata extends BaseMediaMetadata {
  type: 'game';
  /** Developer(s) */
  developers?: string[];
  /** Publisher(s) */
  publishers?: string[];
  /** Release date */
  releaseDate?: string;
  /** Genre list */
  genres?: string[];
  /** Rating (0-5 scale) */
  rating?: number;
  /** Platform list */
  platforms?: string[];
}

/**
 * Union type for all media metadata
 */
export type MediaMetadata =
  | MovieMetadata
  | MusicMetadata
  | BookMetadata
  | GameMetadata;

/**
 * Zod schemas for validation
 */

export const BaseMediaMetadataSchema = z.object({
  id: z.string(),
  type: z.enum(['movie', 'tv', 'game', 'music', 'book']),
  title: z.string(),
  originalTitle: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  backdrop: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
});

export const MovieMetadataSchema = BaseMediaMetadataSchema.extend({
  type: z.enum(['movie', 'tv']),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
  runtime: z.number().optional(),
  releaseDate: z.string().optional(),
  tagline: z.string().optional(),
});

export const MusicMetadataSchema = BaseMediaMetadataSchema.extend({
  type: z.literal('music'),
  artist: z.string().optional(),
  album: z.string().optional(),
  releaseDate: z.string().optional(),
  genre: z.string().optional(),
  trackCount: z.number().optional(),
});

export const BookMetadataSchema = BaseMediaMetadataSchema.extend({
  type: z.literal('book'),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  publishDate: z.string().optional(),
  pageCount: z.number().optional(),
  isbn: z.string().optional(),
});

export const GameMetadataSchema = BaseMediaMetadataSchema.extend({
  type: z.literal('game'),
  developers: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  releaseDate: z.string().optional(),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  platforms: z.array(z.string()).optional(),
});

export const MediaMetadataSchema = z.discriminatedUnion('type', [
  MovieMetadataSchema,
  MusicMetadataSchema,
  BookMetadataSchema,
  GameMetadataSchema,
]);

/**
 * Common metadata fields for database property configuration
 */
export const METADATA_FIELDS = [
  { key: 'rating', label: 'Rating' },
  { key: 'releaseDate', label: 'Release Date' },
  { key: 'year', label: 'Year' },
  { key: 'genres', label: 'Genres' },
  { key: 'authors', label: 'Author(s)' },
  { key: 'artist', label: 'Artist' },
  { key: 'developers', label: 'Developer(s)' },
  { key: 'pageCount', label: 'Page Count' },
] as const;

/**
 * Search result metadata includes a relevance score
 */
export interface SearchResult<T extends MediaMetadata = MediaMetadata> {
  item: T;
  score: number;
}

/**
 * Metadata cache configuration
 */
export interface MetadataCacheConfig {
  /** Maximum number of items in the cache */
  cacheSize: number;
  /** Time to live for the memory cache in milliseconds */
  memoryTTL: number;
  /** Time to live for the persistent cache in milliseconds */
  persistentTTL: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_METADATA_CACHE_CONFIG: MetadataCacheConfig = {
  cacheSize: 100,
  memoryTTL: 1000 * 60 * 60, // 60 minutes
  persistentTTL: 1000 * 60 * 60 * 24 * 7, // 7 days
};

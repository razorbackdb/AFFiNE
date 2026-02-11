import { type Container, createIdentifier } from '@blocksuite/global/di';
import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';
import { Extension } from '@blocksuite/store';
import QuickLRU from 'quick-lru';

import { isAbortError } from '../../utils/is-abort-error';
import type { MetadataAdapter } from './adapters/base';
import { getDefaultGoogleBooksAdapter } from './adapters/GoogleBooksAdapter';
import { getDefaultLastFMAdapter } from './adapters/LastFMAdapter';
import { getDefaultRAWGAdapter } from './adapters/RAWGAdapter';
import { getDefaultTMDBAdapter } from './adapters/TMDBAdapter';
import { getDefaultTMDBTVAdapter } from './adapters/TMDBTVAdapter';
import {
  DEFAULT_METADATA_CACHE_SIZE,
  DEFAULT_METADATA_CACHE_TTL,
} from './constants';
import type {
  MediaMetadata,
  MediaType,
  MetadataCacheConfig,
  SearchResult,
} from './types';

/**
 * Provider interface for metadata service
 */
export interface MetadataServiceProvider {
  /**
   * Fetch metadata for a specific media item by ID
   * @param type - The media type
   * @param id - Unique identifier for the media item
   * @param signal - AbortSignal for cancellation
   * @returns Promise resolving to the media metadata
   */
  fetch: (
    type: MediaType,
    id: string,
    signal?: AbortSignal
  ) => Promise<MediaMetadata>;

  /**
   * Search for media items by query
   * @param type - The media type to search
   * @param query - Search query string
   * @param signal - AbortSignal for cancellation
   * @param limit - Maximum number of results
   * @returns Promise resolving to search results
   */
  search: (
    type: MediaType,
    query: string,
    signal?: AbortSignal,
    limit?: number
  ) => Promise<SearchResult[]>;

  /**
   * Clear the metadata cache
   */
  clearCache: () => void;

  /**
   * Get cache statistics
   */
  getCacheStats: () => { size: number; keys: string[] };
}

/**
 * DI identifier for the metadata service
 */
export const MetadataServiceIdentifier =
  createIdentifier<MetadataServiceProvider>('AffineMetadataService');

/**
 * Configuration options for the metadata service
 */
export interface MetadataServiceOptions {
  /** Cache configuration */
  cache?: Partial<MetadataCacheConfig>;
  /** Custom adapters to register */
  adapters?: MetadataAdapter[];
}

/**
 * Default metadata service implementation
 *
 * Provides cached metadata fetching for media items with:
 * - Memory caching with LRU eviction
 * - Request deduplication
 * - Abort signal support
 * - Pluggable adapter architecture
 */
export class MetadataService
  extends Extension
  implements MetadataServiceProvider
{
  static options: MetadataServiceOptions | undefined;

  static override setup(di: Container): void {
    di.addImpl(MetadataServiceIdentifier, () => new MetadataService());
  }

  /**
   * Memory cache for fetched metadata
   */
  private readonly cache: QuickLRU<string, MediaMetadata | SearchResult[]>;

  /**
   * Pending requests for deduplication
   */
  private readonly pendingRequests: Map<string, Promise<MediaMetadata>>;

  /**
   * Pending searches for deduplication
   */
  private readonly pendingSearches: Map<string, Promise<SearchResult[]>>;

  /**
   * Registered adapters by media type
   */
  private readonly adapters: Map<MediaType, MetadataAdapter>;

  /**
   * Default configuration
   */
  private readonly config: MetadataCacheConfig;

  constructor(options: MetadataServiceOptions = MetadataService.options || {}) {
    super();

    this.config = {
      cacheSize: options.cache?.cacheSize ?? DEFAULT_METADATA_CACHE_SIZE,
      memoryTTL: options.cache?.memoryTTL ?? DEFAULT_METADATA_CACHE_TTL,
      persistentTTL:
        options.cache?.persistentTTL ?? DEFAULT_METADATA_CACHE_TTL * 24 * 7,
    };

    this.cache = new QuickLRU({
      maxSize: this.config.cacheSize,
      maxAge: this.config.memoryTTL,
    });

    this.pendingRequests = new Map();
    this.pendingSearches = new Map();

    // Initialize adapters
    this.adapters = new Map<MediaType, MetadataAdapter>();

    // Register default TMDB adapter for movies
    this.registerAdapter(getDefaultTMDBAdapter());

    // Register default TMDB TV adapter for TV shows
    this.registerAdapter(getDefaultTMDBTVAdapter());

    // Register default Last.fm adapter for music
    this.registerAdapter(getDefaultLastFMAdapter());

    // Register default Google Books adapter for books
    this.registerAdapter(getDefaultGoogleBooksAdapter());

    // Register default RAWG adapter for games
    this.registerAdapter(getDefaultRAWGAdapter());

    // Register any custom adapters
    if (options.adapters) {
      for (const adapter of options.adapters) {
        this.registerAdapter(adapter);
      }
    }
  }

  /**
   * Register a metadata adapter
   */
  registerAdapter(adapter: MetadataAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  /**
   * Unregister a metadata adapter by type
   */
  unregisterAdapter(type: MediaType): void {
    this.adapters.delete(type);
  }

  /**
   * Get the adapter for a specific media type
   */
  getAdapter(type: MediaType): MetadataAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Build a cache key for fetch operations
   */
  private buildCacheKey(type: MediaType, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Build a cache key for search operations
   */
  private buildSearchCacheKey(
    type: MediaType,
    query: string,
    limit: number
  ): string {
    return `search:${type}:${query}:${limit}`;
  }

  /**
   * Fetch metadata by type and ID
   */
  fetch = async (
    type: MediaType,
    id: string,
    signal?: AbortSignal
  ): Promise<MediaMetadata> => {
    const cacheKey = this.buildCacheKey(type, id);

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !Array.isArray(cached)) {
      return cached;
    }

    // Check for pending request (deduplication)
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Get adapter for this media type
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new BlockSuiteError(
        ErrorCode.DefaultRuntimeError,
        `No adapter registered for media type: ${type}`
      );
    }

    // Validate ID format
    if (!adapter.isValidId(id)) {
      throw new BlockSuiteError(
        ErrorCode.DefaultRuntimeError,
        `Invalid ID format for ${type}: ${id}`
      );
    }

    // Create the fetch promise
    const promise = (async () => {
      try {
        const result = await adapter.fetch(id, signal);
        // Cache the result
        this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        // Re-throw abort errors immediately
        if (isAbortError(error)) {
          throw error;
        }
        // Log and re-throw other errors for debugging
        console.error(`Fetch failed for ${type}:${id}`, error);
        throw error;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(cacheKey);
      }
    })();

    // Store as pending for deduplication
    this.pendingRequests.set(cacheKey, promise);

    return promise;
  };

  /**
   * Search for media items
   */
  search = async (
    type: MediaType,
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> => {
    // Skip empty queries
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return [];
    }

    const cacheKey = this.buildSearchCacheKey(type, trimmedQuery, limit);

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    // Check for pending search (deduplication)
    const pendingSearch = this.pendingSearches.get(cacheKey);
    if (pendingSearch) {
      return pendingSearch;
    }

    // Get adapter for this media type
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new BlockSuiteError(
        ErrorCode.DefaultRuntimeError,
        `No adapter registered for media type: ${type}`
      );
    }

    // Create the search promise
    const promise = (async () => {
      try {
        const results = await adapter.search(trimmedQuery, signal, limit);
        // Cache the results
        this.cache.set(cacheKey, results);
        return results;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        console.error(`Search failed for ${type}: ${query}`, error);
        return [];
      } finally {
        // Clean up pending search
        this.pendingSearches.delete(cacheKey);
      }
    })();

    // Store as pending for deduplication
    this.pendingSearches.set(cacheKey, promise);

    return promise;
  };

  /**
   * Clear all cached metadata
   */
  clearCache = (): void => {
    this.cache.clear();
    this.pendingRequests.clear();
    this.pendingSearches.clear();
  };

  /**
   * Get cache statistics
   */
  getCacheStats = () => {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  };

  /**
   * Prefetch multiple items (useful for optimization)
   */
  prefetch = async (
    items: Array<{ type: MediaType; id: string }>
  ): Promise<void> => {
    const promises = items.map(({ type, id }) =>
      this.fetch(type, id).catch(() => {
        // Silently fail prefetch errors
      })
    );
    await Promise.all(promises);
  };
}

/**
 * Extension factory for custom configuration
 */
export const MetadataServiceExtension = (options?: MetadataServiceOptions) => {
  MetadataService.options = options;
  return MetadataService;
};

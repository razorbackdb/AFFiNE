import type { MediaMetadata, MediaType, SearchResult } from '../types';

/**
 * Base interface for all metadata adapters.
 * Each adapter handles fetching metadata for a specific media type source.
 */
export interface MetadataAdapter {
  /**
   * The media type this adapter handles
   */
  readonly type: MediaType;

  /**
   * The source/name of this adapter (e.g., 'tmdb', 'musicbrainz', 'openlibrary')
   */
  readonly source: string;

  /**
   * Fetch metadata by unique identifier
   * @param id - The unique identifier for the media item
   * @param signal - AbortSignal for request cancellation
   * @returns Promise resolving to the media metadata
   */
  fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata>;

  /**
   * Search for media items by query string
   * @param query - The search query (typically a title or name)
   * @param signal - AbortSignal for request cancellation
   * @param limit - Maximum number of results to return (default: 5)
   * @returns Promise resolving to an array of search results with relevance scores
   */
  search(
    query: string,
    signal?: AbortSignal,
    limit?: number
  ): Promise<SearchResult[]>;

  /**
   * Validate if an ID is valid for this adapter
   * @param id - The ID to validate
   * @returns true if the ID format is valid for this adapter
   */
  isValidId(id: string): boolean;
}

/**
 * Abstract base class with common adapter functionality
 */
export abstract class BaseMetadataAdapter implements MetadataAdapter {
  abstract readonly type: MediaType;
  abstract readonly source: string;

  /**
   * Default implementation for search limit
   */
  protected readonly defaultSearchLimit = 5;

  abstract fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata>;
  abstract search(
    query: string,
    signal?: AbortSignal,
    limit?: number
  ): Promise<SearchResult[]>;

  /**
   * Default ID validation - can be overridden by subclasses
   */
  isValidId(id: string): boolean {
    return id.length > 0 && id.length < 100;
  }

  /**
   * Helper to create a search result with a default score
   */
  protected createSearchResult(item: MediaMetadata, score = 1.0): SearchResult {
    return { item, score };
  }

  /**
   * Calculate a relevance score based on query matching
   * Higher score for exact title match, lower for partial match
   */
  protected calculateRelevanceScore(itemTitle: string, query: string): number {
    const normalizedTitle = itemTitle.toLowerCase().trim();
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedTitle === normalizedQuery) {
      return 1.0;
    }

    if (normalizedTitle.startsWith(normalizedQuery)) {
      return 0.9;
    }

    if (normalizedTitle.includes(normalizedQuery)) {
      return 0.7;
    }

    // Calculate word overlap
    const queryWords = normalizedQuery.split(/\s+/);
    const titleWords = normalizedTitle.split(/\s+/);
    const matchingWords = queryWords.filter(word => titleWords.includes(word));
    return matchingWords.length / Math.max(queryWords.length, 1);
  }
}

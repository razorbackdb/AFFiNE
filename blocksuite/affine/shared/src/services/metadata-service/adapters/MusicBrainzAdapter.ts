import { z } from 'zod';

import type { MediaMetadata, MusicMetadata, SearchResult } from '../types';
import { BaseMetadataAdapter } from './base';

/**
 * MusicBrainz API configuration
 * MusicBrainz API is open and doesn't require authentication for basic usage
 * However, they require a unique User-Agent header
 */
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const MUSICBRAINZ_WEB_URL = 'https://musicbrainz.org/release';
const MUSICBRAINZ_COVER_ART_BASE_URL = 'https://coverartarchive.org';

/**
 * MusicBrainz API request headers
 * MusicBrainz requires a unique User-Agent identifying the application
 */
const MUSICBRAINZ_HEADERS = {
  'User-Agent': 'AFFiNE/0.1 (https://affine.pro; contact@toeverything.com)',
};

/**
 * Zod schemas for MusicBrainz API responses
 */

const MusicBrainzArtistCreditSchema = z.object({
  name: z.string(),
  artist: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

const MusicBrainzReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  'artist-credit': z.array(MusicBrainzArtistCreditSchema),
  date: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  'label-info-list': z
    .array(
      z.object({
        label: z
          .object({
            name: z.string(),
          })
          .optional(),
      })
    )
    .optional(),
  barcode: z.string().nullable().optional(),
  asin: z.string().nullable().optional(),
  media: z
    .array(
      z.object({
        format: z.string().optional(),
        'track-count': z.number().optional(),
        'track-list': z
          .array(
            z.object({
              title: z.string(),
              number: z.number(),
              length: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  coverart: z
    .object({
      images: z.array(
        z.object({
          front: z.boolean().optional(),
          image: z.string(),
          types: z.array(z.string()).optional(),
        })
      ),
    })
    .optional(),
});

const MusicBrainzSearchResponseSchema = z.object({
  releases: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      score: z.number(),
      'artist-credit': z.array(MusicBrainzArtistCreditSchema),
      date: z.string().optional(),
    })
  ),
  count: z.number(),
});

/**
 * MusicBrainz Adapter for fetching music (release/album) metadata
 */
export class MusicBrainzAdapter extends BaseMetadataAdapter {
  readonly type = 'music' as const;
  readonly source = 'musicbrainz';

  private readonly baseUrl: string;
  private readonly coverArtBaseUrl: string;

  /**
   * Create a new MusicBrainz adapter
   * @param baseUrl - Custom base URL for API requests (useful for testing)
   * @param coverArtBaseUrl - Custom base URL for cover art images
   */
  constructor(baseUrl?: string, coverArtBaseUrl?: string) {
    super();
    this.baseUrl = baseUrl || MUSICBRAINZ_BASE_URL;
    this.coverArtBaseUrl = coverArtBaseUrl || MUSICBRAINZ_COVER_ART_BASE_URL;
  }

  /**
   * Fetch release details by MusicBrainz Release ID
   * The ID should be a MusicBrainz release UUID (e.g., "996d7a2d-f931-4471-873a-ee281f0d0a37")
   */
  async fetch(id: string, signal?: AbortSignal): Promise<MediaMetadata> {
    const url = this.buildReleaseUrl(id);
    const response = await this.fetchWithHeaders(url, signal);
    const data = MusicBrainzReleaseSchema.parse(await response.json());

    // Fetch cover art separately from Cover Art Archive
    const coverArt = await this.fetchCoverArt(id, signal).catch(
      () => undefined
    );

    return this.transformToMusicMetadata(data, coverArt);
  }

  /**
   * Search for releases by title
   */
  async search(
    query: string,
    signal?: AbortSignal,
    limit = 5
  ): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query, limit);
    const response = await this.fetchWithHeaders(url, signal);
    const data = MusicBrainzSearchResponseSchema.parse(await response.json());

    const results = data.releases
      .slice(0, limit)
      .map(release => ({
        item: this.transformToMusicMetadata(release),
        score: this.calculateRelevanceScore(release.title, query),
      }))
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Validate if the ID is a valid MusicBrainz UUID
   * MusicBrainz uses UUIDs in the format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  override isValidId(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Build URL for release lookup endpoint
   * Includes inc=artist-credits+media+labels to get detailed information
   */
  private buildReleaseUrl(id: string): string {
    return `${this.baseUrl}/release/${id}?fmt=json&inc=artist-credits+media+labels+release-groups`;
  }

  /**
   * Build URL for search endpoint
   */
  private buildSearchUrl(query: string, limit: number): string {
    const params = new URLSearchParams({
      query: `release:${query.trim()}`,
      limit: String(limit),
      fmt: 'json',
    });
    return `${this.baseUrl}/release?${params.toString()}`;
  }

  /**
   * Build URL for cover art lookup
   */
  private buildCoverArtUrl(id: string): string {
    return `${this.coverArtBaseUrl}/release/${id}`;
  }

  /**
   * Fetch with required MusicBrainz headers
   */
  private async fetchWithHeaders(
    url: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const response = await fetch(url, {
      signal,
      headers: MUSICBRAINZ_HEADERS,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Release not found: ${url}`);
      }
      throw new Error(
        `MusicBrainz API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response;
  }

  /**
   * Fetch cover art from Cover Art Archive
   * This is a separate service that provides album cover images
   */
  private async fetchCoverArt(
    id: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    try {
      const url = this.buildCoverArtUrl(id);
      const response = await fetch(url, { signal });

      if (!response.ok) {
        return undefined;
      }

      const data = z
        .object({
          images: z.array(
            z.object({
              front: z.boolean().optional(),
              image: z.string(),
              types: z.array(z.string()).optional(),
            })
          ),
        })
        .parse(await response.json());

      // Prefer front cover images
      const frontImage = data.images.find(img => img.front);
      return frontImage?.image || data.images[0]?.image;
    } catch {
      return undefined;
    }
  }

  /**
   * Transform MusicBrainz response to MusicMetadata
   */
  private transformToMusicMetadata(
    data:
      | z.infer<typeof MusicBrainzReleaseSchema>
      | MusicBrainzReleaseSearchResult,
    coverArt?: string
  ): MusicMetadata {
    // Extract artist name from artist-credit
    const artists =
      'artist-credit' in data && data['artist-credit']
        ? data['artist-credit'].map(ac => ac.name).join(', ')
        : undefined;

    // Calculate total track count from all media
    let trackCount = 0;
    if ('media' in data && data.media) {
      for (const medium of data.media) {
        if (medium['track-count']) {
          trackCount += medium['track-count'];
        }
      }
    }

    // Extract label name
    const label =
      'label-info-list' in data &&
      data['label-info-list'] &&
      data['label-info-list'][0]?.label?.name
        ? data['label-info-list'][0].label.name
        : undefined;

    // Use cover art from Cover Art Archive if available
    const image = coverArt;

    // Build MusicBrainz URL
    const url = `${MUSICBRAINZ_WEB_URL}/${data.id}`;

    return {
      id: data.id,
      type: 'music',
      title: data.title,
      artist: artists,
      album: data.title,
      releaseDate: data.date || undefined,
      image,
      url,
      // Additional metadata
      description: label ? `Label: ${label}` : undefined,
      trackCount: trackCount > 0 ? trackCount : undefined,
    };
  }

  /**
   * Get a cover art URL for a release
   * @param id - MusicBrainz release ID
   */
  getCoverArtUrl(id: string): string {
    return this.buildCoverArtUrl(id);
  }
}

/**
 * Type for search results from MusicBrainz (simplified)
 */
type MusicBrainzReleaseSearchResult = {
  id: string;
  title: string;
  'artist-credit'?: Array<{ name: string }>;
  date?: string;
};

/**
 * Factory function to create a MusicBrainz adapter with default configuration
 */
export function createMusicBrainzAdapter(): MusicBrainzAdapter {
  return new MusicBrainzAdapter();
}

/**
 * Default singleton instance
 */
let defaultMusicBrainzAdapter: MusicBrainzAdapter | null = null;

export function getDefaultMusicBrainzAdapter(): MusicBrainzAdapter {
  if (!defaultMusicBrainzAdapter) {
    defaultMusicBrainzAdapter = new MusicBrainzAdapter();
  }
  return defaultMusicBrainzAdapter;
}

import type {
  BookMetadata,
  GameMetadata,
  MediaMetadata,
  MediaType,
  MovieMetadata,
  MusicMetadata,
} from '@blocksuite/affine-shared/services';

/**
 * Get the external source name for a given media type.
 */
export function getSourceForMediaType(mediaType: MediaType): string {
  switch (mediaType) {
    case 'movie':
    case 'tv':
      return 'tmdb';
    case 'game':
      return 'rawg';
    case 'music':
      return 'lastfm';
    case 'book':
      return 'google-books';
    default:
      return 'unknown';
  }
}

/**
 * Extract type-specific metadata fields using discriminated union narrowing.
 */
export function extractTypeSpecificProps(
  metadata: MediaMetadata
): Record<string, unknown> {
  switch (metadata.type) {
    case 'movie':
    case 'tv': {
      const m = metadata as MovieMetadata;
      return {
        rating: m.rating,
        releaseDate: m.releaseDate,
        genres: m.genres,
      };
    }
    case 'music': {
      const m = metadata as MusicMetadata;
      return {
        artist: m.artist,
        album: m.album,
        releaseDate: m.releaseDate,
      };
    }
    case 'book': {
      const m = metadata as BookMetadata;
      return {
        authors: m.authors,
        pageCount: m.pageCount,
      };
    }
    case 'game': {
      const m = metadata as GameMetadata;
      return {
        rating: m.rating,
        releaseDate: m.releaseDate,
        developers: m.developers,
        genres: m.genres,
      };
    }
    default:
      return {};
  }
}

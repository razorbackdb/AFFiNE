import type { Doc } from '@affine/core/modules/doc/entities/doc';
import { NoteDisplayMode } from '@blocksuite/affine/model';
import { ImageProxyService } from '@blocksuite/affine/shared/adapters';
import { type Store, Text, type Workspace } from '@blocksuite/affine/store';
import type {
  BookMetadata,
  GameMetadata,
  MediaMetadata,
  MovieMetadata,
  MusicMetadata,
} from '@blocksuite/affine-shared/services';
import { readImageSize } from '@blocksuite/affine-shared/utils';
import { Service } from '@toeverything/infra';

/**
 * Result of fetching and storing an image
 */
export interface StoredImage {
  sourceId: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Domains that are known to have strict CORS policies preventing direct fetch
 */
const CORS_RESTRICTED_DOMAINS = [
  'image.tmdb.org',
  'media.rawg.io',
  'books.google.com',
  'lastfm.freetls.fastly.net',
];

const DEFAULT_POSTER_WIDTH = 400;

/**
 * Generates document content for metadata documents.
 * Creates a structured template with poster, description, and metadata details.
 */
export class MetadataDocTemplateGenerator extends Service {
  constructor() {
    super();
  }

  private _buildProxyImageUrl(
    store: Store | null,
    imageUrl: string
  ): string | null {
    try {
      if (store) {
        const imageProxyService = store.get(ImageProxyService);
        return imageProxyService.buildUrl(imageUrl);
      }
    } catch {
      // Ignore errors from store and fall through to fallback
    }

    // In development, prefer local proxy if available to avoid production worker restrictions
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    ) {
      return `/api/worker/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }

    if (typeof BUILD_CONFIG !== 'undefined' && BUILD_CONFIG.imageProxyUrl) {
      return `${BUILD_CONFIG.imageProxyUrl}?url=${encodeURIComponent(imageUrl)}`;
    }
    return null;
  }

  private async _fetchImageBlob(
    store: Store | null,
    imageUrl: string
  ): Promise<Blob> {
    let directError: unknown;

    // Skip direct fetch for known CORS-restricted domains to avoid console errors
    const skipDirectFetch =
      imageUrl &&
      CORS_RESTRICTED_DOMAINS.some(domain => imageUrl.includes(domain));

    if (!skipDirectFetch && imageUrl) {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch image: ${response.status} ${response.statusText}`
          );
        }
        return await response.blob();
      } catch (error) {
        directError = error;
      }
    }

    const proxyUrl = this._buildProxyImageUrl(store, imageUrl);
    if (!proxyUrl) {
      throw directError instanceof Error
        ? directError
        : new Error('Failed to fetch image and no proxy URL available');
    }

    const proxyResponse = await fetch(proxyUrl);
    if (!proxyResponse.ok) {
      throw new Error(
        `Failed to fetch image via proxy: ${proxyResponse.status} ${proxyResponse.statusText}`
      );
    }
    return await proxyResponse.blob();
  }

  /**
   * Fetch an image from a URL and store it in the workspace blob store.
   * @returns The stored image info (sourceId, width, height, size)
   */
  async fetchAndStoreImage(
    collection: Workspace,
    imageUrl: string
  ): Promise<StoredImage | undefined> {
    try {
      const blob = await this._fetchImageBlob(null, imageUrl);

      // Read image dimensions
      const imageSize = await readImageSize(blob);

      const file = new File([blob], 'poster.jpg', { type: blob.type });
      const sourceId = await collection.blobSync.set(file);

      return {
        sourceId,
        width: imageSize.width,
        height: imageSize.height,
        size: blob.size,
      };
    } catch (e) {
      console.error(
        '[MetadataDocTemplateGenerator] failed to fetch/store image',
        e
      );
      return undefined;
    }
  }

  /**
   * Generate document content from fetched metadata and populate the doc.
   */
  async generateDocContent(
    doc: Doc,
    metadata: MediaMetadata,
    imageInfo?: StoredImage
  ): Promise<void> {
    const store = doc.blockSuiteDoc;

    // Use a transaction to ensure all blocks are added together
    store.transact(() => {
      let noteId: string | undefined;

      // 1. Ensure root blocks exist
      if (store.root) {
        const notes = store.getBlocksByFlavour('affine:note');
        if (notes.length > 0) {
          noteId = notes[0].id;
        } else {
          // If no note block, add one to the root
          noteId = store.addBlock(
            'affine:note',
            {
              displayMode: NoteDisplayMode.DocAndEdgeless,
            },
            store.root.id
          );
        }
      } else {
        // If no root, create the whole structure
        const pageBlockId = store.addBlock('affine:page', {
          title: new Text(metadata.title),
        });
        store.addBlock('affine:surface', {}, pageBlockId);
        noteId = store.addBlock(
          'affine:note',
          {
            displayMode: NoteDisplayMode.DocAndEdgeless,
          },
          pageBlockId
        );
      }

      // 2. Add metadata content if we have a noteId
      if (noteId) {
        try {
          this.addContentBlocks(store, noteId, metadata, imageInfo);
        } catch (e) {
          console.error(
            '[MetadataDocTemplateGenerator] failed to add content blocks',
            e
          );
        }
      } else {
        console.error(
          '[MetadataDocTemplateGenerator] could not find or create note block'
        );
      }
    });
  }

  /**
   * Add content blocks to the document based on metadata type.
   */
  public addContentBlocks(
    store: Store,
    noteId: string,
    metadata: MediaMetadata,
    imageInfo?: StoredImage
  ): void {
    // Add poster image if available
    if (imageInfo) {
      store.addBlock(
        'affine:image',
        {
          sourceId: imageInfo.sourceId,
          width: imageInfo.width,
          height: imageInfo.height,
          size: imageInfo.size,
          // Scale image to a reasonable default width while preserving aspect ratio
          // to avoid massive blocks in edgeless mode.
          xywh: `[0,0,${DEFAULT_POSTER_WIDTH},${imageInfo.width > 0 ? Math.round((imageInfo.height / imageInfo.width) * DEFAULT_POSTER_WIDTH) : DEFAULT_POSTER_WIDTH}]`,
        },
        noteId
      );
    } else if (metadata.image) {
      // Add a placeholder/message if image failed to load
      store.addBlock(
        'affine:paragraph',
        {
          text: new Text(
            `[Poster image unavailable from ${this.getSourceName(metadata.type)}]`
          ),
        },
        noteId
      );
    }

    // Add description if available
    if (metadata.description) {
      store.addBlock(
        'affine:paragraph',
        {
          text: new Text(metadata.description),
        },
        noteId
      );
    }

    // Add type-specific metadata details
    this.addMetadataDetails(store, noteId, metadata);
  }

  /**
   * Add metadata details based on media type.
   * Creates structured content with headings and lists.
   */
  private addMetadataDetails(
    store: Store,
    noteId: string,
    metadata: MediaMetadata
  ): void {
    // Add a heading for metadata details
    store.addBlock(
      'affine:paragraph',
      {
        type: 'h3',
        text: new Text('Details'),
      },
      noteId
    );

    switch (metadata.type) {
      case 'movie':
      case 'tv':
        this.addMovieDetails(store, noteId, metadata);
        break;
      case 'music':
        this.addMusicDetails(store, noteId, metadata);
        break;
      case 'book':
        this.addBookDetails(store, noteId, metadata);
        break;
      case 'game':
        this.addGameDetails(store, noteId, metadata);
        break;
    }

    // Add external link if available
    if (metadata.url) {
      store.addBlock(
        'affine:paragraph',
        {
          text: new Text(''),
        },
        noteId
      );

      store.addBlock(
        'affine:paragraph',
        {
          text: new Text([
            {
              insert: 'View on ' + this.getSourceName(metadata.type),
              attributes: {
                link: metadata.url,
              },
            },
          ]),
        },
        noteId
      );
    }
  }

  private addMovieDetails(
    store: Store,
    noteId: string,
    metadata: MediaMetadata
  ): void {
    const details = metadata as MovieMetadata;

    if (details.releaseDate) {
      this.addDetailItem(store, noteId, 'Release Date', details.releaseDate);
    }

    if (details.rating) {
      this.addDetailItem(
        store,
        noteId,
        'Rating',
        details.rating.toFixed(1) + '/10'
      );
    }

    if (details.runtime) {
      const hours = Math.floor(details.runtime / 60);
      const mins = details.runtime % 60;
      this.addDetailItem(
        store,
        noteId,
        'Runtime',
        hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
      );
    }

    if (details.genres && details.genres.length > 0) {
      this.addDetailItem(store, noteId, 'Genres', details.genres.join(', '));
    }

    if (details.tagline) {
      this.addDetailItem(store, noteId, 'Tagline', `"${details.tagline}"`);
    }
  }

  private addMusicDetails(
    store: Store,
    noteId: string,
    metadata: MediaMetadata
  ): void {
    const details = metadata as MusicMetadata;

    if (details.artist) {
      this.addDetailItem(store, noteId, 'Artist', details.artist);
    }

    if (details.album) {
      this.addDetailItem(store, noteId, 'Album', details.album);
    }

    if (details.releaseDate) {
      this.addDetailItem(store, noteId, 'Release Date', details.releaseDate);
    }

    if (details.genre) {
      this.addDetailItem(store, noteId, 'Genre', details.genre);
    }

    if (details.trackCount) {
      this.addDetailItem(
        store,
        noteId,
        'Tracks',
        details.trackCount.toString()
      );
    }
  }

  private addBookDetails(
    store: Store,
    noteId: string,
    metadata: MediaMetadata
  ): void {
    const details = metadata as BookMetadata;

    if (details.authors && details.authors.length > 0) {
      this.addDetailItem(
        store,
        noteId,
        'Author(s)',
        details.authors.join(', ')
      );
    }

    if (details.publisher) {
      this.addDetailItem(store, noteId, 'Publisher', details.publisher);
    }

    if (details.publishDate) {
      this.addDetailItem(store, noteId, 'Publish Date', details.publishDate);
    }

    if (details.pageCount) {
      this.addDetailItem(store, noteId, 'Pages', details.pageCount.toString());
    }

    if (details.isbn) {
      this.addDetailItem(store, noteId, 'ISBN', details.isbn);
    }
  }

  private addGameDetails(
    store: Store,
    noteId: string,
    metadata: MediaMetadata
  ): void {
    const details = metadata as GameMetadata;

    if (details.releaseDate) {
      this.addDetailItem(store, noteId, 'Release Date', details.releaseDate);
    }

    if (details.rating) {
      this.addDetailItem(
        store,
        noteId,
        'Rating',
        details.rating.toFixed(1) + '/5'
      );
    }

    if (details.developers && details.developers.length > 0) {
      this.addDetailItem(
        store,
        noteId,
        'Developer(s)',
        details.developers.join(', ')
      );
    }

    if (details.publishers && details.publishers.length > 0) {
      this.addDetailItem(
        store,
        noteId,
        'Publisher(s)',
        details.publishers.join(', ')
      );
    }

    if (details.genres && details.genres.length > 0) {
      this.addDetailItem(store, noteId, 'Genres', details.genres.join(', '));
    }

    if (details.platforms && details.platforms.length > 0) {
      this.addDetailItem(
        store,
        noteId,
        'Platforms',
        details.platforms.join(', ')
      );
    }
  }

  private addDetailItem(
    store: Store,
    noteId: string,
    label: string,
    value: string
  ): void {
    const text = new Text([
      { insert: `${label}: `, attributes: { bold: true } },
      { insert: value },
    ]);

    store.addBlock(
      'affine:list',
      {
        type: 'bulleted',
        text,
      },
      noteId
    );
  }

  private getSourceName(mediaType: MediaMetadata['type']): string {
    switch (mediaType) {
      case 'movie':
      case 'tv':
        return 'TMDB';
      case 'game':
        return 'RAWG';
      case 'music':
        return 'Last.fm';
      case 'book':
        return 'Google Books';
      default:
        return 'Unknown';
    }
  }
}

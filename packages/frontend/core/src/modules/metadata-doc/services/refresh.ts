import type { DocsService } from '@affine/core/modules/doc';
import type { DocPropertiesStore } from '@affine/core/modules/doc/stores/doc-properties';
import type { MediaMetadata } from '@blocksuite/affine-shared/services';
import type { BlockModel } from '@blocksuite/store';
import { Service } from '@toeverything/infra';

import { extractTypeSpecificProps, getSourceForMediaType } from '../utils';
import type {
  MetadataDocTemplateGenerator,
  StoredImage,
} from './template-generator';

/**
 * Service for refreshing metadata document content from external APIs.
 * Updates metadata properties and optionally refreshes document content.
 */
export class MetadataDocRefreshService extends Service {
  constructor(
    private readonly docPropertiesStore: DocPropertiesStore,
    private readonly docsService: DocsService,
    private readonly templateGenerator: MetadataDocTemplateGenerator
  ) {
    super();
  }

  /**
   * Check if a document is a metadata document.
   */
  isMetadataDoc(docId: string): boolean {
    const props = this.docPropertiesStore.getDocProperties(docId);
    return props.docType === 'metadata-doc';
  }

  /**
   * Get the metadata properties for a document.
   */
  getMetadataProps(docId: string): MetadataDocProps | null {
    const props = this.docPropertiesStore.getDocProperties(docId);
    if (props.docType !== 'metadata-doc') {
      return null;
    }

    return {
      mediaType: props.mediaType,
      externalId: props.externalId,
      externalSource: props.externalSource,
      lastRefreshed: props.lastRefreshed,
    };
  }

  /**
   * Update metadata properties with new data after a refresh.
   * Call this after fetching fresh metadata from the API.
   * Also refreshes document content blocks.
   */
  async updateMetadataFromRefresh(
    docId: string,
    metadata: MediaMetadata
  ): Promise<void> {
    const typeSpecific = extractTypeSpecificProps(metadata);
    const metadataProps = {
      lastRefreshed: new Date().toISOString(),
      title: metadata.title,
      imageUrl: metadata.image,
      externalSource: getSourceForMediaType(metadata.type),
      ...typeSpecific,
    };

    this.docPropertiesStore.updateDocProperties(docId, metadataProps);

    // Refresh document content if doc is available
    const { doc, release } = this.docsService.open(docId);
    try {
      await doc.waitForSyncReady();
      const store = doc.blockSuiteDoc;
      const note = store.getBlocksByFlavour('affine:note')[0];
      if (note) {
        // Fetch fresh image info if URL is available
        let imageInfo: StoredImage | undefined;
        if (metadata.image) {
          imageInfo = await this.templateGenerator.fetchAndStoreImage(
            store.workspace,
            metadata.image
          );
        }

        // Refresh content blocks in the existing note by clearing it first
        store.transact(() => {
          const children =
            (store.getBlock(note.id) as unknown as BlockModel)?.children ?? [];
          children.forEach(child => store.deleteBlock(child));
          this.templateGenerator.addContentBlocks(
            store,
            note.id,
            metadata,
            imageInfo
          );
        });
      }
    } catch (e) {
      console.error('[MetadataDocRefreshService] failed to refresh content', e);
    } finally {
      release();
    }
  }

  /**
   * Check if metadata is stale based on the last refresh timestamp.
   * Default stale threshold is 7 days.
   */
  isStale(
    docId: string,
    staleThresholdMs: number = 7 * 24 * 60 * 60 * 1000
  ): boolean {
    const props = this.getMetadataProps(docId);
    if (!props?.lastRefreshed) {
      return true; // Never refreshed
    }

    const lastRefreshed = new Date(props.lastRefreshed).getTime();
    if (isNaN(lastRefreshed)) {
      return true;
    }
    const now = Date.now();
    return now - lastRefreshed > staleThresholdMs;
  }

  /**
   * Get the age of the metadata in human-readable format.
   */
  getMetadataAge(docId: string): string | null {
    const props = this.getMetadataProps(docId);
    if (!props?.lastRefreshed) {
      return null;
    }

    const lastRefreshed = new Date(props.lastRefreshed).getTime();
    if (isNaN(lastRefreshed)) {
      return null;
    }
    const now = Date.now();
    const diffMs = now - lastRefreshed;

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor(
      (diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
    );

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMinutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      return diffMinutes === 0
        ? 'just now'
        : `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  }
}

/**
 * Metadata document properties
 */
export interface MetadataDocProps {
  mediaType?: string;
  externalId?: string;
  externalSource?: string;
  lastRefreshed?: string;
}

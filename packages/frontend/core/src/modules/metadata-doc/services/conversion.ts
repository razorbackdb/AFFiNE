import type { DocsService } from '@affine/core/modules/doc';
import type { DocRecord } from '@affine/core/modules/doc/entities/record';
import type { DocPropertiesStore } from '@affine/core/modules/doc/stores/doc-properties';
import type { WorkspaceService } from '@affine/core/modules/workspace';
import type { WorkspacePropertyService } from '@affine/core/modules/workspace-property';
import type {
  MediaMetadata,
  MediaType,
} from '@blocksuite/affine-shared/services';
import { Service } from '@toeverything/infra';

import { METADATA_PROPERTIES } from '../constants/properties';
import { extractTypeSpecificProps, getSourceForMediaType } from '../utils';
import type {
  MetadataDocTemplateGenerator,
  StoredImage,
} from './template-generator';

/**
 * Card data structure for metadata cards
 */
export interface MetadataCardData {
  type: MediaType;
  id: string;
  title: string;
}

/**
 * Result of promoting a card to a document
 */
export interface PromoteResult {
  docId: string;
  doc: DocRecord;
  isNew: boolean;
}

/**
 * Service for converting lightweight metadata cards to full documents.
 * Handles card-to-document promotion with duplicate prevention.
 */
export class MetadataDocConversionService extends Service {
  constructor(
    private readonly docsService: DocsService,
    private readonly docPropertiesStore: DocPropertiesStore,
    private readonly workspacePropertyService: WorkspacePropertyService,
    private readonly templateGenerator: MetadataDocTemplateGenerator,
    private readonly workspaceService: WorkspaceService
  ) {
    super();
  }

  /**
   * Pending promotions to prevent race conditions when multiple cards for the same
   * item are promoted simultaneously.
   */
  private readonly _pendingPromotions = new Map<
    string,
    Promise<PromoteResult>
  >();

  /**
   * Promote a metadata card to a full document.
   * If a document already exists for this external ID, returns the existing doc.
   *
   * @param cardData - The metadata card data (type, id, title)
   * @param metadata - The fetched metadata from the API
   * @returns The document ID, document record, and whether it was newly created
   */
  async promoteToDoc(
    cardData: MetadataCardData,
    metadata: MediaMetadata
  ): Promise<PromoteResult> {
    const lockKey = `${cardData.type}:${cardData.id}`;
    const pending = this._pendingPromotions.get(lockKey);
    if (pending) {
      return pending;
    }

    const promotion = (async () => {
      try {
        // 1. Check for existing doc with same externalId and mediaType
        const existingDoc = this.findExistingDoc(cardData.type, cardData.id);
        if (existingDoc) {
          return { docId: existingDoc.id, doc: existingDoc, isNew: false };
        }

        // 2. Fetch and store image BEFORE creating the doc record to enable atomic init
        let imageInfo: StoredImage | undefined;
        if (metadata.image) {
          try {
            imageInfo = await this.templateGenerator.fetchAndStoreImage(
              this.workspaceService.workspace.docCollection,
              metadata.image
            );
          } catch (e) {
            console.error(
              '[MetadataDocConversionService] failed to fetch and store image',
              e
            );
          }
        }

        // 3. Create new document with atomic block initialization via onStoreLoad
        const docRecord = this.docsService.createDoc({
          title: metadata.title,
          docProps: {
            onStoreLoad: (store, { noteId }) => {
              this.templateGenerator.addContentBlocks(
                store,
                noteId,
                metadata,
                imageInfo
              );
            },
          },
        });

        // 4. Set document metadata including mediaType for icon rendering
        docRecord.setMeta({
          mediaType: cardData.type,
        } as any);

        // 5. Set metadata properties for the database
        const typeSpecific = extractTypeSpecificProps(metadata);
        const metadataProps = {
          docType: 'metadata-doc',
          mediaType: cardData.type,
          externalId: cardData.id,
          externalSource: getSourceForMediaType(cardData.type),
          lastRefreshed: new Date().toISOString(),
          // Basic info for card views
          title: metadata.title,
          imageUrl: metadata.image, // original external URL for reference/refresh
          image: imageInfo?.sourceId ?? metadata.image, // prefer local blob
          ...typeSpecific,
        };

        this.docPropertiesStore.updateDocProperties(
          docRecord.id,
          metadataProps
        );

        // 6. Set custom metadata properties
        try {
          await this.provisionAndSetCustomProperties(
            docRecord,
            cardData.type,
            metadata
          );
        } catch (e) {
          console.error(
            '[MetadataDocConversionService] failed to provision custom properties',
            e
          );
        }

        return { docId: docRecord.id, doc: docRecord, isNew: true };
      } finally {
        this._pendingPromotions.delete(lockKey);
      }
    })();

    this._pendingPromotions.set(lockKey, promotion);
    return promotion;
  }

  /**
   * Provision custom properties in the workspace and set values on the doc.
   */
  private async provisionAndSetCustomProperties(
    doc: DocRecord,
    mediaType: MediaType,
    metadata: MediaMetadata
  ) {
    const definitions = METADATA_PROPERTIES[mediaType];
    if (!definitions) return;

    const existingProperties =
      this.workspacePropertyService.sortedProperties$.value ?? [];

    for (const def of definitions) {
      // 1. Ensure property exists in workspace
      let property = existingProperties.find(p => p.id === def.id);
      if (!property) {
        try {
          property = this.workspacePropertyService.createProperty({
            id: def.id,
            name: def.name,
            type: def.type,
            visibilityFilter: {
              docType: 'metadata-doc',
              mediaType: mediaType,
            },
          });
        } catch (e) {
          console.error(
            `[MetadataDocConversionService] failed to create property ${def.id}`,
            e
          );
        }
      } else {
        // If property exists, ensure the name is updated if it's currently specific to a type
        const filter = property.visibilityFilter as any;
        if (filter?.mediaType && filter.mediaType !== mediaType) {
          this.workspacePropertyService.updatePropertyInfo(property.id, {
            name: def.name !== property.name ? 'Release Date' : property.name,
            visibilityFilter: {
              docType: 'metadata-doc',
            },
          });
        }
      }

      // 2. Set value on the document
      const value = def.getValue(metadata);
      if (value !== undefined && value !== null) {
        doc.setCustomProperty(def.id, value);
      }
    }
  }

  /**
   * Find an existing metadata doc by external ID and media type.
   * Searches through docs with matching docType and externalId properties.
   */
  private findExistingDoc(
    mediaType: MediaType,
    externalId: string
  ): DocRecord | null {
    const existing = this.docPropertiesStore.findDocsByExternalId(
      mediaType,
      externalId
    );

    if (existing.length > 0) {
      // Return the first matching doc that still exists
      for (const props of existing) {
        const doc = this.docsService.list.docsMap$.value.get(props.id);
        if (doc) return doc;
      }
    }

    return null;
  }
}

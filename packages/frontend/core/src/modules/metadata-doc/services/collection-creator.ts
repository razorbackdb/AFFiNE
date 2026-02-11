import type { CollectionService } from '@affine/core/modules/collection';
import type { PinnedCollectionService } from '@affine/core/modules/collection';
import type { Workspace } from '@affine/core/modules/workspace';
import { WorkspaceInitialized } from '@affine/core/modules/workspace';
import { OnEvent, Service } from '@toeverything/infra';

const METADATA_LIBRARY_COLLECTION_NAME = 'Metadata Library';

/**
 * Service for managing the Metadata Library collection.
 * Ensures the collection exists on workspace initialization.
 */
@OnEvent(WorkspaceInitialized, e => e.onWorkspaceInitialized)
export class MetadataLibraryCollectionService extends Service {
  private collectionId: string | null = null;

  constructor(
    private readonly collectionService: CollectionService,
    private readonly pinnedCollectionService: PinnedCollectionService
  ) {
    super();
  }

  /**
   * Called when a workspace is initialized.
   * Ensures the Metadata Library collection exists.
   */
  onWorkspaceInitialized(_workspace: Workspace): void {
    // Ensure the collection exists after workspace is ready
    this.ensureMetadataLibrary().catch(console.error);
  }

  /**
   * Ensure the Metadata Library collection exists.
   * Creates it if it doesn't exist.
   */
  async ensureMetadataLibrary(): Promise<string> {
    // Check if collection already exists
    const existing = Array.from(
      this.collectionService.collections$.value.values()
    ).find(c => c.name$.value === METADATA_LIBRARY_COLLECTION_NAME);

    if (existing) {
      this.collectionId = existing.id;
      return existing.id;
    }

    // Create the collection
    const id = this.collectionService.createCollection({
      name: METADATA_LIBRARY_COLLECTION_NAME,
      rules: {
        filters: [
          {
            type: 'property',
            key: 'docType',
            method: 'is',
            value: 'metadata-doc',
          },
        ],
      },
      allowList: [],
    });

    this.collectionId = id;

    // Pin the collection to the sidebar
    this.pinnedCollectionService.addPinnedCollection({
      collectionId: id,
      index: this.pinnedCollectionService.indexAt('after'),
    });

    return id;
  }

  /**
   * Get the Metadata Library collection ID.
   * Returns null if it hasn't been created yet.
   */
  getCollectionId(): string | null {
    return this.collectionId;
  }
}

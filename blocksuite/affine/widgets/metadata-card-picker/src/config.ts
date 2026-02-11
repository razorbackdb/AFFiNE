import {
  type MediaMetadata,
  MetadataDocConversionIdentifier,
  MetadataServiceIdentifier,
  type MetadataServiceProvider,
} from '@blocksuite/affine-shared/services';
import type { AffineInlineEditor } from '@blocksuite/affine-shared/types';
import {
  BookPanelIcon,
  GamePanelIcon,
  HeadphonePanelIcon,
  MoviePanelIcon,
} from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@blocksuite/std';
import type { InlineRange } from '@blocksuite/std/inline';
import type { TemplateResult } from 'lit';

export type MediaType = 'movie' | 'tv' | 'game' | 'music' | 'book';

export type MetadataMenuItem = {
  key: string;
  name: string;
  icon: TemplateResult;
  subtext?: string;
  action: () => Promise<void> | void;
};

export type MetadataMenuGroup = {
  name: string;
  items: MetadataMenuItem[];
  loading?: boolean;
  hidden?: boolean;
};

// Media type icons for display
const MEDIA_TYPE_ICONS: Record<MediaType, TemplateResult> = {
  movie: MoviePanelIcon({ width: '20px', height: '20px' }),
  tv: MoviePanelIcon({ width: '20px', height: '20px' }),
  game: GamePanelIcon({ width: '20px', height: '20px' }),
  music: HeadphonePanelIcon({ width: '20px', height: '20px' }),
  book: BookPanelIcon({ width: '20px', height: '20px' }),
};

// Media type display names
const MEDIA_TYPE_NAMES: Record<MediaType, string> = {
  movie: 'Movie',
  tv: 'TV Show',
  game: 'Game',
  music: 'Music',
  book: 'Book',
};

// Export icons and names for use in other files
export { MEDIA_TYPE_ICONS, MEDIA_TYPE_NAMES };

/**
 * Search for media items using the MetadataService
 */
export async function searchMediaItems(
  query: string,
  mediaType: MediaType,
  std: BlockStdScope,
  signal?: AbortSignal
): Promise<MediaMetadata[]> {
  if (!query.trim()) return [];

  try {
    const service = std.get(
      MetadataServiceIdentifier
    ) as MetadataServiceProvider;
    if (!service) {
      console.error('[MetadataCardPicker] MetadataService not found!');
      return [];
    }
    const results = await service.search(mediaType, query, signal);
    // Return just the items, we don't need the score for display
    return results.map(r => r.item);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return [];
    console.error('[MetadataCardPicker] Failed to search media items:', error);
    return [];
  }
}

/**
 * Create a metadata document and insert an inline link into the editor
 */
export async function insertMetadataDocLink(
  std: BlockStdScope,
  inlineEditor: AffineInlineEditor,
  triggerKey: string,
  startRange: InlineRange,
  metadata: MediaMetadata
): Promise<void> {
  // Get current range
  const currentRange = inlineEditor.getInlineRange();
  if (!currentRange) return;

  // Calculate the start position of the trigger key
  const triggerStart = startRange.index - triggerKey.length;

  // 1. Promote the result to a full document
  const conversionService = std.getOptional(MetadataDocConversionIdentifier);
  if (!conversionService) {
    console.error('MetadataDocConversionService not available');
    return;
  }

  try {
    const result = await conversionService.promoteToDoc(
      {
        type: metadata.type,
        id: metadata.id,
        title: metadata.title,
      },
      metadata
    );

    if (result.docId) {
      // 2. Delete the trigger key and any query text
      inlineEditor.deleteText({
        index: triggerStart,
        length: currentRange.index - triggerStart,
      });

      // 3. Insert the inline MetadataDoc reference
      inlineEditor.insertText({ index: triggerStart, length: 0 }, ' ', {
        reference: {
          type: 'MetadataDoc',
          pageId: result.docId,
        },
      });

      // 4. Set cursor after the link
      inlineEditor.setInlineRange({
        index: triggerStart + 1,
        length: 0,
      });
    }
  } catch (error) {
    console.error('Failed to create metadata link:', error);
  }
}

import { BlockSchemaExtension, defineBlockSchema } from '@blocksuite/store';

import {
  EmbedLinkedDocModel,
  EmbedLinkedDocStyles,
} from './linked-doc-model.js';

/**
 * Tombstone schema for the obsolete 'affine:embed-metadata-card' flavour.
 * This allows existing documents containing these blocks to load correctly
 * by aliasing them to the 'affine:embed-linked-doc' model.
 */
export const EmbedMetadataCardBlockSchema = defineBlockSchema({
  flavour: 'affine:embed-metadata-card',
  props: () =>
    ({
      // Shared with embed-linked-doc
      index: 'a0',
      xywh: '[0,0,0,0]',
      lockedBySelf: false,
      rotate: 0,

      pageId: '',
      style: EmbedLinkedDocStyles[1],
      caption: null,
      footnoteIdentifier: null,
      title: undefined,
      description: undefined,
    }) as any,
  metadata: {
    version: 1,
    role: 'content',
  },
  toModel: () => new EmbedLinkedDocModel() as any,
});

export const EmbedMetadataCardBlockSchemaExtension = BlockSchemaExtension(
  EmbedMetadataCardBlockSchema
);

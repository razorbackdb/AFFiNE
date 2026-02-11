import type { Text } from '@blocksuite/store';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/store';

import type { ColumnDataType, ViewBasicDataType } from '../database/types.js';

export interface LibrarySource {
  docType?: string;
  mediaType?: string;
}

export type DocLibraryBlockProps = {
  views: ViewBasicDataType[];
  title: Text;
  columns: Array<ColumnDataType>;
  source: LibrarySource;
};

export class DocLibraryBlockModel extends BlockModel<DocLibraryBlockProps> {}

export const DocLibraryBlockSchema = defineBlockSchema({
  flavour: 'affine:doc-library',
  props: (internal): DocLibraryBlockProps => ({
    views: [],
    title: internal.Text(),
    columns: [],
    source: {
      docType: 'metadata-doc',
      mediaType: 'movie',
    },
  }),
  metadata: {
    role: 'hub',
    version: 1,
    parent: ['affine:note'],
  },
  toModel: () => new DocLibraryBlockModel(),
});

export const DocLibraryBlockSchemaExtension = BlockSchemaExtension(
  DocLibraryBlockSchema
);

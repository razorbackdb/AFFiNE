import { propertyType, t } from '@blocksuite/data-view';
import zod from 'zod';

export const docMetadataColumnType = propertyType('doc-metadata');

export const DocMetadataPropertySchema = zod.object({
  sourceColumnId: zod.string(),
  metadataKey: zod.string(),
});

export type DocMetadataPropertyData = zod.infer<
  typeof DocMetadataPropertySchema
>;

export const docMetadataPropertyModelConfig = docMetadataColumnType.modelConfig(
  {
    name: 'Doc Metadata',
    propertyData: {
      schema: DocMetadataPropertySchema,
      default: () => ({
        sourceColumnId: '',
        metadataKey: 'rating',
      }),
    },
    jsonValue: {
      schema: zod.any(),
      type: () => t.unknown.instance(),
      isEmpty: ({ value }) => value == null,
    },
    rawValue: {
      schema: zod.any(),
      default: () => null,
      toString: ({ value }) => (value != null ? String(value) : ''),
      fromString: () => ({ value: null }),
      toJson: ({ value }) => value,
      fromJson: ({ value }) => value,
      setValue: () => {}, // Read-only
    },
  }
);

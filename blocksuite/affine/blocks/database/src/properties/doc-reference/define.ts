import { propertyType, t } from '@blocksuite/data-view';
import zod from 'zod';

export const docReferenceColumnType = propertyType('doc-reference');

export const docReferencePropertyModelConfig =
  docReferenceColumnType.modelConfig({
    name: 'Document',
    propertyData: {
      schema: zod.object({}),
      default: () => ({}),
    },
    jsonValue: {
      schema: zod.string(),
      type: () => t.string.instance(),
      isEmpty: ({ value }) => !value,
    },
    rawValue: {
      schema: zod.string(),
      default: () => '',
      toString: ({ value }) => value,
      fromString: ({ value }) => {
        return { value: value };
      },
      toJson: ({ value }) => value,
      fromJson: ({ value }) => value,
    },
  });

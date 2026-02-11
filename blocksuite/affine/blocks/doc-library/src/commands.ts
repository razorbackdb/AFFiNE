import type { DocLibraryBlockModel } from '@blocksuite/affine-model';
import type { Command } from '@blocksuite/std';

import { DEFAULT_COLUMNS } from './column-presets.js';
import { DocLibraryDataSource } from './data-source.js';

export const insertDocLibraryBlockCommand: Command<
  {
    selectedModels?: any[];
    viewType: string;
    place?: 'after' | 'before';
    removeEmptyLine?: boolean;
  },
  {
    insertedDocLibraryBlockId: string;
  }
> = (ctx, next) => {
  const { selectedModels, viewType, place, removeEmptyLine, std } = ctx;
  if (!selectedModels?.length) return;

  const targetModel =
    place === 'before'
      ? selectedModels[0]
      : selectedModels[selectedModels.length - 1];

  if (!targetModel) return;

  const result = std.store.addSiblingBlocks(
    targetModel,
    [{ flavour: 'affine:doc-library' }],
    place
  );
  const blockId = result[0];

  if (blockId == null) return;

  initDocLibraryBlock(std.store, blockId, viewType);

  if (removeEmptyLine && targetModel.text?.length === 0) {
    std.store.deleteBlock(targetModel);
  }

  next({ insertedDocLibraryBlockId: blockId });
};

export const initDocLibraryBlock = (
  doc: any,
  blockId: string,
  viewType: string
) => {
  const blockModel = doc.getBlock(blockId)?.model as
    | DocLibraryBlockModel
    | undefined;
  if (!blockModel) return;

  const datasource = new DocLibraryDataSource(blockModel);

  // Initial columns
  doc.transact(() => {
    // Set default title
    if ((blockModel as any).props.title.length === 0) {
      (blockModel as any).props.title.insert(0, 'Library');
    }

    const mediaType = 'movie';
    (blockModel as any).props.columns = DEFAULT_COLUMNS[mediaType];

    (blockModel as any).props.source = {
      docType: 'metadata-doc',
      mediaType: mediaType,
    };
  });

  datasource.viewManager.viewAdd(viewType);
};

import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
import { TelemetryProvider } from '@blocksuite/affine-shared/services';
import { isInsideBlockByFlavour } from '@blocksuite/affine-shared/utils';
import { type SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { viewPresets } from '@blocksuite/data-view/view-presets';
import { DatabaseTableViewIcon } from '@blocksuite/icons/lit';

import { insertDocLibraryBlockCommand } from '../commands';

export const docLibrarySlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'affine:doc-library',
  items: [
    {
      name: 'Document Library',
      description: 'Dynamic table of documents matching a filter.',
      searchAlias: ['collection', 'library', 'docs'],
      icon: DatabaseTableViewIcon(),
      group: '7_Database@5',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDocLibraryBlockCommand, {
            viewType: viewPresets.tableViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDocLibraryBlockId }) => {
            if (insertedDocLibraryBlockId) {
              const telemetry = std.getOptional(TelemetryProvider);
              telemetry?.track('BlockCreated', {
                blockType: 'affine:doc-library',
              });
            }
          })
          .run();
      },
    },
  ],
};

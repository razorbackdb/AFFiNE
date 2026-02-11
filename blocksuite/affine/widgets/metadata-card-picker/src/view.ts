import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { z } from 'zod';

import { effects } from './effects';
import { MediaMentionsSlashMenuConfigExtension } from './slash-menu';

const optionsSchema = z.object({
  // Future options can be added here
});

type MetadataCardPickerViewOptions = z.infer<typeof optionsSchema>;

export class MetadataCardPickerViewExtension extends ViewExtensionProvider<MetadataCardPickerViewOptions> {
  override name = 'affine-metadata-card-picker';

  override schema = optionsSchema;

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(MediaMentionsSlashMenuConfigExtension());
  }
}

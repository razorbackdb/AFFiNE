import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/std';
import { literal } from 'lit/static-html.js';

import { docLibrarySlashMenuConfig } from './configs/slash-menu.js';
import { effects } from './effects.js';

export class DocLibraryViewExtension extends ViewExtensionProvider {
  override name = 'affine-doc-library-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:doc-library'),
      BlockViewExtension('affine:doc-library', literal`affine-doc-library`),
      SlashMenuConfigExtension('affine:doc-library', docLibrarySlashMenuConfig),
    ]);
  }
}

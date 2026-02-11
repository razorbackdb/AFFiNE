import type { ViewExtensionContext } from '@blocksuite/affine/ext-loader';
import { ViewExtensionProvider } from '@blocksuite/affine-ext-loader';
import type { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

import {
  DocPropertiesProviderExtension,
  MetadataDocConversionExtension,
  MetadataDocReferenceInlineSpecExtension,
} from './extensions';

export interface MetadataDocViewOptions {
  framework?: FrameworkProvider;
}

const optionsSchema = z.object({
  framework: z.custom<FrameworkProvider>().optional(),
});

export class MetadataDocViewExtension extends ViewExtensionProvider<MetadataDocViewOptions> {
  override name = 'affine-metadata-doc-extension';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: MetadataDocViewOptions
  ) {
    super.setup(context, options);

    const framework = options?.framework;

    // Register all metadata-doc related extensions
    context.register([
      // 1. Conversion service (DI implementation)
      MetadataDocConversionExtension({
        framework,
      }),
      // 2. Metadata-doc reference inline spec
      MetadataDocReferenceInlineSpecExtension,
      // 3. Properties provider (bridges to main app DB)
      DocPropertiesProviderExtension({
        framework,
      }),
    ]);
  }
}

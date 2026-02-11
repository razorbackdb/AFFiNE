import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine/ext-loader';
import { MetadataServiceExtension } from '@blocksuite/affine-shared/services';

export class MetadataServiceViewExtension extends ViewExtensionProvider {
  override name = 'affine-metadata-service-extension';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    // Register the metadata service
    context.register(MetadataServiceExtension());
  }
}

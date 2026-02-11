import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { DocLibraryBlockSchemaExtension } from '@blocksuite/affine-model';

export class DocLibraryStoreExtension extends StoreExtensionProvider {
  override name = 'affine-doc-library-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(DocLibraryBlockSchemaExtension);
  }
}

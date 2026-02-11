import { MetadataDocConversionService } from '@affine/core/modules/metadata-doc';
import type { MediaMetadata } from '@blocksuite/affine-shared/services';
import {
  type MetadataCardData,
  MetadataDocConversionIdentifier,
  type MetadataDocConversionProvider,
  type PromoteResult,
} from '@blocksuite/affine-shared/services';
import type { ExtensionType } from '@blocksuite/store';
import type { FrameworkProvider } from '@toeverything/infra';

// Re-export the identifier and types from BlockSuite shared services
export { MetadataDocConversionIdentifier };
export type { MetadataCardData, MetadataDocConversionProvider, PromoteResult };

// Store the framework provider for the extension to use
let _frameworkProvider: FrameworkProvider | undefined;

/**
 * Service implementation that provides metadata doc conversion functionality
 * This is registered in BlockSuite's DI and accessed via std.get(MetadataDocConversionIdentifier)
 */
export class MetadataDocConversionServiceExtension implements MetadataDocConversionProvider {
  constructor() {}

  private getFrameworkService(): MetadataDocConversionService {
    if (!_frameworkProvider) {
      throw new Error(
        'MetadataDocConversionService: Framework provider not set. Make sure MetadataDocConversionExtension is configured with a framework.'
      );
    }
    return _frameworkProvider.get(MetadataDocConversionService);
  }

  async promoteToDoc(
    cardData: MetadataCardData,
    metadata: MediaMetadata
  ): Promise<PromoteResult> {
    const service = this.getFrameworkService();
    return service.promoteToDoc(cardData, metadata);
  }
}

/**
 * Extension factory function that sets up the framework provider
 * and returns the service extension for registration
 */
export const MetadataDocConversionExtension = (options?: {
  framework?: FrameworkProvider;
}): ExtensionType => {
  // Store the framework provider for the service to use
  if (options?.framework) {
    _frameworkProvider = options.framework;
  }
  return {
    setup: di => {
      di.addImpl(
        MetadataDocConversionIdentifier,
        MetadataDocConversionServiceExtension
      );
    },
  };
};

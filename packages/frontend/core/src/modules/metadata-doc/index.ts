import {
  CollectionService,
  PinnedCollectionService,
} from '@affine/core/modules/collection';
import { DocsService } from '@affine/core/modules/doc';
import { DocPropertiesStore } from '@affine/core/modules/doc/stores/doc-properties';
import {
  WorkspaceScope,
  WorkspaceService,
} from '@affine/core/modules/workspace';
import { WorkspacePropertyService } from '@affine/core/modules/workspace-property';
import type { Framework } from '@toeverything/infra';

import { MetadataLibraryCollectionService } from './services/collection-creator';
import { MetadataDocConversionService } from './services/conversion';
import { MetadataDocRefreshService } from './services/refresh';
import { MetadataDocTemplateGenerator } from './services/template-generator';

export function configureMetadataDocModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(MetadataDocTemplateGenerator)
    .service(MetadataDocConversionService, [
      DocsService,
      DocPropertiesStore,
      WorkspacePropertyService,
      MetadataDocTemplateGenerator,
      WorkspaceService,
    ])
    .service(MetadataDocRefreshService, [
      DocPropertiesStore,
      DocsService,
      MetadataDocTemplateGenerator,
    ])
    .service(MetadataLibraryCollectionService, [
      CollectionService,
      PinnedCollectionService,
    ]);
}

export {
  MetadataDocConversionService,
  MetadataDocRefreshService,
  MetadataDocTemplateGenerator,
  MetadataLibraryCollectionService,
};

export type { MetadataCardData, PromoteResult } from './services/conversion';
export type { MetadataDocProps } from './services/refresh';

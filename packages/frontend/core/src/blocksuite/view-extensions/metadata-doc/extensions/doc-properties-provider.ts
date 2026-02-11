import { DocPropertiesStore } from '@affine/core/modules/doc/stores/doc-properties';
import { DocPropertiesProviderIdentifier } from '@blocksuite/affine-shared/services';
import type { ExtensionType } from '@blocksuite/store';
import type { FrameworkProvider } from '@toeverything/infra';

export function DocPropertiesProviderExtension(options: {
  framework?: FrameworkProvider;
}): ExtensionType {
  const { framework } = options;

  return {
    setup(di) {
      if (!framework) return;

      di.addImpl(DocPropertiesProviderIdentifier, () => ({
        getDocProperties: (id: string) => {
          const store = framework.get(DocPropertiesStore);
          return store.getDocProperties(id);
        },
        // eslint-disable-next-line rxjs/finnish
        watchDocProperties$: (id: string) => {
          const store = framework.get(DocPropertiesStore);
          return store.watchDocProperties$(id).signal;
        },
        // eslint-disable-next-line rxjs/finnish
        watchPropertyAllValues$: (propertyKey: string) => {
          const store = framework.get(DocPropertiesStore);
          return store.watchPropertyAllValues$(propertyKey).signal;
        },
      }));
    },
  };
}

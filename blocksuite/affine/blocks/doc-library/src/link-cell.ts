import { EditorHostKey } from '@blocksuite/affine-block-database';
import { RefNodeSlotsProvider } from '@blocksuite/affine-inline-reference';
import { DocDisplayMetaProvider } from '@blocksuite/affine-shared/services';
import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  createIcon,
  propertyType,
  t,
} from '@blocksuite/data-view';
import { computed } from '@preact/signals-core';
import { html } from 'lit';
import zod from 'zod';

export const linkColumnType = propertyType('custom-link');

export const linkPropertyModelConfig = linkColumnType.modelConfig({
  name: 'Link',
  propertyData: {
    schema: zod.object({}),
    default: () => ({}),
  },
  jsonValue: {
    schema: zod.string(),
    type: () => t.string.instance(),
    isEmpty: () => false,
  },
  rawValue: {
    schema: zod.string(),
    default: () => '',
    toString: (config: { value: string }) => config.value,
    fromString: (config: { value: string }) => ({ value: config.value }),
    toJson: (config: { value: string }) => config.value,
    fromJson: (config: { value: string }) => config.value,
  },
});

export class LinkCellRenderer extends BaseCellRenderer<string, string> {
  get std() {
    const host = this.view.serviceGet(EditorHostKey);
    return host?.std;
  }

  docMeta$ = computed(() => {
    const docId = this.value;
    if (!docId || !this.std) {
      return null;
    }

    const displayMeta = this.std.get(DocDisplayMetaProvider);
    return {
      title: displayMeta.title(docId).value,
      icon: displayMeta.icon(docId).value,
    };
  });

  private readonly _onClick = (e: MouseEvent) => {
    e.stopPropagation();
    const docId = this.value;
    if (!docId || !this.std) return;

    this.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
      pageId: docId,
      host: this.std.host,
    });
  };

  override render() {
    const meta = this.docMeta$.value;

    return html`
      <div
        style="width: 100%; height: 100%; display: flex; align-items: center; padding: 0 8px; cursor: pointer; gap: 6px;"
        @click="${this._onClick}"
      >
        ${meta
          ? html`
              <div
                style="display: flex; align-items: center; justify-content: center; color: var(--affine-icon-color);"
              >
                ${meta.icon}
              </div>
              <div
                style="font-size: 14px; color: var(--affine-text-primary-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
              >
                ${meta.title || 'Untitled'}
              </div>
            `
          : html`
              <div
                style="color: var(--affine-text-secondary-color); font-size: 14px; font-style: italic;"
              >
                Select document...
              </div>
            `}
      </div>
    `;
  }
}

// Register the custom element to avoid "Illegal constructor"
if (!customElements.get('affine-doc-library-link-cell')) {
  customElements.define('affine-doc-library-link-cell', LinkCellRenderer);
}

export const linkPropertyConfig = linkPropertyModelConfig.createPropertyMeta({
  icon: createIcon('LinkedPageIcon'),
  cellRenderer: {
    view: createFromBaseCellRenderer(LinkCellRenderer),
  },
});

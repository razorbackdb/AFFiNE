import { RefNodeSlotsProvider } from '@blocksuite/affine-inline-reference';
import {
  DocDisplayMetaProvider,
  QuickSearchProvider,
} from '@blocksuite/affine-shared/services';
import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  createIcon,
} from '@blocksuite/data-view';
import { computed } from '@preact/signals-core';
import { html } from 'lit';

import { EditorHostKey } from '../../context/host-context.js';
import {
  docReferenceCellStyle,
  docReferenceIconStyle,
  docReferencePlaceholderStyle,
  docReferenceTitleStyle,
} from './cell-renderer-css.js';
import { docReferencePropertyModelConfig } from './define.js';

export class DocReferenceCell extends BaseCellRenderer<string, string> {
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
    if (this.std?.store.readonly) {
      this._openDoc();
    } else {
      this.selectCurrentCell(true);
    }
  };

  private _openDoc() {
    const docId = this.value;
    if (!docId || !this.std) return;

    this.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
      pageId: docId,
      host: this.std.host,
    });
  }

  override afterEnterEditingMode() {
    const quickSearch = this.std?.getOptional(QuickSearchProvider);
    if (!quickSearch) {
      this.selectCurrentCell(false);
      return;
    }

    quickSearch
      .openQuickSearch()
      .then(result => {
        if (result && 'docId' in result) {
          this.valueSetNextTick(result.docId);
        }
        this.selectCurrentCell(false);
      })
      .catch(() => {
        this.selectCurrentCell(false);
      });
  }

  override render() {
    const meta = this.docMeta$.value;

    return html`
      <div class="${docReferenceCellStyle}" @click="${this._onClick}">
        ${meta
          ? html`
              <div class="${docReferenceIconStyle}">${meta.icon}</div>
              <div class="${docReferenceTitleStyle}">
                ${meta.title || 'Untitled'}
              </div>
            `
          : html`
              <div class="${docReferencePlaceholderStyle}">
                Click to select document...
              </div>
            `}
      </div>
    `;
  }
}

export const docReferenceColumnConfig =
  docReferencePropertyModelConfig.createPropertyMeta({
    icon: createIcon('LinkedPageIcon'),
    cellRenderer: {
      view: createFromBaseCellRenderer(DocReferenceCell),
    },
  });

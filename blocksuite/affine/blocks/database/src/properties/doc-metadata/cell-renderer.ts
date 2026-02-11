import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  createIcon,
} from '@blocksuite/data-view';
import { StarIcon } from '@blocksuite/icons/lit';
import { html, nothing } from 'lit';

import {
  docMetadataCellStyle,
  docMetadataValueStyle,
  ratingStarsStyle,
} from './cell-renderer-css.js';
import {
  type DocMetadataPropertyData,
  docMetadataPropertyModelConfig,
} from './define.js';

export class DocMetadataCell extends BaseCellRenderer<
  any,
  any,
  DocMetadataPropertyData
> {
  override beforeEnterEditMode() {
    return false; // Read-only
  }

  renderValue() {
    const value = this.value;
    const { metadataKey } = this.property.data$.value;

    if (value == null) return nothing;

    if (metadataKey === 'rating') {
      return html`
        <div class="${ratingStarsStyle}">
          ${StarIcon()} <span>${value}</span>
        </div>
      `;
    }

    if (Array.isArray(value)) {
      return html`<div class="${docMetadataValueStyle}">
        ${value.join(', ')}
      </div>`;
    }

    return html`<div class="${docMetadataValueStyle}">${value}</div>`;
  }

  override render() {
    return html`
      <div class="${docMetadataCellStyle}">${this.renderValue()}</div>
    `;
  }
}

export const docMetadataColumnConfig =
  docMetadataPropertyModelConfig.createPropertyMeta({
    icon: createIcon('ViewIcon'),
    cellRenderer: {
      view: createFromBaseCellRenderer(DocMetadataCell),
    },
  });

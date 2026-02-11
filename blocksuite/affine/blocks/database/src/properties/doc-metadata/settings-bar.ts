import type { Property } from '@blocksuite/affine-block-database';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { METADATA_FIELDS } from '@blocksuite/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, LitElement, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

export class DocMetadataSettingsBar extends SignalWatcher(
  WithDisposable(LitElement)
) {
  static override styles = css`
    .metadata-settings-container {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
    }

    .settings-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .settings-label {
      font-size: 10px;
      color: var(--affine-text-secondary-color);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 500;
    }

    .settings-value {
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--affine-background-secondary-color);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .settings-value:hover {
      background: var(--affine-hover-color);
    }

    .divider {
      width: 100%;
      height: 1px;
      background-color: ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
      margin: 4px 0;
    }
  `;

  private readonly _clickSource = (e: MouseEvent) => {
    const properties = this.column.view.properties$.value;
    const docRefProperties = properties.filter(
      (p: any) => p.type$.value === 'doc-reference'
    );

    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options: {
        items: [
          menu.group({
            items: docRefProperties.map((p: any) =>
              menu.action({
                name: p.name$.value,
                isSelected: this.column.data$.value.sourceColumnId === p.id,
                select: () => {
                  this.column.dataUpdate(() => ({ sourceColumnId: p.id }));
                },
              })
            ),
          }),
        ],
      },
    });
  };

  private readonly _clickField = (e: MouseEvent) => {
    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options: {
        items: [
          menu.group({
            items: METADATA_FIELDS.map(f =>
              menu.action({
                name: f.label,
                isSelected: this.column.data$.value.metadataKey === f.key,
                select: () => {
                  this.column.dataUpdate(() => ({ metadataKey: f.key }));
                },
              })
            ),
          }),
        ],
      },
    });
  };

  override render() {
    const data = this.column.data$.value;
    const sourceProperty = data.sourceColumnId
      ? this.column.view.propertyGetOrCreate(data.sourceColumnId as string)
      : null;

    return html`
      <div class="metadata-settings-container">
        <div class="settings-group">
          <div class="settings-label">Source Column</div>
          <div class="settings-value" @click=${this._clickSource}>
            ${sourceProperty?.name$.value || 'Select column...'}
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-label">Metadata Field</div>
          <div class="settings-value" @click=${this._clickField}>
            ${data.metadataKey || 'Select field...'}
          </div>
        </div>

        <div class="divider"></div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor column!: Property;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-doc-metadata-settings-bar': DocMetadataSettingsBar;
  }
}

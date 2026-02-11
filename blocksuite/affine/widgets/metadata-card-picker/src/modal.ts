import {
  type MediaMetadata,
  type MediaType,
  MetadataDocConversionIdentifier,
} from '@blocksuite/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import type { EditorHost } from '@blocksuite/std';
import { ShadowlessElement } from '@blocksuite/std';
import { type BlockModel, Text } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import throttle from 'lodash-es/throttle';

import { MEDIA_TYPE_ICONS, MEDIA_TYPE_NAMES, searchMediaItems } from './config';
import { metadataCardModalStyles } from './styles';

const SEARCH_DEBOUNCE = 200;

/**
 * Modal search component for media metadata
 */
export class MetadataCardSearchModal extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = metadataCardModalStyles;
  private readonly _onCancel = () => {
    // Abort any pending search
    const abortController = this._abortController$.value;
    if (abortController) {
      abortController.abort();
      this._abortController$.value = null;
    }
    this._resolvePromise?.(null);
    this.remove();
  };

  private readonly _onConfirm = async (item: MediaMetadata) => {
    // Abort any pending search
    const abortController = this._abortController$.value;
    if (abortController) {
      abortController.abort();
      this._abortController$.value = null;
    }

    // Perform the linking action
    if (this.insertOptions.mode === 'page') {
      const { parentModel, index } = this.insertOptions;
      const std = this.host.std;

      const conversionService = std.getOptional(
        MetadataDocConversionIdentifier
      );
      if (conversionService) {
        try {
          const result = await conversionService.promoteToDoc(
            {
              type: item.type,
              id: item.id,
              title: item.title,
            },
            item
          );

          if (result.docId) {
            // Insert a linked doc card (horizontal style) for the new document
            std.store.addBlock(
              'affine:embed-linked-doc',
              {
                pageId: result.docId,
                style: 'horizontal',
              },
              parentModel,
              index
            );

            // Dispatch navigation event to open the newly created doc
            const event = new CustomEvent('affine:navigate-to-doc', {
              detail: { docId: result.docId },
              bubbles: true,
              composed: true,
            });
            this.host.dispatchEvent(event);
          }
        } catch (error) {
          console.error('Failed to create metadata link:', error);
        }
      } else {
        // Fallback: just insert the title as a paragraph
        std.store.addBlock(
          'affine:paragraph',
          {
            text: new Text(item.title),
          },
          parentModel,
          index
        );
      }
    }

    this._resolvePromise?.(item);
    this.remove();
  };

  private readonly _onDocumentKeydown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      this._onCancel();
    }
    if (e.key === 'Enter' && !e.isComposing) {
      const items = this._searchResults$.value;
      const selectedIndex = this._selectedIndex$.value;
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        this._onConfirm(items[selectedIndex]).catch(console.error);
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._selectNext();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._selectPrevious();
    }
  };

  private _handleInput(e: InputEvent) {
    const target = e.target as HTMLInputElement;
    this._query$.value = target.value;
    this._debouncedSearch();
  }

  private _selectNext() {
    const items = this._searchResults$.value;
    if (items.length === 0) return;
    const current = this._selectedIndex$.value;
    this._selectedIndex$.value = current < items.length - 1 ? current + 1 : 0;
    this._scrollToSelected();
  }

  private _selectPrevious() {
    const items = this._searchResults$.value;
    if (items.length === 0) return;
    const current = this._selectedIndex$.value;
    this._selectedIndex$.value = current > 0 ? current - 1 : items.length - 1;
    this._scrollToSelected();
  }

  private _scrollToSelected() {
    const selectedIndex = this._selectedIndex$.value;
    if (selectedIndex < 0) return;

    this.updateComplete
      .then(() => {
        const resultsContainer = this.shadowRoot?.querySelector(
          '.metadata-card-modal-list'
        ) as HTMLElement;
        if (!resultsContainer) return;

        const items = resultsContainer.querySelectorAll(
          '.metadata-card-modal-item'
        );
        const selected = items[selectedIndex] as HTMLElement;
        if (selected) {
          selected.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
          });
        }
      })
      .catch(console.error);
  }

  private readonly _debouncedSearch = throttle(() => {
    this._performSearch().catch(console.error);
  }, SEARCH_DEBOUNCE);

  private async _performSearch() {
    const query = this._query$.value.trim();
    if (!query) {
      this._searchResults$.value = [];
      this._loading$.value = false;
      return;
    }

    // Abort previous search if still running
    const prevController = this._abortController$.value;
    if (prevController) {
      prevController.abort();
    }

    this._loading$.value = true;
    this._selectedIndex$.value = -1;

    // Create new abort controller for this search
    const abortController = new AbortController();
    this._abortController$.value = abortController;

    try {
      const results = await searchMediaItems(
        query,
        this.mediaType,
        this.host.std,
        abortController.signal
      );

      // Check if this search was aborted
      if (abortController.signal.aborted) {
        return;
      }
      this._searchResults$.value = results;
      this._error$.value = null;
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      this._searchResults$.value = [];
      this._error$.value =
        error instanceof Error ? error.message : 'Search failed';
    } finally {
      if (this._abortController$.value === abortController) {
        this._abortController$.value = null;
      }
      this._loading$.value = false;
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    this.updateComplete
      .then(() => {
        requestAnimationFrame(() => {
          this.input.focus();
        });
      })
      .catch(() => {
        // Silently handle focus errors
      });

    this.disposables.addFromEvent(this, 'keydown', this._onDocumentKeydown);
  }

  override render() {
    const items = this._searchResults$.value;
    const loading = this._loading$.value;
    const query = this._query$.value;
    const error = this._error$.value;
    const selectedIndex = this._selectedIndex$.value;

    return html`
      <div class="metadata-card-modal-overlay" @click=${this._onCancel}>
        <div
          class="metadata-card-modal"
          @click=${(e: MouseEvent) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div class="metadata-card-modal-header">
            <div class="metadata-card-modal-icon" aria-hidden="true">
              ${MEDIA_TYPE_ICONS[this.mediaType]}
            </div>
            <div id="modal-title" class="metadata-card-modal-title">
              Search ${MEDIA_TYPE_NAMES[this.mediaType].toLowerCase()}
            </div>
          </div>

          <div class="metadata-card-modal-search">
            <input
              class="metadata-card-modal-input"
              type="text"
              placeholder="Type to search..."
              .value=${query}
              @input=${this._handleInput}
              aria-label="Search ${MEDIA_TYPE_NAMES[
                this.mediaType
              ].toLowerCase()}"
              aria-autocomplete="list"
              aria-controls="search-results"
              aria-busy="${loading}"
            />
            ${loading
              ? html`<div
                  class="metadata-card-modal-loading"
                  aria-label="Loading"
                  aria-hidden="true"
                ></div>`
              : nothing}
          </div>

          <div
            id="search-results"
            class="metadata-card-modal-results"
            role="listbox"
            aria-label="Search results"
            aria-live="polite"
          >
            ${!query && !loading && !error
              ? html`<div class="metadata-card-modal-empty" role="status">
                  Start typing to search for
                  ${MEDIA_TYPE_NAMES[this.mediaType].toLowerCase()}...
                </div>`
              : loading
                ? html`<div class="metadata-card-modal-empty" role="status">
                    Searching...
                  </div>`
                : error
                  ? html`<div class="metadata-card-modal-empty" role="alert">
                      <div>${error}</div>
                      <button
                        class="metadata-card-modal-button retry"
                        @click=${() => this._performSearch()}
                      >
                        Retry
                      </button>
                    </div>`
                  : items.length > 0
                    ? html`
                        <div class="metadata-card-modal-list">
                          ${repeat(
                            items,
                            item => item.id,
                            (item, index) => {
                              const isSelected = selectedIndex === index;
                              return html`
                                <div
                                  class=${classMap({
                                    'metadata-card-modal-item': true,
                                    selected: isSelected,
                                  })}
                                  role="option"
                                  aria-selected="${isSelected}"
                                  @click=${() => this._onConfirm(item)}
                                  @mouseenter=${() => {
                                    this._selectedIndex$.value = index;
                                  }}
                                >
                                  ${item.image
                                    ? html`<img
                                        class="metadata-card-modal-item-image"
                                        src="${item.image}"
                                        alt=""
                                        aria-hidden="true"
                                      />`
                                    : html`<div
                                        class="metadata-card-modal-item-image placeholder"
                                        aria-hidden="true"
                                      >
                                        ${MEDIA_TYPE_ICONS[this.mediaType]}
                                      </div>`}
                                  <div class="metadata-card-modal-item-content">
                                    <div class="metadata-card-modal-item-name">
                                      ${item.title}
                                    </div>
                                    ${this._renderItemSubtext(item)}
                                  </div>
                                </div>
                              `;
                            }
                          )}
                        </div>
                      `
                    : html`<div class="metadata-card-modal-empty" role="status">
                        No results found for "${query}"
                      </div>`}
          </div>

          <div class="metadata-card-modal-footer">
            <button
              class="metadata-card-modal-button cancel"
              @click=${this._onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderItemSubtext(item: MediaMetadata) {
    let subtext: string | undefined;
    switch (item.type) {
      case 'movie':
      case 'tv':
        subtext = item.releaseDate
          ? new Date(item.releaseDate).getFullYear().toString()
          : undefined;
        break;
      case 'music':
        subtext = item.artist ?? item.album;
        break;
      case 'book':
        subtext = item.authors?.join(', ');
        break;
      case 'game':
        subtext = item.developers?.join(', ');
        break;
    }

    return subtext
      ? html`<div class="metadata-card-modal-item-subtext">${subtext}</div>`
      : nothing;
  }

  @state()
  private accessor _query$ = signal('');

  @state()
  private accessor _loading$ = signal(false);

  @state()
  private accessor _searchResults$ = signal<MediaMetadata[]>([]);

  @state()
  private accessor _error$ = signal<string | null>(null);

  @state()
  private accessor _selectedIndex$ = signal(-1);

  @state()
  private accessor _abortController$ = signal<AbortController | null>(null);

  @property({ attribute: false })
  accessor host!: EditorHost;

  @property({ attribute: false })
  accessor mediaType!: MediaType;

  @property({ attribute: false })
  accessor insertOptions!:
    | {
        mode: 'page';
        parentModel: BlockModel;
        index: number;
      }
    | { mode: 'edgeless' };

  @query('input')
  accessor input!: HTMLInputElement;

  private _resolvePromise: ((value: MediaMetadata | null) => void) | null =
    null;

  setResolve(resolve: (value: MediaMetadata | null) => void) {
    this._resolvePromise = resolve;
  }
}

export async function toggleMetadataCardSearchModal(
  host: EditorHost,
  mediaType: MediaType,
  insertOptions: {
    mode: 'page' | 'edgeless';
    parentModel?: BlockModel;
    index?: number;
  }
): Promise<MediaMetadata | null> {
  host.selection.clear();

  const modal = new MetadataCardSearchModal();
  modal.host = host;
  modal.mediaType = mediaType;
  modal.insertOptions =
    insertOptions as MetadataCardSearchModal['insertOptions'];

  document.body.append(modal);

  return new Promise(resolve => {
    modal.setResolve(resolve);
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'metadata-card-search-modal': MetadataCardSearchModal;
  }
}

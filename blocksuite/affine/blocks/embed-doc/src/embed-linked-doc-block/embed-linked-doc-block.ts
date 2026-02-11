import {
  EmbedBlockComponent,
  RENDER_CARD_THROTTLE_MS,
} from '@blocksuite/affine-block-embed';
import { SurfaceBlockModel } from '@blocksuite/affine-block-surface';
import { LoadingIcon } from '@blocksuite/affine-components/icons';
import { isPeekable, Peekable } from '@blocksuite/affine-components/peek';
import { RefNodeSlotsProvider } from '@blocksuite/affine-inline-reference';
import type {
  DocMode,
  EmbedLinkedDocModel,
  EmbedLinkedDocStyles,
} from '@blocksuite/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
  REFERENCE_NODE,
} from '@blocksuite/affine-shared/consts';
import {
  CitationProvider,
  DocDisplayMetaProvider,
  DocModeProvider,
  DocPropertiesProviderIdentifier,
  METADATA_CONFIG,
  OpenDocExtensionIdentifier,
  type OpenDocMode,
  ThemeProvider,
} from '@blocksuite/affine-shared/services';
import {
  cloneReferenceInfo,
  cloneReferenceInfoWithoutAliases,
  isNewTabTrigger,
  isNewViewTrigger,
  matchModels,
  referenceToNode,
} from '@blocksuite/affine-shared/utils';
import { Bound } from '@blocksuite/global/gfx';
import { ResetIcon, StarIcon } from '@blocksuite/icons/lit';
import { BlockSelection } from '@blocksuite/std';
import { Text } from '@blocksuite/store';
import { computed } from '@preact/signals-core';
import { html, nothing, type PropertyValues } from 'lit';
import { property, queryAsync, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';
import throttle from 'lodash-es/throttle';
import { filter } from 'rxjs/operators';
import * as Y from 'yjs';

import { renderLinkedDocInCard } from '../common/render-linked-doc';
import { SyncedDocErrorIcon } from '../embed-synced-doc-block/styles.js';
import { styles } from './styles.js';
import { getEmbedLinkedDocIcons } from './utils.js';

@Peekable({
  enableOn: ({ store }: EmbedLinkedDocBlockComponent) => !store.readonly,
})
export class EmbedLinkedDocBlockComponent extends EmbedBlockComponent<EmbedLinkedDocModel> {
  static override styles = styles;

  private readonly _load = async () => {
    // If this is a citation linked doc block, we don't need to load the linked doc and render linked doc content in card
    if (this.isCitation) {
      return;
    }

    const {
      loading = true,
      isError = false,
      isBannerEmpty = true,
      isNoteContentEmpty = true,
    } = this.getInitialState();

    this._loading = loading;
    this.isError = isError;
    this.isBannerEmpty = isBannerEmpty;
    this.isNoteContentEmpty = isNoteContentEmpty;

    if (!this._loading) {
      return;
    }

    const linkedDoc = this.linkedDoc;
    if (!linkedDoc) {
      this._loading = false;
      return;
    }

    if (!linkedDoc.loaded) {
      try {
        linkedDoc.load();
      } catch (e) {
        console.error(e);
        this.isError = true;
      }
    }

    if (!this.isError && !linkedDoc.root) {
      await new Promise<void>(resolve => {
        const subscription = linkedDoc.slots.rootAdded.subscribe(() => {
          subscription.unsubscribe();
          resolve();
        });
      });
    }

    this._loading = false;

    // If it is a link to a block or element, the content will not be rendered.
    if (this._referenceToNode) {
      return;
    }

    if (!this.isError) {
      const cardStyle = this.model.props.style;
      if (cardStyle === 'horizontal' || cardStyle === 'vertical') {
        renderLinkedDocInCard(this);
      }
    }
  };

  private readonly _selectBlock = () => {
    const selectionManager = this.std.selection;
    const blockSelection = selectionManager.create(BlockSelection, {
      blockId: this.blockId,
    });
    selectionManager.setGroup('note', [blockSelection]);
  };

  private readonly _setDocUpdatedAt = () => {
    const meta = this.store.workspace.meta.getDocMeta(this.model.props.pageId);
    if (meta) {
      const date = meta.updatedDate || meta.createDate;
      this._docUpdatedAt = new Date(date);
    }
  };

  override _cardStyle: (typeof EmbedLinkedDocStyles)[number] = 'horizontal';

  convertToEmbed = () => {
    if (this._referenceToNode) return;

    const { caption } = this.model.props;
    const { parent, store } = this.model;
    const index = parent?.children.indexOf(this.model);

    const blockId = store.addBlock(
      'affine:embed-synced-doc',
      {
        caption,
        ...cloneReferenceInfoWithoutAliases(this.referenceInfo$.peek()),
      },
      parent,
      index
    );

    store.deleteBlock(this.model);

    this.std.selection.setGroup('note', [
      this.std.selection.create(BlockSelection, { blockId }),
    ]);
  };

  convertToInline = () => {
    const { store } = this.model;
    const parent = store.getParent(this.model);
    if (!parent) {
      return;
    }
    const index = parent.children.indexOf(this.model);

    const yText = new Y.Text();
    yText.insert(0, REFERENCE_NODE);
    yText.format(0, REFERENCE_NODE.length, {
      reference: {
        type: 'LinkedPage',
        ...this.referenceInfo$.peek(),
      },
    });
    const text = new Text(yText);

    store.addBlock(
      'affine:paragraph',
      {
        text,
      },
      parent,
      index
    );

    store.deleteBlock(this.model);
  };

  referenceInfo$ = computed(() => {
    const { pageId, params, title$, description$ } = this.model.props;
    return cloneReferenceInfo({
      pageId,
      params,
      title: title$?.value,
      description: description$?.value,
    });
  });

  icon$ = computed(() => {
    const { pageId, params, title } = this.referenceInfo$.value;
    return this.std
      .get(DocDisplayMetaProvider)
      .icon(pageId, { params, title, referenced: true }).value;
  });

  open = ({
    openMode,
    event,
  }: {
    openMode?: OpenDocMode;
    event?: MouseEvent;
  } = {}) => {
    this.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
      ...this.referenceInfo$.peek(),
      openMode,
      event,
      host: this.host,
    });
  };

  refreshData = () => {
    this._load().catch(e => {
      console.error(e);
      this.isError = true;
    });
  };

  title$ = computed(() => {
    const { pageId, params, title } = this.referenceInfo$.value;
    return (
      this.std
        .get(DocDisplayMetaProvider)
        .title(pageId, { params, title, referenced: true }) || title
    );
  });

  get docTitle() {
    return this.model.props.title || this.linkedDoc?.meta?.title || 'Untitled';
  }

  get editorMode() {
    return this._linkedDocMode;
  }

  get linkedDoc() {
    const doc = this.std.workspace.getDoc(this.model.props.pageId);
    return doc?.getStore({ id: this.model.props.pageId });
  }

  get readonly() {
    return this.store.readonly;
  }

  get citationService() {
    return this.std.get(CitationProvider);
  }

  get isCitation() {
    return this.citationService.isCitationModel(this.model);
  }

  private async _resolveBlobUrl(imageRef: string): Promise<string | null> {
    // If it already looks like a URL, use it directly
    if (
      imageRef.startsWith('http://') ||
      imageRef.startsWith('https://') ||
      imageRef.startsWith('data:') ||
      imageRef.startsWith('blob:')
    ) {
      return imageRef;
    }
    // Otherwise, treat it as a blob sourceId and resolve from the linked doc's store
    try {
      const storage = this.linkedDoc?.blobSync;
      if (!storage) return null;
      const blob = await storage.get(imageRef);
      if (!blob) return null;

      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);

    // Metadata Doc Specialized Rendering
    type MetadataProps = {
      docType?: string;
      mediaType?: string;
      rating?: number;
      releaseDate?: string;
      artist?: string;
      album?: string;
      authors?: string | string[];
      developers?: string | string[];
      genres?: string | string[];
      pageCount?: number;
      image?: string;
    };
    let props: MetadataProps | null = null;
    const linkedDoc = this.linkedDoc;
    if (linkedDoc) {
      const provider = this.std.getOptional(DocPropertiesProviderIdentifier);
      if (provider) {
        props = provider.getDocProperties(linkedDoc.id) as MetadataProps;
      }
    }

    if (props?.image !== this._currentImageRef) {
      const imageToResolve = props?.image;
      this._currentImageRef = imageToResolve ?? null;

      if (!imageToResolve) {
        if (this._resolvedMetadataImage?.startsWith('blob:')) {
          URL.revokeObjectURL(this._resolvedMetadataImage);
        }
        this._resolvedMetadataImage = null;
      } else {
        this._resolveBlobUrl(imageToResolve)
          .then(url => {
            if (this._currentImageRef !== imageToResolve) {
              // If the image ref has changed since we started resolving, revoke the new URL
              if (url?.startsWith('blob:')) {
                URL.revokeObjectURL(url);
              }
              return;
            }

            if (this._resolvedMetadataImage?.startsWith('blob:')) {
              URL.revokeObjectURL(this._resolvedMetadataImage);
            }
            this._resolvedMetadataImage = url;
          })
          .catch(console.error);
      }
    }
  }

  private readonly _handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    const openDocService = this.std.get(OpenDocExtensionIdentifier);
    const shouldOpenInPeek =
      openDocService.isAllowed('open-in-center-peek') && isPeekable(this);
    this.open({
      openMode: shouldOpenInPeek
        ? 'open-in-center-peek'
        : 'open-in-active-view',
      event,
    });
  };

  private _isDocEmpty() {
    const linkedDoc = this.linkedDoc;
    if (!linkedDoc) {
      return false;
    }
    return !!linkedDoc && this.isNoteContentEmpty && this.isBannerEmpty;
  }

  protected _handleClick = (event: MouseEvent) => {
    if (isNewTabTrigger(event)) {
      this.open({ openMode: 'open-in-new-tab', event });
    } else if (isNewViewTrigger(event)) {
      this.open({ openMode: 'open-in-new-view', event });
    }

    if (this.readonly) {
      return;
    }
    this._selectBlock();
  };

  private readonly _renderCitationView = () => {
    const { footnoteIdentifier } = this.model.props;
    return html`<div
      draggable="${this.blockDraggable ? 'true' : 'false'}"
      class=${classMap({
        'embed-block-container': true,
        ...this.selectedStyle$?.value,
      })}
      style=${styleMap({
        ...this.embedContainerStyle,
      })}
    >
      <affine-citation-card
        .icon=${this.icon$.value}
        .citationTitle=${this.title$.value}
        .citationIdentifier=${footnoteIdentifier}
        .active=${this.selected$.value}
        .onClickCallback=${this._handleClick}
        .onDoubleClickCallback=${this._handleDoubleClick}
      ></affine-citation-card>
    </div> `;
  };

  private readonly _renderEmbedView = () => {
    const linkedDoc = this.linkedDoc;
    const trash = linkedDoc?.meta?.trash;
    const isDeleted = trash || !linkedDoc;
    const isLoading = this._loading;
    const isError = this.isError;
    const isEmpty = this._isDocEmpty() && this.isBannerEmpty;
    const inCanvas = matchModels(this.model.parent, [SurfaceBlockModel]);

    const cardClasses = {
      loading: isLoading,
      error: isError,
      deleted: isDeleted,
      empty: isEmpty,
      'banner-empty': this.isBannerEmpty,
      'note-empty': this.isNoteContentEmpty,
      'in-canvas': inCanvas,
      [this._cardStyle]: true,
      'comment-highlighted': this.isCommentHighlighted,
    };
    const cardClassMap = classMap(cardClasses);

    const theme = this.std.get(ThemeProvider).theme;
    const {
      LinkedDocDeletedBanner,
      LinkedDocEmptyBanner,
      SyncedDocErrorBanner,
    } = getEmbedLinkedDocIcons(theme, this._linkedDocMode, this._cardStyle);

    const icon = isError
      ? SyncedDocErrorIcon
      : isLoading
        ? LoadingIcon()
        : this.icon$.value;
    const title = isLoading ? 'Loading...' : this.title$;
    const description = this.model.props.description$;

    const hasDescriptionAlias = Boolean(description?.value);

    const showDefaultNoteContent = isError || isLoading || isDeleted || isEmpty;
    const defaultNoteContent = isError
      ? 'This linked doc failed to load.'
      : isLoading
        ? ''
        : isDeleted
          ? 'This linked doc is deleted.'
          : isEmpty
            ? 'Preview of the doc will be displayed here.'
            : '';

    const dateText =
      this._cardStyle === 'cube'
        ? this._docUpdatedAt.toLocaleTimeString()
        : this._docUpdatedAt.toLocaleString();

    const showDefaultBanner = isError || isLoading || isDeleted || isEmpty;

    const defaultBanner = isError
      ? SyncedDocErrorBanner
      : isLoading
        ? LinkedDocEmptyBanner
        : isDeleted
          ? LinkedDocDeletedBanner
          : LinkedDocEmptyBanner;

    // Metadata Doc Specialized Rendering
    type MetadataProps = {
      docType?: string;
      mediaType?: string;
      rating?: number;
      releaseDate?: string;
      artist?: string;
      album?: string;
      authors?: string | string[];
      developers?: string | string[];
      genres?: string | string[];
      pageCount?: number;
      image?: string;
    };
    let props: MetadataProps | null = null;
    if (linkedDoc) {
      const provider = this.std.getOptional(DocPropertiesProviderIdentifier);
      if (provider) {
        props = provider.watchDocProperties$(linkedDoc.id)
          .value as MetadataProps;
      }
    }

    const isMetadataBlock = this.model.flavour === 'affine:embed-metadata-card';
    if (
      (isMetadataBlock || props?.docType === 'metadata-doc') &&
      !isError &&
      !isLoading &&
      !isDeleted &&
      props
    ) {
      return this.renderEmbed(() =>
        this._renderMetadataView(props, cardClasses)
      );
    }

    return this.renderEmbed(
      () => html`
        <div
          class="affine-embed-linked-doc-block ${cardClassMap}"
          @click=${this._handleClick}
          @dblclick=${this._handleDoubleClick}
        >
          <div class="affine-embed-linked-doc-content">
            <div class="affine-embed-linked-doc-content-title">
              <div class="affine-embed-linked-doc-content-title-icon">
                ${icon}
              </div>

              <div class="affine-embed-linked-doc-content-title-text">
                ${title}
              </div>
            </div>

            ${when(
              hasDescriptionAlias,
              () =>
                html`<div class="affine-embed-linked-doc-content-note alias">
                  ${repeat(
                    (description?.value || '').split('\n'),
                    text => html`<p>${text}</p>`
                  )}
                </div>`,
              () =>
                when(
                  showDefaultNoteContent,
                  () => html`
                    <div class="affine-embed-linked-doc-content-note default">
                      ${defaultNoteContent}
                    </div>
                  `,
                  () => html`
                    <div
                      class="affine-embed-linked-doc-content-note render"
                    ></div>
                  `
                )
            )}
            ${isError
              ? html`
                  <div class="affine-embed-linked-doc-card-content-reload">
                    <div
                      class="affine-embed-linked-doc-card-content-reload-button"
                      @click=${this.refreshData}
                    >
                      ${ResetIcon()} <span>Reload</span>
                    </div>
                  </div>
                `
              : html`
                  <div class="affine-embed-linked-doc-content-date">
                    <span>Updated</span>

                    <span>${dateText}</span>
                  </div>
                `}
          </div>

          ${showDefaultBanner
            ? html`
                <div class="affine-embed-linked-doc-banner default">
                  ${defaultBanner}
                </div>
              `
            : nothing}
        </div>
      `
    );
  };

  private readonly _renderMetadataView = (
    props: {
      mediaType?: string;
      rating?: number;
      releaseDate?: string;
      artist?: string;
      album?: string;
      authors?: string | string[];
      developers?: string | string[];
      genres?: string | string[];
      pageCount?: number;
      image?: string;
    },
    cardClassMap: Record<string, boolean>
  ) => {
    const title = this.title$;
    const icon = this.icon$.value;
    const mediaType = props.mediaType;
    const config = mediaType ? METADATA_CONFIG[mediaType] : null;

    // Extract metadata
    const rating = props.rating;

    // Media specific info
    let secondaryInfo = null;
    if (config?.secondaryField) {
      const key = config.secondaryField.key as keyof typeof props;
      const rawValue = props[key];
      const value = config.secondaryField.formatter
        ? config.secondaryField.formatter(rawValue, props)
        : rawValue;

      if (value) {
        secondaryInfo = { label: config.secondaryField.label, value };
      }
    }

    return html`
      <div
        class="affine-embed-linked-doc-block ${classMap(cardClassMap)}"
        @click=${this._handleClick}
        @dblclick=${this._handleDoubleClick}
      >
        <div class="affine-embed-linked-doc-content">
          <div class="affine-embed-linked-doc-content-title">
            <div class="affine-embed-linked-doc-content-title-icon">
              ${icon ?? nothing}
            </div>
            <div class="affine-embed-linked-doc-content-title-text">
              ${title ?? 'Untitled'}
            </div>
          </div>

          <div class="metadata-info-grid">
            ${rating
              ? html`
                  <div class="metadata-info-item">
                    <div class="metadata-info-label">Rating</div>
                    <div class="metadata-info-value metadata-rating-value">
                      ${StarIcon()} <span>${rating}</span>
                    </div>
                  </div>
                `
              : nothing}
            ${secondaryInfo?.value
              ? html`
                  <div class="metadata-info-item">
                    <div class="metadata-info-label">
                      ${secondaryInfo.label}
                    </div>
                    <div class="metadata-info-value">
                      ${secondaryInfo.value}
                    </div>
                  </div>
                `
              : nothing}
            ${config?.extraFields.map(field => {
              const key = field.key as keyof typeof props;
              const rawValue = props[key];
              const value = field.formatter
                ? field.formatter(rawValue, props)
                : rawValue;
              if (!value) return nothing;

              return html`
                <div class="metadata-info-item">
                  <div class="metadata-info-label">${field.label}</div>
                  <div class="metadata-info-value">${value}</div>
                </div>
              `;
            })}
          </div>
        </div>

        ${this._resolvedMetadataImage
          ? html`
              <div class="metadata-poster">
                <img
                  src="${this._resolvedMetadataImage}"
                  alt="${this.docTitle}"
                  @error=${(e: Event) => {
                    // Hide broken images gracefully
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            `
          : nothing}
      </div>
    `;
  };

  private readonly _trackCitationDeleteEvent = () => {
    // Check citation delete event
    this._disposables.add(
      this.std.store.slots.blockUpdated
        .pipe(
          filter(payload => {
            if (!payload.isLocal) return false;
            const { flavour, id, type } = payload;
            if (
              type !== 'delete' ||
              flavour !== this.model.flavour ||
              id !== this.model.id
            )
              return false;
            const { model } = payload;
            if (!this.citationService.isCitationModel(model)) return false;
            return true;
          })
        )
        .subscribe(() => {
          this.citationService.trackEvent('Delete');
        })
    );
  };

  override connectedCallback() {
    super.connectedCallback();

    this._cardStyle = this.model.props.style;
    this._referenceToNode = referenceToNode(this.model.props);

    this._load().catch(e => {
      console.error(e);
      this.isError = true;
    });

    const linkedDoc = this.linkedDoc;
    if (linkedDoc) {
      // Should throttle the blockUpdated event to avoid too many re-renders
      // Because the blockUpdated event is triggered too frequently at some cases
      this.disposables.add(
        linkedDoc.slots.blockUpdated.subscribe(
          throttle(payload => {
            if (
              payload.type === 'update' &&
              ['', 'caption', 'xywh'].includes(payload.props.key)
            ) {
              return;
            }

            if (payload.type === 'add' && payload.init) {
              return;
            }

            this._load().catch(e => {
              console.error(e);
              this.isError = true;
            });
          }, RENDER_CARD_THROTTLE_MS)
        )
      );

      this._setDocUpdatedAt();

      if (this._referenceToNode) {
        this._linkedDocMode = this.model.props.params?.mode ?? 'page';
      } else {
        const docMode = this.std.get(DocModeProvider);
        this._linkedDocMode = docMode.getPrimaryMode(this.model.props.pageId);
        this.disposables.add(
          docMode.onPrimaryModeChange(mode => {
            this._linkedDocMode = mode;
          }, this.model.props.pageId)
        );
      }
    }

    this.disposables.add(
      this.model.propsUpdated.subscribe(({ key }) => {
        if (key === 'style') {
          this._cardStyle = this.model.props.style;
        }
        if (key === 'pageId' || key === 'style') {
          this._load().catch(e => {
            console.error(e);
            this.isError = true;
          });
        }
      })
    );

    this.disposables.add(
      this.store.workspace.slots.docListUpdated.subscribe(() => {
        this._setDocUpdatedAt();
        this.refreshData();
      })
    );

    this._trackCitationDeleteEvent();
  }

  getInitialState(): {
    loading?: boolean;
    isError?: boolean;
    isNoteContentEmpty?: boolean;
    isBannerEmpty?: boolean;
  } {
    return {};
  }

  override renderBlock() {
    return this.isCitation
      ? this._renderCitationView()
      : this._renderEmbedView();
  }

  override updated() {
    if (this.readonly) {
      return;
    }
    // update card style when linked doc deleted
    const linkedDoc = this.linkedDoc;
    const { xywh, style } = this.model.props;
    const bound = Bound.deserialize(xywh);
    if (linkedDoc && style === 'horizontalThin') {
      bound.w = EMBED_CARD_WIDTH.horizontal;
      bound.h = EMBED_CARD_HEIGHT.horizontal;
      this.store.withoutTransact(() => {
        this.store.updateBlock(this.model, {
          xywh: bound.serialize(),
          style: 'horizontal',
        });
      });
    } else if (!linkedDoc && style === 'horizontal') {
      bound.w = EMBED_CARD_WIDTH.horizontalThin;
      bound.h = EMBED_CARD_HEIGHT.horizontalThin;
      this.store.withoutTransact(() => {
        this.store.updateBlock(this.model, {
          xywh: bound.serialize(),
          style: 'horizontalThin',
        });
      });
    }
  }

  @state()
  private accessor _docUpdatedAt: Date = new Date();

  @state()
  private accessor _linkedDocMode: DocMode = 'page';

  @state()
  private accessor _loading = false;

  // reference to block/element
  @state()
  private accessor _referenceToNode = false;

  @property({ attribute: false })
  accessor isBannerEmpty = false;

  @property({ attribute: false })
  accessor isError = false;

  @state()
  private accessor _resolvedMetadataImage: string | null = null;

  private _currentImageRef: string | null = null;

  @property({ attribute: false })
  accessor isNoteContentEmpty = false;

  @queryAsync('.affine-embed-linked-doc-content-note.render')
  accessor noteContainer!: Promise<HTMLDivElement | null>;

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (
      this._resolvedMetadataImage?.startsWith('blob:') &&
      this._resolvedMetadataImage !== this._currentImageRef
    ) {
      URL.revokeObjectURL(this._resolvedMetadataImage);
    }
  }
}

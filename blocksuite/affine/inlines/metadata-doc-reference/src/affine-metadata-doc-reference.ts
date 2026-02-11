import { whenHover } from '@blocksuite/affine-components/hover';
import { Peekable } from '@blocksuite/affine-components/peek';
import type { ReferenceInfo } from '@blocksuite/affine-model';
import {
  DEFAULT_DOC_NAME,
  REFERENCE_NODE,
} from '@blocksuite/affine-shared/consts';
import {
  DocDisplayMetaProvider,
  ToolbarRegistryIdentifier,
} from '@blocksuite/affine-shared/services';
import { affineTextStyles } from '@blocksuite/affine-shared/styles';
import type { AffineTextAttributes } from '@blocksuite/affine-shared/types';
import {
  cloneReferenceInfo,
  referenceToNode,
} from '@blocksuite/affine-shared/utils';
import { WithDisposable } from '@blocksuite/global/lit';
import {
  BookPanelIcon,
  GamePanelIcon,
  HeadphonePanelIcon,
  MoviePanelIcon,
} from '@blocksuite/icons/lit';
import type { BlockComponent, BlockStdScope } from '@blocksuite/std';
import { BLOCK_ID_ATTR, ShadowlessElement } from '@blocksuite/std';
import {
  INLINE_ROOT_ATTR,
  type InlineRootElement,
  ZERO_WIDTH_FOR_EMBED_NODE,
  ZERO_WIDTH_FOR_EMPTY_LINE,
} from '@blocksuite/std/inline';
import type { DeltaInsert, DocMeta, Store } from '@blocksuite/store';
import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';

// Media type for metadata docs
export type MetadataDocMediaType = 'movie' | 'tv' | 'game' | 'music' | 'book';

/**
 * Configuration for metadata doc reference nodes
 */
export interface MetadataDocReferenceNodeConfig {
  customContent?: (reference: AffineMetadataDocReference) => unknown;
  interactable?: boolean;
  hidePopup?: boolean;
}

/**
 * Provider for metadata doc reference node configuration
 */
export class MetadataDocReferenceNodeConfigProvider {
  private _customContent:
    | ((reference: AffineMetadataDocReference) => unknown)
    | undefined = undefined;

  private _hidePopup = false;

  private _interactable = true;

  get customContent() {
    return this._customContent;
  }

  get doc() {
    return this.std.store;
  }

  get hidePopup() {
    return this._hidePopup;
  }

  get interactable() {
    return this._interactable;
  }

  constructor(readonly std: BlockStdScope) {}

  setCustomContent(
    content: MetadataDocReferenceNodeConfigProvider['_customContent']
  ) {
    this._customContent = content;
  }

  setHidePopup(hidePopup: boolean) {
    this._hidePopup = hidePopup;
  }

  setInteractable(interactable: boolean) {
    this._interactable = interactable;
  }
}

/**
 * Get media type from doc properties if available
 * This checks if the doc has metadata doc properties
 */
function getMediaTypeFromDoc(
  doc: Store | undefined
): MetadataDocMediaType | null {
  if (!doc) return null;
  const docMeta = doc.workspace.meta.docMetas.find(m => m.id === doc.id);
  return (docMeta as any)?.mediaType ?? null;
}

/**
 * Event emitted when a metadata doc link is clicked
 */
export interface MetadataDocLinkClickedEvent extends ReferenceInfo {
  event?: MouseEvent;
  openMode?: 'current-tab' | 'new-tab' | 'split-view';
  host?: Element;
}

/**
 * Slots provider for metadata doc reference node events
 */
export class MetadataDocRefNodeSlotsProvider {
  docLinkClicked = new WeakMap<
    Element,
    EventEmitter<MetadataDocLinkClickedEvent>
  >();

  constructor(readonly std: BlockStdScope) {}
}

type EventEmitter<T> = {
  next: (value: T) => void;
};

@Peekable({ action: false })
export class AffineMetadataDocReference extends WithDisposable(
  ShadowlessElement
) {
  static override styles = css`
    .affine-metadata-doc-reference {
      white-space: normal;
      word-break: break-word;
      color: var(--affine-text-primary-color);
      fill: var(--affine-icon-color);
      border-radius: 4px;
      text-decoration: none;
      cursor: pointer;
      user-select: none;
      padding: 1px 2px 1px 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;

      svg {
        margin-bottom: 0.1em;
      }
    }

    .affine-metadata-doc-reference:hover {
      background: var(--affine-hover-color);
    }

    .affine-metadata-doc-reference[data-selected='true'] {
      background: var(--affine-hover-color);
    }

    .affine-metadata-doc-reference-title {
      margin-left: 4px;
      border-bottom: 0.5px solid var(--affine-divider-color);
      transition: border 0.2s ease-out;
    }

    .affine-metadata-doc-reference-title:hover {
      border-bottom: 0.5px solid var(--affine-icon-color);
    }

    .affine-metadata-doc-reference-icon {
      display: inline-flex;
      align-items: center;
      font-size: 1em;
      flex-shrink: 0;
    }

    .media-type-badge {
      font-size: 0.75em;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--affine-tag-background);
      color: var(--affine-tag-color);
      margin-left: 4px;
    }
  `;

  get docTitle() {
    return this.refMeta?.title ?? DEFAULT_DOC_NAME;
  }

  private readonly _updateRefMeta = (doc: Store) => {
    const refAttribute = this.delta.attributes?.reference;
    if (!refAttribute) {
      return;
    }

    const refMeta = doc.workspace.meta.docMetas.find(
      docMeta => docMeta.id === refAttribute.pageId
    );
    this.refMeta = refMeta
      ? {
          ...refMeta,
        }
      : undefined;
  };

  // Since the linked doc may be deleted, the `_refMeta` could be undefined.
  @state()
  accessor refMeta: DocMeta | undefined = undefined;

  /**
   * Get the icon for the metadata doc reference
   * Uses media type from reference params or doc properties
   */
  get _icon() {
    // Try to get media type from reference params first
    const mediaType = this._mediaType || 'movie';

    return (
      choose(mediaType, [
        ['movie', () => MoviePanelIcon({ width: '1.25em', height: '1.25em' })],
        ['tv', () => MoviePanelIcon({ width: '1.25em', height: '1.25em' })],
        ['game', () => GamePanelIcon({ width: '1.25em', height: '1.25em' })],
        [
          'music',
          () => HeadphonePanelIcon({ width: '1.25em', height: '1.25em' }),
        ],
        ['book', () => BookPanelIcon({ width: '1.25em', height: '1.25em' })],
      ]) ?? MoviePanelIcon({ width: '1.25em', height: '1.25em' })
    );
  }

  /**
   * Get the media type from reference params or doc properties
   */
  get _mediaType(): MetadataDocMediaType | null {
    const reference = this.delta.attributes?.reference;
    if (!reference) return null;

    // Check if mediaType is in params (if we extend ReferenceParams)
    const paramsMediaType = (
      reference.params as { mediaType?: MetadataDocMediaType }
    )?.mediaType;
    if (paramsMediaType) {
      return paramsMediaType;
    }

    // Try to get from doc properties
    const doc = this.doc;
    if (doc) {
      return getMediaTypeFromDoc(doc);
    }

    return null;
  }

  get _title() {
    const { pageId, params, title } = this.referenceInfo;
    return (
      this.std
        .get(DocDisplayMetaProvider)
        .title(pageId, { params, title, referenced: true }).value || title
    );
  }

  get block() {
    if (!this.inlineEditor?.rootElement) return null;
    const block = this.inlineEditor.rootElement.closest<BlockComponent>(
      `[${BLOCK_ID_ATTR}]`
    );
    return block;
  }

  get customContent() {
    return this.config.customContent;
  }

  get doc() {
    const doc = this.config.doc;
    return doc;
  }

  get inlineEditor() {
    const inlineRoot = this.closest<InlineRootElement<AffineTextAttributes>>(
      `[${INLINE_ROOT_ATTR}]`
    );
    return inlineRoot?.inlineEditor;
  }

  get referenceInfo(): ReferenceInfo {
    const reference = this.delta.attributes?.reference;
    const id = this.doc?.id ?? '';
    if (!reference) return { pageId: id };
    return cloneReferenceInfo(reference);
  }

  get selfInlineRange() {
    const selfInlineRange = this.inlineEditor?.getInlineRangeFromElement(this);
    return selfInlineRange;
  }

  readonly open = (event?: Partial<MetadataDocLinkClickedEvent>) => {
    if (!this.config.interactable) return;
    if (event?.event?.button === 2) {
      return;
    }

    // Try to use the slots provider if available
    const slots = this.std.getOptional(MetadataDocRefNodeSlotsProvider) as
      | MetadataDocRefNodeSlotsProvider
      | undefined;
    const emitter = slots?.docLinkClicked.get(this.std.host);

    if (emitter) {
      emitter.next({
        ...this.referenceInfo,
        ...event,
        openMode:
          event?.event?.button === 1 ? 'open-in-new-tab' : event?.openMode,
        host: this.std.host,
      } as MetadataDocLinkClickedEvent);
    } else {
      // Fallback: dispatch a custom event for navigation
      const navEvent = new CustomEvent('affine:navigate-to-doc', {
        detail: {
          docId: this.referenceInfo.pageId,
          ...event,
        },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(navEvent);
    }
  };

  _whenHover = whenHover(
    hovered => {
      if (!this.config.interactable) return;

      const message$ = this.std.get(ToolbarRegistryIdentifier).message$;

      if (hovered) {
        message$.value = {
          flavour: 'affine:metadata-doc-reference',
          element: this,
          setFloating: this._whenHover.setFloating,
        };
        return;
      }

      // Clears previous bindings
      message$.value = null;
      this._whenHover.setFloating();
    },
    { enterDelay: 500 }
  );

  override connectedCallback() {
    super.connectedCallback();

    this._whenHover.setReference(this);

    const message$ = this.std.get(ToolbarRegistryIdentifier).message$;

    this._disposables.add(() => {
      if (message$?.value) {
        message$.value = null;
      }
      this._whenHover.dispose();
    });

    if (!this.config) {
      console.error(
        '`metadata-doc-reference` need `MetadataDocReferenceNodeConfig`.'
      );
      return;
    }

    if (this.delta.insert !== REFERENCE_NODE) {
      console.error(
        `Metadata doc reference node must be initialized with '${REFERENCE_NODE}', but got '${this.delta.insert}'`
      );
    }

    const doc = this.doc;
    if (doc) {
      this._disposables.add(
        doc.workspace.slots.docListUpdated.subscribe(() =>
          this._updateRefMeta(doc)
        )
      );
    }

    this.updateComplete
      .then(() => {
        if (!this.inlineEditor || !doc) return;

        // observe yText update
        this.disposables.add(
          this.inlineEditor.slots.textChange.subscribe(() =>
            this._updateRefMeta(doc)
          )
        );
      })
      .catch(console.error);
  }

  // reference to block/element
  referenceToNode() {
    return referenceToNode(this.referenceInfo);
  }

  override render() {
    const refMeta = this.refMeta;
    const isDeleted = !refMeta;

    const attributes = this.delta.attributes;
    const reference = attributes?.reference;
    const type = reference?.type;
    if (!attributes || !type) {
      return nothing;
    }

    const title = this._title;
    const icon = this._icon;
    const mediaType = this._mediaType;

    const style = affineTextStyles(
      attributes,
      isDeleted
        ? {
            color: 'var(--affine-text-disable-color)',
            textDecoration: 'line-through',
            fill: 'var(--affine-text-disable-color)',
          }
        : {}
    );

    const content = this.customContent
      ? this.customContent(this)
      : html`<span class="affine-metadata-doc-reference-icon">${icon}</span
          ><span
            data-title=${ifDefined(title)}
            class="affine-metadata-doc-reference-title"
            >${title}</span
          >${mediaType
            ? html`<span class="media-type-badge">${mediaType}</span>`
            : nothing}`;

    // we need to add `<v-text .str=${ZERO_WIDTH_FOR_EMBED_NODE}></v-text>` in an
    // embed element to make sure inline range calculation is correct
    return html`<span
      data-selected=${this.selected}
      class="affine-metadata-doc-reference"
      style=${styleMap(style)}
      @click=${(event: MouseEvent) => this.open({ event })}
      @auxclick=${(event: MouseEvent) => this.open({ event })}
      >${content}<v-text .str=${ZERO_WIDTH_FOR_EMBED_NODE}></v-text
    ></span>`;
  }

  override willUpdate(_changedProperties: Map<PropertyKey, unknown>) {
    super.willUpdate(_changedProperties);

    const doc = this.doc;
    if (doc) {
      this._updateRefMeta(doc);
    }
  }

  @property({ attribute: false })
  accessor config!: MetadataDocReferenceNodeConfigProvider;

  @property({ type: Object })
  accessor delta: DeltaInsert<AffineTextAttributes> = {
    insert: ZERO_WIDTH_FOR_EMPTY_LINE,
    attributes: {},
  };

  @property({ type: Boolean })
  accessor selected = false;

  @property({ attribute: false })
  accessor std!: BlockStdScope;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-metadata-doc-reference': AffineMetadataDocReference;
  }
}

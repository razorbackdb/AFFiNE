import {
  BlockRenderer,
  currentViewStorage,
  DatabaseBlockComponent,
  databaseContentStyles,
  databaseHeaderBarStyles,
  databaseHeaderContainerStyles,
  databaseOpsStyles,
  databaseTitleRowStyles,
  databaseTitleStyles,
  databaseToolbarRowStyles,
  databaseViewBarContainerStyles,
  EditorHostKey,
  getSingleDocIdFromText,
  NoteRenderer,
} from '@blocksuite/affine-block-database';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { PeekViewProvider } from '@blocksuite/affine-components/peek';
import { toast } from '@blocksuite/affine-components/toast';
import {
  CommentProviderIdentifier,
  type TelemetryEventMap,
  TelemetryProvider,
} from '@blocksuite/affine-shared/services';
import {
  createRecordDetail,
  createUniComponentFromWebComponent,
  DataViewRootUILogic,
  type DataViewUILogicBase,
  type DataViewWidget,
  type DataViewWidgetProps,
  defineUniComponent,
  ExternalGroupByConfigProvider,
  lazy,
  renderUniLit,
  type SingleView,
  uniMap,
} from '@blocksuite/data-view';
import { widgetPresets } from '@blocksuite/data-view/widget-presets';
import {
  CommentIcon,
  CopyIcon,
  DeleteIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/lit';
import { BlockSelection } from '@blocksuite/std';
import { Slice } from '@blocksuite/store';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { DEFAULT_COLUMNS } from './column-presets.js';
import { DocLibraryDataSource } from './data-source.js';

export class DocLibraryBlockComponent extends DatabaseBlockComponent {
  override get model(): any {
    return super.model as any;
  }

  // Use a Different name internally but we must cast 'this' to any to override the private dataSource in base
  private readonly _docLibraryDataSource = lazy(() => {
    const dataSource = new DocLibraryDataSource(this.model as any);
    dataSource.serviceSet(EditorHostKey, this.host);
    this.std.provider.getAll(ExternalGroupByConfigProvider).forEach(config => {
      dataSource.serviceSet(ExternalGroupByConfigProvider(config.name), config);
    });

    const id = currentViewStorage.getCurrentView(this.model.id);
    if (id && dataSource.viewManager.viewGet(id)) {
      dataSource.viewManager.setCurrentView(id);
    }
    return dataSource;
  });

  protected override readonly clickDatabaseOps = (e: MouseEvent) => {
    const model = this.model as any;
    const doc = this.std.store;

    const options = (this as any).optionsConfig.configure(model as any, {
      items: [
        menu.group({
          items: [
            menu.action({
              name: 'Movies',
              isSelected: model.props.source.mediaType === 'movie',
              select: () =>
                doc.transact(() => {
                  model.props.source = {
                    docType: 'metadata-doc',
                    mediaType: 'movie',
                  };
                  model.props.columns = DEFAULT_COLUMNS['movie'];
                }),
            }),
            menu.action({
              name: 'TV Shows',
              isSelected: model.props.source.mediaType === 'tv',
              select: () =>
                doc.transact(() => {
                  model.props.source = {
                    docType: 'metadata-doc',
                    mediaType: 'tv',
                  };
                  model.props.columns = DEFAULT_COLUMNS['tv'];
                }),
            }),
            menu.action({
              name: 'Books',
              isSelected: model.props.source.mediaType === 'book',
              select: () =>
                doc.transact(() => {
                  model.props.source = {
                    docType: 'metadata-doc',
                    mediaType: 'book',
                  };
                  model.props.columns = DEFAULT_COLUMNS['book'];
                }),
            }),
            menu.action({
              name: 'Games',
              isSelected: model.props.source.mediaType === 'game',
              select: () =>
                doc.transact(() => {
                  model.props.source = {
                    docType: 'metadata-doc',
                    mediaType: 'game',
                  };
                  model.props.columns = DEFAULT_COLUMNS['game'];
                }),
            }),
            menu.action({
              name: 'Music',
              isSelected: model.props.source.mediaType === 'music',
              select: () =>
                doc.transact(() => {
                  model.props.source = {
                    docType: 'metadata-doc',
                    mediaType: 'music',
                  };
                  model.props.columns = DEFAULT_COLUMNS['music'];
                }),
            }),
          ],
        }),
        menu.input({
          initialValue: model.props.title.toString(),
          placeholder: 'Library title',
          onChange: text => {
            model.props.title.replace(0, model.props.title.length, text);
          },
        }),
        menu.action({
          prefix: CommentIcon(),
          name: 'Comment',
          hide: () => !this.std.getOptional(CommentProviderIdentifier),
          select: () => {
            this.std.getOptional(CommentProviderIdentifier)?.addComment([
              new BlockSelection({
                blockId: this.blockId,
              }),
            ]);
          },
        }),
        menu.action({
          prefix: CopyIcon(),
          name: 'Copy',
          select: () => {
            const slice = Slice.fromModels(this.store, [this.model]);
            this.std.clipboard
              .copySlice(slice)
              .then(() => {
                toast(this.host, 'Copied to clipboard');
              })
              .catch(console.error);
          },
        }),
        menu.group({
          items: [
            menu.action({
              prefix: DeleteIcon(),
              class: {
                'delete-item': true,
              },
              name: 'Delete Library',
              select: () => {
                this.store.deleteBlock(this.model);
              },
            }),
          ],
        }),
      ],
    });

    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options,
    });
  };

  constructor() {
    super();
    // Shadow the private dataSource from base class by defining it on the instance
    Object.defineProperty(this, 'dataSource', {
      get: () => this._docLibraryDataSource,
    });
  }

  private readonly _docLibraryDataViewRootLogic = lazy(
    () =>
      new DataViewRootUILogic({
        virtualPadding$: (this as any).virtualPadding$,
        bindHotkey: hotkeys => {
          return {
            dispose: this.host.event.bindHotkey(hotkeys, {
              blockId:
                (this as any).topContenteditableElement?.blockId ??
                this.blockId,
            }),
          };
        },
        handleEvent: (name, handler) => {
          return {
            dispose: this.host.event.add(name, handler, {
              blockId: this.blockId,
            }),
          };
        },
        selection$: (this as any).viewSelection$,
        setSelection: (this as any).setSelection,
        dataSource: this._docLibraryDataSource.value,
        headerWidget: this._libHeaderWidget,
        onDrag: this.onDrag,
        clipboard: this.std.clipboard,
        notification: {
          toast: message => {
            toast(this.host, message);
          },
        },
        eventTrace: (key, params) => {
          const telemetryService = this.std.getOptional(TelemetryProvider);
          telemetryService?.track(key, {
            ...(params as TelemetryEventMap[typeof key]),
            blockId: this.blockId,
          });
        },
        detailPanelConfig: {
          openDetailPanel: (target, data) => {
            const peekViewService = this.std.getOptional(PeekViewProvider);
            if (peekViewService) {
              const openDoc = (docId: string) => {
                return peekViewService.peek({
                  docId,
                  databaseId: this.blockId,
                  databaseDocId: this.model.store.id,
                  databaseRowId: data.rowId,
                  target: this,
                });
              };
              const doc = getSingleDocIdFromText(
                this.model.store.getBlock(data.rowId)?.model?.text
              );
              if (doc) {
                return openDoc(doc);
              }
              const abort = new AbortController();
              return new Promise<void>(focusBack => {
                peekViewService
                  .peek(
                    {
                      target,
                      template: this._createLibTemplate(data, docId => {
                        openDoc(docId).then(focusBack).catch(focusBack);
                      }),
                    },
                    { abortSignal: abort.signal }
                  )
                  .then(focusBack)
                  .catch(focusBack);
              });
            }
            return Promise.resolve();
          },
        },
      })
  );

  private _createLibTemplate(
    data: {
      view: SingleView;
      rowId: string;
    },
    openDoc: (docId: string) => void
  ) {
    return createRecordDetail({
      ...data,
      openDoc,
      detail: {
        header: uniMap(
          createUniComponentFromWebComponent(BlockRenderer),
          props => ({
            ...props,
            host: this.host,
          })
        ),
        note: uniMap(
          createUniComponentFromWebComponent(NoteRenderer),
          props => ({
            ...props,
            model: this.model,
            host: this.host,
          })
        ),
      },
    });
  }

  private readonly _libHeaderWidget: DataViewWidget = defineUniComponent(
    (props: DataViewWidgetProps) => {
      return html`
        <div class="${databaseHeaderContainerStyles}">
          <div class="${databaseTitleRowStyles}">
            ${this._renderLibTitle(props.dataViewLogic)}
            ${this._renderLibDatabaseOps()}
          </div>
          <div class="${databaseToolbarRowStyles} ${databaseHeaderBarStyles}">
            <div class="${databaseViewBarContainerStyles}">
              ${renderUniLit(widgetPresets.viewBar, {
                ...props,
                onChangeView: (id: string) => {
                  currentViewStorage.setCurrentView(this.blockId, id);
                },
              })}
            </div>
            ${renderUniLit((this as any).toolsWidget, props)}
          </div>
          ${renderUniLit(widgetPresets.quickSettingBar, props)}
        </div>
      `;
    }
  );

  private _renderLibTitle(dataViewLogic: DataViewUILogicBase) {
    return html` <affine-database-title
      class="${databaseTitleStyles}"
      .titleText="${this.model.props.title}"
      .dataViewLogic="${dataViewLogic}"
    ></affine-database-title>`;
  }

  private _renderLibDatabaseOps() {
    return html` <div
      data-testid="database-ops"
      class="${databaseOpsStyles}"
      @click="${this.clickDatabaseOps}"
    >
      ${MoreHorizontalIcon()}
    </div>`;
  }

  override renderBlock() {
    const widgets = html`${repeat(
      Object.entries(this.widgets),
      ([id]) => id,
      ([_, widget]) => widget
    )}`;

    return html`
      <div contenteditable="false" class="${databaseContentStyles}">
        ${this._docLibraryDataViewRootLogic.value.render()} ${widgets}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-doc-library': DocLibraryBlockComponent;
  }
}

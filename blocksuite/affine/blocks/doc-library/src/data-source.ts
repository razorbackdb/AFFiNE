import {
  addProperty,
  databaseBlockProperties,
  databaseBlockViewConverts,
  databaseBlockViewMap,
  databaseBlockViews,
  deleteView,
  duplicateView,
  EditorHostKey,
  moveViewTo,
  updateProperty,
  updateView,
} from '@blocksuite/affine-block-database';
import type { DocLibraryBlockModel } from '@blocksuite/affine-model';
import {
  DocDisplayMetaProvider,
  DocPropertiesProviderIdentifier,
} from '@blocksuite/affine-shared/services';
import {
  DataSourceBase,
  type DataViewDataType,
  type PropertyMetaConfig,
  type TypeInstance,
  type ViewManager,
  ViewManagerBase,
  type ViewMeta,
} from '@blocksuite/data-view';
import { Text } from '@blocksuite/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import { linkPropertyConfig } from './link-cell.js';

export class DocLibraryDataSource extends DataSourceBase {
  private readonly _model: any;

  override get parentProvider() {
    return (this._model as DocLibraryBlockModel)?.store?.provider;
  }

  // Rows are Document IDs matching the filter
  rows$: ReadonlySignal<string[]> = computed(() => {
    const model = this._model as any;
    const source = model.props.source$.value;
    if (!source) return [];

    const { docType, mediaType } = source;
    const host = this.serviceGet(EditorHostKey);
    if (!host?.std?.workspace) return [];

    const provider = host.std.getOptional(DocPropertiesProviderIdentifier);
    if (!provider) return [];

    // Watch all doc types and media types to keep the row list reactive
    const docTypes = (provider as any).watchPropertyAllValues$?.(
      'docType'
    )?.value;
    const mediaTypes = (provider as any).watchPropertyAllValues$?.(
      'mediaType'
    )?.value;

    const workspace = host.std.workspace as any;
    const allDocs = workspace.meta.docMetas || [];
    return allDocs
      .filter((meta: any) => {
        if (!meta || meta.trash) return false;

        // If we have reactive maps, use them. Otherwise fallback to static lookup.
        if (docTypes && mediaTypes) {
          return (
            docTypes.get(meta.id) === docType &&
            mediaTypes.get(meta.id) === mediaType
          );
        }

        const props = provider.getDocProperties(meta.id);
        return props?.docType === docType && props?.mediaType === mediaType;
      })
      .map((meta: any) => meta.id);
  });

  properties$: ReadonlySignal<string[]> = computed(() => {
    return (
      (this._model as any)?.props?.columns$?.value?.map(
        (column: any) => column.id
      ) || []
    );
  });

  readonly$: ReadonlySignal<boolean> = signal(true);
  viewConverts = databaseBlockViewConverts;
  viewDataList$: ReadonlySignal<DataViewDataType[]> = computed(() => {
    return (this._model as any)?.props?.views$?.value || [];
  });
  override viewManager: ViewManager = new ViewManagerBase(this);
  viewMetas = databaseBlockViews;

  allPropertyMetas$ = computed<PropertyMetaConfig<any, any, any, any>[]>(() => {
    return [...Object.values(databaseBlockProperties), linkPropertyConfig];
  });

  propertyMetas$ = computed<PropertyMetaConfig[]>(() => {
    return this.allPropertyMetas$.value.filter(
      v => !v.config.fixed && !v.config.hide
    );
  });

  override featureFlags$ = computed(() => ({
    enable_number_formatting: true,
    enable_table_virtual_scroll: false,
  }));

  constructor(model: DocLibraryBlockModel) {
    super();
    this._model = model;
  }

  cellValueGet(rowId: string, propertyId: string): unknown {
    const model = this._model as DocLibraryBlockModel;
    const column = model?.props?.columns$?.value?.find(
      (c: any) => c.id === propertyId
    );
    if (!column) {
      return null;
    }

    const host = this.serviceGet(EditorHostKey);
    const provider = host?.std.getOptional(DocPropertiesProviderIdentifier);
    const displayMeta = host?.std.getOptional(DocDisplayMetaProvider);

    if (column.type === 'title') {
      const title = displayMeta?.title(rowId).value || 'Untitled';
      return new Text(title);
    }

    if (column.type === 'custom-link') {
      return rowId;
    }

    if (column.type === 'doc-metadata' || column.type === 'doc-reference') {
      // If it's a doc-reference type, the value is the docId itself
      if (column.type === 'doc-reference') return rowId;

      const metadataKey = (column.data as any).metadataKey || propertyId;
      const props = provider?.watchDocProperties$(rowId).value;

      // 1. Try Provider properties with robust key lookup
      let val = this._tryKeys(props, metadataKey);

      // 2. Fallback to non-reactive provider lookup if signal is not populated yet.
      // Avoid opening doc stores here; creating stores during rendering can trigger
      // recursive store construction and cycle errors.
      if (val === undefined) {
        const snapshot = provider?.getDocProperties(rowId);
        val = this._tryKeys(snapshot, metadataKey);
      }

      if (val === undefined || val === null) return null;

      if (Array.isArray(val)) {
        return val.join(', ');
      }
      return val;
    }

    return null;
  }

  // Helper method for key lookup
  private _tryKeys(obj: any, key: string) {
    if (!obj) return undefined;

    // 1. Direct key
    if (obj[key] !== undefined) return obj[key];

    // 2. meta: prefix
    if (obj[`meta:${key}`] !== undefined) return obj[`meta:${key}`];

    // 3. custom:meta: prefix (e.g. custom:meta:platforms)
    if (obj[`custom:meta:${key}`] !== undefined)
      return obj[`custom:meta:${key}`];

    // 4. custom:meta: + snake_case (e.g. custom:meta:release_date)
    const snakeKey = key.replace(
      /[A-Z]/g,
      letter => `_${letter.toLowerCase()}`
    );
    if (obj[`custom:meta:${snakeKey}`] !== undefined)
      return obj[`custom:meta:${snakeKey}`];

    return undefined;
  }

  cellValueChange(_rowId: string, _propertyId: string, _value: unknown): void {
    // Read-only for now
  }

  propertyDataGet(propertyId: string): Record<string, unknown> {
    const model = this._model as any;
    return (
      model?.props?.columns$?.value?.find((c: any) => c.id === propertyId)
        ?.data || {}
    );
  }

  propertyDataSet(propertyId: string, data: Record<string, unknown>): void {
    updateProperty(this._model as any, propertyId, () => ({ data }));
  }

  propertyTypeGet(propertyId: string): string | undefined {
    const model = this._model as any;
    return model?.props?.columns$?.value?.find((c: any) => c.id === propertyId)
      ?.type;
  }

  propertyTypeSet(propertyId: string, toType: string): void {
    updateProperty(this._model as any, propertyId, () => ({ type: toType }));
  }

  propertyNameGet(propertyId: string): string {
    const model = this._model as any;
    return (
      model?.props?.columns$?.value?.find((c: any) => c.id === propertyId)
        ?.name || ''
    );
  }

  propertyNameSet(propertyId: string, name: string): void {
    updateProperty(this._model as any, propertyId, () => ({ name }));
  }

  propertyDataTypeGet(propertyId: string): TypeInstance | undefined {
    const type = this.propertyTypeGet(propertyId);
    if (!type) return;
    return this.propertyMetaGet(type)?.config.jsonValue.type({
      data: this.propertyDataGet(propertyId),
      dataSource: this,
    });
  }

  propertyDelete(id: string): void {
    const model = this._model as DocLibraryBlockModel;
    const index = model.props.columns.findIndex(v => v.id === id);
    if (index >= 0) {
      model.store.transact(() => {
        model.props.columns.splice(index, 1);
      });
    }
  }

  propertyDuplicate(_propertyId: string): string | undefined {
    return undefined;
  }

  propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    return this.allPropertyMetas$.value.find(p => p.type === type);
  }

  rowAdd(_position: any): string {
    throw new Error('Doc library is read-only');
  }

  rowDelete(_ids: string[]): void {}

  rowMove(_rowId: string, _position: any): void {}

  viewDataAdd(viewData: DataViewDataType): string {
    const model = this._model as DocLibraryBlockModel;
    model.store.transact(() => {
      model.props.views = [...model.props.views, viewData];
    });
    return viewData.id;
  }

  viewDataDelete(viewId: string): void {
    deleteView(this._model as any, viewId);
  }

  viewDataDuplicate(id: string): string {
    return duplicateView(this._model as any, id);
  }

  viewDataGet(viewId: string): DataViewDataType | undefined {
    return this.viewDataList$.value.find(data => data.id === viewId);
  }

  viewDataMoveTo(id: string, position: any): void {
    moveViewTo(this._model as any, id, position);
  }

  viewDataUpdate(id: string, updater: any): void {
    updateView(this._model as any, id, updater);
  }

  viewMetaGet(type: string): ViewMeta {
    const view = databaseBlockViewMap[type];
    if (!view) throw new Error(`Unknown view type: ${type}`);
    return view as any;
  }

  viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) return;
    return this.viewMetaGet(view.mode);
  }

  propertyAdd(position: any, ops: any): string | undefined {
    const type = ops?.type || 'doc-metadata';
    const property = this.propertyMetaGet(type);
    if (!property) return;

    return addProperty(
      this._model as any,
      position,
      property.create(ops?.name || 'New Property')
    );
  }

  protected getNormalPropertyAndIndex(propertyId: string) {
    const model = this._model as DocLibraryBlockModel;
    const index = model?.props?.columns$?.value?.findIndex(
      v => v.id === propertyId
    );
    if (index != null && index >= 0) {
      return { column: model.props.columns$.value[index] as any, index };
    }
    return undefined;
  }
}

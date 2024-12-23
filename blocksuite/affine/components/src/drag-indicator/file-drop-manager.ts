import {
  calcDropTarget,
  type DropResult,
  getClosestBlockComponentByPoint,
  isInsidePageEditor,
  matchFlavours,
} from '@blocksuite/affine-shared/utils';
import type { BlockStdScope, EditorHost } from '@blocksuite/block-std';
import type { IVec } from '@blocksuite/global/utils';
import { Point } from '@blocksuite/global/utils';
import type { BlockModel } from '@blocksuite/store';

import type { DragIndicator } from './index.js';

export type onDropProps = {
  files: File[];
  targetModel: BlockModel | null;
  place: 'before' | 'after';
  point: IVec;
};

export type FileDropOptions = {
  flavour: string;
  onDrop?: ({ files, targetModel, place, point }: onDropProps) => boolean;
};

export class FileDropManager {
  private static _dropResult: DropResult | null = null;

  private readonly _std: BlockStdScope;

  private readonly _fileDropOptions: FileDropOptions;

  private readonly _indicator!: DragIndicator;

  private readonly _onDrop = (event: DragEvent) => {
    this._indicator.rect = null;

    const { onDrop } = this._fileDropOptions;
    if (!onDrop) return;

    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return;

    const effectAllowed = dataTransfer.effectAllowed;
    if (effectAllowed === 'none') return;

    const droppedFiles = dataTransfer.files;
    if (!droppedFiles || !droppedFiles.length) return;

    event.preventDefault();

    const { targetModel, type: place } = this;
    const { x, y } = event;

    return onDrop({
      files: [...droppedFiles],
      targetModel,
      place,
      point: [x, y],
    });
  };

  onDragLeave = () => {
    FileDropManager._dropResult = null;
    this._indicator.rect = null;
  };

  onDragOver = (event: DragEvent) => {
    event.preventDefault();

    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return;

    const effectAllowed = dataTransfer.effectAllowed;
    if (effectAllowed === 'none') return;

    const { clientX, clientY } = event;
    const point = new Point(clientX, clientY);
    const element = getClosestBlockComponentByPoint(point.clone());

    let result: DropResult | null = null;
    if (element) {
      const model = element.model;
      const parent = this.doc.getParent(model);
      if (!matchFlavours(parent, ['affine:surface' as BlockSuite.Flavour])) {
        result = calcDropTarget(point, model, element);
      }
    }
    if (result) {
      FileDropManager._dropResult = result;
      this._indicator.rect = result.rect;
    } else {
      FileDropManager._dropResult = null;
      this._indicator.rect = null;
    }
  };

  get doc() {
    return this._std.doc;
  }

  get editorHost(): EditorHost {
    return this._std.host;
  }

  get targetModel(): BlockModel | null {
    let targetModel = FileDropManager._dropResult?.modelState.model || null;

    if (!targetModel && isInsidePageEditor(this.editorHost)) {
      const rootModel = this.doc.root;
      if (!rootModel) return null;

      let lastNote = rootModel.children[rootModel.children.length - 1];
      if (!lastNote || !matchFlavours(lastNote, ['affine:note'])) {
        const newNoteId = this.doc.addBlock('affine:note', {}, rootModel.id);
        const newNote = this.doc.getBlockById(newNoteId);
        if (!newNote) return null;
        lastNote = newNote;
      }

      const lastItem = lastNote.children[lastNote.children.length - 1];
      if (lastItem) {
        targetModel = lastItem;
      } else {
        const newParagraphId = this.doc.addBlock(
          'affine:paragraph',
          {},
          lastNote,
          0
        );
        const newParagraph = this.doc.getBlockById(newParagraphId);
        if (!newParagraph) return null;
        targetModel = newParagraph;
      }
    }
    return targetModel;
  }

  get type(): 'before' | 'after' {
    return !FileDropManager._dropResult ||
      FileDropManager._dropResult.type !== 'before'
      ? 'after'
      : 'before';
  }

  constructor(std: BlockStdScope, fileDropOptions: FileDropOptions) {
    this._std = std;
    this._fileDropOptions = fileDropOptions;

    let indicator = document.querySelector<DragIndicator>(
      'affine-drag-indicator'
    );

    if (!indicator) {
      indicator = document.createElement(
        'affine-drag-indicator'
      ) as DragIndicator;
      document.body.append(indicator);
    }

    this._indicator = indicator;

    if (fileDropOptions.onDrop) {
      this._std.event.add('nativeDrop', context => {
        const event = context.get('dndState');
        this._onDrop(event.raw);
      });
    }
  }
}

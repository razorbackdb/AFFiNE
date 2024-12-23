import { FileDropConfigExtension } from '@blocksuite/affine-components/drag-indicator';
import { ImageBlockSchema } from '@blocksuite/affine-model';
import {
  DragHandleConfigExtension,
  TelemetryProvider,
} from '@blocksuite/affine-shared/services';
import {
  captureEventTarget,
  convertDragPreviewDocToEdgeless,
  convertDragPreviewEdgelessToDoc,
  isInsideEdgelessEditor,
  matchFlavours,
} from '@blocksuite/affine-shared/utils';
import { BlockService } from '@blocksuite/block-std';
import { GfxControllerIdentifier } from '@blocksuite/block-std/gfx';

import { setImageProxyMiddlewareURL } from '../_common/transformers/middlewares.js';
import { addImages } from '../root-block/edgeless/utils/common.js';
import type { ImageBlockComponent } from './image-block.js';
import { ImageEdgelessBlockComponent } from './image-edgeless-block.js';
import { addSiblingImageBlock } from './utils.js';

// bytes.parse('2GB')
const maxFileSize = 2147483648;

export class ImageBlockService extends BlockService {
  static override readonly flavour = ImageBlockSchema.model.flavour;

  static setImageProxyURL = setImageProxyMiddlewareURL;

  maxFileSize = maxFileSize;
}

export const ImageDropOption = FileDropConfigExtension({
  flavour: ImageBlockSchema.model.flavour,
  onDrop: ({ files, targetModel, place, point, std }) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return false;

    if (targetModel && !matchFlavours(targetModel, ['affine:surface'])) {
      addSiblingImageBlock(
        std.host,
        imageFiles,
        // TODO: use max file size from service
        maxFileSize,
        targetModel,
        place
      );
      return true;
    }

    if (isInsideEdgelessEditor(std.host)) {
      const gfx = std.get(GfxControllerIdentifier);
      point = gfx.viewport.toViewCoordFromClientCoord(point);
      addImages(std, files, point).catch(console.error);

      std.getOptional(TelemetryProvider)?.track('CanvasElementAdded', {
        control: 'canvas:drop',
        page: 'whiteboard editor',
        module: 'toolbar',
        segment: 'toolbar',
        type: 'image',
      });
      return true;
    }

    return false;
  },
});

export const ImageDragHandleOption = DragHandleConfigExtension({
  flavour: ImageBlockSchema.model.flavour,
  edgeless: true,
  onDragEnd: props => {
    const { state, draggingElements } = props;
    if (
      draggingElements.length !== 1 ||
      !matchFlavours(draggingElements[0].model, [
        ImageBlockSchema.model.flavour,
      ])
    )
      return false;

    const blockComponent = draggingElements[0] as ImageBlockComponent;
    const isInSurface = blockComponent instanceof ImageEdgelessBlockComponent;
    const target = captureEventTarget(state.raw.target);
    const isTargetEdgelessContainer =
      target?.classList.contains('edgeless-container');

    if (isInSurface) {
      return convertDragPreviewEdgelessToDoc({
        blockComponent,
        ...props,
      });
    } else if (isTargetEdgelessContainer) {
      return convertDragPreviewDocToEdgeless({
        blockComponent,
        cssSelector: '.drag-target',
        ...props,
      });
    }
    return false;
  },
});

import { FileDropConfigExtension } from '@blocksuite/affine-components/drag-indicator';
import { AttachmentBlockSchema } from '@blocksuite/affine-model';
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

import { EMBED_CARD_HEIGHT, EMBED_CARD_WIDTH } from '../_common/consts.js';
import { addAttachments } from '../root-block/edgeless/utils/common.js';
import type { AttachmentBlockComponent } from './attachment-block.js';
import { AttachmentEdgelessBlockComponent } from './attachment-edgeless-block.js';
import { addSiblingAttachmentBlocks } from './utils.js';

// bytes.parse('2GB')
const maxFileSize = 2147483648;

export class AttachmentBlockService extends BlockService {
  static override readonly flavour = AttachmentBlockSchema.model.flavour;

  maxFileSize = maxFileSize;
}

export const AttachmentDropOption = FileDropConfigExtension({
  flavour: AttachmentBlockSchema.model.flavour,
  onDrop: ({ files, targetModel, place, point, std }) => {
    // generic attachment block for all files except images
    const attachmentFiles = files.filter(
      file => !file.type.startsWith('image/')
    );

    if (!attachmentFiles.length) return false;

    if (targetModel && !matchFlavours(targetModel, ['affine:surface'])) {
      addSiblingAttachmentBlocks(
        std.host,
        attachmentFiles,
        // TODO: use max file size from service
        maxFileSize,
        targetModel,
        place
      ).catch(console.error);

      return true;
    }

    if (isInsideEdgelessEditor(std.host)) {
      const gfx = std.get(GfxControllerIdentifier);
      point = gfx.viewport.toViewCoordFromClientCoord(point);
      addAttachments(std, attachmentFiles, point).catch(console.error);

      std.getOptional(TelemetryProvider)?.track('CanvasElementAdded', {
        control: 'canvas:drop',
        page: 'whiteboard editor',
        module: 'toolbar',
        segment: 'toolbar',
        type: 'attachment',
      });

      return true;
    }

    return false;
  },
});

export const AttachmentDragHandleOption = DragHandleConfigExtension({
  flavour: AttachmentBlockSchema.model.flavour,
  edgeless: true,
  onDragEnd: props => {
    const { state, draggingElements, editorHost } = props;
    if (
      draggingElements.length !== 1 ||
      !matchFlavours(draggingElements[0].model, [
        AttachmentBlockSchema.model.flavour,
      ])
    )
      return false;

    const blockComponent = draggingElements[0] as
      | AttachmentBlockComponent
      | AttachmentEdgelessBlockComponent;
    const isInSurface =
      blockComponent instanceof AttachmentEdgelessBlockComponent;
    const target = captureEventTarget(state.raw.target);
    const isTargetEdgelessContainer =
      target?.classList.contains('edgeless-container');

    if (isInSurface) {
      const style = blockComponent.model.style;
      const targetStyle = style === 'cubeThick' ? 'horizontalThin' : style;
      return convertDragPreviewEdgelessToDoc({
        blockComponent,
        style: targetStyle,
        ...props,
      });
    } else if (isTargetEdgelessContainer) {
      let style = blockComponent.model.style ?? 'cubeThick';
      const embed = blockComponent.model.embed;
      if (embed) {
        style = 'cubeThick';
        editorHost.doc.updateBlock(blockComponent.model, {
          style,
          embed: false,
        });
      }

      return convertDragPreviewDocToEdgeless({
        blockComponent,
        cssSelector: '.affine-attachment-container',
        width: EMBED_CARD_WIDTH[style],
        height: EMBED_CARD_HEIGHT[style],
        ...props,
      });
    }

    return false;
  },
});

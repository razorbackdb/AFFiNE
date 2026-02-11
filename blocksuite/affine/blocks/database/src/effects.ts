import { CenterPeek } from './components/layout.js';
import { DatabaseTitle } from './components/title/index.js';
import { DatabaseBlockComponent } from './database-block.js';
import { DatabaseDndPreviewBlockComponent } from './database-dnd-preview-block.js';
import { BlockRenderer } from './detail-panel/block-renderer.js';
import { NoteRenderer } from './detail-panel/note-renderer.js';
import { CreatedTimeCell } from './properties/created-time/cell-renderer.js';
import { DocMetadataCell } from './properties/doc-metadata/cell-renderer.js';
import { DocMetadataSettingsBar } from './properties/doc-metadata/settings-bar.js';
import { DocReferenceCell } from './properties/doc-reference/cell-renderer.js';
import { LinkCell } from './properties/link/cell-renderer.js';
import { RichTextCell } from './properties/rich-text/cell-renderer.js';
import { IconCell } from './properties/title/icon.js';
import { HeaderAreaTextCell } from './properties/title/text.js';

export function effects() {
  const define = (name: string, constructor: CustomElementConstructor) => {
    if (!customElements.get(name)) {
      customElements.define(name, constructor);
    }
  };

  define('affine-database-title', DatabaseTitle);
  define('data-view-header-area-icon', IconCell);
  define('affine-database-link-cell', LinkCell);
  define('affine-database-doc-reference-cell', DocReferenceCell);
  define('affine-database-doc-metadata-cell', DocMetadataCell);
  define('affine-database-doc-metadata-settings-bar', DocMetadataSettingsBar);
  define('data-view-header-area-text', HeaderAreaTextCell);
  define('affine-database-rich-text-cell', RichTextCell);
  define('affine-database-created-time-cell', CreatedTimeCell);
  define('center-peek', CenterPeek);
  define('database-datasource-note-renderer', NoteRenderer);
  define('database-datasource-block-renderer', BlockRenderer);
  define('affine-database', DatabaseBlockComponent);

  define('affine-dnd-preview-database', DatabaseDndPreviewBlockComponent);
}

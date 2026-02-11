import { DocLibraryBlockComponent } from './doc-library-block.js';

export function effects() {
  if (!customElements.get('affine-doc-library')) {
    customElements.define('affine-doc-library', DocLibraryBlockComponent);
  }
}

import { MetadataCardSearchModal } from './modal';

export function effects() {
  if (!customElements.get('metadata-card-search-modal')) {
    customElements.define(
      'metadata-card-search-modal',
      MetadataCardSearchModal
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'metadata-card-search-modal': MetadataCardSearchModal;
  }
}

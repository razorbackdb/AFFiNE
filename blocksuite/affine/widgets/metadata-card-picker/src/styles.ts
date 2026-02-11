import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { css } from 'lit';

export const metadataCardPickerStyles = css`
  .affine-metadata-card-picker-widget {
    position: relative;
    pointer-events: none;
  }

  .input-mask {
    position: absolute;
    background: var(--affine-primary-color);
    opacity: 0.2;
    border-radius: 2px;
    pointer-events: none;
    transition: width 0.1s ease;
  }
`;

export const metadataCardModalStyles = css`
  .metadata-card-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--affine-z-index-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .metadata-card-modal {
    position: relative;
    width: 90vw;
    max-width: 560px;
    max-height: 80vh;
    background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
    border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    border-radius: 12px;
    box-shadow: var(--affine-shadow-3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .metadata-card-modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
  }

  .metadata-card-modal-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: ${unsafeCSSVarV2('layer/background/tertiary')};
    color: ${unsafeCSSVarV2('text/primary')};
  }

  .metadata-card-modal-title {
    font-size: 16px;
    font-weight: 600;
    color: ${unsafeCSSVarV2('text/primary')};
  }

  .metadata-card-modal-search {
    position: relative;
    padding: 16px 20px;
  }

  .metadata-card-modal-input {
    width: 100%;
    padding: 12px 16px;
    padding-right: 40px;
    font-size: 14px;
    border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    border-radius: 8px;
    background: ${unsafeCSSVarV2('layer/background/primary')};
    color: ${unsafeCSSVarV2('text/primary')};
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .metadata-card-modal-input:focus {
    border-color: var(--affine-primary-color);
    box-shadow: 0 0 0 3px rgba(var(--affine-primary-color-rgb), 0.1);
  }

  .metadata-card-modal-input::placeholder {
    color: ${unsafeCSSVarV2('text/placeholder')};
  }

  .metadata-card-modal-loading {
    position: absolute;
    right: 32px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border: 2px solid ${unsafeCSSVarV2('text/placeholder')};
    border-top-color: ${unsafeCSSVarV2('text/primary')};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: translateY(-50%) rotate(360deg);
    }
  }

  .metadata-card-modal-results {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: 400px;
  }

  .metadata-card-modal-list {
    padding: 8px;
  }

  .metadata-card-modal-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .metadata-card-modal-item:hover,
  .metadata-card-modal-item.selected {
    background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
  }

  .metadata-card-modal-item-image {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    background: ${unsafeCSSVarV2('layer/background/tertiary')};
    flex-shrink: 0;
  }

  .metadata-card-modal-item-image.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${unsafeCSSVarV2('text/placeholder')};
  }

  .metadata-card-modal-item-content {
    flex: 1;
    min-width: 0;
  }

  .metadata-card-modal-item-name {
    font-size: 14px;
    font-weight: 500;
    color: ${unsafeCSSVarV2('text/primary')};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metadata-card-modal-item-subtext {
    font-size: 12px;
    color: ${unsafeCSSVarV2('text/placeholder')};
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metadata-card-modal-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: ${unsafeCSSVarV2('text/placeholder')};
    font-size: 14px;
  }

  .metadata-card-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
  }

  .metadata-card-modal-button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .metadata-card-modal-button.cancel {
    background: ${unsafeCSSVarV2('layer/background/tertiary')};
    color: ${unsafeCSSVarV2('text/primary')};
  }

  .metadata-card-modal-button.cancel:hover {
    background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
  }

  .metadata-card-modal-button.confirm {
    background: var(--affine-primary-color);
    color: white;
  }

  .metadata-card-modal-button.confirm:hover {
    opacity: 0.9;
  }

  .metadata-card-modal-button.retry {
    background: var(--affine-primary-color);
    color: white;
    margin-top: 8px;
  }

  .metadata-card-modal-button.retry:hover {
    opacity: 0.9;
  }
`;

import { cssVarV2 } from '@blocksuite/affine-shared/theme';
import { css } from '@emotion/css';

export const docReferenceCellStyle = css({
  width: '100%',
  height: '100%',
  userSelect: 'none',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: '8px',
  cursor: 'pointer',
  ':hover': {
    backgroundColor: cssVarV2.layer.background.hoverOverlay,
  },
});

export const docReferenceIconStyle = css({
  display: 'flex',
  width: '16px',
  height: '16px',
  justifyContent: 'center',
  alignItems: 'center',
  color: cssVarV2.icon.primary,
  flexShrink: 0,
  'img, svg': {
    width: '16px',
    height: '16px',
  },
});

export const docReferenceTitleStyle = css({
  flexGrow: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'var(--data-view-cell-text-size)',
  color: cssVarV2.text.primary,
});

export const docReferencePlaceholderStyle = css({
  color: cssVarV2.text.placeholder,
  fontSize: 'var(--data-view-cell-text-size)',
});

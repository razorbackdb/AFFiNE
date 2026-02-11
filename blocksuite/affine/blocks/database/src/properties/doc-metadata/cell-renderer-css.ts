import { cssVarV2 } from '@blocksuite/affine-shared/theme';
import { css } from '@emotion/css';

export const docMetadataCellStyle = css({
  width: '100%',
  height: '100%',
  userSelect: 'none',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: '4px',
});

export const docMetadataValueStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'var(--data-view-cell-text-size)',
  color: cssVarV2.text.primary,
});

export const ratingStarsStyle = css({
  display: 'flex',
  alignItems: 'center',
  color: '#f59e0b',
  fontSize: '14px',
});

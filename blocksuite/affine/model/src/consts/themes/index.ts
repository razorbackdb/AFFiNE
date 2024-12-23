import { DefaultTheme } from './default.js';
import type { Theme } from './types.js';

export { DefaultTheme } from './default.js';
export * from './types.js';

export const Themes: Record<string, Theme> = {
  default: DefaultTheme,
};

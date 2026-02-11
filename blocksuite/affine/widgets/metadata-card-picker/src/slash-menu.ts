import { SlashMenuConfigIdentifier } from '@blocksuite/affine-widget-slash-menu';
import {
  BookPanelIcon,
  GamePanelIcon,
  HeadphonePanelIcon,
  MoviePanelIcon,
} from '@blocksuite/icons/lit';
import { type BlockStdScope } from '@blocksuite/std';
import { type BlockModel, type ExtensionType } from '@blocksuite/store';
import { type TemplateResult } from 'lit';

import type { MediaType } from './config';
import { toggleMetadataCardSearchModal } from './modal';

/**
 * Create a slash menu config item for a specific media type
 */
function createMediaSlashMenuItem(mediaType: MediaType) {
  const icons: Record<MediaType, TemplateResult> = {
    movie: MoviePanelIcon(),
    tv: MoviePanelIcon(),
    game: GamePanelIcon(),
    music: HeadphonePanelIcon(),
    book: BookPanelIcon(),
  };

  const names: Record<MediaType, string> = {
    movie: 'Movie',
    tv: 'TV Show',
    game: 'Game',
    music: 'Music',
    book: 'Book',
  };

  const descriptions: Record<MediaType, string> = {
    movie: 'Search and insert a movie link',
    tv: 'Search and insert a TV show link',
    game: 'Search and insert a game link',
    music: 'Search and insert a music link',
    book: 'Search and insert a book link',
  };

  return {
    name: names[mediaType],
    icon: icons[mediaType],
    description: descriptions[mediaType],
    group: '7_Media@0' as const,
    action: ({ std, model }: { std: BlockStdScope; model: BlockModel }) => {
      const { host } = std;
      const parentModel = host.store.getParent(model);
      if (!parentModel) {
        return;
      }
      const index = parentModel.children.indexOf(model) + 1;

      toggleMetadataCardSearchModal(host, mediaType, {
        mode: 'page',
        parentModel,
        index,
      })
        .then(() => {
          // Clean up empty placeholder block where slash command was triggered
          if (model.text?.length === 0) {
            host.store.deleteBlock(model);
          }
        })
        .catch(console.error);
    },
  };
}

/**
 * Slash menu config for media mentions
 */
export const mediaMentionsSlashMenuConfig = {
  items: [
    createMediaSlashMenuItem('movie'),
    createMediaSlashMenuItem('tv'),
    createMediaSlashMenuItem('game'),
    createMediaSlashMenuItem('music'),
    createMediaSlashMenuItem('book'),
  ],
};

/**
 * DI extension factory for the media mentions slash menu config
 */
export function MediaMentionsSlashMenuConfigExtension(): ExtensionType {
  return {
    setup(di) {
      // Use override to avoid duplicate registration errors
      di.override(
        SlashMenuConfigIdentifier('media-mentions'),
        mediaMentionsSlashMenuConfig
      );
    },
  };
}

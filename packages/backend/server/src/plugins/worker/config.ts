import { defineModuleConfig } from '../../base';

export interface WorkerStartupConfigurations {
  allowedOrigin: string[];
}

declare global {
  interface AppConfigSchema {
    worker: {
      allowedOrigin: ConfigItem<string[]>;
      tmdbApiKey: ConfigItem<string>;
      rawgApiKey: ConfigItem<string>;
      googleBooksApiKey: ConfigItem<string>;
      lastfmApiKey: ConfigItem<string>;
    };
  }
}

defineModuleConfig('worker', {
  allowedOrigin: {
    desc: 'Allowed origin',
    default: ['localhost', '127.0.0.1'],
  },
  tmdbApiKey: {
    desc: 'TMDB API key',
    default: '',
    env: 'AFFINE_TMDB_API_KEY',
  },
  rawgApiKey: {
    desc: 'RAWG API key',
    default: '',
    env: 'AFFINE_RAWG_API_KEY',
  },
  googleBooksApiKey: {
    desc: 'Google Books API key',
    default: '',
    env: 'AFFINE_GOOGLE_BOOKS_API_KEY',
  },
  lastfmApiKey: {
    desc: 'LastFM API key',
    default: '',
    env: 'AFFINE_LASTFM_API_KEY',
  },
});

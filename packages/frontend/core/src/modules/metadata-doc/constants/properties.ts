import type { WorkspacePropertyType } from '@affine/core/modules/workspace-property';
import type { MediaType } from '@blocksuite/affine-shared/services';

export interface MetadataPropertyDefinition {
  id: string;
  name: string;
  type: WorkspacePropertyType;
  getValue: (metadata: any) => string | undefined;
}

export const METADATA_PROPERTIES: Record<
  MediaType,
  MetadataPropertyDefinition[]
> = {
  movie: [
    {
      id: 'meta:rating',
      name: 'Rating',
      type: 'number',
      getValue: meta => meta.rating?.toString(),
    },
    {
      id: 'meta:release_date',
      name: 'Release Date',
      type: 'date',
      getValue: meta => meta.releaseDate,
    },
    {
      id: 'meta:runtime',
      name: 'Runtime (min)',
      type: 'number',
      getValue: meta => meta.runtime?.toString(),
    },
    {
      id: 'meta:genres',
      name: 'Genres',
      type: 'text',
      getValue: meta => meta.genres?.join(', '),
    },
  ],
  tv: [
    {
      id: 'meta:rating',
      name: 'Rating',
      type: 'number',
      getValue: meta => meta.rating?.toString(),
    },
    {
      id: 'meta:release_date',
      name: 'First Air Date',
      type: 'date',
      getValue: meta => meta.releaseDate,
    },
    {
      id: 'meta:genres',
      name: 'Genres',
      type: 'text',
      getValue: meta => meta.genres?.join(', '),
    },
  ],
  book: [
    {
      id: 'meta:authors',
      name: 'Author(s)',
      type: 'text',
      getValue: meta => meta.authors?.join(', '),
    },
    {
      id: 'meta:publisher',
      name: 'Publisher',
      type: 'text',
      getValue: meta => meta.publisher,
    },
    {
      id: 'meta:publish_date',
      name: 'Publish Date',
      type: 'date',
      getValue: meta => meta.publishDate,
    },
    {
      id: 'meta:isbn',
      name: 'ISBN',
      type: 'text',
      getValue: meta => meta.isbn,
    },
    {
      id: 'meta:page_count',
      name: 'Page Count',
      type: 'number',
      getValue: meta => meta.pageCount?.toString(),
    },
  ],
  game: [
    {
      id: 'meta:rating',
      name: 'Rating',
      type: 'number',
      getValue: meta => meta.rating?.toString(),
    },
    {
      id: 'meta:release_date',
      name: 'Release Date',
      type: 'date',
      getValue: meta => meta.releaseDate,
    },
    {
      id: 'meta:developers',
      name: 'Developer(s)',
      type: 'text',
      getValue: meta => meta.developers?.join(', '),
    },
    {
      id: 'meta:platforms',
      name: 'Platforms',
      type: 'text',
      getValue: meta => meta.platforms?.join(', '),
    },
  ],
  music: [
    {
      id: 'meta:artist',
      name: 'Artist',
      type: 'text',
      getValue: meta => meta.artist,
    },
    {
      id: 'meta:album',
      name: 'Album',
      type: 'text',
      getValue: meta => meta.album,
    },
    {
      id: 'meta:release_date',
      name: 'Release Date',
      type: 'date',
      getValue: meta => meta.releaseDate,
    },
    {
      id: 'meta:genre',
      name: 'Genre',
      type: 'text',
      getValue: meta => meta.genre,
    },
  ],
};

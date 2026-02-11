import {
  BookPanelIcon,
  GamePanelIcon,
  HeadphonePanelIcon,
  MoviePanelIcon,
} from '@blocksuite/icons/lit';
import { type TemplateResult } from 'lit';

function iconBuilder(
  icon: typeof MoviePanelIcon,
  size = '1.25em',
  style = 'user-select:none;flex-shrink:0;vertical-align:middle;font-size:inherit;'
) {
  return icon({ width: size, height: size, style });
}

export interface MetadataFieldConfig {
  key: string;
  label: string;
  /**
   * Optional formatter for the value.
   * Receives the specific value and the entire properties object.
   */
  formatter?: (
    value: any,
    props: Record<string, any>
  ) => string | number | null;
}

export interface MetadataTypeDefinition {
  label: string;
  icon: TemplateResult;
  secondaryField?: MetadataFieldConfig;
  extraFields: MetadataFieldConfig[];
}

const formatDateYear = (dateStr: any) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  return isNaN(y) ? null : y.toString();
};

const formatArrayFirst = (val: any) => {
  if (Array.isArray(val)) return val[0];
  return val;
};

export const METADATA_CONFIG: Record<string, MetadataTypeDefinition> = {
  movie: {
    label: 'Movie',
    icon: iconBuilder(MoviePanelIcon),
    secondaryField: {
      key: 'releaseDate',
      label: 'Year',
      formatter: formatDateYear,
    },
    extraFields: [
      { key: 'genres', label: 'Genre', formatter: formatArrayFirst },
    ],
  },
  tv: {
    label: 'TV Series',
    icon: iconBuilder(MoviePanelIcon),
    secondaryField: {
      key: 'releaseDate',
      label: 'Year',
      formatter: formatDateYear,
    },
    extraFields: [
      { key: 'genres', label: 'Genre', formatter: formatArrayFirst },
    ],
  },
  game: {
    label: 'Game',
    icon: iconBuilder(GamePanelIcon),
    secondaryField: {
      key: 'developers',
      label: 'Developer',
      formatter: formatArrayFirst,
    },
    extraFields: [
      { key: 'genres', label: 'Genre', formatter: formatArrayFirst },
    ],
  },
  music: {
    label: 'Music',
    icon: iconBuilder(HeadphonePanelIcon),
    secondaryField: {
      key: 'artist',
      label: 'Artist',
      // Fallback to album if artist is missing
      formatter: (val: any, props: any) => val || props.album || null,
    },
    extraFields: [],
  },
  book: {
    label: 'Book',
    icon: iconBuilder(BookPanelIcon),
    secondaryField: {
      key: 'authors',
      label: 'Author',
      formatter: formatArrayFirst,
    },
    extraFields: [{ key: 'pageCount', label: 'Pages' }],
  },
};

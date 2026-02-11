import type { AffineTextAttributes } from '@blocksuite/affine-shared/types';
import { StdIdentifier } from '@blocksuite/std';
import { InlineSpecExtension } from '@blocksuite/std/inline';
import { html } from 'lit';
import { z } from 'zod';

/**
 * Inline spec extension for metadata-doc references.
 *
 * This extends the existing reference inline spec to handle the 'MetadataDoc' type.
 * MetadataDoc references point to documents that were created from metadata cards
 * (movies, TV shows, games, music, books).
 *
 * The spec registers the affine-reference element for rendering MetadataDoc references,
 * and the reference node component handles displaying the appropriate media-type icon
 * by fetching the mediaType from doc properties.
 *
 * Note: The reference inline spec schema is updated separately to include MetadataDoc
 * in the type enum. This spec specifically targets MetadataDoc type references.
 */
export const MetadataDocReferenceInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>(
    'metadata-doc-reference',
    provider => {
      const std = provider.get(StdIdentifier);

      return {
        name: 'metadata-doc-reference',
        schema: z.object({
          reference: z
            .object({
              type: z.literal('MetadataDoc'),
            })
            .optional()
            .nullable()
            .catch(undefined),
        }),
        match: delta => {
          // Match MetadataDoc type references
          // Use type assertion since we're checking the actual value
          const refType = (delta.attributes?.reference as any)?.type;
          return refType === 'MetadataDoc';
        },
        renderer: ({ delta, selected }) => {
          // Use the existing affine-reference component
          // The component will handle icon display based on the doc's mediaType property
          return html`<affine-reference
            .std=${std}
            .delta=${delta}
            .selected=${selected}
          ></affine-reference>`;
        },
        embed: true,
      };
    }
  );

import { createIdentifier } from '@blocksuite/global/di';

import type { MediaType } from '../metadata-service/types';

/**
 * Types for metadata card data and conversion results
 * These are defined here to avoid importing from @affine/core
 * Note: The actual service in @affine/core provides a richer PromoteResult type
 * with additional fields (doc, isNew). This simplified version is for
 * BlockSuite components that only need the basic information.
 */
export interface MetadataCardData {
  type: MediaType;
  id: string;
  title: string;
}

export interface PromoteResult {
  docId?: string;
  success?: boolean;
  error?: string;
  // Additional fields from the actual service are available at runtime
  doc?: any;
  isNew?: boolean;
}

/**
 * Interface for the metadata doc conversion provider
 * This allows BlockSuite components to interact with the frontend metadata doc services
 */
export interface MetadataDocConversionProvider {
  /**
   * Promote a metadata card to a full document
   */
  promoteToDoc(
    cardData: MetadataCardData,
    metadata: any // MediaMetadata from metadata-service
  ): Promise<PromoteResult>;
}

/**
 * Extension identifier for the metadata doc conversion service
 * BlockSuite components use this to get the service from the DI container
 */
export const MetadataDocConversionIdentifier =
  createIdentifier<MetadataDocConversionProvider>(
    'MetadataDocConversionService'
  );

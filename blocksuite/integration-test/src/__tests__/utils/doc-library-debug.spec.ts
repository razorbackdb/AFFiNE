import { DocLibraryDataSource } from '@blocksuite/affine-block-doc-library';
import { DocPropertiesProviderIdentifier } from '@blocksuite/affine-shared/services';
import { describe, expect, test, vi } from 'vitest';

describe('Doc Library Debug', () => {
  test('should retrieve properties from provider', async () => {
    const mockProvider = {
      getDocProperties: vi.fn(),
      watchDocProperties$: vi.fn().mockReturnValue({
        value: {
          'meta:platforms': ['PC', 'Xbox'],
          title: 'Test Game',
        },
      }),
      watchPropertyAllValues$: vi.fn(),
    };

    const mockHost = {
      std: {
        getOptional: (id: any) => {
          if (id === DocPropertiesProviderIdentifier) return mockProvider;
          return null;
        },
      },
    };

    // Mock Model
    const mockModel = {
      props: {
        columns$: {
          value: [
            {
              id: 'platforms',
              type: 'doc-metadata',
              data: { metadataKey: 'platforms' },
            },
            { id: 'link', type: 'custom-link' },
          ],
        },
        source$: { value: { docType: 'metadata-doc', mediaType: 'game' } },
      },
      doc: {
        get: () => ({ getOptional: mockHost.std.getOptional }), // Simplified Std
      },
    };

    const dataSource = new DocLibraryDataSource(mockModel as any);
    // Inject serviceGet mock
    dataSource.serviceGet = ((id: any) => {
      if (id === 'editor-host') return mockHost;
      return null;
    }) as any;

    const rowId = 'test-doc-id';

    // Test Array fallback
    const platforms = dataSource.cellValueGet(rowId, 'platforms');
    console.log('Platforms Result:', platforms);
    expect(platforms).toBe('PC, Xbox');

    // Test Link
    const link = dataSource.cellValueGet(rowId, 'link');
    console.log('Link Result:', link);
    expect(link).toBe(rowId);
  });
});

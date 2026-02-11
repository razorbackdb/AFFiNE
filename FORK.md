# AFFiNE Razor Fork Documentation

This document describes the custom features and architectural changes introduced in this fork of AFFiNE.

## Key Custom Features

### 1. Metadata Document Linking

Integrated a "Search -> Create Doc -> Link" workflow for external media (movies, TV shows, books, games, music).

- **Workflow**:
  - Use slash commands (e.g., `/movie`, `/book`) or the `@@` trigger.
  - Search for media using external APIs (TMDB, Open Library, etc.).
  - Selecting a result immediately creates a rich metadata document in the workspace.
  - An inline reference link (mention) is inserted into the current page with a media-type-specific icon.
- **Architecture**:
  - **MetadataService**: Core service in `blocksuite` shared services that orchestrates various media adapters.
  - **MetadataDoc Module**: Frontend module in `packages/frontend/core/src/modules/metadata-doc` that handles the conversion of search results into full documents.
  - **Atomic Initialization**: Uses `onStoreLoad` in `createDoc` (via `docProps`) to ensure all metadata blocks (images, descriptions, details) are created in a single transaction during document creation.
  - **Reference Rendering**: Custom inline spec in `blocksuite` that renders `MetadataDoc` type references with icons based on the document's `mediaType` property.

### 2. Document-Type-Specific Properties

Extended the workspace property system to support context-aware property visibility.

- **Visibility Filter**: Properties now support a `visibilityFilter` (added to `docCustomPropertyInfo` schema) which scopes them to specific `docType` or `mediaType`.
- **Filtered UI**: The `WorkspacePropertiesTable` automatically filters the list of properties based on the current document's metadata.
  - Example: "ISBN" only appears on Book documents; "Rating" only appears on media documents.
- **Automatic Provisioning**: The `MetadataDocConversionService` automatically creates and populates these workspace properties when a new media document is created.

## Configuration & Environment

### External API Keys

The following environment variables are supported for media metadata fetching:

- `AFFINE_TMDB_API_KEY`: API key for The Movie Database (TMDB).

These are baked into the build via `tools/utils/src/build-config.ts`.

## Development Best Practices (Fork-Specific)

- **DI Dependency Ordering**: When adding new services to an AFFiNE module, ensure the order in the `.service(Service, [Deps...])` array exactly matches the class constructor.
- **Asynchronous Asset Handling**: Always fetch and save external images to the workspace `blobSync` before creating the `affine:image` block to ensure valid local references.
- **Defensive Property Access**: Use `std.getOptional(Identifier)` in BlockSuite components to avoid crashes in contexts where specific extensions might not be loaded.

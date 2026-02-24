import { jest } from "@jest/globals";

// Preserve existing test style during the ESM migration.
(globalThis as { jest?: typeof jest }).jest = jest;

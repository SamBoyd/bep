import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findNearestClaudeDir } from "../../src/hooks/discovery";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-hook-discovery-test-"));
}

describe("findNearestClaudeDir", () => {
  test("finds nearest .claude while walking upward", async () => {
    const tempDir = await createTempDir();

    try {
      const rootClaude = path.join(tempDir, ".claude");
      const nested = path.join(tempDir, "apps", "web", "feature");
      await mkdir(rootClaude, { recursive: true });
      await mkdir(nested, { recursive: true });

      const found = await findNearestClaudeDir(nested);
      expect(found).toBe(rootClaude);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns null when no .claude directory exists", async () => {
    const tempDir = await createTempDir();

    try {
      const nested = path.join(tempDir, "services", "api");
      await mkdir(nested, { recursive: true });

      const found = await findNearestClaudeDir(nested);
      expect(found).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

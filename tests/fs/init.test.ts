import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BETS_DIR, EVIDENCE_DIR, LOGS_DIR, STATE_PATH, initRepo } from "../../src/fs/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-init-test-"));
}

describe("initRepo", () => {
  test("creates expected BEP directories and state file", async () => {
    const tempDir = await createTempDir();

    try {
      const result = await initRepo(tempDir);

      expect(result.alreadyInitialized).toBe(false);
      expect(result.createdPaths).toEqual(expect.arrayContaining([BETS_DIR, LOGS_DIR, EVIDENCE_DIR, STATE_PATH]));

      const stateFile = await readFile(path.join(tempDir, STATE_PATH), "utf8");
      expect(JSON.parse(stateFile)).toEqual({ active: null });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("is idempotent and does not overwrite existing state", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      const existingState = { active: { id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" } };
      await writeFile(path.join(tempDir, STATE_PATH), `${JSON.stringify(existingState, null, 2)}\n`, "utf8");

      const result = await initRepo(tempDir);
      const persisted = await readFile(path.join(tempDir, STATE_PATH), "utf8");

      expect(result.alreadyInitialized).toBe(true);
      expect(result.createdPaths).toHaveLength(0);
      expect(JSON.parse(persisted)).toEqual(existingState);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

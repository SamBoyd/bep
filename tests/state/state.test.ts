import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { STATE_PATH } from "../../src/fs/init.js";
import { initRepo } from "../../src/fs/init.js";
import { addActiveSession, readState, removeActiveSessions, writeState } from "../../src/state/state.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-state-test-"));
}

describe("state module", () => {
  test("reads and writes valid state schema", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      const initial = {
        active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }],
      };

      await writeFile(path.join(tempDir, STATE_PATH), `${JSON.stringify(initial, null, 2)}\n`, "utf8");

      const parsed = await readState(tempDir);
      expect(parsed).toEqual(initial);

      const next = {
        active: [...parsed.active, { id: "pricing-page", started_at: "2026-02-18T01:00:00.000Z" }],
      };

      await writeState(tempDir, next);

      const persisted = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));
      expect(persisted).toEqual(next);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects non-array active schema", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(path.join(tempDir, STATE_PATH), JSON.stringify({ active: null }), "utf8");

      await expect(readState(tempDir)).rejects.toThrow("State file field 'active' must be an array.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("dedupes active sessions by id", () => {
    const initial = {
      active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }],
    };

    const duplicate = addActiveSession(initial, "landing-page", "2026-02-18T01:00:00.000Z");
    expect(duplicate.alreadyActive).toBe(true);
    expect(duplicate.state).toEqual(initial);

    const added = addActiveSession(initial, "pricing-page", "2026-02-18T01:00:00.000Z");
    expect(added.alreadyActive).toBe(false);
    expect(added.state.active).toHaveLength(2);
    expect(added.state.active[1]).toEqual({ id: "pricing-page", started_at: "2026-02-18T01:00:00.000Z" });
  });

  test("removes all active sessions for an id", () => {
    const initial = {
      active: [
        { id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" },
        { id: "landing-page", started_at: "2026-02-18T01:00:00.000Z" },
        { id: "pricing-page", started_at: "2026-02-18T02:00:00.000Z" },
      ],
    };

    const removed = removeActiveSessions(initial, "landing-page");
    expect(removed.removed).toHaveLength(2);
    expect(removed.state.active).toEqual([{ id: "pricing-page", started_at: "2026-02-18T02:00:00.000Z" }]);
  });
});

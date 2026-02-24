import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildBetSelectionContext } from "../../src/tracking/context.js";
import { BETS_DIR, LOGS_DIR, STATE_PATH, initRepo } from "../../src/fs/init.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-tracking-context-test-"));
}

describe("buildBetSelectionContext", () => {
  test("builds catalog, active bets, and recent attribution", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n\n## 1. Primary Assumption\nUsers want this.\n\n## 2. Rationale\nFast validation.\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-20T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"),
        `${JSON.stringify({ at: "2026-02-20T00:01:00.000Z", decision: { action: "start", bet_id: "landing-page" } })}\n`,
        "utf8",
      );

      const context = await buildBetSelectionContext(tempDir, "user-prompt-submit", null);

      expect(context.activeBetIds).toEqual(["landing-page"]);
      expect(context.bets).toHaveLength(1);
      expect(context.bets[0].id).toBe("landing-page");
      expect(context.recentAttribution).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("skips malformed bet files without throwing", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(path.join(tempDir, BETS_DIR, "broken.md"), "---\nthis: [", "utf8");

      const context = await buildBetSelectionContext(tempDir, "post-tool-use", null);
      expect(context.bets).toEqual([]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

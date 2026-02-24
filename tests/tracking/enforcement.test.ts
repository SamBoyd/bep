import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateCapGate } from "../../src/tracking/enforcement.js";
import type { SelectionContext, SelectionDecision } from "../../src/tracking/types.js";
import { BETS_DIR, LOGS_DIR, initRepo } from "../../src/fs/init.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-enforcement-test-"));
}

const baseContext: SelectionContext = {
  event: "user-prompt-submit",
  payload: null,
  activeBetIds: ["landing-page"],
  bets: [{ id: "landing-page", status: "pending", summary: "x" }],
  recentAttribution: [],
};

const baseDecision: SelectionDecision = {
  action: "start",
  bet_id: "landing-page",
  confidence: 0.95,
  reason: "match",
};

describe("evaluateCapGate", () => {
  test("max_hours under cap is not blocked", async () => {
    const tempDir = await createTempDir();
    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-20T00:00:00.000Z\nmax_hours: 10\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `${JSON.stringify({ duration_seconds: 3600 })}\n`, "utf8");

      const result = await evaluateCapGate(tempDir, baseContext, baseDecision);
      expect(result.overCap).toBe(false);
      expect(result.reason).toBe("under_cap");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("skips cap enforcement when bet status is passed", async () => {
    const tempDir = await createTempDir();
    const context: SelectionContext = {
      ...baseContext,
      bets: [{ id: "landing-page", status: "passed", summary: "x" }],
    };

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: passed\ndefault_action: kill\ncreated_at: 2026-02-20T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, LOGS_DIR, "landing-page.jsonl"),
        `${JSON.stringify({ duration_seconds: 3600 })}\n`,
        "utf8",
      );

      const result = await evaluateCapGate(tempDir, context, baseDecision);
      expect(result.overCap).toBe(false);
      expect(result.reason).toBe("bet_passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("max_hours at cap is blocked", async () => {
    const tempDir = await createTempDir();
    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-20T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `${JSON.stringify({ duration_seconds: 3600 })}\n`, "utf8");

      const result = await evaluateCapGate(tempDir, baseContext, baseDecision);
      expect(result.overCap).toBe(true);
      expect(result.reason).toBe("at_or_over_cap");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("max_calendar_days at/over cap is blocked", async () => {
    const tempDir = await createTempDir();
    const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: ${createdAt}\nmax_calendar_days: 1\n---\n`,
        "utf8",
      );

      const result = await evaluateCapGate(tempDir, baseContext, baseDecision);
      expect(result.overCap).toBe(true);
      expect(result.capType).toBe("max_calendar_days");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("no cap configured is not blocked", async () => {
    const tempDir = await createTempDir();
    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-20T00:00:00.000Z\n---\n`,
        "utf8",
      );

      const result = await evaluateCapGate(tempDir, baseContext, baseDecision);
      expect(result.overCap).toBe(false);
      expect(result.reason).toBe("no_cap_configured");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("malformed log data fails open", async () => {
    const tempDir = await createTempDir();
    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-20T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `not-json\n`, "utf8");

      const result = await evaluateCapGate(tempDir, baseContext, baseDecision);
      expect(result.overCap).toBe(false);
      expect(result.reason).toContain("cap_eval_failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

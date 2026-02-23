import { access, appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runHook } from "../../src/commands/hook";
import { BETS_DIR, LOGS_DIR, initRepo } from "../../src/fs/init";
import type { SelectionContext, SelectionResult } from "../../src/tracking/types";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-hook-command-test-"));
}

describe("runHook", () => {
  test("applies confident start decision and writes logs", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n\n# Budgeted Engineering Proposal\n`,
        "utf8",
      );

      const exitCode = await runHook("claude-code", "user-prompt-submit", {
        readInput: async () => JSON.stringify({ session_id: "s1", prompt: "work on landing" }),
        select: async (_context, options): Promise<SelectionResult> => {
          if (options && typeof options === "object" && "debugLogPath" in options && options.debugLogPath) {
            await appendFile(options.debugLogPath, `${JSON.stringify({ stage: "test_select" })}\n`, "utf8");
          }
          return {
            ok: true,
            rawText: "",
            decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
          };
        },
        apply: async (_context: SelectionContext, decision) => ({
          applied: true,
          appliedSteps: [`start:${decision.bet_id}`],
          decision,
        }),
        append: appendFile,
      });

      const sessionLogRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-sessions.jsonl"), "utf8");
      const attributionRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"), "utf8");
      const debugRaw = await readFile(path.join(tempDir, LOGS_DIR, "hook_debug.log"), "utf8");

      const sessionEntry = JSON.parse(sessionLogRaw.trim());
      const attributionEntry = JSON.parse(attributionRaw.trim());

      expect(exitCode).toBe(0);
      expect(sessionEntry.bet_id).toBe("landing-page");
      expect(sessionEntry.applied).toBe(true);
      expect(attributionEntry.applied_steps).toEqual(["start:landing-page"]);
      expect(debugRaw).toContain("\"stage\":\"test_select\"");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("no-ops and logs uncertainty when decision is none", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);

      const exitCode = await runHook("claude-code", "post-tool-use", {
        readInput: async () => JSON.stringify({ session_id: "s2", tool_name: "Edit" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: { action: "none", confidence: 0.4, reason: "ambiguous" },
        }),
        apply: async (_context: SelectionContext, decision) => ({
          applied: false,
          appliedSteps: [],
          decision,
        }),
        append: appendFile,
      });

      const attributionRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"), "utf8");
      const attributionEntry = JSON.parse(attributionRaw.trim());

      expect(exitCode).toBe(0);
      expect(attributionEntry.applied).toBe(false);
      expect(attributionEntry.decision.action).toBe("none");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns success and logs selector failure as non-blocking", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const exitCode = await runHook("claude-code", "post-tool-use-failure", {
        readInput: async () => "",
        select: async (): Promise<SelectionResult> => ({ ok: false, error: "claude missing" }),
        apply: async () => {
          throw new Error("should not run");
        },
        append: appendFile,
      });

      const attributionRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"), "utf8");
      const attributionEntry = JSON.parse(attributionRaw.trim());

      expect(exitCode).toBe(0);
      expect(attributionEntry.error).toContain("claude missing");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("records switch decision application steps", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const exitCode = await runHook("claude-code", "post-tool-use", {
        readInput: async () => JSON.stringify({ session_id: "s3", tool_name: "Edit" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: {
            action: "switch",
            bet_id: "onboarding-v2",
            stop_bet_id: "landing-page",
            confidence: 0.92,
            reason: "context shift",
          },
        }),
        apply: async (_context: SelectionContext, decision) => ({
          applied: true,
          appliedSteps: ["stop:landing-page", "start:onboarding-v2"],
          decision,
        }),
        append: appendFile,
      });

      const attributionRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"), "utf8");
      const attributionEntry = JSON.parse(attributionRaw.trim());

      expect(exitCode).toBe(0);
      expect(attributionEntry.decision.action).toBe("switch");
      expect(attributionEntry.applied_steps).toEqual(["stop:landing-page", "start:onboarding-v2"]);
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns success without writing when repo is not initialized", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      const exitCode = await runHook("claude-code", "session-end");
      expect(exitCode).toBe(0);
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("applies session-end stop decision for inferred/current bet", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const exitCode = await runHook("claude-code", "session-end", {
        readInput: async () => JSON.stringify({ session_id: "s-end" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: {
            action: "stop",
            bet_id: "landing-page",
            confidence: 0.94,
            reason: "session ended",
          },
        }),
        apply: async (_context: SelectionContext, decision) => ({
          applied: true,
          appliedSteps: [`stop:${decision.bet_id}`],
          decision,
        }),
        append: appendFile,
      });

      const attributionRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-attribution.jsonl"), "utf8");
      const attributionEntry = JSON.parse(attributionRaw.trim());

      expect(exitCode).toBe(0);
      expect(attributionEntry.decision.action).toBe("stop");
      expect(attributionEntry.applied).toBe(true);
      expect(attributionEntry.applied_steps).toEqual(["stop:landing-page"]);
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects unsupported hook events", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runHook("claude-code", "session-start");
      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unsupported hook event"));
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("hard-denies user-prompt-submit when attributed bet is at cap", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const output: string[] = [];

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `${JSON.stringify({ duration_seconds: 3600 })}\n`, "utf8");

      const applySpy = jest.fn().mockResolvedValue({
        applied: true,
        appliedSteps: ["start:landing-page"],
        decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
      });

      const exitCode = await runHook("claude-code", "user-prompt-submit", {
        readInput: async () => JSON.stringify({ session_id: "s-block" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
        }),
        apply: applySpy,
        append: appendFile,
        writeOutput: (value: string) => {
          output.push(value);
        },
      });

      const blockRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-blocks.jsonl"), "utf8");
      const blockEntry = JSON.parse(blockRaw.trim());

      expect(exitCode).toBe(0);
      expect(applySpy).not.toHaveBeenCalled();
      expect(blockEntry.enforced).toBe(true);
      expect(output[0]).toContain("\"continue\":false");
      expect(output[0]).toContain("at cap");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("does not deny user-prompt-submit when attributed bet is passed (even if at cap)", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const output: string[] = [];

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: passed\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, LOGS_DIR, "landing-page.jsonl"),
        `${JSON.stringify({ duration_seconds: 3600 })}\n`,
        "utf8",
      );

      const applySpy = jest.fn().mockResolvedValue({
        applied: true,
        appliedSteps: ["start:landing-page"],
        decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
      });

      const exitCode = await runHook("claude-code", "user-prompt-submit", {
        readInput: async () => JSON.stringify({ session_id: "s-passed" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
        }),
        apply: applySpy,
        append: appendFile,
        writeOutput: (value: string) => {
          output.push(value);
        },
      });

      expect(exitCode).toBe(0);
      expect(applySpy).toHaveBeenCalled();
      expect(output[0]).toBe("{\"continue\":true}");
      await expect(access(path.join(tempDir, LOGS_DIR, "agent-blocks.jsonl"))).rejects.toThrow();
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("logs over-cap on non-prompt events but continues apply", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const output: string[] = [];

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 1\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `${JSON.stringify({ duration_seconds: 3600 })}\n`, "utf8");

      const applySpy = jest.fn().mockResolvedValue({
        applied: true,
        appliedSteps: ["keep"],
        decision: { action: "keep", bet_id: "landing-page", confidence: 0.95, reason: "match" },
      });

      const exitCode = await runHook("claude-code", "post-tool-use", {
        readInput: async () => JSON.stringify({ session_id: "s-nonprompt" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: { action: "keep", bet_id: "landing-page", confidence: 0.95, reason: "match" },
        }),
        apply: applySpy,
        append: appendFile,
        writeOutput: (value: string) => {
          output.push(value);
        },
      });

      const blockRaw = await readFile(path.join(tempDir, LOGS_DIR, "agent-blocks.jsonl"), "utf8");
      const blockEntry = JSON.parse(blockRaw.trim());

      expect(exitCode).toBe(0);
      expect(applySpy).toHaveBeenCalled();
      expect(blockEntry.enforced).toBe(false);
      expect(output[0]).toBe("{\"continue\":true}");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("emits allow response for below-cap user-prompt-submit", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const output: string[] = [];

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        `---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 10\n---\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), `${JSON.stringify({ duration_seconds: 1800 })}\n`, "utf8");

      const applySpy = jest.fn().mockResolvedValue({
        applied: true,
        appliedSteps: ["start:landing-page"],
        decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
      });

      const exitCode = await runHook("claude-code", "user-prompt-submit", {
        readInput: async () => JSON.stringify({ session_id: "s-allow" }),
        select: async (): Promise<SelectionResult> => ({
          ok: true,
          rawText: "",
          decision: { action: "start", bet_id: "landing-page", confidence: 0.95, reason: "match" },
        }),
        apply: applySpy,
        append: appendFile,
        writeOutput: (value: string) => {
          output.push(value);
        },
      });

      expect(exitCode).toBe(0);
      expect(applySpy).toHaveBeenCalled();
      expect(output[0]).toBe("{\"continue\":true}");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

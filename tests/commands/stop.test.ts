import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStop } from "../../src/commands/stop.js";
import { BETS_DIR, LOGS_DIR, STATE_PATH, initRepo } from "../../src/fs/init.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-stop-command-test-"));
}

describe("runStop", () => {
  test("fails when repository is not initialized", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runStop("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("fatal: not a bep repository (or any of the parent directories): bets");
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("stops active session and logs exposure (does not mutate bet markdown)", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );

      const betPath = path.join(tempDir, BETS_DIR, "landing-page.md");
      await writeFile(
        betPath,
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );
      const before = await readFile(betPath, "utf8");

      const exitCode = await runStop("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));
      const bet = await readFile(betPath, "utf8");
      const logLines = (await readFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), "utf8")).trim().split("\n");
      const entry = JSON.parse(logLines[0]) as {
        id: string;
        started_at: string;
        stopped_at: string;
        duration_seconds: number;
      };

      expect(exitCode).toBe(0);
      expect(state.active).toEqual([]);
      expect(bet).toBe(before);
      expect(logLines).toHaveLength(1);
      expect(entry.id).toBe("landing-page");
      expect(entry.started_at).toBe("2026-02-18T00:00:00.000Z");
      expect(typeof entry.stopped_at).toBe("string");
      expect(entry.duration_seconds).toBeGreaterThanOrEqual(0);
      expect(logSpy).toHaveBeenCalledWith("Stopped bet 'landing-page' (1 session(s) logged).");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("stops all duplicate sessions for an id", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify(
          {
            active: [
              { id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" },
              { id: "landing-page", started_at: "2026-02-18T01:00:00.000Z" },
              { id: "pricing-page", started_at: "2026-02-18T02:00:00.000Z" },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStop("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));
      const logLines = (await readFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), "utf8")).trim().split("\n");

      expect(exitCode).toBe(0);
      expect(state.active).toEqual([{ id: "pricing-page", started_at: "2026-02-18T02:00:00.000Z" }]);
      expect(logLines).toHaveLength(2);
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns success with no-op when id is not active", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      const statePath = path.join(tempDir, STATE_PATH);
      const before = await readFile(statePath, "utf8");

      const exitCode = await runStop("landing-page");
      const after = await readFile(statePath, "utf8");

      expect(exitCode).toBe(0);
      expect(before).toBe(after);
      await expect(access(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"))).rejects.toThrow();
      expect(logSpy).toHaveBeenCalledWith("Bet 'landing-page' is not active.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for invalid id", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runStop("Landing_Page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid bet id 'Landing_Page'. Use lowercase id format like 'landing-page' or 'landing_page'.",
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for malformed state", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(path.join(tempDir, STATE_PATH), `${JSON.stringify({ active: null }, null, 2)}\n`, "utf8");

      const exitCode = await runStop("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to read state file at bets/_state.json:"),
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails on invalid started_at and leaves state/log unchanged", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      const statePath = path.join(tempDir, STATE_PATH);
      await writeFile(
        statePath,
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "not-a-date" }] }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const beforeState = await readFile(statePath, "utf8");
      const exitCode = await runStop("landing-page");
      const afterState = await readFile(statePath, "utf8");
      const bet = await readFile(path.join(tempDir, BETS_DIR, "landing-page.md"), "utf8");

      expect(exitCode).toBe(1);
      expect(beforeState).toBe(afterState);
      await expect(access(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"))).rejects.toThrow();
      expect(bet).toContain("status: pending");
      expect(errorSpy).toHaveBeenCalledWith("Active session for 'landing-page' has invalid started_at: 'not-a-date'.");
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("stops and logs when markdown file is missing", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );

      const exitCode = await runStop("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));
      const logLines = (await readFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), "utf8")).trim().split("\n");

      expect(exitCode).toBe(0);
      expect(state.active).toEqual([]);
      expect(logLines).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Warning: Bet file 'bets/landing-page.md' is missing. Session was stopped and logged.",
      );
      expect(logSpy).toHaveBeenCalledWith("Stopped bet 'landing-page' (1 session(s) logged).");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails before state/log mutation when bet path exists but is unreadable as file", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      const statePath = path.join(tempDir, STATE_PATH);
      await writeFile(
        statePath,
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );
      await mkdir(path.join(tempDir, BETS_DIR, "landing-page.md"));

      const beforeState = await readFile(statePath, "utf8");
      const exitCode = await runStop("landing-page");
      const afterState = await readFile(statePath, "utf8");

      expect(exitCode).toBe(1);
      expect(beforeState).toBe(afterState);
      await expect(access(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"))).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse BEP file at bets/landing-page.md:"),
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("works when run from a subdirectory of initialized repo", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd");

    try {
      await initRepo(tempDir);
      const nestedDir = path.join(tempDir, "apps", "mobile");
      await mkdir(nestedDir, { recursive: true });
      cwdSpy.mockReturnValue(nestedDir);
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );

      const exitCode = await runStop("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));

      expect(exitCode).toBe(0);
      expect(state.active).toEqual([]);
      await expect(access(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"))).resolves.toBeUndefined();
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

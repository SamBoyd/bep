import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStart } from "../../src/commands/start";
import { BETS_DIR, STATE_PATH, initRepo } from "../../src/fs/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-start-command-test-"));
}

describe("runStart", () => {
  test("activates existing bet and sets status active", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const betPath = path.join(tempDir, BETS_DIR, "landing-page.md");
      await writeFile(
        betPath,
        "---\nid: landing-page\nstatus: paused\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n\n# Budgeted Engineering Proposal\n",
        "utf8",
      );

      const exitCode = await runStart("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));
      const content = await readFile(betPath, "utf8");

      expect(exitCode).toBe(0);
      expect(state.active).toHaveLength(1);
      expect(state.active[0].id).toBe("landing-page");
      expect(typeof state.active[0].started_at).toBe("string");
      expect(content).toContain("status: active");
      expect(logSpy).toHaveBeenCalledWith("Started bet 'landing-page'.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("no-ops when bet is already active", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const startedAt = "2026-02-18T00:00:00.000Z";
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: startedAt }] }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStart("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));

      expect(exitCode).toBe(0);
      expect(state.active).toEqual([{ id: "landing-page", started_at: startedAt }]);
      expect(logSpy).toHaveBeenCalledWith("Bet 'landing-page' is already active.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("allows multiple active bets", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, BETS_DIR, "pricing-page.md"),
        "---\nid: pricing-page\nstatus: paused\ndefault_action: pivot\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStart("pricing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));

      expect(exitCode).toBe(0);
      expect(state.active).toHaveLength(2);
      expect(state.active.map((session: { id: string }) => session.id)).toEqual(["landing-page", "pricing-page"]);
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for missing bet file", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const exitCode = await runStart("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Bet 'landing-page' does not exist at bets/landing-page.md. Run 'bep new landing-page' first.",
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when repository is not initialized", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      const exitCode = await runStart("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("fatal: not a bep repository (or any of the parent directories): bets");
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for invalid id", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      const exitCode = await runStart("Landing_Page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid bet id 'Landing_Page'. Use lowercase slug format like 'landing-page'.",
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for malformed state schema", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      await writeFile(path.join(tempDir, STATE_PATH), `${JSON.stringify({ active: null }, null, 2)}\n`, "utf8");
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: paused\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStart("landing-page");

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

  test("works when run from a subdirectory of initialized repo", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd");

    try {
      await initRepo(tempDir);
      const nestedDir = path.join(tempDir, "apps", "api");
      await mkdir(nestedDir, { recursive: true });
      cwdSpy.mockReturnValue(nestedDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: paused\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStart("landing-page");
      const state = JSON.parse(await readFile(path.join(tempDir, STATE_PATH), "utf8"));

      expect(exitCode).toBe(0);
      expect(state.active).toHaveLength(1);
      expect(state.active[0].id).toBe("landing-page");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

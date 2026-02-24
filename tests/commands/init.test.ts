import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-init-command-test-"));
}

describe("runInit", () => {
  function expectedHookCommand(base: string, event: string): string {
    return `${base} hook claude-code ${event}`;
  }

  test("returns 0 and logs initialization message", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      const exitCode = await runInit();

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Initialized BEP"));
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns 0 and logs already initialized message", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await runInit();
      const exitCode = await runInit();

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("BEP is already initialized.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("installs Claude hooks with --install-hooks --agent claude-code", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const originalArgv1 = process.argv[1];

    try {
      await mkdir(path.join(tempDir, ".claude"), { recursive: true });
      process.argv[1] = "dist/cli.js";

      const exitCode = await runInit({ installHooks: true, agent: "claude-code" });
      const settings = JSON.parse(await readFile(path.join(tempDir, ".claude", "settings.json"), "utf8"));
      const hookBase = path.join(tempDir, "dist", "cli.js");

      expect(exitCode).toBe(0);
      expect(settings.hooks.UserPromptSubmit[0].hooks).toEqual(
        expect.arrayContaining([{ type: "command", command: expectedHookCommand(hookBase, "user-prompt-submit") }]),
      );
      expect(settings.hooks.PostToolUse[0].hooks).toEqual(
        expect.arrayContaining([{ type: "command", command: expectedHookCommand(hookBase, "post-tool-use") }]),
      );
      expect(settings.hooks.PostToolUseFailure[0].hooks).toEqual(
        expect.arrayContaining([
          { type: "command", command: expectedHookCommand(hookBase, "post-tool-use-failure") },
        ]),
      );
      expect(settings.hooks.SessionEnd[0].hooks).toEqual(
        expect.arrayContaining([{ type: "command", command: expectedHookCommand(hookBase, "session-end") }]),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Installed Claude Code tracking hooks"));
    } finally {
      process.argv[1] = originalArgv1 ?? "";
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails hook install when no .claude directory exists", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runInit({ installHooks: true, agent: "claude-code" });

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No .claude directory found"));
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("skips hooks when --no-install-hooks is selected", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      const exitCode = await runInit({ installHooks: false });

      expect(exitCode).toBe(0);
      await expect(readFile(path.join(tempDir, ".claude", "settings.json"), "utf8")).rejects.toThrow();
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for unsupported agent", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await mkdir(path.join(tempDir, ".claude"), { recursive: true });
      const exitCode = await runInit({ installHooks: true, agent: "cursor" });

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not supported yet"));
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("is idempotent when installing hooks twice", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const originalArgv1 = process.argv[1];

    try {
      await mkdir(path.join(tempDir, ".claude"), { recursive: true });
      process.argv[1] = "./dist/cli.js";

      const first = await runInit({ installHooks: true, agent: "claude-code" });
      const second = await runInit({ installHooks: true, agent: "claude-code" });
      const settings = JSON.parse(await readFile(path.join(tempDir, ".claude", "settings.json"), "utf8"));
      const hookBase = path.join(tempDir, "dist", "cli.js");

      expect(first).toBe(0);
      expect(second).toBe(0);

      const promptCommands = settings.hooks.UserPromptSubmit[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === expectedHookCommand(hookBase, "user-prompt-submit"),
      );
      const postToolCommands = settings.hooks.PostToolUse[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === expectedHookCommand(hookBase, "post-tool-use"),
      );
      const postToolFailureCommands = settings.hooks.PostToolUseFailure[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === expectedHookCommand(hookBase, "post-tool-use-failure"),
      );
      const endCommands = settings.hooks.SessionEnd[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === expectedHookCommand(hookBase, "session-end"),
      );

      expect(promptCommands).toHaveLength(1);
      expect(postToolCommands).toHaveLength(1);
      expect(postToolFailureCommands).toHaveLength(1);
      expect(endCommands).toHaveLength(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("already installed"));
    } finally {
      process.argv[1] = originalArgv1 ?? "";
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

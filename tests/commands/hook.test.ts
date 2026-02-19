import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runHook } from "../../src/commands/hook";
import { LOGS_DIR, initRepo } from "../../src/fs/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-hook-command-test-"));
}

describe("runHook", () => {
  test("appends agent session event when repo is initialized", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const exitCode = await runHook("claude-code", "post-tool-use");
      const content = await readFile(path.join(tempDir, LOGS_DIR, "agent-sessions.jsonl"), "utf8");
      const parsed = JSON.parse(content.trim());

      expect(exitCode).toBe(0);
      expect(parsed.agent).toBe("claude-code");
      expect(parsed.event).toBe("post-tool-use");
      expect(typeof parsed.at).toBe("string");
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
});

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-init-command-test-"));
}

describe("runInit", () => {
  test("returns 0 and logs initialization message", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      const exitCode = await runInit(tempDir);

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Initialized BEP"));
    } finally {
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns 0 and logs already initialized message", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await runInit(tempDir);
      const exitCode = await runInit(tempDir);

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenLastCalledWith("BEP is already initialized.");
    } finally {
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheck } from "../../src/commands/check";
import { BETS_DIR, EVIDENCE_DIR, initRepo } from "../../src/fs/init";
import { runCheckPrompt } from "../../src/ui/checkPrompt";

jest.mock("../../src/ui/checkPrompt", () => ({
  runCheckPrompt: jest.fn(),
}));

const mockedRunCheckPrompt = runCheckPrompt as jest.MockedFunction<typeof runCheckPrompt>;

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-check-command-test-"));
}

describe("runCheck", () => {
  beforeEach(() => {
    mockedRunCheckPrompt.mockReset();
  });

  test("fails for invalid id", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runCheck(tempDir, "Landing_Page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid bet id 'Landing_Page'. Use lowercase slug format like 'landing-page'.",
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when bet markdown file is missing", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      const exitCode = await runCheck(tempDir, "landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Bet 'landing-page' does not exist at bets/landing-page.md. Run 'bep new landing-page' first.",
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when leading_indicator is missing or malformed", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runCheck(tempDir, "landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Bet 'landing-page' has invalid leading_indicator:"),
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).rejects.toThrow();
    } finally {
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("captures manual evidence and writes snapshot", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: false,
      observedValue: "13 signups",
      notes: "Traffic source was newsletter.",
    });

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  target: '>= 20 signups in 7d'\n---\n",
        "utf8",
      );

      const exitCode = await runCheck(tempDir, "landing-page");
      const evidencePath = path.join(tempDir, EVIDENCE_DIR, "landing-page.json");
      const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
        id: string;
        mode: string;
        checked_at: string;
        observed_value: string;
        notes?: string;
        leading_indicator: { type: string; target: string };
      };

      expect(exitCode).toBe(0);
      expect(evidence.id).toBe("landing-page");
      expect(evidence.mode).toBe("manual");
      expect(typeof evidence.checked_at).toBe("string");
      expect(evidence.leading_indicator).toEqual({ type: "manual", target: ">= 20 signups in 7d" });
      expect(evidence.observed_value).toBe("13 signups");
      expect(evidence.notes).toBe("Traffic source was newsletter.");
      expect(logSpy).toHaveBeenCalledWith(
        "Captured manual evidence for 'landing-page' at bets/_evidence/landing-page.json.",
      );
    } finally {
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns 1 on prompt cancel and does not write evidence", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: true,
    });

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  target: '>= 20 signups in 7d'\n---\n",
        "utf8",
      );

      const exitCode = await runCheck(tempDir, "landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("Cancelled. No evidence was written.");
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).rejects.toThrow();
    } finally {
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

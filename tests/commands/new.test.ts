import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNew } from "../../src/commands/new";
import { BETS_DIR, initRepo } from "../../src/fs/init";
import { runNewWizard } from "../../src/ui/newWizard";

jest.mock("../../src/ui/newWizard", () => ({
  runNewWizard: jest.fn(),
}));

const mockedRunNewWizard = runNewWizard as jest.MockedFunction<typeof runNewWizard>;

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-new-command-test-"));
}

describe("runNew", () => {
  beforeEach(() => {
    mockedRunNewWizard.mockReset();
  });

  test("creates a new bet file for a unique id", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    mockedRunNewWizard.mockResolvedValue({
      cancelled: false,
      values: {
        maxHours: 12,
        defaultAction: "kill",
        leadingIndicator: {
          type: "manual",
          operator: "gte",
          target: 20,
        },
      },
    });

    try {
      await initRepo(tempDir);
      const exitCode = await runNew("landing-page");
      const filePath = path.join(tempDir, BETS_DIR, "landing-page.md");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(0);
      expect(content).toContain("id: landing-page");
      expect(content).toContain("default_action: kill");
      expect(content).toContain("max_hours: 12");
      expect(content).toContain("leading_indicator:");
      expect(content).toContain("operator: gte");
      expect(content).toContain("target: 20");
      expect(content).not.toContain("max_calendar_days:");
      expect(logSpy).toHaveBeenCalledWith("\nCreated bets/landing-page.md.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when id already exists and leaves existing file unchanged", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const filePath = path.join(tempDir, BETS_DIR, "landing-page.md");
      await writeFile(filePath, "existing content\n", "utf8");

      const exitCode = await runNew("landing-page");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(1);
      expect(content).toBe("existing content\n");
      expect(mockedRunNewWizard).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "Bet 'landing-page' already exists at bets/landing-page.md. Choose a unique id.",
      );
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
      const exitCode = await runNew("Landing_Page");

      expect(exitCode).toBe(1);
      expect(mockedRunNewWizard).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid bet id 'Landing_Page'. Use lowercase slug format like 'landing-page'.",
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("does not create file when wizard is cancelled", async () => {
    const tempDir = await createTempDir();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    mockedRunNewWizard.mockResolvedValue({ cancelled: true });

    try {
      await initRepo(tempDir);
      const exitCode = await runNew("landing-page");
      const filePath = path.join(tempDir, BETS_DIR, "landing-page.md");

      expect(exitCode).toBe(1);
      await expect(readFile(filePath, "utf8")).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith("Cancelled. No files were created.");
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
      const exitCode = await runNew("onboarding-v2");

      expect(exitCode).toBe(1);
      expect(mockedRunNewWizard).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "fatal: not a bep repository (or any of the parent directories): bets",
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("creates file when run from an initialized subdirectory", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd");

    mockedRunNewWizard.mockResolvedValue({
      cancelled: false,
      values: {
        defaultAction: "extend",
        leadingIndicator: {
          type: "manual",
          operator: "lte",
          target: 5,
        },
      },
    });

    try {
      await initRepo(tempDir);
      const nestedDir = path.join(tempDir, "apps", "web");
      await mkdir(nestedDir, { recursive: true });
      cwdSpy.mockReturnValue(nestedDir);

      const exitCode = await runNew("onboarding-v2");

      expect(exitCode).toBe(0);
      await expect(readFile(path.join(tempDir, BETS_DIR, "onboarding-v2.md"), "utf8")).resolves.toContain(
        "default_action: extend",
      );
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

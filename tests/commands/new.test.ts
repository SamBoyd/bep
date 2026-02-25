import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";
await jest.unstable_mockModule("../../src/ui/newWizard.js", () => ({
  runNewWizard: jest.fn(),
}));
await jest.unstable_mockModule("../../src/ui/newBetName.js", () => ({
  normalizeBetName(value: string) {
    return value.trim().replace(/\s+/g, "_").toLowerCase();
  },
}));

const { runNew } = await import("../../src/commands/new.js");
const { BETS_DIR, initRepo } = await import("../../src/fs/init.js");
const { runNewWizard } = await import("../../src/ui/newWizard.js");

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
        betName: "landing-page",
        maxHours: 12,
        leadingIndicator: {
          type: "manual",
          operator: "gte",
          target: 20,
        },
        primaryAssumption: "A focused landing page will increase demo requests.",
        validationPlan: "Track weekly demo request lift after launch.",
        notes: "Coordinate copy review with product marketing.",
      },
    });

    try {
      await initRepo(tempDir);
      const exitCode = await runNew("landing-page");
      const filePath = path.join(tempDir, BETS_DIR, "landing-page.md");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(0);
      expect(content).toContain("id: landing-page");
      expect(content).not.toContain("default_action:");
      expect(content).toContain("max_hours: 12");
      expect(content).toContain("leading_indicator:");
      expect(content).toContain("operator: gte");
      expect(content).toContain("target: 20");
      expect(content).toContain("A focused landing page will increase demo requests.");
      expect(content).toContain("Track weekly demo request lift after launch.");
      expect(content).toContain("Coordinate copy review with product marketing.");
      expect(content).not.toContain("max_calendar_days:");
      expect(logSpy).toHaveBeenCalledWith("\nCreated bets/landing-page.md.");
      expect(mockedRunNewWizard).toHaveBeenCalledWith({
        initialBetName: "landing-page",
        validateBetName: expect.any(Function),
      });
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("normalizes spaced/cased CLI-style input into wizard initial bet name", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    mockedRunNewWizard.mockImplementation(async (options) => {
      expect(options.initialBetName).toBe("new_landing_page");
      expect(options.validateBetName("new_landing_page")).toBeUndefined();
      return {
        cancelled: false,
        values: {
          betName: "new_landing_page",
          maxHours: 12,
          leadingIndicator: {
            type: "manual",
            operator: "gte",
            target: 20,
          },
          primaryAssumption: "A focused landing page will increase demo requests.",
          validationPlan: "Track weekly demo request lift after launch.",
          notes: "Coordinate copy review with product marketing.",
        },
      };
    });

    try {
      await initRepo(tempDir);
      const exitCode = await runNew("New Landing Page");
      const filePath = path.join(tempDir, BETS_DIR, "new_landing_page.md");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(0);
      expect(content).toContain("id: new_landing_page");
      expect(logSpy).toHaveBeenCalledWith("\nCreated bets/new_landing_page.md.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("passes duplicate bet-name validation into the wizard", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      const filePath = path.join(tempDir, BETS_DIR, "landing-page.md");
      await writeFile(filePath, "existing content\n", "utf8");
      mockedRunNewWizard.mockImplementation(async (options) => {
        expect(options.initialBetName).toBe("landing-page");
        expect(options.validateBetName("landing-page")).toBe(
          "Bet 'landing-page' already exists at bets/landing-page.md. Choose a unique id.",
        );
        return { cancelled: true };
      });

      const exitCode = await runNew("landing-page");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(1);
      expect(content).toBe("existing content\n");
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("passes invalid-id validation into the wizard", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);

    try {
      await initRepo(tempDir);
      mockedRunNewWizard.mockImplementation(async (options) => {
        expect(options.initialBetName).toBe("landing/page");
        expect(options.validateBetName("landing/page")).toBe(
          "Invalid bet id 'landing/page'. Use id format like 'landing-page' or 'landing_page'.",
        );
        return { cancelled: true };
      });
      const exitCode = await runNew("landing/page");

      expect(exitCode).toBe(1);
    } finally {
      cwdSpy.mockRestore();
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
      expect(mockedRunNewWizard).toHaveBeenCalledWith({
        initialBetName: "landing-page",
        validateBetName: expect.any(Function),
      });
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("launches wizard with no initial bet name when id is omitted", async () => {
    const tempDir = await createTempDir();
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

    mockedRunNewWizard.mockImplementation(async (options) => {
      expect(options.initialBetName).toBeUndefined();
      expect(options.validateBetName("landing_page_refresh")).toBeUndefined();
      return {
        cancelled: false,
        values: {
          betName: "landing_page_refresh",
          maxHours: 12,
          leadingIndicator: {
            type: "manual",
            operator: "gte",
            target: 20,
          },
          primaryAssumption: "A focused landing page will increase demo requests.",
          validationPlan: "Track weekly demo request lift after launch.",
          notes: "Coordinate copy review with product marketing.",
        },
      };
    });

    try {
      await initRepo(tempDir);
      const exitCode = await runNew();
      const filePath = path.join(tempDir, BETS_DIR, "landing_page_refresh.md");
      const content = await readFile(filePath, "utf8");

      expect(exitCode).toBe(0);
      expect(content).toContain("id: landing_page_refresh");
      expect(logSpy).toHaveBeenCalledWith("\nCreated bets/landing_page_refresh.md.");
    } finally {
      if (stdinDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin as NodeJS.ReadStream & { isTTY?: boolean }, "isTTY");
      }
      if (stdoutDescriptor) {
        Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
      } else {
        Reflect.deleteProperty(process.stdout as NodeJS.WriteStream & { isTTY?: boolean }, "isTTY");
      }
      cwdSpy.mockRestore();
      logSpy.mockRestore();
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
        betName: "onboarding-v2",
        leadingIndicator: {
          type: "manual",
          operator: "lte",
          target: 5,
          },
          primaryAssumption: "Onboarding friction is caused by unclear setup steps.",
          validationPlan: "Measure setup completion rate in first session.",
          notes: "",
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
        "leading_indicator:",
      );
    } finally {
      cwdSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

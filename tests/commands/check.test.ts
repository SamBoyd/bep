import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  test("fails when repository is not initialized", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("fatal: not a bep repository (or any of the parent directories): bets");
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for invalid id", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runCheck("Landing_Page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid bet id 'Landing_Page'. Use lowercase slug format like 'landing-page'.",
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when bet markdown file is missing", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Bet 'landing-page' does not exist at bets/landing-page.md. Run 'bep new landing-page' first.",
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when leading_indicator is missing or malformed", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid leading_indicator"),
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).rejects.toThrow();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("captures manual evidence and writes snapshot", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: false,
      observedValue: 13,
      notes: "Traffic source was newsletter.",
    });

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  operator: gte\n  target: 20\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");
      const evidencePath = path.join(tempDir, EVIDENCE_DIR, "landing-page.json");
      const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
        id: string;
        mode: string;
        checked_at: string;
        observed_value: number;
        meets_target: boolean;
        notes?: string;
        leading_indicator: { type: string; operator: string; target: number };
      };

      expect(exitCode).toBe(0);
      expect(evidence.id).toBe("landing-page");
      expect(evidence.mode).toBe("manual");
      expect(typeof evidence.checked_at).toBe("string");
      expect(evidence.leading_indicator).toEqual({ type: "manual", operator: "gte", target: 20 });
      expect(evidence.observed_value).toBe(13);
      expect(evidence.meets_target).toBe(false);
      expect(evidence.notes).toBe("Traffic source was newsletter.");
      expect(logSpy).toHaveBeenCalledWith(
        "Captured manual evidence for 'landing-page' at bets/_evidence/landing-page.json. Result: FAIL (13 >= 20).",
      );
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns 1 on prompt cancel and does not write evidence", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: true,
    });

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  operator: gte\n  target: 20\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("Cancelled. No evidence was written.");
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).rejects.toThrow();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when leading_indicator.type is unsupported", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: posthog\n  target: 20\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Bet has unsupported leading_indicator.type 'posthog'. Supported types: manual, mixpanel.",
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when manual leading_indicator is missing required target", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  operator: gte\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Bet 'landing-page' has invalid leading_indicator:"),
      );
      expect(mockedRunCheckPrompt).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("works when run from a subdirectory of initialized repo", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd");
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: false,
      observedValue: 21,
    });

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: manual\n  operator: gte\n  target: 20\n---\n",
        "utf8",
      );
      const nestedDir = path.join(tempDir, "apps", "web");
      await mkdir(nestedDir, { recursive: true });
      cwdSpy.mockReturnValue(nestedDir);

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        "Captured manual evidence for 'landing-page' at bets/_evidence/landing-page.json. Result: PASS (21 >= 20).",
      );
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).resolves.toBeUndefined();
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails mixpanel checks when provider config is missing", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(path.join(tempDir, ".bep.providers.json"), `${JSON.stringify({ mixpanel: {} }, null, 2)}\n`, "utf8");
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: mixpanel\n  project_id: \"3989556\"\n  workspace_id: \"4485331\"\n  bookmark_id: \"88319528\"\n  operator: gte\n  target: 20\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Missing non-empty "mixpanel.service_account_creds" in .bep.providers.json.',
      );
      await expect(access(path.join(tempDir, EVIDENCE_DIR, "landing-page.json"))).rejects.toThrow();
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("captures mixpanel evidence and writes snapshot", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        headers: ["$metric"],
        computed_at: "2026-02-21T01:26:58.448489+00:00",
        date_range: {
          from_date: "2026-02-19T00:00:00-08:00",
          to_date: "2026-02-19T23:59:59.999000-08:00",
        },
        series: {
          "Uniques of Session Start": {
            all: 13,
          },
        },
      }),
    }) as unknown as typeof fetch;

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, ".bep.providers.json"),
        `${JSON.stringify({ mixpanel: { service_account_creds: "svc-user:svc-secret" } }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nleading_indicator:\n  type: mixpanel\n  project_id: \"3989556\"\n  workspace_id: \"4485331\"\n  bookmark_id: \"88319528\"\n  operator: gte\n  target: 20\n---\n",
        "utf8",
      );

      const exitCode = await runCheck("landing-page");
      const evidencePath = path.join(tempDir, EVIDENCE_DIR, "landing-page.json");
      const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
        id: string;
        mode: string;
        checked_at: string;
        observed_value: number;
        meets_target: boolean;
        leading_indicator: {
          type: string;
          project_id: string;
          workspace_id: string;
          bookmark_id: string;
          operator: string;
          target: number;
        };
      };

      expect(exitCode).toBe(0);
      expect(evidence.id).toBe("landing-page");
      expect(evidence.mode).toBe("mixpanel");
      expect(typeof evidence.checked_at).toBe("string");
      expect(evidence.leading_indicator).toEqual({
        type: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
        operator: "gte",
        target: 20,
      });
      expect(evidence.observed_value).toBe(13);
      expect(evidence.meets_target).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        "Captured mixpanel evidence for 'landing-page' at bets/_evidence/landing-page.json. Result: FAIL (13 >= 20).",
      );
    } finally {
      global.fetch = originalFetch;
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

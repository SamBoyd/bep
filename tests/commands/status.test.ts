import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStatus } from "../../src/commands/status";
import { BETS_DIR, EVIDENCE_DIR, LOGS_DIR, STATE_PATH, initRepo } from "../../src/fs/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-status-command-test-"));
}

function getPrintedOutput(logSpy: jest.SpyInstance): string {
  const firstCall = logSpy.mock.calls[0];
  return typeof firstCall?.[0] === "string" ? firstCall[0] : "";
}

describe("runStatus", () => {
  test("fails when repository is not initialized", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      const exitCode = await runStatus();

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("fatal: not a bep repository (or any of the parent directories): bets");
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("prints no bets message when none exist", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);

      const exitCode = await runStatus();

      expect(exitCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("No bets found.");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("prints row with zero tracked time and no validation by default", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("id");
      expect(output).toContain("time_h");
      expect(output).toContain("landing-page");
      expect(output).toContain("0.00");
      expect(output).toContain("N/A");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("normalizes legacy active/paused statuses to pending", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: active\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toMatch(/landing-page\s+pending\s+/);
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("sums multiple log lines and computes cap warnings", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);

      await writeFile(
        path.join(tempDir, BETS_DIR, "alpha.md"),
        "---\nid: alpha\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 4\n---\n",
        "utf8",
      );
      await writeFile(
        path.join(tempDir, BETS_DIR, "beta.md"),
        "---\nid: beta\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 2\n---\n",
        "utf8",
      );

      await writeFile(
        path.join(tempDir, LOGS_DIR, "alpha.jsonl"),
        `${JSON.stringify({ id: "alpha", started_at: "2026-02-18T00:00:00.000Z", stopped_at: "2026-02-18T01:00:00.000Z", duration_seconds: 3600 })}\n${JSON.stringify({ id: "alpha", started_at: "2026-02-18T01:00:00.000Z", stopped_at: "2026-02-18T03:00:00.000Z", duration_seconds: 7200 })}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, LOGS_DIR, "beta.jsonl"),
        `${JSON.stringify({ id: "beta", started_at: "2026-02-18T00:00:00.000Z", stopped_at: "2026-02-18T02:00:00.000Z", duration_seconds: 7200 })}\n`,
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("alpha");
      expect(output).toContain("beta");
      expect(output).toContain("3.00");
      expect(output).toContain("4.00h");
      expect(output).toContain("2.00h");
      expect(output).toContain("75.00%");
      expect(output).toContain("NEARING_CAP");
      expect(output).toContain("AT_CAP");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("marks active bets from state and displays manual validation result", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 8\n---\n",
        "utf8",
      );
      await writeFile(
        path.join(tempDir, STATE_PATH),
        `${JSON.stringify({ active: [{ id: "landing-page", started_at: "2026-02-18T05:00:00.000Z" }] }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(tempDir, EVIDENCE_DIR, "landing-page.json"),
        `${JSON.stringify(
          {
            id: "landing-page",
            checked_at: "2026-02-18T06:00:00.000Z",
            mode: "manual",
            observed_value: 13,
            meets_target: false,
            leading_indicator: {
              type: "manual",
              operator: "gte",
              target: 20,
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("landing-page");
      expect(output).toContain("yes");
      expect(output).toContain("FAIL 13 >= 20");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("displays mixpanel validation result comparison", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "conversion-rate.md"),
        "---\nid: conversion-rate\nstatus: pending\ndefault_action: narrow\ncreated_at: 2026-02-18T00:00:00.000Z\nmax_hours: 8\n---\n",
        "utf8",
      );
      await writeFile(
        path.join(tempDir, EVIDENCE_DIR, "conversion-rate.json"),
        `${JSON.stringify(
          {
            id: "conversion-rate",
            checked_at: "2026-02-18T06:00:00.000Z",
            mode: "mixpanel",
            observed_value: 91,
            meets_target: true,
            leading_indicator: {
              type: "mixpanel",
              project_id: "3989556",
              workspace_id: "4485331",
              bookmark_id: "88319528",
              operator: "gte",
              target: 90,
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("conversion-rate");
      expect(output).toContain("PASS 91 >= 90");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when required state file is missing", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await rm(path.join(tempDir, STATE_PATH), { force: true });
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const exitCode = await runStatus();

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith("fatal: not a bep repository (or any of the parent directories): bets");
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for malformed markdown file", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: paused\ncreated_at: [\n---\n",
        "utf8",
      );

      const exitCode = await runStatus();

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse BEP file at bets/landing-page.md:"));
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("supports calendar-day caps in table output", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      await writeFile(
        path.join(tempDir, BETS_DIR, "calendar-cap.md"),
        `---\nid: calendar-cap\nstatus: pending\ndefault_action: kill\ncreated_at: ${createdAt}\nmax_calendar_days: 10\n---\n`,
        "utf8",
      );

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("calendar-cap");
      expect(output).toContain("10.00d");
      expect(output).toContain("NEARING_CAP");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("fails for malformed log line", async () => {
    const tempDir = await createTempDir();
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tempDir);
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );
      await writeFile(path.join(tempDir, LOGS_DIR, "landing-page.jsonl"), "not-json\n", "utf8");

      const exitCode = await runStatus();

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to parse log file at bets/_logs/landing-page.jsonl: invalid JSON on line 1.",
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
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );
      const nestedDir = path.join(tempDir, "services", "api");
      await mkdir(nestedDir, { recursive: true });
      cwdSpy.mockReturnValue(nestedDir);

      const exitCode = await runStatus();
      const output = getPrintedOutput(logSpy);

      expect(exitCode).toBe(0);
      expect(output).toContain("landing-page");
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getBetRelativePath, readBetFile, writeBetFile } from "../../src/fs/bets";
import { BETS_DIR, initRepo } from "../../src/fs/init";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-fs-bets-test-"));
}

describe("fs/bets", () => {
  test("builds relative path for id input", () => {
    expect(getBetRelativePath("landing-page")).toBe(path.join(BETS_DIR, "landing-page.md"));
  });

  test("builds relative path for file-name input", () => {
    expect(getBetRelativePath("landing-page.md")).toBe(path.join(BETS_DIR, "landing-page.md"));
  });

  test("reads and parses valid bet markdown", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const result = await readBetFile(tempDir, "landing-page");

      expect(result.relativePath).toBe(path.join(BETS_DIR, "landing-page.md"));
      expect(result.absolutePath).toBe(path.join(tempDir, BETS_DIR, "landing-page.md"));
      expect(result.bet.data).toMatchObject({ id: "landing-page", status: "pending" });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("throws contextual error for malformed frontmatter", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: paused\ncreated_at: [\n---\n",
        "utf8",
      );

      await expect(readBetFile(tempDir, "landing-page")).rejects.toThrow(
        "Failed to parse BEP file at bets/landing-page.md:",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("throws contextual error for malformed yaml structure in frontmatter", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nleading_indicator:\n  type: manual\n   operator: gte\n---\n",
        "utf8",
      );

      await expect(readBetFile(tempDir, "landing-page")).rejects.toThrow(
        "Failed to parse BEP file at bets/landing-page.md:",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("throws contextual error when bet path points to a directory", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await mkdir(path.join(tempDir, BETS_DIR, "landing-page.md"));

      await expect(readBetFile(tempDir, "landing-page")).rejects.toThrow(
        "Failed to parse BEP file at bets/landing-page.md:",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("writes updated frontmatter to disk", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      await writeFile(
        path.join(tempDir, BETS_DIR, "landing-page.md"),
        "---\nid: landing-page\nstatus: pending\ndefault_action: kill\ncreated_at: 2026-02-18T00:00:00.000Z\n---\n",
        "utf8",
      );

      const file = await readBetFile(tempDir, "landing-page");
      file.bet.data.status = "passed";
      await writeBetFile(tempDir, "landing-page", file.bet);

      const next = await readFile(path.join(tempDir, BETS_DIR, "landing-page.md"), "utf8");
      expect(next).toContain("status: passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

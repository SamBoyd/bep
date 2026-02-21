import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BETS_DIR,
  EVIDENCE_DIR,
  LOGS_DIR,
  STATE_PATH,
  ensureInitializedRepo,
  findInitializedRepo,
  initRepo,
} from "../../src/fs/init";
import { PROVIDER_CONFIG_PATH } from "../../src/providers/config";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-init-test-"));
}

describe("initRepo", () => {
  test("creates expected BEP directories and state file", async () => {
    const tempDir = await createTempDir();

    try {
      const result = await initRepo(tempDir);

      expect(result.alreadyInitialized).toBe(false);
      expect(result.createdPaths).toEqual(
        expect.arrayContaining([BETS_DIR, LOGS_DIR, EVIDENCE_DIR, STATE_PATH, PROVIDER_CONFIG_PATH]),
      );

      const stateFile = await readFile(path.join(tempDir, STATE_PATH), "utf8");
      expect(JSON.parse(stateFile)).toEqual({ active: [] });

      const providerFile = await readFile(path.join(tempDir, PROVIDER_CONFIG_PATH), "utf8");
      expect(JSON.parse(providerFile)).toEqual({
        mixpanel: {
          service_account_creds: "<serviceaccount_username>:<serviceaccount_secret>",
        },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("is idempotent and does not overwrite existing state", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      const existingState = { active: { id: "landing-page", started_at: "2026-02-18T00:00:00.000Z" } };
      await writeFile(path.join(tempDir, STATE_PATH), `${JSON.stringify(existingState, null, 2)}\n`, "utf8");

      const result = await initRepo(tempDir);
      const persisted = await readFile(path.join(tempDir, STATE_PATH), "utf8");

      expect(result.alreadyInitialized).toBe(true);
      expect(result.createdPaths).toHaveLength(0);
      expect(JSON.parse(persisted)).toEqual(existingState);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("adds .bep.providers.json to .gitignore when in a git repository", async () => {
    const tempDir = await createTempDir();

    try {
      await mkdir(path.join(tempDir, ".git"), { recursive: true });
      await writeFile(path.join(tempDir, ".gitignore"), "node_modules\n", "utf8");

      await initRepo(tempDir);
      const gitignore = await readFile(path.join(tempDir, ".gitignore"), "utf8");

      expect(gitignore).toContain(".bep.providers.json");
      expect(gitignore.match(/\.bep\.providers\.json/g)).toHaveLength(1);

      await initRepo(tempDir);
      const second = await readFile(path.join(tempDir, ".gitignore"), "utf8");
      expect(second.match(/\.bep\.providers\.json/g)).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("creates .gitignore with provider entry when git repository has no .gitignore", async () => {
    const tempDir = await createTempDir();

    try {
      await mkdir(path.join(tempDir, ".git"), { recursive: true });

      const result = await initRepo(tempDir);
      const gitignore = await readFile(path.join(tempDir, ".gitignore"), "utf8");

      expect(result.createdPaths).toContain(".gitignore");
      expect(gitignore).toBe(".bep.providers.json\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("findInitializedRepo returns initialized current directory", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      const result = await findInitializedRepo(tempDir);

      expect(result).toEqual({
        rootDir: tempDir,
        betsDir: path.join(tempDir, BETS_DIR),
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("findInitializedRepo discovers initialized ancestor from nested directory", async () => {
    const tempDir = await createTempDir();

    try {
      await initRepo(tempDir);
      const nestedDir = path.join(tempDir, "a", "b", "c");
      await mkdir(nestedDir, { recursive: true });

      const result = await findInitializedRepo(nestedDir);

      expect(result).toEqual({
        rootDir: tempDir,
        betsDir: path.join(tempDir, BETS_DIR),
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("findInitializedRepo returns nearest initialized ancestor", async () => {
    const tempDir = await createTempDir();
    const nestedRepoRoot = path.join(tempDir, "packages", "ui");

    try {
      await initRepo(tempDir);
      await mkdir(nestedRepoRoot, { recursive: true });
      await initRepo(nestedRepoRoot);

      const deepNestedDir = path.join(nestedRepoRoot, "src", "components");
      await mkdir(deepNestedDir, { recursive: true });

      const result = await findInitializedRepo(deepNestedDir);

      expect(result).toEqual({
        rootDir: nestedRepoRoot,
        betsDir: path.join(nestedRepoRoot, BETS_DIR),
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("ensureInitializedRepo throws when no initialized repository exists", async () => {
    const tempDir = await createTempDir();

    try {
      await expect(ensureInitializedRepo(tempDir)).rejects.toThrow(
        "fatal: not a bep repository (or any of the parent directories): bets",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

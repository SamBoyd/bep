import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installClaudeCodeHooks } from "../../src/hooks/claude.js";

const TEST_HOOK_COMMAND_BASE = "/tmp/dev-bep/dist/cli.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-hook-claude-test-"));
}

describe("installClaudeCodeHooks", () => {
  test("creates settings file with high-value hook commands", async () => {
    const tempDir = await createTempDir();

    try {
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      const result = await installClaudeCodeHooks(claudeDir, TEST_HOOK_COMMAND_BASE);
      const settings = JSON.parse(await readFile(result.settingsPath, "utf8"));

      expect(result.addedCommands).toBe(4);
      expect(settings.hooks.UserPromptSubmit[0].hooks).toEqual(
        expect.arrayContaining([
          { type: "command", command: `${TEST_HOOK_COMMAND_BASE} hook claude-code user-prompt-submit` },
        ]),
      );
      expect(settings.hooks.PostToolUse[0].hooks).toEqual(
        expect.arrayContaining([{ type: "command", command: `${TEST_HOOK_COMMAND_BASE} hook claude-code post-tool-use` }]),
      );
      expect(settings.hooks.PostToolUseFailure[0].hooks).toEqual(
        expect.arrayContaining([
          { type: "command", command: `${TEST_HOOK_COMMAND_BASE} hook claude-code post-tool-use-failure` },
        ]),
      );
      expect(settings.hooks.SessionEnd[0].hooks).toEqual(
        expect.arrayContaining([{ type: "command", command: `${TEST_HOOK_COMMAND_BASE} hook claude-code session-end` }]),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("is idempotent and does not duplicate hook commands", async () => {
    const tempDir = await createTempDir();

    try {
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      await installClaudeCodeHooks(claudeDir, TEST_HOOK_COMMAND_BASE);
      const second = await installClaudeCodeHooks(claudeDir, TEST_HOOK_COMMAND_BASE);
      const settings = JSON.parse(await readFile(path.join(claudeDir, "settings.json"), "utf8"));

      expect(second.addedCommands).toBe(0);

      const promptCommands = settings.hooks.UserPromptSubmit[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === `${TEST_HOOK_COMMAND_BASE} hook claude-code user-prompt-submit`,
      );
      const postToolCommands = settings.hooks.PostToolUse[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === `${TEST_HOOK_COMMAND_BASE} hook claude-code post-tool-use`,
      );
      const postToolFailureCommands = settings.hooks.PostToolUseFailure[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === `${TEST_HOOK_COMMAND_BASE} hook claude-code post-tool-use-failure`,
      );
      const endCommands = settings.hooks.SessionEnd[0].hooks.filter(
        (entry: { type: string; command: string }) =>
          entry.type === "command" && entry.command === `${TEST_HOOK_COMMAND_BASE} hook claude-code session-end`,
      );

      expect(promptCommands).toHaveLength(1);
      expect(postToolCommands).toHaveLength(1);
      expect(postToolFailureCommands).toHaveLength(1);
      expect(endCommands).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("merges into existing settings without removing unrelated keys", async () => {
    const tempDir = await createTempDir();

    try {
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      await writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify(
          {
            permissions: {
              deny: ["Read(./secret/**)"],
            },
            hooks: {
              UserPromptSubmit: [
                {
                  matcher: "",
                  hooks: [{ type: "command", command: "echo existing" }],
                },
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      await installClaudeCodeHooks(claudeDir, TEST_HOOK_COMMAND_BASE);
      const settings = JSON.parse(await readFile(path.join(claudeDir, "settings.json"), "utf8"));

      expect(settings.permissions.deny).toEqual(["Read(./secret/**)"]);
      expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
      expect(settings.hooks.UserPromptSubmit).toBeDefined();
      expect(settings.hooks.PostToolUse).toBeDefined();
      expect(settings.hooks.PostToolUseFailure).toBeDefined();
      expect(settings.hooks.SessionEnd).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps legacy bep commands and adds new CLI-path commands", async () => {
    const tempDir = await createTempDir();

    try {
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      await installClaudeCodeHooks(claudeDir, "bep");
      const result = await installClaudeCodeHooks(claudeDir, TEST_HOOK_COMMAND_BASE);
      const settings = JSON.parse(await readFile(path.join(claudeDir, "settings.json"), "utf8"));

      expect(result.addedCommands).toBe(4);
      expect(settings.hooks.UserPromptSubmit[0].hooks).toEqual(
        expect.arrayContaining([
          { type: "command", command: "bep hook claude-code user-prompt-submit" },
          { type: "command", command: `${TEST_HOOK_COMMAND_BASE} hook claude-code user-prompt-submit` },
        ]),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

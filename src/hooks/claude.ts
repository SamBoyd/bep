import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CLAUDE_SETTINGS_FILE = "settings.json";
const HOOK_COMMANDS = [
  { event: "UserPromptSubmit", command: "bep hook claude-code user-prompt-submit" },
  { event: "PostToolUse", command: "bep hook claude-code post-tool-use" },
  { event: "PostToolUseFailure", command: "bep hook claude-code post-tool-use-failure" },
  { event: "SessionEnd", command: "bep hook claude-code session-end" },
] as const;

type HookCommand = {
  type: string;
  command: string;
};

type HookMatcher = {
  matcher: string;
  hooks: HookCommand[];
};

type ClaudeSettings = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

export type ClaudeHookInstallResult = {
  claudeDir: string;
  settingsPath: string;
  addedCommands: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseSettings(raw: string): ClaudeSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed)) {
    throw new Error(".claude/settings.json must be a JSON object.");
  }

  return parsed as ClaudeSettings;
}

function ensureCommand(settings: ClaudeSettings, event: string, command: string): boolean {
  if (!isObject(settings.hooks)) {
    settings.hooks = {};
  }

  const hooksByEvent = settings.hooks as Record<string, unknown>;
  const rawMatchers = hooksByEvent[event];

  if (!Array.isArray(rawMatchers)) {
    const entry: HookMatcher = {
      matcher: "",
      hooks: [{ type: "command", command }],
    };
    hooksByEvent[event] = [entry];
    return true;
  }

  let target = rawMatchers.find(
    (matcher) =>
      isObject(matcher) &&
      typeof matcher.matcher === "string" &&
      matcher.matcher.length === 0 &&
      Array.isArray(matcher.hooks),
  ) as HookMatcher | undefined;

  if (!target) {
    target = { matcher: "", hooks: [] };
    rawMatchers.push(target);
  }

  const exists = target.hooks.some(
    (candidate) => candidate && candidate.type === "command" && candidate.command === command,
  );

  if (exists) {
    return false;
  }

  target.hooks.push({ type: "command", command });
  return true;
}

export async function installClaudeCodeHooks(claudeDir: string): Promise<ClaudeHookInstallResult> {
  const settingsPath = path.join(claudeDir, CLAUDE_SETTINGS_FILE);

  let settings: ClaudeSettings = {};
  try {
    const raw = await readFile(settingsPath, "utf8");
    settings = parseSettings(raw);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  let addedCommands = 0;
  for (const hook of HOOK_COMMANDS) {
    if (ensureCommand(settings, hook.event, hook.command)) {
      addedCommands += 1;
    }
  }

  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return {
    claudeDir,
    settingsPath,
    addedCommands,
  };
}

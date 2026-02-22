import path from "node:path";
import { findNearestClaudeDir } from "./discovery";
import { installClaudeCodeHooks } from "./claude";
import { formatAgentLabel, isHookAgent, isSupportedHookAgent, type HookAgent } from "./types";

export type InstallHooksResult =
  | {
      ok: true;
      agent: HookAgent;
      settingsPathRelative: string;
      alreadyInstalled: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function resolveAgent(agent: string): { ok: true; value: HookAgent } | { ok: false; error: string } {
  if (!isHookAgent(agent)) {
    return {
      ok: false,
      error:
        `Unknown agent '${agent}'. Valid values: claude-code, cursor, codex, windsurf.`,
    };
  }

  if (!isSupportedHookAgent(agent)) {
    return {
      ok: false,
      error: `${formatAgentLabel(agent)} hook installation is not supported yet. Choose 'claude-code'.`,
    };
  }

  return { ok: true, value: agent };
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function resolveHookCommandBase(startDir: string): string {
  const argv1 = process.argv[1]?.trim();
  if (!argv1) {
    return "bep";
  }

  const resolved = path.isAbsolute(argv1) ? argv1 : path.resolve(startDir, argv1);
  return quoteShellArg(resolved);
}

export async function installAgentHooks(startDir: string, agent: string): Promise<InstallHooksResult> {
  const resolved = resolveAgent(agent);
  if (!resolved.ok) {
    return resolved;
  }

  const claudeDir = await findNearestClaudeDir(startDir);
  if (!claudeDir) {
    return {
      ok: false,
      error:
        "No .claude directory found in the current directory or any parent directory. Create one first, then rerun 'bep init --install-hooks --agent claude-code'.",
    };
  }

  const hookCommandBase = resolveHookCommandBase(startDir);
  const installed = await installClaudeCodeHooks(claudeDir, hookCommandBase);
  const settingsPathRelative = path.relative(startDir, installed.settingsPath) || path.basename(installed.settingsPath);

  return {
    ok: true,
    agent: resolved.value,
    settingsPathRelative,
    alreadyInstalled: installed.addedCommands === 0,
  };
}

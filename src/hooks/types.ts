export const SUPPORTED_HOOK_AGENT = "claude-code";

export const AGENT_CHOICES = ["claude-code", "cursor", "codex", "windsurf"] as const;

export type HookAgent = (typeof AGENT_CHOICES)[number];

export function isHookAgent(value: string): value is HookAgent {
  return (AGENT_CHOICES as readonly string[]).includes(value);
}

export function isSupportedHookAgent(value: string): value is typeof SUPPORTED_HOOK_AGENT {
  return value === SUPPORTED_HOOK_AGENT;
}

export function formatAgentLabel(agent: HookAgent): string {
  switch (agent) {
    case "claude-code":
      return "Claude Code";
    case "cursor":
      return "Cursor";
    case "codex":
      return "Codex";
    case "windsurf":
      return "Windsurf";
  }
}

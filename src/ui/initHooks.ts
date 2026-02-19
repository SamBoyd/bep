import { confirm, isCancel, select } from "@clack/prompts";
import { type HookAgent, formatAgentLabel } from "../hooks/types";

const COMING_SOON_AGENTS: HookAgent[] = ["cursor", "codex", "windsurf"];

export type InitHookPromptResult =
  | { kind: "cancel" }
  | { kind: "skip" }
  | { kind: "install"; agent: HookAgent };

export type InitHookPromptClient = {
  promptInstallNow(): Promise<boolean | "cancel">;
  promptAgent(): Promise<HookAgent | "cancel">;
  showComingSoon(agent: HookAgent): void;
};

export async function runInitHookPrompt(client: InitHookPromptClient = createInitHookPromptClient()): Promise<InitHookPromptResult> {
  const shouldInstall = await client.promptInstallNow();
  if (shouldInstall === "cancel") {
    return { kind: "cancel" };
  }

  if (!shouldInstall) {
    return { kind: "skip" };
  }

  while (true) {
    const selected = await client.promptAgent();
    if (selected === "cancel") {
      return { kind: "cancel" };
    }

    if (selected === "claude-code") {
      return { kind: "install", agent: selected };
    }

    client.showComingSoon(selected);
  }
}

export function createInitHookPromptClient(): InitHookPromptClient {
  return {
    async promptInstallNow() {
      const value = await confirm({
        message: "Install agent tracking hooks now?",
        initialValue: true,
      });

      if (isCancel(value)) {
        return "cancel";
      }

      return value;
    },
    async promptAgent() {
      const value = await select<HookAgent>({
        message: "Choose an agent",
        options: [
          { label: "Claude Code", value: "claude-code" },
          { label: "Cursor", value: "cursor", hint: "coming soon" },
          { label: "Codex", value: "codex", hint: "coming soon" },
          { label: "Windsurf", value: "windsurf", hint: "coming soon" },
        ],
        initialValue: "claude-code",
      });

      if (isCancel(value)) {
        return "cancel";
      }

      return value;
    },
    showComingSoon(agent: HookAgent) {
      if (COMING_SOON_AGENTS.includes(agent)) {
        console.log(`${formatAgentLabel(agent)} support is coming soon. Choose Claude Code for now.`);
      }
    },
  };
}

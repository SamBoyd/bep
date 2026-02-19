import { appendFile } from "node:fs/promises";
import path from "node:path";
import { findInitializedRepo, LOGS_DIR } from "../fs/init";
import { isSupportedHookAgent } from "../hooks/types";

export type HookEvent = "user-prompt-submit" | "post-tool-use" | "post-tool-use-failure" | "session-end";

type HookLogEntry = {
  agent: "claude-code";
  event: HookEvent;
  at: string;
};

function isHookEvent(value: string): value is HookEvent {
  return (
    value === "user-prompt-submit" ||
    value === "post-tool-use" ||
    value === "post-tool-use-failure" ||
    value === "session-end"
  );
}

export async function runHook(agent: string, event: string): Promise<number> {
  if (!isSupportedHookAgent(agent)) {
    console.error(`Unsupported hook agent '${agent}'. Only 'claude-code' is supported.`);
    return 1;
  }

  if (!isHookEvent(event)) {
    console.error(
      `Unsupported hook event '${event}'. Use one of: user-prompt-submit, post-tool-use, post-tool-use-failure, session-end.`,
    );
    return 1;
  }

  const found = await findInitializedRepo(process.cwd());
  if (!found) {
    return 0;
  }

  const line: HookLogEntry = {
    agent,
    event,
    at: new Date().toISOString(),
  };

  const logPath = path.join(found.rootDir, LOGS_DIR, "agent-sessions.jsonl");
  await appendFile(logPath, `${JSON.stringify(line)}\n`, "utf8");
  return 0;
}

import type { HookEvent, ParsedHookPayload } from "../tracking/types";

const MAX_FIELD_LENGTH = 2000;

function truncate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}...` : value;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function stringifyJson(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export function parseHookStdin(raw: string, event: HookEvent): ParsedHookPayload | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const source = parsed as Record<string, unknown>;

  const prompt =
    event === "user-prompt-submit"
      ? pickString(source, ["prompt", "user_prompt", "message"]) ?? stringifyJson(source["prompt"])
      : undefined;

  const toolName =
    event === "post-tool-use" || event === "post-tool-use-failure"
      ? pickString(source, ["tool_name", "toolName", "tool"]) ?? pickString(source, ["matcher"])
      : undefined;

  const toolInput =
    event === "post-tool-use" || event === "post-tool-use-failure"
      ? stringifyJson(source["tool_input"] ?? source["input"] ?? source["toolInput"])
      : undefined;

  const toolOutput =
    event === "post-tool-use" || event === "post-tool-use-failure"
      ? stringifyJson(source["tool_output"] ?? source["output"] ?? source["toolOutput"] ?? source["error"])
      : undefined;

  return {
    sessionId: pickString(source, ["session_id", "sessionId"]),
    prompt: truncate(prompt),
    toolName: truncate(toolName),
    toolInput: truncate(toolInput),
    toolOutput: truncate(toolOutput),
    transcriptPath: truncate(pickString(source, ["transcript_path", "transcriptPath"])),
    cwd: truncate(pickString(source, ["cwd", "working_directory", "workingDirectory"])),
    raw: source,
  };
}

export async function readHookStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  return new Promise<string>((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (error) => reject(error));
  });
}

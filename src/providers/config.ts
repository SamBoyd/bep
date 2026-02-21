import { readFile } from "node:fs/promises";
import path from "node:path";

export const PROVIDER_CONFIG_PATH = ".bep.providers.json";

export type ProviderConfig = {
  mixpanel?: {
    service_account_creds?: string;
  };
};

export type ProviderConfigResult =
  | { ok: true; value: ProviderConfig }
  | { ok: false; error: string };

export async function readProviderConfig(rootDir: string): Promise<ProviderConfigResult> {
  const configPath = path.join(rootDir, PROVIDER_CONFIG_PATH);

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        error: `Missing provider config at ${PROVIDER_CONFIG_PATH}. Run 'bep init' to scaffold it.`,
      };
    }

    return {
      ok: false,
      error: `Failed to read provider config at ${PROVIDER_CONFIG_PATH}: ${(error as Error).message}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON in ${PROVIDER_CONFIG_PATH}: ${(error as Error).message}`,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: `${PROVIDER_CONFIG_PATH} must contain a JSON object.` };
  }

  const config = parsed as ProviderConfig;
  return { ok: true, value: config };
}

export function getMixpanelServiceAccountCreds(
  config: ProviderConfig,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!config.mixpanel || typeof config.mixpanel !== "object") {
    return {
      ok: false,
      error: `Missing "mixpanel" object in ${PROVIDER_CONFIG_PATH}.`,
    };
  }

  if (
    typeof config.mixpanel.service_account_creds !== "string" ||
    config.mixpanel.service_account_creds.trim().length === 0
  ) {
    return {
      ok: false,
      error: `Missing non-empty "mixpanel.service_account_creds" in ${PROVIDER_CONFIG_PATH}.`,
    };
  }

  const creds = config.mixpanel.service_account_creds.trim();
  const colonIndex = creds.indexOf(":");
  if (colonIndex <= 0 || colonIndex !== creds.lastIndexOf(":") || colonIndex === creds.length - 1) {
    return {
      ok: false,
      error:
        `Invalid "mixpanel.service_account_creds" in ${PROVIDER_CONFIG_PATH}. ` +
        'Expected "<serviceaccount_username>:<serviceaccount_secret>".',
    };
  }

  return { ok: true, value: creds };
}

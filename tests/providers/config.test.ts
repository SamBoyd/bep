import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PROVIDER_CONFIG_PATH,
  getMixpanelServiceAccountCreds,
  readProviderConfig,
} from "../../src/providers/config";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-provider-config-test-"));
}

describe("readProviderConfig", () => {
  test("returns error when config file is missing", async () => {
    const tempDir = await createTempDir();

    try {
      const result = await readProviderConfig(tempDir);

      expect(result).toEqual({
        ok: false,
        error: `Missing provider config at ${PROVIDER_CONFIG_PATH}. Run 'bep init' to scaffold it.`,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns error for invalid JSON", async () => {
    const tempDir = await createTempDir();

    try {
      await writeFile(path.join(tempDir, PROVIDER_CONFIG_PATH), "{ invalid", "utf8");

      const result = await readProviderConfig(tempDir);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected invalid JSON parse failure");
      }
      expect(result.error).toContain(`Invalid JSON in ${PROVIDER_CONFIG_PATH}:`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns error when JSON root is not an object", async () => {
    const tempDir = await createTempDir();

    try {
      await writeFile(path.join(tempDir, PROVIDER_CONFIG_PATH), "[]\n", "utf8");

      const result = await readProviderConfig(tempDir);

      expect(result).toEqual({
        ok: false,
        error: `${PROVIDER_CONFIG_PATH} must contain a JSON object.`,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns parsed config when valid JSON object is present", async () => {
    const tempDir = await createTempDir();

    try {
      const content = {
        mixpanel: {
          service_account_creds: "svc-user:svc-secret",
        },
      };
      await writeFile(path.join(tempDir, PROVIDER_CONFIG_PATH), `${JSON.stringify(content, null, 2)}\n`, "utf8");

      const result = await readProviderConfig(tempDir);

      expect(result).toEqual({ ok: true, value: content });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("getMixpanelServiceAccountCreds", () => {
  test("returns error when mixpanel object is missing", () => {
    const result = getMixpanelServiceAccountCreds({});

    expect(result).toEqual({
      ok: false,
      error: `Missing "mixpanel" object in ${PROVIDER_CONFIG_PATH}.`,
    });
  });

  test("returns error when service_account_creds is missing", () => {
    const result = getMixpanelServiceAccountCreds({ mixpanel: {} });

    expect(result).toEqual({
      ok: false,
      error: `Missing non-empty "mixpanel.service_account_creds" in ${PROVIDER_CONFIG_PATH}.`,
    });
  });

  test("returns error when service_account_creds has invalid format", () => {
    const invalidValues = ["noseparator", ":secret", "user:", "user:secret:extra"];

    for (const value of invalidValues) {
      const result = getMixpanelServiceAccountCreds({
        mixpanel: { service_account_creds: value },
      });

      expect(result).toEqual({
        ok: false,
        error:
          `Invalid "mixpanel.service_account_creds" in ${PROVIDER_CONFIG_PATH}. ` +
          'Expected "<serviceaccount_username>:<serviceaccount_secret>".',
      });
    }
  });

  test("returns trimmed credentials when valid", () => {
    const result = getMixpanelServiceAccountCreds({
      mixpanel: { service_account_creds: "  svc-user:svc-secret  " },
    });

    expect(result).toEqual({
      ok: true,
      value: "svc-user:svc-secret",
    });
  });
});

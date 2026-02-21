import * as configModule from "../../src/providers/config";
import { getMixpanelServiceAccountCreds } from "../../src/providers/config";
import { mixpanelAdapter, mixpanelSetup, parseMixpanelLeadingIndicator } from "../../src/providers/mixpanel";

describe("mixpanel provider parse", () => {
  test("parses valid mixpanel indicator", () => {
    const result = parseMixpanelLeadingIndicator({
      type: "mixpanel",
      project_id: "3989556",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte",
      target: 20,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        type: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
        operator: "gte",
        target: 20,
      },
    });
  });

  test("rejects missing bookmark_id", () => {
    const result = parseMixpanelLeadingIndicator({
      type: "mixpanel",
      project_id: "3989556",
      workspace_id: "4485331",
      operator: "gte",
      target: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: "leading_indicator.bookmark_id must be a non-empty string.",
    });
  });

  test("rejects missing project_id", () => {
    const result = parseMixpanelLeadingIndicator({
      type: "mixpanel",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte",
      target: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: "leading_indicator.project_id must be a non-empty string.",
    });
  });

  test("rejects missing workspace_id", () => {
    const result = parseMixpanelLeadingIndicator({
      type: "mixpanel",
      project_id: "3989556",
      bookmark_id: "88319528",
      operator: "gte",
      target: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: "leading_indicator.workspace_id must be a non-empty string.",
    });
  });
});

describe("mixpanel provider config helpers", () => {
  test("rejects missing service account creds", () => {
    const result = getMixpanelServiceAccountCreds({ mixpanel: {} });
    expect(result).toEqual({
      ok: false,
      error: 'Missing non-empty "mixpanel.service_account_creds" in .bep.providers.json.',
    });
  });

  test("rejects invalid service account creds format", () => {
    const result = getMixpanelServiceAccountCreds({
      mixpanel: {
        service_account_creds: "invalid-format",
      },
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Invalid "mixpanel.service_account_creds" in .bep.providers.json. Expected "<serviceaccount_username>:<serviceaccount_secret>".',
    });
  });

  test("accepts valid service account creds", () => {
    const result = getMixpanelServiceAccountCreds({
      mixpanel: {
        service_account_creds: "user:secret",
      },
    });

    expect(result).toEqual({ ok: true, value: "user:secret" });
  });
});

describe("mixpanel adapter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("runCheck returns normalized result shape", async () => {
    jest.spyOn(configModule, "readProviderConfig").mockResolvedValue({
      ok: true,
      value: { mixpanel: { service_account_creds: "svc-user:svc-secret" } },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 21 }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const indicator = {
      type: "mixpanel" as const,
      project_id: "3989556",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte" as const,
      target: 20,
    };
    const result = await mixpanelAdapter.runCheck(indicator, {
      rootDir: "/tmp",
      betId: "landing-page",
      nowIso: "2026-02-18T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://mixpanel.com/api/query/insights?project_id=3989556&workspace_id=4485331&bookmark_id=88319528",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );

    expect(result).toEqual({
      observedValue: 21,
      meetsTarget: true,
      meta: {
        provider: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
      },
    });
  });

  test("runCheck parses single-value series response", async () => {
    jest.spyOn(configModule, "readProviderConfig").mockResolvedValue({
      ok: true,
      value: { mixpanel: { service_account_creds: "svc-user:svc-secret" } },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        headers: ["$metric"],
        series: {
          "Uniques of Session Start": {
            all: 13,
          },
        },
      }),
    }) as unknown as typeof fetch;

    const indicator = {
      type: "mixpanel" as const,
      project_id: "3989556",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte" as const,
      target: 20,
    };

    await expect(
      mixpanelAdapter.runCheck(indicator, {
        rootDir: "/tmp",
        betId: "landing-page",
        nowIso: "2026-02-18T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      observedValue: 13,
      meetsTarget: false,
      meta: {
        provider: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
      },
    });
  });

  test("runCheck throws when series has no numeric values", async () => {
    jest.spyOn(configModule, "readProviderConfig").mockResolvedValue({
      ok: true,
      value: { mixpanel: { service_account_creds: "svc-user:svc-secret" } },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        headers: ["$metric"],
        series: {
          "Uniques of Session Start": {
            all: "n/a",
          },
        },
      }),
    }) as unknown as typeof fetch;

    const indicator = {
      type: "mixpanel" as const,
      project_id: "3989556",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte" as const,
      target: 20,
    };

    await expect(
      mixpanelAdapter.runCheck(indicator, {
        rootDir: "/tmp",
        betId: "landing-page",
        nowIso: "2026-02-18T00:00:00.000Z",
      }),
    ).rejects.toThrow("Mixpanel response series must contain exactly one numeric value; found 0.");
  });

  test("runCheck throws when series has multiple numeric values", async () => {
    jest.spyOn(configModule, "readProviderConfig").mockResolvedValue({
      ok: true,
      value: { mixpanel: { service_account_creds: "svc-user:svc-secret" } },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        headers: ["$metric"],
        series: {
          "Uniques of Session Start": {
            "2026-02-18T00:00:00-08:00": 10,
            "2026-02-19T00:00:00-08:00": 13,
          },
        },
      }),
    }) as unknown as typeof fetch;

    const indicator = {
      type: "mixpanel" as const,
      project_id: "3989556",
      workspace_id: "4485331",
      bookmark_id: "88319528",
      operator: "gte" as const,
      target: 20,
    };

    await expect(
      mixpanelAdapter.runCheck(indicator, {
        rootDir: "/tmp",
        betId: "landing-page",
        nowIso: "2026-02-18T00:00:00.000Z",
      }),
    ).rejects.toThrow(
      "Mixpanel response series must contain exactly one numeric value; found 2. Use a single-value insight/report.",
    );
  });

  test("setup returns a mixpanel indicator from setup prompt client", async () => {
    const result = await mixpanelSetup.collectNewWizardInput({
      allowBack: true,
      client: {
        async promptMixpanelProjectId() {
          return { kind: "value", value: "3989556" };
        },
        async promptMixpanelWorkspaceId() {
          return { kind: "value", value: "4485331" };
        },
        async promptMixpanelBookmarkId() {
          return { kind: "value", value: "88319528" };
        },
        async promptMixpanelOperator() {
          return { kind: "value", value: "lte" };
        },
        async promptMixpanelTarget() {
          return { kind: "value", value: 12 };
        },
      },
    });

    expect(result).toEqual({
      kind: "value",
      value: {
        type: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
        operator: "lte",
        target: 12,
      },
    });
  });
});

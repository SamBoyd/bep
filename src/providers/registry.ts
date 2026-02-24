import { manualProviderModule } from "./manual.js";
import { mixpanelProviderModule } from "./mixpanel.js";
import type { LeadingIndicator, ProviderModule, ProviderRegistry } from "./types.js";

export const providerRegistry: ProviderRegistry = {
  manual: manualProviderModule,
  mixpanel: mixpanelProviderModule,
};

export function resolveProviderModule(type: string): ProviderModule<LeadingIndicator> | undefined {
  return providerRegistry[type];
}

export function listRegisteredProviderTypes(): string[] {
  return Object.keys(providerRegistry);
}

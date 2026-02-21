import { manualProviderModule } from "./manual";
import { mixpanelProviderModule } from "./mixpanel";
import type { LeadingIndicator, ProviderModule, ProviderRegistry } from "./types";

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

import { manualProviderModule } from "./manual";
import type { LeadingIndicator, ProviderModule, ProviderRegistry } from "./types";

export const providerRegistry: ProviderRegistry = {
  manual: manualProviderModule,
};

export function resolveProviderModule(type: string): ProviderModule<LeadingIndicator> | undefined {
  return providerRegistry[type];
}

export function listRegisteredProviderTypes(): string[] {
  return Object.keys(providerRegistry);
}

import { Box, Text } from "ink";
import type { PropsWithChildren } from "react";
import type { BetCardPreviewModel } from "../betCardPreview.js";

function Section({
  title,
  children,
  flexGrow,
  width,
}: PropsWithChildren<{
  title: string;
  flexGrow?: number;
  width?: number;
}>) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      paddingY={0}
      marginTop={1}
      flexGrow={flexGrow}
      width={width}
    >
      <Text bold>{title}</Text>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}

function FieldLine({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return (
    <Text>
      <Text dimColor>{label}: </Text>
      {empty ? <Text dimColor>{value}</Text> : value}
    </Text>
  );
}

export function BetCard({ model }: { model: BetCardPreviewModel }) {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={0}>
      <Text bold>Bet Card Preview</Text>

      <Section title={model.betName.label}>
        {model.betName.empty ? <Text dimColor>{model.betName.value}</Text> : <Text>{model.betName.value}</Text>}
      </Section>

      <Section title="Assumption & Validation Plan">
        <FieldLine label="Assumption" value={model.primaryAssumption.value} empty={model.primaryAssumption.empty} />
        <Box marginTop={1}>
          <FieldLine label="Validation plan" value={model.validationPlan.value} empty={model.validationPlan.empty} />
        </Box>
      </Section>

      <Box flexDirection="row">
        <Box marginRight={1}>
          <Section title="Providers" width={24}>
            {model.providers.map((provider) => (
              <Text key={provider.type} inverse={provider.selected} color={provider.selected ? "cyan" : undefined}>
                {provider.selected ? "›" : " "} {provider.label}
              </Text>
            ))}
          </Section>
        </Box>

        <Section title={model.providerConfigTitle} flexGrow={1}>
          {model.providerConfigFields.map((field) => (
            <FieldLine key={field.label} label={field.label} value={field.value} empty={field.empty} />
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Validation passes when:</Text>
            <Text>{model.validationRuleSummary}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Exposure cap:</Text>
            <Text>{model.capSummary}</Text>
          </Box>
        </Section>
      </Box>
    </Box>
  );
}

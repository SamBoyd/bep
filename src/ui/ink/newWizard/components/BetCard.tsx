import { Box, Text, measureElement } from "ink";
import type { DOMElement } from "ink";
import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import type { BetCardPreviewModel } from "../betCardPreview.js";

function useMeasuredSize() {
  const ref = useRef<DOMElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const update = () => {
      const next = measureElement(node);
      setSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };

    update();
    node.onRender = update;

    return () => {
      if (node.onRender === update) {
        node.onRender = undefined;
      }
    };
  }, []);

  return { ref, size };
}

function HorizontalDivider() {
  const { ref, size } = useMeasuredSize();
  const width = Math.max(1, size.width);

  return (
    <Box ref={ref} width="100%" overflow="hidden">
      <Text dimColor>{Array.from({ length: width }, () => "─").join("")}</Text>
    </Box>
  );
}

function VerticalDivider() {
  const { ref, size } = useMeasuredSize();
  const height = Math.max(1, size.height);

  return (
    <Box ref={ref} height="100%" alignSelf="stretch" flexDirection="column" overflow="hidden">
      {Array.from({ length: height }, (_, index) => (
        <Text key={index} dimColor>
          │
        </Text>
      ))}
    </Box>
  );
}

function Section({
  title,
  children,
  flexGrow,
  width,
}: PropsWithChildren<{
  title?: string;
  flexGrow?: number;
  width?: number;
}>) {
  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      flexGrow={flexGrow}
      width={width}
    >
      {title && title !== "" ? <Text bold>{title}</Text> : null}
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

      <Section>
        {model.betName.empty ? <Text dimColor>{model.betName.value}</Text> : <Text>{model.betName.value}</Text>}
      </Section>

      <HorizontalDivider />

      <Section >
        <FieldLine label="Assumption" value={model.primaryAssumption.value} empty={model.primaryAssumption.empty} />
        <Box marginTop={1}>
          <FieldLine label="Validation plan" value={model.validationPlan.value} empty={model.validationPlan.empty} />
        </Box>
      </Section>

      <HorizontalDivider />

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

        <VerticalDivider />

        <Section title={model.providerConfigTitle} flexGrow={1}>
          <Box marginTop={1} flexDirection="column">
            {model.providerConfigFields.map((field) => (
              <FieldLine key={field.label} label={field.label} value={field.value} empty={field.empty} />
            ))}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Validation passes when:</Text>
            <Text>{model.validationRuleSummary}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Time cap:</Text>
            <Text>{model.capSummary}</Text>
          </Box>
        </Section>
      </Box>
    </Box>
  );
}

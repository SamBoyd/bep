import { Box, Text } from "ink";
import type { PropsWithChildren } from "react";

export function WizardFrame({
  title,
  helpText,
  error,
  children,
}: PropsWithChildren<{
  title: string;
  helpText?: string;
  error?: string;
}>) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={0}>
      <Text bold>{title}</Text>
      {helpText ? <Text dimColor>{helpText}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

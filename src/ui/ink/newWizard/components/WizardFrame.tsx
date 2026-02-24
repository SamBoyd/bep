import { Box, Text } from "ink";
import type { PropsWithChildren } from "react";

export function WizardFrame({
  title,
  helpText,
  allowBack,
  error,
  children,
}: PropsWithChildren<{
  title: string;
  helpText?: string;
  allowBack: boolean;
  error?: string;
}>) {
  return (
    <Box flexDirection="column" paddingX={1}>
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
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Enter: submit | Esc/Ctrl+C: cancel</Text>
        {allowBack ? <Text dimColor>Type &quot;b&quot; then Enter to go back (text prompts) or choose Back</Text> : null}
      </Box>
    </Box>
  );
}

import { Box, Text } from "ink";
import type { TextPromptRequest } from "../types.js";

export function TextStep({
  prompt,
  value,
}: {
  prompt: TextPromptRequest;
  value: string;
}) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">&gt;</Text> {value}
        <Text inverse> </Text>
      </Text>
      {prompt.optional ? <Text dimColor>Optional field.</Text> : null}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { TextPromptRequest } from "../types.js";

export function TextStep({
  prompt,
  value,
}: {
  prompt: TextPromptRequest;
  value: string;
}) {
  const showPlaceholder = value.length === 0 && Boolean(prompt.placeholder);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">&gt;</Text>{" "}
        {value}
        {showPlaceholder ? <Text dimColor>{prompt.placeholder}</Text> : null}
        <Text inverse> </Text>
      </Text>
      {prompt.optional ? <Text dimColor>Optional field.</Text> : null}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { SelectPromptRequest } from "../types.js";

export function SelectStep({
  prompt,
  selectedIndex,
}: {
  prompt: SelectPromptRequest;
  selectedIndex: number;
}) {
  return (
    <Box flexDirection="column">
      {prompt.options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Text key={option.value} color={selected ? "cyan" : undefined} inverse={selected}>
            {selected ? "›" : " "} {option.label}
          </Text>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>Up/Down: move selection</Text>
      </Box>
    </Box>
  );
}

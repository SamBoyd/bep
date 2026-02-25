export type SelectPromptOption = {
  label: string;
  value: string;
};

export type SelectPromptRequest = {
  title: string;
  options: SelectPromptOption[];
  initialValue?: string;
  helpText?: string;
};

export type TextPromptRequest = {
  title: string;
  initialValue?: string;
  helpText?: string;
  placeholder?: string;
  optional?: boolean;
  validate?: (rawValue: string) => string | undefined;
};

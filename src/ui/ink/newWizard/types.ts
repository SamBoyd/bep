export type SelectPromptOption = {
  label: string;
  value: string;
};

export type SelectPromptRequest = {
  title: string;
  options: SelectPromptOption[];
  initialValue?: string;
  helpText?: string;
  allowBack: boolean;
};

export type TextPromptRequest = {
  title: string;
  initialValue?: string;
  helpText?: string;
  allowBack: boolean;
  optional?: boolean;
  validate?: (rawValue: string) => string | undefined;
};

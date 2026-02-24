/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleNameMapper: {
    "^\\.\\.\\/\\.\\.\\/src\\/ui\\/checkPrompt\\.js$": "<rootDir>/src/ui/checkPrompt.ts",
    "^\\.\\.\\/\\.\\.\\/src\\/ui\\/newWizard\\.js$": "<rootDir>/src/ui/newWizard.ts",
    "^\\.\\.\\/\\.\\.\\/src\\/ui\\/newBetName\\.js$": "<rootDir>/src/ui/newBetName.ts",
    "^\\.\\.\\/\\.\\.\\/src\\/providers\\/config\\.js$": "<rootDir>/src/providers/config.ts",
    "^(\\.{1,2}/.*?/src/.*)\\.js$": "$1.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          jsx: "react-jsx",
          isolatedModules: true,
        },
      },
    ],
  },
  verbose: false,
};

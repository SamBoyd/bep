import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  external: ["@clack/prompts", "commander", "gray-matter", "ink", "react"],
  sourcemap: true,
  clean: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  sourcemap: true,
  clean: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});


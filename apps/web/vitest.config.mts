import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*": ["./*"] so tests can import the same way
// app code does. jsdom environment added in package 2.4 for component tests
// (DataTable, SearchInput, pickers) — the existing pure-logic lib tests run
// fine under it too, just with a (negligible) DOM setup cost they don't use.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});

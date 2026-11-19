import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*": ["./*"] so tests can import the same way
// app code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});

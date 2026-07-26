import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Tests run outside Next's server/client bundling layers, so `server-only`
      // would otherwise always hit its throwing implementation. Next's own
      // webpack config aliases this to the no-op build on the server layer —
      // mirror that here since our unit tests aren't verifying the RSC
      // boundary, just the logic behind it.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
});

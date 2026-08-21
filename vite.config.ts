import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend now lives in doc-cat-api/compliance-assessment, host port remapped to 8100.
      "/api": "http://localhost:8100",
    },
  },
});

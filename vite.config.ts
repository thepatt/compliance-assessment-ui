import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend is now integrated into doc-cat-api's main app (default local port 8000).
      "/api": "http://localhost:8000",
    },
  },
});

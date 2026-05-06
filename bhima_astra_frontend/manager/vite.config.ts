import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/manager": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/zones": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/workers": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/policies": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});

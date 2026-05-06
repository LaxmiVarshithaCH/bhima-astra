import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const r = (pkg: string) => path.resolve(__dirname, "node_modules", pkg);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/v1":   { target: "http://localhost:8000", changeOrigin: true },
      "/auth":     { target: "http://localhost:8000", changeOrigin: true },
      "/workers":  { target: "http://localhost:8000", changeOrigin: true },
      "/policies": { target: "http://localhost:8000", changeOrigin: true },
      "/ml":       { target: "http://localhost:8000", changeOrigin: true },
      "/zones":    { target: "http://localhost:8000", changeOrigin: true },
      "/payouts":  { target: "http://localhost:8000", changeOrigin: true },
      "/chat":     { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 6000,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":   ["react", "react-dom", "react-router-dom"],
          "vendor-motion":  ["framer-motion"],
          "vendor-three":   ["three", "@react-three/fiber", "@react-three/drei"],
          "vendor-gsap":    ["gsap"],
          "vendor-ui":      ["lucide-react"],
        },
      },
    },
  },
  resolve: {
    dedupe: [
      "react", "react-dom", "framer-motion", "react-router-dom",
      "lucide-react", "gsap", "@react-three/fiber", "@react-three/drei", "three",
    ],
    alias: {
      react:                r("react"),
      "react-dom":          r("react-dom"),
      "framer-motion":      r("framer-motion"),
      "react-router-dom":   r("react-router-dom"),
      "lucide-react":       r("lucide-react"),
      gsap:                 r("gsap"),
      "@react-three/fiber": r("@react-three/fiber"),
      "@react-three/drei":  r("@react-three/drei"),
      three:                r("three"),
    },
  },
  optimizeDeps: {
    include: [
      "react", "react-dom", "react-dom/client",
      "react/jsx-runtime", "react/jsx-dev-runtime",
      "framer-motion", "react-router-dom", "lucide-react",
      "gsap", "@react-three/fiber", "@react-three/drei", "three",
    ],
  },
});

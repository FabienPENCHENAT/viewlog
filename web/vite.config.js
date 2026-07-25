import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Autorise l'import du CHANGELOG.md situé à la racine du dépôt (?raw).
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
  },
});

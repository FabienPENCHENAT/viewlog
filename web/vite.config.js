import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Autorise l'import de docs/CHANGELOG.md (hors racine Vite) via ?raw.
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
  },
});

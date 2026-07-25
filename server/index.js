import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Ce serveur ne fait QUE servir le front statique.
// Le parsing et le stockage des logs sont 100 % côté navigateur (IndexedDB) :
// aucune donnée client n'est reçue ni persistée ici.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, "public"));

const app = express();

// --- Front statique (build Vite) ---
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  // SPA fallback pour React Router
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`viewLog démarré sur http://localhost:${PORT}`);
});

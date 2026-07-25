# --- Étape 1 : build du front React (Vite) ---
FROM node:20-alpine AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- Étape 2 : image finale (Express sert uniquement le front statique) ---
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

COPY server/ ./
# Le front buildé est servi en statique par Express depuis ./public
COPY --from=web-build /web/dist ./public

EXPOSE 3001
CMD ["node", "index.js"]

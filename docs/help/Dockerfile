# LokkyWork-Hilfe – statisches Hosting via nginx.
# Astro `build` erzeugt rein statische Dateien in ./dist, die nginx ausliefert.
#
# Build:  docker build -t lokkywork-docs ./docs/help
# Run:    docker run -p 8080:80 lokkywork-docs   ->  http://localhost:8080
#
# Coolify-Dockerfile-Deployment: nginx lauscht auf Port 80 (EXPOSE 80) – Coolify
# erkennt den Port automatisch und legt SSL/Domain (docs.lokyy.de) davor.

# ---------- Stage 1: Build ----------
FROM oven/bun:1.3-debian AS builder
WORKDIR /app

# Abhängigkeiten zuerst (besseres Layer-Caching)
COPY package.json ./
RUN bun install

# Quellcode kopieren und statisch bauen
COPY . .
RUN bun run build

# ---------- Stage 2: Auslieferung ----------
FROM nginx:1.27-alpine AS runner

# Astro-Output als Web-Root
COPY --from=builder /app/dist /usr/share/nginx/html

# Docs-freundliche nginx-Konfiguration (try_files auf .html, saubere 404-Behandlung)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx lauscht auf Port 80 – Coolify erkennt diesen Port.
EXPOSE 80

# Vordergrund-Start, damit Coolify/Docker den Container-Lebenszyklus sauber steuert.
CMD ["nginx", "-g", "daemon off;"]

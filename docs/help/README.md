# LokkyWork-Hilfe (Produktdokumentation)

Self-hosted deutsche Produktdokumentation für **LokkyWork**, gebaut mit [Starlight](https://starlight.astro.build/) (Astro). Das ist die Hilfe, die später aus der App heraus verlinkt wird.

Dieses Verzeichnis (`docs/help/`) ist ein **eigenständiges Projekt** mit eigener `package.json`. Es ist bewusst **nicht** Teil der Root-Workspaces (`packages/*`) und stört den Electron-App-Build nicht.

## Voraussetzungen

- [Bun](https://bun.sh) (das Repo nutzt bun/bunx, kein npm)

## Entwicklung

```bash
cd docs/help
bun install
bun run dev
```

Die Doku läuft dann unter **http://localhost:4321**.

## Build (statisch)

```bash
bun run build      # erzeugt rein statische Dateien in ./dist
bun run preview    # lokale Vorschau des Builds (http://localhost:4321)
```

Astro erzeugt **ausschließlich statische Dateien** in `dist/` – kein Node-Server nötig. Ideal hinter einem Webserver wie nginx oder Caddy.

## Deploy auf Coolify

Die Doku wird per **Coolify** deployt (wie GlitchTip). Es gibt zwei Wege – Variante A ist die einfachste.

> **Wichtig (Monorepo):** Die App liegt im Unterordner `docs/help/`. In Coolify ist das
> **Base Directory** aber `docs` (der Doku-Ordner im Repo). Build-Befehl und Ausgabe-Ordner
> müssen deshalb den `help/`-Unterpfad enthalten.

### Variante A — Statische Site (empfohlen)

In Coolify eine neue **Static**-App vom Git-Repo anlegen und diese Werte setzen:

| Feld                          | Wert                                  |
| ----------------------------- | ------------------------------------- |
| **Base Directory**            | `docs`                                |
| **Build Command**             | `cd help && bun install && bun run build` |
| **Publish / Output Directory** | `help/dist`                           |
| **Domain**                    | `docs.lokyy.de`                       |

Astro (`astro build`) erzeugt rein statische Dateien in `help/dist/`, die Coolify direkt
ausliefert. SSL via Let's Encrypt übernimmt Coolify automatisch. Die eingebaute
Pagefind-Suche und die Sitemap werden beim Build mit erzeugt.

> Stellt Coolify das Base Directory bereits auf den Build-Ordner um (sodass `cd help`
> entfällt), dann **Base Directory** = `docs/help`, **Build Command** = `bun install &&
> bun run build`, **Output Directory** = `dist`.

### Variante B — Dockerfile

Alternativ als **Dockerfile**-Deployment. Das mitgelieferte `Dockerfile` ist multi-stage
(Build mit bun → statisches `dist/` via nginx ausliefern) und exponiert **Port 80** – Coolify
erkennt den Port automatisch und legt Domain + SSL davor.

| Feld                | Wert         |
| ------------------- | ------------ |
| **Base Directory**  | `docs`       |
| **Dockerfile**      | `help/Dockerfile` |
| **Port**            | `80`         |
| **Domain**          | `docs.lokyy.de` |

Lokal testen:

```bash
docker build -t lokkywork-docs ./docs/help
docker run -p 8080:80 lokkywork-docs    # -> http://localhost:8080
```

Die mitgelieferte `nginx.conf` liefert die Seiten korrekt aus (`try_files` auf die jeweilige
`.html`, inkl. Starlight-404-Seite).

> **`site`-URL:** In `astro.config.mjs` ist `site: 'https://docs.lokyy.de'` gesetzt – das
> steuert absolute URLs und die Sitemap. Bei einer anderen Domain dort anpassen. Für einen
> Unterpfad (z. B. `https://docs.lokyy.de/hilfe`) zusätzlich `base: '/hilfe'` setzen.

## Self-Hosting ohne Coolify

Den Inhalt von `dist/` auf einen beliebigen Webserver legen (nginx, Caddy, GitHub Pages, Netlify …). Beispiel nginx:

```nginx
server {
    listen 80;
    server_name docs.lokyy.de;
    root /var/www/lokkywork-docs/dist;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
    error_page 404 /404.html;
}
```

## Volltextsuche

Die Suche ist eingebaut ([Pagefind](https://pagefind.app/)) und wird beim `build` automatisch erzeugt – keine zusätzliche Konfiguration nötig.

## Struktur

```
docs/help/
├── src/
│   ├── content/docs/      # Die Inhalte (MDX) – eine Datei pro Seite
│   ├── content.config.ts  # Starlight Content-Collection
│   └── assets/            # Logo (Dragon-Icon)
├── public/                # Favicon (Dragon-Icon)
├── astro.config.mjs       # Starlight-Konfiguration: Titel, Logo, Sidebar, Sprache
├── Dockerfile             # statisches Hosting via nginx
├── nginx.conf
└── package.json           # eigenständig, NICHT Teil der Root-Workspaces
```

Inhalte bearbeitest du als `.mdx`-Dateien unter `src/content/docs/`. Die Reihenfolge und Gruppierung der Sidebar steuerst du in `astro.config.mjs` (Feld `sidebar`).

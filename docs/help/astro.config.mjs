// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

// LokkyWork-Hilfe – Starlight (Astro).
// Astro `build` erzeugt rein statische Dateien in ./dist (ideal hinter nginx).
// Dieses Projekt liegt isoliert in docs/help/ mit eigener package.json und ist
// NICHT Teil der Root-Workspaces – der Electron-App-Build bleibt unberührt.
export default defineConfig({
  // Bei Auslieferung unter einem Unterpfad (z. B. https://docs.lokyy.de/hilfe) hier
  // `base: '/hilfe'` setzen. Standard: ausgeliefert an der Wurzel.
  // `site` steuert absolute URLs und die Sitemap – auf die echte Coolify-Domain setzen.
  site: 'https://docs.lokyy.de',
  integrations: [
    starlight({
      title: 'LokkyWork Hilfe',
      description:
        'Hilfe und Dokumentation für LokkyWork – die lokale, datenschutzfreundliche KI-Arbeitsumgebung.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
      },
      logo: {
        src: './src/assets/dragon-icon.png',
        alt: 'LokkyWork',
      },
      favicon: '/dragon-icon.png',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/oliverhees/LokkyWork',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/oliverhees/LokkyWork/edit/main/docs/help/',
      },
      lastUpdated: true,
      pagination: true,
      // Deutsche Navigation / Sidebar.
      sidebar: [
        { label: 'Überblick', link: '/' },
        {
          label: 'Erste Schritte',
          items: [
            { label: 'Erste Schritte', link: '/erste-schritte/' },
            { label: 'Modelle & Anbieter', link: '/modelle-anbieter/' },
          ],
        },
        {
          label: 'Konfiguration',
          items: [
            { label: 'Assistenten', link: '/assistenten/' },
            { label: 'Multi-Agent-Modus (ACP)', link: '/multi-agent/' },
            { label: 'Fähigkeiten & MCP', link: '/faehigkeiten-mcp/' },
            { label: 'Skills-Ökosystem', link: '/skills-oekosystem/' },
            { label: 'Bildgenerierung', link: '/bildgenerierung/' },
            { label: 'Remote-Zugriff', link: '/remote/' },
            { label: 'DingTalk-Bot', link: '/dingtalk/' },
          ],
        },
        {
          label: 'Funktionen',
          items: [
            { label: 'Workflows', link: '/workflows/' },
            { label: 'Geplante Aufgaben', link: '/geplante-aufgaben/' },
            { label: 'Vorschau-Panel', link: '/preview-panel/' },
            { label: 'Second Brain', link: '/second-brain/' },
            { label: 'PII-Schutz', link: '/pii-schutz/' },
            { label: 'Einstellungen', link: '/einstellungen/' },
          ],
        },
        {
          label: 'Anwendungsfälle',
          items: [
            { label: 'Übersicht', link: '/anwendungsfaelle/' },
            { label: 'Dateiverwaltung', link: '/anwendungsfaelle/dateiverwaltung/' },
            { label: 'Excel-Verarbeitung', link: '/anwendungsfaelle/excel/' },
            { label: 'Informationsrecherche', link: '/anwendungsfaelle/informationsrecherche/' },
            { label: 'Lokale Wissensbasis', link: '/anwendungsfaelle/wissensbasis/' },
            { label: 'Lern-Assistent', link: '/anwendungsfaelle/lern-assistent/' },
            { label: 'Schreiben & Inhalte', link: '/anwendungsfaelle/schreiben/' },
          ],
        },
        {
          label: 'Hilfe',
          items: [{ label: 'FAQ & Support', link: '/faq/' }],
        },
      ],
    }),
  ],
})

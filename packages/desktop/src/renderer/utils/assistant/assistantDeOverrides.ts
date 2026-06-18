/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side German (de-DE) translations for the built-in assistants.
 *
 * The aioncore backend ships builtin assistants only in en-US / zh-CN / uk-UA /
 * ru-RU — no de-DE — and blocks client writes to builtin rules. So for the
 * German LokkyWork edition we inject de-DE display texts (name / description /
 * starter prompts) into the assistant objects after loading. The UI already
 * prefers `name_i18n['de-DE']`, so these surface automatically for German users.
 *
 * Scope: DISPLAY texts only (Phase 1). The behavioral rules/context are handled
 * separately. Product name "AionUi" is rebranded to "LokkyWork"; proper nouns
 * and technical terms (officecli, OpenClaw, moltbook, Morph, HUMAN 3.0, …) are
 * kept verbatim.
 */

import type { Assistant } from '@/common/types/agent/assistantTypes';

export type AssistantLocaleOverride = {
  name: string;
  description: string;
  prompts: string[];
};

/** de-DE display overrides keyed by builtin assistant id. */
export const ASSISTANT_DE_OVERRIDES: Record<string, AssistantLocaleOverride> = {
  'morph-ppt-3d': {
    name: '3D Morph PPT',
    description:
      'Verwandle ein GLB-3D-Modell in eine cineastische Morph-Präsentation. Das Modell ist der visuelle Hauptdarsteller – Nahaufnahme für Details, Vogelperspektive für die Struktur, Untersicht für Dramatik, mit fließenden Morph-Übergängen zwischen jeder Einstellung. Hinweis: 3D-Modelle und Morph-Übergänge benötigen Microsoft PowerPoint zur korrekten Darstellung.',
    prompts: [
      'Nutze dieses GLB-Modell für eine Produktpräsentation. Der Inhalt soll sich um das Modell drehen – was es ist, seine Eigenschaften, seine Geschichte. Jede Folie zeigt einen anderen, zum Thema passenden Blickwinkel: Nahaufnahme für Details, Vogelperspektive für die Struktur, dramatische Untersicht für den Höhepunkt.',
      'Hier ist mein GLB-Modell. Studiere es genau und erstelle dann eine cineastische Präsentation, in der das Modell in jedem Bild der Hauptdarsteller ist. Ich möchte abwechslungsreiche Kameraführung: Heranzoomen für Detailaufnahmen, Herauszoomen für die Übersicht, das Modell für dramatische Übergänge über den Rand hinauslaufen lassen.',
      'Baue eine Präsentation rund um dieses 3D-Modell, die sich wie ein Kinotrailer anfühlt. Große dramatische Momente, intime Nahaufnahmen, weite Übersichtsaufnahmen. Die Geschichte soll zu dem passen, was das Modell tatsächlich ist – füge nicht einfach generischen Text hinzu.',
    ],
  },
  'excel-creator': {
    name: 'Excel-Ersteller',
    description:
      'Erstelle, bearbeite und analysiere professionelle Excel-Tabellen mit officecli. Finanzmodelle, Dashboards, Tracker und Datenanalysen.',
    prompts: [
      'Baue ein Finanz-Dashboard über 3 Tabellenblätter mit Gewinn-und-Verlust-Rechnung, Umsatzaufschlüsselungs-Diagramm und bedingter Formatierung für Abweichungen',
      'Erstelle einen Sales-Pipeline-Tracker mit Deal-Phasen, gewichteten Pipeline-Formeln, Funnel-Diagramm und Performance-Scorecards je Vertriebsmitarbeiter',
      'Erstelle einen Budget-Tracker mit blattübergreifenden Abweichungsformeln, Balkendiagramm „Budget vs. Ist" und farblich markierten Budgetüberschreitungen',
    ],
  },
  'pitch-deck-creator': {
    name: 'Pitch-Deck-Ersteller',
    description:
      'Erstelle Investor-Pitch-Decks, Produktlaunch-Präsentationen und Enterprise-Sales-Decks mit Verlaufsdesigns, Datendiagrammen, Wettbewerbstabellen, Team-Folien und Sprechernotizen. Unterstützt Decks von Seed bis Series A+.',
    prompts: [
      'Erstelle ein 12-Folien-Series-A-Investor-Deck für ein B2B-SaaS-Data-Pipeline-Startup mit ARR-Diagrammen, Wettbewerbsvergleichstabelle, Team-Avataren und Finanzprognosen',
      'Erstelle ein 8-Folien-Produktlaunch-Deck für ein KI-Code-Review-Tool mit 5 Feature-Icons, Vorher-Nachher-Vergleich, Donut-Diagramm zur Kundenzufriedenheit und dreistufiger Preistabelle',
      'Erstelle ein 10-Folien-Enterprise-Sales-Deck für eine Cybersecurity-Plattform mit ROI-Analyse, Netzdiagramm im Wettbewerbsvergleich, Tabelle der finanziellen Auswirkungen und Umsetzungs-Zeitplan',
    ],
  },
  'morph-ppt': {
    name: 'Morph PPT',
    description:
      'Erstelle professionelle Morph-animierte Präsentationen mit officecli. Unterstützt mehrere visuelle Stile und den durchgängigen Ablauf vom Thema bis zu fertig ausgearbeiteten Folien.',
    prompts: [
      'Wähle selbst ein spannendes Thema und erstelle eine vollständige PPT',
      'Erstelle die schönste PPT, die du dir vorstellen kannst – das Thema bleibt dir überlassen',
      'Erstelle eine PPT zur Vorstellung einer Kaffeemarke mit minimalistischem, hochwertigem Look',
    ],
  },
  'social-job-publisher': {
    name: 'Social-Media-Stellenausschreiber',
    description:
      'Erweitere Einstellungswünsche zu einer vollständigen Stellenbeschreibung samt Bildern und veröffentliche sie über Connectors auf Social-Media-Plattformen.',
    prompts: [
      'Erstelle eine umfassende Stellenanzeige für Senior Full-Stack Engineer',
      'Formuliere einen ansprechenden Recruiting-Tweet für Social Media',
      'Erstelle eine plattformübergreifende Stellenanzeige (LinkedIn, X, Redbook)',
    ],
  },
  'word-form-creator': {
    name: 'Word-Formular-Ersteller',
    description:
      'Erstelle ausfüllbare Word-Formulare (.docx) mit echten Inhaltssteuerelementen, Kontrollkästchen-Feldern, MERGEFIELD-Platzhaltern für Seriendruck und Dokumentschutz – nur vorgesehene Felder sind bearbeitbar, der Rest bleibt gesperrt. HR-Aufnahmen, Umfragen, Vertrags-/SOW-Vorlagen, Compliance-Checklisten, medizinische Aufnahmebögen.',
    prompts: [
      'Baue ein .docx-Onboarding-Formular für neue Mitarbeitende mit Feldern für vollständigen Namen, Eintrittsdatum, Abteilung, Führungskraft, rollenbasierte Schulungs-Checkliste und Kontrollkästchen für die Geräteanforderung; nur die Felder sind bearbeitbar.',
      'Erstelle eine .docx-SOW-Vertragsvorlage mit Seriendruck-Platzhaltern für Kundenname, Startdatum, Leistungs-Stichpunkte, Gesamthonorar und Signaturblöcke; schütze alles außer dem Signaturbereich.',
      'Erstelle einen .docx-Fragebogen zur medizinischen Aufnahme mit Dropdown für den Besuchsgrund, Textfeldern für Allergien/aktuelle Medikation, Kontrollkästchen-Raster für Vorerkrankungen und einer Signaturzeile am Ende.',
    ],
  },
  cowork: {
    name: 'Cowork',
    description:
      'Autonome Aufgabenausführung mit Dateioperationen, Dokumentenverarbeitung und mehrstufiger Workflow-Planung.',
    prompts: [
      'Analysiere die aktuelle Projektstruktur und schlage Verbesserungen vor',
      'Automatisiere den Build- und Deployment-Prozess',
      'Extrahiere und fasse die wichtigsten Informationen aus allen PDF-Dateien zusammen',
    ],
  },
  moltbook: {
    name: 'moltbook',
    description:
      'Das soziale Netzwerk für KI-Agenten. Poste, kommentiere, vote und gründe Communitys.',
    prompts: [
      'Prüfe meinen moltbook-Feed auf die neuesten Updates',
      'Poste ein interessantes Update auf moltbook',
      'Prüfe auf neue Direktnachrichten',
    ],
  },
  'human-3-coach': {
    name: 'HUMAN 3.0 Coach',
    description:
      'Persönlicher Entwicklungscoach auf Basis des HUMAN 3.0 Frameworks: 4 Quadranten (Geist/Körper/Spirit/Berufung), 3 Ebenen, 3 Wachstumsphasen.',
    prompts: [
      'Hilf mir, Quartalsziele über alle Lebensquadranten hinweg zu setzen',
      'Reflektiere meinen beruflichen Fortschritt und plane die nächsten Schritte',
      'Erstelle einen Plan zur persönlichen Entwicklung für die nächsten 3 Monate',
    ],
  },
  'game-3d': {
    name: '3D-Spiel',
    description: 'Erzeuge ein komplettes 3D-Jump-’n’-Run-Sammelspiel in einer einzigen HTML-Datei.',
    prompts: [
      'Erstelle ein 3D-Jump-’n’-Run mit Sprungmechanik',
      'Mache ein Münzsammelspiel mit Hindernissen',
      'Baue ein 3D-Labyrinth-Erkundungsspiel',
    ],
  },
  'ui-ux-pro-max': {
    name: 'UI/UX Pro Max',
    description:
      'Professionelle UI/UX-Design-Intelligenz mit 57 Stilen, 95 Farbpaletten, 56 Schriftpaarungen und Stack-spezifischen Best Practices.',
    prompts: [
      'Gestalte eine moderne Login-Seite für eine Fintech-Mobile-App',
      'Erstelle eine Farbpalette für eine Website mit Naturthema',
      'Gestalte eine Dashboard-Oberfläche für ein SaaS-Produkt',
    ],
  },
  'academic-paper': {
    name: 'Wissenschaftliche Arbeit',
    description:
      'Erstelle formal strukturierte wissenschaftliche Arbeiten, Forschungspapiere und Whitepapers mit nativem Word-Inhaltsverzeichnis, LaTeX-zu-OMML-Formeln, wissenschaftlichem Literaturverzeichnis (APA/Physics/Chicago), Fußnoten, mehrspaltigen Layouts und arbeitsart-spezifischem Styling.',
    prompts: [
      'Erstelle ein Whitepaper über ländliche EV-Ladeinfrastruktur mit Executive Summary, Datentabellen, Fußnoten, CONFIDENTIAL-Wasserzeichen und professionellen Kopfzeilen',
      'Schreibe eine physikalische Arbeit über topologische Isolatoren mit abgesetzten Formeln, mehrspaltigem Abstract, Theorem-/Definitionsblöcken und Querformat-Abbildungen',
      'Erstelle eine Forschungsarbeit im APA-Stil über Organisationskultur mit 3 Datentabellen, Endnoten, 15 Quellen mit hängendem Einzug und doppeltem Zeilenabstand',
    ],
  },
  'financial-model-creator': {
    name: 'Finanzmodell-Ersteller',
    description:
      'Baue formelgesteuerte Finanzmodelle aus Text-Prompts: integrierte Drei-Statement-Modelle, DCF-Bewertungen, Cap Tables, Szenarioanalysen, Sensitivitätstabellen und Tilgungspläne. Alle Werte fließen über miteinander verknüpfte Formelketten aus den Annahmen.',
    prompts: [
      'Baue ein dreijähriges SaaS-Finanzmodell mit Gewinn-und-Verlust-Rechnung, Bilanz, Cashflow und Dashboard-Diagrammen',
      'Erstelle eine DCF-Bewertung für ein Produktionsunternehmen mit WACC-Berechnung und Sensitivitätstabelle',
      'Baue eine Cap Table mit Seed- und Series-A-Runden, Liquidationspräferenzen und Exit-Wasserfall-Analyse',
    ],
  },
  'ppt-creator': {
    name: 'PPT-Ersteller',
    description:
      'Erstelle, bearbeite und analysiere professionelle PowerPoint-Präsentationen mit officecli. Markante Designs, abwechslungsreiche Layouts und visuelle Wirkung.',
    prompts: [
      'Erstelle ein 10-Folien-Konzept zur Kubernetes-Migration mit Architekturvergleich, Kostenanalyse und Migrations-Zeitplan',
      'Erstelle ein 10-Folien-SaaS-Analytics-Dashboard für ein Projektmanagement-Tool mit Nutzerwachstums-Diagrammen, Conversion-Funnel und Wettbewerbsumfeld',
      'Erstelle eine 10-Folien-Fintech-Produkt-Roadmap für eine digitale Zahlungsplattform mit Nutzerwachstumsverlauf und Investitionsanalyse',
    ],
  },
  'dashboard-creator': {
    name: 'Dashboard-Ersteller',
    description:
      'Verwandle CSV- oder Tabellendaten in ausgefeilte Excel-Dashboards mit KPI-Karten, an Live-Daten gekoppelten Diagrammen, Sparklines und bedingter Formatierung. Skaliert die Komplexität automatisch zur Datenmenge – von schnellen Übersichten bis zu vollständigen Analyse-Panels.',
    prompts: [
      'Erstelle ein SaaS-MRR-Dashboard mit 12 Monaten Beispieldaten – zeige MRR-Trend, monatliches Wachstum und Churn-Aufschlüsselung für ein Board-Meeting',
      'Baue ein E-Commerce-Dashboard für Regionalumsätze mit Beispieldaten über 5 Regionen: Umsatz je Region, Wochentrends und Kategorie-Aufteilung',
      'Erstelle ein „Budget vs. Ist"-Dashboard für 8 Abteilungen mit Abweichungsindikatoren und Über-/Unterbudget-Status',
    ],
  },
  'aionui-assistant': {
    name: 'LokkyWork Butler',
    description:
      'Dein Allround-LokkyWork-Butler: richte Assistenten, Skills, MCP-Server und LLM-Anbieter ein; richte den Fernzugriff ein, damit du LokkyWork vom Handy aus erreichst oder einen Link teilst; und diagnostiziere Probleme wie hängende Unterhaltungen, fehlschlagende Modelle oder eine geplante Aufgabe, die nicht ausgeführt wurde.',
    prompts: [
      'Füge einen neuen LLM-Anbieter samt API-Schlüssel hinzu und lege ihn als Standardmodell fest',
      'Richte den Fernzugriff für mich ein, damit ich LokkyWork unterwegs vom Handy aus öffnen kann',
      'Eine Unterhaltung hängt – bitte diagnostiziere, was nicht stimmt',
      'Erstelle einen neuen Assistenten und hänge einen Skill daran',
    ],
  },
  'word-creator': {
    name: 'Word-Ersteller',
    description:
      'Erstelle, bearbeite und analysiere professionelle Word-Dokumente mit officecli. Berichte, Angebote, Briefe, Memos und mehr.',
    prompts: [
      'Erstelle einen Quartalsbericht für Q1 2026 mit Inhaltsverzeichnis, Tabelle der Finanz-Highlights, Umsatztrend-Diagramm und KPI-Kennzahlenbereich',
      'Schreibe eine wissenschaftliche Arbeit über maschinelles Lernen mit LaTeX-Formeln, Zitaten, Datentabellen und Literaturverzeichnis',
      'Erstelle einen Projektstatusbericht mit DRAFT-Wasserzeichen, farblich codierter Statustabelle und einem Gantt-Zeitplan im Querformat-Abschnitt',
    ],
  },
  'beautiful-mermaid': {
    name: 'Beautiful Mermaid',
    description:
      'Erstelle Flussdiagramme, Sequenzdiagramme, Zustandsdiagramme, Klassendiagramme und ER-Diagramme mit schönen Themes.',
    prompts: [
      'Zeichne ein detailliertes Flussdiagramm zur Nutzer-Login-Authentifizierung',
      'Erstelle ein API-Sequenzdiagramm für die Zahlungsabwicklung',
      'Erstelle ein Systemarchitektur-Diagramm',
    ],
  },
  'planning-with-files': {
    name: 'Dateibasierte Planung',
    description:
      'Manus-artige dateibasierte Planung für komplexe Aufgaben. Nutzt task_plan.md, findings.md und progress.md, um den Kontext dauerhaft zu erhalten.',
    prompts: [
      'Plane eine umfassende Refactoring-Aufgabe mit Meilensteinen',
      'Zerlege die Feature-Umsetzung in umsetzbare Schritte',
      'Erstelle einen Projektplan für die Migration auf ein neues Framework',
    ],
  },
  'openclaw-setup': {
    name: 'OpenClaw-Einrichtungsexperte',
    description:
      'Experten-Leitfaden zum Installieren, Bereitstellen, Konfigurieren und Beheben von Problemen mit OpenClaw. Hilft proaktiv bei der Einrichtung, diagnostiziert Probleme und liefert Sicherheits-Best-Practices.',
    prompts: [
      'Hilf mir, OpenClaw Schritt für Schritt zu installieren',
      'Mein OpenClaw funktioniert nicht, bitte diagnostiziere das Problem',
      'Konfiguriere den Telegram-Kanal für die OpenClaw-Integration',
    ],
  },
  'story-roleplay': {
    name: 'Story-Rollenspiel',
    description:
      'Immersives Story-Rollenspiel. Starte per: 1) natürlicher Sprache zum Erstellen von Charakteren, 2) Einfügen von PNG-Bildern oder 3) Öffnen eines Ordners mit Charakterkarten (PNG/JSON) und Welt-Infos.',
    prompts: [
      'Starte ein episches Fantasy-Abenteuer mit einem tapferen Krieger',
      'Erstelle einen detaillierten Charakter mit Hintergrundgeschichte und Persönlichkeit',
      'Beginne eine interaktive Geschichte in einem Sci-Fi-Setting',
    ],
  },
};

/**
 * Inject de-DE display overrides into builtin assistants. Always adds the
 * `de-DE` entries; harmless for non-German users since the UI only reads the
 * active locale key. No-op for assistants without an override. Apply to the
 * result of `ipcBridge.assistants.list` wherever assistants are loaded.
 */
export function applyAssistantDeOverrides<T extends Assistant>(list: T[]): T[] {
  return list.map((assistant) => {
    const override = ASSISTANT_DE_OVERRIDES[assistant.id];
    if (!override) return assistant;
    return {
      ...assistant,
      name_i18n: { ...assistant.name_i18n, 'de-DE': override.name },
      description_i18n: { ...assistant.description_i18n, 'de-DE': override.description },
      prompts_i18n: { ...assistant.prompts_i18n, 'de-DE': override.prompts },
    };
  });
}

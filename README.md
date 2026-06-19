<div align="center">

# 🐉 LokkyWork

**Die deutsche Community-Edition für lokale KI-Workflows**

Kostenlos · Lokal · Open Source · auf Deutsch

</div>

---

## Was ist LokkyWork?

**LokkyWork** ist eine eigenständige, deutsch-sprachige Edition der Open-Source-App [AionUi](https://github.com/iOfficeAI/AionUi) — einer lokalen Cowork-Oberfläche für Gemini CLI, Claude Code, Codex, Qwen Code und weitere KI-Agenten.

LokkyWork richtet sich gezielt an die **deutschsprachige Community**: vollständig deutsche Oberfläche, deutsche Dokumentation und Zusatzfunktionen, die speziell für den deutschsprachigen Raum sinnvoll sind — von DSGVO-freundlichen Voreinstellungen bis zu deutschen Tool-Integrationen.

> **LokkyWork basiert auf AionUi** (Apache-2.0-Lizenz) und wird unter eigenem Namen weiterentwickelt. Die hervorragende Arbeit des AionUi-Teams bleibt die Grundlage — LokkyWork ergänzt sie um Funktionen, die in der Hauptversion nicht enthalten sind. Verbesserungen an der Basis fließen, wo sinnvoll, zurück an das Original.

---

## Was LokkyWork zusätzlich bietet

| Funktion                                                                                                                          | Status       |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 🇩🇪 **Vollständig deutsche Oberfläche** (Desktop + Mobile)                                                                         | ✅ Enthalten |
| 🐉 **Dragon-3D-Pet-Skin** — hochauflösender Begleiter-Drache mit 21 animierten Zuständen, frei wählbar neben dem klassischen Skin | ✅ Enthalten |
| 🔒 **DSGVO-freundliche Voreinstellungen**                                                                                         | 🛠️ Geplant   |
| 🕵️ **Anonymisierung sensibler Daten** vor dem Versand an KI-Modelle                                                               | 🛠️ Geplant   |
| 🧩 **Deutsche Tool- & Workflow-Integrationen**                                                                                    | 🛠️ Geplant   |

---

## Installation

### Fertige Pakete herunterladen (empfohlen)

Lade das Paket für dein Betriebssystem von der **[Releases-Seite](https://github.com/oliverhees/LokkyWork/releases)** und installiere es:

| Plattform   | Datei                                 | Installation                                                                                                                                                               |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | `LokkyWork-<version>-win-x64.exe`     | Installer ausführen. Beim ersten Start ggf. „Weitere Informationen → Trotzdem ausführen" (SmartScreen), da die Community-Edition nicht signiert ist.                       |
| **macOS**   | `LokkyWork-<version>-mac-<arch>.dmg`  | DMG öffnen, App nach „Programme" ziehen. Beim ersten Start Rechtsklick → „Öffnen" (Gatekeeper), da nicht notarisiert. `arch` = `arm64` (Apple Silicon) oder `x64` (Intel). |
| **Linux**   | `LokkyWork-<version>-linux-amd64.deb` | `sudo dpkg -i LokkyWork-*.deb` (oder per Doppelklick über das Software-Center). Danach im App-Menü als **LokkyWork** verfügbar.                                            |

> Das `aioncore`-Backend wird mitgeliefert und startet automatisch — keine separate Installation nötig.

### Aus dem Quellcode bauen (für Entwickler)

```bash
bun install
bun run dev            # Desktop-App im Entwicklungsmodus

# Installierbare Pakete erzeugen:
bun run dist:linux     # .deb (Linux)
bun run dist:mac       # .dmg (nur auf macOS baubar)
bun run dist:win       # .exe (nur auf Windows baubar)
```

> Hinweis: Plattformübergreifende Pakete (Windows + macOS + Linux) werden über den GitHub-Actions-Release-Workflow gebaut — ein Tag-Push (`v*`) erzeugt automatisch alle Pakete als Release. Lokal lässt sich pro Betriebssystem nur das jeweils eigene Paket bauen.

---

## Mitmachen

LokkyWork ist ein Community-Projekt für den deutschsprachigen Raum. Ideen, Feature-Wünsche (besonders rund um DSGVO, Datenschutz und deutsche Workflows) und Beiträge sind herzlich willkommen.

---

## Lizenz & Danksagung

LokkyWork steht unter der **Apache-2.0-Lizenz** — wie das zugrunde liegende [AionUi](https://github.com/iOfficeAI/AionUi). Alle Copyright-Hinweise und Lizenzbedingungen des Originals bleiben erhalten.

**Großer Dank an das AionUi-Team** für die offene und hochwertige Grundlage, auf der LokkyWork aufbaut. 🙏

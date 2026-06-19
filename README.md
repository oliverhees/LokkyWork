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

> ### ⬇️ Windows-Installer direkt herunterladen
>
> **[➡️ LokkyWork für Windows herunterladen (.exe)](https://github.com/oliverhees/LokkyWork/releases/latest/download/LokkyWork-2.1.21-win-x64.exe)**
>
> Heruntergeladene Datei ausführen → bei der Meldung **„Der Computer wurde durch Windows geschützt"** auf **Weitere Informationen → Trotzdem ausführen** → installieren. Ausführliche Schritte und macOS/Linux siehe unten.

### Fertige Pakete herunterladen (empfohlen)

Lade das Paket für dein Betriebssystem von der **[Releases-Seite](https://github.com/oliverhees/LokkyWork/releases)**. Das `aioncore`-Backend ist im Paket enthalten und startet automatisch — keine separate Installation nötig.

#### 🪟 Windows

1. Datei `LokkyWork-<version>-win-x64.exe` herunterladen.
2. Doppelklick auf die Datei — der Installer startet.
3. Erscheint die Meldung **„Der Computer wurde durch Windows geschützt"** (SmartScreen): auf **Weitere Informationen** klicken, dann **Trotzdem ausführen**. (Die Community-Edition ist noch nicht code-signiert — der Hinweis ist normal.)
4. Installationsordner bestätigen und **Installieren** wählen.
5. LokkyWork über das **Startmenü** oder die Desktop-Verknüpfung starten.

> Für ARM-Geräte (z. B. Surface Pro X): `LokkyWork-<version>-win-arm64.exe` verwenden.

#### 🍎 macOS

1. Passendes DMG laden:
   - **Apple Silicon** (M1–M4): `LokkyWork-<version>-mac-arm64.dmg`
   - **Intel**: `LokkyWork-<version>-mac-x64.dmg`
   - Im Zweifel: ** → Über diesen Mac** zeigt den Chip an.
2. DMG öffnen und **LokkyWork** in den **Programme**-Ordner ziehen.
3. Beim ersten Start: **Rechtsklick auf LokkyWork → Öffnen → Öffnen** (Gatekeeper, da die App noch nicht notarisiert ist). Ein normaler Doppelklick blockiert die App beim ersten Mal.
4. Falls macOS meldet, die App sei **„beschädigt"**: einmalig im Terminal `xattr -cr /Applications/LokkyWork.app` ausführen, dann erneut öffnen.

#### 🐧 Linux (Debian/Ubuntu)

1. Datei `LokkyWork-<version>-linux-amd64.deb` herunterladen.
2. Installieren: `sudo dpkg -i LokkyWork-*.deb` (oder Doppelklick → über das Software-Center installieren).
3. LokkyWork erscheint anschließend im App-Menü.

> Für ARM-Systeme: `LokkyWork-<version>-linux-arm64.deb` verwenden.

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

<div align="center">

# 🐉 LokkyWork

**Dein KI-Cockpit auf Deutsch — lokal, frei und auf Datenschutz getrimmt.**

Eine deutschsprachige Edition von [AionUi](https://github.com/iOfficeAI/AionUi): eine Oberfläche für Gemini CLI, Claude Code, Codex, Qwen & Co. — mit Funktionen, die es in der Hauptversion nicht gibt.

[![Lizenz](https://img.shields.io/badge/Lizenz-Apache_2.0-yellow?style=for-the-badge)](LICENSE)
[![Plattformen](https://img.shields.io/badge/Windows_·_macOS_·_Linux-2563eb?style=for-the-badge)](#-installation)
[![Sprache](https://img.shields.io/badge/🇩🇪_Deutsch-16a34a?style=for-the-badge)](#)
[![Release](https://img.shields.io/github/v/release/oliverhees/LokkyWork?style=for-the-badge&label=Version)](https://github.com/oliverhees/LokkyWork/releases/latest)

### [⬇️ Windows](https://github.com/oliverhees/LokkyWork/releases/latest/download/LokkyWork-2.1.21-win-x64.exe) · [🐧 Linux (.deb)](https://github.com/oliverhees/LokkyWork/releases/latest/download/LokkyWork-2.1.21-linux-amd64.deb) · [🍎 macOS](https://github.com/oliverhees/LokkyWork/releases/latest) · [📦 Alle Releases](https://github.com/oliverhees/LokkyWork/releases)

</div>

---

## ⚡ Was ist LokkyWork?

**LokkyWork** ist eine eigenständige, deutschsprachige Edition der Open-Source-App [AionUi](https://github.com/iOfficeAI/AionUi) — einer lokalen Cowork-Oberfläche für Gemini CLI, Claude Code, Codex, Qwen Code und weitere KI-Agenten. Das `aioncore`-Backend ist im Installer enthalten und startet automatisch — **kein separates Setup nötig**.

> 💛 **Auf Schultern von Riesen.** LokkyWork basiert auf AionUi (Apache-2.0) und wird unter eigenem Namen weiterentwickelt. Verbesserungen an der Basis fließen, wo sinnvoll, zurück ans Original.

---

## 🎯 Warum LokkyWork — und nicht das Original (oder ChatGPT/Copilot)?

Alles aus AionUi ist drin. **Obendrauf** kommt das hier — gebaut für deutschsprachige Selbstständige und Teams, die KI im Alltag nutzen, aber die Kontrolle behalten wollen:

- 🇩🇪 **Komplett auf Deutsch** — Oberfläche, Doku **und** Assistenten in echtem Deutsch, nicht maschinell drübergebügelt. ✅
- 🤖 **Deutsche Assistenten — inklusive Verhalten** — die Assistenten _denken und antworten_ auf Deutsch, nicht nur die Knöpfe. Passende Tonalität für deutschsprachige Arbeit. ✅
- 🔗 **Skill-Verkettung (Workflows)** — mehrere Assistenten/Skills zu einer Kette verbinden: Schritt 2 arbeitet mit dem Ergebnis von Schritt 1, jeder Schritt bleibt ein eigener, einsehbarer Chat. Mit visuellem Editor. ✅
- 🛡️ **PII-Schutz per Schalter** — sensible Daten (IBAN, Namen, E-Mails) werden **lokal anonymisiert, bevor** sie an ein Cloud-Modell gehen, und in der Antwort zurückübersetzt. Ein Toggle, funktioniert am Desktop **und** im Server-Betrieb. _Genau das kann dir ChatGPT/Copilot nicht bieten._ 🛠️ In Arbeit
- 🔄 **Eigener Update-Kanal** — Updates kommen aus LokkyWork, nicht aus dem Upstream. Du bekommst exakt unsere Version, keine Fremd-Releases. ✅
- 🐉 **Eigene Identität + Dragon-Pet** — Drachen-Branding und ein 3D-Begleiter-Drache mit 21 animierten Zuständen, frei wählbar. ✅
- 🧩 **Deutsche Tool-Integrationen** — lexoffice/sevDesk, Nextcloud & Co. für den echten Geschäftsalltag. 🗺️ Geplant
- 🧠 **Second Brain (RAG)** — durchsuchbarer Wissensspeicher aus deinen Notizen, Dokumenten und Links, per MCP im Chat abfragbar. 🗺️ Geplant

> 🟢 **Stand:** basiert auf **AionUi 2.1.21** + `aioncore` **v0.1.33** — wir halten die Basis aktuell.
>
> Legende: ✅ enthalten · 🛠️ in Arbeit · 🗺️ geplant

---

## ⬇️ Installation

**Fertige Pakete** von der **[Releases-Seite](https://github.com/oliverhees/LokkyWork/releases)** laden — das Backend ist enthalten, keine separate Installation nötig.

> ### 🪟 [LokkyWork für Windows direkt herunterladen (.exe)](https://github.com/oliverhees/LokkyWork/releases/latest/download/LokkyWork-2.1.21-win-x64.exe)
>
> Ausführen → bei **„Der Computer wurde durch Windows geschützt"** auf **Weitere Informationen → Trotzdem ausführen** → installieren. (Die Community-Edition ist noch nicht signiert — der Hinweis ist normal. ARM: `…-win-arm64.exe`.)

<details>
<summary><b>🍎 macOS — Schritte anzeigen</b></summary>

1. Passendes DMG laden: **Apple Silicon** (M1–M4) → `LokkyWork-<version>-mac-arm64.dmg`, **Intel** → `…-mac-x64.dmg`. _( → Über diesen Mac zeigt den Chip.)_
2. DMG öffnen, **LokkyWork** in **Programme** ziehen.
3. Erster Start: **Rechtsklick → Öffnen → Öffnen** (Gatekeeper, da nicht notarisiert).
4. Bei „beschädigt": einmalig `xattr -cr /Applications/LokkyWork.app` im Terminal, dann erneut öffnen.

</details>

<details>
<summary><b>🐧 Linux (Debian/Ubuntu) — Schritte anzeigen</b></summary>

1. `LokkyWork-<version>-linux-amd64.deb` laden.
2. `sudo dpkg -i LokkyWork-*.deb` (oder Doppelklick → Software-Center).
3. LokkyWork erscheint im App-Menü. _(ARM: `…-linux-arm64.deb`.)_

</details>

---

## 🛠️ Aus dem Quellcode bauen

```bash
bun install
bun run dev            # Desktop-App im Entwicklungsmodus

bun run dist:linux     # .deb  (Linux)
bun run dist:mac       # .dmg  (nur auf macOS baubar)
bun run dist:win       # .exe  (nur auf Windows baubar)
```

> 💡 Plattformübergreifende Pakete (Windows + macOS + Linux) entstehen über GitHub Actions — ein Tag-Push (`v*`) baut alle Pakete als Release. Lokal lässt sich pro Betriebssystem nur das eigene Paket bauen.

---

## 🤝 Mitmachen

LokkyWork ist ein Community-Projekt für den deutschsprachigen Raum. Ideen und Feature-Wünsche — besonders rund um **DSGVO, Datenschutz und deutsche Workflows** — sind herzlich willkommen. Issues und Pull Requests gerne direkt hier.

---

## 📄 Lizenz & Dank

LokkyWork steht unter der **Apache-2.0-Lizenz** — wie das zugrunde liegende [AionUi](https://github.com/iOfficeAI/AionUi). Alle Copyright-Hinweise des Originals bleiben erhalten.

**Großer Dank an das AionUi-Team** 🙏 für die offene, hochwertige Grundlage, auf der LokkyWork aufbaut.

<div align="center">

🐉 **LokkyWork** — KI auf Deutsch, mit Datenschutz im Kern.

</div>

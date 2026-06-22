/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Start-screen home feed (CODE-36 follow-up). Two locally-maintained lists shown
 * under the input card when no preset assistant is selected:
 *   - CHANGELOG: what we shipped (release/feature highlights)
 *   - NEWS:      community updates & announcements
 *
 * Kept as plain data so it is trivial to update per release. NEWS can later be
 * swapped for a remote source (e.g. GitHub releases / a community feed) without
 * touching the HomeFeed component.
 */

export type FeedEntry = {
  id: string;
  /** Short display date, e.g. '2026-06-20' or 'Juni 2026'. Optional. */
  date?: string;
  title: string;
  description?: string;
  /** Small category badge, e.g. 'Feature', 'Fix', 'Ankündigung'. */
  tag?: string;
  /** Optional external link; clicking the entry opens it in the browser. */
  href?: string;
};

export const CHANGELOG: FeedEntry[] = [
  {
    id: 'pii-proxy',
    date: '2026-06',
    tag: 'Feature',
    title: 'PII-Schutz (Anonymisierung)',
    description: 'Sensible Daten werden lokal maskiert, bevor sie an ein KI-Modell gehen — per Toggle aktivierbar.',
  },
  {
    id: 'assistants-page',
    date: '2026-06',
    tag: 'Feature',
    title: 'Eigene Assistenten-Seite',
    description: 'Übersicht mit Tabs, Suche und Sortierung — Assistenten anlegen, bearbeiten und löschen.',
  },
  {
    id: 'dragon-branding',
    date: '2026-06',
    tag: 'Design',
    title: 'LokkyWork Dragon-Branding',
    description: 'Neues Icon und durchgängiges Branding in App, Installer und Chat.',
  },
];

export const NEWS: FeedEntry[] = [
  {
    id: 'kimiboca-bootcamp',
    tag: 'Ankündigung',
    title: 'KI-Betriebssystem Bootcamp',
    description: 'Lerne, dir mit KI dein eigenes Betriebssystem zu bauen. Mehr auf kimiboca.de.',
    href: 'https://kimiboca.de',
  },
  {
    id: 'community',
    tag: 'Community',
    title: 'Tritt der Community bei',
    description: 'Tausche dich mit anderen Selbstständigen aus, die KI in ihren Alltag bauen.',
  },
  {
    id: 'roadmap-mention',
    tag: 'Roadmap',
    title: 'Als Nächstes: @-Mention von Assistenten',
    description: 'Bald kannst du Assistenten mitten im Chat per @ ansprechen.',
  },
];

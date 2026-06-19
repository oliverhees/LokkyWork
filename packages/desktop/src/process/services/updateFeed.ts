/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GithubOptions } from 'builder-util-runtime';

/**
 * LokkyWork ships its own releases from GitHub (oliverhees/LokkyWork) instead of
 * the upstream AionUi CDN (static.aionui.com). The packaged app-update.yml is
 * generated from the same publish config, so the runtime feed stays in sync and
 * update checks only ever surface LokkyWork releases — never AionUi's.
 */
export const UPDATE_REPO = { owner: 'oliverhees', repo: 'LokkyWork' } as const;

export function buildUpdateFeedOptions(): GithubOptions {
  return {
    provider: 'github',
    owner: UPDATE_REPO.owner,
    repo: UPDATE_REPO.repo,
  };
}

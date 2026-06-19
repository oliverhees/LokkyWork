/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildUpdateFeedOptions, UPDATE_REPO } from '@/process/services/updateFeed';

describe('LokkyWork update feed options', () => {
  it('builds a GitHub electron-updater provider pointed at the LokkyWork repo', () => {
    const options = buildUpdateFeedOptions();

    expect(options.provider).toBe('github');
    expect(options.owner).toBe(UPDATE_REPO.owner);
    expect(options.repo).toBe(UPDATE_REPO.repo);
  });

  it('targets oliverhees/LokkyWork, never the upstream AionUi CDN', () => {
    expect(UPDATE_REPO).toEqual({ owner: 'oliverhees', repo: 'LokkyWork' });
  });
});

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * German (de-DE) behavioral rules for the builtin assistants.
 *
 * aioncore ships builtin assistant rules only in en/zh/uk/ru and blocks client
 * writes to builtin rules. The conversation service, however, uses
 * `extra.preset_context` as the rule fallback when the locale-specific rule is
 * empty (aioncore service.rs: `content = rules_content.is_empty() ? fallback`).
 * So for the German edition we ship the translated rules here and inject them
 * as `preset_context` at conversation start (see buildPresetAssistantParams).
 *
 * The text lives in the sibling JSON so multi-KB Markdown system prompts stay
 * escaping-safe and out of the TS source.
 */

import rules from './assistantRulesDe.json';

const ASSISTANT_DE_RULES = rules as Record<string, string>;

/**
 * Translated German rule for a builtin assistant id, or `undefined` when there
 * is no override (custom assistants, unknown ids, empty content).
 */
export function getAssistantDeRule(id: string): string | undefined {
  const rule = ASSISTANT_DE_RULES[id];
  return rule && rule.trim().length > 0 ? rule : undefined;
}

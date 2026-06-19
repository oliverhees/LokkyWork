/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared contract for the PII anonymization proxy (CODE-26), used by BOTH the
 * main process (proxy server decodes the target from the path) and the renderer
 * (toggle rewrites every provider.base_url to/from the proxy URL). Therefore this
 * module must stay free of Node-only APIs (no Buffer) — base64url is implemented
 * with btoa/atob + TextEncoder, available in Node and the browser.
 *
 * Target encoding is stateless and reversible: the real base_url is base64url-
 * encoded into the proxy path. Toggling the proxy off just decodes it back, so no
 * mapping table and no lost original URL.
 */

/**
 * Fixed loopback port for the proxy. Fixed (not ephemeral) so the base_urls that
 * point at it stay valid across restarts. Shared by main (listen) and renderer
 * (rewrite). MVP: a single well-known port; bind failure surfaces as an error.
 */
export const PII_PROXY_PORT = 13921;

export const PII_PROXY_FORWARD_PREFIX = '/fwd/';

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(segment: string): string {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Replace a provider's real base_url with the proxy URL (while the proxy is on). */
export function buildProxyBaseUrl(realBaseUrl: string, port: number = PII_PROXY_PORT): string {
  return `http://127.0.0.1:${port}${PII_PROXY_FORWARD_PREFIX}${toBase64Url(realBaseUrl)}`;
}

/** True if a base_url currently points at the local PII proxy. */
export function isProxyBaseUrl(baseUrl: string): boolean {
  return /^http:\/\/127\.0\.0\.1:\d+\/fwd\//.test(baseUrl);
}

/** Recover the real base_url from a proxy base_url (toggle off). Returns null if not a proxy URL. */
export function decodeProxyBaseUrl(proxyBaseUrl: string): string | null {
  const m = proxyBaseUrl.match(/\/fwd\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    const target = fromBase64Url(m[1]);
    return /^https?:\/\//.test(target) ? target : null;
  } catch {
    return null;
  }
}

/**
 * Server-side: split an incoming proxy request path `/fwd/<b64>/rest...` into the
 * decoded target base_url and the trailing API path (e.g. `/chat/completions`).
 */
export function parseForwardPath(reqUrl: string): { target: string; restPath: string } | null {
  if (!reqUrl.startsWith(PII_PROXY_FORWARD_PREFIX)) return null;
  const afterPrefix = reqUrl.slice(PII_PROXY_FORWARD_PREFIX.length);
  const slash = afterPrefix.indexOf('/');
  const segment = slash === -1 ? afterPrefix : afterPrefix.slice(0, slash);
  const restPath = slash === -1 ? '' : afterPrefix.slice(slash);
  if (!segment) return null;
  try {
    const target = fromBase64Url(segment);
    if (!/^https?:\/\//.test(target)) return null;
    return { target, restPath };
  } catch {
    return null;
  }
}

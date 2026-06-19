/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Local PII anonymization proxy (CODE-26 / CODE-33).
 *
 * Sits between aioncore and the real LLM providers:
 *
 *   aioncore --(provider.base_url = this proxy)--> piiProxy --(real base_url)--> LLM provider
 *
 * The Spike (CODE-32) confirmed aioncore issues OpenAI-compatible
 * `POST /v1/chat/completions` (streaming) at `provider.base_url`, so redirecting
 * that base_url to this proxy lets us intercept the request body — where the PII
 * lives (`messages[].content`) — anonymize it, forward to the real provider, and
 * de-anonymize the (streamed) response.
 *
 * The real target base_url is base64url-encoded into the request path; see
 * `@/common/pii/piiProxyShared` for the encoding contract shared with the renderer.
 *
 * This file is the MVP skeleton: it forwards faithfully (pass-through). PII
 * scrubbing (CODE-34) and stream de-anonymization (CODE-35) hook into the two
 * clearly marked seams below.
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { PII_PROXY_FORWARD_PREFIX, parseForwardPath } from '@/common/pii/piiProxyShared';

export type PiiProxyHandle = {
  /** Bound port (127.0.0.1). */
  port: number;
  stop: () => Promise<void>;
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Headers that must not be forwarded verbatim to the upstream provider. */
const STRIP_REQUEST_HEADERS = new Set(['host', 'content-length', 'connection']);

async function handleForward(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const parsed = parseForwardPath(req.url ?? '');
  if (!parsed) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('PII proxy: bad forward path');
    return;
  }

  // Real upstream URL = decoded target base_url + the API path aioncore appended.
  const targetUrl = parsed.target.replace(/\/$/, '') + parsed.restPath;

  const requestBody = await readBody(req);

  // ─── SEAM 1 (CODE-34): anonymize PII in `requestBody` here ──────────────────
  // The body is an OpenAI-compatible JSON payload; scrub messages[].content,
  // keep a reversible session mapping, then forward the scrubbed buffer.
  const forwardBody = requestBody;
  // ────────────────────────────────────────────────────────────────────────────

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || STRIP_REQUEST_HEADERS.has(k.toLowerCase())) continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : v;
  }

  const method = req.method ?? 'POST';
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(forwardBody),
    });
  } catch (err) {
    res.writeHead(502, { 'content-type': 'text/plain' }).end(`PII proxy: upstream error: ${String(err)}`);
    return;
  }

  const respHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return; // length changes after de-anonymization
    respHeaders[key] = value;
  });
  res.writeHead(upstream.status, respHeaders);

  // ─── SEAM 2 (CODE-35): de-anonymize the (streamed) response here ─────────────
  // Map placeholders back to original values, buffering across chunk boundaries
  // so a placeholder isn't torn apart. Pass-through for the skeleton.
  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch {
    // upstream aborted; close the client response
  } finally {
    res.end();
  }
  // ────────────────────────────────────────────────────────────────────────────
}

/** Start the local PII proxy on 127.0.0.1:`port`. */
export function startPiiProxyServer(port: number): Promise<PiiProxyHandle> {
  const server = http.createServer((req, res) => {
    if ((req.url ?? '').startsWith(PII_PROXY_FORWARD_PREFIX)) {
      void handleForward(req, res);
      return;
    }
    if (req.url === '/__pii-proxy/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('PII proxy: unknown route');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('PII proxy: could not bind'));
        return;
      }
      server.off('error', reject);
      resolve({
        port: addr.port,
        stop: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

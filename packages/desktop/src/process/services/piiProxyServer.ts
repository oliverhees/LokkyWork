/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Local PII anonymization proxy (CODE-26 / 33 / 34 / 35).
 *
 * Sits between aioncore and the real LLM providers:
 *
 *   aioncore --(provider.base_url = this proxy)--> piiProxy --(real base_url)--> LLM provider
 *
 * Flow: scrub PII from the request body (Seam 1, CODE-34) -> forward to the real
 * provider -> restore placeholders in the (streamed) response (Seam 2, CODE-35).
 * The real target base_url is base64url-encoded into the request path; see
 * `@/common/pii/piiProxyShared` for the encoding contract shared with the renderer.
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { PII_PROXY_FORWARD_PREFIX, parseForwardPath } from '@/common/pii/piiProxyShared';
import { createPiiMapping, restoreText, scrubChatRequestBody } from '@/common/pii/piiScrubber';

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
  const mapping = createPiiMapping();

  // ─── SEAM 1 (CODE-34): scrub PII from messages[].content. scrubChatRequestBody
  // returns null when the body isn't a chat request (e.g. /models) — forward as-is.
  let forwardBody = requestBody;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const scrubbed = scrubChatRequestBody(requestBody.toString('utf8'), mapping);
    if (scrubbed !== null) forwardBody = Buffer.from(scrubbed, 'utf8');
  }

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

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const nothingScrubbed = mapping.byPlaceholder.size === 0;

  // ─── SEAM 2 (CODE-35): restore placeholders in the response. If nothing was
  // scrubbed, stream through untouched (no de-anonymization needed).
  if (nothingScrubbed) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } catch {
      /* upstream aborted */
    } finally {
      res.end();
    }
    return;
  }

  // De-anonymize, buffering an open "[…" at the chunk boundary so a placeholder
  // isn't torn across two chunks.
  const decoder = new TextDecoder();
  let carry = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      let text = carry + decoder.decode(value, { stream: true });
      const lastOpen = text.lastIndexOf('[');
      const lastClose = text.lastIndexOf(']');
      if (lastOpen > lastClose) {
        carry = text.slice(lastOpen);
        text = text.slice(0, lastOpen);
      } else {
        carry = '';
      }
      if (text) res.write(Buffer.from(restoreText(text, mapping), 'utf8'));
    }
    const tail = carry + decoder.decode();
    if (tail) res.write(Buffer.from(restoreText(tail, mapping), 'utf8'));
  } catch {
    /* upstream aborted */
  } finally {
    res.end();
  }
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

/**
 * The site and its demo. Serves `public/`, and answers the demo chat at
 * POST /webhook/demo/chat the way an n8n Chat Trigger with streaming on does: a line of JSON
 * per frame (begin, item…, end). The answers are written ahead, with the cards a workflow
 * would add, so the demo needs no model, no key, and never goes down.
 *
 * Zero dependencies: `node server.mjs` (PORT, default 3000).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerFor } from './demo/answers.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const port = Number(process.env.PORT ?? 3000);
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const MAX_BODY = 64 * 1024;

/** The fields of a JSON or multipart body: the widget sends multipart when a file is attached. */
function fieldsOf(raw, type) {
    if (type.includes('application/json')) {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    const fields = {};
    for (const m of raw.matchAll(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g)) fields[m[1]] = m[2];
    try { if (typeof fields.metadata === 'string') fields.metadata = JSON.parse(fields.metadata); } catch { /* left as text */ }
    return fields;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(req, res) {
    let raw = '';
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > MAX_BODY) { res.writeHead(413).end(); return; }
    }
    const body = fieldsOf(raw, req.headers['content-type'] ?? '');
    if (body.action === 'loadPreviousSession') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [] }));
        return;
    }
    const { text, card } = answerFor(String(body.chatInput ?? ''), body.metadata);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    const frame = (f) => res.write(JSON.stringify({ ...f, metadata: { nodeId: 'demo', nodeName: 'Answer' } }) + '\n');
    frame({ type: 'begin' });
    await wait(350);
    // A word or two at a time, as a model writes; the card arrives whole at the end.
    for (const piece of text.match(/\S+\s*/g) ?? []) {
        frame({ type: 'item', content: piece });
        await wait(28);
    }
    if (card) {
        const block = '\n\n```card-' + card.name + '\n' + JSON.stringify(card.data) + '\n```';
        for (let i = 0; i < block.length; i += 40) {
            frame({ type: 'item', content: block.slice(i, i + 40) });
            await wait(20);
        }
    }
    frame({ type: 'end' });
    res.end();
}

createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/webhook/demo/chat') {
        if (req.method === 'POST') return chat(req, res).catch(() => res.end());
        res.writeHead(405).end();
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path.includes('..')) { res.writeHead(400).end(); return; }
    if (!path || path.endsWith('/') || path.endsWith('\\')) path = join(path, 'index.html');
    try {
        const file = await readFile(join(root, path));
        res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : file);
    } catch {
        try {
            const file = await readFile(join(root, path, 'index.html'));
            res.writeHead(200, { 'content-type': TYPES['.html'] }).end(file);
        } catch {
            res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        }
    }
}).listen(port, () => console.log(`n8n-chat-site on :${port}`));

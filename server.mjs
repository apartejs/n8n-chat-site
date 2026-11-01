/**
 * The site and its demo. Serves `public/`, and plays the two workflows offered on the site
 * (demo/workflows.mjs) the way an n8n Chat Trigger set to "Using Response Nodes" does:
 *
 *   POST /webhook/<shop|booking>/chat   → { executionStarted, executionId, resumeToken }
 *   WS   /chat?sessionId&executionId    → the Chat nodes' messages, "n8n|continue" between them,
 *                                         and { type: 'with-buttons' } for an approval
 *   GET  /webhook-waiting/<id>/<n>      → a button: the execution goes on, on the same socket
 *
 * No model, no key: the demo never goes down and costs nothing. Zero dependencies:
 * `node server.mjs` (PORT, default 3000).
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptSocket } from './demo/ws.mjs';
import { WORKFLOWS } from './demo/workflows.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'public');
/** The widget the page loads, pinned: an `@0` range is cached by browsers for days. */
const WIDGET = '0.4.0';
/**
 * Where the widget comes from: jsDelivr, or — to try a build before it is published — a folder
 * this server serves (`WIDGET_SRC=/_widget node server.mjs`, with dist/cdn and style.css in it).
 */
const WIDGET_BASE = process.env.WIDGET_SRC ?? `https://cdn.jsdelivr.net/npm/@aparte/n8n-chat@${WIDGET}/dist`;
const WIDGET_CSS = process.env.WIDGET_SRC ? `${WIDGET_BASE}/style.css` : `${WIDGET_BASE}/style.css`;
const WIDGET_JS = process.env.WIDGET_SRC ? `${WIDGET_BASE}/n8n-chat.js` : `${WIDGET_BASE}/cdn/n8n-chat.js`;

// ── The pages, in each language ────────────────────────────────────────────
const read = (file) => readFile(join(here, file), 'utf8');
const PARTIALS = { head: await read('partials/head.html'), foot: await read('partials/foot.html') };
const withPartials = (html) => html.replace(/\{\{@(\w+)\}\}/g, (m, name) => PARTIALS[name] ?? m);
const TEMPLATES = { home: withPartials(await read('template.html')), workflow: withPartials(await read('workflow.html')) };
const dictionaries = {};
for (const file of (await readdir(join(here, 'i18n'))).filter((f) => f.endsWith('.json')).sort()) {
    const dict = JSON.parse(await readFile(join(here, 'i18n', file), 'utf8'));
    dictionaries[dict.lang] = dict;
}
const LANGS = Object.keys(dictionaries).sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));

/** The workflow pages: `/<lang>/workflows/<id>/`. `live`: the demo plays it in the widget. */
const WORKFLOW_PAGES = {
    shop: { file: 'shop-returns', live: true, tags: ['product', 'order', 'buttons', 'photo'], options: ", allowFileUploads: true, allowedFilesMimeTypes: 'image/*'" },
    booking: { file: 'booking', live: true, tags: ['booking', 'place', 'buttons', 'table'], options: '' },
    documents: { file: 'document-qa', live: false, tags: ['file', 'memory'], options: ', allowFileUploads: true' },
};

/** Every page: its path under the language, its template, and what it fills in beside the texts. */
const PAGES = [
    { path: '', template: 'home', fill: (t) => ({ 'page.title': t['meta.title'], 'page.description': t['meta.description'] }) },
    ...Object.entries(WORKFLOW_PAGES).map(([id, wf]) => ({
        path: `workflows/${id}/`,
        template: 'workflow',
        fill: (t) => ({
            'page.title': `${t[`wf.${id === 'documents' ? 'docs' : id}.title`]} — aparté chat for n8n`,
            'page.description': t[`wf.${id === 'documents' ? 'docs' : id}.text`],
            'wf.id': id,
            'wf.file': wf.file,
            'wf.title': t[`wf.${id === 'documents' ? 'docs' : id}.title`],
            'wf.text': t[`wf.${id === 'documents' ? 'docs' : id}.text`],
            'wf.tags': wf.tags.map((tag) => `<span class="aparte-tag aparte-tag--sm">${t[`wf.tag.${tag}`]}</span>`).join(''),
            'wf.req': t[`wfp.${id}.req`],
            'wf.steps': t[`wfp.${id}.steps`],
            'wf.options': wf.options,
            'wf.download': t['wf.download'],
            'wf.live': String(wf.live),
        }),
    })),
];

/** og:locale wants a region: the one each language is written for here. */
const OG_LOCALES = { en: 'en_US', fr: 'fr_FR', es: 'es_ES', 'pt-BR': 'pt_BR', de: 'de_DE', it: 'it_IT', ru: 'ru_RU', ja: 'ja_JP', ko: 'ko_KR', 'zh-CN': 'zh_CN' };
const SITE = 'https://n8n-chat.apartejs.dev';

const pages = {};
for (const lang of LANGS) {
    // A key a translation lacks falls back to English, never to a raw {{key}}.
    const t = { ...dictionaries.en, ...dictionaries[lang] };
    for (const page of PAGES) {
        const fill = {
            widget: WIDGET,
            'widget.css': WIDGET_CSS,
            'widget.js': WIDGET_JS,
            'page.path': page.path,
            ogLocale: OG_LOCALES[lang] ?? lang.replace('-', '_'),
            // What public/site.js writes there before any choice, so the page reads the same without it.
            'settings.code': ['createChat({', "  webhookUrl: 'https://your-n8n.example.com/webhook/…/chat',", "  colorScheme: 'auto',",
                ...(lang === 'en' ? [] : [`  defaultLanguage: '${lang}',`]), "  mode: 'embedded',", "  target: '#support-chat',", '});',
                '', "/* In your stylesheet: n8n's own variables. */", ':root {',
                '  --chat--color--secondary: #178272; /* your bubble, the send button, the corner button */', '}'].join('\n'),
            alternates: [...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="https://n8n-chat.apartejs.dev/${l}/${page.path}">`),
                `<link rel="alternate" hreflang="x-default" href="https://n8n-chat.apartejs.dev/en/${page.path}">`].join('\n'),
            languages: LANGS.map((l) => `<option value="${l}"${l === lang ? ' selected' : ''}>${dictionaries[l].name}</option>`).join(''),
            // Read by the page's script; `<` escaped so a text cannot close the script tag.
            json: JSON.stringify(t).replace(/</g, '\\u003c'),
            ...page.fill(t),
        };
        const html = TEMPLATES[page.template].replace(/\{\{([a-zA-Z0-9.@]+)\}\}/g, (m, key) => fill[key] ?? t[key] ?? m);
        const missing = [...html.matchAll(/\{\{([a-zA-Z0-9.@]+)\}\}/g)].map((m) => m[1]);
        if (missing.length) console.warn(`[site] /${lang}/${page.path}: no text for ${[...new Set(missing)].join(', ')}`);
        pages[`/${lang}/${page.path}`] = html;
    }
}

// For search engines: every page in every language, each naming its translations.
const ROBOTS = `User-agent: *
Allow: /
Disallow: /webhook/
Disallow: /webhook-waiting/

Sitemap: ${SITE}/sitemap.xml
`;
const SITEMAP = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...LANGS.flatMap((lang) => PAGES.map((page) => [
        `  <url><loc>${SITE}/${lang}/${page.path}</loc>`,
        ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}/${l}/${page.path}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en/${page.path}"/>`,
        '  </url>',
    ].join('\n'))),
    '</urlset>', ''].join('\n');

/** The visitor's language among ours, from Accept-Language; English when none of theirs is. */
function preferred(header = '') {
    const asked = String(header).split(',').map((part) => {
        const [tag = '', ...params] = part.split(';').map((s) => s.trim());
        const q = params.map((p) => p.match(/^q\s*=\s*([0-9.]+)$/i)).find(Boolean);
        return { tag: tag.toLowerCase(), q: q ? Number(q[1]) : 1 };
    }).filter((x) => x.tag && x.q > 0).sort((a, b) => b.q - a.q);
    for (const { tag } of asked) {
        const exact = LANGS.find((l) => l.toLowerCase() === tag);
        if (exact) return exact;
        // Traditional Chinese is not our Simplified Chinese: such a reader gets English.
        if (/^zh-(tw|hk|mo|hant)/.test(tag)) continue;
        const base = LANGS.find((l) => l.split('-')[0].toLowerCase() === tag.split('-')[0]);
        if (base) return base;
    }
    return 'en';
}
const port = Number(process.env.PORT ?? 3000);
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const MAX_BODY = 64 * 1024;
/** The files demo reads what is attached, up to this, and keeps nothing. */
const MAX_FILES_BODY = 1024 * 1024;
const MAX_KEPT = 5000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A conversation's state, per workflow and session; the oldest go first past MAX_KEPT. */
const sessions = new Map();
function stateOf(workflow, sessionId) {
    const key = `${workflow}:${sessionId}`;
    let state = sessions.get(key);
    if (!state) {
        state = {};
        sessions.set(key, state);
        if (sessions.size > MAX_KEPT) sessions.delete(sessions.keys().next().value);
    }
    return state;
}

/** Executions: their workflow and session, their socket, and the approval they wait on. */
const executions = new Map();

/** Plays a turn's steps on the execution's socket, as Chat nodes send them. */
async function play(execution, steps) {
    const socket = await execution.ready;
    for (const [i, step] of steps.entries()) {
        await wait(i === 0 ? 700 : 500);
        if (!socket.open) return;
        if (step.say) {
            socket.send(step.say);
            if (i < steps.length - 1) socket.send('n8n|continue');
        } else if (step.ask) {
            const n = randomUUID();
            execution.pending = { n, then: step.ask.then };
            const link = (approved) => `/webhook-waiting/${execution.id}/${n}?approved=${approved}`;
            socket.send(JSON.stringify({
                type: 'with-buttons', text: step.ask.text, blockUserInput: true,
                buttons: [
                    { text: step.ask.yes, link: link(true), type: 'primary' },
                    { text: step.ask.no, link: link(false), type: 'secondary' },
                ],
            }));
            return;
        }
    }
}

function newExecution(workflow, sessionId) {
    // Unguessable: the id is all a socket needs to take an execution's frames.
    const execution = { id: randomUUID(), workflow, sessionId, pending: null };
    execution.ready = new Promise((resolve) => { execution.attach = resolve; });
    executions.set(execution.id, execution);
    if (executions.size > MAX_KEPT) executions.delete(executions.keys().next().value);
    return execution;
}

function turn(execution, chatInput, files = []) {
    const state = stateOf(execution.workflow, execution.sessionId);
    if (execution.lang) state.lang = execution.lang;
    const text = typeof chatInput === 'string' ? chatInput.slice(0, 2000) : '';
    const steps = WORKFLOWS[execution.workflow](state, text, { files });
    void play(execution, steps);
}

/**
 * The fields of a JSON or multipart body (the widget sends multipart when a file is attached),
 * and the files' names and sizes — read from the bytes as latin1, so one byte is one character.
 */
function fieldsOf(buffer, type) {
    if (type.includes('application/json')) {
        try { return { fields: JSON.parse(buffer.toString('utf8')), files: [] }; } catch { return { fields: {}, files: [] }; }
    }
    const boundary = (type.match(/boundary=(?:"([^"]+)"|([^;]+))/) ?? []).slice(1).find(Boolean);
    const fields = {};
    const files = [];
    if (!boundary) return { fields, files };
    for (const part of buffer.toString('latin1').split(`--${boundary}`)) {
        const split = part.indexOf('\r\n\r\n');
        if (split < 0) continue;
        const head = part.slice(0, split);
        const body = part.slice(split + 4).replace(/\r\n$/, '');
        const name = (head.match(/name="([^"]*)"/) ?? [])[1];
        const filename = (head.match(/filename="([^"]*)"/) ?? [])[1];
        if (filename !== undefined) {
            if (files.length < 10) files.push({ name: Buffer.from(filename, 'latin1').toString('utf8').slice(0, 120), size: body.length });
        } else if (name) {
            fields[name] = Buffer.from(body, 'latin1').toString('utf8');
        }
    }
    return { fields, files };
}

/** Uploads being read at once: past it, the files demo answers 503 rather than hold more. */
let uploading = 0;
const MAX_UPLOADING = 20;

async function chat(req, res, workflow) {
    const files = workflow === 'files';
    if (files && uploading >= MAX_UPLOADING) { res.writeHead(503, { 'retry-after': '5' }).end(); req.resume(); return; }
    if (files) uploading++;
    try {
        await answer(req, res, workflow, files ? MAX_FILES_BODY : MAX_BODY);
    } finally {
        if (files) uploading--;
    }
}

async function answer(req, res, workflow, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) { res.writeHead(413).end(); req.destroy(); return; }
        chunks.push(chunk);
    }
    const { fields: body, files } = fieldsOf(Buffer.concat(chunks), req.headers['content-type'] ?? '');
    const json = (value, status = 200) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(value));
    // A workflow that fails, answered as n8n answers one: the widget says so in the visitor's language.
    if (workflow === 'broken' && body.action !== 'loadPreviousSession') return json({ code: 500, message: 'Workflow execution failed: the Answer node threw.' }, 500);
    if (body.action === 'loadPreviousSession') return json({ data: [] });
    const sessionId = String(body.sessionId ?? randomUUID()).slice(0, 100);
    const execution = newExecution(workflow, sessionId);
    let metadata = body.metadata;
    try { if (typeof metadata === 'string') metadata = JSON.parse(metadata); } catch { metadata = undefined; }
    if (typeof metadata?.lang === 'string') execution.lang = metadata.lang.slice(0, 10);
    turn(execution, body.chatInput, files);
    json({ executionStarted: true, executionId: execution.id, resumeToken: 'demo' });
}

function button(res, executionId, n, approved) {
    const execution = executions.get(executionId);
    const pending = execution?.pending;
    if (!pending || pending.n !== n) { res.writeHead(404).end(); return; }
    execution.pending = null;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<p>Got it.</p>');
    void play(execution, pending.then(approved));
}

/** The request's URL, or `null` for one that does not parse (`//`, `http://[`…). */
function urlOf(req) {
    try { return new URL(req.url ?? '/', 'http://localhost'); } catch { return null; }
}

const server = createServer(async (req, res) => {
    const url = urlOf(req);
    if (!url) { res.writeHead(400).end(); return; }
    const hook = url.pathname.match(/^\/webhook\/(shop|booking|buttons|files|broken)\/chat$/);
    if (hook) {
        if (req.method === 'POST') return chat(req, res, hook[1]).catch(() => res.end());
        res.writeHead(405).end();
        return;
    }
    const waiting = url.pathname.match(/^\/webhook-waiting\/([^/]+)\/([^/]+)$/);
    if (waiting) return button(res, waiting[1], waiting[2], url.searchParams.get('approved') === 'true');

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
        const robots = url.pathname === '/robots.txt';
        res.writeHead(200, { 'content-type': robots ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8', 'cache-control': 'max-age=3600' });
        res.end(req.method === 'HEAD' ? undefined : robots ? ROBOTS : SITEMAP);
        return;
    }
    if (url.pathname === '/') {
        res.writeHead(302, { location: `/${preferred(req.headers['accept-language'])}/`, vary: 'Accept-Language', 'cache-control': 'no-cache' }).end();
        return;
    }
    const pagePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    if (pages[pagePath]) {
        if (pagePath !== url.pathname) { res.writeHead(301, { location: pagePath }).end(); return; }
        res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache', 'content-language': pagePath.split('/')[1] });
        res.end(req.method === 'HEAD' ? undefined : pages[pagePath]);
        return;
    }
    let path;
    try { path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''); } catch { res.writeHead(400).end(); return; }
    if (path.includes('..')) { res.writeHead(400).end(); return; }
    if (!path || path.endsWith('/') || path.endsWith('\\')) path = join(path, 'index.html');
    try {
        const file = await readFile(join(root, path));
        res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : file);
    } catch {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
});

// The chat socket: one per execution; a message written on it is the next turn.
server.on('upgrade', (req, socket) => {
    const url = urlOf(req);
    const execution = url && executions.get(url.searchParams.get('executionId') ?? '');
    if (!url || url.pathname !== '/chat' || !execution) { socket.destroy(); return; }
    // A file sent on the socket arrives inline as a data URL: the files demo takes bigger frames.
    const maxFrame = execution.workflow === 'files' ? Math.ceil(MAX_FILES_BODY * 4 / 3) + 4096 : 64 * 1024;
    const ws = acceptSocket(req, socket, (text) => {
        if (text === 'n8n|heartbeat-ack') return;
        let message;
        try { message = JSON.parse(text); } catch { return; }
        if (message?.action !== 'sendMessage') return;
        // As the runner sends them on the socket: { name, type, data: 'data:…;base64,…' }.
        const files = (Array.isArray(message.files) ? message.files : []).slice(0, 10).map((f) => ({
            name: typeof f?.name === 'string' ? f.name.slice(0, 120) : 'file',
            size: Math.floor(((typeof f?.data === 'string' ? f.data.split(',')[1] ?? '' : '').length * 3) / 4),
        }));
        turn(execution, message.chatInput, files);
    }, undefined, { maxFrame });
    if (!ws) return;
    // A socket reopened on the same execution (after a button) takes over from the old one.
    execution.ready = Promise.resolve(ws);
    execution.attach(ws);
});

// A last net: a request the code did not foresee is logged, and the site stays up.
process.on('unhandledRejection', (error) => console.error('[site] unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('[site] uncaught exception:', error));

server.listen(port, () => console.log(`n8n-chat-site on :${port}`));

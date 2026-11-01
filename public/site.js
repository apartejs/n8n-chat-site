// The page's script: the demo chat and its settings, the settings as code, the ticket card,
// "your n8n", and the code blocks coloured — all with the published packages, from jsDelivr.
const t = JSON.parse(document.getElementById('i18n').textContent);
const APARTE = '0.29.3';
const SHIKI = '4.5.0';
const cdn = (path) => `https://cdn.jsdelivr.net/npm/${path}`;
// The card kit comes from the widget's own module: one copy of aparté for the chat and the cards.
const { createChat, defineCard, el } = await import(document.documentElement.dataset.widget);

// ── The page's own language ─────────────────────────────────────────────────
document.getElementById('site-lang')?.addEventListener('change', (e) => { location.href = `/${e.target.value}/`; });

// ── The demo ────────────────────────────────────────────────────────────────
const LANGS = { en: 'English', fr: 'Français', es: 'Español', 'pt-BR': 'Português', de: 'Deutsch', it: 'Italiano', ru: 'Русский', ja: '日本語', ko: '한국어', 'zh-CN': '中文' };
// n8n's own variables: a page styled for @n8n/chat keeps its look.
const COLOURS = {
    Teal: { secondary: '#178272', primary: '#e74266', header: '#101330' },
    Indigo: { secondary: '#4f46e5', primary: '#4f46e5', header: '#1e1b4b' },
    Coral: { secondary: '#e8590c', primary: '#e8590c', header: '#2b1a12' },
    Plum: { secondary: '#7c3aed', primary: '#7c3aed', header: '#1f1335' },
    Ink: { secondary: '#111827', primary: '#111827', header: '#000000' },
};
const YOURS_KEY = 'n8n-chat-site:your-n8n';
const state = { workflow: 'shop', lang: t.lang in LANGS ? t.lang : 'en', mode: 'embedded', colour: 'Teal', yours: null };
try { state.yours = JSON.parse(localStorage.getItem(YOURS_KEY) ?? 'null'); } catch { /* private mode */ }

const host = document.getElementById('demo-chat');
const note = document.getElementById('floating-note');
const tryRow = document.getElementById('try');
const workflowTabs = [...document.querySelectorAll('#workflow-tabs [data-workflow]')];
const modeTabs = [...document.querySelectorAll('#mode-tabs [data-mode]')];
let chat;

function selectTab(tabs, on) {
    for (const tab of tabs) {
        tab.setAttribute('aria-selected', String(tab === on));
        tab.tabIndex = tab === on ? 0 : -1;
    }
}

function mount({ greet = false } = {}) {
    chat?.destroy();
    const floating = state.mode === 'window';
    host.hidden = floating;
    note.hidden = !floating;
    const yours = state.workflow === 'yours' && state.yours;
    const own = state.lang === t.lang && !yours;
    const wf = state.workflow === 'booking' ? 'booking' : 'shop';
    chat = createChat({
        webhookUrl: yours ? state.yours.url : `/webhook/${wf}/chat`,
        mode: state.mode,
        ...(floating ? {} : { target: host }),
        defaultLanguage: state.lang,
        loadPreviousSession: Boolean(yours),
        colorScheme: 'auto',
        // The demo answers in the chat's language; the page's words name it when they match.
        metadata: yours ? { page: location.href } : { lang: state.lang },
        ...(own ? {
            initialMessages: [t[`demo.${wf}.greeting`]],
            i18n: { [state.lang]: { title: t[`demo.${wf}.title`], subtitle: t[`demo.${wf}.subtitle`], inputPlaceholder: t['demo.placeholder'] } },
        } : {}),
    });
    if (floating) chat.open();
    // The questions to click, in the page's language: the demo answers in English or French.
    tryRow.replaceChildren(tryRow.firstElementChild);
    if (!yours) {
        for (const key of ['q1', 'q2', 'q3']) {
            const text = t[`demo.${wf}.${key}`];
            const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, className: 'aparte-btn aparte-btn--surface aparte-btn--pill aparte-btn--sm' });
            b.addEventListener('click', () => { if (state.mode === 'window') chat.open(); chat.send(text); });
            tryRow.append(b);
        }
    }
    tryRow.hidden = Boolean(yours);
    if (greet && !yours) setTimeout(() => chat.send(t[`demo.${wf}.q1`]), 900);
    renderSettings();
}

function showWorkflow(name, options) {
    state.workflow = name;
    selectTab(workflowTabs, workflowTabs.find((tab) => tab.dataset.workflow === name));
    mount(options);
}

/** A tab list's keyboard: the arrows move to the next visible tab and choose it, as a click would. */
function arrows(tabs, choose) {
    for (const tab of tabs) {
        tab.addEventListener('click', () => choose(tab));
        tab.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const visible = tabs.filter((x) => !x.hidden);
            const next = visible[(visible.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
            next.focus();
            choose(next);
        });
    }
}
arrows(workflowTabs, (tab) => showWorkflow(tab.dataset.workflow));
arrows(modeTabs, (tab) => { state.mode = tab.dataset.mode; selectTab(modeTabs, tab); mount(); });
for (const link of document.querySelectorAll('[data-open]')) {
    link.addEventListener('click', () => showWorkflow(link.dataset.open));
}

const langSelect = document.getElementById('chat-lang');
for (const [code, name] of Object.entries(LANGS)) langSelect.append(new Option(name, code, false, code === state.lang));
langSelect.addEventListener('change', () => { state.lang = langSelect.value; mount(); });

const swatches = document.getElementById('colours');
for (const [name, c] of Object.entries(COLOURS)) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'swatch', title: name });
    b.style.background = c.secondary;
    b.setAttribute('aria-label', name);
    b.setAttribute('aria-pressed', String(name === state.colour));
    b.addEventListener('click', () => {
        state.colour = name;
        const root = document.documentElement.style;
        root.setProperty('--chat--color--secondary', c.secondary);
        root.setProperty('--chat--color--primary', c.primary);
        root.setProperty('--chat--header--background', c.header);
        for (const other of swatches.querySelectorAll('.swatch')) other.setAttribute('aria-pressed', String(other === b));
        renderSettings();
    });
    swatches.append(b);
}

// ── The settings, as code ───────────────────────────────────────────────────
let highlight = async (code) => null;
const settingsCode = document.getElementById('settings-code');
function settingsSource() {
    const c = COLOURS[state.colour];
    const lines = ['createChat({', `  webhookUrl: 'https://your-n8n.example.com/webhook/…/chat',`, `  colorScheme: 'auto',`];
    if (state.lang !== 'en') lines.push(`  defaultLanguage: '${state.lang}',`);
    if (state.mode === 'embedded') lines.push(`  mode: 'embedded',`, `  target: '#support-chat',`);
    lines.push('});');
    const css = state.colour === 'Teal' ? [] : ['', '/* In your stylesheet: n8n\'s own variables */', ':root {',
        `  --chat--color--secondary: ${c.secondary};`, `  --chat--color--primary: ${c.primary};`, `  --chat--header--background: ${c.header};`, '}'];
    return [...lines, ...css].join('\n');
}
async function renderSettings() {
    const source = settingsSource();
    settingsCode.textContent = source;
    const html = await highlight(source, 'js');
    if (html && settingsCode.textContent === source) settingsCode.innerHTML = html;
}

// ── The basics: small chats, each on its own demo workflow ───────────────────
const mini = (id, options) => createChat({
    target: `#${id}`, mode: 'embedded', loadPreviousSession: false, colorScheme: 'auto',
    defaultLanguage: t.lang, metadata: { lang: t.lang }, initialMessages: [], ...options,
});
mini('mini-buttons', { webhookUrl: '/webhook/buttons/chat', initialMessages: [t['basics.buttons.greeting']] });
mini('mini-markdown', {
    webhookUrl: '/webhook/shop/chat',
    messageHistory: [{ sender: 'user', text: t['basics.markdown.q'] }, { sender: 'bot', text: t['basics.markdown.a'] }],
});
mini('mini-files', {
    webhookUrl: '/webhook/files/chat', initialMessages: [t['basics.files.greeting']],
    allowFileUploads: true, allowedFilesMimeTypes: 'image/*,application/pdf',
});
mini('mini-errors', { webhookUrl: '/webhook/broken/chat', initialMessages: [t['basics.errors.greeting']] });

// ── "Your n8n" ──────────────────────────────────────────────────────────────
const form = document.getElementById('yours-form');
const urlInput = document.getElementById('yours-url');
const status = document.getElementById('yours-status');
const yoursTab = workflowTabs.find((tab) => tab.dataset.workflow === 'yours');
const say = (text, tone = '') => { status.textContent = text; status.dataset.tone = tone; };
if (state.yours) {
    urlInput.value = state.yours.url;
    yoursTab.hidden = false;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let url;
    try { url = new URL(urlInput.value.trim()); } catch { say(t['yours.err.url'], 'error'); return; }
    if (!/^https?:$/.test(url.protocol)) { say(t['yours.err.url'], 'error'); return; }
    say(t['yours.checking']);
    const local = /^(localhost|127\.|\[::1\])/.test(url.hostname);
    try {
        // The question n8n's widget asks first: it shows whether this page may talk to the trigger.
        const res = await fetch(url.href, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'loadPreviousSession', sessionId: `site-check-${Date.now()}` }),
        });
        if (res.status === 404) { say(t['yours.err.404'], 'error'); return; }
        if (!res.ok) { say(t['yours.err.other'].replace('{status}', String(res.status)), 'error'); return; }
    } catch {
        say(local ? t['yours.err.local'] : t['yours.err.cors'], 'error');
        return;
    }
    state.yours = { url: url.href };
    try { localStorage.setItem(YOURS_KEY, JSON.stringify(state.yours)); } catch { /* private mode */ }
    yoursTab.hidden = false;
    say(t['yours.ok'], 'ok');
    showWorkflow('yours');
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
});

// ── Start ───────────────────────────────────────────────────────────────────
showWorkflow('shop');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!still && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        if (state.workflow !== 'yours') setTimeout(() => chat.send(t[`demo.${state.workflow}.q1`]), 900);
    }, { threshold: 0.5 });
    seen.observe(host);
}

// ── The code blocks, coloured by aparté's Shiki provider; the ticket card, by its kit ──
const [core, shikiPlugin, shikiCore, engine, js, md, html, json, light, dark] = await Promise.all([
    import(cdn(`@aparte/core@${APARTE}/+esm`)),
    import(cdn(`@aparte/plugin-shiki@${APARTE}/core/+esm`)),
    import(cdn(`shiki@${SHIKI}/core/+esm`)),
    import(cdn(`shiki@${SHIKI}/engine/javascript/+esm`)),
    import(cdn(`@shikijs/langs@${SHIKI}/javascript/+esm`)),
    import(cdn(`@shikijs/langs@${SHIKI}/markdown/+esm`)),
    import(cdn(`@shikijs/langs@${SHIKI}/html/+esm`)),
    // The JSON inside a card block is coloured too: markdown embeds it.
    import(cdn(`@shikijs/langs@${SHIKI}/json/+esm`)),
    import(cdn(`@shikijs/themes@${SHIKI}/github-light/+esm`)),
    import(cdn(`@shikijs/themes@${SHIKI}/github-dark/+esm`)),
]);
const highlighter = await shikiCore.createHighlighterCore({
    themes: [light.default, dark.default],
    langs: [js.default, md.default, html.default, json.default],
    engine: engine.createJavaScriptRegexEngine(),
});
shikiPlugin.setupShikiProviderFromHighlighter(highlighter, { theme: { light: 'github-light', dark: 'github-dark' } });
highlight = (code, lang) => core.aparteGlobalConfig.highlightCode(code, lang === 'md' ? 'markdown' : lang).catch(() => null);
for (const pre of document.querySelectorAll('pre.code[data-lang]')) {
    if (pre === settingsCode) continue;
    const out = await highlight(pre.textContent, pre.dataset.lang);
    if (out) pre.innerHTML = out;
}
renderSettings();

// ── Example conversations: the widget, already talking, without header or field ──
const ticketCard = (config) => defineCard({
    name: 'ticket', variants: ['card'],
    // A card draws its own padding, from the kit's variable, as the shipped cards do.
    styles: '.aparte-ticket-card { padding: var(--aparte-rich-card-padding) } .aparte-ticket-card .t-id { font-weight: 700 } .aparte-ticket-card p { margin: 4px 0 }',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/></svg>',
    normalize: (raw) => (raw?.id ? raw : null),
    render: (x) => [el('div', { class: 't-id', text: `Ticket ${x.id}` }), el('p', { text: x.subject }), el('small', { text: x.status })],
    skeleton: () => [],
    label: (x) => `Ticket ${x?.id ?? ''}`,
    fallback: (x) => `Ticket ${x.id}: ${x.subject}`,
}).setup({ config });
const fence = (name, data) => '\n\n```card-' + name + '\n' + JSON.stringify(data) + '\n```';
const example = (id, history, setup) => createChat({
    webhookUrl: '/webhook/shop/chat', target: `#${id}`, mode: 'embedded', loadPreviousSession: false,
    colorScheme: 'auto', defaultLanguage: t.lang, initialMessages: [], messageHistory: history, ...(setup ? { setup } : {}),
});
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
example('convo-order', [
    { sender: 'user', text: t['cards.example.q'] },
    { sender: 'bot', text: t['cards.example.a'] + fence('order', {
        number: '1001', status: 'shipped', date_created: day(-2), currency: 'EUR', total: '68.00',
        line_items: [{ name: 'Linen shirt', quantity: 1, total: '49.00' }, { name: 'Canvas tote bag', quantity: 1, total: '19.00' }],
    }) },
]);
example('convo-ticket', [
    { sender: 'user', text: t['cards.own.q'] },
    { sender: 'bot', text: t['cards.own.a'] + fence('ticket', { id: 'T-42', subject: 'Refund for order 1001', status: 'Waiting for us' }) },
], ticketCard);

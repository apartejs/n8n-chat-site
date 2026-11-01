// The page's script: the demo chat and its settings, the settings as code, the ticket card,
// "your n8n", and the code blocks coloured — all with the published packages, from jsDelivr.
const t = JSON.parse(document.getElementById('i18n').textContent);
const APARTE = '0.30.0';
const SHIKI = '4.5.0';
const cdn = (path) => `https://cdn.jsdelivr.net/npm/${path}`;
// The card kit comes from the widget's own module: one copy of aparté for the chat and the cards.
const { createChat, defineCard, el } = await import(document.documentElement.dataset.widget);

// ── The page's own language ─────────────────────────────────────────────────
document.getElementById('site-lang')?.addEventListener('change', (e) => { location.href = `/${e.target.value}/`; });

// ── The demo ────────────────────────────────────────────────────────────────
const LANGS = { en: 'English', fr: 'Français', es: 'Español', 'pt-BR': 'Português', de: 'Deutsch', it: 'Italiano', ru: 'Русский', ja: '日本語', ko: '한국어', 'zh-CN': '中文' };
// The two choices a site makes, as n8n's own variables (a page styled for @n8n/chat keeps them):
// its color — the visitor's bubble, the send button, the corner button, the dark surfaces' tint —
// and the chat's surroundings. Dark follows both by itself, so neither needs a dark value.
const DEFAULT_ACCENT = '#178272';
const ACCENTS = { Teal: DEFAULT_ACCENT, Indigo: '#4f46e5', Coral: '#c2410c', Plum: '#7c3aed', Ocean: '#0369a1' };
const hex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, share) => hex(rgbOf(a).map((v, i) => v * share + rgbOf(b)[i] * (1 - share)));
/** White text on this color, as WCAG counts it. */
function contrastWithWhite(h) {
    const lum = rgbOf(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 1.05 / (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] + 0.05);
}
// A background is a light one and its dark: n8n's is the widget's own navy, tinted with the color;
// the others bring their dark surfaces, as aparté's variables (n8n has no dark ones).
const darkOf = (bg, surface, border) => ({ bg, surface, surface2: mix(border, surface, 0.5), border, bubble: surface });
const SURFACES = {
    n8n: () => ({}),
    neutral: () => ({ header: '#18181b', body: '#f4f4f5', dark: darkOf('#111113', '#1c1c1f', '#2e2e33') }),
    warm: () => ({ header: '#2a211a', body: '#f6f1ea', dark: darkOf('#14110e', '#201a15', '#382f26') }),
    tinted: (accent) => ({
        header: mix(accent, '#000000', 0.78), body: mix(accent, '#ffffff', 0.07),
        dark: darkOf(mix(accent, '#0e0e11', 0.1), mix(accent, '#18181c', 0.13), mix(accent, '#2a2a30', 0.22)),
    }),
};
function darkVars() {
    const d = SURFACES[state.surface](state.accent).dark;
    return d ? [['--aparte-bg', d.bg, 'behind the messages'], ['--aparte-surface-1', d.surface, 'the field, the cards'], ['--aparte-surface-2', d.surface2, 'the buttons at rest'],
        ['--aparte-border', d.border, 'the lines'], ['--aparte-message-content-bg-assistant', d.bubble, 'the answers']] : [];
}
/** The variables the two choices set, each with what it changes: what the page applies, and shows. */
function colourVars() {
    const s = SURFACES[state.surface](state.accent);
    return [
        // Always written, the default too: unset, the corner button falls back to n8n's pink.
        ['--chat--color--secondary', state.accent, 'your bubble, the send button, the corner button'],
        s.header && ['--chat--header--background', s.header, 'the title bar, in light and dark'],
        s.body && ['--chat--body--background', s.body, 'behind the messages, in light'],
    ].filter(Boolean);
}
const paletteStyle = document.head.appendChild(document.createElement('style'));
function applyPalette() {
    const css = (vars) => vars.map(([name, value]) => `${name}: ${value};`).join(' ');
    const dark = css(darkVars());
    // `html` in front: the widget's own dark rules have these selectors.
    paletteStyle.textContent = `:root { ${css(colourVars())} }` + (dark
        ? ` html .aparte-n8n[data-aparte-theme='dark'] { ${dark} } @media (prefers-color-scheme: dark) { html .aparte-n8n:not([data-aparte-theme]) { ${dark} } }`
        : '');
    const ratio = contrastWithWhite(state.accent);
    accentNote.hidden = ratio >= 4.5;
    accentNote.textContent = t['demo.contrast'].replace('{ratio}', ratio.toLocaleString(t.lang, { maximumFractionDigits: 1 }));
    renderSettings();
}
/** Every chat on the page in the chosen scheme: the demo, the small ones, the examples. */
function applyScheme() {
    for (const root of document.querySelectorAll('.aparte-n8n')) {
        if (state.scheme === 'auto') root.removeAttribute('data-aparte-theme');
        else root.setAttribute('data-aparte-theme', state.scheme);
    }
}
// The place card on OpenStreetMap's tiles: a site this size is within their usage policy, credit shown.
const CARDS = { place: { mapTiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', mapAttribution: '© OpenStreetMap contributors' } };
const YOURS_KEY = 'n8n-chat-site:your-n8n';
const state = { workflow: 'shop', lang: t.lang in LANGS ? t.lang : 'en', mode: 'embedded', accent: DEFAULT_ACCENT, surface: 'n8n', scheme: 'auto', yours: null };
try { state.yours = JSON.parse(localStorage.getItem(YOURS_KEY) ?? 'null'); } catch { /* private mode */ }

const host = document.getElementById('demo-chat');
const note = document.getElementById('floating-note');
const tryRow = document.getElementById('try');
const workflowTabs = [...document.querySelectorAll('#workflow-tabs [data-workflow]')];
const modeTabs = [...document.querySelectorAll('#mode-tabs [data-mode]')];
const schemeTabs = [...document.querySelectorAll('#scheme-tabs [data-scheme]')];
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
        cards: CARDS,
        mode: state.mode,
        ...(floating ? {} : { target: host }),
        defaultLanguage: state.lang,
        loadPreviousSession: Boolean(yours),
        colorScheme: state.scheme,
        // The demo answers in the chat's language; the page's words name it when they match.
        metadata: yours ? { page: location.href } : { lang: state.lang },
        ...(own ? {
            initialMessages: [t[`demo.${wf}.greeting`]],
            i18n: { [state.lang]: { title: t[`demo.${wf}.title`], subtitle: t[`demo.${wf}.subtitle`], inputPlaceholder: t['demo.placeholder'] } },
        } : {}),
    });
    if (floating) chat.open();
    // The questions to click, in the page's language: the demo answers in the chat's language.
    tryRow.replaceChildren(tryRow.firstElementChild);
    if (!yours) {
        for (const key of ['q1', 'q4', 'q2', 'q3']) {
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
arrows(schemeTabs, (tab) => { state.scheme = tab.dataset.scheme; selectTab(schemeTabs, tab); applyScheme(); renderSettings(); });
for (const link of document.querySelectorAll('[data-open]')) {
    link.addEventListener('click', () => showWorkflow(link.dataset.open));
}

const langSelect = document.getElementById('chat-lang');
for (const [code, name] of Object.entries(LANGS)) langSelect.append(new Option(name, code, false, code === state.lang));
langSelect.addEventListener('change', () => { state.lang = langSelect.value; mount(); });

// Your color: a few to try, or your own, with what white text reads like on it.
const swatches = document.getElementById('colours');
const accentNote = document.getElementById('accent-note');
const custom = Object.assign(document.createElement('input'), { type: 'color', className: 'swatch swatch--custom', value: DEFAULT_ACCENT, title: t['demo.custom'] });
custom.setAttribute('aria-label', t['demo.custom']);
function pickAccent(value, pressed) {
    state.accent = value;
    for (const b of swatches.querySelectorAll('button.swatch')) b.setAttribute('aria-pressed', String(b === pressed));
    custom.classList.toggle('is-on', !pressed);
    applyPalette();
}
for (const [name, value] of Object.entries(ACCENTS)) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'swatch', title: name });
    b.style.background = value;
    b.setAttribute('aria-label', name);
    b.setAttribute('aria-pressed', String(value === state.accent));
    b.addEventListener('click', () => pickAccent(value, b));
    swatches.append(b);
}
custom.addEventListener('input', () => pickAccent(custom.value, null));
swatches.append(custom);

// The chat's surroundings: n8n's own, or a header and a background that suit the page.
const surfaceTabs = [...document.querySelectorAll('#surface-tabs [data-surface]')];
arrows(surfaceTabs, (tab) => { state.surface = tab.dataset.surface; selectTab(surfaceTabs, tab); applyPalette(); });

// ── The settings, as code ───────────────────────────────────────────────────
let highlight = async (code) => null;
const settingsCode = document.getElementById('settings-code');
function settingsSource() {
    const lines = ['createChat({', `  webhookUrl: 'https://your-n8n.example.com/webhook/…/chat',`, `  colorScheme: '${state.scheme}',`];
    if (state.lang !== 'en') lines.push(`  defaultLanguage: '${state.lang}',`);
    if (state.mode === 'embedded') lines.push(`  mode: 'embedded',`, `  target: '#support-chat',`);
    lines.push('});');
    const vars = colourVars();
    const css = vars.length
        ? ['', '/* In your stylesheet: n8n\'s own variables. */', ':root {', ...vars.map(([name, value, what]) => `  ${name}: ${value}; /* ${what} */`), '}']
        : [];
    // This background's dark surfaces, with the widget's own selectors: loaded after its stylesheet, they win.
    const dark = darkVars().map(([name, value, what]) => `${name}: ${value}; /* ${what} */`);
    if (dark.length && state.scheme === 'dark') {
        css.push('', '/* Dark: aparté\'s variables (n8n has none). */', ".aparte-n8n[data-aparte-theme='dark'] {", ...dark.map((v) => `  ${v}`), '}');
    } else if (dark.length && state.scheme === 'auto') {
        css.push('', '/* Dark, when the visitor\'s system is: aparté\'s variables (n8n has none). */', '@media (prefers-color-scheme: dark) {',
            '  .aparte-n8n:not([data-aparte-theme]) {', ...dark.map((v) => `    ${v}`), '  }', '}');
    }
    return [...lines, ...css].join('\n');
}
// The same code twice: in its section, and in the dialog the configurator opens.
const settingsDialogCode = document.getElementById('settings-code-dialog');
async function renderSettings() {
    const source = settingsSource();
    for (const pre of [settingsCode, settingsDialogCode]) pre.textContent = source;
    const html = await highlight(source, 'js');
    for (const pre of [settingsCode, settingsDialogCode]) if (html && pre.textContent === source) pre.innerHTML = html;
}
const configDialog = document.getElementById('config-dialog');
document.getElementById('show-config').addEventListener('click', () => configDialog.showModal());
document.getElementById('config-close').addEventListener('click', () => configDialog.close());
// A click on the backdrop (the dialog itself, outside its box) closes it too.
configDialog.addEventListener('click', (e) => { if (e.target === configDialog) configDialog.close(); });
const copyButton = document.getElementById('config-copy');
copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(settingsSource());
        copyButton.textContent = t['demo.copied'];
        setTimeout(() => { copyButton.textContent = t['demo.copy']; }, 1500);
    } catch { /* a browser that refuses the clipboard leaves the code selectable */ }
});

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
    colorScheme: 'auto', defaultLanguage: t.lang, initialMessages: [], messageHistory: history, cards: CARDS, ...(setup ? { setup } : {}),
});
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
example('convo-order', [
    { sender: 'user', text: t['cards.example.q'] },
    { sender: 'bot', text: t['cards.example.a'] + fence('order', {
        number: '1001', status: 'shipped', date_created: day(-2), currency: 'EUR', total: '68.00',
        line_items: [{ name: 'Linen shirt', quantity: 1, total: '49.00' }, { name: 'Canvas tote bag', quantity: 1, total: '19.00' }],
    }) },
]);
const [linen, oxford] = t['cards.more.product.names'].split('|');
example('convo-product', [
    { sender: 'user', text: t['cards.more.product.q'] },
    { sender: 'bot', text: t['cards.more.product.a'] + fence('product', [
        { id: '11', title: linen, image: { src: `${location.origin}/products/linen-shirt.jpg`, alt: linen }, price: '49.00', currency: 'EUR', availability: 'in-stock', options: ['S', 'M', 'L', 'XL'], rating: 4.6, reviewCount: 38 },
        { id: '12', title: oxford, image: { src: `${location.origin}/products/oxford-shirt.jpg`, alt: oxford }, price: '39.00', compareAtPrice: '55.00', currency: 'EUR', availability: 'in-stock', options: ['M', 'L'], rating: 4.3, reviewCount: 12 },
    ]) },
]);
// Tomorrow at 10:00 on the reader's clock, written without a zone as the booking workflow's card reads it.
const tomorrow = new Date(Date.now() + 86400000);
const at = (h, m) => `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T${h}:${m}:00`;
example('convo-booking', [
    { sender: 'user', text: t['cards.more.booking.q'] },
    { sender: 'bot', text: t['cards.more.booking.a'] + fence('order', {
        kind: 'booking', status: 'confirmed', items: [{ title: t['cards.more.booking.service'] }],
        booking: { start: at('10', '00'), end: at('10', '30'), location: `${t['demo.booking.title']}, 12 rue de la Paix, 75002 Paris` },
    }) },
]);
example('convo-place', [
    { sender: 'user', text: t['cards.more.place.q'] },
    { sender: 'bot', text: t['cards.more.place.a'] + fence('place', {
        name: t['demo.booking.title'], address: '12 rue de la Paix, 75002 Paris', phone: '+33 1 23 45 67 89', coordinates: { lat: 48.8686, lng: 2.331 },
        hours: [1, 2, 3, 4, 5].map((day) => ({ day, open: '09:00', close: '17:00' })),
        // "Open now" read on the studio's clock, wherever the reader is.
        utcOffset: Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
            .formatToParts(new Date()).find((x) => x.type === 'timeZoneName').value.match(/GMT([+-]\d+)?/)?.[1] ?? 0) * 60,
    }) },
]);
example('convo-ticket', [
    { sender: 'user', text: t['cards.own.q'] },
    { sender: 'bot', text: t['cards.own.a'] + fence('ticket', { id: 'T-42', subject: 'Refund for order 1001', status: 'Waiting for us' }) },
], ticketCard);
// The examples are made in 'auto': the scheme picked meanwhile, if any.
applyScheme();
// The palette from the start: the default colour written too, so the corner button is not n8n's pink.
applyPalette();

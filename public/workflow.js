// A workflow's page: the workflow drawn by n8n's own preview component, and the widget on its
// demo to try it live.
const t = JSON.parse(document.getElementById('i18n').textContent);
const main = document.querySelector('[data-workflow]');
const id = main.dataset.workflow;
const live = id === 'shop' || id === 'booking';
const APARTE = '1.0.0';
const SHIKI = '4.5.0';
const cdn = (path) => `https://cdn.jsdelivr.net/npm/${path}`;

document.getElementById('site-lang')?.addEventListener('change', (e) => { location.href = `/${e.target.value}/workflows/${id}/`; });
for (const el of document.querySelectorAll('[data-if-live]')) el.hidden = !live;
for (const el of document.querySelectorAll('[data-if-nolive]')) el.hidden = live;

if (live) {
    const { createChat } = await import(document.documentElement.dataset.widget);
    createChat({
        webhookUrl: `/webhook/${id}/chat`, target: '#demo-chat', mode: 'embedded', loadPreviousSession: false, colorScheme: 'auto',
        // The studio's address on OpenStreetMap's tiles, credit shown.
        cards: { place: { mapTiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', mapAttribution: '© OpenStreetMap contributors' } },
        // The shop asks for a photo of a damaged item, as its workflow's Chat Trigger allows.
        ...(id === 'shop' ? { allowFileUploads: true, allowedFilesMimeTypes: 'image/*' } : {}),
        defaultLanguage: t.lang, metadata: { lang: t.lang },
        initialMessages: [t[`demo.${id}.greeting`]],
        i18n: { [t.lang]: { title: t[`demo.${id}.title`], subtitle: t[`demo.${id}.subtitle`], inputPlaceholder: t['demo.placeholder'] } },
        // The questions to start with, in the chat, until the first message; then each answer
        // of the demo offers what comes next.
        suggestions: ['q1', 'q2', 'q3'].map((key) => t[`demo.${id}.${key}`]),
    });
}

// The workflow, as n8n shows it: <n8n-demo>, n8n's own preview, fed the JSON this page offers.
const json = await fetch(main.dataset.json).then((r) => r.text());
await import(cdn('@n8n_io/n8n-demo-component@1.0.20/+esm')).catch(() => null);
const preview = document.createElement('n8n-demo');
preview.setAttribute('workflow', json);
preview.setAttribute('frame', 'true');
preview.setAttribute('clicktointeract', 'true');
preview.setAttribute('collapseformobile', 'false');
if (matchMedia('(prefers-color-scheme: dark)').matches) preview.setAttribute('theme', 'dark');
document.getElementById('preview').append(preview);

// The setup snippet, coloured by aparté's Shiki provider.
const [core, shikiPlugin, shikiCore, engine, html, light, dark] = await Promise.all([
    import(cdn(`@aparte/core@${APARTE}/+esm`)),
    import(cdn(`@aparte/plugin-shiki@${APARTE}/core/+esm`)),
    import(cdn(`shiki@${SHIKI}/core/+esm`)),
    import(cdn(`shiki@${SHIKI}/engine/javascript/+esm`)),
    import(cdn(`@shikijs/langs@${SHIKI}/html/+esm`)),
    import(cdn(`@shikijs/themes@${SHIKI}/github-light/+esm`)),
    import(cdn(`@shikijs/themes@${SHIKI}/github-dark/+esm`)),
]);
const highlighter = await shikiCore.createHighlighterCore({ themes: [light.default, dark.default], langs: [html.default], engine: engine.createJavaScriptRegexEngine() });
shikiPlugin.setupShikiProviderFromHighlighter(highlighter, { theme: { light: 'github-light', dark: 'github-dark' } });
for (const pre of document.querySelectorAll('pre.code[data-lang]')) {
    const out = await core.aparteGlobalConfig.highlightCode(pre.textContent, pre.dataset.lang).catch(() => null);
    if (out) pre.innerHTML = out;
}

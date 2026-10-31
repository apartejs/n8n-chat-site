/**
 * The demo, played the way the widget plays it — POST, then the chat socket, then a button's
 * link — against a running server: `node test.mjs [base]` (default http://localhost:3000).
 * Exits non-zero on the first answer that is not what the workflow says.
 */
const base = process.argv[2] ?? 'http://localhost:3000';
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

/** One conversation: each step says something or clicks a button; returns every frame's text. */
async function converse(workflow, lang, steps) {
    const sessionId = `test-${workflow}-${lang}-${Math.random().toString(36).slice(2)}`;
    const heard = [];
    let ws = null;
    let buttons = null;
    let wake = null;
    const queue = [];
    const next = (ms) => new Promise((resolve) => {
        if (queue.length) return resolve(queue.shift());
        const timer = setTimeout(() => { wake = null; resolve(null); }, ms);
        wake = () => { clearTimeout(timer); wake = null; resolve(queue.shift()); };
    });
    const listen = async () => {
        for (;;) {
            const frame = await next(4000);
            if (frame === null) return;
            if (frame === 'n8n|continue') continue;
            let value;
            try { value = JSON.parse(frame); } catch { value = null; }
            if (value?.type === 'with-buttons') { buttons = value.buttons; heard.push(`[${value.text}] ${buttons.map((b) => b.text).join('|')}`); return; }
            heard.push(frame);
            const after = await next(1200);
            if (after === null) return;
            if (after !== 'n8n|continue') queue.unshift(after);
        }
    };
    for (const step of steps) {
        if (step.click) {
            const button = buttons?.find((b) => b.text === step.click);
            if (!button) { heard.push(`(no button ${step.click})`); break; }
            buttons = null;
            const res = await fetch(new URL(button.link, base));
            check(res.ok, `${workflow}/${lang}: the "${step.click}" link answers 200`);
            await listen();
            continue;
        }
        if (ws) {
            ws.send(JSON.stringify({ sessionId, action: 'sendMessage', chatInput: step.say, files: [] }));
            await listen();
            continue;
        }
        const res = await fetch(`${base}/webhook/${workflow}/chat`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: step.say, metadata: { lang } }),
        });
        const body = await res.json();
        check(body.executionStarted === true, `${workflow}/${lang}: the POST starts an execution`);
        ws = new WebSocket(`${base.replace(/^http/, 'ws')}/chat?sessionId=${sessionId}&executionId=${body.executionId}&isPublic=true&token=${body.resumeToken}`);
        ws.onmessage = (e) => { queue.push(String(e.data)); wake?.(); };
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        await listen();
    }
    ws?.close();
    return heard.join('\n');
}

const has = (text, ...parts) => parts.every((p) => (p instanceof RegExp ? p.test(text) : text.includes(p)));

// The page and its languages.
const root = await fetch(`${base}/`, { redirect: 'manual', headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } });
check(root.status === 302 && root.headers.get('location') === '/fr/', '/ sends a French visitor to /fr/');
const nobody = await fetch(`${base}/`, { redirect: 'manual', headers: { 'accept-language': 'xx' } });
check(nobody.headers.get('location') === '/en/', '/ sends an unknown language to /en/');
for (const lang of ['en', 'fr']) {
    const html = await (await fetch(`${base}/${lang}/`)).text();
    check(!/\{\{[a-zA-Z0-9.]+\}\}/.test(html), `/${lang}/ has no unfilled {{key}}`);
    check(html.includes(`<html lang="${lang}"`), `/${lang}/ says its language`);
}
for (const path of ['/site.css', '/site.js', '/favicon.svg', '/workflows/shop-returns.json', '/workflows/booking.json', '/workflows/document-qa.json']) {
    check((await fetch(base + path)).ok, `${path} is served`);
}

// The shop.
let a = await converse('shop', 'en', [{ say: 'Where is my order 1001? ada@example.com' }]);
check(has(a, 'Your order 1001', '```card-order', '"status":"shipped"'), 'shop/en: the order and its card');
a = await converse('shop', 'en', [{ say: 'Where is my order 1001? mallory@example.com' }]);
check(has(a, 'No order matches') && !a.includes('card-order'), 'shop/en: a wrong email gets nothing');
a = await converse('shop', 'en', [{ say: 'Where is my order 1001?' }, { say: 'ada@example.com' }]);
check(has(a, 'email address order 1001', 'Your order 1001'), 'shop/en: asks the email, then tells');
a = await converse('shop', 'en', [{ say: 'Where is my order 1001? ada@example.com' }, { say: 'I want to return the linen shirt, it is too small' }, { click: 'Open the return' }]);
check(has(a, 'Open a return for the linen shirt from order 1001? Reason: too small', 'Your return for order 1001 is open'), 'shop/en: a return, confirmed with the button');
a = await converse('shop', 'en', [{ say: 'Where is order 1002? bob@example.com' }, { say: 'I want to return the coat' }]);
check(has(a, 'cannot be returned yet'), 'shop/en: an order not shipped cannot go back');
a = await converse('shop', 'fr', [{ say: 'Où est ma commande 1001 ? ada@example.com' }, { say: 'Je veux retourner la chemise en lin, elle est trop petite' }, { click: 'Garder ma commande' }]);
check(has(a, 'Votre commande 1001', 'Ouvrir un retour pour la chemise en lin', 'reste telle quelle'), 'shop/fr: in French, kept with the button');

// Booking.
a = await converse('booking', 'en', [{ say: 'I would like an appointment on Tuesday morning' }, { say: '10:00, Ada Lovelace, ada@example.com' }, { click: 'Book it' }]);
check(has(a, 'Tuesday works', 'Book ', 'for Ada Lovelace', 'Booked:', '```card-order', '"kind":"booking"'), 'booking/en: times, buttons, the booking and its card');
a = await converse('booking', 'en', [{ say: 'Thursday afternoon please' }, { say: '14:00, Bob Smith, bob@example.com' }, { click: 'Another time' }]);
check(has(a, '14:00, 15:00 or 16:00', 'Which other day'), 'booking/en: the afternoon, then another time');
a = await converse('booking', 'fr', [{ say: 'Je voudrais un rendez-vous mardi matin' }, { say: '10h, Ada Lovelace, ada@example.com' }, { click: 'Réserver' }]);
check(has(a, "Mardi, c'est possible", "C'est réservé", '"kind":"booking"'), 'booking/fr: in French, booked with its card');

// Every language: its pages, and the demo's own questions giving the cards and the buttons.
const { readdirSync, readFileSync } = await import('node:fs');
for (const file of readdirSync(new URL('./i18n/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(new URL(`./i18n/${file}`, import.meta.url), 'utf8'));
    const lang = t.lang;
    const T = (await import(new URL(`./demo/texts/${lang}.mjs`, import.meta.url))).default;
    for (const path of ['', 'workflows/shop/', 'workflows/booking/', 'workflows/documents/']) {
        const res = await fetch(`${base}/${lang}/${path}`);
        const html = await res.text();
        check(res.ok && !/\{\{[a-zA-Z0-9.@]+\}\}/.test(html), `/${lang}/${path}: served, every text filled`);
    }
    let r = await converse('shop', lang, [{ say: t['demo.shop.q1'] }, { say: t['demo.shop.q2'] }, { click: T.openReturn }]);
    check(has(r, '```card-order', T.returnOpen('1001', 'ada@example.com')), `shop/${lang}: the order's card, then the return opened with "${T.openReturn}"`);
    r = await converse('shop', lang, [{ say: t['demo.shop.q3'] }]);
    check(has(r, '```card-order', '"status":"processing"'), `shop/${lang}: order 1002, being prepared`);
    r = await converse('booking', lang, [{ say: t['demo.booking.q1'] }, { say: t['demo.booking.q2'] }, { click: T.bookIt }]);
    check(has(r, '"kind":"booking"'), `booking/${lang}: booked with "${T.bookIt}", with its card`);
    r = await converse('booking', lang, [{ say: t['demo.booking.q3'] }]);
    check(has(r, '14:00'), `booking/${lang}: the afternoon offers afternoon times`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);

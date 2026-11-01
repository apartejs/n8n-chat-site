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
    r = await converse('buttons', lang, [{ say: 'hello' }, { click: T.buttonsYes }]);
    check(has(r, T.buttonsQ, T.buttonsBooked), `buttons/${lang}: asked with "${T.buttonsYes}", answered`);
}

// The basics: a file is read, a broken workflow fails as n8n's does.
{
    const form = new FormData();
    form.set('action', 'sendMessage');
    form.set('sessionId', 'test-files');
    form.set('chatInput', 'here');
    form.set('metadata', JSON.stringify({ lang: 'en' }));
    form.append('files', new Blob([new Uint8Array(2048)], { type: 'application/pdf' }), 'invoice.pdf');
    const res = await fetch(`${base}/webhook/files/chat`, { method: 'POST', body: form });
    const body = await res.json();
    check(body.executionStarted === true, 'files: a message with a file starts an execution');
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/chat?sessionId=test-files&executionId=${body.executionId}&isPublic=true`);
    const said = await new Promise((resolve) => { ws.onmessage = (e) => { resolve(String(e.data)); ws.close(); }; setTimeout(() => resolve(''), 4000); });
    check(has(said, '**invoice.pdf**', '2 kB'), `files: names the file and its size (${said.slice(0, 60)}…)`);
    const big = new FormData();
    big.append('files', new Blob([new Uint8Array(6 * 1024 * 1024)]), 'huge.bin');
    check((await fetch(`${base}/webhook/files/chat`, { method: 'POST', body: big }).catch(() => ({ status: 413 }))).status === 413, 'files: more than 5 MB is refused');
    const broken = await fetch(`${base}/webhook/broken/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: 'x', chatInput: 'hi' }) });
    check(broken.status === 500, 'broken: answers 500, as a failed n8n workflow');
}

// What a stranger can send: the server answers, and is still up after.
{
    const net = await import('node:net');
    const tls = await import('node:tls');
    const target = new URL(base);
    const secure = target.protocol === 'https:';
    // Bytes as written, which fetch would normalise: over TLS for the site online.
    const raw = (request) => new Promise((resolve) => {
        const socket = secure
            ? tls.connect(Number(target.port || 443), target.hostname, { servername: target.hostname }, () => socket.write(request.replace('Host: x', `Host: ${target.hostname}`)))
            : net.connect(Number(target.port), '127.0.0.1', () => socket.write(request));
        let out = '';
        socket.on('data', (d) => { out += d; });
        socket.on('close', () => resolve(out));
        socket.on('error', () => resolve(out));
        setTimeout(() => { socket.destroy(); resolve(out); }, 3000);
    });
    check((await fetch(`${base}/%E0%A4%A`)).status === 400, 'a malformed escape in the path is a 400');
    // Behind the site's proxy, `//` arrives cleaned to `/` and is redirected: an answer either way.
    const odd = await raw('GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
    check(odd.startsWith('HTTP/1.1 400') || (secure && odd.startsWith('HTTP/1.1 302')), 'a path that is not a URL is answered (400, or cleaned by the proxy)');
    await raw('GET // HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
    const start = await (await fetch(`${base}/webhook/shop/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: 'stranger', chatInput: 'hi' }) })).json();
    check(/^[0-9a-f-]{36}$/.test(start.executionId), 'an execution id cannot be guessed');
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/chat?sessionId=stranger&executionId=${start.executionId}&isPublic=true`);
    await new Promise((resolve) => { ws.onopen = resolve; ws.onerror = resolve; });
    ws.send(JSON.stringify({ action: 'sendMessage', chatInput: { toString: 1, valueOf: 1 } }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    ws.close();
    check((await fetch(`${base}/en/`)).ok, 'the server is still up after all of it');
    const lang = async (header) => (await fetch(`${base}/`, { redirect: 'manual', headers: { 'accept-language': header } })).headers.get('location');
    check(await lang('fr; q=0.9, en;q=0.1') === '/fr/', 'Accept-Language: a space before q is read');
    check(await lang('fr;q=0, de') === '/de/', 'Accept-Language: q=0 is a refusal');
    check(await lang('zh-TW,zh;q=0.9') === '/zh-CN/', 'Accept-Language: zh after zh-TW gets Simplified');
    check(await lang('zh-TW') === '/en/', 'Accept-Language: Traditional alone is not sent to Simplified');
    check(await lang('pt-PT') === '/pt-BR/', 'Accept-Language: pt-PT reads Portuguese');
}

// The booking card's time is the visitor's, never shifted by the server's zone.
{
    const r = await converse('booking', 'en', [{ say: 'Tuesday please' }, { say: '10:00, Ada Lovelace, ada@example.com' }, { click: 'Book it' }]);
    check(/"start":"\d{4}-\d{2}-\d{2}T10:00:00"/.test(r) && /"end":"\d{4}-\d{2}-\d{2}T10:30:00"/.test(r), 'booking: 10:00 stays 10:00, with no zone to shift it');
}

// A file sent on the open socket, as the widget sends the next message.
{
    const sessionId = 'test-files-socket';
    const res = await fetch(`${base}/webhook/files/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: 'hi', metadata: { lang: 'en' } }) });
    const { executionId } = await res.json();
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/chat?sessionId=${sessionId}&executionId=${executionId}&isPublic=true`);
    const frames = [];
    ws.onmessage = (e) => frames.push(String(e.data));
    await new Promise((resolve) => { ws.onopen = resolve; });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const data = `data:image/png;base64,${Buffer.alloc(60 * 1024).toString('base64')}`;
    ws.send(JSON.stringify({ sessionId, action: 'sendMessage', chatInput: 'and this', files: [{ name: 'photo.png', type: 'image/png', data }] }));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    ws.close();
    check(frames.some((f) => f.includes('**photo.png**') && f.includes('60')), `files: a 60 kB file on the open socket is read (${frames.at(-1)?.slice(0, 50)}…)`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);

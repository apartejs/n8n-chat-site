/**
 * The demo's two workflows, played without n8n or a model: the shop assistant and the booking
 * assistant offered for download on the site, with the sentences, buttons and cards they give
 * on n8n (recorded on a test bench), and the same rules — an order is told only to its email,
 * only a shipped order goes back, a time is booked only once confirmed with a button.
 *
 * A turn is a list of steps: `{ say }` is a Chat node's message, `{ ask }` a Chat node that waits
 * for an approval, with what follows each answer. They answer in the page's language
 * (`demo/texts/<lang>.mjs`), as the real workflows answer in the visitor's.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
const EMAIL = /[^\s@,]+@[^\s@,]+\.[a-z]{2,}/i;
const iso = (d) => d.toISOString();
const card = (name, data) => '\n\n```card-' + name + '\n' + JSON.stringify(data) + '\n```';
/** Quick replies the widget shows above its input, written like a card: a ```suggestions block. */
const replies = (list) => '\n\n```suggestions\n' + JSON.stringify(list) + '\n```';

// ── The languages ───────────────────────────────────────────────────────────

const TEXTS = {};
const dir = fileURLToPath(new URL('./texts/', import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    const lang = file.slice(0, -4);
    TEXTS[lang] = (await import(new URL(`./texts/${file}`, import.meta.url))).default;
    // The studio's name as the page names it in that language (its chat's title).
    TEXTS[lang].studio = JSON.parse(readFileSync(new URL(`../i18n/${lang}.json`, import.meta.url), 'utf8'))['demo.booking.title'];
}

/** A language's texts, English for any key it lacks — merged once per language. */
const merged = new Map();
const textsOf = (state) => {
    const lang = TEXTS[state.lang] ? state.lang : TEXTS[(state.lang ?? 'en').split('-')[0]] ? (state.lang ?? 'en').split('-')[0] : 'en';
    if (!merged.has(lang)) merged.set(lang, { ...TEXTS.en, ...TEXTS[lang], words: { ...TEXTS.en.words, ...TEXTS[lang].words } });
    return merged.get(lang);
};
/**
 * A time on the visitor's clock, written without a zone: the server's own zone (UTC in the
 * container) must not move "10:00" — the card reads a zoneless time as the reader's local time.
 */
const localTime = (d, minutes) => {
    const pad = (n) => String(n).padStart(2, '0');
    const total = minutes;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(Math.floor(total / 60))}:${pad(total % 60)}:00`;
};

/** A language's words as regular expressions, compiled once. */
const compiled = new WeakMap();
function wordsOf(T) {
    let W = compiled.get(T);
    if (!W) {
        W = Object.fromEntries(Object.entries(T.words).map(([k, v]) => [k, k === 'days' ? v : new RegExp(v, 'i')]));
        compiled.set(T, W);
    }
    return W;
}

const dayOf = (T, d) => d.toLocaleDateString(T.locale, { weekday: 'long', day: 'numeric', month: 'long' });
const weekdayOf = (T, d) => {
    const w = d.toLocaleDateString(T.locale, { weekday: 'long' });
    return w.charAt(0).toUpperCase() + w.slice(1);
};

// ── The shop ────────────────────────────────────────────────────────────────

const ORDERS = {
    1001: {
        email: 'ada@example.com', status: 'shipped', placed: -12, shipped: -8,
        items: [{ name: 'Linen shirt', quantity: 1, total: '49.00' }, { name: 'Canvas tote bag', quantity: 1, total: '19.00' }], total: '68.00',
    },
    1002: {
        email: 'bob@example.com', status: 'processing', placed: -1, shipped: null,
        items: [{ name: 'Wool coat', quantity: 1, total: '120.00' }], total: '120.00',
    },
};

// The sample products of the downloadable workflow, as its Code node turns them into a card.
const PRODUCTS = [
    { id: '11', title: 'Linen shirt', price: '49.00', availability: 'in-stock', options: ['S', 'M', 'L', 'XL'], rating: 4.6, reviewCount: 38, words: ['shirt', 'linen'] },
    { id: '12', title: 'Oxford shirt', price: '39.00', compareAtPrice: '55.00', availability: 'in-stock', options: ['M', 'L'], rating: 4.3, reviewCount: 12, words: ['shirt', 'oxford'] },
    { id: '13', title: 'Wool coat', price: '120.00', availability: 'preorder', options: ['S', 'M', 'L'], rating: 4.8, reviewCount: 21, words: ['coat', 'wool'] },
    { id: '14', title: 'Canvas tote bag', price: '19.00', availability: 'in-stock', options: [], rating: 4.5, reviewCount: 64, words: ['bag'] },
    { id: '15', title: 'Leather belt', price: '35.00', availability: 'out-of-stock', options: ['90 cm', '100 cm'], rating: 4.1, reviewCount: 9, words: ['belt'] },
];

/** The products a message names, matched like the workflow's search: the most words wins. */
function productsIn(W, text) {
    const said = ['shirt', 'linen', 'oxford', 'coat', 'wool', 'bag', 'belt'].filter((w) => W[w]?.test(text));
    const score = (p) => p.words.filter((w) => said.includes(w)).length;
    const best = Math.max(0, ...PRODUCTS.map(score));
    return best ? PRODUCTS.filter((p) => score(p) === best) : [];
}

/** Where the product photos are served: this site (SITE_ORIGIN to try them on another host). */
const ORIGIN = process.env.SITE_ORIGIN ?? 'https://n8n-chat.apartejs.dev';
const productCard = (T, found) => {
    const list = found.map(({ words, title, ...p }) => {
        const slug = title.toLowerCase().replace(/ /g, '-');
        const name = T.productNames?.[title] ?? title;
        return { ...p, title: name, image: { src: `${ORIGIN}/products/${slug}.jpg`, alt: name }, currency: 'EUR', url: `https://example.com/product/${slug}` };
    });
    return card('product', list.length === 1 ? list[0] : list);
};

const orderCard = (number) => {
    const o = ORDERS[number];
    return card('order', {
        number, status: o.status, date_created: iso(new Date(Date.now() + o.placed * DAY)),
        line_items: o.items, total: o.total, currency: 'EUR',
    });
};

function orderStatus(T, number) {
    const o = ORDERS[number];
    const items = T.items(o.items.map((i) => T.names[i.name] ?? i.name));
    const placed = dayOf(T, new Date(Date.now() + o.placed * DAY));
    const text = o.status === 'shipped'
        ? T.shipped(number, placed, dayOf(T, new Date(Date.now() + o.shipped * DAY)), items)
        : T.preparing(number, placed, items);
    return text + orderCard(number);
}

function shop(state, text) {
    const T = textsOf(state);
    const W = wordsOf(T);
    const number = (text.match(/\b(\d{4})\b/) ?? [])[1] ?? state.asked;
    const email = (text.match(EMAIL) ?? [])[0]?.toLowerCase();
    if (W.returning.test(text)) state.returning = true;

    if (number && !ORDERS[number] && email) return [{ say: T.noMatch }];
    if (number && ORDERS[number] && !email && state.verified !== number) {
        state.asked = number;
        return [{ say: T.askEmail(number) }];
    }
    if (number && ORDERS[number] && email) {
        state.asked = undefined;
        if (ORDERS[number].email !== email) return [{ say: T.noMatch }];
        state.verified = number;
        if (!state.returning) return [{ say: orderStatus(T, number) }];
    }
    if (state.returning) {
        if (!state.verified) return [{ say: T.askOrder }];
        const n = state.verified;
        const o = ORDERS[n];
        if (o.status !== 'shipped') {
            state.returning = false;
            return [{ say: T.notShipped(n) }];
        }
        const item = (W.shirt.test(text) && o.items.find((i) => i.name === 'Linen shirt'))
            || (W.bag.test(text) && o.items.find((i) => i.name === 'Canvas tote bag'))
            || o.items[0];
        const reason = (text.match(W.reason) ?? [])[0] ?? T.defaultReason;
        state.returning = false;
        return [
            { say: T.confirmReturn },
            {
                ask: {
                    text: T.returnQ(T.returnNames[item.name] ?? item.name, n, reason), yes: T.openReturn, no: T.keepOrder,
                    then: (approved) => [{ say: approved ? T.returnOpen(n, o.email) : T.kept }],
                },
            },
        ];
    }
    const found = number ? [] : productsIn(W, text);
    if (found.length) return [{ say: T.found + productCard(T, found) }];
    if (W.order.test(text)) return [{ say: T.lookUp }];
    return [{ say: T.offTopic }];
}

// ── Booking ─────────────────────────────────────────────────────────────────

function dayFrom(W, text, fallback) {
    const lower = text.toLowerCase();
    if (W.tomorrow.test(text)) return new Date(Date.now() + DAY);
    // English day names too, whatever the language: a demo's visitor often types them.
    const named = [W.days, TEXTS.en.words.days]
        .map((days) => days.findIndex((d) => lower.includes(d.toLowerCase())))
        .find((i) => i >= 0) ?? -1;
    if (named < 0) return fallback;
    const d = new Date();
    do d.setDate(d.getDate() + 1); while (d.getDay() !== named);
    return d;
}

/** The studio on the Paris clock, as the workflow's Settings describe it. */
function placeCard(T) {
    const paris = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' }).formatToParts(new Date())
        .find((x) => x.type === 'timeZoneName').value.match(/GMT([+-]\d+)?(?::(\d+))?/);
    const utcOffset = (Number(paris?.[1] ?? 0) * 60) + Math.sign(Number(paris?.[1] ?? 0)) * Number(paris?.[2] ?? 0);
    return card('place', {
        name: T.studio, address: '12 rue de la Paix, 75002 Paris', phone: '+33 1 23 45 67 89', coordinates: { lat: 48.8686, lng: 2.331 },
        hours: [1, 2, 3, 4, 5].map((day) => ({ day, open: '09:00', close: '17:00' })), utcOffset,
    });
}

function booking(state, text) {
    const T = textsOf(state);
    const W = wordsOf(T);
    if (W.where.test(text)) return [{ say: T.whereWeAre + placeCard(T) }];
    const day = dayFrom(W, text, state.day);
    if (day) state.day = day;
    const time = (text.match(/\b([01]?\d|2[0-3])\s?[:h時시点]\s?([0-5]\d)?/) ?? []);
    if (time[0]) state.time = `${time[1].padStart(2, '0')}:${(time[2] ?? '00').padStart(2, '0')}`;
    const email = (text.match(EMAIL) ?? [])[0];
    if (email) state.email = email;
    const name = (text.match(/\b([A-ZÀ-Ý][a-zà-ÿ]+ [A-ZÀ-Ý][a-zà-ÿ]+)\b/) ?? [])[1];
    if (name) state.name = name;
    if (W.first.test(text) && !state.time) state.time = state.offered?.[0];

    if (!state.day && !state.time) {
        // The next three open days (Monday to Friday), to click rather than type.
        const days = [];
        for (let d = new Date(Date.now() + DAY); days.length < 3; d = new Date(d.getTime() + DAY)) if (d.getDay() % 6 !== 0) days.push(weekdayOf(T, d));
        return [{ say: T.whichDay + replies(days) }];
    }
    if (!state.day) state.day = dayFrom(W, 'tuesday');
    if (!state.time) {
        state.offered = W.afternoon.test(text) ? SLOTS.slice(3) : SLOTS.slice(0, 3);
        return [{ say: T.offer(weekdayOf(T, state.day), state.offered) + replies(state.offered) }];
    }
    if (!SLOTS.includes(state.time)) {
        const t = state.time;
        state.time = undefined;
        return [{ say: T.notFree(t) + replies(SLOTS) }];
    }
    if (!state.name || !state.email) return [{ say: T.needName(state.time) }];
    const [h, m] = state.time.split(':').map(Number);
    const start = new Date(state.day);
    start.setHours(h, m, 0, 0);
    const when = `${dayOf(T, start)} ${T.at} ${state.time}`;
    const who = { name: state.name, email: state.email };
    state.time = undefined;
    return [
        { say: T.confirmBooking },
        {
            ask: {
                text: T.bookQ(when, who.name, who.email), yes: T.bookIt, no: T.another,
                then: (approved) => [{
                    say: approved
                        ? T.booked(when, who.name) + card('order', {
                            kind: 'booking', status: 'confirmed', items: [{ title: T.service }],
                            booking: { start: localTime(start, h * 60 + m), end: localTime(start, h * 60 + m + 30), location: `${T.studio}, 12 rue de la Paix, 75002 Paris` },
                        })
                        : T.otherTime,
                }],
            },
        },
    ];
}

// ── The basics ──────────────────────────────────────────────────────────────

/** Whatever is written, a Chat node asks for an approval with two buttons. */
function buttons(state) {
    const T = textsOf(state);
    return [{ ask: { text: T.buttonsQ, yes: T.buttonsYes, no: T.buttonsNo, then: (approved) => [{ say: approved ? T.buttonsBooked : T.buttonsDeclined }] } }];
}

/** The files n8n received with the message, named with their sizes. */
function files(state, text, { files: received = [] } = {}) {
    const T = textsOf(state);
    if (!received.length) return [{ say: T.filesNone }];
    const size = (n) => new Intl.NumberFormat(T.locale, { style: 'unit', unit: n < 1024 * 1024 ? 'kilobyte' : 'megabyte', maximumFractionDigits: 1 })
        .format(n < 1024 * 1024 ? Math.max(0.1, n / 1024) : n / 1024 / 1024);
    const list = T.items(received.map((f) => `**${f.name.replace(/[*_`[\]<>]/g, '')}** (${size(f.size)})`));
    return [{ say: T.filesGot(list) }];
}

export const WORKFLOWS = { shop, booking, buttons, files };
export const DEMO_LANGUAGES = Object.keys(TEXTS);

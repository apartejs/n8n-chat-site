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
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
const EMAIL = /[^\s@,]+@[^\s@,]+\.[a-z]{2,}/i;
const iso = (d) => d.toISOString();
const card = (name, data) => '\n\n```card-' + name + '\n' + JSON.stringify(data) + '\n```';

// ── The languages ───────────────────────────────────────────────────────────

const TEXTS = {};
const dir = fileURLToPath(new URL('./texts/', import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    TEXTS[file.slice(0, -4)] = (await import(new URL(`./texts/${file}`, import.meta.url))).default;
}

const textsOf = (state) => TEXTS[state.lang] ?? TEXTS[(state.lang ?? 'en').split('-')[0]] ?? TEXTS.en;

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

function booking(state, text) {
    const T = textsOf(state);
    const W = wordsOf(T);
    const day = dayFrom(W, text, state.day);
    if (day) state.day = day;
    const time = (text.match(/\b([01]?\d|2[0-3])\s?[:h時시点]\s?([0-5]\d)?/) ?? []);
    if (time[0]) state.time = `${time[1].padStart(2, '0')}:${(time[2] ?? '00').padStart(2, '0')}`;
    const email = (text.match(EMAIL) ?? [])[0];
    if (email) state.email = email;
    const name = (text.match(/\b([A-ZÀ-Ý][a-zà-ÿ]+ [A-ZÀ-Ý][a-zà-ÿ]+)\b/) ?? [])[1];
    if (name) state.name = name;
    if (W.first.test(text) && !state.time) state.time = state.offered?.[0];

    if (!state.day && !state.time) return [{ say: T.whichDay }];
    if (!state.day) state.day = dayFrom(W, 'tuesday');
    if (!state.time) {
        state.offered = W.afternoon.test(text) ? SLOTS.slice(3) : SLOTS.slice(0, 3);
        return [{ say: T.offer(weekdayOf(T, state.day), state.offered) }];
    }
    if (!SLOTS.includes(state.time)) {
        const t = state.time;
        state.time = undefined;
        return [{ say: T.notFree(t) }];
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
                            booking: { start: iso(start), end: iso(new Date(start.getTime() + 30 * 60000)), location: 'Demo studio, 12 rue de la Paix' },
                        })
                        : T.otherTime,
                }],
            },
        },
    ];
}

export const WORKFLOWS = { shop, booking };
export const DEMO_LANGUAGES = Object.keys(TEXTS);

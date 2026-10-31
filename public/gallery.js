// The cards, drawn live by @aparte/plugin-cards — the code the widget fetches when an answer
// holds one. Loaded from jsDelivr, each card's entry the first time the gallery shows it.
const VERSION = '0.29.1';
const cdn = (path) => `https://cdn.jsdelivr.net/npm/@aparte/${path}/+esm`;
const picture = (name) => new URL(`/pictures/${name}.svg`, location.href).href;
const hours = (n) => Date.now() + n * 3600000;
const days = (n) => Date.now() + n * 86400000;

/** A made-up price walk: n values ending at `end`, spread over `span`. */
const walk = (seed, n, end, span) => {
    let v = 0;
    const raw = Array.from({ length: n }, (_, i) => (v += Math.sin(i * 0.7 + seed) * 1.6 + Math.cos(i * 0.23 + seed * 2) + 0.12));
    const last = raw[n - 1];
    const scale = span / (Math.max(...raw) - Math.min(...raw));
    return raw.map((x) => Math.round((end - (last - x) * scale) * 100) / 100);
};
const week = (open, close, closed = []) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    .filter((day) => !closed.includes(day)).map((day) => ({ day, open, close }));

const CARDS = [
    {
        card: 'order', label: 'An order', data: {
            reference: 'A-20931', status: 'shipped', date: days(-2), currency: 'EUR',
            items: [
                { title: 'Arden 700 wireless headphones', subtitle: 'Graphite', image: picture('headphones-graphite'), quantity: 1, price: 279 },
                { title: 'Hard carrying case', subtitle: 'Arden 700', image: picture('case'), quantity: 1, price: 29 },
            ],
            shipping: 0, payment: { brand: 'Visa', last4: '4242' },
            delivery: { estimate: { from: days(1), to: days(3) }, carrier: 'Express parcel', trackingNumber: '6A20931874512' },
        },
    },
    {
        card: 'weather', label: 'The weather', data: {
            location: 'Lille', condition: 'partly-cloudy', temperature: 11, feelsLike: 9, high: 14, low: 7,
            humidity: 78, wind: { speed: 18, direction: 240 }, precipitation: 40,
            hourly: [11, 12, 13, 14, 13, 12, 10, 9].map((temperature, i) => ({
                time: hours(i), temperature, condition: i > 4 ? 'rain' : 'partly-cloudy', precipitation: i > 4 ? 60 : 10,
            })),
        },
    },
    {
        card: 'product', label: 'A product', data: {
            title: 'Arden 700 wireless headphones', image: picture('headphones-graphite'), price: 279, compareAtPrice: 349,
            currency: 'EUR', rating: 4.6, reviewCount: 2184, availability: 'in-stock', merchant: 'Soundhouse',
            badge: 'Bestseller', shipping: 0,
        },
    },
    {
        card: 'order', label: 'A booking', data: {
            kind: 'booking', status: 'confirmed', reference: 'B-1182', items: [{ title: 'Haircut, 30 minutes', price: 35 }], currency: 'EUR',
            booking: { start: new Date(days(2)).setHours(10, 0, 0, 0), end: new Date(days(2)).setHours(10, 30, 0, 0), location: 'Salon Esquermoise, Lille' },
        },
    },
    {
        card: 'place', label: 'A place', data: {
            name: 'Le Comptoir des Halles', category: 'Bistro', image: picture('store-bistro'), rating: 4.6, reviewCount: 1284,
            priceLevel: 2, distance: 350, address: '12 rue de la Halle, Lille', coordinates: { lat: 50.6405, lng: 3.0614 },
            hours: week('12:00', '23:30', ['mon']), tags: ['Terrace', 'Natural wine'],
        },
    },
    {
        card: 'stats', label: 'Key figures', data: {
            title: 'Sales this week', subtitle: 'Online store',
            items: [
                { label: 'Revenue', value: 48250, currency: 'EUR', change: 0.124, good: 'up', icon: 'money', trend: [5200, 6100, 5800, 7400, 6900, 8300, 8550] },
                { label: 'Orders', value: 612, change: 0.08, good: 'up', icon: 'cart', trend: [71, 80, 76, 92, 88, 101, 104] },
                { label: 'Returns', value: 23, change: '+3%', good: 'down', hint: '3.8% of orders' },
            ],
        },
    },
    {
        card: 'stock', label: 'A quote', data: {
            symbol: 'ACME', name: 'Acme Corp.', exchange: 'NASDAQ', currency: 'USD', marketState: 'open',
            price: 184.6, change: 2.35, changePercent: 1.29, previousClose: 182.25, open: 182.9, high: 185.2, low: 181.6,
            volume: 48200000, marketCap: 312000000000, range: '1M', series: walk(3, 44, 184.6, 16),
        },
    },
    {
        card: 'plan', label: 'A plan', data: {
            title: 'Process the return', steps: [
                { title: 'Find the order', status: 'done' },
                { title: 'Check the return window', status: 'done' },
                { title: 'Ask for a photo', activeForm: 'Asking for a photo', status: 'in-progress' },
                { title: 'Email the support team', status: 'pending' },
            ],
        },
    },
    {
        card: 'score', label: 'A match', data: {
            home: { name: 'Northport FC', shortName: 'NPT', color: '#c8102e', score: 2 },
            away: { name: 'Riverside United', shortName: 'RIV', color: '#1d4ed8', score: 1 },
            status: 'live', clock: 67, sport: 'football', competition: 'Coastal League', venue: 'Harbour Ground',
            events: [
                { minute: 12, team: 'home', type: 'goal', player: 'M. Okafor' },
                { minute: 38, team: 'away', type: 'goal', player: 'L. Varga' },
                { minute: 61, team: 'home', type: 'penalty', player: 'S. Dubois' },
            ],
        },
    },
    {
        card: 'items', label: 'A list', data: {
            title: 'Autumn dinners under 40 minutes', items: [
                { title: 'Roast tomato soup with basil', image: picture('dish-tomato'), badge: '35 min', meta: ['4 servings', 'Vegetarian'] },
                { title: 'Butternut risotto with sage', image: picture('dish-squash'), badge: '40 min', meta: ['2 servings', 'Vegetarian'] },
                { title: 'Blackberry almond tart', image: picture('dish-berries'), badge: '40 min', meta: ['8 slices'] },
            ],
        },
    },
    {
        card: 'media', label: 'Pictures', data: {
            title: 'Landscapes', items: [
                { src: picture('alps-dawn'), title: 'First light', width: 1200, height: 800 },
                { src: picture('coast'), title: 'The cliff path', width: 1200, height: 800 },
                { src: picture('aurora'), title: 'Northern lights', width: 1200, height: 800 },
                { src: picture('forest'), title: 'Pines in the fog', width: 1200, height: 800 },
            ],
        },
    },
    {
        card: 'link', label: 'A link', data: {
            url: 'https://apartejs.dev/guides/cards/', siteName: 'aparté', type: 'article', image: picture('share-guide'),
            title: 'Show a tool’s result as a card',
            description: 'Draw what a tool returns as a rich card, in variants, from your tool’s own fields.',
        },
    },
];

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function drawGallery(grid) {
    const core = await import(cdn(`core@${VERSION}`));
    const renderer = () => core.getSegmentRenderer('card');
    const loaded = new Map();
    await Promise.all(CARDS.map(async (entry, i) => {
        const figure = document.createElement('figure');
        figure.className = 'tile';
        const caption = document.createElement('figcaption');
        caption.innerHTML = `<span class="aparte-tag">card-${entry.card}</span> ${entry.label}`;
        const holder = document.createElement('div');
        holder.className = 'tile-card';
        figure.append(holder, caption);
        grid.append(figure);
        try {
            let mod = loaded.get(entry.card);
            if (!mod) {
                mod = import(cdn(`plugin-cards@${VERSION}/${entry.card}`)).then((m) => { m[`setup${capital(entry.card)}Card`](); return m; });
                loaded.set(entry.card, mod);
            }
            const m = await mod;
            const segment = m[`${entry.card}Card`].segment(entry.data, { id: `gallery-${i}` });
            const drawn = renderer().render(segment);
            if (typeof drawn === 'string') holder.innerHTML = drawn;
            else if (drawn) holder.append(drawn);
        } catch (error) {
            holder.textContent = JSON.stringify(entry.data).slice(0, 200);
            console.warn('gallery:', entry.card, error);
        }
    }));
}

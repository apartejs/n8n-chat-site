/**
 * The demo's answers: what the site's chat says to a message, and the card a workflow would
 * add under it. Matched on a few words, English and French; anything else gets the menu.
 */

const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
};
const at = (d, h, m = 0) => {
    const x = new Date(d);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
};

/** The products a shop page could show, by the page's path (`metadata.page`). */
const PRODUCTS = {
    vacuum: {
        title: 'Orbit S7 robot vacuum', price: 349, compareAtPrice: 429, currency: 'EUR', rating: 4.6, reviewCount: 1284,
        availability: 'in_stock', merchant: 'Demo shop', options: ['Graphite', 'Snow'],
        description: 'Lidar mapping, 120 minutes a charge, empties itself.',
    },
    coffee: {
        title: 'Barista One espresso machine', price: 279, currency: 'EUR', rating: 4.4, reviewCount: 312,
        availability: 'in_stock', merchant: 'Demo shop', options: ['Steel', 'Black'],
        description: '15 bar, steam wand, ready in 40 seconds.',
    },
};

const RULES = [
    {
        words: /\b(order|commande|1001|parcel|colis|where is)\b/i,
        answer: () => ({
            text: 'Order 1001 left our warehouse two days ago and is on its way. It holds a linen shirt and a canvas tote bag.',
            card: {
                name: 'order',
                data: {
                    number: '1001', status: 'shipped', date_created: day(-4).toISOString(), total: '68.00', currency: 'EUR',
                    line_items: [{ name: 'Linen shirt', quantity: 1, total: '49.00' }, { name: 'Canvas tote bag', quantity: 1, total: '19.00' }],
                },
            },
        }),
    },
    {
        words: /\b(book|appointment|rendez-vous|rdv|réserv|reserv)/i,
        answer: () => ({
            text: 'Booked: Tuesday at 10:00, for 30 minutes. A confirmation is on its way to your inbox.',
            card: {
                name: 'order',
                data: {
                    kind: 'booking', status: 'confirmed', items: [{ title: 'Haircut, 30 minutes' }],
                    booking: { start: at(day(2), 10), end: at(day(2), 10, 30), location: 'Demo salon, 12 rue de la Paix' },
                },
            },
        }),
    },
    {
        words: /\b(weather|météo|meteo|rain|pluie|temps)\b/i,
        answer: () => ({
            text: 'Grey over Lille this afternoon, with showers clearing tonight.',
            card: {
                name: 'weather',
                data: {
                    location: 'Lille', condition: 'rain', temperature: 11, feelsLike: 9, high: 13, low: 7, humidity: 82, wind: 18,
                    daily: [1, 2, 3, 4].map((n, i) => ({ date: day(n).toISOString(), condition: ['cloudy', 'partly-cloudy', 'clear', 'rain'][i], high: [12, 14, 15, 11][i], low: [6, 7, 8, 6][i] })),
                },
            },
        }),
    },
    {
        words: /\b(this|ce|cet|cette|product|produit|price|prix|robot|vacuum|aspi|coffee|café|machine)\b/i,
        answer: (metadata) => {
            const page = String(metadata?.page ?? '');
            const product = /coffee|cafe|espresso/i.test(page) ? PRODUCTS.coffee : PRODUCTS.vacuum;
            return {
                text: `You are looking at the ${product.title}. Here it is, with today's price.`,
                card: { name: 'product', data: product },
            };
        },
    },
];

export function answerFor(message, metadata) {
    for (const rule of RULES) if (rule.words.test(message)) return rule.answer(metadata);
    return {
        text: 'This demo answers four things, each with the card a workflow would send: **where is my order**, **book an appointment**, **the weather**, and **this product** (it reads the page you are on). Try one.',
    };
}

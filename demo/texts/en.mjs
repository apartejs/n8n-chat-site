// The demo's sentences and buttons in English, and the words a visitor's message is read for.
// A translation keeps every key, the functions' parameters, and the times as HH:MM.
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

export default {
    locale: 'en-GB',
    items: (list) => list.join(' and '),
    // How an item is named inside a sentence ("It contains a linen shirt and a canvas tote bag").
    names: { 'Linen shirt': 'a linen shirt', 'Canvas tote bag': 'a canvas tote bag', 'Wool coat': 'a wool coat' },
    // How an item is named in the return's question ("Open a return for the linen shirt…").
    returnNames: { 'Linen shirt': 'the linen shirt', 'Canvas tote bag': 'the canvas tote bag' },
    shipped: (n, placed, shipped, items) => `Your order ${n} was placed on ${placed} and shipped on ${shipped}. It contains ${items}.`,
    preparing: (n, placed, items) => `Your order ${n} was placed on ${placed}. It is being prepared and has not shipped yet. It contains ${items}.`,
    noMatch: 'No order matches this number and email address.',
    askEmail: (n) => `To help you with that, could you give me the email address order ${n} was placed with?`,
    askOrder: 'Of course. What is your order number, and the email address it was placed with?',
    lookUp: 'I can look it up. What is your order number, and the email address it was placed with?',
    notShipped: (n) => `Order ${n} cannot be returned yet: only a shipped order can be returned.`,
    confirmReturn: 'Please confirm your return with the button below.',
    returnQ: (item, n, reason) => `Open a return for ${item} from order ${n}? Reason: ${reason}`,
    openReturn: 'Open the return',
    keepOrder: 'Keep my order',
    returnOpen: (n, email) => `Your return for order ${n} is open. We will email you at ${email} with how to send the items back.`,
    kept: 'All right, your order stays as it is. Anything else?',
    offTopic: 'I can only help with orders and returns. For anything else, please email support@example.com.',
    defaultReason: 'does not fit',
    whichDay: 'I can book you a 30-minute appointment, Monday to Friday, 9:00 to 17:00. Which day suits you?',
    offer: (day, times) => `${day} works! Would you prefer ${times.slice(0, -1).join(', ')} or ${times.at(-1)}? Please also give me your name and email address.`,
    notFree: (t) => `${t} is not one of the free times. Please choose ${SLOTS.join(', ')}.`,
    needName: (t) => `${t} it is. I need your name and email address to book.`,
    confirmBooking: 'Please confirm your appointment with the button below.',
    bookQ: (when, name, email) => `Book ${when} for ${name} (${email})?`,
    bookIt: 'Book it',
    another: 'Another time',
    booked: (when, name) => `Booked: ${when}, for ${name}. See you then!`,
    otherTime: 'No problem. Which other day or time suits you?',
    // "Tuesday 3 November at 10:00": the word between the day and the time.
    at: 'at',
    service: 'Appointment, 30 minutes',
    // The small demos of "the basics": a Chat node's buttons, and files received.
    buttonsQ: 'Shall I book you a table for tonight, at 20:00?',
    buttonsYes: 'Book it',
    buttonsNo: 'No thanks',
    buttonsBooked: 'Done: a table for tonight at 20:00, under your name.',
    buttonsDeclined: 'All right, nothing booked. Anything else?',
    filesNone: 'Attach a file with the paperclip, and I will tell you what I received.',
    filesGot: (list) => `I received ${list}. A real workflow would read them now: a PDF to answer about, a photo of a damaged parcel, a CV.`,
    // Regular expressions (as strings, case-insensitive) the visitor's message is matched on.
    words: {
        returning: String.raw`\b(return|send (it )?back|refund|broken)\b|too (small|big|large)`,
        reason: String.raw`\b(too (small|big|large)|broken|damaged|wrong (size|colou?r)|changed my mind)\b`,
        order: String.raw`\b(order|parcel|delivery|where)\b`,
        shirt: String.raw`shirt|linen`,
        bag: String.raw`tote|bag`,
        afternoon: String.raw`afternoon`,
        tomorrow: String.raw`\btomorrow\b`,
        first: String.raw`\bfirst\b`,
        // Sunday first, as Date#getDay counts.
        days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    },
};

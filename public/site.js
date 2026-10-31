// The demo: the widget from npm, embedded in the hero, on the site's stand-in webhook.
import { createChat } from 'https://cdn.jsdelivr.net/npm/@aparte/n8n-chat@0/dist/cdn/n8n-chat.js';

const chat = createChat({
    webhookUrl: '/webhook/demo/chat',
    target: '#demo',
    mode: 'embedded',
    enableStreaming: true,
    loadPreviousSession: false,
    colorScheme: 'auto',
    initialMessages: ['Hi! Ask about an order, a booking, the weather, or the product on this page.'],
    i18n: { en: { title: 'Demo shop', subtitle: 'Answers with cards', inputPlaceholder: 'Ask something…' } },
    // What a shop page would send: the workflow reads it to know which product you mean.
    metadata: { page: location.origin + '/products/orbit-s7-robot-vacuum', title: 'Orbit S7 robot vacuum' },
});

for (const button of document.querySelectorAll('[data-say]')) {
    button.addEventListener('click', () => chat.send(button.dataset.say));
}

// The chat plays once by itself when it comes into view, unless the reader prefers no motion.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('demo');
if (!still && stage && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        setTimeout(() => chat.send('Where is my order 1001?'), 900);
    }, { threshold: 0.5 });
    seen.observe(stage);
}

# n8n-chat.apartejs.dev

The site of [`@aparte/n8n-chat`](https://github.com/apartejs/n8n-chat), the chat widget for n8n's Chat Trigger with rich cards.

- `public/`: the page, its styles, and the workflows offered for download.
- `server.mjs`: serves `public/`, and answers the demo chat at `POST /webhook/demo/chat` the way an n8n Chat Trigger with streaming does. The answers are written ahead (`demo/answers.mjs`), so the demo needs no model and no key.
- The widget is loaded from jsDelivr (`@aparte/n8n-chat@0`), exactly as a user embeds it.

```bash
node server.mjs   # PORT=3000 by default, no dependencies
```

Deployed as a Docker image (see `Dockerfile`). Not affiliated with n8n GmbH; n8n is their trademark.

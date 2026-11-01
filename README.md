# n8n-chat.apartejs.dev

The site of [`@aparte/n8n-chat`](https://github.com/apartejs/n8n-chat), the chat widget for n8n's Chat Trigger with rich cards — in ten languages, with a live demo of real workflows.

- `server.mjs` — zero dependencies. Renders `template.html` (home) and `workflow.html` (one page per workflow) with `partials/`, in each language of `i18n/<lang>.json` (a missing key reads in English); `/` goes to the visitor's language (`Accept-Language`). Serves `public/`.
- The demo, played without n8n or a model: the server answers as a Chat Trigger with response nodes does — `POST /webhook/<shop|booking|buttons|files|broken>/chat`, the chat WebSocket at `/chat` (`demo/ws.mjs`), and Chat-node buttons at `/webhook-waiting/<id>/<n>`. The scripts are in `demo/workflows.mjs`, their sentences in `demo/texts/<lang>.mjs`.
- The widget is loaded from jsDelivr, pinned in `server.mjs` (`WIDGET`). To try a build before it is published: copy its `dist/cdn/*` and `dist/style.css` into `public/_widget/` and run with `WIDGET_SRC=/_widget`.
- `public/workflows/*.json` — the workflows offered for download, built in the widget's repo.

```bash
node server.mjs                       # PORT=3000 by default
node test.mjs http://localhost:3000   # every page and conversation, in every language
```

Deployed as a Docker image (`Dockerfile`). Not affiliated with n8n GmbH; n8n is their trademark.

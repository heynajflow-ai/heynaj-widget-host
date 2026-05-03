# Hosted Widget Loader

This folder is the first hosted-loader version for HeyNaj Flow.

## Files

- `loader.js` — short bootstrap script clients paste on their site
- `widget_embed.html` — full widget payload loaded by `loader.js`

## How it works

Clients paste one short snippet:

```html
<script async src="https://YOUR-PAGES-DOMAIN/loader.js" data-heynaj-webhook="YOUR-CLIENT-APPS-SCRIPT-URL"></script>
```

The loader:

1. downloads `widget_embed.html`
2. replaces the hardcoded `WEBHOOK_URL` inside it
3. injects the full widget into the client site

## Why this keeps clients isolated

Each client uses their own Apps Script webhook URL.

That means:

- Client A loader points to Client A brain
- Client B loader points to Client B brain
- Client C loader points to Client C brain

So even though all clients use the same `loader.js`, their:

- FAQ / vault knowledge
- widget appearance
- lead settings
- voice settings
- email alerts

remain separate because the brain URL is different per client.

## Test Snippet For Demo

```html
<script async src="https://YOUR-PAGES-DOMAIN/loader.js" data-heynaj-webhook="https://script.google.com/macros/s/AKfycbybNgIc64SnrZQTv4a-c5rTplxrqRPrbxg5oKNLgExdpdt0kr0a2OXco9-inYkdZUg6yg/exec"></script>
```

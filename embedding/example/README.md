# Example application with IVIS panel embedding

The [`panel.html`](panel.html) file shows an example of embedding a panel (from `panelId`).
The [`template.html`](template.html) file shows an example of embedding a dynamic panel from a template (`templateId`) without instantiating an explicit panel in IVIS.

1. Build the `ivis-embedding-client` package: `cd .. ; npm run build`
2. Set the `apiAccessToken` (obtain it from the IVIS user interface &ndash; Account / API) and `panelId`/`templateId` in [`panel.html`](panel.html) and [`template.html`](template.html). For [`template.html`](template.html), you also need to set the `parameters` accordingly (based on the template's parameters).
3. Open [`panel.html`](panel.html) or [`template.html`](template.html) in your browser.

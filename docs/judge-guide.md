# Judge guide

Petak is an Expo / React Native app that turns messages and photos into conversations and saved records with specialist neighbours. This guide covers the product walkthrough and the evidence available in this public repository. The presentation describes a **restricted QA** deployment; it does not claim a production rollout.

## Access the app

Use the Petak QA build and test account supplied through the submission's access instructions. The build must be connected to the private Petak API and Supabase project. This repository does not contain a live account, backend credentials, or a substitute for the `/v1` API. Use sample photos without personal information.

## Try the product

1. **Open Ollie.** Sign in and open the main conversation. Ollie routes a message or photo to the relevant neighbour.
2. **Share a food receipt.** Send a sample receipt with a short caption. In the presentation's example, one receipt contributes to Penny's spending record and Milo's nutrition record.
3. **Check spending and meals.** Read Penny's and Milo's responses. If Petak asks for clarification, answer it; if a detail is wrong, correct it in the conversation. Check what was saved before treating a response as a record.
4. **Add a meal photo.** Send a separate meal photo with context and review Milo's response. The receipt, spending, meals, and meal photo sequence follows the presentation.
5. **Explore the dashboards.** Open Penny's spending and Milo's nutrition views, then ask a question such as “How much did I spend today?” and compare the answer with the saved record. Mira's journal can be explored with a short, non-personal reflection if available in the supplied account.

The exact responses and records depend on the test account, the images, and any clarification needed. The [product walkthrough](demo-flow.md) gives the same path in shorter form; [slides 2–5](visuals/README.md) introduce the neighbours and product flow.

## Inspect the implementation

- [Architecture](architecture.md) and [slide 7](visuals/builder-cup-slide-7.png) show the mobile app, Cloudflare proxy and R2 storage, Cloud Run API and execution worker, Supabase/PostgreSQL state, and model providers. The presentation marks some components as planned.
- [Client API contract](api-contract.md) describes the `/v1` requests, signed photo upload, and event updates visible in the public app source.
- [Google Cloud integration](google-cloud.md) explains the Cloud Run and Vertex AI roles. The [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) is independent of the Petak app and backend.
- [Public and private boundary](proprietary-components.md) explains which source is included and which backend components remain private.

To verify the public client workspace locally, use Node **22.20.0** and pnpm **11.22.0** from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm export
```

These commands check and export the client without granting access to the live product. Interactive local use requires the authorized public client configuration described in [`.env.example`](../.env.example) and a compatible private backend. The independent Vertex AI example has its own [run instructions](../examples/vertex-ai-demo/README.md).

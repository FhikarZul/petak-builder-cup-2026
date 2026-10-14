# Judge guide

Petak is an Expo / React Native app that turns messages and photos into conversations and saved records with specialist neighbours. This guide covers the product walkthrough and the evidence available in this public repository. The presentation describes a **restricted QA** deployment; it does not claim a production rollout.

For a presentation-ready user manual covering Chat, Ollie's board, specialist dashboards, the journal, photos, and settings, open the editable [judge manual slides](judge-walkthrough.pptx). This public copy contains no credentials; use the private judge copy supplied with the submission to sign in.

## Access the app

An existing QA reviewer account has prepared Penny spending history, Mira journal entries, Milo meal records, and Ollie tasks. Penny, Mira, and Milo are active; judges do not need to seed the account or invite a neighbour. Use that account and the Petak QA build supplied through the submission's private access instructions; those instructions provide the sign-in method and credentials. The account is shared, so changes may be visible to other judges. The build must be connected to the private Petak API and Supabase project. This public repository does not publish credentials or a substitute for the `/v1` API. Use sample photos without personal information.

## Try the product

1. **Inspect the prepared account.** Sign in, open Ollie's conversation and tasks, then look at Penny's spending history, Mira's journal, and Milo's food log. These records are already present in the QA reviewer account.
2. **Compare one shared moment.** Find the Corner Bakery sandwich and coffee in Milo's food log on 4 October and Penny's S$9.60 Corner Bakery expense on the same date. This is a prepared text example with consistent date and description; it is not a linked receipt-and-plate photo pair.
3. **Share a food receipt.** Send a sample receipt with a short caption. In the presentation's example, one receipt contributes to Penny's spending record and Milo's nutrition record.
4. **Check spending and meals.** Read Penny's and Milo's responses. If Petak asks for clarification, answer it; if a detail is wrong, correct it in the conversation. Check what was saved before treating a response as a record.
5. **Add a meal photo.** Send a separate meal photo with context and review Milo's response. The receipt, spending, meals, and meal photo sequence follows the presentation.
6. **Return to the dashboards.** Open Penny's spending and Milo's nutrition views, then ask a question such as “How much did I spend today?” and compare the answer with the saved record.

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

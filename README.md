# Petak · Google Cloud AI Builder Cup 2026

Petak is a mobile companion for turning everyday messages and photos into useful conversations and organized records. Instead of moving between separate tools to capture and interpret personal information, people can send it through one app and see the resulting conversation, progress, and dashboards.

This is Petak's public submission repository for the **Google Cloud AI Builder Cup 2026**. It contains a real Expo / React Native mobile client, the small workspace packages it needs, client-visible API contracts, and a separately written Cloud Run / Vertex AI example. Petak is an existing product; its API service, execution service, AI workflows, prompts, database, and deployment configuration remain private.

![Petak's specialist neighbours in the Builder Cup presentation](docs/visuals/builder-cup-slide-2.png)

The [selected Builder Cup slides](docs/visuals/README.md) introduce Petak's specialists, features, product flow, and [slide 7 architecture diagram](docs/visuals/builder-cup-slide-7.png). The architecture and demo instructions below explain the integration boundaries.

## How the product works

The mobile app authenticates with Supabase and reaches the private Petak API on Cloud Run through a Cloudflare API proxy. The API owns client requests and durable records in Supabase/PostgreSQL; a separate Cloud Run execution service performs AI work with approved providers, including Gemini through Vertex AI. Photo bytes upload directly to R2 using an API-issued temporary URL. The API returns results through reads and a server-sent event stream. The app **does not call model providers directly**. This describes the restricted QA architecture in the presentation; production rollout is not established. See the [architecture](docs/architecture.md) and [Google Cloud integration](docs/google-cloud.md) for the component and request flows.

## Repository contents

| Path | Purpose |
|---|---|
| [`apps/app`](apps/app/README.md) | Expo / React Native client, API adapter, UI, and tests |
| `packages/assets`, `packages/config`, `packages/design-system` | Selected app assets, narrow client contracts, and design tokens |
| [`examples/vertex-ai-demo`](examples/vertex-ai-demo/README.md) | Independent Cloud Run example calling Gemini on Vertex AI |
| [`docs`](docs/architecture.md) | Architecture, Google Cloud role, client API contract, demo path, and private boundary |

The public repository is buildable as a client workspace. It does not contain the private backend or a replacement for the app's `/v1` API. End-to-end use requires an authorized Petak backend and test account; the [judge demo flow](docs/demo-flow.md) describes the required evaluation path.

## Build the mobile app

Use Node **22.20.0** and pnpm **11.22.0** from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm export
```

`pnpm export` validates the Expo iOS and Android bundles without backend credentials. For interactive use, set the public client variables listed in [`.env.example`](.env.example) and run `pnpm --filter @petak/app dev`. The checked-in values and app identifiers are placeholders; a working end-to-end build must point to an authorized Petak API and Supabase project. Never place a server credential in an `EXPO_PUBLIC_*` variable.

## Evaluate the submission

Follow the [judge demo flow](docs/demo-flow.md) with the authorized app build, backend, and test account supplied through the submission's access instructions. Send a message, capture a photo, and observe progress and the updated conversation. The [standalone Vertex AI example](examples/vertex-ai-demo/README.md) can be run separately in an authorized Google Cloud project to inspect the basic Cloud Run-to-Vertex call; it is not the Petak API.

## Read more

- [System architecture](docs/architecture.md) · [Google Cloud integration](docs/google-cloud.md) · [Client API contract](docs/api-contract.md)
- [Judge demo flow](docs/demo-flow.md) · [Private backend components](docs/proprietary-components.md)
- [Licensing overview](LICENSE) · [Mobile and supporting source terms](apps/app/LICENSE) · [Brand asset notice](packages/assets/README-LICENSE.md) · [Standalone example license](examples/vertex-ai-demo/LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

This repository is public for evaluation, but **public does not mean fully open source**. The app and supporting Petak source are under limited evaluation terms; Petak brand assets remain proprietary; the standalone Vertex AI example is Apache-2.0 licensed separately. Third-party materials retain their original licenses. Asset publication rights and judge access details require final confirmation before submission.

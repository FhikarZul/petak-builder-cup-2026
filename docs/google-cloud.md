# Google Cloud in Petak

The Petak mobile app reaches the **Petak API service on Cloud Run through a Cloudflare Worker/API proxy**, as shown on [slide 7](visuals/builder-cup-slide-7.png). The API service owns the client-facing `/v1` interface, durable state in Supabase/PostgreSQL, and result/event delivery. A **separate TypeScript execution worker on Cloud Run** handles bounded model calls with Vercel AI SDK and provider adapters. The slide shows **Gemini** as a model provider; the deck also names **Qwen / DashScope**. Photo bytes go directly to Cloudflare R2 through signed upload URLs. Both Petak services and their configuration remain private; the public repository contains the client caller but no backend source.

| Google Cloud component | Role in the product |
|---|---|
| Cloud Run API service | Receives authenticated requests through the API proxy and exposes client reads, writes, and the event stream |
| Cloud Run execution service | Runs AI work separately from client-facing requests |

Separating the API and execution service keeps the client contract distinct from AI work that may finish later. Cloud Run fits independently deployed HTTP services with different request patterns. The [architecture diagram](architecture.md) and [client API contract](api-contract.md) show the boundary without publishing service internals, deployment settings, or model policy.

The slide places **Vercel AI SDK + provider adapters** inside the TypeScript worker and shows Gemini outside it as a model provider. Provider endpoints and adapter selection remain private. Routing, authorization, records, and publication remain in Petak's own API and worker.

The public repository does not include Petak's model-calling implementation, deployment settings, or provider policy. The presentation describes restricted QA; it does not establish a production rollout.

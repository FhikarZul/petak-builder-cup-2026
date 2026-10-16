# Google Cloud in Petak

The Petak mobile app reaches the **Petak API service on Cloud Run through a Cloudflare Worker/API proxy**, as shown on [slide 7](visuals/builder-cup-slide-7.png). The API service owns the client-facing `/v1` interface, durable state in Supabase/PostgreSQL, and result/event delivery. A **separate TypeScript execution service on Cloud Run** handles AI work with Vercel AI SDK or bounded direct provider clients, depending on the task. The deck's technology stack names **Gemini and Qwen / DashScope**; approved Gemini routes use Vertex AI as a model endpoint. Photo bytes go directly to Cloudflare R2 through signed upload URLs. Both Petak services and their configuration remain private; the public repository contains the client caller but no backend source.

| Google Cloud component | Role in the product |
|---|---|
| Cloud Run API service | Receives authenticated requests through the API proxy and exposes client reads, writes, and the event stream |
| Cloud Run execution service | Runs AI work separately from client-facing requests |
| Vertex AI / Gemini | Provides one managed model inference path called by the execution service |

Separating the API and execution service keeps the client contract distinct from AI work that may finish later. Cloud Run fits independently deployed HTTP services with different request patterns. Vertex AI gives the backend a managed Gemini inference endpoint. The [architecture diagram](architecture.md) and [client API contract](api-contract.md) show the boundary without publishing service internals, deployment settings, or model policy.

**Vercel AI SDK and Vertex AI have different roles.** The TypeScript worker uses the SDK, including its Vertex adapter on applicable routes, and bounded direct provider calls on others. Vertex AI serves approved Gemini model requests; it does not orchestrate Petak's neighbours. Petak does not use Google ADK or Google Managed Agent Runtime. Routing, authorization, records, and publication remain in Petak's own API and worker.

The public repository does not include Petak's model-calling implementation, deployment settings, or provider policy. The presentation describes restricted QA; it does not establish a production rollout.

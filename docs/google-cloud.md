# Google Cloud in Petak

The Petak mobile app reaches the **Petak API service on Cloud Run through a Cloudflare Worker/API proxy**, as shown on [slide 7](visuals/builder-cup-slide-7.png). The API service owns the client-facing `/v1` interface, durable state in Supabase/PostgreSQL, and result/event delivery. A **separate execution service on Cloud Run** handles AI work through provider adapters. The deck's technology stack names **Gemini and Qwen / DashScope**; Gemini can be called through Vertex AI. Photo bytes go directly to Cloudflare R2 through signed upload URLs. Both Petak services and their configuration remain private; the public repository contains the caller and an independent example.

| Google Cloud component | Role in the product |
|---|---|
| Cloud Run API service | Receives authenticated requests through the API proxy and exposes client reads, writes, and the event stream |
| Cloud Run execution service | Runs AI work separately from client-facing requests |
| Vertex AI / Gemini | Provides one managed model inference path called by the execution service |

Separating the API and execution service keeps the client contract distinct from AI work that may finish later. Cloud Run fits independently deployed HTTP services with different request patterns. Vertex AI gives the backend a managed Gemini inference endpoint. The [architecture diagram](architecture.md) and [client API contract](api-contract.md) show the boundary without publishing service internals, deployment settings, or model policy.

## What the public example proves

[`examples/vertex-ai-demo`](../examples/vertex-ai-demo/README.md) is a standalone HTTP service with `GET /health` and `POST /generate`. Its code obtains an access token through Google Application Default Credentials, sends a text request to Vertex AI's `generateContent` endpoint, and returns the text candidate. Its Dockerfile makes the example suitable for Cloud Run. It illustrates an authenticated **service → Vertex AI** call; the example's presence in this repository does not establish that it has been deployed.

The example does **not** serve the mobile app's `/v1` routes, reproduce Petak prompts or orchestration, persist product data, or establish the product's full provider policy or deployment settings. It is representative integration material, not the private Petak backend. The presentation describes restricted QA; it does not establish a production rollout.

To run the example in your own Google Cloud project, follow its [setup instructions](../examples/vertex-ai-demo/README.md): enable the required APIs, use an authorized runtime identity with Vertex AI invocation permission, and set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`. No service-account key is committed or needed in the repository. Model availability, quota, and cost depend on the project and region.

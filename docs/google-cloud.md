# Google Cloud in Petak

The Petak mobile app calls the **Petak API service on Cloud Run**, not a model endpoint. The API service owns the client-facing `/v1` interface and result/event delivery. A **separate execution service on Cloud Run** handles backend-side AI work and calls **Gemini through Vertex AI**. Both Petak services and their configuration remain private; the public repository contains the caller and an independent example.

| Google Cloud component | Role in the product |
|---|---|
| Cloud Run API service | Receives authenticated mobile requests and exposes client reads, writes, and the event stream |
| Cloud Run execution service | Runs AI work separately from client-facing requests |
| Vertex AI / Gemini | Provides managed model inference called by the execution service |

Separating the API and execution service keeps the client contract distinct from AI work that may finish later. Cloud Run fits independently deployed HTTP services with different request patterns. Vertex AI gives the backend a managed Gemini inference endpoint. The [architecture diagram](architecture.md) and [client API contract](api-contract.md) show the boundary without publishing service internals, deployment settings, or model policy.

## What the public example proves

[`examples/vertex-ai-demo`](../examples/vertex-ai-demo/README.md) is a standalone HTTP service with `GET /health` and `POST /generate`. Its code obtains an access token through Google Application Default Credentials, sends a text request to Vertex AI's `generateContent` endpoint, and returns the text candidate. Its Dockerfile makes the example suitable for Cloud Run. It illustrates the authenticated **Cloud Run → Vertex AI** call in code that a reviewer can inspect.

The example does **not** serve the mobile app's `/v1` routes, reproduce Petak prompts or orchestration, persist product data, or establish that a particular production model or deployment setting is used. It is representative integration material, not the private Petak backend.

To run the example in your own Google Cloud project, follow its [setup instructions](../examples/vertex-ai-demo/README.md): enable the required APIs, use an authorized runtime identity with Vertex AI invocation permission, and set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`. No service-account key is committed or needed in the repository. Model availability, quota, and cost depend on the project and region.

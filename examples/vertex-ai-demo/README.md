# Standalone Vertex AI / Gemini example

This is a newly written demonstration service, independent of Petak's production backend. `POST /generate` accepts `{ "text": "Hello" }` and returns `{ "text": "..." }`. `GET /health` is a simple health check. It does not expose Petak prompts or implement Petak's mobile API.

The [Apache License 2.0](LICENSE) applies only to this standalone example. It does not license the Petak mobile application, Petak brand assets, or other proprietary components; see the [root licensing overview](../../LICENSE).

Local run: set `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and optionally `VERTEX_MODEL`; provide Application Default Credentials with permission to invoke the selected Vertex AI model; then run `pnpm --filter @petak/vertex-ai-demo start`. The service binds to `PORT` or 8080.

For Cloud Run, build from this directory's Dockerfile and deploy with unauthenticated invocation disabled. Give its runtime service account only the Vertex AI invocation permission it needs. Set a budget and request limits in your own project. No credentials belong in the image or repository.

This endpoint is intentionally small. A production service needs user authentication, abuse controls, observability, and a reviewed data retention policy.

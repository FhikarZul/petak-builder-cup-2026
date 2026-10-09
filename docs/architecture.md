# Public architecture

The Expo client handles login, chat, capture, dashboards, and local pending work. It authenticates through Supabase and sends authenticated `/v1` requests to the private Petak API. The API runs on Google Cloud Run and coordinates durable work; a separate execution service makes Vertex AI/Gemini calls. Results return through the API and event stream to the client.

This repository contains the client and public client contracts only. It does not contain the production API, execution service, prompts, model policy, storage implementation, or database. The independently written `examples/vertex-ai-demo` shows the basic Cloud Run-to-Vertex request pattern without reproducing production behavior.

The architecture description is a high-level integration map, not a deployable copy of Petak's private backend.

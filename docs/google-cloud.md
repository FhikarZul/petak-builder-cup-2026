# Google Cloud integration

In production, the Petak mobile client talks to a private Cloud Run API. That API coordinates work with a separate Cloud Run execution service, which invokes Gemini through Vertex AI. Neither production service is included here.

The public example under `examples/vertex-ai-demo` uses Google Application Default Credentials from its Cloud Run service identity. It sends one text request to the Vertex AI `generateContent` endpoint and returns the first text candidate. It has no Petak-specific system prompt, agent routing, persistence, or accounting.

To try it in your own project, enable the relevant Google Cloud APIs, grant the runtime identity the minimum Vertex AI invocation permission, set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`, build the example Dockerfile, and deploy to Cloud Run with authenticated invocation. Review model availability, quota, and costs for the chosen region before a live demonstration.

# Judge demo flow

1. Show the app source, public client contracts, and successful typecheck, tests, and Expo export.
2. Explain the live product path: mobile client → private Cloud Run API → separate Cloud Run execution service → Gemini on Vertex AI → API result/event stream → mobile client.
3. Run the standalone public Vertex example against an authorized Google Cloud project to demonstrate the Cloud Run/Vertex call. Use a harmless, non-personal prompt and authenticated invocation.
4. If access to a configured Petak demo backend is available, sign in with a dedicated test account, send a text message, then show a photo capture and its progress and resulting feed item. Do not use a real person's data.
5. Distinguish example output from production Petak behavior. The example is not connected to the app's `/v1` API.

A fully self-contained end-to-end mobile demo would require a separately designed mock or public API implementation; neither is supplied by this repository.

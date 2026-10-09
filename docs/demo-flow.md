# Judge demo flow

The end-to-end evaluation path uses an **authorized Petak app build**, a deployed Petak backend, and a dedicated test account. The repository provides buildable client source but does not publish backend credentials or the private `/v1` service. The submission must provide judges with the app access link and test-account instructions through the organizer's access channel before evaluation.

1. **Open and sign in.** Install or open the supplied build and sign in with the dedicated test account. Confirm that the conversation/feed loads.
2. **Send a message.** Enter a short non-personal message. Observe the sent item and the AI-assisted conversation result.
3. **Capture a photo.** Use a prepared non-personal sample image. Observe upload, capture progress, and the resulting conversation or organized record.
4. **Inspect the technical path.** Match the app's `/v1` calls and event refresh to the [client API contract](api-contract.md) and [architecture](architecture.md): mobile app → Cloud Run API service → Cloud Run execution service → Vertex AI / Gemini → API reads/events → mobile app.
5. **Inspect the independent example.** Review or run the [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) in an authorized Google Cloud project to see a minimal Cloud Run-to-Vertex request. Its output is separate from the Petak product flow.

Expected result: the test account can complete the message and photo paths end to end through the authorized backend. The public repo alone can be built and exported, but cannot provide that live result without the deployed private service. Judge access and the sample image must be checked before submission.

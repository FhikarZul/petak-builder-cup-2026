# Product demo walkthrough

This suggested walkthrough follows the product story in [slides 2–5](visuals/README.md) and the presentation's receipt example. Running it requires an authorized Petak QA build connected to the private backend and a test account. The public repository provides the mobile client source, but no live demo account or backend credentials.

1. **Start with Ollie.** Sign in and open the conversation. Ollie is the front door that routes a message or photo to relevant neighbours.
2. **Share a receipt.** Send a non-personal sample food receipt with a short caption. The deck uses one receipt to show spending and nutrition records arising from the same input.
3. **Check spending, then meals.** Follow Penny's spending response and Milo's meal response in the conversation. Answer a clarification or correct a detail if needed, and check what was actually saved.
4. **Add a meal photo.** Share a separate meal photo with context and review Milo's response.
5. **Return to the records.** Open the spending and nutrition dashboards introduced on [slide 3](visuals/builder-cup-slide-3.png). You can also ask a follow-up in your own words, such as “How much did I spend today?”, and compare the answer with the saved record.

The slides illustrate the intended product path; the exact screens and results depend on the test account and sample images. For the system path behind these actions, see the [architecture diagram](visuals/builder-cup-slide-7.png), [architecture notes](architecture.md), and [client API contract](api-contract.md). The [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) is a separate technical demonstration.

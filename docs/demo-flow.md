# Product demo walkthrough

This suggested walkthrough follows the product story in [slides 2–5](visuals/README.md). Running it requires an authorized Petak QA build connected to the private backend and a test account. The public repository provides the mobile client source, but no live demo account or backend credentials.

1. **Start with Ollie.** Sign in and open the conversation. Ollie is the front door that routes a message or photo to relevant neighbours.
2. **Share one food receipt.** Send a non-personal sample receipt with a short caption. Slides 4 and 5 use this as the example of one input that can support Penny's spending record and Milo's nutrition record.
3. **Follow the conversation.** Read the response and answer a clarification or correct a detail if needed. Check which records were actually saved before relying on them.
4. **Open the dashboards.** Look at Penny's spending view and Milo's nutrition view. Slides 3 and 4 show these views as ways to return to information from saved records.
5. **Ask again in your own words.** For example, ask “How much did I spend today?” and compare the answer with the saved spending record.

The slides illustrate the intended product path; the exact screens and results depend on the test account and sample receipt. For the system path behind these actions, see the [architecture diagram](visuals/builder-cup-slide-7.png), [architecture notes](architecture.md), and [client API contract](api-contract.md). The [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) is a separate technical demonstration.

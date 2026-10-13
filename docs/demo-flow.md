# Product demo walkthrough

This walkthrough follows the product paths in [slides 4 and 5](visuals/README.md). It requires an authorized Petak build connected to the private backend and a test account. The public repository provides the mobile client source, but it does not include a live demo account or backend credentials.

1. **Start a conversation.** Sign in and open the main conversation with Ollie.
2. **Capture once.** Share a non-personal sample receipt or meal photo with a short caption. Watch the capture progress and the reply. A suitable food receipt can give Penny spending context and Milo nutrition context; the outcome depends on what the image contains and what the user confirms.
3. **Review the record.** Open the relevant conversation or dashboard to see what was saved. If the app asks for clarification, answer it before treating the result as a record.
4. **Ask in your own words.** Ask a question about the saved information, such as “How much did I spend today?” or correct a detail in the conversation. Observe how the reply uses the current records.
5. **See progress over time.** Explore the spending or nutrition view after records have been saved. Other available conversations and views can be explored from the same app.

The exact screens and results depend on the test account's data and the sample image. For the system path behind these actions, see the [architecture diagram](visuals/builder-cup-slide-7.png), [architecture notes](architecture.md), and [client API contract](api-contract.md). The [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) is a separate technical demonstration, not part of this app walkthrough.

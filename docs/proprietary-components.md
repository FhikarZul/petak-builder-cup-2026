# Public source and private production components

Petak is an existing startup and product. This public repository provides the buildable mobile app, selected required assets, narrow client contracts, design tokens, documentation, tests, and an independent Vertex AI / Cloud Run example. The app is real client code, and its authenticated `/v1` interface is visible in source and in the [client API contract](api-contract.md).

Petak keeps the production API service and execution service source private, along with system and extraction prompts, AI orchestration and workflows, model policy, database implementation, business rules, evaluation material, private infrastructure and deployment configuration, credentials, and signing material. These are existing commercial components and are not needed to inspect or build the public client. The [architecture](architecture.md) documents their external role without publishing their implementation.

The submitted prototype's end-to-end evaluation path uses an authorized app build connected to the deployed Petak backend and a test account. The repository alone can be built and exported, but it does not include a replacement backend or test credentials. Access instructions must be supplied separately to judges; see the [demo flow](demo-flow.md).

The mobile and supporting Petak source is under [limited evaluation terms](../apps/app/LICENSE), while [brand assets](../packages/assets/README-LICENSE.md) remain proprietary. The [standalone example](../examples/vertex-ai-demo/LICENSE) is separately Apache-2.0 licensed. Publication rights for individual bundled artwork still require confirmation.

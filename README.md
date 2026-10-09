# Petak Builder Cup 2026 — public client and Vertex AI example

This repository contains a curated Expo/React Native client and an independently written Vertex AI example. The production Petak API, AI workflows, prompts, database, and deployment configuration are private. The Vertex example demonstrates Google Cloud integration; it is not the production API and does not implement the client's /v1 routes.

## What is here

- apps/app: Petak mobile client source, with demonstration app identifiers.
- packages/assets: only images imported by the client.
- packages/config: client-facing types and a currency display hint.
- packages/design-system: generated tokens consumed by the client.
- examples/vertex-ai-demo: minimal Cloud Run service calling Gemini on Vertex AI.
- docs: architecture, client API surface, Cloud Run example, and demo instructions.

## Build the mobile client

Use Node 22.20.0 and pnpm 11.22.0. From the repository root:

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm typecheck` and `pnpm test`.
3. Run `pnpm export` to validate the Expo bundles.

The build/export step does not require production credentials. Running the full app requires your own compatible API and Supabase project. Set only public client values from `.env.example`; Expo embeds `EXPO_PUBLIC_*` values in the app bundle. Never put a server key there.

The checked-in app identity is a demonstration placeholder. Replace the bundle identifiers, URL scheme, and signing configuration for any distribution build. The brand artwork also needs a publication rights review.

## Try the separate Vertex example

See `examples/vertex-ai-demo/README.md`. Its `/generate` endpoint takes a short text request and calls a Gemini model through Vertex AI. It deliberately does not claim to serve the Petak mobile API.

## Publication status

This local preparation has not been published. `LICENSE` is pending rights-holder review and currently grants no reuse rights. Do not publish until the license, artwork rights, credentials scan, and end-to-end demo endpoint are approved.

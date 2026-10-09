# Petak mobile app · public Builder Cup copy

This Expo SDK 57 / React Native 0.86 workspace contains the mobile UI, local state, Petak API adapter, and app tests. It uses the selected public packages at the repository root; run commands from that root.

Use `pnpm --filter @petak/app typecheck`, `pnpm --filter @petak/app test`, or `pnpm --filter @petak/app build`. For local interactive use, set the public Expo environment variables described in the root `.env.example`, then run `pnpm --filter @petak/app dev`.

The app expects an authorized Petak `/v1` API and Supabase authentication. The [standalone Vertex AI example](../../examples/vertex-ai-demo/README.md) does not supply those routes. See the [client API contract](../../docs/api-contract.md) and [architecture](../../docs/architecture.md). Demo bundle identifiers in `app.profiles.json` must be replaced before distributing a native app.

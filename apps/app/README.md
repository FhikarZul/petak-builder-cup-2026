# Petak mobile client (public Builder Cup copy)

Expo SDK 57 and React Native 0.86 client. This workspace copy retains the client UI, local state, API adapter, and app tests. It needs the small public packages at the repository root; run commands from that root.

Use `pnpm --filter @petak/app typecheck`, `pnpm --filter @petak/app test`, or `pnpm --filter @petak/app build`. For local interactive use, set the public Expo environment variables described in the root `.env.example`, then run `pnpm --filter @petak/app dev`.

The client expects a compatible Petak `/v1` API and Supabase authentication. The separate Vertex example does not supply those routes. Demo bundle identifiers in `app.profiles.json` must be replaced before distributing a native app.

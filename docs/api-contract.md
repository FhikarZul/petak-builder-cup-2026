# Client-visible API contract

The app sets `EXPO_PUBLIC_API_URL` to a compatible Petak API origin. `apps/app/lib/api.ts` sends the Supabase access token as a bearer token. The public copy does not include a server implementation.

Client-visible route families include `/v1/bootstrap`, `/v1/messages`, `/v1/neighbours/:id/messages`, `/v1/feed`, `/v1/threads`, `/v1/photos`, `/v1/events`, `/v1/tasks`, `/v1/street`, `/v1/settings`, `/v1/wallet`, and neighbour dashboard endpoints. Photo upload starts with an API-created record and uses a temporary upload URL returned by the API. The client receives capture progress with `photo_id`, `stage`, and `observed_at`.

| Client operation | Visible contract |
|---|---|
| Sign in | Supabase session; the API receives its access token in `Authorization: Bearer` |
| Send text | POST `/v1/messages` or `/v1/neighbours/:id/messages`; client supplies a stable key for retries |
| Read conversation | GET `/v1/feed` or `/v1/neighbours/:id/messages`, with cursor pagination |
| Send a photo | POST `/v1/photos`; upload bytes to the returned temporary URL; POST the relevant message and acceptance request |
| Observe work | GET `/v1/events` plus photo state reads; capture progress is the public `CaptureProgress` shape |
| Show dashboards | GET `/v1/neighbours/:id/...`, `/v1/street`, `/v1/tasks`, `/v1/settings`, and `/v1/wallet` |

The public `@petak/config` package contains only the types the app imports: capture progress, two extraction labels, and a client currency hint. It is not a complete API specification. Integrators need a compatible authorized backend to exercise the app. The standalone Vertex example exposes `/health` and `/generate` only and is not a substitute for `/v1`.

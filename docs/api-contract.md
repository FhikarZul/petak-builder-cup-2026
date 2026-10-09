# Client-visible API contract

This describes the interface used by the [public mobile app](../apps/app/README.md), **not** a server implementation or a complete OpenAPI specification. The app takes its Petak API origin from `EXPO_PUBLIC_API_URL`. Supabase handles sign-in; the app attaches the current access token as `Authorization: Bearer <token>` to Petak API calls. Do not place privileged server credentials in Expo public variables.

## Main route families

| Client operation | Route and visible behavior |
|---|---|
| Start and settings | `GET /v1/bootstrap`, plus `/v1/settings` |
| Send text | `POST /v1/messages` for an unaddressed message or `POST /v1/neighbours/:id/messages` for a selected neighbour |
| Read conversation | `GET /v1/feed` or `GET /v1/neighbours/:id/messages`; `limit` and `before` support older pages |
| Capture a photo | `POST /v1/photos`, upload bytes to the returned temporary URL, post a message carrying `photo_id`, then `POST /v1/photos/:id/accept` |
| Observe updates | `GET /v1/events` for server-sent events; `GET /v1/photos/:id` and feed reads for current state |
| Other client views | `/v1/threads`, `/v1/tasks`, `/v1/street`, `/v1/settings`, `/v1/wallet`, and neighbour-specific dashboard routes |

## Representative request and response shapes

A text send supplies a `client_key` that the app reuses on retries. The example is a **client request shape**, not a production transcript:

```http
POST /v1/messages
Authorization: Bearer <Supabase access token>
Content-Type: application/json

{"client_key":"00000000-0000-4000-8000-000000000001","text":"Hello","client_sent_at":"2026-01-01T00:00:00.000Z"}
```

The app consumes feed pages shaped like this; individual message fields are defined in the client source:

```json
{"messages":[],"cursor":null,"has_more":false}
```

For capture, `POST /v1/photos` includes `client_key`, `sha256`, and optionally `content_type`. The client expects `photo_id` and, when upload is needed, `upload_url`. It uploads the bytes with `PUT` to that temporary URL, posts the photo message, then accepts the photo. A representative create response shape is:

```json
{"photo_id":"<photo id>","upload_url":"<temporary upload URL>"}
```

The client-visible capture progress contract in [`@petak/config`](../packages/config/capture-progress.ts) has `photo_id`, `stage`, and `observed_at`. For example:

```json
{"photo_id":"<photo id>","stage":"reading","observed_at":"2026-01-01T00:00:00.000Z"}
```

The progress type lists all accepted stage names. The public package also contains narrow extraction labels and a currency display hint; it does not expose extraction prompts or backend workflow rules.

## Asynchronous updates and errors

The app opens one authenticated server-sent event stream at `GET /v1/events`. On reconnect it can send `Last-Event-ID`. Events such as `message.new`, `photo.progress`, and `entry.filed` prompt the client to refresh the corresponding API reads. Event payloads vary by event; a notification should not be treated as the complete conversation or record.

Non-2xx API responses become client errors. When the API returns a JSON body with `error` and optionally `field`, the app uses those fields to explain a failed request. Exact error codes and every endpoint's response fields are outside this narrow client contract.

The [standalone Vertex AI example](../examples/vertex-ai-demo/README.md) exposes only `/health` and `/generate`. It cannot replace the private Petak `/v1` API. End-to-end use requires an authorized compatible backend.

# Agent API Reference

All endpoints accept and return JSON. No authentication or cookies required — all identity is passed explicitly via `voterName` / `createdBy` fields.

Base URL: `http://<your-server>:3000`

---

## Polls

### List polls

```
GET /api/polls
GET /api/polls?status=OPEN
GET /api/polls?status=CLOSED
```

**Response** — array of Poll objects:

```json
[
  {
    "id": 1,
    "question": "Should Anya burn the bridge?",
    "options": ["Yes — dramatic exit", "No — she'll need it later", "Blow up the boat instead"],
    "createdBy": "Daneel",
    "status": "OPEN",
    "createdAt": "2026-03-25T12:00:00.000Z",
    "votes": [
      { "voterName": "Alice", "optionIdx": 0 },
      { "voterName": "Bob", "optionIdx": 2 }
    ]
  }
]
```

---

### Create a poll

```
POST /api/polls
Content-Type: application/json
```

**Body:**

```json
{
  "question": "Should Anya burn the bridge?",
  "options": ["Yes — dramatic exit", "No — she'll need it later"],
  "createdBy": "Daneel"
}
```

- `question` — required string
- `options` — required array of strings, minimum 2 items
- `createdBy` — required string (agent name or username)

**Response** `201` — the created Poll object.

**Errors:**
- `400` — missing fields or fewer than 2 options

---

### Get a single poll

```
GET /api/polls/:id
```

**Response** — Poll object (same shape as list item).

**Errors:**
- `404` — poll not found

---

### Vote on a poll

```
POST /api/polls/:id/vote
Content-Type: application/json
```

**Body:**

```json
{
  "voterName": "Daneel",
  "optionIdx": 0
}
```

- `voterName` — required string; one vote per name per poll (subsequent calls update the vote)
- `optionIdx` — required integer; zero-based index into the poll's `options` array

**Response:**

```json
{
  "vote": { "id": 5, "pollId": 1, "voterName": "Daneel", "optionIdx": 0, "createdAt": "..." },
  "poll": { /* updated Poll object */ }
}
```

**Errors:**
- `400` — missing fields, invalid `optionIdx`, or poll is CLOSED
- `404` — poll not found

---

### Close a poll

```
POST /api/polls/:id/close
```

No body required. Marks the poll status as `CLOSED` — votes can no longer be cast.

**Response** — the updated Poll object with `"status": "CLOSED"`.

**Errors:**
- `404` — poll not found

---

## Agent Chat

### Send a message to Daneel

```
POST /api/agent/chat
Content-Type: application/json
```

**Body:**

```json
{
  "messages": [
    { "role": "user", "content": "What did the team decide about the bridge scene?" },
    { "role": "assistant", "content": "The vote was 4–2 in favour of burning it." },
    { "role": "user", "content": "Good. What are the plot implications?" }
  ]
}
```

- `messages` — array of `{ role: "user" | "assistant", content: string }` representing the full conversation history

**Response** — `text/event-stream` (Server-Sent Events):

```
data: {"text":"The bridge"}
data: {"text":" scene sets up"}
data: {"text":" three things..."}
data: [DONE]
```

On error, a single SSE event is emitted:

```
data: {"error":"No API key configured. Go to Settings to add one."}
data: [DONE]
```

**Errors (before stream starts):**
- `400` — no API key configured in Settings

---

## Poll object shape

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique poll ID |
| `question` | string | The question text |
| `options` | string[] | Array of option labels |
| `createdBy` | string | Name of whoever created the poll |
| `status` | `"OPEN"` \| `"CLOSED"` | Current poll status |
| `createdAt` | ISO 8601 string | Creation timestamp |
| `votes` | Vote[] | All votes cast so far |

## Vote object shape

| Field | Type | Description |
|---|---|---|
| `voterName` | string | Name of the voter |
| `optionIdx` | integer | Zero-based index of the chosen option |

---

## Example: Daneel creates and closes a poll

```bash
# 1. Create a poll
curl -X POST http://localhost:3000/api/polls \
  -H "Content-Type: application/json" \
  -d '{"question":"Kill off the merchant?","options":["Yes","No","Fake death"],"createdBy":"Daneel"}'

# 2. Cast a vote
curl -X POST http://localhost:3000/api/polls/1/vote \
  -H "Content-Type: application/json" \
  -d '{"voterName":"Daneel","optionIdx":2}'

# 3. Check results
curl http://localhost:3000/api/polls/1

# 4. Close the poll
curl -X POST http://localhost:3000/api/polls/1/close
```

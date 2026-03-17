# HumanType

A tool that types your text into a Google Doc like a real human — with natural pauses, typos, corrections, and variable speed.

## Setup

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Docs API**:
   - APIs & Services → Library → search "Google Docs API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3001/api/auth/google/callback`
   - Copy the **Client ID** and **Client Secret**
5. Configure the OAuth consent screen:
   - APIs & Services → OAuth consent screen
   - User type: External (or Internal if you have a Google Workspace)
   - Add your email as a test user (required for External apps in testing)
   - Scopes: add `https://www.googleapis.com/auth/documents`

### 2. Server Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=any_random_string_here
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 3. Install Dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 4. Run

Open two terminals:

```bash
# Terminal 1 — Server
cd server && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## How It Works

### Humanization Engine

The `humanize.ts` module generates a flat sequence of `KeystrokeEvent` objects from input text. Each event is one of:

- `insert` — type a character (with a `delay` in ms before doing so)
- `backspace` — delete the last character
- `pause` — wait without typing

**Speed slider** scales all timing intervals (Slow=4×, Normal=1×, Fast=0.5×, Turbo=0.25×).

**Human-ness slider** (0–100) controls:
- Typo frequency: up to 4% of characters get a typo at humanness=100
- Typo realism: uses QWERTY keyboard adjacency map for adjacent-key mistakes
- Mid-word hesitations: brief pauses mid-word as if thinking
- Paragraph thinking pauses: longer delays at paragraph boundaries

### Google Docs Integration

Text is not sent character-by-character to the API (that would be too slow and hit rate limits). Instead:
- Characters accumulate in a buffer
- The buffer is flushed at word boundaries, newlines, pauses, or when it reaches 8 chars
- Backspaces trigger an immediate flush before issuing a `deleteContentRange` request
- A token bucket rate limiter (250 req/min) prevents quota errors

### SSE Streaming

The server streams progress events back using Server-Sent Events. Since `EventSource` doesn't support POST bodies, the client uses `fetch()` with `response.body.getReader()` to consume the stream.

---

## Usage Notes

- **Do not edit the Google Doc while writing is in progress** — the cursor position tracking will drift if the document is modified externally.
- **Turbo speed**: The Google Docs API has ~100–200ms latency, so the actual doc writing will lag slightly behind the preview animation at turbo speed. This is expected.
- **Rate limits**: Google Docs API allows ~300 requests/min per project. The built-in rate limiter keeps usage at 250/min to stay safely below this.
- **Session persistence**: Authentication tokens are stored in-memory in the server session. Restarting the server requires re-authentication.

---

## Project Structure

```
humantype/
  client/
    src/
      lib/
        humanize.ts     # Core keystroke generation algorithm
        sse.ts          # Fetch-based SSE stream reader
      components/
        TextInput.tsx
        Controls.tsx    # Speed + humanness sliders
        Preview.tsx     # Live typewriter animation
        StatusBar.tsx   # Progress display
        ProgressBar.tsx
        ActionButtons.tsx
      App.tsx           # State machine (useReducer)
      types.ts
  server/
    src/
      google/
        auth.ts         # Passport OAuth2 config
        docs.ts         # Google Docs API wrapper
      lib/
        rateLimiter.ts  # Token bucket for API quota
        sessionStore.ts # In-memory job registry
      routes/
        auth.ts         # OAuth routes
        write.ts        # SSE write endpoint + pause/resume/stop
      index.ts          # Express app entry point
```

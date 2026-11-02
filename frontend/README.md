# TravelAI React

Vite + React frontend with a small Express backend for Gemini.

## Gemini setup

1. Copy `.env.example` to `.env`.
2. Put your real Gemini API key in `.env`:

```env
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash
PORT=3001
```

3. Install dependencies:

```bash
npm install
```

4. Start both the frontend and backend:

```bash
npm run dev
```

The frontend runs on Vite and `/api/*` is proxied to the Express server.

## Important

- The Gemini API key is **never sent to the browser**.
- There is **no API-key field in the frontend**.
- There is **no mock itinerary fallback**.
- Creating an itinerary requires a successful Gemini response.
- Safety analysis uses Gemini plus recent Google News headlines (`/api/news`).
- `.env` is gitignored; never commit your real API key.

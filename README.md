# TravelAI

AI-assisted trip planner for destinations across India. TravelAI generates a day-by-day itinerary with Google Gemini, flags travel considerations that may affect the plan, explains why each one was raised, and lets the traveler decide what changes.

> **Note:** Safety notes are based on Gemini's general knowledge (typical seasonal weather, altitude, terrain, daylight, activity difficulty). They are **not live data** and are not a guarantee of safety. Always check official advisories before travelling.

Presentation - https://docs.google.com/presentation/d/1kcpK-rZy-B5uC-O3j9JAWRLb1d5rb6xh/edit?usp=drive_link&ouid=112335842459900342833&rtpof=true&sd=true

Video - https://drive.google.com/file/d/1j6bTN6XQRQEx-FjmYoyc0ZNIUMLXWUEq/view?usp=drive_link

## Problem Statement

Planning a trip in India means piecing together information from many places: itinerary blogs, weather apps, maps and advisories. Generic itineraries rarely account for who is travelling (age, group type, accessibility needs, hiking experience, diet), and the factors that can disrupt a plan, such as altitude, seasonal weather, terrain and daylight hours, are easy to miss, especially in mountain regions. Where tools do raise warnings, they often give no reasons or sources and make changes for the traveler instead of letting them choose.

TravelAI addresses this by generating a personalised itinerary and flagging what may affect it, explaining why each flag was raised and leaving every decision with the traveler.

## Objectives

- Generate a personalised, day-by-day itinerary for destinations across India from the traveler's profile and trip preferences.
- Identify considerations that may affect the plan (weather, terrain, altitude, road conditions) and rate them by severity.
- Make every flag transparent: show why it appeared, its potential impact and where the information comes from.
- Keep the traveler in control by offering alternatives, the option to keep the original plan, and undo for any change.
- Validate destinations early (typos, ambiguous regions, non-India places) to avoid wasted planning.
- Provide a simple on-trip mode with today's plan, navigation and quick access to emergency help.
- Be honest about limits: never claim a place "is safe" and clearly label information that is not live data.

## Team Members

| Name | Entry No. |
| ---- | ---- |
| Syed Naqi Abbas | 2024AIB1087 | 
| Parth | 2024AIB1012 |

## Features

- **Traveler profile**: name, age, nationality, group type, accessibility needs, dietary preference and interests. Optional personal safety preferences can be skipped.
- **Destination validation**: handles typos ("Manli" suggests Manali), ambiguous regions ("Kashmir" lists Srinagar, Gulmarg, Pahalgam, Jammu), state mismatches and non-India destinations.
- **Itinerary generation**: Gemini returns a structured, validated plan for exactly the number of days selected.
- **Safety intelligence**: each issue has a severity (information, attention, critical), a "Why am I seeing this?" explanation, potential impact and suggested alternatives.
- **You stay in control**: keep the original plan, pick an alternative, or undo any change.
- **Trip mode**: a mobile-friendly view with today's plan, next activity, navigation links, nearby hospital/police search and an emergency card with a one-tap call to 112.

## Tech stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React (`App.jsx`, single-file app)              |
| Backend  | Node.js + Express (`server.js`)                 |
| AI       | Google Gemini via the Generative Language REST API |

## Architecture

```
Browser (React)  ──POST /api/gemini { prompt }──▶  Express server  ──▶  Gemini API
       ▲                                                 │
       └────────────── parsed JSON ◀─────────────────────┘
```

1. `generateItinerary()` sends the profile and trip details and expects `{"days":[{"items":[...]}]}`.
2. `analyzeSafety()` sends the generated itinerary and expects `{"issues":[...]}`.
3. The server requests JSON output from Gemini and runs the reply through a tolerant `extractJson()` parser. It strips code fences, quotes unquoted keys, removes trailing commas and fixes smart quotes before the frontend validates the shape.

## Recent news (lightweight RAG)

Before the safety analysis, the backend fetches the last 7 days of headlines for the destination from the Google News RSS feed (`GET /api/news?q=Manali`, no API key). Headlines are filtered to the destination, de-duplicated and ranked by hazard keywords (landslide, flood, road closed, protest, ...). The top 8 are passed to Gemini as `NEWS:`. Gemini may only raise a news-based issue by citing an item number, and the cited article (source, date, headline, link) is shown in the "Why am I seeing this?" panel. Issues not backed by news are labelled "Gemini general knowledge (not live data)".

If the news fetch fails or finds nothing, the app falls back to general-knowledge analysis and says so. No news does not mean a place is safe.

## Getting started

### Prerequisites

- Node.js 18 or newer (the server uses the built-in `fetch`)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

Make sure `express` and `dotenv` are installed for the backend, and that the server runs as an ES module (`"type": "module"` in `package.json`) since it uses `import` syntax.

### 2. Configure environment variables

Create a `.env` file for the backend (for example `backend/.env`):

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=your_gemini_model_name
PORT=3001
```

| Variable         | Required | Description                                        |
| ---------------- | -------- | -------------------------------------------------- |
| `GEMINI_API_KEY` | Yes      | Your Gemini API key                                |
| `GEMINI_MODEL`   | Yes      | Model name used in the API URL, as listed in AI Studio |
| `PORT`           | No       | Server port (default `3001`)                       |

Never commit `.env`. Add it to `.gitignore`.

### 3. Run the backend

```bash
node server.js
```

The health check at `http://localhost:3001/` should return the service status and model name.

### 4. Run the frontend

Start your React dev server. The frontend calls `/api/gemini` with a relative URL, so the dev server must proxy `/api` to `http://localhost:3001`. With Vite, for example:

```js
// vite.config.js
export default {
  server: { proxy: { '/api': 'http://localhost:3001' } },
};
```

## API

### `POST /api/gemini`

Request body:

```json
{ "prompt": "string" }
```

Returns the parsed JSON object produced by Gemini. Error responses use `{ "error": "message" }`:

| Status | Meaning                                         |
| ------ | ----------------------------------------------- |
| 400    | Missing or invalid prompt                       |
| 500    | `GEMINI_API_KEY` missing or internal error      |
| 502    | Gemini returned an empty or unparseable response |

## Project structure

```
.
├── App.jsx      # React UI, state, validation and Gemini calls
├── server.js    # Express proxy to Gemini with JSON extraction and repair
└── .env         # Backend secrets (not committed)
```

## Troubleshooting

- **"Gemini returned malformed JSON"**: check the `Gemini raw response:` line in the server log. The parser repairs common issues, but severely broken output may still fail. Setting a `responseSchema` in `generationConfig` makes the output stricter.
- **"GEMINI_API_KEY is not configured"**: confirm `.env` is in the folder the server is started from and restart the server after editing it.
- **404 on `/api/gemini` from the browser**: the frontend dev server proxy is not configured.
- **Itinerary format errors**: the frontend rejects responses that do not match the requested day count or item shape. Try again, or lower the temperature in `generationConfig`.

## Limitations and roadmap

- Safety guidance uses news headlines only (no full article text, no live weather). Integrating a weather API (for example Open-Meteo) and an official advisories source would address this.
- Sign-in is a prototype and nothing is stored on a server.
- The destination list is a small built-in set of Indian places.
- Hospital and police lookups open Google Maps searches. Location sharing is optional and stays in the browser.

## Disclaimer

TravelAI is a planning aid, not an emergency authority. In an emergency, call **112** directly.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

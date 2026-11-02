import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not configured in .env');
}

// 1) Helper: quotes unquoted object keys (title: -> "title":), skipping string contents
function quoteKeys(s) {
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < s.length && /[\w$]/.test(s[j])) j++;
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k++;
      out += s[k] === ':' ? `"${s.slice(i, j)}"` : s.slice(i, j);
      i = j - 1;
      continue;
    }
    out += c;
  }
  return out;
}

// 2) Tolerant parser
function extractJson(text) {
  if (!text) throw new Error('Gemini returned an empty response.');

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParse = (s) => {
    try { return JSON.parse(s); } catch { return undefined; }
  };

  // Attempt 1: parse as-is
  let r = tryParse(cleaned);
  if (r !== undefined) return r;

  // Attempt 2: isolate the outermost { ... }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Gemini returned no JSON payload.');

  let slice = cleaned.slice(start, end + 1);
  r = tryParse(slice);
  if (r !== undefined) return r;

  // Attempt 3: repair (smart quotes, trailing commas, unquoted keys)
  slice = quoteKeys(
    slice
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,\s*([}\]])/g, '$1')
  );
  r = tryParse(slice);
  if (r !== undefined) return r;

  console.error('Failed to parse Gemini JSON:\n', slice);
  throw new Error('Gemini returned malformed JSON.');
}

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TravelAI Gemini Backend',
    model: MODEL
  });
});

/* ---------- Recent news (simple RAG retrieval step) ---------- */

const HAZARD_WORDS = [
  'landslide', 'flood', 'cloudburst', 'road closed', 'road blocked',
  'avalanche', 'earthquake', 'protest', 'curfew', 'strike',
  'snowfall', 'heavy rain', 'traffic jam', 'closed', 'advisory', 'alert'
];
const NEWS_DAYS = 7;
const NEWS_TOP = 8;

const decode = (s = '') =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const b = m[1];
    const rawTitle = tag(b, 'title');
    const source = tag(b, 'source');
    // Google News titles look like "Headline - Source"
    const title = source && rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(source.length + 3))
      : rawTitle;
    return {
      title,
      source: source || 'Google News',
      url: tag(b, 'link'),
      published: new Date(tag(b, 'pubDate'))
    };
  });
}

// Keyword-score headlines so only relevant ones reach Gemini.
function rankNews(items, place) {
  const p = place.toLowerCase();
  const cutoff = Date.now() - NEWS_DAYS * 864e5;
  const seen = new Set();
  return items
    .filter((i) => i.title && i.url && !isNaN(i.published) && +i.published >= cutoff)
    .filter((i) => i.title.toLowerCase().includes(p))
    .filter((i) => {
      const k = i.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((i) => {
      const t = i.title.toLowerCase();
      return { ...i, score: HAZARD_WORDS.filter((w) => t.includes(w)).length };
    })
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score || b.published - a.published)
    .slice(0, NEWS_TOP)
    .map((i, k) => ({
      n: k + 1,
      title: i.title,
      source: i.source,
      url: i.url,
      published: i.published.toISOString().slice(0, 10)
    }));
}

app.get('/api/news', async (req, res) => {
  const place = String(req.query.q || '').trim();
  if (!place) return res.status(400).json({ error: 'Missing q.' });

  const query =
    `${place} (landslide OR flood OR cloudburst OR "road closed" OR avalanche OR ` +
    `earthquake OR protest OR curfew OR strike OR snowfall OR "heavy rain") when:${NEWS_DAYS}d`;
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`News feed returned ${r.status}`);
    const items = rankNews(parseRss(await r.text()), place);
    console.log(`News | q=${place} | kept ${items.length}`);
    return res.json({ items });
  } catch (err) {
    // News is optional: never break itinerary generation because of it.
    console.error('News fetch failed:', err.message);
    return res.json({ items: [], error: err.message });
  }
});

app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid prompt.'
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in backend/.env'
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${MODEL}:generateContent?key=${API_KEY}`;

    // Always request JSON. Recent news is supplied by the caller in the prompt.
    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],

      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    console.log(
      `Gemini request | model=${MODEL}`
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          'Gemini API request failed.'
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const text = parts
      .map(part => part?.text || '')
      .join('')
      .trim();

    console.log('Gemini raw response:', text);

    if (!text) {
      console.error(
        'Gemini returned no text.',
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error: 'Gemini returned an empty response.'
      });
    }

    let parsed;

    try {
      parsed = extractJson(text);
    } catch (err) {
      console.error('JSON extraction error:', err.message);

      return res.status(502).json({
        error: err.message,
        raw: text
      });
    }

    return res.json(parsed);

  } catch (err) {
    console.error('Server error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error.'
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `TravelAI server running on http://localhost:${PORT}`
  );
  console.log(`Gemini model: ${MODEL}`);
  console.log(
    `Gemini API key configured: ${Boolean(API_KEY)}`
  );
});
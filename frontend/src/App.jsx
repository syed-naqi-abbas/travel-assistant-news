import React from "react";

/* ============ CONFIG ============ */

const INTERESTS = [
  "Nature",
  "History",
  "Food",
  "Adventure",
  "Culture",
  "Shopping",
  "Nightlife",
  "Photography",
];

const ACTS = [
  "Hiking",
  "Trekking",
  "Sightseeing",
  "Night travel",
  "Driving",
  "Water activities",
  "Shopping",
  "Food",
  "Culture",
];

const PLACES = [
  ["Manali", "Himachal Pradesh"],
  ["Shimla", "Himachal Pradesh"],
  ["Dharamshala", "Himachal Pradesh"],
  ["Srinagar", "Jammu & Kashmir"],
  ["Gulmarg", "Jammu & Kashmir"],
  ["Pahalgam", "Jammu & Kashmir"],
  ["Jammu", "Jammu & Kashmir"],
  ["Leh", "Ladakh"],
  ["Jaipur", "Rajasthan"],
  ["Udaipur", "Rajasthan"],
  ["Jodhpur", "Rajasthan"],
  ["Goa", "Goa"],
  ["Rishikesh", "Uttarakhand"],
  ["Mussoorie", "Uttarakhand"],
  ["Varanasi", "Uttar Pradesh"],
  ["Agra", "Uttar Pradesh"],
  ["Delhi", "Delhi"],
  ["Mumbai", "Maharashtra"],
  ["Kochi", "Kerala"],
  ["Munnar", "Kerala"],
  ["Darjeeling", "West Bengal"],
  ["Gangtok", "Sikkim"],
  ["Hampi", "Karnataka"],
  ["Ooty", "Tamil Nadu"],
  ["Visakhapatnam","Andhra Pradesh"]
];

const AMBIG = {
  kashmir: ["Srinagar", "Gulmarg", "Pahalgam", "Jammu"],
  himachal: ["Manali", "Shimla", "Dharamshala"],
  rajasthan: ["Jaipur", "Udaipur", "Jodhpur"],
  kerala: ["Kochi", "Munnar"],
};

const INTL = [
  "new york",
  "paris",
  "tokyo",
  "london",
  "dubai",
  "bangkok",
  "singapore",
  "kathmandu",
  "colombo",
];

const MOUNTAIN = [
  "Manali",
  "Leh",
  "Gulmarg",
  "Pahalgam",
  "Munnar",
  "Darjeeling",
  "Gangtok",
  "Shimla",
  "Dharamshala",
  "Mussoorie",
];

/* ============ STATE ============ */

let S = {
  view: "auth",
  user: null,
  profile: {
    name: "",
    age: "",
    nat: "Indian",
    group: "Friends",
    access: "None",
    diet: "No preference",
    interests: ["Nature", "Photography"],
    opt: { gender: "", lgbtq: false, religion: "", note: "" },
  },

  trip: {
    dest: "",
    q: "Manali",
    start: "2026-10-12",
    end: "2026-10-17",
    n: 2,
    budget: "Moderate",
    style: "Balanced",
    transport: "Taxi / cab",
    acts: ["Sightseeing", "Hiking"],
    level: "Beginner",
  },

  it: null,
  issues: [],
  dec: {},
  modal: null,
  day: 1,
  tab: "today",
  trips: false,
  loading: null,
  res: null,
  toast: "",
  src: "gemini",
  today: 2,
  now: "13:00",
};

const save = () => {};

const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fmt = (d) =>
  new Date(d + "T00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const nDays = () =>
  Math.max(
    1,
    Math.round((new Date(S.trip.end) - new Date(S.trip.start)) / 864e5) + 1,
  );

const mins = (t) => {
  const [a, b] = t.split(":");
  return +a * 60 + +b;
};

const hhmm = (m) =>
  String(Math.floor(m / 60)).padStart(2, "0") +
  ":" +
  String(m % 60).padStart(2, "0");

const tm12 = (t) => {
  let [h, m] = t.split(":");
  h = +h;
  return (
    (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? " AM" : " PM")
  );
};

const SEV = {
  info: ["t-info", "ℹ️", "Good to know"],
  attention: ["t-warn", "⚠️", "Heads up"],
  critical: ["t-crit", "⛔", "Critical"],
};

/* ============ LOCATION VALIDATION ============ */

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

function validateLocation(q) {
  const [n, st] = q.split(",").map((s) => s.trim().toLowerCase());
  if (!n) return { status: "empty" };

  if (INTL.includes(n)) return { status: "intl", q };

  if (AMBIG[n])
    return {
      status: "ambiguous",
      q,
      options: AMBIG[n].map((x) => PLACES.find((p) => p[0] === x)),
    };

  const ex = PLACES.find((p) => p[0].toLowerCase() === n);

  if (ex) {
    if (st && !ex[1].toLowerCase().startsWith(st.slice(0, 4)))
      return { status: "mismatch", q, options: [ex] };
    return { status: "ok", place: ex };
  }

  const near = PLACES.map((p) => [lev(n, p[0].toLowerCase()), p]).sort(
    (a, b) => a[0] - b[0],
  );

  if (near[0][0] <= 2) return { status: "typo", q, options: [near[0][1]] };

  return { status: "notfound", q, options: near.slice(0, 3).map((x) => x[1]) };
}

/* ============ DATA LAYER ============ */

// Recent news headlines for the destination (never throws; news is optional).
async function fetchNews(place) {
  try {
    const r = await fetch("/api/news?q=" + encodeURIComponent(place));
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.items) ? j.items : [];
  } catch (e) {
    return [];
  }
}

async function gemini(prompt) {
  const r = await fetch("/api/gemini", {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ prompt }),
  });

  if (!r.ok) {
    let detail = "Gemini request failed";

    try {
      const j = await r.json();
      detail = j.error || detail;
    } catch (e) {}

    throw new Error(detail);
  }

  return r.json();
}

async function generateItinerary() {
  const out =
    await gemini(`You are an India travel planner. Return JSON {"days":[{"items":[{"t":"HH:MM","title":"","type":"outdoor|indoor|food|stay","dur":minutes,"why":"short reason tied to profile"}]}]} for exactly ${nDays()} days.

PROFILE:${JSON.stringify({ ...S.profile, opt: undefined })}

TRIP:${JSON.stringify(S.trip)}`);

  const ok =
    Array.isArray(out.days) &&
    out.days.length === nDays() &&
    out.days.every(
      (d) =>
        Array.isArray(d.items) &&
        d.items.length &&
        d.items.every(
          (x) =>
            /^\d\d:\d\d$/.test(x.t) &&
            x.title &&
            ["outdoor", "indoor", "food", "stay"].includes(x.type),
        ),
    );

  if (!ok) throw new Error("Gemini returned an invalid itinerary format");

  S.src = "gemini";

  return out.days.map((d, i) => ({
    day: i + 1,
    items: d.items.map((x, k) => ({
      t: x.t,
      title: String(x.title),
      type: x.type,
      dur: +x.dur || 60,
      why: x.why,
      id: `d${i + 1}i${k}`,
    })),
  }));
}

async function analyzeSafety(it, news = []) {
  const out =
    await gemini(`You are a travel safety context checker for India. Return ONLY a JSON object with this shape:
{"issues":[{"day":1,"idx":0,"sev":"information|attention|critical","kind":"weather|road|info","title":"","detail":"","impact":[""],"why":[""],"src":[1],"alts":[{"label":"","reason":"","title":"optional new activity title","time":"optional HH:MM"}]}]}

Rules:
- You have NO live data except the NEWS items below (headlines from the last 7 days).
- If a NEWS item reports a hazard that may affect this trip (landslide, flood, road closure, unrest, heavy rain, etc.), raise an issue and put the item number(s) in "src". Say "reported by <source>" and never claim more than the headline says. Ignore items that are not about the destination or not travel-relevant.
- For issues NOT based on NEWS, use only general, well-known factors (typical seasonal weather, altitude, terrain, daylight hours, usual road or pass conditions for the season, activity difficulty vs experience), phrase them as "typically" or "may", and use "src": [].
- Never invent news. Never say a place "is safe".
- idx is the zero-based position of the item within that day's items.
- Include "alts" for every issue (use [] if none).
- If there are no relevant issues, return {"issues":[]}.

TRIP:${JSON.stringify(S.trip)}

PROFILE:${JSON.stringify({ age: S.profile.age, group: S.profile.group, access: S.profile.access })}

NEWS:${news.length ? JSON.stringify(news.map(({ n, title, source, published }) => ({ n, title, source, published }))) : "[] (none found)"}

ITINERARY:${JSON.stringify(it)}`);

  const byN = Object.fromEntries(news.map((x) => [x.n, x]));
  const general = {
    name: "Gemini general knowledge (not live data)",
    updated: "n/a",
  };

  return (out.issues || [])
    .filter((x) => it[x.day - 1]?.items[x.idx] && x.title && x.detail)
    .map((x, n) => ({
      id: "g" + n,
      sev: { information: "info" }[x.sev] || x.sev,
      kind: x.kind || "info",
      item: it[x.day - 1].items[x.idx].id,
      day: x.day,
      title: x.title,
      detail: x.detail,
      impact: x.impact || [],
      why: x.why || [],
      sources: (Array.isArray(x.src) ? x.src : [])
        .map((n) => byN[n])
        .filter(Boolean)
        .map((n) => ({
          name: n.source,
          updated: n.published,
          text: n.title,
          url: n.url,
        }))
        .slice(0, 3)
        .concat(
          Array.isArray(x.src) && x.src.some((n) => byN[n]) ? [] : [general],
        ),
      alts: (x.alts || []).map((a) => ({
        label: a.label,
        reason: a.reason,
        title: a.title,
        time: a.time,
        type: a.type,
        kind: a.time && !a.title ? "move" : "swap",
      })),
    }))
    .filter((x) => SEV[x.sev]);
}

function applyAlt(id, ai) {
  const is = S.issues.find((x) => x.id === id),
    a = is.alts[ai],
    d = S.it[is.day - 1],
    it = d.items.find((x) => x.id === is.item);

  S.dec[id] = { type: "alt", ai, prev: { ...it } };
  if (a.time) it.t = a.time;
  if (a.title) {
    it.title = a.title;
    it.type = a.type || it.type;
    it.why = a.reason;
  }
  it.changed = true;
  d.items.sort((p, q) => mins(p.t) - mins(q.t));
}

function undo(id) {
  const is = S.issues.find((x) => x.id === id),
    d = S.dec[id];
  if (d?.prev) {
    const it = S.it[is.day - 1].items.find((x) => x.id === is.item);
    Object.assign(it, d.prev);
    delete it.changed;
    S.it[is.day - 1].items.sort((p, q) => mins(p.t) - mins(q.t));
  }
  delete S.dec[id];
}

/* ============ ACTIONS ============ */

function toast(m) {
  S.toast = m;
  render();
  setTimeout(() => {
    S.toast = "";
    render();
  }, 3500);
}

async function go() {
  const miss = [],
    t = S.trip;
  if (!t.q.trim()) miss.push("a destination");
  if (!t.start) miss.push("a start date");
  if (!t.end) miss.push("an end date");
  else if (t.end < t.start) miss.push("an end date after your start date");
  if (!(t.n > 0)) miss.push("number of travelers");
  if (!t.acts.length) miss.push("at least one activity");

  if (miss.length) {
    S.res = { status: "missing", miss };
    return render();
  }

  const v =
    S.res?.status === "ok" && S.res.forQ === t.q
      ? S.res
      : validateLocation(t.q);
  v.forQ = t.q;
  S.res = v;
  if (v.status !== "ok") return render();

  t.dest = `${v.place[0]}, ${v.place[1]}`;
  S.loading = 0;
  S.view = "plan";
  S.day = 1;
  S.dec = {};
  render();

  const step = async (i) => {
    S.loading = i;
    render();
    await sleep(550);
  };

  try {
    await step(0);
    await step(1);

    // Fetch recent news in parallel with itinerary generation.
    const newsP = fetchNews(v.place[0]);
    const it = await generateItinerary();

    await step(2);

    S.it = it;

    const news = await newsP;
    S.issues = await analyzeSafety(it, news);
    S.checked = news.length
      ? `Google News, last 7 days (${news.length} relevant reports) + Gemini general knowledge`
      : "No recent hazard news found; Gemini general knowledge only";

    await step(3);

    S.loading = null;
    save();
    render();
  } catch (e) {
    S.loading = null;

    toast(
      e.message ||
        "Gemini request failed. Check the server and GEMINI_API_KEY.",
    );
  }
}

const A = {
  login() {
    S.user = $("#em").value || "demo@traveler.in";
    S.view = S.profile.name ? "home" : "profile";
    save();
    render();
  },

  demo() {
    S.user = "demo@traveler.in";
    Object.assign(S.profile, { name: "Aarav", age: "24", nat: "Indian" });
    S.view = "home";
    save();
    render();
  },

  nav(v) {
    S.view = v;
    S.tab = "today";
    save();
    render();
  },

  save() {
    const p = S.profile;
    if (!String(p.name).trim() || !String(p.age).trim()) {
      S.res = { status: "pmiss" };
      return render();
    }
    S.res = null;
    S.view = "home";
    save();
    toast("Profile saved successfully");
    render();
  },

  skip() {
    S.profile.opt = { gender: "", lgbtq: false, religion: "", note: "" };
    toast("Optional details skipped — nothing is required");
  },

  pick(q) {
    S.trip.q = q;
    S.res = null;
    render();
  },

  go,
  review(id) {
    S.modal = { id, alts: false };
  },
  close() {
    S.modal = null;
  },

  alts() {
    S.modal.alts = true;
  },

  choose(id, i) {
    applyAlt(id, +i);
    S.modal = null;
    save();
    toast("Itinerary updated — you can undo this anytime");
  },

  keep(id) {
    S.dec[id] = { type: "keep" };
    S.modal = null;
    save();
    toast("Keeping your original plan");
  },

  undo(id) {
    undo(id);
    save();
    render();
  },
  day(d) {
    S.day = +d;
    render();
  },

  start() {
    S.view = "trip";
    S.tab = "today";
    render();
  },
  stop() {
    S.view = "plan";
    render();
  },
  tab(t) {
    S.tab = t;
    render();
  },

  loc() {
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) => {
            S.geo = `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`;
            render();
          },
          () => {
            toast("Location permission was not granted.");
            render();
          },
        )
      : (toast("Geolocation is not available in this browser."), render());
  },

  newtrip() {
    S.it = null;
    S.issues = [];
    S.res = null;
    S.view = "home";
    render();
  },
};

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    S.modal = null;
    return render();
  }
  const b = e.target.closest("[data-a]");
  if (b) {
    A[b.dataset.a]?.(b.dataset.x, b.dataset.y);
    if (
      ![
        "go",
        "login",
        "demo",
        "save",
        "skip",
        "start",
        "choose",
        "keep",
      ].includes(b.dataset.a)
    )
      render();
  }

  const c = e.target.closest("[data-t]");
  if (c) {
    const [k, v] = c.dataset.t.split(":"),
      arr = k === "int" ? S.profile.interests : S.trip.acts,
      i = arr.indexOf(v);
    i < 0 ? arr.push(v) : arr.splice(i, 1);
    render();
  }
});

document.addEventListener("input", (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const [o, k] = f.split(".");
  let v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  (o === "p" ? S.profile : o === "o" ? S.profile.opt : S.trip)[k] = v;
  if (o === "t" && k === "q") S.res = null;
  save();
});

/* ============ VIEWS ============ */

const RIDGE =
  '<svg viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 80 L120 40 L220 70 L340 20 L470 75 L590 35 L720 85 L860 30 L980 70 L1100 45 L1200 75 V120 H0Z" fill="#2A5068" opacity=".8"/><path d="M0 100 L160 65 L300 95 L450 55 L620 100 L800 60 L960 98 L1100 70 L1200 95 V120 H0Z" fill="#F2F5F7"/></svg>';

let HDR = "";
const hero = (c) =>
  `<div class="hero"><div class="sun"></div><div class="in">${HDR}${c}</div>${RIDGE}</div>`;

const chip = (pre, v, on) =>
  `<button class="chip ${on ? "on" : ""}" data-t="${pre}:${v}" aria-pressed="${on}">${v}</button>`;

const fld = (l, f, v, type = "text", ph = "", required = false) =>
  `<div><label>${l}${required ? " *" : ""}</label><input type="${type}" data-f="${f}" value="${esc(v)}" placeholder="${ph}" ${required ? "required" : ""}></div>`;

const sel = (l, f, v, opts) =>
  `<div><label>${l}</label><select data-f="${f}">${opts.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;

function vAuth() {
  return `<div class="hero authhero"><div class="sun"></div><div class="in" style="width:100%"><div class="logo" style="font-size:30px">Travel<b>AI</b></div><h1>Know what may affect your plan, before you go.</h1><p>Plan trips across India. We check recent news reports, show where the information comes from, and you decide what changes.</p>

<div class="card" style="max-width:420px;color:var(--ink)"><label>Email</label><input id="em" type="email" placeholder="you@example.com"><div class="row" style="margin-top:14px"><button class="btn accent" data-a="login">Continue</button><button class="btn sec" data-a="demo">Try the demo traveler</button></div><p class="mut" style="margin:10px 0 0">Prototype sign-in: nothing is sent anywhere.</p></div></div>${RIDGE}</div>`;
}

function vProfile() {
  const p = S.profile,
    o = p.opt;
  return (
    hero(`<h1>Your profile</h1><p>Helps us tailor plans to you.</p>`) +
    `<div class="wrap pull">

${S.res?.status === "pmiss" ? `<div class="err" role="alert"><b>Name and age are needed.</b><br>We use them to personalise suggestions. Fill both in to continue.</div>` : ""}

<div class="card"><div class="grid">${fld("Name", "p.name", p.name, "text", "", true)}${fld("Age", "p.age", p.age, "number", "", true)}${fld("Nationality", "p.nat", p.nat)}${sel("Travel group", "p.group", p.group, ["Solo", "Couple", "Friends", "Family with kids", "Family with seniors"])}${sel("Accessibility needs", "p.access", p.access, ["None", "Limited walking", "Wheelchair access", "Low altitude preferred"])}${sel("Dietary preference", "p.diet", p.diet, ["No preference", "Vegetarian", "Vegan", "Jain", "Halal"])}</div>

<label style="margin-top:14px">Interests</label><div class="chips">${INTERESTS.map((i) => chip("int", i, p.interests.includes(i))).join("")}</div></div>

<div class="card"><h3>Optional: personal safety preferences</h3><p class="mut">These details are optional and are only used when they may be relevant to your travel experience.</p>

<div class="grid">${sel("Gender", "o.gender", o.gender, ["", "Woman", "Man", "Non-binary", "Prefer not to say"])}${fld("Religion (optional)", "o.religion", o.religion)}</div>

<label style="margin-top:10px"><input type="checkbox" style="width:auto" data-f="o.lgbtq" ${o.lgbtq ? "checked" : ""}> I'm an LGBTQ+ traveler</label>

<div class="row" style="margin-top:10px"><button class="btn ghost" data-a="skip">Skip</button></div></div>


<button class="btn" data-a="save">Save profile</button></div>`
  );
}

function resBox() {
  const r = S.res;
  if (!r) return "";
  const pick = (p) =>
    `<div class="opt"><span><b>${p[0]}</b>, ${p[1]}</span><button class="btn sm" data-a="pick" data-x="${p[0]}, ${p[1]}">Select</button></div>`;

  if (r.status === "missing")
    return `<div class="err" role="alert"><b>Almost there — we still need:</b><ul>${r.miss.map((m) => `<li>${m}</li>`).join("")}</ul></div>`;

  if (r.status === "intl")
    return `<div class="err" role="alert"><b>TravelAI currently supports destinations within India.</b><br>"${esc(r.q)}" is outside India. Try a place like Jaipur, Goa or Leh.</div>`;

  if (r.status === "typo")
    return `<div class="err" role="alert"><b>We couldn't find "${esc(r.q)}".</b><br>Did you mean:${r.options.map(pick).join("")}</div>`;

  if (r.status === "mismatch")
    return `<div class="err" role="alert"><b>We couldn't find a location matching "${esc(r.q)}".</b><br>Possible matches:${r.options.map(pick).join("")}</div>`;

  if (r.status === "ambiguous")
    return `<div class="err" role="alert"><b>Which destination do you mean?</b><br>"${esc(r.q)}" covers several places:${r.options.map(pick).join("")}<div class="mut" style="margin-top:8px">Not listed? Type the town name above.</div></div>`;

  if (r.status === "notfound")
    return `<div class="err" role="alert"><b>We couldn't find "${esc(r.q)}" in our India list.</b><br>Closest matches:${r.options.map(pick).join("")}</div>`;

  return "";
}

function vHome() {
  const t = S.trip;
  return (
    hero(
      `<h1>Where to, ${esc(S.profile.name || "traveler")}?</h1><p>Plan, verify, explain, adapt — with the source for every safety note.</p>`,
    ) +
    `<div class="wrap pull"><div class="card"><div class="grid"><div style="grid-column:1/-1"><label>Destination (India)</label><input data-f="t.q" value="${esc(t.q)}" placeholder="e.g. Manali, Himachal Pradesh"><div class="mut" style="margin-top:6px">Try: ${["Manli", "Kashmir", "Manali, Rajasthan", "Paris"].map((x) => `<a href="#" data-a="pick" data-x="${x}">${x}</a>`).join(" · ")}</div></div>

${fld("Start date", "t.start", t.start, "date")}${fld("End date", "t.end", t.end, "date")}${fld("Travelers", "t.n", t.n, "number")}${sel("Budget", "t.budget", t.budget, ["Budget", "Moderate", "Premium"])}${sel("Travel style", "t.style", t.style, ["Relaxed", "Balanced", "Packed"])}${sel("Transportation", "t.transport", t.transport, ["Taxi / cab", "Self-drive", "Public transport", "Bike"])}</div>

<label style="margin-top:14px">Activities</label><div class="chips">${ACTS.map((a) => chip("act", a, t.acts.includes(a))).join("")}</div>

${t.acts.some((a) => /Hik|Trek/.test(a)) ? `<div style="max-width:240px;margin-top:12px">${sel("Hiking experience", "t.level", t.level, ["Beginner", "Intermediate", "Experienced"])}</div>` : ""}

${resBox()}<div class="row" style="margin-top:16px"><button class="btn accent lg" data-a="go">Create itinerary</button>${S.it ? `<button class="btn sec" data-a="nav" data-x="plan">Open current trip</button>` : ""}</div></div></div>`
  );
}

function vLoading() {
  const L = [
    "Reading your preferences",
    "Creating itinerary",
    "Searching recent news",
    "Reviewing reports",
  ];
  return (
    hero(`<h1>Building your trip</h1><p>This takes a few seconds.</p>`) +
    `<div class="wrap pull" style="max-width:480px"><div class="card steps" role="status">${L.map((l, i) => `<div class="${i < S.loading ? "d" : i === S.loading ? "a" : ""}">${i < S.loading ? "✓" : i === S.loading ? '<span class="spin">◌</span>' : "○"} ${l}</div>`).join("")}</div></div>`
  );
}

function issueCard(is) {
  const d = S.dec[is.id],
    [cl, ic, lb] = SEV[is.sev],
    ac = { attention: "a-warn", critical: "a-crit", info: "a-info" }[is.sev];

  if (d)
    return `<div class="alert a-info" style="opacity:.85"><span class="tag t-ok">✓ Handled</span> <b>${esc(is.title)}</b> — ${d.type === "keep" ? "you kept your original plan." : "itinerary changed: " + esc(is.alts[d.ai].label) + "."} <button class="btn ghost sm" data-a="undo" data-x="${is.id}">Undo</button></div>`;

  return `<div class="alert ${ac}"><span class="tag ${cl}">${ic} ${lb}</span><h3 style="margin-top:6px">${esc(is.title)}</h3><p style="margin:0 0 8px">${esc(is.detail)}</p>

 ${is.impact.length ? `<div class="mut">Potential impact: ${is.impact.map(esc).join(" · ")}</div>` : ""}

 <button class="btn sm" data-a="review" data-x="${is.id}">Review</button></div>`;
}

function vPlan() {
  if (S.loading !== null) return vLoading();
  const t = S.trip,
    its = S.issues,
    open = its.filter((i) => !S.dec[i.id]).length,
    dd = S.it[S.day - 1];

  return (
    hero(
      `<h1>${esc(t.dest.split(",")[0])}</h1><p>${fmt(t.start)} – ${fmt(t.end)} · ${t.n} travelers · ${t.budget} · ${t.style}</p>`,
    ) +
    `<div class="wrap">


<h2>Safety intelligence ${open ? `<span class="tag t-warn">${open} to review</span>` : '<span class="tag t-ok">✓ Nothing to review</span>'}</h2>

${its.length ? its.map(issueCard).join("") : '<div class="card"><span class="tag t-ok">🟢 No relevant issue identified</span><p class="mut" style="margin-bottom:0">From the information we checked. This isn\'t a guarantee — conditions can change.</p></div>'}

<div class="mut">Sources checked: ${esc(S.checked || "just now")}</div>

<h2>Itinerary</h2><div class="days">${S.it.map((d) => `<button class="chip ${d.day === S.day ? "on" : ""}" data-a="day" data-x="${d.day}">Day ${d.day}</button>`).join("")}</div>${dayList(dd)}

<button class="btn accent" data-a="start" style="margin-top:16px">Start trip mode</button>

<button class="btn ghost" data-a="newtrip">+ Plan another trip</button></div>`
  );
}

function dayList(d) {
  return `<div class="card">${d.items
    .map((x) => {
      const f = S.issues.find(
        (i) => i.item === x.id && !S.dec[i.id] && i.kind !== "info",
      );
      return `<div class="it"><div class="t">${tm12(x.t)}</div><div class="b"><div class="n">${esc(x.title)}</div><div class="row" style="gap:6px;margin-top:2px">${x.changed ? '<span class="tag t-info">Edited by you</span>' : ""}${f ? '<span class="tag t-warn">⚠️ Needs your review</span>' : x.type === "outdoor" ? '<span class="tag t-ok">✓ No issue found</span>' : ""}</div>${x.why ? `<div class="mut">${esc(x.why)}</div>` : ""}</div></div>`;
    })
    .join("")}</div>`;
}

function vTrip() {
  const d = S.it[S.today - 1] || S.it[0],
    nx = d.items.find((x) => x.t >= S.now) || d.items[d.items.length - 1];

  let body = "";

  if (S.tab === "today")
    body = `<h1>Today</h1><div class="mut">Day ${d.day} · ${esc(S.trip.dest.split(",")[0])} · demo clock ${tm12(S.now)}</div>${dayList(d)}

 <div class="card"><div class="mut">Next</div><h3>${esc(nx.title)} · ${tm12(nx.t)}</h3><div class="row" style="margin-top:8px"><a class="btn" href="https\://www\.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nx.title + ", " + S.trip.dest)}" target="_blank" rel="noopener">Navigate</a><button class="btn sec" data-a="tab" data-x="safety">Safety</button><button class="btn red" data-a="tab" data-x="sos">Emergency</button></div></div>`;
  else if (S.tab === "itin")
    body = `<h1>Itinerary</h1><div class="days">${S.it.map((x) => `<button class="chip ${x.day === S.day ? "on" : ""}" data-a="day" data-x="${x.day}">Day ${x.day}</button>`).join("")}</div>${dayList(S.it[S.day - 1])}`;
  else if (S.tab === "safety")
    body = `<h1>Safety</h1><div class="demo">Location, hospital and police entries are simulated unless you share your location.</div>

 <div class="card"><h3>📍 Current location</h3><div class="mut">${S.geo && S.geo !== "sim" ? S.geo : "Location not shared"}</div></div>

 <div class="card"><h3>Nearby</h3><div class="opt"><span>🏥 Hospital</span><a href="https\://www\.google.com/maps/search/?api=1&query=hospital+near+${encodeURIComponent(S.trip.dest)}" target="_blank" rel="noopener">Find on map</a></div><div class="opt"><span>👮 Police station</span><a href="https\://www\.google.com/maps/search/?api=1&query=police+station+near+${encodeURIComponent(S.trip.dest)}" target="_blank" rel="noopener">Find on map</a></div></div>

 <button class="btn big sec" data-a="loc">Share my location</button><a class="btn big sec" href="https\://www\.google.com/maps/dir/?api=1&destination=hotel+${encodeURIComponent(S.trip.dest)}" target="_blank" rel="noopener">Navigate to hotel</a><button class="btn big red" data-a="tab" data-x="sos">Emergency help</button>`;
  else
    body = `<h1>Emergency</h1><a class="btn big red" href="tel:112">📞 Call emergency services (112)</a><button class="btn big sec" data-a="loc">📍 Share my location ${S.geo ? `<div class="mut">${S.geo || "Location not shared"}</div>` : ""}</button>

 <a class="btn big sec" href="https\://www\.google.com/maps/search/?api=1&query=hospital+near+${encodeURIComponent(S.trip.dest)}" target="_blank" rel="noopener">🏥 Nearest hospital</a>

 <div class="card"><h3>Emergency card</h3><div class="mut">${esc(S.profile.name)}, ${esc(S.profile.age)} · ${esc(S.profile.nat)}<br>Diet: ${esc(S.profile.diet)} · Access: ${esc(S.profile.access)}<br>Traveling with: ${esc(S.profile.group)} · ${esc(S.trip.dest)}</div></div><p class="mut">This is a travel aid, not an emergency authority. In danger, call 112 directly.</p>`;

  return `<div class="wrap">${body}<button class="btn ghost" data-a="stop">← Exit trip mode</button></div><div class="bar">${[
    ["today", "Today"],
    ["itin", "Itinerary"],
    ["safety", "Safety"],
  ]
    .map(
      ([k, l]) =>
        `<button class="${S.tab === k ? "on" : ""}" data-a="tab" data-x="${k}">${l}</button>`,
    )
    .join("")}</div>`;
}

function vModal() {
  const is = S.issues.find((i) => i.id === S.modal.id),
    [cl, ic, lb] = SEV[is.sev];

  const moves = is.alts.filter((a) => a.kind === "move"),
    others = is.alts.filter((a) => a.kind !== "move");

  return `<div class="modal"><div class="sheet" role="dialog" aria-modal="true"><span class="tag ${cl}">${ic} ${lb}</span><h2 style="margin-top:8px">Why am I seeing this?</h2>

 <ul>${is.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><p>${esc(is.detail)}</p>

 ${is.sources.length ? `<h3>Source${is.sources.length > 1 ? "s" : ""}</h3>${is.sources.map((s) => `<div class="mut" style="margin-bottom:6px"><b>${esc(s.name)}</b> · Updated ${esc(s.updated)}${s.text ? `<br>“${esc(s.text)}”` : ""}${s.url ? `<br><a href="${esc(s.url)}" target="_blank" rel="noopener">View source</a>` : ""}</div>`).join("")}` : '<div class="demo">No source was available, so we can\'t confirm this.</div>'}

 <h3 style="margin-top:14px">What would you like to do?</h3>

 ${
    S.modal.alts
      ? others
          .concat(moves)
          .map((a) => {
            const i = is.alts.indexOf(a);
            return `<div class="opt"><span><b>${esc(a.label)}</b><br><span class="mut">${esc(a.reason)}</span></span><button class="btn sm" data-a="choose" data-x="${is.id}" data-y="${i}">Select</button></div>`;
          })
          .join("")
      : ""
  }

 <div class="row" style="margin-top:12px">${is.ack ? "" : moves.map((a) => `<button class="btn" data-a="choose" data-x="${is.id}" data-y="${is.alts.indexOf(a)}">${esc(a.label.replace("hike", "activity"))}</button>`).join("")}

 ${!is.ack && others.length && !S.modal.alts ? `<button class="btn sec" data-a="alts">Choose alternative</button>` : ""}

 <button class="btn sec" data-a="keep" data-x="${is.id}">${esc(is.keepLabel || (is.ack ? "Got it" : "Keep original"))}</button><button class="btn ghost" data-a="close">Close</button></div>

 ${is.kind === "weather" ? '<p class="mut">“Keep original” is always available — conditions can change and you know your plans best.</p>' : ""}</div></div>`;
}

function render() {
  if (window.__travelAIRefresh) window.__travelAIRefresh();
}

function App() {
  const [, refresh] = React.useState(0);

  React.useEffect(() => {
    window.__travelAIRefresh = () => refresh((x) => x + 1);

    render();

    return () => {
      delete window.__travelAIRefresh;
    };
  }, []);

  HDR =
    S.view === "auth" || S.view === "trip"
      ? ""
      : `<header class="top"><div class="logo">Travel<b>AI</b></div><nav class="main">${[
          ["home", "Home"],
          ["plan", "Trips"],
          ["profile", "Profile"],
        ]
          .map(
            ([k, l]) =>
              `<button class="${S.view === k ? "on" : ""}" data-a="nav" data-x="${k}">${l}</button>`,
          )
          .join("")}</nav></header>`;

  if (S.view === "plan" && !S.it && S.loading === null) S.view = "home";

  const v = {
    auth: vAuth,
    profile: vProfile,
    home: vHome,
    plan: vPlan,
    trip: vTrip,
  }[S.view]();

  const markup =
    v +
    (S.modal ? vModal() : "") +
    (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");

  return React.createElement("div", {
    id: "app",
    dangerouslySetInnerHTML: { __html: markup },
  });
}

export default App;

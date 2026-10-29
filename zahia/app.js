/* زاهية — a cozy corner that learns what you love.
   Everything you do stays on your phone (localStorage). No accounts, no tracking. */

(() => {
"use strict";

/* ---------------- tiny helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- memory ---------------- */
const KEY = "zahia.v1";
const TYPE_BASE = { poem: 1.3, quote: 1, proverb: 0.6, art: 1.3, article: 1, video: 0.9, song: 1, question: 0.6, onthisday: 0.35 };
const fresh = () => ({
  onboarded: false,
  picked: [],
  tags: Object.fromEntries(Object.keys(TAGS).map((t) => [t, 1])),
  types: { ...TYPE_BASE },
  liked: {},
  saved: [],
  seen: [],
  journal: [],
  hoop: { date: "", i: 0 },
  hearts: 0,
  skips: 0,
  theme: "auto",
});
let S = fresh();
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  if (raw) S = { ...fresh(), ...raw, tags: { ...fresh().tags, ...raw.tags }, types: { ...TYPE_BASE, ...raw.types } };
} catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const seenSet = new Set(S.seen);
const markSeen = (id) => {
  if (seenSet.has(id)) return;
  seenSet.add(id); S.seen.push(id);
  if (S.seen.length > 600) { const drop = S.seen.splice(0, 100); drop.forEach((d) => seenSet.delete(d)); }
};

/* ---------------- cross-stitch drawing ---------------- */
const THREAD = { r: "--pom", y: "--saffron", g: "--pistachio", b: "--indigo", i: "--ink" };
const STAR = [
  "....r....",
  "g..rrr..g",
  ".g.ryr.g.",
  ".rryyyrr.",
  "rryybyyrr",
  ".rryyyrr.",
  ".g.ryr.g.",
  "g..rrr..g",
  "....r....",
];
function stitchSVG(pattern, { cell = 10, animate = false, color } = {}) {
  const h = pattern.length, w = pattern[0].length;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const p = cell * 0.18; // inset
  let out = "";
  pattern.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const x0 = x * cell + p, y0 = y * cell + p, x1 = (x + 1) * cell - p, y1 = (y + 1) * cell - p;
    const stroke = color || `var(${THREAD[ch]})`;
    const delay = animate ? `animation-delay:${(Math.hypot(x - cx, y - cy) * 110 + Math.random() * 60) | 0}ms;` : "";
    out += `<path class="${animate ? "x" : ""}" style="stroke:${stroke};${delay}" d="M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * cell} ${h * cell}" fill="none" stroke-width="${cell * 0.26}" stroke-linecap="round">${out}</svg>`;
}
function drawStars() {
  $("#star").innerHTML = stitchSVG(STAR, { animate: !reduceMotion });
  $("#star-welcome").innerHTML = stitchSVG(STAR, { animate: !reduceMotion });
}
// the border between the hoop and the feed — a little diamond chain
function drawRule() {
  const cs = getComputedStyle(document.documentElement);
  const col = (v) => cs.getPropertyValue(v).trim();
  const TILE = ["....r.....", "...r.r....", "..r.y.r..g", "...r.r....", "....r....."];
  const svg = stitchSVG(TILE, { cell: 4.4 }).replace(/var\((--[a-z]+)\)/g, (_, v) => col(v));
  $$(".stitch-rule").forEach((el) => { el.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`; });
}
const HEART = [".ii.ii.", "iiiiiii", "iiiiiii", ".iiiii.", "..iii..", "...i..."];
const heartIcon = () => stitchSVG(HEART, { cell: 3.4, color: "currentColor" }).replace("<svg", '<svg class="heart-x"');
const keepIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg>';

/* ---------------- network ---------------- */
const memo = new Map();
async function getJSON(url, ms = 8000) {
  if (memo.has(url)) return memo.get(url);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    memo.set(url, data);
    return data;
  } finally { clearTimeout(timer); }
}

/* ---------------- the taste engine ---------------- */
function weighted(obj, floor = 0.15) {
  const entries = Object.entries(obj).map(([k, v]) => [k, Math.pow(Math.max(floor, v), 1.4)]);
  let r = Math.random() * entries.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of entries) { if ((r -= v) <= 0) return k; }
  return entries[0][0];
}
function pickTag() {
  if (Math.random() < 0.15) return { tag: rand(Object.keys(TAGS)), explore: true };
  return { tag: weighted(S.tags), explore: false };
}
function bump(card, d) {
  if (card.tag && S.tags[card.tag] != null) S.tags[card.tag] = clamp(S.tags[card.tag] + d * 0.6, 0.15, 6);
  (card.tags || []).forEach((t) => { if (t !== card.tag && S.tags[t] != null) S.tags[t] = clamp(S.tags[t] + d * 0.25, 0.15, 6); });
  if (S.types[card.type] != null) S.types[card.type] = clamp(S.types[card.type] + d * 0.3, 0.15, 5);
  save();
}

const KIND = {
  poem: "a poem", quote: "a line to keep", proverb: "something teta would say", art: "something to look at",
  article: "something to read", video: "a little rabbit hole", song: "a song for right now",
  question: "a question to sit with", onthisday: "on this day",
};
function reason(card) {
  if (!card.tag) return "";
  const name = `<b>${esc(TAGS[card.tag].label)}</b>`;
  if (card.explore) return `, something new: ${name}`;
  if (S.tags[card.tag] >= 1.8) return `, because you love ${name}`;
  if (S.picked.includes(card.tag)) return `, because you picked ${name}`;
  return `, about ${name}`;
}

/* ---------------- where things come from ---------------- */
function fromLocal(list, tag, idOf) {
  let pool = list.filter((x) => x.tags.includes(tag) && !seenSet.has(idOf(x)));
  if (!pool.length) pool = list.filter((x) => !seenSet.has(idOf(x)));
  if (!pool.length) pool = list;
  return rand(pool);
}

const builders = {
  async poem(tag) {
    const word = rand(TAGS[tag].words);
    let list;
    try { list = await getJSON(`https://poetrydb.org/lines/${encodeURIComponent(word)}`); } catch (e) { list = null; }
    if (!Array.isArray(list)) list = await getJSON("https://poetrydb.org/random/12");
    const ok = list.filter((p) => +p.linecount >= 4 && +p.linecount <= 40 && !seenSet.has(`poem:${p.title}|${p.author}`));
    const p = rand(ok.length ? ok : list.filter((p) => +p.linecount <= 60));
    if (!p) return null;
    return { id: `poem:${p.title}|${p.author}`, type: "poem", tag, title: p.title, author: p.author, lines: p.lines.join("\n").trim() };
  },

  async art(tag) {
    const word = rand(TAGS[tag].words);
    const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(word)}&query[term][is_public_domain]=true&fields=id,title,artist_title,image_id,date_display,thumbnail&limit=40`;
    const res = await getJSON(url);
    const pool = (res.data || []).filter((a) => a.image_id && !seenSet.has(`art:${a.id}`));
    const a = rand(pool);
    if (!a) return null;
    return {
      id: `art:${a.id}`, type: "art", tag, title: a.title, artist: a.artist_title || "unknown artist", date: a.date_display || "",
      img: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
      lqip: a.thumbnail?.lqip || "", alt: a.thumbnail?.alt_text || a.title,
      link: `https://www.artic.edu/artworks/${a.id}`,
    };
  },

  async article(tag) {
    let titles = TAGS[tag].wiki.filter((t) => !seenSet.has(`wiki:${t}`));
    let title = rand(titles);
    if (!title) {
      const word = rand(TAGS[tag].words);
      const s = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(word)}&srlimit=40&format=json&origin=*`);
      title = rand((s.query?.search || []).map((r) => r.title).filter((t) => !seenSet.has(`wiki:${t}`)));
    }
    if (!title) return null;
    const w = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    if (!w.extract || w.type === "disambiguation") { markSeen(`wiki:${title}`); return null; }
    return {
      id: `wiki:${title}`, type: "article", tag, title: w.title, extract: w.extract,
      thumb: w.thumbnail?.source || "", link: w.content_urls?.mobile?.page || w.content_urls?.desktop?.page,
    };
  },

  async onthisday() {
    const d = new Date();
    const res = await getJSON(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
    const pool = (res.selected || []).filter((e) => !seenSet.has(`otd:${e.year}:${e.text.slice(0, 40)}`));
    const e = rand(pool);
    if (!e) return null;
    const page = e.pages?.[0];
    return {
      id: `otd:${e.year}:${e.text.slice(0, 40)}`, type: "onthisday", tag: null, year: e.year, text: e.text,
      link: page?.content_urls?.mobile?.page || "", day: d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }).toLowerCase(),
    };
  },

  async quote(tag) {
    const q = fromLocal(QUOTES, tag, (x) => `quote:${x.text}`);
    return { id: `quote:${q.text}`, type: "quote", tag: q.tags.includes(tag) ? tag : q.tags[0], tags: q.tags, ...q };
  },
  async proverb(tag) {
    const p = fromLocal(PROVERBS, tag, (x) => `proverb:${x.ar}`);
    return { id: `proverb:${p.ar}`, type: "proverb", tag: p.tags.includes(tag) ? tag : p.tags[0], tags: p.tags, ...p };
  },
  async song(tag) {
    const s = fromLocal(SONGS, tag, (x) => `song:${x.title}`);
    return { id: `song:${s.title}`, type: "song", tag: s.tags.includes(tag) ? tag : s.tags[0], tags: s.tags, ...s };
  },
  async video(tag) {
    const v = fromLocal(RABBIT_HOLES, tag, (x) => `video:${x.q}`);
    return { id: `video:${v.q}`, type: "video", tag: v.tags.includes(tag) ? tag : v.tags[0], tags: v.tags, ...v };
  },
  async question() {
    const bank = [...QUESTIONS, ...PROMPTS].filter((q) => q !== hoopQuestion() && !seenSet.has(`q:${q}`));
    const text = rand(bank.length ? bank : QUESTIONS);
    return { id: `q:${text}`, type: "question", tag: null, text, prompt: PROMPTS.includes(text) };
  },
};

const shown = new Set();
let lastType = "";
async function makeCard() {
  for (let tries = 0; tries < 6; tries++) {
    let type = weighted(S.types);
    if (type === lastType) type = weighted(S.types);
    const { tag, explore } = pickTag();
    try {
      const card = await builders[type](tag);
      if (!card || shown.has(card.id)) continue;
      card.explore = explore && card.tag === tag;
      shown.add(card.id); markSeen(card.id); lastType = type;
      return card;
    } catch (e) { /* that source is napping — try another */ }
  }
  return null;
}

/* ---------------- drawing cards ---------------- */
const registry = new Map();
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function bodyFor(c) {
  switch (c.type) {
    case "poem": {
      const long = c.lines.split("\n").length > 10;
      return `<h3>${esc(c.title)}</h3><p class="meta">${esc(c.author)}</p>
        <div class="poem-lines ${long ? "clamped" : ""}">${esc(c.lines)}</div>
        ${long ? `<button class="linkish" data-more>read the whole poem</button>` : ""}`;
    }
    case "quote":
      return `<blockquote>${esc(c.text)}</blockquote><p class="meta">${esc(c.by)}${c.from ? `, <i>${esc(c.from)}</i>` : ""}</p>`;
    case "proverb":
      return `<p class="ar" lang="ar" dir="rtl">${esc(c.ar)}</p><p class="en">${esc(c.en)}</p>`;
    case "art":
      return `<a class="frame" href="${esc(c.link)}" target="_blank" rel="noopener" data-open style="${c.lqip ? `background-image:url(${esc(c.lqip)})` : ""}">
          <img src="${esc(c.img)}" alt="${esc(c.alt)}" loading="lazy" onerror="this.closest('.frame').remove()"></a>
        <div class="art-text"><p class="card-why">__WHY__</p><h3>${esc(c.title)}</h3><p class="meta">${esc(c.artist)}${c.date ? `, ${esc(c.date)}` : ""}</p></div>`;
    case "article":
      return `${c.thumb ? `<img class="thumb" src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}
        <h3>${esc(c.title)}</h3><p class="extract">${esc(c.extract)}</p>
        <div class="go"><a href="${esc(c.link)}" target="_blank" rel="noopener" data-open>keep reading</a></div>`;
    case "video":
      return `<div class="play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></div>
        <h3>${esc(c.title)}</h3><p class="meta">${esc(c.why)}</p>
        <div class="go"><a href="${yt(c.q)}" target="_blank" rel="noopener" data-open>watch on youtube</a></div>`;
    case "song":
      return `<div class="record" aria-hidden="true"></div>
        <div><h3>${esc(c.title)}</h3><p class="meta">${esc(c.artist)}</p><p>${esc(c.why)}</p>
        <div class="go"><a href="${yt(c.title + " " + c.artist)}" target="_blank" rel="noopener" data-open>youtube</a>
        <a href="https://open.spotify.com/search/${encodeURIComponent(c.title + " " + c.artist)}" target="_blank" rel="noopener" data-open>spotify</a></div></div>`;
    case "question":
      return `<h3>${esc(c.text)}</h3><div class="go"><a href="#journal" data-write>${c.prompt ? "try it in your journal" : "write about it"}</a></div>`;
    case "onthisday":
      return `<p class="year">${esc(c.year)}</p><p>${esc(c.text)}</p>
        ${c.link ? `<div class="go"><a href="${esc(c.link)}" target="_blank" rel="noopener" data-open>read more</a></div>` : ""}`;
  }
  return "";
}

function cardEl(c, { inKeepsakes = false } = {}) {
  registry.set(c.id, c);
  const el = document.createElement("article");
  el.className = `card card-${c.type}${c.type === "poem" ? " card-paper" : ""}`;
  el.dataset.id = c.id;
  const why = `${KIND[c.type]}${c.type === "onthisday" ? `, ${esc(c.day)}` : reason(c)}`;
  const liked = !!S.liked[c.id];
  const kept = S.saved.some((s) => s.id === c.id);
  let body = bodyFor(c);
  const whyLine = body.includes("__WHY__") ? "" : `<p class="card-why">${why}</p>`;
  body = body.replace("__WHY__", why);
  el.innerHTML = `${whyLine}${body}
    <div class="card-actions">
      <button class="act act-like ${liked ? "on" : ""}" aria-pressed="${liked}">${heartIcon()}<span>${liked ? "loved" : "love it"}</span></button>
      <button class="act act-keep ${kept ? "on" : ""}" aria-pressed="${kept}">${keepIcon}<span>${inKeepsakes ? "remove" : kept ? "kept" : "keep"}</span></button>
      <span class="act-spacer"></span>
      ${inKeepsakes ? "" : `<button class="act act-skip">not today</button>`}
    </div>`;
  return el;
}

function skeleton() {
  const el = document.createElement("div");
  el.className = "card card-loading";
  el.innerHTML = `<div><svg class="needle" viewBox="0 0 40 40"><path d="M4 30 Q 20 4 36 30"/></svg>threading the needle…</div>`;
  return el;
}

/* ---------------- the feed ---------------- */
const feed = $("#feed");
let loading = false;
async function loadMore(n = 4) {
  if (loading) return;
  loading = true;
  const slots = Array.from({ length: n }, () => feed.appendChild(skeleton()));
  await Promise.all(slots.map(async (slot) => {
    const c = await makeCard();
    if (!c) { slot.remove(); return; }
    const el = cardEl(c);
    el.classList.add("in");
    slot.replaceWith(el);
  }));
  save();
  loading = false;
  if (!feed.children.length) {
    feed.innerHTML = `<div class="empty">the internet seems quiet right now. check your connection, then tap “more, please”.</div>`;
  }
}

// gentle infinite scroll
new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && S.onboarded && !$("#view-home").hidden) loadMore(3);
}, { rootMargin: "700px 0px" }).observe($("#sentinel"));
$("#more").addEventListener("click", () => loadMore(4));

/* card interactions (one listener for everything) */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card[data-id]");
  if (!card) return;
  const c = registry.get(card.dataset.id);
  if (!c) return;

  const like = e.target.closest(".act-like");
  const keep = e.target.closest(".act-keep");
  const skip = e.target.closest(".act-skip");
  const more = e.target.closest("[data-more]");
  const open = e.target.closest("[data-open]");
  const write = e.target.closest("[data-write]");

  if (like) {
    const on = !S.liked[c.id];
    if (on) { S.liked[c.id] = 1; S.hearts++; bump(c, 1); petals(like); }
    else { delete S.liked[c.id]; S.hearts = Math.max(0, S.hearts - 1); bump(c, -1); }
    like.classList.toggle("on", on); like.setAttribute("aria-pressed", on);
    like.querySelector("span").textContent = on ? "loved" : "love it";
    save();
  }
  if (keep) {
    const inKeep = !!card.closest("#keep-list");
    const idx = S.saved.findIndex((s) => s.id === c.id);
    if (idx >= 0) {
      S.saved.splice(idx, 1);
      if (inKeep) { card.classList.add("leaving"); setTimeout(renderKeep, 340); }
      else { keep.classList.remove("on"); keep.querySelector("span").textContent = "keep"; }
      toast("taken out of keepsakes");
    } else {
      const { explore, ...plain } = c;
      S.saved.unshift(plain); bump(c, 1.2);
      keep.classList.add("on"); keep.querySelector("span").textContent = "kept";
      toast("tucked into your keepsakes");
    }
    save();
  }
  if (skip) {
    S.skips++; bump(c, -0.8);
    card.classList.add("leaving");
    setTimeout(() => card.remove(), 340);
    toast(c.tag ? `noted — a little less ${TAGS[c.tag].label}` : "noted");
    if (feed.querySelectorAll(".card").length < 4) loadMore(2);
  }
  if (more) {
    card.querySelector(".poem-lines").classList.remove("clamped");
    more.remove();
  }
  if (open) bump(c, 0.4);
  if (write) { e.preventDefault(); openJournal(c.text); }
});

function petals(btn) {
  if (reduceMotion) return;
  const r = btn.getBoundingClientRect();
  const cols = ["--pom", "--saffron", "--pistachio", "--pom"];
  for (let i = 0; i < 7; i++) {
    const p = document.createElement("div");
    p.className = "petal";
    p.innerHTML = stitchSVG(["r"], { cell: 12, color: `var(${cols[i % 4]})` });
    p.style.left = `${r.left + 14 + Math.random() * 10}px`;
    p.style.top = `${r.top + 4}px`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 90}px`);
    p.style.setProperty("--r", `${(Math.random() - 0.5) * 300}deg`);
    p.style.animationDelay = `${i * 30}ms`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------------- greeting + hoop ---------------- */
function greet() {
  const h = new Date().getHours();
  const [en, ar] =
    h >= 5 && h < 12 ? ["good morning, zahia", "صباح الخير يا زاهية"] :
    h >= 12 && h < 17 ? ["good afternoon, zahia", "نهارك سعيد يا زاهية"] :
    h >= 17 && h < 22 ? ["good evening, zahia", "مساء الخير يا زاهية"] :
    ["still awake, zahia?", "تصبحي على خير يا زاهية"];
  $("#greet-en").textContent = en;
  $("#greet-ar").textContent = ar;
  $("#today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toLowerCase();
}
function dayNumber() { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5) + d.getFullYear() * 400; }
function hoopQuestion() {
  if (S.hoop.date !== todayKey()) S.hoop = { date: todayKey(), i: 0 };
  return QUESTIONS[(dayNumber() * 7 + S.hoop.i) % QUESTIONS.length];
}
function renderHoop() { $("#hoop-q").textContent = hoopQuestion(); }
$("#hoop-next").addEventListener("click", () => { S.hoop.i++; save(); renderHoop(); });
$("#hoop-write").addEventListener("click", () => openJournal(hoopQuestion()));

/* ---------------- journal ---------------- */
let current = null;
function openJournal(q) {
  const day = todayKey();
  current = S.journal.find((j) => j.date === day && j.q === q) || { id: `${Date.now()}`, date: day, q, text: "" };
  show("journal");
  setTimeout(() => $("#j-text").focus(), 250);
}
function renderJournal() {
  if (!current) {
    const day = todayKey();
    const q = hoopQuestion();
    current = S.journal.find((j) => j.date === day && j.q === q) || { id: `${Date.now()}`, date: day, q, text: "" };
  }
  $("#j-date").textContent = new Date(current.date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toLowerCase();
  $("#j-q").textContent = current.q;
  $("#j-text").value = current.text;
  $("#j-saved").textContent = "";
  const past = S.journal.filter((j) => j.id !== current.id && j.text.trim()).sort((a, b) => b.id - a.id);
  $("#j-past").innerHTML = past.length
    ? past.map((j) => `<details><summary>${esc(j.q)}<span>${esc(new Date(j.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</span></summary><div class="entry">${esc(j.text)}</div></details>`).join("")
    : `<p class="small">your pages will gather here, like pressed flowers.</p>`;
}
let jTimer;
$("#j-text").addEventListener("input", (e) => {
  current.text = e.target.value;
  clearTimeout(jTimer);
  jTimer = setTimeout(() => {
    const i = S.journal.findIndex((j) => j.id === current.id);
    if (i >= 0) S.journal[i] = current; else if (current.text.trim()) S.journal.push(current);
    save();
    $("#j-saved").textContent = "saved, just for you";
  }, 500);
});

/* ---------------- keepsakes ---------------- */
function renderKeep() {
  const list = $("#keep-list");
  list.innerHTML = "";
  if (!S.saved.length) {
    list.innerHTML = `<div class="empty"><div class="star">${stitchSVG(STAR)}</div>nothing kept yet. tap <b>keep</b> on anything you want to come back to.</div>`;
    return;
  }
  S.saved.forEach((c) => list.appendChild(cardEl(c, { inKeepsakes: true })));
}

/* ---------------- vibes ---------------- */
function chipsInto(el, onTap) {
  el.innerHTML = Object.entries(TAGS).map(([k, t]) => `<button class="chip" data-tag="${k}" aria-pressed="false">${esc(t.label)}</button>`).join("");
  el.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) onTap(b); });
}
function renderVibes() {
  const top = Object.entries(S.tags).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0][1];
  const learned = S.hearts + S.skips;
  $("#taste").innerHTML = top.map(([k, v]) => `<div class="taste-row"><span>${esc(TAGS[k].label)}</span><span class="taste-bar"><i style="width:${Math.max(6, (v / max) * 100)}%"></i></span></div>`).join("")
    + `<p class="taste-note">${learned ? `learned from ${S.hearts} heart${S.hearts === 1 ? "" : "s"} and ${S.skips} skip${S.skips === 1 ? "" : "s"}` : "heart and skip things on your feed and this will start to look like you"}</p>`;
  $$("#vibe-chips .chip").forEach((b) => b.setAttribute("aria-pressed", S.tags[b.dataset.tag] >= 2));
  $$("[data-theme-set]").forEach((b) => b.setAttribute("aria-checked", b.dataset.themeSet === S.theme));
}
chipsInto($("#vibe-chips"), (b) => {
  const t = b.dataset.tag;
  const on = S.tags[t] < 2;
  S.tags[t] = on ? Math.max(S.tags[t], 2.6) : 1;
  if (on && !S.picked.includes(t)) S.picked.push(t);
  save(); renderVibes();
  toast(on ? `more ${TAGS[t].label}, coming up` : `okay, back to normal`);
});
$$("[data-theme-set]").forEach((b) => b.addEventListener("click", () => { S.theme = b.dataset.themeSet; save(); applyTheme(); renderVibes(); }));
$("#reset").addEventListener("click", () => {
  if (!confirm("forget everything i've learned about your taste?")) return;
  const keep = { saved: S.saved, journal: S.journal, theme: S.theme };
  S = { ...fresh(), ...keep, onboarded: false };
  seenSet.clear(); save();
  location.reload();
});

function applyTheme() {
  if (S.theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", S.theme);
  drawRule();
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawRule);

/* ---------------- tabs ---------------- */
function show(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  $$(".tabs button").forEach((b) => b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  if (view === "keep") renderKeep();
  if (view === "journal") renderJournal();
  if (view === "vibes") renderVibes();
  if (view === "home") { renderHoop(); }
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}
$$(".tabs button").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.view === "journal") current = null;
  show(b.dataset.view);
}));

/* ---------------- first visit ---------------- */
function welcome() {
  const w = $("#welcome");
  w.hidden = false;
  const chosen = new Set();
  chipsInto($("#welcome-chips"), (b) => {
    const t = b.dataset.tag;
    chosen.has(t) ? chosen.delete(t) : chosen.add(t);
    b.setAttribute("aria-pressed", chosen.has(t));
  });
  $("#welcome-go").addEventListener("click", () => {
    chosen.forEach((t) => (S.tags[t] = 2.6));
    S.picked = [...chosen];
    S.onboarded = true; save();
    w.hidden = true;
    drawStars();
    loadMore(5);
  }, { once: true });
}

/* ---------------- go ---------------- */
greet();
applyTheme();
drawStars();
renderHoop();
if (S.onboarded) loadMore(5); else welcome();
setInterval(greet, 60_000);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
})();

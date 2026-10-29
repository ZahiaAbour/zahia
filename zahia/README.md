# zahia ✿

A cozy little corner for your home screen, stitched like tatreez.

Every time you open it you get a feed of poems, lines to keep, sayings, art, articles, YouTube rabbit holes and songs, plus a daily question in an embroidery hoop. Tap **love it**, **keep** or **not today** and it slowly learns what feels like you.

Everything you do stays on your phone. No account, no tracking.

## Put it online (GitHub Pages, about 3 minutes)

1. On github.com, create a new **public** repository called `zahia`.
2. Click **Add file → Upload files**, drag in everything from this folder (including the `icons` folder), and commit.
3. Go to **Settings → Pages**. Under *Build and deployment*, pick **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. Wait a minute. Your app lives at `https://<your-username>.github.io/zahia/`.

## Add it to your home screen

- **iPhone:** open the link in **Safari** → Share button → **Add to Home Screen**.
- **Android:** open the link in **Chrome** → ⋮ menu → **Install app** (or *Add to Home screen*).

It opens full-screen, with the cross-stitch star as its icon.

## What's inside

| file | what it does |
| --- | --- |
| `index.html` | the pages: home, keepsakes, journal, vibes |
| `style.css` | rosewater linen, pomegranate thread, the hoop |
| `app.js` | the feed, the taste-learning, the journal |
| `data.js` | quotes, Arabic sayings, songs, rabbit holes, questions — **add your own here** |
| `sw.js` | lets it open offline |

Live content comes from [PoetryDB](https://poetrydb.org), the [Art Institute of Chicago](https://api.artic.edu) (public-domain paintings) and Wikipedia — all free, no keys needed.

## Making it more yours

Open `data.js` on GitHub, tap the pencil, and add a line, e.g. a song:

```js
{ title: "Song name", artist: "Artist", why: "why it feels like you", tags: ["love", "night"] },
```

Commit, and it shows up next time you open the app (pull down to refresh, or close and reopen). If changes don't appear, bump `VERSION` in `sw.js` (e.g. `zahia-v2`).

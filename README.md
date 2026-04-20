# Buddy Lift — Vercel deployment

A mobile workout logger that syncs directly to your Notion **Simple Workouts** database. The Notion token never touches the browser — it lives only in a Vercel serverless function.

## Structure

```
buddy-lift/
├── api/
│   ├── sync.js        # POST — writes N rows to Notion (one per exercise)
│   └── health.js      # GET  — verifies token + DB schema
├── public/
│   ├── index.html     # the app
│   └── src/*.jsx      # React components
├── package.json
├── vercel.json
└── README.md
```

## One-time setup

### 1. Create a Notion integration
1. Go to <https://www.notion.so/my-integrations> → **New integration**
2. Name it "Buddy Lift", internal workspace
3. Copy the **Internal Integration Secret** — starts with `secret_` or `ntn_`
4. Open your *Simple Workouts* database → `…` menu → **Connections** → **Buddy Lift**

### 2. Grab the database ID
Open the database as a full page. The URL looks like:
```
https://www.notion.so/<workspace>/<32-char-db-id>?v=…
```
Copy the 32-character string between the last `/` and `?v=`.

### 3. Verify the database schema matches
Buddy Lift expects these property names exactly:

| Property     | Type          | Notes |
|--------------|---------------|-------|
| Name         | Title         |       |
| Date         | Date          |       |
| Exercise     | Multi-select  | each option name = one exercise |
| Weight       | Number        | kg    |
| Rest         | Number        | sec   |
| Set 1 … Set 8 | Number       | reps per set (create up to 8) |
| Total Volume | Formula       | `prop("Weight") * (prop("Set 1") + prop("Set 2") + prop("Set 3") + prop("Set 4") + prop("Set 5") + prop("Set 6") + prop("Set 7") + prop("Set 8"))` |

> Don't send `Total Volume` from the app — Notion computes it.

### 4. Deploy
```bash
# one-time
npm i -g vercel
cd deploy
npm install

# first deploy (will ask a few questions, accept defaults)
vercel

# then in the Vercel dashboard, add env vars:
#   NOTION_TOKEN         = secret_xxx…
#   NOTION_DATABASE_ID   = 32-char id
# and redeploy:
vercel --prod
```

### 5. Install on your iPhone
1. Open the Vercel URL in Safari
2. Share → **Add to Home Screen**
3. Launches full-screen like a native app

## How sync works

When you tap **Done** on the post-workout summary, the app sends:

```json
POST /api/sync
{
  "date": "2026-04-21",
  "dayId": 1,
  "dayTitle": "Chest & Triceps",
  "exercises": [
    {
      "exercise": "Dumbbell bench press",
      "weight": 22.5,
      "rest": 90,
      "sets": [10, 10, 9, 8]
    },
    …
  ]
}
```

The function creates one Notion page per exercise. Each row's **Name** is formatted `"<Day title> – <Exercise>"`. Total Volume auto-computes on Notion's side.

## Local dev

```bash
cd deploy
vercel env pull .env.local   # pulls prod env vars locally
vercel dev                   # runs the app + functions at http://localhost:3000
```

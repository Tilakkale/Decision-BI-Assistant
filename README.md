# Decision Intelligence BI Assistant
### Production-Grade AI SaaS · FastAPI · Next.js 14 · Supabase · Groq Llama-3

> Ask any business question in plain English. Get instant SQL, charts, statistical insights, and an AI narrative — all streamed live.

---

## Why This Project Stands Out

| Feature | What It Proves |
|---|---|
| **Agentic Self-Healing Loop** | AI systems fail. This one catches DB errors, sends the failed SQL back to the LLM, and auto-repairs — max 2 retries |
| **Semantic Metadata Layer** | Real companies define "Revenue" differently. `dictionary.json` encodes business logic the AI uses to write precise SQL |
| **PII Masking Layer** | Regex-based pre-processing strips emails, phones, and names before any data reaches the LLM |
| **SSE Streaming Pipeline** | 6-step real-time stream: SQL typing effect, live stepper, non-blocking UX — just like ChatGPT |
| **Statistical Insight Engine** | Auto-computes WoW growth, Z-score + IQR outlier detection, health score 0–100 |
| **Safety Validator** | Blocks DROP/DELETE/UPDATE/INSERT + injection patterns before any SQL touches the DB |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER — Next.js 14 + Tailwind + Framer Motion            │
│  ┌─────────────────┐       ┌──────────────────────────────┐ │
│  │   Chat Panel    │       │      Insight Canvas          │ │
│  │ • Glowing input │       │ • Recharts (auto-selected)   │ │
│  │ • 6-step stepper│  SSE  │ • Radial health gauge        │ │
│  │ • Suggestion    │◄──────│ • WoW / outlier cards        │ │
│  │   chips         │       │ • SQL typewriter terminal    │ │
│  │ • History drawer│       │ • AI narrative               │ │
│  └─────────────────┘       └──────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/query (SSE stream)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  FASTAPI — Render                                           │
│                                                             │
│  ① NL Question → PII Mask                                  │
│  ② SQLAgent → Groq Llama-3 (schema + dictionary.json)      │
│  ③ Safety Validator (blocks DROP/injection)                 │
│  ④ asyncpg execute → self-heal on error (×2 retries)       │
│  ⑤ Insight Engine (WoW, outliers, health score)            │
│  ⑥ Narrative LLM call                                      │
│  ⑦ Stream all 6 steps as SSE events                        │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────┴──────────────┐
           │  Groq API (Llama-3 70B)    │  PostgreSQL — Supabase
           │  ~200-400ms per call       │  customers / orders / payments
           └────────────────────────────┘
```

---

## Project Structure

```
decision-intelligence-bi-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + SSE pipeline
│   │   ├── dictionary.json          # ← Semantic metadata layer
│   │   ├── agent/
│   │   │   └── sql_agent.py         # SQLAgent + self-healing loop
│   │   ├── safety/
│   │   │   └── guard.py             # PII masking + SQL validation
│   │   ├── insights/
│   │   │   └── engine.py            # WoW, outliers, health score
│   │   └── db/
│   │       └── connection.py        # asyncpg pool (Supabase)
│   ├── generate_data.py             # Phase 1: dataset generator
│   ├── schema.sql                   # Run in Supabase first
│   ├── seed.sql                     # Run in Supabase second
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Split-panel dashboard
│   │   ├── layout.tsx               # IBM Plex Mono font
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ChatPanel.tsx        # Left: input + stepper
│   │   │   ├── InsightCanvas.tsx    # Right: chart + metrics
│   │   │   └── HistoryDrawer.tsx    # Session history
│   │   ├── ui/
│   │   │   ├── ThinkingStepper.tsx  # 6-step animated pipeline
│   │   │   ├── SQLTerminal.tsx      # Typewriter SQL effect
│   │   │   └── HealthGauge.tsx      # Radial SVG meter
│   │   └── charts/
│   │       └── ChartRenderer.tsx    # Recharts auto-switcher
│   ├── hooks/
│   │   └── useSSEStream.ts          # SSE state machine
│   ├── lib/types.ts
│   ├── package.json
│   ├── next.config.ts
│   ├── Dockerfile
│   └── .env.local.example
├── docker-compose.yml
└── README.md
```

---

## Setup — Step by Step

### Prerequisites
- Node.js 20+, Python 3.12+
- [Supabase](https://supabase.com) account (free)
- [Groq](https://console.groq.com) API key (free, no credit card)

---

### Step 1 — Clone

```bash
git clone https://github.com/yourusername/decision-intelligence-bi-assistant.git
cd decision-intelligence-bi-assistant
```

---

### Step 2 — Set up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → New query
3. Paste and run `backend/schema.sql`
4. Generate the seed data:
   ```bash
   cd backend
   python generate_data.py
   ```
5. Paste and run `backend/seed.sql` in Supabase SQL Editor
6. Copy your connection string: **Settings → Database → Connection string → URI (Transaction mode)**

---

### Step 3 — Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env — paste your GROQ_API_KEY and DATABASE_URL
```

---

### Step 4 — Run Locally

**Option A — Docker Compose (recommended)**
```bash
# From project root
GROQ_API_KEY=gsk_... docker-compose up --build
```
- Backend:  http://localhost:8000
- Frontend: http://localhost:3000 (start separately below)

**Option B — Manual**
```bash
# Terminal 1: Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

---

### Step 5 — Test the Self-Healing Loop

Ask: `"What is our conversion rate for enterprise customers last quarter?"`

This query joins multiple concepts from `dictionary.json` and exercises the LOWER() normalization. If Groq returns a slightly off column name, you'll see the **⚡ Self-healed** badge appear in the UI.

---

## Deployment

### Backend → Render (free tier)

1. Push to GitHub
2. [render.com](https://render.com) → New → Web Service
3. **Root Directory:** `backend`
4. **Build command:** `pip install -r requirements.txt`
5. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Environment variables:
   - `DATABASE_URL` — your Supabase connection string
   - `GROQ_API_KEY` — your Groq key
   - `FRONTEND_URL` — your Vercel URL (after deploying frontend)

### Frontend → Vercel (free tier)

```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your Render backend URL
```

### Database → Supabase
- Already set up in Step 2
- Free tier: 500MB, sufficient for this project
- Use **Transaction mode (port 6543)** in DATABASE_URL for Render compatibility

---

## Demo Walkthrough

| Step | Action | What You'll See |
|---|---|---|
| 1 | Open http://localhost:3000 | Dark executive dashboard |
| 2 | Click "Total revenue last month?" | 6-step pipeline animates |
| 3 | Watch step 2 complete | SQL appears with typewriter effect |
| 4 | Click `{ SQL }` button | Terminal drawer opens, syntax highlighted |
| 5 | Data loads | Bar chart auto-renders, health gauge fills |
| 6 | See insight cards | WoW%, outlier count, top performer |
| 7 | Read AI narrative | Executive summary with real numbers |
| 8 | Ask "Who are our at-risk customers?" | Tests `dictionary.json` definition |
| 9 | Ask a bad question | Triggers self-heal — see ⚡ badge |
| 10 | Click hamburger | History drawer shows all queries |

---

## The 4 Senior-Level Features Explained

### 1. Agentic Self-Healing Loop
```
User question
     ↓
LLM generates SQL
     ↓
asyncpg executes
     ↓ (if error)
Error + failed SQL → LLM repair prompt
     ↓
Repaired SQL → retry (max 2×)
     ↓
Success or final error
```

### 2. Semantic Metadata Layer
`dictionary.json` defines business concepts in SQL:
```json
"churned_customer": {
  "sql": "id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE order_date >= CURRENT_DATE - INTERVAL '90 days')"
}
```
The AI reads this file on every request and uses the exact SQL expressions — not a guess.

### 3. PII Masking
```
User question: "Show orders for john.smith@corp.com"
                              ↓  mask_text()
Sent to LLM:  "Show orders for [EMAIL:A3F2B1C4]"
```
Result rows sent to AI for narrative also have names/emails hashed.

### 4. SSE Streaming
```
POST /api/query → StreamingResponse
  event: step    {"id":1, "status":"active"}
  event: step    {"id":1, "status":"done"}
  event: sql     {"query":"SELECT..."}
  event: data    {"rows":[...]}
  event: insights {...}
  event: narrative {"text":"Revenue grew..."}
  event: done    {"total_ms":1240}
```
Frontend `useSSEStream` hook reads each event type and updates state in real time.

---

## Future Improvements

- [ ] **Supabase Auth** — JWT-based multi-tenant isolation
- [ ] **LangSmith tracing** — full LLM observability per query
- [ ] **Pinned dashboards** — save queries as persistent widgets
- [ ] **Schema upload** — connect any PostgreSQL database via URL
- [ ] **Slack bot** — `@dibi what was revenue last week?`
- [ ] **Fine-tuned model** — train on company-specific SQL patterns
- [ ] **Export** — PNG chart export for slide decks

---

*Stack: FastAPI · asyncpg · Groq Llama-3 · Next.js 14 · Recharts · Framer Motion · Supabase · Docker · Render · Vercel*

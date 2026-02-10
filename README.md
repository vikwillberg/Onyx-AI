# ONYX — Data Analytics Dashboard

Upload CSV or Excel files and get an AI-powered interactive dashboard in seconds.

## Quick Start

Paste these commands into your terminal to start the server:

### Windows (PowerShell)

```powershell
cd "C:\Users\vikto\OneDrive\Desktop\AI powered Data Analytics Tool"
.\.venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Then open **http://127.0.0.1:8002** in your browser.

### First-Time Setup (only once)

```powershell
cd "C:\Users\vikto\OneDrive\Desktop\AI powered Data Analytics Tool"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

## Free AI Features (Groq — optional)

ONYX can use **Groq** for free AI-powered dashboard suggestions (Llama 3.3 70B model).

1. Go to **https://console.groq.com** and create a free account
2. Generate an API key
3. Create a file `backend/.env` with:

```
GROQ_API_KEY=gsk_your_key_here
```

That's it — the app will automatically use Groq for smarter dashboards. No credit card required.

### Alternative: OpenAI (paid)

If you prefer OpenAI, set these in `backend/.env` instead:

```
OPENAI_API_KEY=sk-your_key_here
OPENAI_MODEL=gpt-4o-mini
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(empty)* | Free — enables AI dashboard suggestions via Groq |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model to use |
| `OPENAI_API_KEY` | *(empty)* | Paid alternative — OpenAI API |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model to use |
| `JWT_SECRET_KEY` | `change-me` | Secret for auth tokens |
| `DATABASE_URL` | `sqlite:///./app.db` | Database connection |
| `STORAGE_DIR` | `./storage` | Uploaded file storage |

## Tech Stack

- **Frontend:** Vanilla JS, Plotly.js, GridStack
- **Backend:** Python, FastAPI, SQLModel, Pandas
- **Database:** SQLite
- **AI:** Groq (free) or OpenAI (paid) — optional
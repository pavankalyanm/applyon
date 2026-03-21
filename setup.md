# Local Development Setup

Stack: FastAPI backend · React/Vite frontend · MySQL database · Jobcook local agent

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js | LTS (18+) |
| MySQL | 8.0+ running locally |
| Google Chrome | Latest |

---

## 1. Clone the repo

```bash
git clone <YOUR_REPO_URL>
cd Auto_job_applier_linkedIn
```

---

## 2. Backend

### 2.1 Create virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows
```

### 2.2 Install dependencies

```bash
pip install -r requirements.txt
```

### 2.3 Create the database

```sql
CREATE DATABASE `easy-apply` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2.4 Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://root:PASSWORD@localhost:3306/easy-apply
JWT_SECRET=a-long-random-secret-string
```

### 2.5 Run migrations + start

```bash
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Migrations run automatically on startup. Health check: `curl http://localhost:8000/health`

---

## 3. Frontend

```bash
cd frontend
cp .env.example .env        # already set to http://localhost:8000
npm install
npm run dev                  # runs at http://localhost:5173
```

---

## 4. Jobcook Agent (local bot runner)

The Jobcook agent connects to the backend and runs the bot on your machine. The web app controls everything — start, stop, monitor — once the agent is connected.

### 4.1 Install in a separate venv

```bash
python3 -m venv .jobcook-venv
.jobcook-venv/bin/pip install -e .
.jobcook-venv/bin/pip install -r requirements.txt
```

Add a shell alias (one-time):

```bash
echo 'alias jobcook="/path/to/Auto_job_applier_linkedIn/.jobcook-venv/bin/jobcook"' >> ~/.zshrc
source ~/.zshrc
```

### 4.2 Login and start

```bash
jobcook login         # prompts for backend URL, email, password
jobcook start         # connects agent to backend
```

### 4.3 Auto-start on login (optional)

```bash
jobcook install-service
```

---

## 5. Environment Variables Reference

### backend/.env

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `mysql+pymysql://root:@localhost:3306/easy-apply` |
| `JWT_SECRET` | Secret for signing JWTs — change this | `change-me-in-production` |
| `JWT_EXPIRES_MIN` | Token expiry in minutes | `10080` (7 days) |
| `RESUME_STORAGE_DIR` | Where uploaded resumes are stored | `./storage/resumes` |
| `OPENAI_API_KEY` | Optional — injected into bot at run time | |
| `GROQ_API_KEY` | Optional — injected into bot at run time | |
| `DEEPSEEK_API_KEY` | Optional — injected into bot at run time | |
| `GEMINI_API_KEY` | Optional — injected into bot at run time | |

### frontend/.env

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend URL | `http://localhost:8000` |

---

## 6. Common Issues

| Problem | Fix |
|---|---|
| `pip: bad interpreter` | Use `python3 -m pip` or activate the right venv |
| DB connection error | Check `DATABASE_URL`, ensure MySQL is running and DB exists |
| CORS errors in browser | Check `VITE_API_BASE_URL` matches the running backend URL |
| Chrome not found | Install Chrome; run `jobcook status` to verify |
| `export_section() takes 2 args` | Fixed in `bot/config/_runtime.py` — pull latest |

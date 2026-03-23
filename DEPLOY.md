# AWS Deployment Guide

Architecture: EC2 (frontend + backend) · RDS MySQL (database)
Domain: applyflowai.com → EC2 (3.131.96.109) · SSL via Let's Encrypt

---

## Overview

```
Internet
   │
   ▼
EC2 Instance (Ubuntu 22.04)
   ├── Nginx  :80/:443   → serves React build + proxies /api → uvicorn
   └── Uvicorn :8000     → FastAPI backend

RDS MySQL  (private, only reachable from EC2)
```

---

## Part 1 — RDS MySQL Setup

### 1.1 Create RDS instance

1. Go to **RDS → Create database**
2. Engine: **MySQL 8.0**
3. Template: **Free tier** (for testing) or **Production**
4. Settings:
   - DB instance identifier: `applyflowai-db`
   - Master username: `admin`
   - Master password: choose a strong password
5. Instance class: `db.t3.micro` (free tier)
6. Storage: 20 GB gp2
7. **VPC**: same VPC as your EC2
8. **Public access**: **No** (only EC2 should reach it)
9. Create

### 1.2 Note the endpoint

After creation, note the **Endpoint** (looks like `applyflowai-db.xxxx.us-east-1.rds.amazonaws.com`).

### 1.3 Security group for RDS

1. Go to the RDS instance → **Security → VPC security groups**
2. Edit inbound rules → Add rule:
   - Type: **MySQL/Aurora**
   - Port: **3306**
   - Source: **Security group of your EC2 instance**

---

## Part 2 — EC2 Instance Setup

### 2.1 Launch EC2

1. Go to **EC2 → Launch instance**
2. Name: `applyflowai-server`
3. AMI: **Ubuntu Server 22.04 LTS**
4. Instance type: `t3.small` (2 vCPU, 2GB RAM — minimum for this stack)
5. Key pair: create or select existing
6. Security group — add inbound rules:

| Port | Protocol | Source    | Purpose                                   |
| ---- | -------- | --------- | ----------------------------------------- |
| 22   | TCP      | Your IP   | SSH                                       |
| 80   | TCP      | 0.0.0.0/0 | HTTP (frontend)                           |
| 8000 | TCP      | 0.0.0.0/0 | Backend API (for Jobcook agent WebSocket) |

7. Storage: 20 GB gp3
8. Launch

### 2.2 SSH into the instance

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## Part 3 — Server Setup

Run all commands on the EC2 instance.

### 3.1 Update system + install dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx python3.12 python3.12-venv python3-pip mysql-client
```

Install Node.js (LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 Clone the repo

```bash
cd /home/ubuntu
git clone <YOUR_REPO_URL> app
cd app
```

### 3.3 Create the database on RDS

```bash
mysql -h <RDS_ENDPOINT> -u admin -p
```

```sql
CREATE DATABASE `applyon` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

---

## Part 4 — Backend Setup

### 4.1 Create venv and install dependencies

```bash
cd /home/ubuntu/app
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4.2 Create .env

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in the values (see reference below):

```env
DATABASE_URL=mysql+pymysql://admin:YOUR_RDS_PASSWORD@YOUR_RDS_ENDPOINT:3306/applyon
JWT_SECRET=replace-with-long-random-string
JWT_EXPIRES_MIN=10080
RESUME_STORAGE_DIR=/home/ubuntu/app/storage/resumes
CORS_ORIGINS=https://applyflowai.com
```

Create resume storage dir:

```bash
mkdir -p /home/ubuntu/app/storage/resumes
```

### 4.3 Run migrations

```bash
cd /home/ubuntu/app
source .venv/bin/activate
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
# Wait for "Application startup complete" then Ctrl+C
```

### 4.4 Create systemd service for backend

```bash
sudo nano /etc/systemd/system/applyflowai-backend.service
```

Paste:

```ini
[Unit]
Description=applyon FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/app
ExecStart=/home/ubuntu/app/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/app/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable applyflowai-backend
sudo systemctl start applyflowai-backend
sudo systemctl status applyflowai-backend   # should show "active (running)"
```

---

## Part 5 — Frontend Setup

### 5.1 Build the frontend

```bash
cd /home/ubuntu/app/frontend
cp .env.example .env
```

Edit `.env` — set the backend URL to the EC2 public IP:

```env
VITE_API_BASE_URL=https://applyflowai.com/api
```

> Note: use port 8000 directly since Nginx will proxy the frontend on port 80
> and the backend is exposed on 8000 for the Jobcook agent WebSocket.

```bash
npm install
npm run build          # outputs to frontend/dist/
```

### 5.2 Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/applyon
```

Paste:

```nginx
server {
    listen 80;
    server_name applyflowai.com www.applyflowai.com;

    # Serve React frontend
    root /home/ubuntu/app/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/applyon /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## Part 6 — Verify Deployment

```bash
# Backend health
curl http://localhost:8000/health
# → {"status":"ok"}

# Frontend (from your local machine)
curl https://applyflowai.com/
# → HTML of the React app
```

---

## Part 7 — Update the install.sh for production

Edit `install.sh` and update `REPO_URL` to your actual GitHub repo URL.

The Jobcook agent on user machines will connect to:

```
wss://applyflowai.com/agent/ws
```

The frontend URL users visit:

```
https://applyflowai.com
```

---

## Part 8 — Deploying Updates

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd /home/ubuntu/app
git pull

# Restart backend
sudo systemctl restart applyflowai-backend

# Rebuild frontend if changed
cd frontend
npm run build

# Migrations run automatically on backend restart
```

---

## Environment Variables Reference (Production)

### backend/.env

| Variable             | Description                       | Example                                                |
| -------------------- | --------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`       | RDS connection string             | `mysql+pymysql://admin:pass@rds-endpoint:3306/applyon` |
| `JWT_SECRET`         | Long random string — keep secret  | `openssl rand -hex 32`                                 |
| `JWT_EXPIRES_MIN`    | Token expiry (minutes)            | `10080`                                                |
| `RESUME_STORAGE_DIR` | Absolute path for resume uploads  | `/home/ubuntu/app/storage/resumes`                     |
| `CORS_ORIGINS`       | Allowed origins (comma separated) | `https://applyflowai.com`                               |
| `OPENAI_API_KEY`     | Optional AI provider key          |                                                        |
| `GROQ_API_KEY`       | Optional AI provider key          |                                                        |

### frontend/.env (build time)

| Variable            | Description                 | Example                       |
| ------------------- | --------------------------- | ----------------------------- |
| `VITE_API_BASE_URL` | Backend URL seen by browser | `https://applyflowai.com:8000` |

---

## Security Checklist

- [ ] `JWT_SECRET` is a long random string (not `change-me-in-production`)
- [ ] RDS is **not** publicly accessible — only EC2 security group allowed on port 3306
- [ ] Port 22 SSH is restricted to your IP, not `0.0.0.0/0`
- [ ] `backend/.env` is in `.gitignore` — never committed
- [ ] Resume storage dir has correct permissions: `chmod 750 /home/ubuntu/app/storage/resumes`

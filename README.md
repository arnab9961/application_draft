# AI Job Application Automation System

A private, personal AI-powered job application tool. Upload a job circular, auto-generate a personalized email, review it, and send only after your explicit approval.

**The most important rule: No email is ever sent without your explicit "Approve & Send" click.**

---

## Architecture

```
Vercel (Next.js frontend) ──► VPS (FastAPI backend) ──► Supabase (DB + Storage)
                                                    ──► GroqCloud (AI)
                                                    ──► Gmail API
```

The FastAPI backend runs on your VPS because it handles long-running tasks (PDF OCR, AI generation) that exceed Vercel's 10-second serverless timeout. The Next.js frontend is deployed to Vercel.

---

## Quick Start

### 1. Clone and navigate

```bash
git clone <your-repo>
cd "job application draft"
```

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Go to **Storage → New bucket** → name it `private-documents`, set to **Private**
4. Go to **Authentication → Users** → create your user account
5. Note your **Project URL**, **anon key**, and **service_role key** from Settings → API

### 3. Supabase Auth — Restrict to your email only

In **Authentication → Settings**:
- Disable public signups (set "Disable signup" to ON)
- This means only you (already created above) can authenticate

Your backend also enforces `AUTHORIZED_USER_EMAIL` — a second layer of protection.

### 4. Backend Setup (VPS)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Install Tesseract OCR (for image-based job circulars)
# Ubuntu/Debian:
sudo apt-get install tesseract-ocr

# Copy and fill in environment variables
cp .env.example .env
nano .env  # Fill in all required values

# Run the backend (development)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Production (with gunicorn or systemd)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

#### Backend `.env` values to fill in:

| Variable | Description |
|---|---|
| `APP_SECRET_KEY` | Random 64-char secret |
| `AUTHORIZED_USER_EMAIL` | Your email — only this account can use the app |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only, never exposed to browser) |
| `GROQ_API_KEY` | Your GroqCloud API key from console.groq.com |
| `GROQ_MODEL` | e.g. `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-backend.com/api/gmail/callback` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ORIGINS` | `https://your-app.vercel.app,http://localhost:3000` |

### 5. Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g. "Job App Assistant")
3. Enable **Gmail API**: APIs & Services → Library → Gmail API → Enable
4. Configure **OAuth Consent Screen**:
   - Choose External
   - App name, support email
   - Add scope: `https://www.googleapis.com/auth/gmail.send`
   - Add your email as a **Test user**
5. Create **OAuth 2.0 Credentials**:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-backend.com/api/gmail/callback`
6. Download or copy **Client ID** and **Client Secret** to your `.env`

> **Note:** Keep the app in "Testing" mode — it only needs to work for your account.

### 6. Frontend Setup (Vercel)

```bash
cd frontend

# Local development
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

npm install
npm run dev
```

**Deploy to Vercel:**
1. Push to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your VPS backend URL, e.g. `https://api.yourdomain.com`)
4. Deploy

---

## Security Model

- **Single-user enforcement**: Backend checks `AUTHORIZED_USER_EMAIL` on every request
- **Supabase Auth**: Signup disabled; only your pre-created account works
- **RLS policies**: Every table is protected — all records scoped to `auth.uid()`
- **No public API keys**: Service-role key stays on backend only
- **Gmail tokens**: Stored encrypted in DB, accessible only via service-role
- **Approval binding**: Every approval is cryptographically bound to exact recipient + subject + body + attachment. Any edit invalidates it
- **Idempotency**: Duplicate send requests are detected and blocked at the database level
- **SSRF protection**: URL fetcher blocks all private IPs, localhost, and redirect chains

---

## Testing

```bash
cd backend
source venv/bin/activate
pip install pytest pytest-asyncio
pytest tests/ -v
```

---

## Supported Job Circular Formats

| Format | How it's processed |
|---|---|
| PDF | PyMuPDF text extraction |
| DOCX | python-docx text extraction |
| PNG / JPG / WebP | Tesseract OCR |
| Plain text | Direct |
| URL | Server-side fetch (SSRF-safe) |

---

## Application Workflow

```
Upload circular ──► Extract text ──► Groq parses job info
                                          │
                                          ▼
                                  AI generates email
                                          │
                                          ▼
                                  You review & edit
                                          │
                                          ▼
                                  Approve (hash bound)
                                          │
                                          ▼
                                  Confirm dialog
                                          │
                                          ▼
                                  Gmail sends email
                                          │
                                          ▼
                                  Result recorded in DB
```

---

## Maintenance

- Update `GROQ_MODEL` in `.env` to use a newer model — no code changes needed
- Add new CV versions in the Profile → CV Documents tab
- View all send history in Application History
- Gmail token is refreshed automatically via the Google client library

---

## FAQ

**Q: Can the AI send email on its own?**
A: No. The AI is a text generator only. It has no access to Gmail. Only the backend `/api/drafts/send` endpoint triggers Gmail, and it requires a valid approval record with matching version + content hash.

**Q: What if Groq is rate-limited?**
A: The backend retries 3 times with exponential backoff, then returns a clear error. No silent fallback.

**Q: What if my VPS goes down mid-send?**
A: The send operation status is persisted in Supabase before and after the Gmail call. On retry, the idempotency key prevents duplicate sends.

**Q: Is my CV stored securely?**
A: CVs are stored in a private Supabase Storage bucket. Only your backend (via service-role key) can read them. RLS prevents any other access.

# AgentFoxx - Replit Deployment

AI-powered conference networking agent that captures conversations, identifies themes, and automates follow-ups via Outreach.io.

## Architecture

**Replit** hosts the AgentFoxx microsite (React frontend + Node.js backend + SQLite database).  
**n8n** orchestrates the AI workflow (OpenAI Whisper transcription → GPT-4o email drafting → Outreach.io prospect creation).

## Prerequisites

1. **Replit account** (free tier works, but Hacker plan $7/month recommended for always-on)
2. **n8n instance** (n8n Cloud $26/month or self-hosted)
3. **OpenAI API key** ($5 minimum deposit)
4. **Outreach.io account** with API access

## Deployment Steps

### 1. Import to Replit

1. Go to [replit.com](https://replit.com) and sign in
2. Click **Create Repl** → **Import from GitHub** (or upload this folder as a ZIP)
3. Replit will auto-detect Node.js and configure the environment

### 2. Install Dependencies

Replit will automatically run `npm install` when you open the project. If not, run:

```bash
npm run setup
```

This installs backend dependencies and builds the React frontend.

### 3. Configure Environment Variables

1. In Replit, go to **Tools** → **Secrets** (or the lock icon in the sidebar)
2. Add the following secrets:

| Key | Value | Description |
|-----|-------|-------------|
| `N8N_WEBHOOK_URL` | `https://your-n8n-instance.app.n8n.cloud/webhook/agentfoxx` | n8n webhook URL (see step 4) |
| `NODE_ENV` | `production` | Node environment |

### 4. Deploy n8n Workflow

1. Sign up for [n8n Cloud](https://n8n.io/cloud/) or self-host n8n
2. Import the workflow JSON file: `n8n_agentfoxx_workflow.json`
3. Configure credentials in n8n:
   - **OpenAI Account** → Add your OpenAI API key
   - **Outreach.io OAuth2 API** → Connect your Outreach account
   - **HTTP Request** → Set the callback URL to your Replit URL + `/api/activities/{activityId}`
4. Activate the workflow
5. Copy the webhook URL from the **Webhook** node
6. Paste it into Replit's `N8N_WEBHOOK_URL` secret

### 5. Start the Server

Click the **Run** button in Replit. The server will start on port 3000.

You should see:
```
AgentFoxx server running on port 3000
Connected to SQLite database
Activities table ready
```

### 6. Test the Workflow

1. Open the Replit preview URL (e.g., `https://agentfoxx-yourname.replit.app`)
2. Click **Start Recording** → record a 10-second test conversation
3. Click **Finish & Submit to n8n**
4. Check the **Dashboard** tab to see the activity appear
5. Check n8n execution logs to verify the workflow ran successfully

## Project Structure

```
agentfoxx-replit/
├── server.js                 # Node.js backend (Express + SQLite)
├── package.json              # Backend dependencies
├── .replit                   # Replit configuration
├── .env.example              # Environment variables template
├── agentfoxx.db              # SQLite database (auto-created)
├── uploads/                  # Audio file storage (auto-created)
├── client/                   # React frontend
│   ├── src/
│   │   ├── pages/            # Home, Dashboard, HowItWorks, Guide
│   │   ├── components/       # Layout, UI components
│   │   ├── lib/              # Utilities
│   │   └── index.css         # Global styles
│   ├── public/               # Static assets
│   ├── index.html            # HTML template
│   └── package.json          # Frontend dependencies
└── n8n_agentfoxx_workflow.json  # n8n workflow template
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload-audio` | Upload audio file, trigger n8n workflow |
| `GET` | `/api/activities` | Get all activities for dashboard |
| `GET` | `/api/activities/:id` | Get single activity by ID |
| `PUT` | `/api/activities/:id` | Update activity (called by n8n) |
| `GET` | `/api/stats` | Get dashboard statistics |

## Database Schema

**activities** table:
- `id` (INTEGER PRIMARY KEY)
- `contact_name` (TEXT)
- `contact_email` (TEXT)
- `company` (TEXT)
- `theme` (TEXT) - AI-identified theme (e.g., "fraud prevention")
- `transcript` (TEXT) - Whisper transcription
- `email_draft` (TEXT) - GPT-4o generated email
- `outreach_prospect_id` (TEXT) - Outreach.io prospect ID
- `outreach_sequence_id` (TEXT) - Outreach.io sequence ID
- `status` (TEXT) - `pending`, `processing`, `completed`, `failed`
- `created_at` (DATETIME)

## n8n Workflow

The workflow JSON (`n8n_agentfoxx_workflow.json`) includes:

1. **Webhook** - Receives audio URL and contact info from Replit
2. **HTTP Request** - Downloads audio file
3. **OpenAI Whisper** - Transcribes audio to text
4. **Code (Theme Extraction)** - Parses transcript for key themes
5. **OpenAI GPT-4o** - Drafts personalized follow-up email
6. **Outreach Create Prospect** - Creates prospect in Outreach.io
7. **Outreach Enroll in Sequence** - Adds prospect to theme-specific sequence
8. **HTTP Request** - Posts results back to Replit `/api/activities/:id`

## Troubleshooting

**Audio upload fails:**
- Check file size (max 50MB)
- Verify file format (webm, mp4, wav, mp3, m4a)
- Check Replit logs for errors

**n8n workflow not triggering:**
- Verify `N8N_WEBHOOK_URL` secret is set correctly
- Check n8n workflow is activated
- Test webhook URL manually with curl/Postman

**Dashboard shows no data:**
- Check SQLite database was created: `ls -la agentfoxx.db`
- Query database manually: `sqlite3 agentfoxx.db "SELECT * FROM activities;"`
- Check browser console for API errors

**Outreach.io integration fails:**
- Verify OAuth2 credentials in n8n
- Check Outreach API rate limits (60 requests/minute)
- Ensure prospect email is valid and not duplicate

## Cost Breakdown (100 meetings/month)

| Service | Cost |
|---------|------|
| Replit Hacker Plan | $7/month (always-on) |
| n8n Cloud | $26/month |
| OpenAI API (Whisper + GPT-4o) | ~$8/month |
| **Total** | **$41/month** |

**Free tier option:** Use Replit free tier + self-host n8n on Replit = $15/month (OpenAI only)

## Next Steps

1. **Test with real meetings** - Record actual conference conversations
2. **Create Outreach sequences** - Build 5 theme-specific email sequences (fraud prevention, compliance, etc.)
3. **Add white paper library** - Upload PDFs to Replit and link them in the n8n workflow
4. **Enable Salesforce sync** - Connect Outreach.io to Salesforce for automatic lead creation
5. **Deploy to custom domain** - Use Replit's custom domain feature ($7/month included in Hacker plan)

## Support

For issues or questions:
- Replit: [docs.replit.com](https://docs.replit.com)
- n8n: [docs.n8n.io](https://docs.n8n.io)
- Outreach API: [developers.outreach.io](https://developers.outreach.io)

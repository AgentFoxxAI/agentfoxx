# AgentFoxx - AI Conference Networking Agent

## Overview
AgentFoxx helps conference attendees capture voice memos after conversations, which are automatically transcribed, classified, and turned into personalized follow-up emails via an n8n workflow. The Replit app serves as the frontend microsite and human-in-the-loop approval layer.

## Architecture
- **Frontend**: React + TypeScript + Vite + Shadcn UI + TanStack Query
- **Backend**: Express.js (ESM) on port 5000
- **Database**: PostgreSQL via Drizzle ORM
- **External**: n8n workflow (Whisper transcription → GPT-4o classification → Outreach.io email)

## Database Tables
- `activities` - Voice memo submissions (contact info, audio URL, processing status)
- `reviews` - Human approval queue (email drafts from n8n awaiting approve/reject)
- `attendees` - Conference attendee list for name autocomplete (fullName, email, company)

## Key Routes
### Activities
- `POST /api/upload-audio` - Multipart form upload (multer), creates activity, triggers n8n webhook
- `GET /api/activities` - List all activities
- `GET /api/activities/:id` - Get single activity
- `PUT /api/activities/:id` - Update activity (used by n8n callback)
- `GET /api/stats` - Dashboard statistics

### Reviews (Human Approval Flow)
- `POST /api/reviews` - n8n sends review package here (transcript, email draft, classification)
- `GET /api/reviews` - List all reviews
- `GET /api/reviews/:id` - Get single review
- `PATCH /api/reviews/:id` - Update review fields
- `POST /api/reviews/:id/decide` - Approve or reject a review (server-side POST to n8n resumeUrl)

### Attendees (Autocomplete)
- `GET /api/attendees/search?q=<query>` - Search attendees by name (for autocomplete)
- `GET /api/attendees/count` - Get total attendee count
- `POST /api/attendees/upload` - Upload CSV to replace attendee list (multipart form, field: file)
- `DELETE /api/attendees` - Clear all attendees

## Frontend Pages
- `/` - Home: voice recorder + contact form with name autocomplete from attendee list
- `/reviews` - Approval Queue: list of pending/approved/rejected reviews
- `/reviews/:id` - Review Detail: editable email draft with Approve/Reject buttons
- `/dashboard` - Stats KPIs + activities table
- `/how-it-works` - Static explainer page
- `/settings` - Attendee list management (CSV upload, clear list, count display)

## Important Implementation Details
- Audio upload uses `multipart/form-data` with multer (not JSON)
- The n8n resume callback (resumeUrl) is called **server-side** from Express to avoid CORS issues
- ESM imports throughout (`import express from 'express'`, not `require`)
- Drizzle schema uses `serial` PKs and `text` columns (confidence stored as text)
- Sidebar uses Shadcn sidebar component with light theme matching the main app

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session secret
- `N8N_WEBHOOK_URL` - n8n webhook URL to trigger the AI processing workflow

## Commands
- `npm run dev` - Start dev server (Express + Vite)
- `npm run db:push` - Sync Drizzle schema to PostgreSQL

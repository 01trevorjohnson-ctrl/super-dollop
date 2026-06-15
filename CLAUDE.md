# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web app that lets users enter a stock ticker, browse that company's SEC filings from EDGAR, and interrogate the filing documents using Claude (streaming chat, full document as context).

## Commands

```bash
npm install          # install dependencies
npm start            # production start (node server.js)
npm run dev          # development with --watch (auto-restart on file changes)
```

Copy `.env.example` to `.env` and fill in all values before running.

## Architecture

**Single-process Express app** — serves static frontend and provides three API routes.

```
server.js               # entry point: mounts routes, serves public/
src/
  lib/
    edgar.js            # SEC EDGAR API client (ticker→CIK, submissions, document fetch + HTML strip)
    anthropic.js        # Anthropic SDK client singleton
    supabase.js         # Supabase client singleton (null if env vars missing — caching degrades gracefully)
  routes/
    filings.js          # GET /api/filings?ticker=  and  GET /api/filings/document?...
    quotes.js           # GET /api/quotes?ticker=  (Yahoo Finance, ESM via dynamic import)
    chat.js             # POST /api/chat  (streams SSE back to client)
public/
  index.html            # single-page shell
  style.css
  app.js                # all frontend logic (vanilla JS, no framework)
supabase/
  schema.sql            # run once in Supabase SQL editor to create tables
```

### Data flow

1. User enters ticker → `GET /api/filings` → EDGAR ticker map + submissions JSON → filing list
2. User clicks a filing → `GET /api/filings/document` → EDGAR HTML fetched, stripped to plain text, truncated at 300k chars, cached in Supabase
3. User asks a question → `POST /api/chat` → filing text (up to 150k chars) sent as Claude system context → SSE stream back to browser
4. Frontend reads SSE chunks and appends text in real time

### Key constraints

- **EDGAR User-Agent**: SEC TOS requires `EDGAR_UA` env var set to `"Name email@example.com"`. The value is sent as the `User-Agent` header on all EDGAR requests.
- **yahoo-finance2 is ESM-only**: the quotes route uses `await import('yahoo-finance2')` with a module-level singleton to avoid the overhead on every request.
- **Supabase is optional**: if `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are missing, caching is skipped and the app re-fetches from EDGAR each time. All Supabase calls are guarded with `if (db)`.
- **Filing text truncation**: documents are capped at 300k chars before storage and at 150k chars when passed to Claude (to stay well within the context window while leaving room for conversation history).
- **Conversation history**: stored in Supabase `conversations` table keyed by a UUID in `localStorage` (`sd_session`). One row per browser session, overwritten on each message.

### Supabase tables

| Table | Purpose |
|---|---|
| `ticker_cik_map` | Ticker → EDGAR CIK + company name cache |
| `cached_filings` | Filing plaintext keyed by `accession_number` |
| `conversations` | Full message history per browser session |

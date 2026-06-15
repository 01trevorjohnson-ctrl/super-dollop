-- Run this in your Supabase SQL editor to set up the required tables.

-- Maps ticker symbols to SEC EDGAR CIK numbers (cached to avoid re-fetching)
create table if not exists ticker_cik_map (
  ticker       text primary key,
  cik          text not null,
  company_name text,
  fetched_at   timestamptz default now()
);

-- Caches stripped plaintext of fetched SEC filing documents
create table if not exists cached_filings (
  accession_number text primary key,
  ticker           text,
  form_type        text,
  document_text    text,
  cached_at        timestamptz default now()
);

-- Stores conversation history per browser session
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null unique,
  ticker           text,
  filing_accession text,
  messages         jsonb default '[]',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists conversations_session_idx on conversations(session_id);

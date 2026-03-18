# AgentFoxx Conference Attendance Database — Schema & Scraping Pipeline

## Scope Constraints

**Time window**: Jan 2022 → present (post-COVID return to in-person events)
**Conference types**: Financial services, fintech, fraud/risk, identity, payments, regtech, banking — basically your ICP's event circuit
**Starter list**: ~50-100 marquee events first, expand later

---

## Database Schema

```sql
-- CONFERENCES: the events themselves
CREATE TABLE conferences (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,           -- "Money20/20 USA"
  slug          TEXT UNIQUE,             -- "money2020-usa-2024"
  year          INT,
  city          TEXT,
  country       TEXT,
  start_date    DATE,
  end_date      DATE,
  website_url   TEXT,
  category      TEXT[],                  -- ["fintech","payments","fraud"]
  est_attendees INT,                     -- rough size: 500, 5000, 10000+
  tier          TEXT,                    -- "tier1", "tier2", "tier3"
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CONTACTS: people in the system
CREATE TABLE contacts (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT,
  company       TEXT,
  title         TEXT,
  linkedin_url  TEXT,
  apollo_id     TEXT,                    -- if enriched via Apollo
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ATTENDANCE: the join — who was where, in what capacity
CREATE TABLE attendance (
  id            SERIAL PRIMARY KEY,
  contact_id    INT REFERENCES contacts(id),
  conference_id INT REFERENCES conferences(id),
  role          TEXT,                    -- "attendee","speaker","panelist","exhibitor","sponsor","organizer"
  confidence    TEXT,                    -- "confirmed","likely","inferred"
  source        TEXT,                    -- "agentfoxx","linkedin","conference_site","badge_scan","social_media"
  source_url    TEXT,                    -- proof link
  notes         TEXT,
  scraped_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, conference_id, role)
);

-- CONFERENCE_SESSIONS: talks/panels (links speakers to specific sessions)
CREATE TABLE sessions (
  id            SERIAL PRIMARY KEY,
  conference_id INT REFERENCES conferences(id),
  title         TEXT,
  track         TEXT,                    -- "fraud","payments","AI"
  session_date  DATE,
  speakers      TEXT[]                   -- names for quick matching before contact_id resolution
);
```

---

## Scraping Pipeline — 6 Sources

### Source 1: Conference Websites (speakers, sponsors, exhibitors)
```
Target:       Event agenda pages, speaker directories, sponsor/exhibitor lists
Example URLs: money2020.com/speakers, finovate.com/agenda
Data yield:   Speaker name, title, company, session title, headshot URL
Confidence:   CONFIRMED
Tools:        Puppeteer/Playwright (many are JS-rendered), BeautifulSoup for static
Frequency:    Once per event (scrape ~2 weeks before + archive after)
Volume:       ~50-200 speakers per event × 100 events = 5K-20K records
```

### Source 2: LinkedIn Activity
```
Target:       Posts mentioning conference names, hashtags, check-ins
Search:       "#Money2020" OR "excited to attend Money20/20" OR "great seeing everyone at Money20/20"
Data yield:   Person name, company, attendance confirmation
Confidence:   LIKELY (posted about it) or CONFIRMED (photo/badge)
Tools:        LinkedIn Sales Navigator search, Apollo people search with keyword filters
Frequency:    Rolling — scrape during/after each major event
Volume:       High but noisy — filter aggressively
Caveat:       LinkedIn TOS — use API/Sales Nav, not raw scraping
```

### Source 3: AgentFoxx Own Data (highest quality)
```
Target:       Your own app's recordings and contact entries
Data yield:   Contact name, company, email, conference name, date — all confirmed
Confidence:   CONFIRMED
Pipeline:     Auto-populate attendance table whenever a new recording is processed
Volume:       Grows with usage — this is your moat
```

### Source 4: Social Media Signals (Twitter/X)
```
Target:       Tweets with conference hashtags, location tags
Search:       "#MRC2024" OR "at @Money2020" OR "Vegas for Authenticate"
Data yield:   Twitter handle → match to contact via name/company
Confidence:   LIKELY
Tools:        Twitter/X API (Basic tier), or third-party like Apify
Frequency:    Real-time during events, batch after
Volume:       Moderate — not everyone tweets
```

### Source 5: Public Attendee/Exhibitor Lists
```
Target:       Some conferences publish partial attendee lists, all publish exhibitor/sponsor lists
Example:      RSA Conference exhibitor directory, MRC member list
Data yield:   Company name (sometimes individuals), booth info, sponsor tier
Confidence:   CONFIRMED (for companies), INFERRED (for individuals at those companies)
Tools:        BeautifulSoup, PDF extraction (some publish as PDF)
Volume:       Exhibitors: 50-500 per event
```

### Source 6: Press/Media Coverage
```
Target:       Event recap articles, "top 10 takeaways from X conference" blog posts
Data yield:   Mentioned speakers, quoted attendees, company references
Confidence:   LIKELY
Tools:        Google News API, web scraping of industry blogs (Finovate blog, PaymentsJournal, etc.)
Volume:       Low but high-signal — mentioned people are usually senior
```

---

## Starter Conference List (Tier 1 — scrape these first)

| Event | Category | ~Size | Freq |
|-------|----------|-------|------|
| Money20/20 USA & Europe | Fintech/payments | 10K+ | Annual |
| Finovate (Fall, Spring, Europe) | Fintech | 1-2K | 3x/yr |
| MRC (Merchant Risk Council) Vegas & Europe | Fraud/risk | 2-5K | 2x/yr |
| RSA Conference | Security/identity | 40K+ | Annual |
| Authenticate (FIDO Alliance) | Identity/auth | 1K | Annual |
| LendIt Fintech USA | Lending/fintech | 3K | Annual |
| BAI Global Banking Conference | Banking | 2K | Annual |
| ACAMS (Anti-Money Laundering) | AML/compliance | 3K | Annual |
| Gartner Security & Risk | Risk/security | 3K | Annual |
| KNOW Identity (OWI) | Identity | 1K | Annual |
| IdentityWeek | Identity | 3K | Annual |
| Seamless (Middle East, Asia) | Payments | 10K+ | Annual |

---

## Scraping Game Plan — Phased

**Phase 1 — Seed the conferences table** (1 day)
Manually enter 50-100 conferences from 2022-present with basic metadata. Pull from your own experience + industry event calendars.

**Phase 2 — Speakers & sponsors scrape** (1-2 weeks)
Hit conference websites for speaker directories and exhibitor lists. This is the highest-signal, most structured data. Start with Tier 1 events.

**Phase 3 — LinkedIn/Apollo enrichment** (ongoing)
For contacts already in your system (from AgentFoxx recordings), enrich with conference-related LinkedIn activity. Apollo's "recent activity" data may surface event mentions.

**Phase 4 — Social media backfill** (batch job)
Search Twitter/X archives for conference hashtags from 2022-present. Match handles to known contacts.

**Phase 5 — Live pipeline** (automated)
Wire up AgentFoxx to auto-populate attendance records with every new recording. Add a conference selector to the recording flow so users tag which event they're at.

---

## Key Questions to Decide Before Scraping

1. **Host this where?** Supabase (you already have it), separate Postgres, or extend the existing Replit DB?
2. **How to handle company-level vs person-level attendance?** (e.g., "Visa sponsored MRC" vs "John from Visa attended MRC")
3. **Do you want to track booth/sponsor tier?** (Gold, Platinum, etc. — signals budget)
4. **Privacy/compliance** — storing scraped personal data has GDPR implications if you're tracking EU contacts
5. **Conference name normalization** — "Money20/20" vs "Money 20/20" vs "Money2020 USA 2024" all need to resolve to the same event

# Key decisions

Short notes on the choices that shaped the project, and why.

### 1. Own Supabase project instead of Lovable Cloud

The prototype started on Lovable Cloud, but every database change there goes through Lovable's chat, which costs credits. The backend therefore runs on a free Supabase project the app owner controls, with SQL applied by `bun run db:apply`. The app can still run on Lovable by setting two secrets (`APP_SUPABASE_*`).

### 2. Server-only data access, no sign-in

This is a shared demo with fictional data. Instead of user accounts, the database is locked so only server code can touch it, and every change goes through a small set of validated actions. That limits _what_ can be changed, not _who_; sign-in is the next step before real data.

### 3. Every action is one database transaction

Each action (status change, reply, follow-up, risk) is a Postgres function that saves the change and its timeline entry together, so the timeline can never disagree with the data. Sending a reply saves the message and clears the draft in one step.

### 4. A shared draft with a revision number

Drafts autosave half a second after typing stops. Sending a reply bumps `draft_revision`, so a slow draft save that arrives afterwards is ignored instead of bringing the sent text back.

### 5. Prioritisation from saved data, explained in plain words

Accounts are ranked by issue severity, repeat problems, overdue commitments, renewal proximity and customer impact, not contract value. The score itself is hidden because the number alone wasn't meaningful; the reasons are shown instead. An urgent ticket always flags an account, and the Overview focuses on High-risk accounts.

### 6. One AI briefing instead of classification

An early "classify urgency and category" feature added little value on short tickets. It was replaced by one request per ticket that reads the ticket in its account context and returns short labelled facts, next steps and a reply. It is saved, refreshes after Send, and has daily and per-ticket limits to keep it free.

### 7. Gemini Flash-Lite on the free tier

With a free key, the larger models were overloaded or took around 40 seconds. Flash-Lite answers in about a second and handles short briefings well. The `-latest` alias survives model retirements.

### 8. Real dates, demo data moved forward

Ranking, renewals and overdue checks use today's date. The demo data was moved forward once so it relates to the present the same way it did to the original demo date.

## Development history

1. **Prototype** built in Lovable: screens and in-browser demo data.
2. **Database** designed and created, with access locked to the server.
3. **Screens connected** to saved data; every action persisted with business rules.
4. **Own Supabase project** set up after Lovable credits ran out.
5. **AI briefing** added with Gemini, then shortened to labelled points.
6. **Workflow refined**: Mara owns everything, clearer ticket priorities and statuses, realistic demo content.
7. **Clean-up**: unused template code removed, names clarified, code formatted, CI added.

# Security

## Reporting a problem

If you find a security issue, please don't open a public issue. Contact the maintainer directly through GitHub ([@klementinadzo](https://github.com/klementinadzo)) with a short description and how to reproduce it.

## How secrets are handled

- Secrets (the Supabase secret key, the database connection string and the AI key) live only in the git-ignored `.env.local`, or as server secrets on the hosting platform. They are never committed and never sent to the browser.
- `.env` is committed and contains only public values (project URL and publishable key).
- All database tables are locked: the public key gets "permission denied", and only server code with the secret key can read or write.

## If a secret leaks

Rotate it straight away; deleting it from git is not enough, because it stays in the history.

- **Supabase secret key:** Project Settings → API Keys → create a new secret key, update `.env.local`, delete the old key.
- **Database password:** Project Settings → Database → reset the password, update `SUPABASE_DB_URL`.
- **Gemini key:** Google AI Studio → API keys → delete it and create a new one.

## Known limitation

This is a shared demo without sign-in: anyone with the app link can change the fictional data. Do not use it with real customer data.

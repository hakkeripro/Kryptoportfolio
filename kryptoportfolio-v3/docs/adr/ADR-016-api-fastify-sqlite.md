# ADR-016 API stack: Fastify + SQLite

**Status:** Accepted

Valitaan **Fastify** selkeän HTTP-layerin ja plugin-ekosysteemin vuoksi.
Tietokannaksi valitaan **SQLite** (yksinkertainen deploy, riittää single-tenant/solo-käyttöön).

- SQLite file: `apps/api/data/app.db`
- Migrations: ajettavat startupissa.

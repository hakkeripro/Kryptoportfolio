# ADR-002 Ledger append-only + audit trail

**Status:** Accepted

Kaikki muutokset toteutetaan lisäämällä uusia tapahtumia.
Muokkaus UI:ssa = soft-delete vanha + replacement-event (`replacesEventId`).

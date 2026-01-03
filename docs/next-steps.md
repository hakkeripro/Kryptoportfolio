# Next steps

## Next release (recommended)

1. **Asset catalog mapping UX**
   - “Unmapped assets” queue in UI
   - Manual mapping to provider id (coingeckoId). No symbol guessing.

2. **Autosync polish (Coinbase)**
   - Foreground autosync status (last run, last commit, last error)
   - Cursor strategy + dedupe telemetry
   - Better retry/backoff and rate limit UI messaging

3. **Server alerts (opt-in) end-to-end**
   - Export portfolio mirror state (prices, totals, positions)
   - Server evaluation runner + push send
   - Trigger log UI & settings

4. **Performance & UX**
   - Incremental derived rebuild (avoid full rebuild on every small change)
   - Virtualize large lists (ledger)
   - Offline “cached” indicators in dashboard

- Treidausbot (MEXC) paper trading -> opt-in -> live trade (kill switch + audit)
- Laajenna importteja (lisää pörssejä ja chain-lähteitä)
- Lisää tax profiles (maakohtaiset raporttipohjat ja säännöt)

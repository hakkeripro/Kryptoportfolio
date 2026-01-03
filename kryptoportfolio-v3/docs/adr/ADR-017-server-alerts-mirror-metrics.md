# ADR-017 Server-side alerts mirror-metrics

**Status:** Accepted

Koska Sync on E2E-salattu (ciphertext-only), server-side alerts runner vaatii opt-inin ja erillisen **mirror metrics** -kanavan.

Client lähettää minimaalisen, ei-transaction-tasoisen tilan (esim. portfolioValueBase, currentPrices, allocations, positions) serverille alert-evaluointia varten.
Tätä dataa ei käytetä synkkaan eikä ledgeriä rekonstruoida serverissä.

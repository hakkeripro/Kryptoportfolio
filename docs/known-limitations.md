# Known limitations

- **PWA background (iOS/Safari):** iOS rajoittaa background-ajon ja Web Push -tukea eri versioissa; siksi foreground runner on aina olemassa ja server-side runner + push vaatii opt-in.
- **Rate limits:** CoinGecko/exchange API:t voivat rajoittaa kutsuja. Sovellus cachettaa hinnat ja käyttää backoffia.
- **E2E encryption recovery:** Jos käyttäjä unohtaa passphrase:n, E2E-salattua dataa ei voi palauttaa (server ei näe plaintextia).

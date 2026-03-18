# PrivateLedger — Launch Checklist

Päivitetty: 2026-03-18

## Esivalmistelut (tee ennen julkaisua)

### Domain + DNS
- [ ] Tarkista `private-ledger.app` saatavuus (Cloudflare Registrar, Namecheap, Porkbun)
- [ ] Osta domain (~$15/v)
- [ ] Cloudflare-DNS: lisää domain → Nameserverit osoittavat Cloudflareen
- [ ] DNS TTL: aseta 1h ennen muutoksia

### Cloudflare Pages — Landing
- [ ] Luo uusi Pages-projekti: `privateledger-landing`
- [ ] Yhdistä GitHub-repo, build root: `apps/landing/`, output: `dist/`
- [ ] Build command: `pnpm --filter @kp/landing build`
- [ ] Lisää custom domain: `private-ledger.app` → landing Pages-projekti
- [ ] Varmista: `private-ledger.app/` latautuu ✓
- [ ] Varmista: `private-ledger.app/blog/krypto-verotus-suomi-2026` latautuu ✓
- [ ] Tarkista `/robots.txt` ja `/sitemap.xml` vastaavat ✓

### Cloudflare Pages — App
- [ ] Lisää custom domain `app.private-ledger.app` olemassa olevaan `kryptoportfolio` -projektiin
- [ ] Varmista: `app.private-ledger.app` → sovellus latautuu ✓
- [ ] `kryptoportfolio.pages.dev` jää toimimaan (backward compat)

### PWA / App päivitys
- [ ] Päivitä `apps/web/public/manifest.json`: `start_url` → `https://app.private-ledger.app/`
- [ ] Päivitä `apps/web/index.html` canonical URL → `https://app.private-ledger.app`
- [ ] WelcomePage: lisää linkki `private-ledger.app` landing pagelle (tagline-linkki)

### OG-kuva
- [ ] Luo `apps/landing/public/og-image.png` (1200×630px)
  - Musta tausta (#111111)
  - PrivateLedger logo + tagline "The only crypto tracker that can't see your data."
  - Oranssi (#FF8400) aksenttivärillä
  - Voi tehdä: Figma, Canva tai `sharp`-kirjastolla Node.js-skriptillä
- [ ] Tarkista OG-kuva: https://developers.facebook.com/tools/debug/ tai https://cards-dev.twitter.com/validator

## Toiminnallisuuden tarkistus

### Landing page
- [ ] Hero-teksti näkyy oikein (desktop + mobile 375px)
- [ ] "Start for free" -linkki vie `app.private-ledger.app/welcome` -sivulle
- [ ] "Sign in" -linkki toimii
- [ ] Dashboard-mockup animoituu (Framer Motion)
- [ ] ZK-selitys osio renderöityy
- [ ] Pricing-taulukko näkyy
- [ ] Footer-linkit toimivat
- [ ] Blog-artikkeli latautuu (`/blog/krypto-verotus-suomi-2026`)
- [ ] `prefers-reduced-motion` testaus: animaatiot pysähtyvät ✓

### SEO
- [ ] `<title>` oikein (meta title)
- [ ] `<meta name="description">` oikein
- [ ] OG-tagit oikein (og:title, og:description, og:image)
- [ ] Twitter Card toimii
- [ ] `<link rel="canonical">` oikein
- [ ] `<html lang="fi">` ✓
- [ ] Google Search Console: lisää property + sitemap

### Sovellus (ennen julkaisua)
- [ ] Rekisteröinti toimii `app.private-ledger.app`:ssa
- [ ] Vault setup + unlock toimii
- [ ] Coinbase-import toimii
- [ ] Tax-sivu latautuu
- [ ] PWA-install kehotus toimii mobiililla

## Show HN

### Pre-post
- [ ] Lue `docs/launch/show-hn-post.md` — finalisoi teksti
- [ ] Tarkista kaikki linkit postissa
- [ ] Varmista `app.private-ledger.app` on toiminnassa
- [ ] Valmistele vastaukset yleisiin kysymyksiin (ZK-arkkitehtuuri, passphrase recovery, kilpailijavertailu)

### Postaus
- [ ] Ajoita: arkipäivä klo 9–11 EST (klo 16–18 Suomessa)
- [ ] Posta: news.ycombinator.com → Submit → "Show HN: PrivateLedger ..."
- [ ] Jaa linkki omassa verkostossa (Twitter/X, LinkedIn, Reddit r/cryptotax, r/personalfinance_fi)

### Post-launch seuranta
- [ ] Seuraa kommentit (ensimmäiset 2h kriittisiä)
- [ ] Vastaa kaikkiin kommentteihin rehellisesti
- [ ] Kirjaa bugi-raportit ISSUE_LOG.md:hen
- [ ] Tarkista Cloudflare Analytics: liikenne, bouncerate
- [ ] Tarkista error-logit (Cloudflare Pages Functions)

## Rollback-suunnitelma

Jos kriittinen bugi löytyy:
1. Poista Custom domain `app.private-ledger.app` Cloudflare Pages -hallinnasta (käyttäjät siirtyvät `kryptoportfolio.pages.dev`:iin)
2. Korjaa bugi, push → automaattinen deploy
3. Lisää custom domain takaisin

Landing page on staattinen — sen rollback ei ole tarpeellista pienissä bugeissa.

## Muistettavaa

- `private-ledger.app` domainilla ei ole aktiivista sisältöä ennen tätä — ei tarvitse varoittaa käyttäjiä
- `kryptoportfolio.pages.dev` jää toimintaan koko ajan
- OmaVero-guide (Pro-feature) on jo sovelluksessa — voidaan mainita postissa

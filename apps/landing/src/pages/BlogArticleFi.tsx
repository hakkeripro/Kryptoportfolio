import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react';

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Krypto verotus Suomessa 2026 — OmaVero step-by-step',
  description:
    'Täydellinen opas kryptovaluuttojen verotukseen Suomessa 2026. Verohallinnon vaatimukset, OmaVero-täyttö, hankintameno-olettama (HMO) ja PrivateLedger-verolaskenta.',
  datePublished: '2026-03-18',
  dateModified: '2026-03-18',
  author: { '@type': 'Organization', name: 'PrivateLedger' },
  publisher: { '@type': 'Organization', name: 'PrivateLedger', url: 'https://private-ledger.app' },
  inLanguage: 'fi',
  url: 'https://private-ledger.app/blog/krypto-verotus-suomi-2026',
};

const FAQ = [
  {
    q: 'Pitääkö kryptovaluuttojen myynti ilmoittaa Verohallinnolle?',
    a: 'Kyllä. Kaikki luovutukset (myynti, vaihto toiseen kryptoon, maksaminen) ovat verotettavia tapahtumia Suomessa. Ainoa poikkeus: crypto-to-crypto vaihdot ovat verotettavia (ei kuten joissain muissa maissa).',
  },
  {
    q: 'Milloin käytän hankintameno-olettamaa (HMO)?',
    a: 'HMO (20% tai 40%) kannattaa kun se on suurempi kuin todellinen hankintahinta. Jos omistit kryptoa yli 10 vuotta, HMO on 40%. Alle 10 vuotta, 20%. Laskit voittosi 1000€ myynnistä: HMO = 200€ (20%), todellinen hinta = 150€ → käytä HMO:ta.',
  },
  {
    q: 'Miten staking-tulot verotetaan?',
    a: 'Staking-palkkiot ovat pääomatuloa silloin kun ne vastaanotetaan, arvon perusteella vastaanottamishetkellä. Myöhempi myynti on erillinen luovutustapahtuma.',
  },
  {
    q: 'Voinko vähentää kaupankäyntimaksut?',
    a: 'Kyllä. Exchange-maksut (trading fees, withdrawal fees) voidaan lisätä hankintahintaan tai vähentää myyntihinnasta. Säilytä kuitit tai käytä automaattista laskentaa.',
  },
  {
    q: 'Mikä on 1000 euron veroton raja?',
    a: 'Suomessa luovutusvoitot ovat verovapaita jos luovutusten yhteenlaskettu hankintahinta on enintään 1000€ per vuosi (ei arvo, vaan hankintahinta). Tämä on harvinainen tapaus — useimmilla ylittyy.',
  },
];

export default function BlogArticleFi() {
  useEffect(() => {
    // Inject structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(STRUCTURED_DATA);
    document.head.appendChild(script);

    // Update page meta
    document.title = 'Krypto verotus Suomessa 2026 — OmaVero step-by-step | PrivateLedger';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', STRUCTURED_DATA.description);
    }

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#111111]/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            PrivateLedger
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF8400]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
              private-ledger.app
            </span>
          </div>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16" lang="fi">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#FF8400]/70 bg-[#FF8400]/[0.08] border border-[#FF8400]/20 rounded-full px-3 py-1">
              Verotus-opas
            </span>
            <span className="text-[10px] font-mono text-white/30">Päivitetty: 18.3.2026</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            Krypto verotus Suomessa 2026 — OmaVero step-by-step
          </h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Kryptovaluuttojen verotus Suomessa voi tuntua monimutkaiselta, mutta se noudattaa
            selkeitä periaatteita. Tässä oppaassa käymme läpi kaiken oleellisen: mitä pitää
            ilmoittaa, miten lasket voitot, HMO-olettaman käytön ja käytännön ohjeet
            OmaVero-täyttöön.
          </p>
        </header>

        {/* Table of contents */}
        <nav className="bg-[#0F0F0F] border border-white/[0.08] rounded-2xl p-6 mb-12">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30 mb-4">
            // SISÄLLYSLUETTELO
          </p>
          <ol className="space-y-2">
            {[
              'Kryptovaluuttojen verovelvollisuus Suomessa',
              'Mitä tapahtumia pitää ilmoittaa',
              'Hankintameno-olettama (HMO) — milloin kannattaa',
              'OmaVero step-by-step täyttöohje',
              'Käytännön esimerkki: Bitcoin-myynti',
              'Staking, DeFi ja airdropsit',
              'PrivateLedger — automaattinen verolaskenta',
              'Usein kysytyt kysymykset',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/20 w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-white/60">{item}</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Section 1 */}
        <Section
          id="verovelvollisuus"
          number="1"
          title="Kryptovaluuttojen verovelvollisuus Suomessa"
        >
          <p>
            Verohallinto käsittelee kryptovaluuttoja{' '}
            <strong className="text-white">omaisuutena</strong>, ei valuuttana. Tämä tarkoittaa,
            että niiden ostaminen ei ole verotapahtuma, mutta{' '}
            <strong className="text-white">kaikki luovutukset ovat</strong>.
          </p>
          <p className="mt-4">Luovutusvoitto (tai -tappio) lasketaan yksinkertaisesti:</p>
          <div className="my-6 bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-5 font-mono text-sm">
            <p className="text-[#B6FFCE]">Luovutusvoitto = Myyntihinta − Hankintahinta − Kulut</p>
          </div>
          <p>
            Luovutusvoitto on pääomatuloa ja verotetaan 30% (alle 30 000€) tai 34% (yli 30 000€)
            veroprosentilla. Tappio voidaan vähentää saman vuoden pääomatuloista tai seuraavien 5
            vuoden aikana.
          </p>
          <InfoBox>
            <strong>Tärkeää:</strong> Crypto-to-crypto vaihto on verotapahtuma Suomessa. BTC → ETH
            -vaihto realisoi BTC:n luovutusvoiton tai -tappion.
          </InfoBox>
        </Section>

        {/* Section 2 */}
        <Section id="ilmoitettavat" number="2" title="Mitä tapahtumia pitää ilmoittaa">
          <p>Kaikki seuraavat tapahtumat ovat verotettavia:</p>
          <ul className="mt-4 space-y-2">
            {[
              'Kryptovaluutan myynti euroiksi (tai muiksi fiat-valuutoiksi)',
              'Kryptovaluutan vaihto toiseen kryptovaluuttaan',
              'Kryptovaluutalla maksaminen (kauppa, palvelu)',
              'Mining-tulot (vastaanottohetken arvo on verotettavaa tuloa)',
              'Staking-palkkiot (pääomatuloa vastaanottohetkellä)',
              'Airdropsit ja hard forkit (verotettavaa vastaanottohetkellä)',
              'DeFi-tulot: liquidity mining, yield farming',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                <span className="text-[#B6FFCE] mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-white/60">
            <strong className="text-white">Ei verotettavia:</strong> Ostaminen, siirrot omien
            lompakkojen välillä (sama omistaja), HODLaus ilman myyntiä.
          </p>
        </Section>

        {/* Section 3 */}
        <Section id="hmo" number="3" title="Hankintameno-olettama (HMO) — milloin kannattaa">
          <p>
            HMO on Verohallinnon sallima vaihtoehtoinen tapa laskea hankintahinta. Sen sijaan että
            käytät todellista ostohintaa, käytät prosenttiosuuden myyntihinnasta:
          </p>
          <div className="my-6 grid grid-cols-2 gap-4">
            <div className="bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-5 text-center">
              <p className="text-3xl font-mono font-bold text-[#FF8400] mb-2">20%</p>
              <p className="text-xs text-white/50">Omistusaika alle 10 vuotta</p>
            </div>
            <div className="bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-5 text-center">
              <p className="text-3xl font-mono font-bold text-[#FF8400] mb-2">40%</p>
              <p className="text-xs text-white/50">Omistusaika yli 10 vuotta</p>
            </div>
          </div>
          <p>
            <strong className="text-white">Kannattaa käyttää HMO:ta kun</strong> se on suurempi kuin
            todellinen hankintahinta plus kulut. Esimerkki:
          </p>
          <div className="my-6 bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-5 font-mono text-xs space-y-1.5">
            <p className="text-white/40">// Esimerkki: myyt BTC:tä 5 000€</p>
            <p className="text-white/70">
              Todellinen hankintahinta: <span className="text-white">800€</span>
            </p>
            <p className="text-white/70">
              HMO (20%): <span className="text-[#FF8400]">1 000€</span>
            </p>
            <p className="text-white/40 mt-2">// HMO antaa suuremman vähennyksen → käytä HMO:ta</p>
            <p className="text-[#B6FFCE]">Voitto HMO:lla: 4 000€ (vs. 4 200€ ilman)</p>
          </div>
          <InfoBox>
            HMO:ta ei voi käyttää tappiollisessa kaupassa — se voi vain pienentää voittoa, ei luoda
            tappiota.
          </InfoBox>
        </Section>

        {/* Section 4 */}
        <Section id="omavero" number="4" title="OmaVero step-by-step täyttöohje">
          <p className="mb-6">
            Kryptovaluuttojen luovutusvoitot ilmoitetaan OmaVeron kautta esitäytetylle
            veroilmoitukselle.
          </p>
          <ol className="space-y-5">
            {[
              {
                step: '01',
                title: 'Kirjaudu OmaVeroon',
                desc: 'vero.fi → OmaVero → Kirjaudu pankkitunnuksilla tai mobiilivarmenteella.',
              },
              {
                step: '02',
                title: 'Avaa veroilmoitus',
                desc: 'Etusivu → Veroilmoitukset → Valitse verovuosi 2025 → Muokkaa esitäytettyä ilmoitusta.',
              },
              {
                step: '03',
                title: 'Lisää luovutusvoitot',
                desc: 'Pääomatulot → Luovutusvoitot ja -tappiot → Lisää uusi → Valitse "Virtuaalivaluutta".',
              },
              {
                step: '04',
                title: 'Syötä tiedot per erä',
                desc: 'Jokainen myyntierä erikseen: myyntipäivä, myyntihinta, hankintapäivä, hankintahinta (tai HMO). Kulut vähennetään myyntihinnasta.',
              },
              {
                step: '05',
                title: 'Tarkista ja lähetä',
                desc: 'OmaVero laskee automaattisesti veron. Tarkista summat, lähetä ilmoitus. Deadline: 30.4. tai henkilökohtainen pidennys.',
              },
            ].map((s) => (
              <li key={s.step} className="flex gap-4">
                <span className="text-[#FF8400] font-mono text-sm font-bold shrink-0 mt-0.5">
                  {s.step}
                </span>
                <div>
                  <p className="font-semibold text-white mb-1">{s.title}</p>
                  <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <a
            href="https://www.vero.fi/henkiloasiakkaat/omaisuus/virtuaalivaluutat/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 text-sm text-[#FF8400]/80 hover:text-[#FF8400] transition-colors"
          >
            Verohallinnon ohjeet kryptovaluutoista
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </Section>

        {/* Section 5 */}
        <Section id="esimerkki" number="5" title="Käytännön esimerkki: Bitcoin-myynti">
          <p className="mb-4">
            Olet ostanut 0.5 BTC vuonna 2023 hintaan 12 000€. Myyt ne 2025 hintaan 25 000€.
          </p>
          <div className="bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-5 font-mono text-sm space-y-2">
            <div className="flex justify-between text-white/70">
              <span>Myyntihinta:</span>
              <span className="text-white">25 000€</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Hankintahinta (todellinen):</span>
              <span className="text-white">12 000€</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>HMO (20% × 25 000):</span>
              <span className="text-[#FF8400]">5 000€</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">→ Käytetään todellinen hinta (suurempi)</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-white">Luovutusvoitto:</span>
              <span className="text-[#B6FFCE]">13 000€</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Vero (30%):</span>
              <span>3 900€</span>
            </div>
          </div>
        </Section>

        {/* Section 6 */}
        <Section id="staking" number="6" title="Staking, DeFi ja airdropsit">
          <p className="mb-4">
            <strong className="text-white">Staking:</strong> Palkkiot ovat pääomatuloa
            vastaanottohetken markkina-arvon mukaan. Myöhempi myynti on erillinen luovutustapahtuma
            (FIFO-periaate).
          </p>
          <p className="mb-4">
            <strong className="text-white">DeFi:</strong> Liquidity pool -tuotot ja yield farming
            -palkkiot verotetaan pääomatulona. Likviditeetin lisääminen ja poistaminen poolista
            saattaa olla verotapahtuma (vaihto) — Verohallinnon kanta vielä osin epäselvä, tulkitse
            varovaisesti.
          </p>
          <p>
            <strong className="text-white">Airdropsit:</strong> Verotettavaa vastaanottohetkellä
            (markkina-arvo). Arvottomat tai erittäin pienet airdropsit saattaa olla käytännössä
            verovapaita (1000€ rajan alle).
          </p>
        </Section>

        {/* Section 7 */}
        <Section id="privateledger" number="7" title="PrivateLedger — automaattinen verolaskenta">
          <p className="mb-4">
            Manuaalinen laskenta kaikille kaupoille on työlästä. PrivateLedger automatisoi
            verolaskennan suoraan exchange-datasta.
          </p>
          <ul className="space-y-3">
            {[
              'Automaattinen FIFO/LIFO/HIFO/AVG-laskenta per verovuosi',
              'HMO-vertailu — ohjelma valitsee sinulle edullisimman',
              'OmaVero-täyttöopas (copy-paste -valmis listaus per kauppa)',
              'Exchange-import: Coinbase, Binance, Kraken (API tai CSV)',
              'Kaikki data salattu laitteellasi — PrivateLedger ei näe numeroitasi',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                <span className="text-[#FF8400] mt-0.5 shrink-0">→</span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href="https://app.private-ledger.app/welcome"
            className="inline-flex items-center gap-2 mt-6 bg-[#FF8400] hover:bg-[#FFA040] text-black font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:shadow-[0_0_20px_rgba(255,132,0,0.3)]"
          >
            Kokeile ilmaiseksi
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </Section>

        {/* FAQ */}
        <Section id="faq" number="8" title="Usein kysytyt kysymykset">
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group bg-[#0F0F0F] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-white list-none">
                  {item.q}
                  <span className="text-white/30 group-open:rotate-45 transition-transform duration-200 ml-3 shrink-0">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-white/60 leading-relaxed border-t border-white/[0.04] pt-3">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Section>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Takaisin etusivulle
          </Link>
          <p className="text-[10px] font-mono text-white/20">Päivitetty: 18.3.2026</p>
        </div>
      </article>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[10px] font-mono text-[#FF8400]/50">{number.padStart(2, '0')}</span>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="text-white/60 leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-3 bg-[#FF8400]/[0.06] border border-[#FF8400]/20 rounded-xl px-5 py-4">
      <span className="text-[#FF8400] shrink-0 mt-0.5">ℹ</span>
      <p className="text-sm text-white/70 leading-relaxed">{children}</p>
    </div>
  );
}

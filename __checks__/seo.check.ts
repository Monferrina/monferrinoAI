import {
  ApiCheck,
  AssertionBuilder,
  CheckGroupV2,
  EmailAlertChannel,
  Frequency,
} from 'checkly/constructs';

// Monitoraggio SEO delle pagine che Monferrino cura. Un solo ApiCheck GET per pagina
// verifica in un colpo: uptime (status 200) E presenza degli elementi SEO base
// (<title> + meta description) nell'HTML servito.
//
// Scelte di quota (account Checkly CONDIVISO col sito, free tier):
// - ApiCheck (non UrlMonitor): non intacca il limite di 10 uptime monitor, già
//   quasi saturo dal sito (~7 usati).
// - Frequenza giornaliera + 1 location: ~30 run/mese per check → 6 check ≈ 180/mese,
//   ampiamente dentro i 10k API run/mese anche col consumo del sito.
// - Niente browser check: il free tier ne dà solo 1k/mese, già conteso dal sito.

const baseUrl = 'https://vetreriamonferrina.com';

// Gruppo dedicato all'agente: raccoglie i monitor SEO sotto un'unica vista in Checkly.
// CheckGroupV2: i check mantengono la PROPRIA config (location/frequenza), il gruppo
// li raggruppa soltanto → nessun cambio di consumo run.
// Owned da QUESTO repo (progetto 'monferrino-seo'); il sito ha il suo gruppo separato.
const agentGroup = new CheckGroupV2('agent-monferrinoai', {
  name: 'Agent-MonferrinoAI',
  tags: ['SEO'],
});

// Canale di alert: email a Giuseppe su FAIL e ripristino dei check SEO.
// L'indirizzo è già pubblico in SECURITY.md → nessuna nuova esposizione.
// CheckGroupV2 non accetta alertChannels in questa versione → il canale si
// allega per-check (sotto). sendDegraded off: soglie degraded/maxResponseTime
// già generose, niente spam sui rallentamenti. sslExpiry on: avvisa 30gg prima
// della scadenza del certificato TLS del sito.
const emailChannel = new EmailAlertChannel('email-giuseppe', {
  address: 'giuseppefioravanti@proton.me',
  sendFailure: true,
  sendRecovery: true,
  sendDegraded: false,
  sslExpiry: true,
  sslExpiryThreshold: 30,
});

// Pagine servizio target SEO (priorità da seo_keywords) + home.
const seoPages = [
  { id: 'home', path: '/' },
  { id: 'parapetti', path: '/servizi/parapetti' }, // target #1
  { id: 'box-doccia', path: '/servizi/box-doccia' },
  { id: 'blindati', path: '/servizi/blindati' },
  { id: 'molature', path: '/servizi/molature' },
];

for (const page of seoPages) {
  new ApiCheck(`seo-${page.id}`, {
    name: `SEO ${page.path}`,
    group: agentGroup,
    alertChannels: [emailChannel],
    activated: true,
    frequency: Frequency.EVERY_24H,
    degradedResponseTime: 5000,
    maxResponseTime: 15000,
    tags: ['monferrino', 'seo'],
    request: {
      url: `${baseUrl}${page.path}`,
      method: 'GET',
      followRedirects: true,
      skipSSL: false,
      assertions: [
        AssertionBuilder.statusCode().equals(200),
        AssertionBuilder.textBody().contains('<title'), // title presente
        AssertionBuilder.textBody().contains('name="description"'), // meta description presente
      ],
    },
  });
}

// Sitemap raggiungibile e valido (è un sitemap-index → contiene <loc>).
new ApiCheck('seo-sitemap', {
  name: 'SEO sitemap.xml',
  group: agentGroup,
  activated: true,
  frequency: Frequency.EVERY_24H,
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  tags: ['monferrino', 'seo'],
  request: {
    url: `${baseUrl}/sitemap.xml`,
    method: 'GET',
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.textBody().contains('<loc'),
    ],
  },
});

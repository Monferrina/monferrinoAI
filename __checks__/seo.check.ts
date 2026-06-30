import { ApiCheck, AssertionBuilder, Frequency } from 'checkly/constructs';

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

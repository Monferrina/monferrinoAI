# Monitor competitor vetrerie

Monitor Firecrawl server-side (`firecrawl monitor`, id `019f1363-7672-736b-af55-3e04baad06fd`).
Config riproducibile in [`competitor-monitor.json`](./competitor-monitor.json).

- **Schedule:** mensile, 1° del mese 09:00 Europe/Rome (`0 9 1 * *`)
- **Costo:** 30 URL × 2 cr/check (AI-judge raddoppia) = **~60 cr/mese** → ampio margine sul free tier (1.000/mese)
- **AI-judge ON:** filtra rumore (cookie/privacy/date/formattazione), notifica solo modifiche reali a servizi/prodotti/prezzi/promo **o** nuovi articoli blog
- **Retention:** 90 giorni
- **Notifiche:** email a `giuseppefioravanti@proton.me` sui cambi reali (`notification.email` nel JSON). Firecrawl richiede **opt-in**: il destinatario riceve una mail di conferma da accettare una volta.

Riapplicare la config: `firecrawl monitor update <id> competitor-monitor.json` (targets); il `goal` va passato col flag `--goal`.

> Applicare le notifiche **dopo** il run mensile per non perdere il diff del mese in corso.

## Analisi delle 12 mappe → set monitorato

Mappatura completa (firecrawl map, 29/6, 593 URL totali). Scelta delle aree critiche per dominio:

| Dominio | Zona | Profilo | Nel monitor | URL |
|---|---|---|---|---|
| vetrariacasalese.it | Casale Monferrato | concorrente diretto (in SAMRUSH ranking) | ✅ | 5 |
| nuovavetrariaalessandrinasrl.it | Alessandria | statico, catalogo servizi | ✅ | 4 |
| vetreriavegal.com | Alessandria | parapetti/scale/lavorazioni | ✅ | 4 |
| vercellivetri.it | Vercelli | shop e-commerce + blog (il più strutturato) | ✅ | 3 (home, shop, blog) |
| lanuovavetrinova.it | — | molte pagine servizio | ✅ | 5 |
| vetreriabs.it | — | statico, blog abbandonato (2020) | ✅ | 4 (basso valore) |
| **skyglass.it** | fuori zona | **blog SEO attivissimo** (normative/bonus/vetrate) | ✅ | 5 (home, blog, 3 prodotti) |
| vetreriasav.it | Lucca (TO) | blog attivo ma fuori zona | ❌ | — |
| glasmatt.it | — | catalogo statico ("relazioni") | ❌ | — |
| vetreriavs.it | — | lavori, statico | ❌ | — |
| vetreriacasale.it | — | accessori/ferramenta, statico | ❌ | — |
| vetreriabenedetti.it | — | micro eshop php | ❌ | — |

**Razionale scelte (30/6):**
- skyglass aggiunto come fonte di intelligence editoriale: ha i topic informazionali (ecobonus, normative, vetrate panoramiche) utili al blog di Vetreria Monferrina, anche se fuori zona.
- vercellivetri: aggiunto il blog (prima solo home+shop) — competitor territoriale più strutturato.
- 4 cataloghi statici esclusi: cambiano raramente, non giustificano i crediti.
- vetreriasav escluso: blog attivo ma territorio Toscana, irrilevante per la SERP locale.

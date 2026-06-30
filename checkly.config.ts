import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

// Monitoring-as-code di Monferrino: monitora le pagine SEO che l'agente cura su
// vetreriamonferrina.com. logicalId DISTINTO da quello del sito ('vetreria-monferrina')
// per NON sovrascrivere i suoi monitor sull'account Checkly condiviso.
// Conservativo sul free tier condiviso: 1 sola location, frequenza giornaliera.
export default defineConfig({
  projectName: 'Monferrino SEO Monitoring',
  logicalId: 'monferrino-seo',
  repoUrl: 'https://github.com/Monferrina/monferrinoAI',
  checks: {
    frequency: Frequency.EVERY_24H,
    locations: ['eu-central-1'], // 1 location: metà consumo (account condiviso col sito)
    tags: ['monferrino', 'seo'],
    runtimeId: '2025.04',
    checkMatch: '**/__checks__/**/*.check.ts',
  },
  cli: {
    runLocation: 'eu-central-1',
    reporters: ['list'],
    retries: 0,
  },
});

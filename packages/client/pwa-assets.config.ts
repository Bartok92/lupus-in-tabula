import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Genera le icone PNG dell'app (normali, "maskable" per Android, Apple) da public/icona.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#070a18' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#070a18' } },
  },
  images: ['public/icona.svg'],
});

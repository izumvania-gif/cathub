import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate PNG icons from public/icon.svg: pnpm --filter @cathub/web icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#fff8f0' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#fff8f0' } },
  },
  images: ['public/icon.svg'],
});

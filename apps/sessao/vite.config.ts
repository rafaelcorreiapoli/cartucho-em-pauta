import {federalAudio} from './dev/federal-audio';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { voiceLab } from './dev/voice-lab';

export default defineConfig({
  build: {rollupOptions: {input: {main: 'index.html', tiriricaResolution: 'tiririca-resolution.html'}}},
  plugins: [tailwindcss(), federalAudio(), ...(process.env.RVC_LAB_DIR ? [voiceLab(process.env.RVC_LAB_DIR)] : [])],
});

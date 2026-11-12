import { defineConfig } from 'vite';
import { voiceLab } from './dev/voice-lab';

export default defineConfig({
  plugins: process.env.RVC_LAB_DIR ? [voiceLab(process.env.RVC_LAB_DIR)] : [],
});

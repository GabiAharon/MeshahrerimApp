import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Expose VITE_ prefixed env vars to the client
  envPrefix: 'VITE_',

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        auth: resolve(__dirname, 'auth.html'),
        community: resolve(__dirname, 'community.html'),
        faults: resolve(__dirname, 'faults.html'),
        notices: resolve(__dirname, 'notices.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
  },

  // Define global replacements for env vars (works in all JS)
  define: {
    '__SUPABASE_URL__': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    '__SUPABASE_ANON_KEY__': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  },
});

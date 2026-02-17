// This script generates public/config.js from environment variables
// Run before build: node scripts/generate-config.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(path.join(__dirname, '..', '.env'));
loadEnvFile(path.join(__dirname, '..', '.env.local'));

const config = {
  ADMIN_EMAIL: process.env.VITE_ADMIN_EMAIL || '',
  ADMIN_EMAILS: process.env.VITE_ADMIN_EMAILS ? process.env.VITE_ADMIN_EMAILS.split(',') : [],
  BUILDING_NAME: process.env.VITE_BUILDING_NAME || 'MyBuilding',
  BUILDING_NAME_EN: process.env.VITE_BUILDING_NAME_EN || 'MyBuilding',
  BUILDING_ADDRESS: process.env.VITE_BUILDING_ADDRESS || '',
  BUILDING_ADDRESS_EN: process.env.VITE_BUILDING_ADDRESS_EN || '',
  INVITATION_SECRET: process.env.VITE_INVITATION_SECRET || 'default-secret-change-me',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  ONESIGNAL_APP_ID: process.env.VITE_ONESIGNAL_APP_ID || ''
};

const configContent = `// Auto-generated config - DO NOT EDIT
// Generated at build time from environment variables
window.APP_CONFIG = ${JSON.stringify(config, null, 2)};
`;

const publicDir = path.join(__dirname, '..', 'public');
const configPath = path.join(publicDir, 'config.js');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(configPath, configContent);
console.log('Generated public/config.js from environment variables');

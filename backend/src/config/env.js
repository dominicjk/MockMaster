import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Also try loading from project root as fallback
if (!process.env.DB_PASSWORD) {
  dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
}

console.log('[ENV] Environment variables loaded');
console.log('[ENV] DB_PASSWORD exists:', !!process.env.DB_PASSWORD);
console.log('[ENV] DB_NAME:', process.env.DB_NAME);

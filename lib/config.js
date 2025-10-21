import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
export const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads/' : 'uploads/';
export const merchantDataDir = process.env.NODE_ENV === 'production' ? '/tmp/merchant_data/' : 'merchant_data/';

// Ensure directories exist
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
try { fs.mkdirSync(merchantDataDir, { recursive: true }); } catch {}

// Multer upload handler
export const upload = multer({ dest: uploadDir });

// OpenAI client
export const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Port
export const PORT = process.env.PORT || 3000;

// Constants
export const BILLING_TYPES = ['Flat price','Unit price','Tier flat price','Tier unit price'];
export const FREQ_UNITS   = ['None','Day(s)','Week(s)','Semi_month(s)','Month(s)','Year(s)'];

// Paths helper (for absolute path resolution)
export function getProjectRoot() {
  return path.resolve(__dirname, '..');
}



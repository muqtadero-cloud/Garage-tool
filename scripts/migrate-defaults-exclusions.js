#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'merchant_data.db');

console.log('🔄 Adding default_overrides and excluded_fields columns\n');

try {
  const db = new Database(dbPath);
  
  const tableInfo = db.prepare("PRAGMA table_info(guidance)").all();
  const hasDefaults = tableInfo.some(col => col.name === 'default_overrides');
  const hasExclusions = tableInfo.some(col => col.name === 'excluded_fields');
  
  if (hasDefaults && hasExclusions) {
    console.log('✅ Columns already exist');
    db.close();
    process.exit(0);
  }
  
  if (!hasDefaults) {
    console.log('Adding default_overrides column...');
    db.exec('ALTER TABLE guidance ADD COLUMN default_overrides TEXT');
    console.log('✅ Added default_overrides');
  }
  
  if (!hasExclusions) {
    console.log('Adding excluded_fields column...');
    db.exec('ALTER TABLE guidance ADD COLUMN excluded_fields TEXT');
    console.log('✅ Added excluded_fields');
  }
  
  db.close();
  console.log('\n✅ Migration complete!\n');
  
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
}





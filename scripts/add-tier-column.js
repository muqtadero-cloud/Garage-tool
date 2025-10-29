#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'merchant_data.db');

console.log('🔧 Adding tier column to merchants table...');
console.log(`📂 Database: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if tier column already exists
  const tableInfo = db.prepare('PRAGMA table_info(merchants)').all();
  const hasTierColumn = tableInfo.some(col => col.name === 'tier');
  
  if (hasTierColumn) {
    console.log('✅ Tier column already exists. No migration needed.');
  } else {
    // Add tier column with default value
    db.exec(`
      ALTER TABLE merchants 
      ADD COLUMN tier TEXT DEFAULT 'basic';
    `);
    
    console.log('✅ Tier column added successfully!');
    
    // Update existing merchants to have basic tier
    const updateStmt = db.prepare(`
      UPDATE merchants 
      SET tier = 'basic' 
      WHERE tier IS NULL
    `);
    const result = updateStmt.run();
    
    console.log(`✅ Updated ${result.changes} existing merchants with 'basic' tier`);
  }
  
  // Verify the change
  const merchants = db.prepare('SELECT id, name, tier FROM merchants').all();
  console.log(`\n📊 Current merchants (${merchants.length}):`);
  merchants.forEach(m => {
    console.log(`  - ${m.name || m.id}: ${m.tier || 'N/A'}`);
  });
  
  console.log('\n✨ Migration complete!');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  db.close();
}





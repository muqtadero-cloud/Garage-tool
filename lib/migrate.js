import fs from 'fs';
import path from 'path';
import { merchantDataDir } from './config.js';
import {
  ensureMerchant,
  saveMerchantGuidance,
  saveIntegrationMapping,
  saveDemoSession,
  saveTrainingContract
} from './db.js';

/**
 * Migrate existing folder-based merchant data to SQLite database
 */
export function migrateToDatabase() {
  console.log('🔄 Starting migration to database...\n');
  
  if (!fs.existsSync(merchantDataDir)) {
    console.log('⚠️  No merchant_data directory found. Nothing to migrate.');
    return;
  }
  
  const merchants = fs.readdirSync(merchantDataDir);
  let migrated = 0;
  let skipped = 0;
  
  for (const merchantId of merchants) {
    const merchantPath = path.join(merchantDataDir, merchantId);
    
    // Skip if not a directory
    if (!fs.statSync(merchantPath).isDirectory()) {
      continue;
    }
    
    // Skip default directory
    if (merchantId === 'default') {
      continue;
    }
    
    console.log(`\n📁 Migrating merchant: ${merchantId}`);
    
    try {
      // Ensure merchant exists in database
      ensureMerchant(merchantId);
      
      // Migrate guidance.json
      const guidanceFile = path.join(merchantPath, 'guidance.json');
      if (fs.existsSync(guidanceFile)) {
        const guidance = JSON.parse(fs.readFileSync(guidanceFile, 'utf8'));
        saveMerchantGuidance(merchantId, guidance);
        console.log('  ✅ Migrated guidance.json');
      }
      
      // Migrate integration_mapping.json
      const mappingFile = path.join(merchantPath, 'integration_mapping.json');
      if (fs.existsSync(mappingFile)) {
        const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
        saveIntegrationMapping(merchantId, mapping);
        console.log('  ✅ Migrated integration_mapping.json');
      }
      
      // Migrate demo_session.json
      const demoFile = path.join(merchantPath, 'demo_session.json');
      if (fs.existsSync(demoFile)) {
        const demoData = JSON.parse(fs.readFileSync(demoFile, 'utf8'));
        
        // Check for training_contract.pdf
        const trainingPdfFile = path.join(merchantPath, 'training_contract.pdf');
        let pdfData = null;
        if (fs.existsSync(trainingPdfFile)) {
          const pdfBuffer = fs.readFileSync(trainingPdfFile);
          pdfData = {
            fileName: 'training_contract.pdf',
            data: pdfBuffer,
            size: pdfBuffer.length
          };
          console.log(`  ✅ Migrated training_contract.pdf (${pdfBuffer.length} bytes)`);
        }
        
        saveDemoSession(merchantId, demoData, pdfData);
        console.log('  ✅ Migrated demo_session.json');
      }
      
      migrated++;
      console.log(`  ✅ Successfully migrated ${merchantId}`);
      
    } catch (err) {
      console.error(`  ❌ Error migrating ${merchantId}:`, err.message);
      skipped++;
    }
  }
  
  console.log(`\n🎉 Migration complete!`);
  console.log(`   - Migrated: ${migrated} merchants`);
  console.log(`   - Skipped: ${skipped} merchants`);
  console.log(`\n📊 Database created at: merchant_data.db`);
}

/**
 * Export database data back to JSON files (for backup/inspection)
 */
export function exportToFiles(outputDir = './merchant_data_export') {
  console.log('📤 Exporting database to files...\n');
  
  // This would be implemented if needed for backup purposes
  console.log('Export functionality can be added if needed.');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToDatabase();
  process.exit(0);
}





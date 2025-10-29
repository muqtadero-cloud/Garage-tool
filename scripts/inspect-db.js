#!/usr/bin/env node

/**
 * Database inspection utility
 * 
 * Usage:
 *   node scripts/inspect-db.js               # Show summary
 *   node scripts/inspect-db.js merchants     # List merchants
 *   node scripts/inspect-db.js Cocoon        # Show merchant details
 */

import { 
  listMerchants, 
  loadMerchantGuidance, 
  loadDemoSession,
  loadIntegrationMapping,
  hasTrainingContract 
} from '../lib/db.js';

const command = process.argv[2];

function showSummary() {
  console.log('📊 Database Summary\n');
  console.log('='.repeat(50));
  
  const merchants = listMerchants();
  console.log(`\n📦 Total Merchants: ${merchants.length}\n`);
  
  merchants.forEach(merchant => {
    console.log(`${merchant.hasDemoSession ? '✅' : '⭕'} ${merchant.name} (${merchant.id})`);
    
    const guidance = loadMerchantGuidance(merchant.id);
    const hasGuidance = guidance.system_additions || 
                       Object.values(guidance.field_specific).some(v => v);
    
    const mapping = loadIntegrationMapping(merchant.id);
    const hasPdf = hasTrainingContract(merchant.id);
    
    const details = [];
    if (hasGuidance) details.push('guidance');
    if (merchant.hasDemoSession) details.push('demo session');
    if (mapping.length > 0) details.push(`${mapping.length} mappings`);
    if (hasPdf) details.push('training PDF');
    
    if (details.length > 0) {
      console.log(`   └─ ${details.join(', ')}`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('\n💡 Usage:');
  console.log('   node scripts/inspect-db.js merchants     # List merchants');
  console.log('   node scripts/inspect-db.js <merchant>    # Show merchant details\n');
}

function showMerchants() {
  const merchants = listMerchants();
  console.log('Merchants:');
  merchants.forEach(m => {
    console.log(`- ${m.id} (${m.name}) ${m.hasDemoSession ? '✅' : ''}`);
  });
}

function showMerchantDetails(merchantId) {
  console.log(`\n📋 Details for: ${merchantId}\n`);
  console.log('='.repeat(50));
  
  // Load guidance
  const guidance = loadMerchantGuidance(merchantId);
  console.log('\n📝 Guidance:');
  console.log(`   System additions: ${guidance.system_additions ? '✅' : '❌'}`);
  const fieldCount = Object.values(guidance.field_specific).filter(v => v).length;
  console.log(`   Field-specific: ${fieldCount} fields configured`);
  
  // Load integration mappings
  const mappings = loadIntegrationMapping(merchantId);
  console.log(`\n🔗 Integration Mappings: ${mappings.length}`);
  if (mappings.length > 0) {
    mappings.slice(0, 5).forEach(m => {
      console.log(`   - ${m.contract_name} → ${m.integration_item}`);
    });
    if (mappings.length > 5) {
      console.log(`   ... and ${mappings.length - 5} more`);
    }
  }
  
  // Load demo session
  const demo = loadDemoSession(merchantId);
  console.log(`\n🎯 Demo Session: ${demo ? '✅' : '❌'}`);
  if (demo) {
    console.log(`   Schedules: ${demo.schedules.length}`);
    console.log(`   Garage schedules: ${demo.garage_revenue_schedules.length}`);
    console.log(`   PDF session: ${demo.pdf_session_id || 'N/A'}`);
    console.log(`   Created: ${demo.created_at}`);
    
    if (demo.schedules.length > 0) {
      console.log('\n   Schedule items:');
      demo.schedules.forEach((s, i) => {
        console.log(`   ${i+1}. ${s.item_name} - $${s.total_price}`);
      });
    }
  }
  
  // Training contract
  const hasPdf = hasTrainingContract(merchantId);
  console.log(`\n📄 Training Contract PDF: ${hasPdf ? '✅' : '❌'}`);
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// Main
if (!command || command === 'summary') {
  showSummary();
} else if (command === 'merchants') {
  showMerchants();
} else {
  showMerchantDetails(command);
}




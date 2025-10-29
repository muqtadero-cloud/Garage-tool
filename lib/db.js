import Database from 'better-sqlite3';
import path from 'path';
import { getProjectRoot } from './config.js';

const dbPath = path.join(getProjectRoot(), 'merchant_data.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/* ----------------------- Database Schema ---------------------- */

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tabs_api_key TEXT,
    tabs_env TEXT DEFAULT 'dev',
    tier TEXT DEFAULT 'basic',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guidance (
    merchant_id TEXT PRIMARY KEY,
    system_additions TEXT,
    field_specific_item_name TEXT,
    field_specific_description TEXT,
    field_specific_total_price TEXT,
    field_specific_billing_type TEXT,
    field_specific_quantity TEXT,
    field_specific_start_date TEXT,
    field_specific_frequency_unit TEXT,
    field_specific_periods TEXT,
    field_specific_months_of_service TEXT,
    field_specific_net_terms TEXT,
    field_specific_billing_timing TEXT,
    field_specific_event_to_track TEXT,
    field_specific_general TEXT,
    default_overrides TEXT,
    excluded_fields TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS integration_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    integration_item TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS demo_sessions (
    merchant_id TEXT PRIMARY KEY,
    pdf_session_id TEXT,
    system_prompt_used TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS demo_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT NOT NULL,
    item_name TEXT,
    description TEXT,
    total_price REAL,
    billing_type TEXT,
    quantity INTEGER,
    start_date TEXT,
    frequency_unit TEXT,
    frequency_every INTEGER,
    periods INTEGER,
    months_of_service INTEGER,
    net_terms INTEGER,
    billing_timing TEXT,
    arrears INTEGER,
    event_to_track TEXT,
    tiers TEXT,
    original_ai_extraction TEXT,
    evidence TEXT,
    extraction_reasoning TEXT,
    instruction_item_name TEXT,
    instruction_total_price TEXT,
    instruction_billing_type TEXT,
    instruction_quantity TEXT,
    instruction_start_date TEXT,
    instruction_frequency_unit TEXT,
    instruction_periods TEXT,
    instruction_months_of_service TEXT,
    instruction_net_terms TEXT,
    instruction_billing_timing TEXT,
    instruction_event_to_track TEXT,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS garage_revenue_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT NOT NULL,
    service_start_date TEXT,
    service_term INTEGER,
    revenue_category TEXT,
    item_name TEXT,
    item_description TEXT,
    start_date TEXT,
    frequency_unit TEXT,
    period INTEGER,
    number_of_periods INTEGER,
    arrears INTEGER,
    billing_type TEXT,
    event_to_track TEXT,
    integration_item TEXT,
    discounts TEXT,
    net_terms INTEGER,
    quantity INTEGER,
    total_price REAL,
    pricing_tiers TEXT,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS training_contracts (
    merchant_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_data BLOB NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_integration_mappings_merchant 
    ON integration_mappings(merchant_id);
  
  CREATE INDEX IF NOT EXISTS idx_demo_schedules_merchant 
    ON demo_schedules(merchant_id);
  
  CREATE INDEX IF NOT EXISTS idx_garage_revenue_schedules_merchant 
    ON garage_revenue_schedules(merchant_id);
`);

/* ----------------------- Merchant Operations ---------------------- */

export function ensureMerchant(merchantId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO merchants (id, name) 
    VALUES (?, ?)
  `);
  const name = merchantId.replace(/_/g, ' ');
  stmt.run(merchantId, name);
}

export function listMerchants() {
  const stmt = db.prepare(`
    SELECT 
      m.id,
      m.name,
      m.tabs_api_key,
      m.tabs_env,
      m.created_at,
      EXISTS(SELECT 1 FROM demo_sessions WHERE merchant_id = m.id) as has_demo_session
    FROM merchants m
    ORDER BY m.name
  `);
  return stmt.all().map(row => ({
    id: row.id,
    name: row.name,
    tabsApiKey: row.tabs_api_key,
    tabsEnv: row.tabs_env || 'dev',
    hasDemoSession: row.has_demo_session === 1
  }));
}

export function getMerchant(merchantId) {
  const stmt = db.prepare(`
    SELECT id, name, tabs_api_key, tabs_env, tier, created_at, updated_at
    FROM merchants
    WHERE id = ?
  `);
  const row = stmt.get(merchantId);
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    tabsApiKey: row.tabs_api_key,
    tabsEnv: row.tabs_env || 'dev',
    tier: row.tier || 'basic',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function updateMerchantTabsCredentials(merchantId, tabsApiKey, tabsEnv = 'dev') {
  try {
    ensureMerchant(merchantId);
    
    const stmt = db.prepare(`
      UPDATE merchants 
      SET tabs_api_key = ?, 
          tabs_env = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(tabsApiKey || null, tabsEnv, merchantId);
    return true;
  } catch (err) {
    console.error('Failed to update Tabs credentials:', err);
    return false;
  }
}

export function updateMerchantTier(merchantId, tier) {
  try {
    ensureMerchant(merchantId);
    
    // Validate tier
    const validTiers = ['tier1', 'tier2', 'tier3', 'basic', 'professional', 'enterprise'];
    if (!validTiers.includes(tier)) {
      throw new Error(`Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}`);
    }
    
    const stmt = db.prepare(`
      UPDATE merchants 
      SET tier = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(tier, merchantId);
    return true;
  } catch (err) {
    console.error('Failed to update merchant tier:', err);
    return false;
  }
}

/* ----------------------- Guidance Operations ---------------------- */

export function loadMerchantGuidance(merchantId) {
  ensureMerchant(merchantId);
  
  const stmt = db.prepare(`
    SELECT * FROM guidance WHERE merchant_id = ?
  `);
  const row = stmt.get(merchantId);
  
  if (!row) {
    return {
      system_additions: '',
      field_specific: {
        item_name: '',
        description: '',
        total_price: '',
        billing_type: '',
        quantity: '',
        start_date: '',
        frequency_unit: '',
        periods: '',
        months_of_service: '',
        net_terms: '',
        billing_timing: '',
        event_to_track: '',
        general: ''
      },
      default_overrides: {},
      excluded_fields: [],
      updated_at: null
    };
  }
  
  return {
    system_additions: row.system_additions || '',
    field_specific: {
      item_name: row.field_specific_item_name || '',
      description: row.field_specific_description || '',
      total_price: row.field_specific_total_price || '',
      billing_type: row.field_specific_billing_type || '',
      quantity: row.field_specific_quantity || '',
      start_date: row.field_specific_start_date || '',
      frequency_unit: row.field_specific_frequency_unit || '',
      periods: row.field_specific_periods || '',
      months_of_service: row.field_specific_months_of_service || '',
      net_terms: row.field_specific_net_terms || '',
      billing_timing: row.field_specific_billing_timing || '',
      event_to_track: row.field_specific_event_to_track || '',
      general: row.field_specific_general || ''
    },
    default_overrides: row.default_overrides ? JSON.parse(row.default_overrides) : {},
    excluded_fields: row.excluded_fields ? JSON.parse(row.excluded_fields) : [],
    updated_at: row.updated_at
  };
}

export function saveMerchantGuidance(merchantId, guidance) {
  try {
    ensureMerchant(merchantId);
    
    const stmt = db.prepare(`
      INSERT INTO guidance (
        merchant_id, 
        system_additions,
        field_specific_item_name,
        field_specific_description,
        field_specific_total_price,
        field_specific_billing_type,
        field_specific_quantity,
        field_specific_start_date,
        field_specific_frequency_unit,
        field_specific_periods,
        field_specific_months_of_service,
        field_specific_net_terms,
        field_specific_billing_timing,
        field_specific_event_to_track,
        field_specific_general,
        default_overrides,
        excluded_fields,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(merchant_id) DO UPDATE SET
        system_additions = excluded.system_additions,
        field_specific_item_name = excluded.field_specific_item_name,
        field_specific_description = excluded.field_specific_description,
        field_specific_total_price = excluded.field_specific_total_price,
        field_specific_billing_type = excluded.field_specific_billing_type,
        field_specific_quantity = excluded.field_specific_quantity,
        field_specific_start_date = excluded.field_specific_start_date,
        field_specific_frequency_unit = excluded.field_specific_frequency_unit,
        field_specific_periods = excluded.field_specific_periods,
        field_specific_months_of_service = excluded.field_specific_months_of_service,
        field_specific_net_terms = excluded.field_specific_net_terms,
        field_specific_billing_timing = excluded.field_specific_billing_timing,
        field_specific_event_to_track = excluded.field_specific_event_to_track,
        field_specific_general = excluded.field_specific_general,
        default_overrides = excluded.default_overrides,
        excluded_fields = excluded.excluded_fields,
        updated_at = datetime('now')
    `);
    
    const fs = guidance.field_specific || {};
    const defaults = guidance.default_overrides || {};
    const exclusions = guidance.excluded_fields || [];
    
    stmt.run(
      merchantId,
      guidance.system_additions || '',
      fs.item_name || '',
      fs.description || '',
      fs.total_price || '',
      fs.billing_type || '',
      fs.quantity || '',
      fs.start_date || '',
      fs.frequency_unit || '',
      fs.periods || '',
      fs.months_of_service || '',
      fs.net_terms || '',
      fs.billing_timing || '',
      fs.event_to_track || '',
      fs.general || '',
      JSON.stringify(defaults),
      JSON.stringify(exclusions)
    );
    
    return true;
  } catch (err) {
    console.error('Failed to save merchant guidance:', err);
    return false;
  }
}

/* ----------------------- Integration Mapping Operations ---------------------- */

export function loadIntegrationMapping(merchantId) {
  ensureMerchant(merchantId);
  
  const stmt = db.prepare(`
    SELECT contract_name, integration_item 
    FROM integration_mappings 
    WHERE merchant_id = ?
  `);
  return stmt.all(merchantId);
}

export function saveIntegrationMapping(merchantId, mapping) {
  try {
    ensureMerchant(merchantId);
    
    // Delete existing mappings
    const deleteStmt = db.prepare(`
      DELETE FROM integration_mappings WHERE merchant_id = ?
    `);
    deleteStmt.run(merchantId);
    
    // Insert new mappings
    if (Array.isArray(mapping) && mapping.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO integration_mappings (merchant_id, contract_name, integration_item)
        VALUES (?, ?, ?)
      `);
      
      const insertMany = db.transaction((mappings) => {
        for (const item of mappings) {
          insertStmt.run(merchantId, item.contract_name, item.integration_item);
        }
      });
      
      insertMany(mapping);
    }
    
    return true;
  } catch (err) {
    console.error('Failed to save integration mapping:', err);
    return false;
  }
}

/* ----------------------- Demo Session Operations ---------------------- */

export function saveDemoSession(merchantId, demoData, pdfData = null) {
  try {
    ensureMerchant(merchantId);
    
    const saveTransaction = db.transaction(() => {
      // Save demo session metadata
      const sessionStmt = db.prepare(`
        INSERT INTO demo_sessions (merchant_id, pdf_session_id, system_prompt_used, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(merchant_id) DO UPDATE SET
          pdf_session_id = excluded.pdf_session_id,
          system_prompt_used = excluded.system_prompt_used,
          updated_at = datetime('now')
      `);
      sessionStmt.run(
        merchantId,
        demoData.pdf_session_id || null,
        demoData.system_prompt_used || null
      );
      
      // Delete existing schedules
      const deleteSchedulesStmt = db.prepare(`
        DELETE FROM demo_schedules WHERE merchant_id = ?
      `);
      deleteSchedulesStmt.run(merchantId);
      
      const deleteGarageStmt = db.prepare(`
        DELETE FROM garage_revenue_schedules WHERE merchant_id = ?
      `);
      deleteGarageStmt.run(merchantId);
      
      // Insert new demo schedules
      if (demoData.schedules && Array.isArray(demoData.schedules)) {
        const insertScheduleStmt = db.prepare(`
          INSERT INTO demo_schedules (
            merchant_id, item_name, description, total_price, billing_type, quantity,
            start_date, frequency_unit, frequency_every, periods, months_of_service,
            net_terms, billing_timing, arrears, event_to_track, tiers,
            original_ai_extraction, evidence, extraction_reasoning,
            instruction_item_name, instruction_total_price, instruction_billing_type,
            instruction_quantity, instruction_start_date, instruction_frequency_unit,
            instruction_periods, instruction_months_of_service, instruction_net_terms,
            instruction_billing_timing, instruction_event_to_track
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const schedule of demoData.schedules) {
          insertScheduleStmt.run(
            merchantId,
            schedule.item_name || null,
            schedule.description || null,
            schedule.total_price || null,
            schedule.billing_type || null,
            schedule.quantity || null,
            schedule.start_date || null,
            schedule.frequency_unit || null,
            schedule.frequency_every || null,
            schedule.periods || null,
            schedule.months_of_service || null,
            schedule.net_terms || null,
            schedule.billing_timing || null,
            schedule.arrears ? 1 : 0,
            schedule.event_to_track || null,
            schedule.tiers ? JSON.stringify(schedule.tiers) : null,
            schedule.original_ai_extraction ? JSON.stringify(schedule.original_ai_extraction) : null,
            schedule.evidence ? JSON.stringify(schedule.evidence) : null,
            schedule.extraction_reasoning || null,
            schedule.instruction_item_name || null,
            schedule.instruction_total_price || null,
            schedule.instruction_billing_type || null,
            schedule.instruction_quantity || null,
            schedule.instruction_start_date || null,
            schedule.instruction_frequency_unit || null,
            schedule.instruction_periods || null,
            schedule.instruction_months_of_service || null,
            schedule.instruction_net_terms || null,
            schedule.instruction_billing_timing || null,
            schedule.instruction_event_to_track || null
          );
        }
      }
      
      // Insert garage revenue schedules
      if (demoData.garage_revenue_schedules && Array.isArray(demoData.garage_revenue_schedules)) {
        const insertGarageStmt = db.prepare(`
          INSERT INTO garage_revenue_schedules (
            merchant_id, service_start_date, service_term, revenue_category,
            item_name, item_description, start_date, frequency_unit, period,
            number_of_periods, arrears, billing_type, event_to_track,
            integration_item, discounts, net_terms, quantity, total_price, pricing_tiers
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const garage of demoData.garage_revenue_schedules) {
          insertGarageStmt.run(
            merchantId,
            garage.service_start_date || null,
            garage.service_term || null,
            garage.revenue_category || null,
            garage.item_name || null,
            garage.item_description || null,
            garage.start_date || null,
            garage.frequency_unit || null,
            garage.period || null,
            garage.number_of_periods || null,
            garage.arrears ? 1 : 0,
            garage.billing_type || null,
            garage.event_to_track || null,
            garage.integration_item || null,
            garage.discounts ? JSON.stringify(garage.discounts) : null,
            garage.net_terms || null,
            garage.quantity || null,
            garage.total_price || null,
            garage.pricing_tiers ? JSON.stringify(garage.pricing_tiers) : null
          );
        }
      }
      
      // Save training contract PDF if provided
      if (pdfData) {
        const pdfStmt = db.prepare(`
          INSERT INTO training_contracts (merchant_id, file_name, file_data, file_size)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(merchant_id) DO UPDATE SET
            file_name = excluded.file_name,
            file_data = excluded.file_data,
            file_size = excluded.file_size,
            uploaded_at = datetime('now')
        `);
        pdfStmt.run(merchantId, pdfData.fileName, pdfData.data, pdfData.size);
      }
    });
    
    saveTransaction();
    console.log(`✅ Saved demo session for ${merchantId} to database`);
    return true;
  } catch (err) {
    console.error('❌ Failed to save demo session:', err);
    return false;
  }
}

export function loadDemoSession(merchantId) {
  try {
    const sessionStmt = db.prepare(`
      SELECT * FROM demo_sessions WHERE merchant_id = ?
    `);
    const session = sessionStmt.get(merchantId);
    
    if (!session) {
      return null;
    }
    
    // Load schedules
    const schedulesStmt = db.prepare(`
      SELECT * FROM demo_schedules WHERE merchant_id = ?
    `);
    const schedules = schedulesStmt.all(merchantId).map(row => ({
      item_name: row.item_name,
      description: row.description,
      total_price: row.total_price,
      billing_type: row.billing_type,
      quantity: row.quantity,
      start_date: row.start_date,
      frequency_unit: row.frequency_unit,
      frequency_every: row.frequency_every,
      periods: row.periods,
      months_of_service: row.months_of_service,
      net_terms: row.net_terms,
      billing_timing: row.billing_timing,
      arrears: row.arrears === 1,
      event_to_track: row.event_to_track,
      tiers: row.tiers ? JSON.parse(row.tiers) : [],
      original_ai_extraction: row.original_ai_extraction ? JSON.parse(row.original_ai_extraction) : null,
      evidence: row.evidence ? JSON.parse(row.evidence) : null,
      extraction_reasoning: row.extraction_reasoning,
      instruction_item_name: row.instruction_item_name,
      instruction_total_price: row.instruction_total_price,
      instruction_billing_type: row.instruction_billing_type,
      instruction_quantity: row.instruction_quantity,
      instruction_start_date: row.instruction_start_date,
      instruction_frequency_unit: row.instruction_frequency_unit,
      instruction_periods: row.instruction_periods,
      instruction_months_of_service: row.instruction_months_of_service,
      instruction_net_terms: row.instruction_net_terms,
      instruction_billing_timing: row.instruction_billing_timing,
      instruction_event_to_track: row.instruction_event_to_track
    }));
    
    // Load garage revenue schedules
    const garageStmt = db.prepare(`
      SELECT * FROM garage_revenue_schedules WHERE merchant_id = ?
    `);
    const garageSchedules = garageStmt.all(merchantId).map(row => ({
      service_start_date: row.service_start_date,
      service_term: row.service_term,
      revenue_category: row.revenue_category,
      item_name: row.item_name,
      item_description: row.item_description,
      start_date: row.start_date,
      frequency_unit: row.frequency_unit,
      period: row.period,
      number_of_periods: row.number_of_periods,
      arrears: row.arrears === 1,
      billing_type: row.billing_type,
      event_to_track: row.event_to_track,
      integration_item: row.integration_item,
      discounts: row.discounts ? JSON.parse(row.discounts) : [],
      net_terms: row.net_terms,
      quantity: row.quantity,
      total_price: row.total_price,
      pricing_tiers: row.pricing_tiers ? JSON.parse(row.pricing_tiers) : []
    }));
    
    return {
      merchant_id: merchantId,
      pdf_session_id: session.pdf_session_id,
      system_prompt_used: session.system_prompt_used,
      created_at: session.created_at,
      schedules,
      garage_revenue_schedules: garageSchedules
    };
  } catch (err) {
    console.error('Failed to load demo session:', err);
    return null;
  }
}

/* ----------------------- Training Contract Operations ---------------------- */

export function saveTrainingContract(merchantId, fileName, fileBuffer) {
  try {
    ensureMerchant(merchantId);
    
    const stmt = db.prepare(`
      INSERT INTO training_contracts (merchant_id, file_name, file_data, file_size)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(merchant_id) DO UPDATE SET
        file_name = excluded.file_name,
        file_data = excluded.file_data,
        file_size = excluded.file_size,
        uploaded_at = datetime('now')
    `);
    
    stmt.run(merchantId, fileName, fileBuffer, fileBuffer.length);
    console.log(`✅ Saved training contract for ${merchantId}: ${fileName} (${fileBuffer.length} bytes)`);
    return true;
  } catch (err) {
    console.error('Failed to save training contract:', err);
    return false;
  }
}

export function loadTrainingContract(merchantId) {
  try {
    const stmt = db.prepare(`
      SELECT file_name, file_data, file_size, uploaded_at 
      FROM training_contracts 
      WHERE merchant_id = ?
    `);
    const row = stmt.get(merchantId);
    
    if (!row) {
      return null;
    }
    
    return {
      fileName: row.file_name,
      data: row.file_data,
      size: row.file_size,
      uploadedAt: row.uploaded_at
    };
  } catch (err) {
    console.error('Failed to load training contract:', err);
    return null;
  }
}

export function hasTrainingContract(merchantId) {
  const stmt = db.prepare(`
    SELECT 1 FROM training_contracts WHERE merchant_id = ?
  `);
  return stmt.get(merchantId) !== undefined;
}

/* ----------------------- Utility Functions ---------------------- */

export function closeDatabase() {
  db.close();
}

export default db;


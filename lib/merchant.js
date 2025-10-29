import fs from 'fs';
import path from 'path';
import { uploadDir } from './config.js';
import {
  ensureMerchant as dbEnsureMerchant,
  loadMerchantGuidance as dbLoadGuidance,
  saveMerchantGuidance as dbSaveGuidance,
  loadIntegrationMapping as dbLoadMapping,
  saveIntegrationMapping as dbSaveMapping,
  loadDemoSession as dbLoadSession,
  saveDemoSession as dbSaveSession,
  saveTrainingContract as dbSaveContract,
  loadTrainingContract as dbLoadContract,
  hasTrainingContract as dbHasContract,
  listMerchants as dbListMerchants,
  getMerchant as dbGetMerchant,
  updateMerchantTabsCredentials as dbUpdateTabsCredentials,
  updateMerchantTier as dbUpdateTier
} from './db.js';

/* ----------------------- Merchant-Specific Data Management ---------------------- */
// All functions now use the database backend

export function getMerchantDir(merchantId) {
  // Kept for backwards compatibility with any code that might call it
  // But no longer creates directories
  return null;
}

export function loadMerchantGuidance(merchantId) {
  return dbLoadGuidance(merchantId);
}

export function saveMerchantGuidance(merchantId, guidance) {
  return dbSaveGuidance(merchantId, guidance);
}

export function loadIntegrationMapping(merchantId) {
  return dbLoadMapping(merchantId);
}

export function saveIntegrationMapping(merchantId, mapping) {
  return dbSaveMapping(merchantId, mapping);
}

export function saveDemoSession(merchantId, demoData, pdfSessionId) {
  // Load PDF data if session ID is provided
  let pdfData = null;
  if (pdfSessionId) {
    const pdfPath = path.join(uploadDir, `${pdfSessionId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(pdfPath);
      pdfData = {
        fileName: 'training_contract.pdf',
        data: pdfBuffer,
        size: pdfBuffer.length
      };
      console.log(`✅ Loaded PDF for session ${pdfSessionId}: ${pdfBuffer.length} bytes`);
    } else {
      console.warn(`⚠️  PDF not found for session ${pdfSessionId}`);
    }
  }
  
  return dbSaveSession(merchantId, demoData, pdfData);
}

export function loadDemoSession(merchantId) {
  return dbLoadSession(merchantId);
}

export function listMerchants() {
  return dbListMerchants();
}

export function getTrainingContractPath(merchantId) {
  // Return a temporary path for the training contract
  // This is used when we need to access the PDF as a file
  const contract = dbLoadContract(merchantId);
  if (!contract) {
    return null;
  }
  
  // Write to temp file
  const tempPath = path.join(uploadDir, `training_${merchantId}.pdf`);
  fs.writeFileSync(tempPath, contract.data);
  console.log(`✅ Wrote training contract to temp file: ${tempPath}`);
  return tempPath;
}

export function hasTrainingContract(merchantId) {
  return dbHasContract(merchantId);
}

export function getMerchant(merchantId) {
  return dbGetMerchant(merchantId);
}

export function updateMerchantTabsCredentials(merchantId, tabsApiKey, tabsEnv) {
  return dbUpdateTabsCredentials(merchantId, tabsApiKey, tabsEnv);
}

export function updateMerchantTier(merchantId, tier) {
  return dbUpdateTier(merchantId, tier);
}

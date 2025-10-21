import fs from 'fs';
import path from 'path';
import { uploadDir, merchantDataDir } from './config.js';

/* ----------------------- Merchant-Specific Data Management ---------------------- */

export function getMerchantDir(merchantId) {
  const safeMerchantId = String(merchantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(merchantDataDir, safeMerchantId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

export function loadMerchantGuidance(merchantId) {
  try {
    const guidanceFile = path.join(getMerchantDir(merchantId), 'guidance.json');
    if (fs.existsSync(guidanceFile)) {
      return JSON.parse(fs.readFileSync(guidanceFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load merchant guidance:', err);
  }
  return {
    system_additions: '',
    field_specific: {
      item_name: '',
      total_price: '',
      billing_type: '',
      start_date: '',
      frequency_unit: '',
      quantity: '',
      general: ''
    },
    notes: []
  };
}

export function saveMerchantGuidance(merchantId, guidance) {
  try {
    const guidanceFile = path.join(getMerchantDir(merchantId), 'guidance.json');
    fs.writeFileSync(guidanceFile, JSON.stringify(guidance, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save merchant guidance:', err);
    return false;
  }
}

export function loadIntegrationMapping(merchantId) {
  try {
    const mappingFile = path.join(getMerchantDir(merchantId), 'integration_mapping.json');
    if (fs.existsSync(mappingFile)) {
      return JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load integration mapping:', err);
  }
  return [];
}

export function saveIntegrationMapping(merchantId, mapping) {
  try {
    const mappingFile = path.join(getMerchantDir(merchantId), 'integration_mapping.json');
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save integration mapping:', err);
    return false;
  }
}

export function saveDemoSession(merchantId, demoData, pdfSessionId) {
  try {
    const merchantDir = getMerchantDir(merchantId);
    const demoFile = path.join(merchantDir, 'demo_session.json');
    
    // Save the JSON data
    fs.writeFileSync(demoFile, JSON.stringify(demoData, null, 2));
    console.log(`✅ Saved demo_session.json for ${merchantId} to ${demoFile}`);
    
    // If there's a PDF session ID, copy that PDF to the merchant folder
    if (pdfSessionId) {
      const sourcePdf = path.join(uploadDir, `${pdfSessionId}.pdf`);
      const destPdf = path.join(merchantDir, 'training_contract.pdf');
      
      console.log(`Looking for source PDF: ${sourcePdf}`);
      console.log(`PDF exists: ${fs.existsSync(sourcePdf)}`);
      
      if (fs.existsSync(sourcePdf)) {
        fs.copyFileSync(sourcePdf, destPdf);
        console.log(`✅ Copied training PDF for ${merchantId}: ${sourcePdf} -> ${destPdf}`);
        
        // Verify the copy
        if (fs.existsSync(destPdf)) {
          const stats = fs.statSync(destPdf);
          console.log(`✅ Verified training_contract.pdf exists (${stats.size} bytes)`);
        } else {
          console.error(`❌ training_contract.pdf not found after copy!`);
        }
      } else {
        console.warn(`⚠️ PDF not found for session ${pdfSessionId} at ${sourcePdf}`);
        // List what files ARE in uploads
        const uploadFiles = fs.readdirSync(uploadDir);
        console.log(`Files in uploads dir: ${uploadFiles.join(', ')}`);
      }
    }
    
    return true;
  } catch (err) {
    console.error('❌ Failed to save demo session:', err);
    return false;
  }
}

export function loadDemoSession(merchantId) {
  try {
    const demoFile = path.join(getMerchantDir(merchantId), 'demo_session.json');
    if (fs.existsSync(demoFile)) {
      return JSON.parse(fs.readFileSync(demoFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load demo session:', err);
  }
  return null;
}

export function listMerchants() {
  try {
    const merchants = [];
    const dirs = fs.readdirSync(merchantDataDir);
    
    for (const dir of dirs) {
      const fullPath = path.join(merchantDataDir, dir);
      if (fs.statSync(fullPath).isDirectory()) {
        // Check if merchant has demo session
        const hasDemoSession = fs.existsSync(path.join(fullPath, 'demo_session.json'));
        merchants.push({
          id: dir,
          name: dir.replace(/_/g, ' '), // Convert underscores back to spaces for display
          hasDemoSession
        });
      }
    }
    
    return merchants;
  } catch (err) {
    console.error('Failed to list merchants:', err);
    return [];
  }
}



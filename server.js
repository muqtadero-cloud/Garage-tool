import express from 'express';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import fetch from 'node-fetch';
import xlsx from 'xlsx';

// Import configuration
import { client, upload, uploadDir, PORT, getProjectRoot } from './lib/config.js';

// Import merchant data management
import {
  getMerchantDir,
  loadMerchantGuidance,
  saveMerchantGuidance,
  loadIntegrationMapping,
  saveIntegrationMapping,
  saveDemoSession,
  loadDemoSession,
  listMerchants
} from './lib/merchant.js';

// Import AI functions
import { buildSystemPrompt, parseModelJson, setupQualityRerun } from './lib/ai.js';

// Import utilities
import {
  fuzzyMatchIntegrationItem,
  normalizeSchedules,
  computeAgreement,
  toGarageAllStrict
} from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' }));

// Setup quality rerun monkey-patch
setupQualityRerun();

/* ------------------- ROUTES ------------------- */

// Parse integration file (Excel)
app.post('/api/parse-integration-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    const rows = data.filter(row => row.some(cell => cell !== ''));
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }
    
    const headers = rows[0];
    const preview = rows.slice(0, 6);
    
    res.json({
      headers,
      preview,
      totalRows: rows.length,
      columns: headers.map((h, i) => ({ index: i, name: h || `Column ${i + 1}` }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file', debug: { message: err?.message } });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// Extract contract schedules
app.post('/api/extract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const sessionId = Date.now() + '_' + Math.random().toString(36).substring(7);
  const pdfPath = path.join(uploadDir, `${sessionId}.pdf`);
  
  try {
    const { model = 'o3', forceMulti = 'auto', runs = '2', format, merchantId = 'default', stage = 'demo', consistency = 'consistent' } = req.query;
    const chosenModel = ['o3','o4-mini','gpt-4o-mini','o3-mini'].includes(model) ? model : 'o3';
    const agreementRuns = Math.max(1, Math.min(5, Number(runs) || 1));

    // Save PDF
    console.log(`📄 Saving PDF with session ID: ${sessionId}`);
    fs.copyFileSync(req.file.path, pdfPath);
    console.log(`✅ PDF saved to: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);

    // Load merchant data
    const merchantGuidance = loadMerchantGuidance(merchantId);
    let integrationPairs = loadIntegrationMapping(merchantId);
    const demoSession = (stage === 'production') ? loadDemoSession(merchantId) : null;
    
    // Parse integration mapping from request body if provided
    if (req.body && req.body.integration_mapping) {
      try {
        const uploaded = JSON.parse(req.body.integration_mapping);
        if (Array.isArray(uploaded) && uploaded.length > 0) {
          integrationPairs = uploaded;
          saveIntegrationMapping(merchantId, uploaded);
        }
      } catch {}
    }

    // Upload contract PDF to OpenAI
    const uploaded = await client.files.create({
      file: await toFile(fs.createReadStream(req.file.path), req.file.originalname || 'contract.pdf'),
      purpose: 'assistants'
    });

    const systemPrompt = buildSystemPrompt(forceMulti, merchantGuidance.system_additions || '', demoSession, consistency);

    // Log the system prompt to verify demo data is included
    if (stage === 'production' && demoSession) {
      console.log('\n========== PRODUCTION MODE SYSTEM PROMPT ==========');
      console.log(`Using demo session for merchant: ${merchantId}`);
      console.log(`Demo session has ${demoSession.schedules?.length || 0} training examples`);
      
      // Show a snippet of the corrections being sent
      if (demoSession.schedules && demoSession.schedules[0]) {
        const firstExample = demoSession.schedules[0];
        console.log('\n📚 Training Example #1:');
        console.log(`  Item: "${firstExample.item_name}"`);
        console.log(`  Billing Type: ${firstExample.billing_type}`);
        console.log(`  Quantity: ${firstExample.quantity}`);
        if (firstExample.original_ai_extraction) {
          console.log('\n⚠️ Corrections in training:');
          if (firstExample.original_ai_extraction.billing_type !== firstExample.billing_type) {
            console.log(`  • Billing Type: ${firstExample.original_ai_extraction.billing_type} → ${firstExample.billing_type}`);
          }
          if (firstExample.original_ai_extraction.quantity !== firstExample.quantity) {
            console.log(`  • Quantity: ${firstExample.original_ai_extraction.quantity} → ${firstExample.quantity}`);
          }
        }
        if (firstExample.instruction_billing_type) {
          console.log(`\n📝 Instruction: "${firstExample.instruction_billing_type}"`);
        }
      }
      console.log('\n===================================================\n');
    }

    // Build input messages
    const inputMessages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // In production mode, add few-shot example from training PDF
    if (stage === 'production' && demoSession) {
      const trainingPdfPath = path.join(getMerchantDir(merchantId), 'training_contract.pdf');
      
      if (fs.existsSync(trainingPdfPath)) {
        console.log(`Loading training PDF for ${merchantId} as few-shot example`);
        
        const trainingFileUpload = await client.files.create({
          file: await toFile(fs.createReadStream(trainingPdfPath), 'training_contract.pdf'),
          purpose: 'assistants'
        });
        
        inputMessages.push({
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extract Garage-ready revenue schedules as a single JSON object.' },
            { type: 'input_file', file_id: trainingFileUpload.id }
          ]
        });
        
        const exampleOutput = {
          revenue_schedules: demoSession.schedules.map(s => ({
            item_name: s.item_name,
            description: s.description || '',
            total_price: s.total_price,
            billing_type: s.billing_type,
            quantity: s.quantity || 1,
            start_date: s.start_date,
            frequency_unit: s.frequency_unit,
            frequency_every: s.frequency_every || 1,
            periods: s.periods || 1,
            months_of_service: s.months_of_service || 12,
            net_terms: s.net_terms || 0,
            billing_timing: s.billing_timing || 'first',
            arrears: s.arrears || false,
            event_to_track: s.event_to_track || '',
            tiers: s.tiers || []
          }))
        };
        
        inputMessages.push({
          role: 'assistant',
          content: JSON.stringify(exampleOutput, null, 2)
        });
        
        console.log(`Added few-shot example with ${demoSession.schedules.length} schedules`);
      } else {
        console.log(`Training PDF not found for ${merchantId} at ${trainingPdfPath}`);
      }
    }
    
    // Add the actual contract to extract
    inputMessages.push({
      role: 'user',
      content: [
        { type: 'input_text', text: 'Extract Garage-ready revenue schedules as a single JSON object.' },
        { type: 'input_file', file_id: uploaded.id }
      ]
    });

    // First extraction run
    const response1 = await client.responses.create({
      model: chosenModel,
      input: inputMessages,
      text: { format: { type: 'json_object' } }
    });
    const data1 = parseModelJson(response1);
    const norm1 = normalizeSchedules(data1);

    // Optional second run for agreement scoring
    let agreement = null;
    if (agreementRuns >= 2) {
      const response2 = await client.responses.create({
        model: chosenModel,
        input: inputMessages,
        text: { format: { type: 'json_object' } }
      });
      const data2 = parseModelJson(response2);
      const norm2 = normalizeSchedules(data2);
      const agr = computeAgreement(norm1, norm2);
      agr.enriched.forEach((extra, idx) => Object.assign(norm1[idx], extra));
      agreement = agr.summary;
    }

    // Apply fuzzy matching to integration items
    norm1.forEach(schedule => {
      if (schedule.item_name && integrationPairs.length > 0) {
        const matchResult = fuzzyMatchIntegrationItem(schedule.item_name, integrationPairs);
        schedule.integration_item = matchResult.integration_item;
        schedule.integration_match_confidence = matchResult.match_confidence;
        schedule.integration_match_score = matchResult.match_score;
        schedule.integration_matched_name = matchResult.matched_contract_name;
      }
    });

    const garage = toGarageAllStrict(norm1);

    res.json({
      model_used: chosenModel,
      runs: agreementRuns,
      merchant_id: merchantId,
      stage: stage,
      system_prompt: systemPrompt,
      schedules: norm1,
      garage_revenue_schedules: garage,
      model_recommendations: data1.model_recommendations ?? null,
      issues: Array.isArray(data1.issues) ? data1.issues : [],
      totals_check: data1.totals_check ?? null,
      agreement_summary: agreement ?? null,
      integration_mappings_used: integrationPairs.length,
      demo_session_loaded: demoSession ? true : false,
      pdf_session_id: sessionId
    });
  } catch (err) {
    res.status(500).json({ error: 'Extraction failed', debug: { message: err?.message } });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// Use contract assistant (API endpoint for Tabs integration)
app.get('/api/use-contract-assistant', async (req, res) => {
  const { contractID, model = 'o3', forceMulti = 'auto', format, env = 'dev' } = req.query;
  const entryKey = req.headers['entrykey'] || req.headers['entryKey'];
  if (!entryKey || entryKey !== process.env.USE_CONTRACT_PROCESSING_KEY) return res.status(401).json({ error: 'Invalid or missing entryKey' });
  if (!contractID) return res.status(400).json({ error: 'Missing contractID' });

  const isProd = String(env || '').toLowerCase() === 'prod';
  const apiEndpoint = isProd ? 'https://integrators.prod.api.tabsplatform.com' : 'https://integrators.dev.api.tabsplatform.com';
  const apiKey = isProd ? process.env.LUXURY_PRESENCE_TABS_API_KEY : process.env.LUXURY_PRESENCE_TABS_DEV_API_KEY;

  let pdfResp;
  try {
    pdfResp = await fetch(`${apiEndpoint}/v3/contracts/${contractID}/file`, {
      headers: { 'accept': 'application/pdf', 'Authorization': `${apiKey}` }
    });
    if (!pdfResp.ok) throw new Error(`Failed to fetch PDF for contract ${contractID}: ${pdfResp.status}`);
  } catch (err) {
    console.error('PDF fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch PDF: ' + err.message });
  }
  
  const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
  
  const maxRetries = 3;
  const retryDelay = 5000;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tempPath = `/tmp/${contractID}.pdf`;
      await fs.promises.writeFile(tempPath, pdfBuffer);

      const uploaded = await client.files.create({
        file: await toFile(fs.createReadStream(tempPath), `${contractID}.pdf`),
        purpose: 'assistants'
      });

      const response = await client.responses.create({
        model,
        input: [
          { role: 'system', content: buildSystemPrompt(forceMulti) },
          { role: 'user', content: [
              { type: 'input_text', text: 'Extract Garage-ready revenue schedules as a single JSON object.' },
              { type: 'input_file', file_id: uploaded.id }
          ] }
        ],
        text: { format: { type: 'json_object' } }
      });

      const data = parseModelJson(response);
      const normalized = normalizeSchedules(data);
      const garage = toGarageAllStrict(normalized);

      if (String(format || '').toLowerCase() !== 'full') {
        fs.unlink(tempPath, () => {});
        return res.json({ revenue_schedule: garage });
      }

      res.json({
        model_used: model,
        schedules: normalized,
        garage_revenue_schedules: garage,
        model_recommendations: data.model_recommendations ?? null,
        issues: Array.isArray(data.issues) ? data.issues : [],
        totals_check: data.totals_check ?? null
      });

      fs.unlink(tempPath, () => {});
      return;
    } catch (err) {
      lastError = err;
      console.error(`use-contract-assistant error (attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error('use-contract-assistant failed after all retries:', lastError);
  res.status(500).json({ error: lastError.message });
});

// Save merchant guidance
app.post('/api/save-guidance', express.json(), (req, res) => {
  try {
    const { merchantId, guidance } = req.body;
    if (!merchantId) return res.status(400).json({ error: 'merchantId required' });
    
    const success = saveMerchantGuidance(merchantId, guidance);
    if (success) {
      res.json({ success: true, message: 'Guidance saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save guidance' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Save failed', debug: { message: err?.message } });
  }
});

// Load merchant guidance
app.get('/api/load-guidance', (req, res) => {
  try {
    const { merchantId = 'default' } = req.query;
    const guidance = loadMerchantGuidance(merchantId);
    res.json({ guidance });
  } catch (err) {
    res.status(500).json({ error: 'Load failed', debug: { message: err?.message } });
  }
});

// Save integration mapping
app.post('/api/save-integration-mapping', express.json(), (req, res) => {
  try {
    const { merchantId, mapping } = req.body;
    if (!merchantId) return res.status(400).json({ error: 'merchantId required' });
    
    const success = saveIntegrationMapping(merchantId, mapping);
    if (success) {
      res.json({ success: true, message: 'Integration mapping saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save mapping' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Save failed', debug: { message: err?.message } });
  }
});

// Extract MIS instructions
app.post('/api/extract-mis-instructions', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const { merchantId = 'default' } = req.body;
    
    console.log(`📄 Processing MIS file for ${merchantId}: ${req.file.originalname}`);
    
    const uploaded = await client.files.create({
      file: await toFile(fs.createReadStream(req.file.path), req.file.originalname),
      purpose: 'assistants'
    });
    
    const response = await client.responses.create({
      model: 'gpt-4o',
      input: [
        { 
          role: 'system', 
          content: `You are an expert at extracting contract processing instructions from MIS (Management Information System) documents.

Your task is to analyze the provided MIS document and extract GENERAL INSTRUCTIONS that should be used when processing contracts for revenue schedule extraction.

Focus on extracting:
- Guidelines for finding specific fields (dates, prices, billing terms, etc.)
- Common terminology used in this merchant's contracts
- Special handling rules or exceptions
- Field mapping instructions
- Data format expectations
- Any merchant-specific contract patterns

Format your response as clear, actionable instructions that will help an AI model accurately extract revenue schedule data from contracts.

Output ONLY the instructions text, without any preamble or meta-commentary.`
        },
        { 
          role: 'user', 
          content: [
            { type: 'input_text', text: 'Extract general contract processing instructions from this MIS document.' },
            { type: 'input_file', file_id: uploaded.id }
          ]
        }
      ]
    });
    
    // Handle different response formats
    let instructions = '';
    
    if (response.output_text) {
      instructions = response.output_text;
    } else if (response.output) {
      if (Array.isArray(response.output.content)) {
        instructions = response.output.content[0]?.text || '';
      } else if (typeof response.output === 'string') {
        instructions = response.output;
      } else if (response.output.text) {
        instructions = response.output.text;
      }
    } else if (response.text) {
      if (typeof response.text === 'string') {
        instructions = response.text;
      } else if (response.text.content) {
        instructions = response.text.content;
      }
    } else if (response.instructions) {
      instructions = response.instructions;
    } else if (typeof response === 'string') {
      instructions = response;
    }
    
    console.log(`✅ Extracted ${instructions.length} characters of instructions from MIS`);
    
    res.json({
      success: true,
      instructions: instructions,
      merchant_id: merchantId,
      length: instructions.length
    });
    
  } catch (err) {
    console.error('MIS extraction error:', err);
    res.status(500).json({ error: 'Failed to extract instructions', debug: { message: err?.message } });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// Save demo session
app.post('/api/save-demo-session', express.json(), (req, res) => {
  try {
    const demoData = req.body;
    if (!demoData.merchant_id) return res.status(400).json({ error: 'merchant_id required' });
    if (!demoData.schedules || !Array.isArray(demoData.schedules)) {
      return res.status(400).json({ error: 'schedules array required' });
    }
    
    // CRITICAL: Regenerate garage_revenue_schedules from the CORRECTED schedules
    // This ensures production mode uses the corrected values, not the original AI extraction
    console.log('Regenerating Garage output from corrected schedules...');
    demoData.garage_revenue_schedules = toGarageAllStrict(demoData.schedules);
    console.log(`Generated ${demoData.garage_revenue_schedules.length} Garage schedules from corrected data`);
    
    const pdfSessionId = demoData.pdf_session_id || null;
    const success = saveDemoSession(demoData.merchant_id, demoData, pdfSessionId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Demo session saved for ${demoData.merchant_id}`,
        schedules_count: demoData.schedules.length,
        pdf_saved: !!pdfSessionId
      });
    } else {
      res.status(500).json({ error: 'Failed to save demo session' });
    }
  } catch (err) {
    console.error('Save demo session error:', err);
    res.status(500).json({ error: 'Save failed', debug: { message: err?.message } });
  }
});

// Load demo session
app.get('/api/load-demo-session', (req, res) => {
  try {
    const { merchantId = 'default' } = req.query;
    const demoSession = loadDemoSession(merchantId);
    if (demoSession) {
      res.json({ success: true, demoSession });
    } else {
      res.json({ success: false, message: 'No demo session found for this merchant' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Load failed', debug: { message: err?.message } });
  }
});

// List merchants
app.get('/api/list-merchants', (req, res) => {
  try {
    const merchants = listMerchants();
    res.json({ merchants });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list merchants', debug: { message: err?.message } });
  }
});

// View PDF
app.get('/api/view-pdf/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const pdfPath = path.join(uploadDir, `${sessionId}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF not found or expired' });
    }
    
    res.contentType('application/pdf');
    res.sendFile(path.resolve(pdfPath));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load PDF', debug: { message: err?.message } });
  }
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    const models = await client.models.list();
    res.json({ ok: true, models: models.data.slice(0, 3).map(m => m.id) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Export for Vercel
export default app;

// Start server (not on Vercel)
if (!process.env.VERCEL) {
  const bindHost = process.env.HOST || '0.0.0.0';
  app.listen(PORT, bindHost, () => {
    console.log(`Garage assistant running on http://${bindHost}:${PORT}`);
  });
}

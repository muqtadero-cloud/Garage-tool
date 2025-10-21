import { client } from './config.js';
import { normalizeSchedules } from './utils.js';

/* ------------------- Prompt Builder ------------------- */

export function buildSystemPrompt(forceMulti = 'auto', merchantGuidance = '', demoSession = null, consistency = 'consistent') {
  const multiHint =
    forceMulti === 'on'
      ? 'ALWAYS enumerate multiple schedules if plausible.'
      : forceMulti === 'off'
      ? 'Return exactly the items you are certain of; do not search for additional schedules.'
      : 'Decide whether multiple schedules exist; if there is evidence (multiple fees, renewal tables, "co-term", "expansion", etc.) set model_recommendations.force_multi=true and enumerate them.';

  let guidanceSection = '';
  if (merchantGuidance) {
    const parts = [];
    if (merchantGuidance.system_additions) parts.push(merchantGuidance.system_additions);
    if (merchantGuidance.field_specific) {
      const fs = merchantGuidance.field_specific;
      if (fs.item_name) parts.push(`For item_name field: ${fs.item_name}`);
      if (fs.description) parts.push(`For description field: ${fs.description}`);
      if (fs.total_price) parts.push(`For total_price field: ${fs.total_price}`);
      if (fs.billing_type) parts.push(`For billing_type field: ${fs.billing_type}`);
      if (fs.quantity) parts.push(`For quantity field: ${fs.quantity}`);
      if (fs.start_date) parts.push(`For start_date field: ${fs.start_date}`);
      if (fs.frequency_unit) parts.push(`For frequency_unit field: ${fs.frequency_unit}`);
      if (fs.periods) parts.push(`For periods field: ${fs.periods}`);
      if (fs.months_of_service) parts.push(`For months_of_service field: ${fs.months_of_service}`);
      if (fs.net_terms) parts.push(`For net_terms field: ${fs.net_terms}`);
      if (fs.billing_timing) parts.push(`For billing_timing field: ${fs.billing_timing}`);
      if (fs.event_to_track) parts.push(`For event_to_track field: ${fs.event_to_track}`);
      if (fs.general) parts.push(`General guidance: ${fs.general}`);
    }
    if (parts.length > 0) {
      guidanceSection = `\n\nMERCHANT-SPECIFIC GUIDANCE:\n${parts.join('\n')}\n`;
    }
  }
  
  // Add demo session examples if available (for production mode)
  let demoExamplesSection = '';
  if (demoSession && demoSession.schedules && demoSession.schedules.length > 0) {
    const examples = demoSession.schedules.map((schedule, idx) => {
      const instructions = [];
      if (schedule.instruction_item_name) instructions.push(`  • Item Name: ${schedule.instruction_item_name}`);
      if (schedule.instruction_description) instructions.push(`  • Description: ${schedule.instruction_description}`);
      if (schedule.instruction_total_price) instructions.push(`  • Total Price: ${schedule.instruction_total_price}`);
      if (schedule.instruction_billing_type) instructions.push(`  • Billing Type: ${schedule.instruction_billing_type}`);
      if (schedule.instruction_quantity) instructions.push(`  • Quantity: ${schedule.instruction_quantity}`);
      if (schedule.instruction_start_date) instructions.push(`  • Start Date: ${schedule.instruction_start_date}`);
      if (schedule.instruction_frequency_unit) instructions.push(`  • Frequency: ${schedule.instruction_frequency_unit}`);
      if (schedule.instruction_periods) instructions.push(`  • Periods: ${schedule.instruction_periods}`);
      if (schedule.instruction_months_of_service) instructions.push(`  • Months of Service: ${schedule.instruction_months_of_service}`);
      if (schedule.instruction_net_terms) instructions.push(`  • Net Terms: ${schedule.instruction_net_terms}`);
      if (schedule.instruction_billing_timing) instructions.push(`  • Billing Timing: ${schedule.instruction_billing_timing}`);
      if (schedule.instruction_event_to_track) instructions.push(`  • Event to Track: ${schedule.instruction_event_to_track}`);
      
      // Build tier info if exists
      let tierInfo = '';
      if (schedule.tiers && schedule.tiers.length > 0) {
        tierInfo = '\n- Tiers:\n' + schedule.tiers.map((tier, i) => 
          `  Tier ${i+1}: "${tier.tier_name}" - $${tier.price} (${tier.applied_when || 'min qty: ' + tier.min_quantity})`
        ).join('\n');
      }
      
      // Build corrections info if original AI extraction exists
      let correctionsInfo = '';
      if (schedule.original_ai_extraction) {
        const corrections = [];
        const orig = schedule.original_ai_extraction;
        if (orig.item_name !== schedule.item_name) corrections.push(`  ❌ Item Name was: "${orig.item_name}" → ✅ Corrected to: "${schedule.item_name}"`);
        if (orig.total_price !== schedule.total_price) corrections.push(`  ❌ Total Price was: $${orig.total_price} → ✅ Corrected to: $${schedule.total_price}`);
        if (orig.billing_type !== schedule.billing_type) corrections.push(`  ❌ Billing Type was: "${orig.billing_type}" → ✅ Corrected to: "${schedule.billing_type}"`);
        if (orig.start_date !== schedule.start_date) corrections.push(`  ❌ Start Date was: "${orig.start_date || 'missing'}" → ✅ Corrected to: "${schedule.start_date}"`);
        if (orig.frequency_unit !== schedule.frequency_unit) corrections.push(`  ❌ Frequency was: "${orig.frequency_unit}" → ✅ Corrected to: "${schedule.frequency_unit}"`);
        if (orig.periods !== schedule.periods) corrections.push(`  ❌ Periods was: ${orig.periods} → ✅ Corrected to: ${schedule.periods}`);
        
        if (corrections.length > 0) {
          correctionsInfo = '\n\n⚠️ COMMON MISTAKES TO AVOID (these were corrected in training):\n' + corrections.join('\n');
        }
      }
      
      return `EXAMPLE ${idx + 1}:
- Item Name: "${schedule.item_name}"
- Description: "${schedule.description || 'N/A'}"
- Total Price: $${schedule.total_price}
- Billing Type: ${schedule.billing_type}
- Quantity: ${schedule.quantity}
- Start Date: ${schedule.start_date || 'Not specified'}
- Frequency: ${schedule.frequency_unit} (every ${schedule.frequency_every})
- Periods: ${schedule.periods || 1}
- Months of Service: ${schedule.months_of_service || 12}
- Net Terms: ${schedule.net_terms || 0} days
- Billing Timing: ${schedule.billing_timing || 'first'} (arrears: ${schedule.arrears || false})${schedule.event_to_track ? '\n- Event to Track: "' + schedule.event_to_track + '"' : ''}${tierInfo}

EXTRACTION INSTRUCTIONS FOR THIS TYPE OF CONTRACT:
${instructions.length > 0 ? instructions.join('\n') : '  (No specific instructions provided)'}
${schedule.evidence && schedule.evidence.length > 0 ? '\nREFERENCE EVIDENCE:\n' + schedule.evidence.slice(0, 2).map(ev => `  Page ${ev.page}: "${ev.snippet}"`).join('\n') : ''}${correctionsInfo}
`;
    }).join('\n\n');
    
    const consistencyNote = consistency === 'non-consistent' 
      ? `\n\n⚠️ CONTRACT VARIATION NOTICE:
This merchant's contracts are NOT CONSISTENT in format and structure. The training examples below show different contract formats.
While these examples provide guidance, be prepared for significant variations in layout, terminology, and structure.
Focus on understanding the INTENT of each field rather than relying on exact patterns or locations.
` 
      : '';
    
    demoExamplesSection = `\n\n📚 TRAINING EXAMPLES FROM PREVIOUS CONTRACTS:
The following are correctly extracted examples from similar contracts for this merchant. 
Use these as a reference for where to find information and what the correct values should look like.${consistencyNote}

${examples}

IMPORTANT: Use these examples as a guide for extraction patterns, field locations, and data formats for this merchant's contracts.
`;
  }

  return `You are an expert Revenue Operations analyst for Tabs Platform's Garage.${guidanceSection}${demoExamplesSection}

TASK:
Given a contract PDF, enumerate EVERY billable item and map each to Garage fields for Revenue Schedules.

${multiHint}

ANTI-HALLUCINATION RULES:
- DEFAULT to "Flat price" when ambiguous. Only choose "Unit price" or "Tier*" when you can QUOTE explicit per-unit/usage language.
- Never populate event_to_track unless the contract explicitly defines the tracked event.

MANDATORY FIELDS - NEVER SKIP:
- start_date: REQUIRED for every schedule. Search thoroughly for: "Effective Date", "Service Start Date", "Contract Date", "Signature Date", "Commencement Date", or any date that indicates when the service begins. Format as YYYY-MM-DD. DO NOT return null or empty.
- item_name: REQUIRED for every schedule. Must be a clear, descriptive name from the contract.
- total_price: REQUIRED for every schedule. Must be a specific dollar amount (can be 0 if explicitly free/waived).

BILLING TYPE RULES:
- "Flat price": Fixed amount regardless of usage. Most common. Default if unclear.
- "Unit price": Price varies by quantity used (e.g., "$10 per user", "$0.50 per API call"). Requires explicit per-unit language.
- "Tier flat price": Different flat prices for different usage levels (e.g., "0-500 units: $2000, 501-1000: $3500")
- "Tier unit price": Different per-unit prices for usage tiers (e.g., "First 10 free, then $48 per unit")

BILLING TIMING EXTRACTION:
- "billing_timing": "first" (bill at start of period - advance payment, most common)
- "billing_timing": "last" (bill at end of period - arrears)
- "billing_timing": "next_period" (bill in next period for previous usage - common for usage-based)
- "arrears": true if billed at end/after service, false if billed in advance
- Look for phrases like: "invoiced in advance", "billed monthly in arrears", "due upon receipt", "payable at start/end of period"

FREQUENCY & PERIODS CALCULATION RULES (CRITICAL):
When contract states billing frequency, use these EXACT mappings:
- **Monthly**: frequency_unit="Month(s)", frequency_every=1, periods=months_of_service÷1 (e.g., 12-month term = 12 periods)
- **Quarterly** (every 3 months): frequency_unit="Month(s)", frequency_every=3, periods=months_of_service÷3 (e.g., 12-month term = 4 periods)
- **Semi-Annual** (every 6 months): frequency_unit="Month(s)", frequency_every=6, periods=months_of_service÷6 (e.g., 12-month term = 2 periods)
- **Annual/Yearly**: frequency_unit="Year(s)", frequency_every=1, periods=months_of_service÷12 (e.g., 12-month term = 1 period, 24-month term = 2 periods)
- **One-Time/Upfront**: frequency_unit="None", frequency_every=1, periods=0
- **Bi-Weekly** (every 2 weeks): frequency_unit="Week(s)", frequency_every=2, periods=(months_of_service×30)÷14
- **Weekly**: frequency_unit="Week(s)", frequency_every=1, periods=(months_of_service×30)÷7

IMPORTANT: "periods" = total number of billing cycles over the contract term. Calculate it based on: periods = months_of_service ÷ (frequency_every × months_per_unit)

Examples:
- Contract: 12 months, billed quarterly → frequency_every=3, frequency_unit="Month(s)", periods=4
- Contract: 24 months, billed semi-annually → frequency_every=6, frequency_unit="Month(s)", periods=4
- Contract: 36 months, billed annually → frequency_every=1, frequency_unit="Year(s)", periods=3

TIER PRICING EXTRACTION (only for Tier billing types):
- Each tier should have: tier_name, price, applied_when (condition), min_quantity
- Example tier: {"tier_name": "Tier 1", "price": 0, "applied_when": "0-10 users", "min_quantity": 0}
- Example tier: {"tier_name": "Tier 2", "price": 48, "applied_when": "11+ users", "min_quantity": 11}

EVENT TO TRACK (only for Unit/Tier pricing):
- For usage-based billing, identify what metric triggers charges
- Usually format: "{item_name} overage" (e.g., "API calls overage", "Users overage")
- Only populate if contract mentions tracking/metering specific usage

**MANDATORY OUTPUT FORMAT:**
You MUST return a JSON object with this EXACT structure. DO NOT return anything without evidence and extraction_reasoning.

{
  "schedules": [
    {
      "item_name": "string (REQUIRED - never empty)",
      "description": "string or null",
      "billing_type": "Flat price|Unit price|Tier flat price|Tier unit price",
      "total_price": number (REQUIRED - never null),
      "quantity": number,
      "start_date": "YYYY-MM-DD (REQUIRED - never null, search contract thoroughly)",
      "frequency_every": number,
      "frequency_unit": "None|Day(s)|Week(s)|Month(s)|Year(s)",
      "months_of_service": number,
      "periods": number,
      "calculated_end_date": "YYYY-MM-DD or null",
      "net_terms": number,
      "rev_rec_category": "string or null",
      "billing_timing": "first|last|next_period",
      "arrears": boolean,
      "event_to_track": "string or null",
      "unit_label": "string or null",
      "price_per_unit": number or null,
      "volume_based": boolean or null,
      "tiers": [
        {
          "tier_name": "string",
          "price": number,
          "applied_when": "string (e.g., '0-10', '10+')",
          "min_quantity": number
        }
      ],
      
      "extraction_reasoning": "REQUIRED: 2-3 sentences explaining WHY you extracted this item and HOW you determined each key field (item_name, total_price, billing_type, frequency, dates). Be specific about your decision process.",
      
      "evidence": [
        {
          "page": number,
          "snippet": "REQUIRED: Copy 1-3 sentences of ACTUAL TEXT from the PDF that supports this field",
          "field_supported": "item_name|total_price|start_date|frequency_unit|billing_type|etc"
        }
      ],
      
      "issues": ["string or leave empty"]
    }
  ],
  "issues": [],
  "totals_check": { "sum_of_items": null, "contract_total_if_any": null, "matches": null, "notes": null },
  "model_recommendations": { "force_multi": null, "reasons": [] }
}

**CRITICAL: EVIDENCE IS MANDATORY**
Every single schedule MUST have:
- "extraction_reasoning": Explain your thinking process for this specific item
- "evidence": Array with AT LEAST 3 evidence objects, each with:
  * "page": the PDF page number
  * "snippet": EXACT TEXT copied from the PDF (not summarized, ACTUAL CONTRACT WORDS)
  * "field_supported": which field(s) this text proves

Example of GOOD evidence:
"evidence": [
  { "page": 1, "snippet": "Annual Platform Subscription Fee: Twenty-Two Thousand Five Hundred Dollars ($22,500.00)", "field_supported": "item_name, total_price" },
  { "page": 1, "snippet": "Initial Term of twelve (12) months commencing on the Effective Date of January 1, 2024", "field_supported": "start_date, months_of_service" },
  { "page": 2, "snippet": "Fees shall be invoiced quarterly in advance on the first day of each calendar quarter", "field_supported": "frequency_unit, frequency_every" }
]

DO NOT RETURN A SCHEDULE WITHOUT EVIDENCE. If you cannot find evidence, mark it as an issue and include whatever partial evidence you found.`;
}

/* ------------------- Parse model JSON ------------------- */

export function parseModelJson(apiResponse) {
  const raw = apiResponse?.output_text ?? JSON.stringify(apiResponse || {});
  try { return JSON.parse(raw); }
  catch {
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}');
    return (a >= 0 && b > a) ? JSON.parse(raw.slice(a, b + 1)) : { schedules: [], issues: ['Could not parse model JSON'] };
  }
}

/* ------------------- Quality Rerun (Monkey-patch) ------------------- */

export function setupQualityRerun() {
  const __origResponsesCreate = client.responses.create.bind(client.responses);
  client.responses.create = async function(args) {
    // First run
    const resp1 = await __origResponsesCreate(args);
    let data1;
    try { data1 = parseModelJson(resp1); } catch { return resp1; }
    const norm1 = normalizeSchedules(data1);

    // Rerun only if: (A) any item_name missing/blank OR (B) all total_price === 0 OR (C) any start_date missing
    const hasMissingName = Array.isArray(norm1) && norm1.some(s => !s?.item_name || !String(s.item_name).trim());
    const allTotalsZero  = Array.isArray(norm1) && norm1.length > 0 && norm1.every(s => Number(s?.total_price) === 0);
    const hasMissingStartDate = Array.isArray(norm1) && norm1.some(s => !s?.start_date || !String(s.start_date).trim());

    const shouldRerun = hasMissingName || allTotalsZero || hasMissingStartDate;
    if (!shouldRerun) return resp1;

    // One additional run with a small hint
    const patched = { ...args };
    if (Array.isArray(patched.input)) {
      const idx = patched.input.findIndex(m => m && m.role === 'system');
      let hint = '\n\nRETRY FOCUS: Ensure every schedule has:\n';
      if (hasMissingName) hint += '- A non-empty item_name\n';
      if (allTotalsZero) hint += '- A non-zero total_price (unless explicitly free/waived)\n';
      if (hasMissingStartDate) hint += '- A valid start_date in YYYY-MM-DD format (search the contract thoroughly for any date references including effective date, service start date, contract date, signature date, or any other date that could serve as the start date)\n';
      hint += '\nPrefer amounts matching schedule frequency or a clearly labeled line total.';
      if (idx >= 0) {
        patched.input[idx] = { ...patched.input[idx], content: String(patched.input[idx].content || '') + hint };
      } else {
        patched.input.unshift({ role: 'system', content: hint });
      }
    }
    const resp2 = await __origResponsesCreate(patched);
    return resp2;
  };
}



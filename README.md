# 🚗 Garage Contract Assistant v0.3

> AI-powered contract revenue schedule extraction with merchant-specific training and few-shot learning

Extract revenue schedules from contract PDFs with high accuracy using OpenAI's reasoning models (o3/o4-mini), merchant-specific training data, and automatic correction tracking.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Core Concepts](#-core-concepts)
- [Features Overview](#-features-overview)
- [Two-Mode System](#-two-mode-system)
- [Merchant Training System](#-merchant-training-system)
- [Architecture](#-architecture)
  - [Complete System Workflow](#complete-system-workflow) 🔥
  - [Technical Processing Flow](#technical-processing-flow) 🔥
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Create .env file
echo "OPENAI_API_KEY=sk-your-key-here" > .env
echo "PORT=3000" >> .env

# Start server
npm run dev
```

### First Use

1. Open http://localhost:3000
2. **Select Merchant** or create new one
3. Choose **Demo Mode** (for training) or **Production Mode** (for live extraction)
4. Upload contract PDF
5. Review, correct, and add instructions (Demo mode)
6. Save training data for future contracts

---

## 💡 Core Concepts

### What Problem Does This Solve?

Contract revenue schedules are complex and vary by merchant. Traditional rules-based extraction fails because:
- Every merchant has different contract formats
- Terminology varies (e.g., "per Billing Unit" vs "per user")
- AI models need context to understand merchant-specific patterns

### Our Solution: Merchant-Specific Training

1. **Demo Mode**: Extract → Correct → Explain → Save
2. **Production Mode**: AI uses your corrections as few-shot examples
3. **Result**: Accurate extraction tailored to each merchant's contracts

---

## ✨ Features Overview

### 🎯 Core Extraction Features

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **PDF Upload** | Direct PDF → OpenAI API | No OCR issues, preserves formatting |
| **Smart Extraction** | Extracts all revenue schedule fields | 20+ fields including pricing, dates, billing |
| **Evidence Tracking** | AI quotes exact PDF text | Verifiable, auditable results |
| **Multi-Schedule Detection** | Auto-detects multiple line items | Handles complex contracts with many fees |
| **Agreement Scoring** | Runs extraction 2-3x, compares results | Confidence scores and consistency checks |

### 🧠 Training & Learning Features

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **Demo Mode** | Review and correct AI output | Train the AI on your specific contracts |
| **Correction Tracking** | Saves before/after comparisons | AI learns from its mistakes |
| **Field Instructions** | Add guidance per field | Tell AI where to find data |
| **Merchant Guidance** | Global rules per merchant | Applies to all contracts |
| **Few-Shot Learning** | Uses training PDF + corrections | Dramatically improves accuracy |
| **Load/Edit Training** | Update training data anytime | Iterative improvement |

### 📊 Advanced Features

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **Integration Mapping** | Match items to integration IDs | Automate downstream systems |
| **MIS Extraction** | Auto-populate guidance from MIS docs | Faster merchant onboarding |
| **Quarterly Billing Logic** | Handles complex billing frequencies | Correctly calculates periods |
| **Start Date Validation** | Auto-retries if dates missing | Ensures complete data |
| **Price Validation** | Retries on zero/missing prices | Catches pricing errors |
| **Consistency Modes** | Handle varying contract formats | Works with non-standardized contracts |

---

## 🎭 Two-Mode System

### 📚 Demo Mode (Training)

**Purpose**: Create training data for accurate production extractions

**Workflow**:
1. Upload contract PDF
2. AI extracts schedules (first attempt)
3. **Review**: Check all fields for accuracy
4. **Correct**: Fix any mistakes
5. **Instruct**: Add field-specific guidance
   - "Where to find this field"
   - "How to determine the value"
   - "Common patterns to look for"
6. **Save**: Creates training session
   - Saves corrected values
   - Saves original AI extraction (for comparison)
   - Saves all instructions
   - Saves training PDF for few-shot learning

**UI Features**:
- ✏️ All fields editable
- 📝 Instruction fields for each data point
- 💾 "Save Training" button
- ➕ Add/delete schedules
- 📂 "Load Previous Training" to edit existing

**Guidance Sections**:
- **Schedule-Level**: Instructions per line item (12 fields)
  - Item Name, Description, Total Price, Billing Type, Quantity, Start Date, Frequency, Periods, Months of Service, Net Terms, Billing Timing, Event to Track
  
- **Merchant-Level**: Global rules for all contracts (13 fields)
  - All schedule fields + general guidance

### 🚀 Production Mode (Live Extraction)

**Purpose**: Extract contracts using trained AI

**Workflow**:
1. Upload contract PDF
2. System loads training data:
   - Training PDF (for few-shot example)
   - Corrected schedules from demo
   - All instructions and guidance
   - Before/after corrections
3. AI sees:
   - ✅ Correct example from training
   - ⚠️ Common mistakes to avoid
   - 📝 Where to find each field
   - 📚 Merchant-specific patterns
4. Returns accurate extraction

**What AI Receives** (automatically):

```
📚 TRAINING EXAMPLES FROM PREVIOUS CONTRACTS:

EXAMPLE 1:
- Item Name: "Senior Living CRM"
- Billing Type: Flat price
- Quantity: 1
- Start Date: 2026-01-23
...

EXTRACTION INSTRUCTIONS:
  • Billing Type: "IT IS ALWAYS FLAT PRICE FOR THIS MERCHANT..."
  • Item Name: "Use exact service name from 'Subscription Services'..."
  
⚠️ COMMON MISTAKES TO AVOID:
  ❌ Billing Type was: "Unit price" → ✅ Corrected to: "Flat price"
  ❌ Quantity was: 3936 → ✅ Corrected to: 328

MERCHANT-SPECIFIC GUIDANCE:
  • For billing_type: "ALWAYS FLAT"
  • For start_date: "Look for Effective Date or GO-LIVE date..."
```

**UI Features**:
- 🔒 Read-only view
- 📊 Shows extracted data
- 🎯 Consistency toggle (for varying formats)
- 📄 View original PDF

---

## 🏗️ Merchant Training System

### Directory Structure

```
merchant_data/
  ├── Cocoon/
  │   ├── demo_session.json          # Training data
  │   ├── training_contract.pdf      # Example PDF
  │   └── guidance.json               # Merchant rules
  ├── WelcomeHome_Software/
  │   ├── demo_session.json
  │   ├── training_contract.pdf
  │   └── guidance.json
  └── [Your_Merchant]/
      ├── demo_session.json
      ├── training_contract.pdf
      └── guidance.json
```

### Data Models

#### demo_session.json
```json
{
  "merchant_id": "WelcomeHome_Software",
  "created_at": "2025-10-20T22:35:49.877Z",
  "pdf_session_id": "1760999361638_ary46",
  "schedules": [
    {
      // Corrected final values
      "item_name": "Senior Living CRM",
      "billing_type": "Flat price",
      "quantity": 1,
      "start_date": "2026-01-23",
      ...
      
      // Original AI extraction (before corrections)
      "original_ai_extraction": {
        "item_name": "Senior Living CRM Subscription (per Billing Unit)",
        "billing_type": "Unit price",  // ❌ WRONG
        "quantity": 1,
        ...
      },
      
      // Instructions (how to find/determine each field)
      "instruction_item_name": "Use exact service name...",
      "instruction_billing_type": "ALWAYS FLAT PRICE...",
      "instruction_description": "Include community name...",
      ...
      
      // Evidence from PDF
      "evidence": [
        {
          "page": 1,
          "snippet": "Monthly fee of $500 per each Billing Unit",
          "field_supported": "total_price,billing_type"
        }
      ]
    }
  ],
  "garage_revenue_schedules": [...] // Final output format
}
```

#### guidance.json
```json
{
  "field_specific": {
    "item_name": "Always use exact wording from 'Service Description'",
    "description": "Include community/location name",
    "billing_type": "ALWAYS FLAT unless explicitly per-unit",
    "start_date": "Look for Effective Date or GO-LIVE date...",
    "quantity": "Default to 1 for flat pricing",
    "frequency_unit": "Typically monthly",
    "periods": "Number of billing cycles",
    "months_of_service": "Look for Initial Term",
    "net_terms": "Typically Net 30",
    "billing_timing": "Usually billed in advance",
    "event_to_track": "For usage-based only",
    "general": "This merchant always has multiple communities..."
  },
  "system_additions": "",  // Extra system prompt text
  "updated_at": "2025-10-20T22:35:46.406Z"
}
```

### How Training Works

#### 1. Demo Mode Flow

```
User uploads PDF
      ↓
AI extracts (o3 model)
      ↓
User reviews results
      ↓
User corrects mistakes → Tracked in original_ai_extraction
      ↓
User adds instructions → Saved per field
      ↓
User saves training → Creates:
      ├─ demo_session.json (corrections + instructions)
      ├─ training_contract.pdf (copy of PDF)
      └─ guidance.json (merchant rules)
```

#### 2. Production Mode Flow

```
User uploads new PDF
      ↓
System loads training data:
      ├─ demo_session.json
      ├─ training_contract.pdf
      └─ guidance.json
      ↓
System builds enhanced prompt:
      ├─ Training example (few-shot)
      ├─ Corrections (mistakes to avoid)
      ├─ Instructions (where to find data)
      └─ Merchant rules (global patterns)
      ↓
AI extracts with context
      ↓
Returns accurate results ✅
```

### Quality Assurance Features

#### Auto-Retry Logic

The system automatically retries extraction if:

1. **Missing item_name**: Any schedule lacks an item name
2. **All prices zero**: Every schedule has $0 (unless explicitly free)
3. **Missing start_date**: Any schedule lacks a start date

**Retry includes specific hints**:
```
RETRY FOCUS: Ensure every schedule has:
- A non-empty item_name
- A non-zero total_price (unless explicitly free/waived)
- A valid start_date in YYYY-MM-DD format
  (search for: Effective Date, Service Start Date, 
   Contract Date, Signature Date, Commencement Date...)
```

#### Agreement Scoring (Optional)

Run extraction 2-3 times and compare:
- Field-by-field similarity scores
- Confidence calculation per schedule
- Flags items needing review

#### Auto-Correction

System automatically fixes:
- **Periods calculation**: `months ÷ (frequency_every × months_per_unit)`
  - Example: 12 months, quarterly → 4 periods
- **Billing type demotion**: Downgrades "Unit price" to "Flat price" if no per-unit evidence
- **Tier validation**: Removes tier pricing if no tiers defined

---

## 🏛️ Architecture

### Tech Stack

- **Frontend**: Vanilla JavaScript (no framework)
- **Backend**: Node.js + Express
- **AI**: OpenAI Responses API (o3, o4-mini, gpt-4o-mini)
- **Storage**: File-based JSON (merchant_data/)
- **PDF Processing**: Direct upload to OpenAI (no OCR needed)

### Key Files

```
├── server.js                 # Express server + API routes
├── public/
│   └── index.html            # Single-page UI (2100+ lines)
├── lib/
│   ├── ai.js                 # Prompt building + AI logic
│   ├── utils.js              # Normalization + validation
│   ├── merchant.js           # Merchant data management
│   └── config.js             # OpenAI client + config
├── merchant_data/            # Training data per merchant
└── uploads/                  # Temporary PDF storage
```

### Data Flow

```
┌─────────────┐
│   Browser   │
│ (index.html)│
└──────┬──────┘
       │ POST /api/extract
       ↓
┌─────────────────────────────────┐
│     Express Server (server.js)  │
├─────────────────────────────────┤
│ 1. Load merchant training data  │
│    ├─ demo_session.json         │
│    ├─ guidance.json             │
│    └─ training_contract.pdf     │
│                                  │
│ 2. Build enhanced prompt        │
│    ├─ Base system prompt        │
│    ├─ Merchant guidance          │
│    ├─ Training examples          │
│    └─ Corrections to avoid      │
│                                  │
│ 3. Upload PDF to OpenAI         │
│                                  │
│ 4. Call Responses API           │
│    ├─ Few-shot with training    │
│    └─ Main contract extraction  │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────┐
│  OpenAI API     │
│  (o3/o4-mini)   │
└──────┬──────────┘
       │
       ↓
┌─────────────────────────────────┐
│  Response Processing             │
├─────────────────────────────────┤
│ • Normalize schedules            │
│ • Validate required fields       │
│ • Auto-correct periods           │
│ • Fuzzy match integrations       │
│ • Transform to Garage format     │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────┐
│   Browser   │
│  (Results)  │
└─────────────┘
```

### Complete System Workflow

This diagram shows the full user journey from merchant selection through both Demo and Production modes:

```
                         ┌──────────────────────┐
                         │  🛍️ Pick Merchant    │
                         │                      │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │ 📁 Create Merchant   │
                         │     Folder           │
                         └──────────┬───────────┘
                                    │
                              ┌─────▼─────┐
                              │  🎚️ Select │
                              │    Stage   │
                              └─────┬─────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐             ┌───────▼────────┐
            │  PRODUCTION    │             │  DEMO/STAGING  │
            │      MODE      │             │      MODE      │
            └───────┬────────┘             └───────┬────────┘
                    │                               │
        ┌───────────▼───────────┐       ┌───────────▼───────────┐
        │ 💻 Open Production    │       │ 📝 Submit Contract    │
        │     Interface         │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
        ┌───────────▼───────────┐       │ ⚙️ Apply System       │
        │ 📄 Upload Merchant    │       │    Prompt             │
        │     PDF               │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
        ┌───────────▼───────────┐       │ 🤖 Process via       │
        │ 📚 Add Guidance PDFs  │       │     O3 Model         │
        │    & Examples         │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
        ┌───────────▼───────────┐       │ 📤 Return Output to  │
        │ 🤖 Process via        │       │     Interface        │
        │     O3 Model          │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
        ┌───────────▼───────────┐       │ ✏️ Edit for Accuracy │
        │ ✅ Output Returned    │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
        ┌───────────▼───────────┐       │ 🔍 Cite Sources /    │
        │ 💾 Save Output &      │       │    Explain Info      │
        │     Metadata          │       └───────────┬───────────┘
        └───────────┬───────────┘                   │
                    │                   ┌───────────▼───────────┐
                    │                   │ 💾 Store Final       │
                    │                   │    Document          │
                    │                   └───────────┬───────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  🗄️ Contract         │
                         │     Repository       │
                         │     (Database)       │
                         └──────────────────────┘
```

**Key Differences**:

| Production Mode | Demo Mode |
|-----------------|-----------|
| Uses trained AI with guidance | Training the AI |
| Read-only results | Editable fields + instructions |
| Fast processing | Review + correction workflow |
| Automatic extraction | Manual verification required |
| Saves to repository | Saves as training data |

### Technical Processing Flow

This diagram shows the internal API processing with validation and retry logic:

```
                    ┌─────────────────────────────┐
                    │  PDF received via API       │
                    │  endpoint (/api/extract)    │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Send PDF to O3 model       │
                    │  (OpenAI Responses API)     │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────────────────┐
                    │  O3 runs with system prompt:            │
                    │  • Desired output schema                │
                    │  • Merchant training data               │
                    │  • Few-shot examples                    │
                    │  • Field-specific guidance              │
                    │  Returns: JSON (strict schema)          │
                    └─────────────┬───────────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────────┐
                    │  Normalization layer applies:           │
                    │  • Auto-correct periods                 │
                    │  • Validate billing types               │
                    │  • Fuzzy-match integrations             │
                    │  • Transform to Garage schema           │
                    └─────────────┬───────────────────────────┘
                                  │
                            ┌─────▼─────┐
                            │ Validation │
                            │  Passes?   │
                            └─────┬─────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────▼─────┐             ┌───────▼────────┐
              │    NO     │             │      YES       │
              │           │             │                │
              └─────┬─────┘             └───────┬────────┘
                    │                           │
    ┌───────────────▼──────────────────┐        │
    │  Send feedback + new info        │        │
    │  to O3 model:                    │        │
    │  • Missing fields identified     │        │
    │  • Specific hints provided       │        │
    │  • Single retry attempt          │        │
    └───────────────┬──────────────────┘        │
                    │                           │
    ┌───────────────▼──────────────────┐        │
    │  Reprocess JSON                  │        │
    │  (single retry)                  │        │
    └───────────────┬──────────────────┘        │
                    │                           │
    ┌───────────────▼──────────────────┐        │
    │  Normalization (post-retry)      │        │
    │  in Garage-compatible schema     │        │
    └───────────────┬──────────────────┘        │
                    │                           │
                    └───────────┬───────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │  Return output via         │
                  │  API endpoint              │
                  │  (JSON response)           │
                  └────────────────────────────┘
```

**Validation Checks**:

| Check | Triggers Retry? | Hint Provided |
|-------|----------------|---------------|
| **Missing item_name** | ✅ Yes | "Ensure every schedule has a non-empty item_name" |
| **All prices = $0** | ✅ Yes | "Look for pricing in fee schedules, appendices" |
| **Missing start_date** | ✅ Yes | "Search for: Effective Date, Service Start Date, Signature Date" |
| **Invalid billing type** | ⚠️ Auto-corrects | Demotes to Flat price if no per-unit evidence |
| **Wrong periods** | ⚠️ Auto-corrects | Calculates: months ÷ (frequency × unit_months) |

**Processing Time**:

- **o3**: 30-60 seconds per contract (high accuracy)
- **o4-mini**: 15-30 seconds (balanced)
- **gpt-4o-mini**: 5-15 seconds (fast, less reasoning)
- **Retry**: +10-20 seconds if validation fails

---

## 🔌 API Reference

### POST /api/extract

Extract revenue schedules from PDF

**Query Parameters**:
- `model` - AI model: `o3`, `o4-mini`, `gpt-4o-mini` (default: `o3`)
- `forceMulti` - Multi-schedule: `auto`, `on`, `off` (default: `auto`)
- `runs` - Agreement runs: `1`, `2`, `3` (default: `1`)
- `merchantId` - Merchant identifier (required)
- `stage` - Mode: `demo`, `production` (required)
- `consistency` - Training consistency: `consistent`, `non-consistent` (production only)

**Body** (multipart/form-data):
- `file` - PDF file (required)
- `integration_mapping` - JSON array of [contract_name, integration_id] pairs (optional)

**Response**:
```json
{
  "model_used": "o3",
  "runs": 1,
  "merchant_id": "WelcomeHome_Software",
  "stage": "production",
  "schedules": [
    {
      "item_name": "Senior Living CRM",
      "description": "Eskaton Village",
      "total_price": 500,
      "billing_type": "Flat price",
      "quantity": 1,
      "start_date": "2026-01-23",
      "frequency_unit": "Month(s)",
      "frequency_every": 1,
      "periods": 12,
      "months_of_service": 12,
      "net_terms": 30,
      "billing_timing": "first",
      "arrears": false,
      "evidence": [...],
      "extraction_reasoning": "...",
      "confidence": 0.95,
      "flag_for_review": false
    }
  ],
  "garage_revenue_schedules": [...],
  "agreement_summary": {...},
  "issues": [],
  "demo_session_loaded": true,
  "pdf_session_id": "1761071376103_jbf68i"
}
```

### POST /api/save-demo-session

Save training session

**Body**:
```json
{
  "merchant_id": "WelcomeHome_Software",
  "pdf_session_id": "1760999361638_ary46",
  "schedules": [...],
  "system_prompt_used": "..."
}
```

### GET /api/load-demo-session

Load training session

**Query**: `merchantId=WelcomeHome_Software`

### POST /api/save-guidance

Save merchant-level guidance

**Body**:
```json
{
  "merchantId": "WelcomeHome_Software",
  "guidance": {
    "field_specific": {...},
    "system_additions": "...",
    "updated_at": "2025-10-20T22:35:46.406Z"
  }
}
```

### GET /api/load-guidance

Load merchant guidance

**Query**: `merchantId=WelcomeHome_Software`

### GET /api/list-merchants

List all merchants

**Response**:
```json
{
  "merchants": [
    {
      "id": "Cocoon",
      "name": "Cocoon",
      "hasTraining": true
    },
    {
      "id": "WelcomeHome_Software",
      "name": "WelcomeHome_Software",
      "hasTraining": true
    }
  ]
}
```

### POST /api/extract-mis-instructions

Extract instructions from MIS document

**Body** (multipart/form-data):
- `file` - MIS document (PDF/DOC/TXT)
- `merchantId` - Merchant identifier

**Response**:
```json
{
  "success": true,
  "instructions": "Look for 'Service Period' in Section 3...",
  "merchant_id": "WelcomeHome_Software",
  "length": 450
}
```

### GET /api/view-pdf/:sessionId

View uploaded PDF

Returns PDF file for inline viewing

### GET /health

Health check

**Response**:
```json
{
  "ok": true,
  "models": ["gpt-4-0613", "gpt-4", "gpt-3.5-turbo"]
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-key-here

# Optional
PORT=3000                                    # Server port (default: 3000)
NODE_ENV=production                          # Environment
HOST=0.0.0.0                                # Bind host (default: 0.0.0.0)

# Tabs Platform Integration (optional)
LUXURY_PRESENCE_TABS_API_KEY=xxx            # Prod API key
LUXURY_PRESENCE_TABS_DEV_API_KEY=xxx        # Dev API key
USE_CONTRACT_PROCESSING_KEY=xxx             # Auth key for /api/use-contract-assistant
```

### Model Selection

| Model | Best For | Speed | Cost | Reasoning |
|-------|----------|-------|------|-----------|
| **o3** | Complex contracts, high accuracy | Slow | $$$ | ⭐⭐⭐⭐⭐ |
| **o4-mini** | Balance of speed/accuracy | Medium | $$ | ⭐⭐⭐⭐ |
| **gpt-4o-mini** | Simple contracts, fast processing | Fast | $ | ⭐⭐⭐ |

### Multi-Schedule Detection

- **Auto**: Let AI decide based on evidence (default)
- **Force ON**: Always enumerate multiple schedules
- **Force OFF**: Return only clear, certain schedules

---

## 🐛 Troubleshooting

### Common Issues

#### "No training session found"

**Cause**: Merchant has no demo_session.json

**Solution**: 
1. Switch to Demo Mode
2. Upload and process a contract
3. Add corrections and instructions
4. Click "💾 Save Training"

#### "Start date missing"

**Cause**: AI couldn't find a date in the PDF

**Solution** (Demo Mode):
1. Add `instruction_start_date`: 
   ```
   Look for 'Effective Date' in the header or 
   'Service Start Date' in the order form section. 
   If not found, use the contract signature date.
   ```
2. In production, the auto-retry logic will search harder

#### "Billing type incorrect (Unit vs Flat)"

**Cause**: AI misinterpreting "per Billing Unit" language

**Solution** (Demo Mode):
1. Correct the billing type to "Flat price"
2. Add `instruction_billing_type`:
   ```
   ALWAYS FLAT PRICE for this merchant. 
   "Per Billing Unit" means one flat price per community, 
   NOT usage-based billing.
   ```
3. System tracks: "Unit price → Flat price" correction
4. In production, AI will see this mistake and avoid it

#### "Wrong number of periods"

**Cause**: Quarterly billing confusion

**Solution**: Auto-corrected! System calculates:
- Quarterly (every 3 months) = `months ÷ 3` periods
- Example: 12 months → 4 periods

#### "Missing description field"

**Cause**: Description instruction field was missing (now added!)

**Solution** (Merchant Guidance):
```
For description field: "Include community/location name 
from the order form header or appendix"
```

### Logging & Debugging

#### Production Mode Logging

Terminal shows what AI receives:

```
========== PRODUCTION MODE SYSTEM PROMPT ==========
Using demo session for merchant: WelcomeHome_Software
Demo session has 2 training examples

📚 Training Example #1:
  Item: "Senior Living CRM"
  Billing Type: Flat price
  Quantity: 1

⚠️ Corrections in training:
  • Billing Type: Unit price → Flat price
  • Quantity: 3936 → 328

📝 Instruction: "ALWAYS FLAT PRICE FOR THIS MERCHANT..."
===================================================
```

#### Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `Invalid file format` | Wrong purpose parameter | Check server.js upload code |
| `rate_limit_error` | API rate limit | Retry with backoff |
| `No merchant selected` | Missing merchantId | Select merchant on landing page |
| `Failed to save demo session` | Write permissions | Check merchant_data/ directory |

---

## 📚 Advanced Usage

### Creating Custom Merchants

1. **Landing Page** → "+ Create New Merchant"
2. Enter merchant name (e.g., "Acme_Corp")
3. Creates directory: `merchant_data/Acme_Corp/`
4. Run first contract in Demo Mode
5. Train the system

### Handling Non-Consistent Contracts

Some merchants have varying contract formats:

**Production Mode** → Enable "Non-consistent" toggle

This tells AI:
```
⚠️ CONTRACT VARIATION NOTICE:
This merchant's contracts are NOT CONSISTENT in format and structure.
Focus on understanding the INTENT of each field rather than 
relying on exact patterns or locations.
```

### Integration Mapping

Map extracted items to integration IDs:

1. Create Excel file:
   ```
   Contract Name          | Integration ID
   Senior Living CRM      | prod_12345
   Implementation Fee     | prod_67890
   ```

2. Upload via "Integration Mapping" file selector

3. System fuzzy-matches and adds:
   ```json
   {
     "integration_item": "prod_12345",
     "integration_match_confidence": "high",
     "integration_match_score": -250
   }
   ```

### MIS Document Extraction

Auto-populate guidance from MIS documents:

1. **Demo Mode** → Scroll to Guidance section
2. Click "📄 Upload MIS Document"
3. AI extracts instructions and populates fields
4. Review and save

### Editing Training Data

Update training anytime:

1. **Demo Mode** → Click "📂 Load Previous Training Session"
2. Edit any field, instruction, or schedule
3. Add/remove schedules
4. Click "💾 Save Training" to update

---

## 🎯 Best Practices

### Training Tips

1. **Start with Demo Mode**
   - Process 1-2 example contracts
   - Add detailed instructions
   - Include edge cases

2. **Be Specific in Instructions**
   - ❌ "Look for the date"
   - ✅ "Look for 'Service Start Date' in Section 2, or use 'Effective Date' from the header"

3. **Document Corrections**
   - When fixing AI mistakes, explain WHY in the instruction field
   - The AI will learn from these corrections

4. **Test in Production**
   - After training, test with new contracts
   - Refine instructions based on results

5. **Iterate**
   - Load training sessions and update as needed
   - Add new patterns as you discover them

### Performance Tips

1. **Use o3 for training** - Most accurate, best for learning
2. **Use o4-mini for production** - Faster, still accurate with training
3. **Enable auto-retry** - Catches missing data
4. **Run agreement scoring** for critical contracts - 2-3 runs for confidence

---

## 🔐 Security Notes

- Never commit `.env` file
- API keys are loaded from environment only
- PDFs are temporarily stored and deleted after processing
- Training data is stored locally (not in git by default)
- Add `merchant_data/` to `.gitignore` for sensitive data

---

## 📝 License

Private/Internal Use

---

## 🤝 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting)
2. Review terminal logs (especially in production mode)
3. Check OpenAI API status
4. Review training data in `merchant_data/`

---

## 🎉 Success Metrics

After proper training, you should see:
- ✅ 95%+ field accuracy
- ✅ Correct billing type classification
- ✅ No missing start dates
- ✅ Accurate period calculations
- ✅ Consistent extraction across similar contracts

---

**Happy extracting! 🚗💸**

*Built with ❤️ for Tabs Platform's Garage*

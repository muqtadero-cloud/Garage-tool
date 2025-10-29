import fuzzysort from 'fuzzysort';
import { BILLING_TYPES, FREQ_UNITS } from './config.js';

/* ------------------- Fuzzy Matching ------------------- */

export function fuzzyMatchIntegrationItem(itemName, integrationPairs) {
  if (!itemName || !Array.isArray(integrationPairs) || integrationPairs.length === 0) {
    return { integration_item: null, match_score: 0, match_confidence: 'none' };
  }

  const contractNames = integrationPairs.map(pair => pair[0]);
  const results = fuzzysort.go(String(itemName), contractNames, { threshold: -10000, limit: 1 });
  
  if (results.length === 0) {
    return { integration_item: null, match_score: 0, match_confidence: 'none' };
  }

  const bestMatch = results[0];
  const matchedPair = integrationPairs.find(pair => pair[0] === bestMatch.target);
  const score = bestMatch.score;
  
  // Score thresholds for confidence levels
  let confidence = 'none';
  if (score > -1000) confidence = 'high';
  else if (score > -5000) confidence = 'medium';
  else if (score > -10000) confidence = 'low';

  return {
    integration_item: matchedPair ? matchedPair[1] : null,
    match_score: score,
    match_confidence: confidence,
    matched_contract_name: bestMatch.target
  };
}

/* ------------------- Number & Enum Helpers ------------------- */

export function toNumberLoose(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    // first numeric group (handles "$1,200.00", "USD 3000", etc.)
    const m = v.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function clampEnum(value, allowed, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const byLower = new Map(allowed.map(v => [v.toLowerCase(), v]));
  return byLower.get(value.toLowerCase()) || fallback;
}

export function pickNumber(n, fallback = null) {
  const x = toNumberLoose(n);
  return x == null ? fallback : x;
}

export function positive(n){ return Number.isFinite(n) && n > 0 ? n : null; }

/* ------------------- Billing Type & Frequency Heuristics ------------------- */

export function hasStrongUnitEvidence(s) {
  const parts = []
    .concat(s?.item_name || [], s?.description || [], s?.unit_label || [])
    .concat(Array.isArray(s?.evidence) ? s.evidence.map(e => e?.snippet || '') : []);
  const hay = parts.join(' ').toLowerCase();
  // IMPORTANT: Do NOT treat time units (month/year/week/day) as per-unit signals.
  // Time units represent frequency, not usage. We only consider non-time nouns here.
  const perPattern = /\b(per|each|\/)\s*(seat|user|impression|click|lead|unit|order|transaction|visit|listing|ad|sku|gb|hour|minute|api call|api|sms|email|message|device|location)s?\b/;
  const usageWords = /\b(overage|usage|metered|consumption|rate\s*card|per[-\s]*use)\b/;
  const hasPPU = Number.isFinite(pickNumber(s?.price_per_unit));
  const hasUnitLabel = !!(s?.unit_label && String(s.unit_label).trim());
  const tierCount = Array.isArray(s?.tiers) ? s.tiers.length : 0;
  return perPattern.test(hay) || usageWords.test(hay) || (hasPPU && hasUnitLabel) || tierCount > 0;
}

export function normalizeBillingType(bt, hint = {}) {
  if (Array.isArray(hint?.tiers) && hint.tiers.length) return 'Tier unit price';
  if (hasStrongUnitEvidence(hint)) return 'Unit price';
  const t = (bt || '').toLowerCase();
  if (t.includes('tier') && t.includes('unit')) return 'Tier unit price';
  if (t.includes('tier') && t.includes('flat')) return 'Tier flat price';
  return 'Flat price';
}

export function normalizeFrequency(rawText, rawEvery, rawUnit, fallback = 'None') {
  let every = Number.isFinite(Number(rawEvery)) ? Number(rawEvery) : 1;
  let unit  = clampEnum(rawUnit, FREQ_UNITS, null);
  const txt = String(rawText ?? '').toLowerCase();
  if (!unit) {
    if (!txt || txt === 'none' || txt.includes('one-time')) { unit = 'None'; every = 1; }
    else if (txt.includes('annual'))  { unit = 'Year(s)';  every = 1; }
    else if (txt.includes('month'))   { unit = 'Month(s)'; every = 1; }
    else if (txt.includes('week'))    { unit = 'Week(s)';  every = 1; }
    else if (txt.includes('semi'))    { unit = 'Semi_month(s)'; every = 1; }
    else if (txt.includes('day'))     { unit = 'Day(s)';   every = 1; }
    else unit = fallback;
  }
  if (unit === 'None') every = 1;
  return { every, unit };
}

/* ------------------- Price Extraction ------------------- */

export function extractPriceFromEvidenceLikeText(texts, ctx = {}) {
  const candidates = [];
  const re = /(?:\$|US\$|USD)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})|[0-9]+(?:\.\d{2})?)/gi;
  for (const raw of texts) {
    if (!raw) continue;
    const s = String(raw);
    let m;
    while ((m = re.exec(s))) {
      const val = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(val) || val <= 0) continue;
      const start = m.index, end = re.lastIndex;
      const W = 48;
      const left  = s.slice(Math.max(0, start - W), start).toLowerCase();
      const right = s.slice(end, Math.min(s.length, end + W)).toLowerCase();
      const ring  = left + ' ' + right;

      let score = 0;
      if (/\b(monthly|per\s*month|per\s*mo\.?)\b/.test(ring)) score += (ctx.frequency_unit === 'Month(s)') ? 3 : -1;
      if (/\b(annual|yearly|per\s*year)\b/.test(ring))       score += (ctx.frequency_unit === 'Year(s)')  ? 3 : -1;
      if (/\b(one[-\s]?time|setup|implementation)\b/.test(ring)) score += (ctx.frequency_unit === 'None') ? 3 : -1;
      if (/\b(line\s*total|total\s*(?:per|for)?\b)/.test(ring)) score += 2;
      if (/\b(discount|credit|rebate|tax|deposit|retainer|balance\s*due)\b/.test(ring)) score -= 4;
      if (/\b(each|per\s*(seat|user|lead|click|impression|unit|gb|api|sms|email))\b/.test(ring)) {
        if (ctx.billing_type !== 'Unit price' && ctx.billing_type !== 'Tier unit price') score -= 2;
      }
      score += candidates.length * 0.05;
      candidates.push({ value: val, score });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].value;
}

const ZERO_TERMS_RE = /\b(?:no\s*charge|free|complimentary|waived|included\s+at\s+no\s+extra\s+cost|n\/c|zero)\b/i;
const ZERO_CURRENCY_RE = /(?:\$|US\$|USD)\s*0(?:\.00)?\b/i;
const PRICE_FIELDS_PRIMARY = ['total_price','price','amount','per_period_price','per_period','annual_price','monthly_price'];
const PRICE_FIELDS_SECONDARY = ['setup_fee','one_time_fee','upfront','down_payment','line_total','subtotal'];

export function explicitZeroSignal(obj){
  for (const f of [...PRICE_FIELDS_PRIMARY, ...PRICE_FIELDS_SECONDARY]) {
    const v = toNumberLoose(obj?.[f]);
    if (v === 0) return `field:${f}`;
  }
  const texts = [];
  if (Array.isArray(obj?.evidence)) for (const ev of obj.evidence) if (ev?.snippet) texts.push(ev.snippet);
  if (obj?.description) texts.push(String(obj.description));
  if (obj?.item_name)   texts.push(String(obj.item_name));
  const hay = texts.join(' ');
  if (ZERO_CURRENCY_RE.test(hay)) return 'currency_text';
  if (ZERO_TERMS_RE.test(hay))    return 'keyword_text';
  if (/\b100%\s*(?:discount|off)\b/i.test(hay)) return 'discount_100';
  return null;
}

export function priceFromFields(obj) {
  for (const f of PRICE_FIELDS_PRIMARY) {
    const v = positive(pickNumber(obj?.[f], null));
    if (v != null) return v;
  }
  for (const f of PRICE_FIELDS_SECONDARY) {
    const v = positive(pickNumber(obj?.[f], null));
    if (v != null) return v;
  }
  return null;
}

export function priceFromEvidence(obj) {
  const texts = [];
  if (Array.isArray(obj?.evidence)) for (const ev of obj.evidence) if (ev?.snippet) texts.push(ev.snippet);
  if (obj?.description) texts.push(String(obj.description));
  if (obj?.item_name)   texts.push(String(obj.item_name));
  const ctx = {
    frequency_unit: clampEnum(obj?.frequency_unit, FREQ_UNITS, null),
    billing_type: normalizeBillingType(obj?.billing_type, obj)
  };
  return positive(extractPriceFromEvidenceLikeText(texts, ctx));
}

export function bestPrice(obj, { allowExplicitZero = true } = {}) {
  const pos = priceFromFields(obj) ?? priceFromEvidence(obj);
  if (pos != null) return pos;
  if (allowExplicitZero) {
    const zr = explicitZeroSignal(obj);
    if (zr) return 0;
  }
  return null;
}

/* ------------------- Date/Month Calculations ------------------- */

export function monthsFromDates(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start) || isNaN(end)) return null;
  const ms = end - start;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30)));
}

export function periodsFromMonths(unit, every, months) {
  if (!unit || unit === 'None') return 0;
  const m = Number(months);
  const e = Number(every) || 1;
  if (!Number.isFinite(m) || m <= 0) return 1;
  if (unit === 'Month(s)')      return Math.max(1, Math.round(m / e));
  if (unit === 'Year(s)')       return Math.max(1, Math.round(m / (12 * e)));
  if (unit === 'Week(s)')       return Math.max(1, Math.round((m * 30) / (7 * e)));
  if (unit === 'Day(s)')        return Math.max(1, Math.round((every * m * 30) / (30 * e)));
  if (unit === 'Semi_month(s)') return Math.max(1, Math.round((m * 30) / (15 * e)));
  return 1;
}

/* ------------------- Normalization ------------------- */

export function normalizeSchedules(data) {
  const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
  return schedules.map((s) => {
    const issues = Array.isArray(s.issues) ? [...s.issues] : [];

    let bt = clampEnum(normalizeBillingType(s.billing_type, s), BILLING_TYPES, 'Flat price');
    const { every, unit } = normalizeFrequency(s.frequency, s.frequency_every, s.frequency_unit, 'None');

    let qty = pickNumber(s.quantity, null);
    if (bt === 'Flat price') qty = 1;

    // Handle billing timing/arrears
    let billing_timing = s.billing_timing || 'first';
    let arrears = false;
    
    if (s.arrears !== undefined && s.arrears !== null) {
      arrears = Boolean(s.arrears);
      billing_timing = arrears ? 'last' : 'first';
    } else if (billing_timing === 'last') {
      arrears = true;
    } else if (billing_timing === 'first' || billing_timing === 'next_period') {
      arrears = false;
    }

    // Auto-correct periods based on frequency and months_of_service
    let periods = pickNumber(s.periods, 1);
    const months = pickNumber(s.months_of_service, null);
    
    if (months && unit && unit !== 'None') {
      const expectedPeriods = periodsFromMonths(unit, every, months);
      // If AI-provided periods differ significantly from calculated, use calculated and add issue
      if (periods !== expectedPeriods && Math.abs(periods - expectedPeriods) > 0) {
        issues.push(`Auto-corrected periods from ${periods} to ${expectedPeriods} based on ${months} months with ${unit} every ${every}`);
        periods = expectedPeriods;
      }
    }

    const out = {
      schedule_label: s.schedule_label ?? null,
      item_name: String(s.item_name || '').trim(),
      description: s.description ?? null,
      billing_type: bt,
      total_price: null, // computed below
      quantity: qty,
      start_date: s.start_date || null,

      frequency_every: pickNumber(every, 1),
      frequency_unit: clampEnum(unit, FREQ_UNITS, 'None'),

      months_of_service: months,
      periods: periods,
      calculated_end_date: s.calculated_end_date || s.end_date || null,
      net_terms: pickNumber(s.net_terms, 0),
      rev_rec_category: s.rev_rec_category ?? null,
      
      billing_timing: billing_timing,
      arrears: arrears,

      event_to_track: s.event_to_track ?? null,
      unit_label: s.unit_label ?? null,
      price_per_unit: pickNumber(s.price_per_unit, null),
      volume_based: typeof s.volume_based === 'boolean' ? s.volume_based : null,
      tiers: Array.isArray(s.tiers)
        ? s.tiers.map(t => ({
            tier_name: t.tier_name ?? null,
            price: pickNumber(t.price, null),
            applied_when: t.applied_when ?? null,
            min_quantity: pickNumber(t.min_quantity, null)
          }))
        : [],

      evidence: Array.isArray(s.evidence) ? s.evidence.slice(0, 8) : [],
      issues
    };

    // Policy enforcement
    if (out.billing_type === 'Unit price' && !hasStrongUnitEvidence(s)) {
      out.billing_type = 'Flat price';
      out.quantity = 1;
      out.event_to_track = null;
      out.unit_label = null;
      out.price_per_unit = null;
      out.volume_based = null;
      out.tiers = [];
      out.issues.push('Demoted Unit → Flat: missing explicit per-unit/usage evidence.');
    }
    // Additional demotion rule: if the supposed unit is actually a time unit or no event is tracked
    if (out.billing_type === 'Unit price') {
      const timeUnitLabel = out.unit_label && /\b(month|year|week|day|period)\b/i.test(String(out.unit_label));
      const hasUsageSignals = hasStrongUnitEvidence(s);
      if ((out.frequency_unit && out.frequency_unit !== 'None') && (!out.event_to_track) && (!out.unit_label || timeUnitLabel) && !hasUsageSignals) {
        out.billing_type = 'Flat price';
        out.quantity = 1;
        out.event_to_track = null;
        out.unit_label = null;
        out.price_per_unit = null;
        out.volume_based = null;
        out.tiers = [];
        out.issues.push('Demoted Unit → Flat: time-based price detected (e.g., $/month). Frequency is not a usage unit.');
      }
    }
    if ((out.billing_type === 'Tier unit price' || out.billing_type === 'Tier flat price') && (!out.tiers || out.tiers.length === 0)) {
      out.billing_type = 'Flat price';
      out.quantity = 1;
      out.issues.push('Demoted Tier → Flat: no tiers found.');
    }

    // Price: positive fields → positive evidence → explicit zero
    const chosen = bestPrice(s) ?? bestPrice(out);
    if (chosen != null) {
      out.total_price = chosen;
      if (chosen === 0) out.issues.push('Explicit zero price accepted (waived/free/included).');
    } else {
      out.total_price = null;
      out.issues.push('Price missing after all fallbacks; verify contract line.');
    }

    return out;
  });
}

/* ------------------- Agreement / Confidence Scoring ------------------- */

export function clamp01(x){ return Math.max(0, Math.min(1, Number(x)||0)); }

export function tokenize(s) { 
  if (!s) return []; 
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x => x && x.length > 1); 
}

export function jaccardTokens(a, b) { 
  const A = new Set(tokenize(a)); 
  const B = new Set(tokenize(b)); 
  if (!A.size && !B.size) return 1; 
  const inter = [...A].filter(x => B.has(x)).length; 
  const union = new Set([...A, ...B]).size; 
  return union ? inter / union : 0; 
}

export function numericSimilarity(a, b) { 
  if (a == null && b == null) return 1; 
  if (a == null || b == null) return 0; 
  const x = Number(a), y = Number(b); 
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0; 
  const diff = Math.abs(x - y); 
  const denom = Math.max(1, Math.abs(x), Math.abs(y)); 
  return clamp01(1 - diff / denom); 
}

export function dateSimilarity(a, b) { 
  if (!a && !b) return 1; 
  if (!a || !b) return 0; 
  const da = new Date(a), db = new Date(b); 
  if (isNaN(da) || isNaN(db)) return 0; 
  const days = Math.abs((db - da) / (1000*60*60*24)); 
  return clamp01(Math.exp(-days/30)); 
}

export function enumSimilarity(a, b) { 
  return (a && b && String(a) === String(b)) ? 1 : (!a && !b ? 1 : 0); 
}

export function tiersSimilarity(ta, tb) {
  if (!Array.isArray(ta) && !Array.isArray(tb)) return 1;
  if (!Array.isArray(ta) || !Array.isArray(tb)) return 0;
  if (ta.length === 0 && tb.length === 0) return 1;
  const len = Math.max(ta.length, tb.length); if (!len) return 1;
  let score = 0;
  for (let i=0;i<len;i++){
    const a = ta[i] || {}, b = tb[i] || {};
    const name = jaccardTokens(a.tier_name, b.tier_name);
    const price = numericSimilarity(a.price, b.price);
    const minq = numericSimilarity(a.min_quantity, b.min_quantity);
    score += (name*0.3 + price*0.5 + minq*0.2);
  }
  return clamp01(score / len);
}

export function scheduleSimilarity(a, b) {
  const fields = {};
  fields.item_name = jaccardTokens(a.item_name, b.item_name);
  fields.total_price = numericSimilarity(a.total_price, b.total_price);
  fields.start_date = dateSimilarity(a.start_date, b.start_date);
  fields.frequency_unit = enumSimilarity(a.frequency_unit, b.frequency_unit);
  fields.frequency_every = numericSimilarity(a.frequency_every, b.frequency_every);
  fields.unit_label = jaccardTokens(a.unit_label, b.unit_label);
  fields.event_to_track = jaccardTokens(a.event_to_track, b.event_to_track);
  fields.tiers = tiersSimilarity(a.tiers, b.tiers);
  const w = { item_name: 0.35, total_price: 0.25, start_date: 0.10, frequency_unit: 0.10, frequency_every: 0.05, unit_label: 0.05, event_to_track: 0.05, tiers: 0.05 };
  const sim = w.item_name*fields.item_name + w.total_price*fields.total_price + w.start_date*fields.start_date + w.frequency_unit*fields.frequency_unit + w.frequency_every*fields.frequency_every + w.unit_label*fields.unit_label + w.event_to_track*fields.event_to_track + w.tiers*fields.tiers;
  return { sim: clamp01(sim), fields };
}

export function keyCompletenessPenalty(s) {
  const keys = ['item_name','total_price','start_date','frequency_unit','periods'];
  const missing = keys.reduce((acc, k) => acc + (s[k]==null || s[k]==='' ? 1 : 0), 0);
  return clamp01(1 - (missing / keys.length) * 0.5);
}

export function computeAgreement(first, second) {
  const n = second.length;
  const used = new Set();
  const enriched = first.map((a) => {
    let best = { j: -1, sim: 0, fields: {} };
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const score = scheduleSimilarity(a, second[j]);
      if (score.sim > best.sim) best = { j, ...score };
    }
    if (best.j >= 0) used.add(best.j);
    const missingPenalty = keyCompletenessPenalty(a);
    const confidence = clamp01(0.2 + 0.8 * best.sim * missingPenalty);
    const flag_for_review = confidence < 0.75 || best.sim < 0.70;
    return { confidence, flag_for_review, agreement: { matched_index_in_run2: best.j, similarity: best.sim, fields: best.fields } };
  });
  const avg = enriched.length ? (enriched.reduce((s, e) => s + e.confidence, 0) / enriched.length) : null;
  const min = enriched.length ? enriched.reduce((m, e) => Math.min(m, e.confidence), 1) : null;
  return { enriched, summary: { avg_confidence: avg, min_confidence: min, total_items_run1: first.length, total_items_run2: second.length, unmatched_in_run2: Math.max(0, first.length - used.size) } };
}

/* ------------------- Garage JSON Transformation ------------------- */

export function toGarageBillingType(bt) {
  const map = { 'Flat price': 'FLAT_PRICE', 'Unit price': 'UNIT_PRICE', 'Tier flat price': 'TIER_FLAT_PRICE', 'Tier unit price': 'TIER_UNIT_PRICE' };
  return map[bt] || 'FLAT_PRICE';
}

export function toGarageFrequencyWithMonths(s, months) {
  const every = pickNumber(s?.frequency_every, 1);
  const unit = s?.frequency_unit;
  const number_of_periods = periodsFromMonths(unit, every, months);
  if (!unit || unit === 'None') {
    return { frequency_unit: 'NONE', period: 1, number_of_periods: 0 };
  }
  if (unit === 'Month(s)') {
    if (every === 3) return { frequency_unit: 'QUARTER', period: 1, number_of_periods };
    return { frequency_unit: 'MONTH', period: every, number_of_periods };
  }
  if (unit === 'Year(s)')       return { frequency_unit: 'YEAR', period: every, number_of_periods };
  if (unit === 'Day(s)')        return { frequency_unit: 'DAYS', period: every, number_of_periods };
  if (unit === 'Semi_month(s)') return { frequency_unit: 'SEMI_MONTH', period: every, number_of_periods };
  if (unit === 'Week(s)')       return { frequency_unit: 'DAYS', period: every*7, number_of_periods };
  return { frequency_unit: 'NONE', period: 1, number_of_periods: 0 };
}

export function polishOneTimeNameAndDescription(s, g) {
  const text = [s?.schedule_label, s?.item_name, s?.description, s?.rev_rec_category].filter(Boolean).join(' ').toLowerCase();
  const isOneTime = g.frequency_unit === 'NONE' || /one[-\s]?time|setup|implementation|professional services/.test(text);
  if (isOneTime) {
    if (!g.item_name) g.item_name = 'Implementation & One-Time Services';
    if (!g.item_description) g.item_description = 'Total one-time fees listed on order form';
  }
}

export function deriveMonthsOfService(s) {
  const byDates = monthsFromDates(s?.start_date, s?.calculated_end_date || s?.end_date);
  if (Number.isFinite(byDates) && byDates > 0) return byDates;
  const mosRaw = s?.months_of_service;
  if (mosRaw !== null && mosRaw !== undefined) {
    const mosNum = pickNumber(mosRaw, null);
    if (mosNum != null && mosNum > 0) return mosNum;
  }
  const every = pickNumber(s?.frequency_every, 1);
  const unit = s?.frequency_unit;
  const p = pickNumber(s?.periods, null);
  if (p != null && p > 0) {
    if (unit === 'Month(s)')      return every * p;
    if (unit === 'Year(s)')       return 12 * every * p;
    if (unit === 'Week(s)')       return Math.round((7 * every * p) / 30);
    if (unit === 'Day(s)')        return Math.round((every * p) / 30);
    if (unit === 'Semi_month(s)') return Math.round((15 * every * p) / 30);
  }
  if (!unit || unit === 'None') return 1;
  return 0;
}

export function toGarageRevenueStrict(s) {
  const service_term = deriveMonthsOfService(s) || 0;
  const freq = toGarageFrequencyWithMonths(s, service_term);
  const billing_type = toGarageBillingType(s?.billing_type);
  const qty = billing_type === 'FLAT_PRICE' ? 1 : pickNumber(s?.quantity, 1);
  const integration_item = s?.integration_item ?? null;

  let finalPrice = positive(pickNumber(s?.total_price, null));
  if (finalPrice == null) {
    const tp = pickNumber(s?.total_price, null);
    if (tp === 0 && explicitZeroSignal(s)) {
      finalPrice = 0;
    } else {
      finalPrice = bestPrice(s);
    }
  }
  if (finalPrice == null) finalPrice = 0;

  const g = {
    service_start_date: s.start_date || '',
    service_term,
    revenue_category: null,
    item_name: s.item_name || '',
    item_description: s.description || null,
    start_date: s.start_date || '',
    frequency_unit: freq.frequency_unit,
    period: freq.period,
    number_of_periods: freq.number_of_periods,
    arrears: false,
    billing_type,
    event_to_track: s.event_to_track ?? null,
    integration_item,
    discounts: [],
    net_terms: pickNumber(s?.net_terms, 0),
    quantity: qty,
    total_price: finalPrice,
    pricing_tiers: (Array.isArray(s?.tiers) && s.tiers.length)
      ? s.tiers.map((t, i) => ({
          tier: i+1,
          mantissa: t?.price != null ? String(pickNumber(t.price, 0)) : null,
          exponent: '0',
          condition_value: pickNumber(t?.min_quantity, null),
          condition_operator: t?.min_quantity != null ? 'GREATER_THAN_EQUAL' : null,
          name: t?.tier_name || t?.applied_when || null
        }))
      : []
  };

  polishOneTimeNameAndDescription(s, g);
  return g;
}

export function toGarageAllStrict(schedules) {
  return (schedules || []).map(s => toGarageRevenueStrict(s));
}



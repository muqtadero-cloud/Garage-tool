#!/usr/bin/env node

/**
 * Evaluation Script for Tabs Platform Contracts
 * 
 * Runs contracts through extraction, compares against expected output,
 * calculates weighted accuracy scores, and generates Excel report.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Field weights based on impact (from image) - only garage output fields
const FIELD_WEIGHTS = {
  // Revenue impact fields
  service_start_date: 4.44,
  service_term: 4.44,
  revenue_category: 4.44,
  
  // Billing impact fields
  item_name: 6.67,
  start_date: 6.67,
  frequency_unit: 6.67,
  period: 6.67,
  number_of_periods: 6.67,
  arrears: 6.67,
  billing_type: 6.67,
  event_to_track: 6.67,
  discounts: 6.67,
  net_terms: 6.67,
  total_price: 6.67,
  pricing_tiers: 6.67,
  
  // Lower weight fields
  integration_item: 2.22,
  quantity: 2.22
  // item_description removed - not scored
};

const EVAL_BASE = '/Users/muqtader/Desktop/⚡︎ eval set - tabs platform ';
const PDF_DIR = path.join(EVAL_BASE, 'contract pdfs');
const JSON_DIR = path.join(EVAL_BASE, 'json output');
const SERVER_URL = 'http://localhost:3000';
const MERCHANT_ID = 'Tabs_platform';

function normalizeValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length === 0 ? null : value;
  return value;
}

function compareValues(actual, expected, fieldName) {
  const normActual = normalizeValue(actual);
  const normExpected = normalizeValue(expected);
  
  // Both null/empty = match
  if (normActual === null && normExpected === null) return true;
  
  // One is null = no match
  if (normActual === null || normExpected === null) return false;
  
  // Arrays (discounts, pricing_tiers)
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return JSON.stringify(actual.sort()) === JSON.stringify(expected.sort());
  }
  
  // Numbers (allow small floating point differences)
  if (typeof normActual === 'number' && typeof normExpected === 'number') {
    return Math.abs(normActual - normExpected) < 0.01;
  }
  
  // Strings
  if (typeof normActual === 'string' && typeof normExpected === 'string') {
    return normActual === normExpected;
  }
  
  // Direct comparison
  return normActual === normExpected;
}

function calculateScheduleScore(actualSchedule, expectedSchedule) {
  let totalWeight = 0;
  let earnedWeight = 0;
  const fieldResults = {};
  
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    totalWeight += weight;
    
    const match = compareValues(actualSchedule[field], expectedSchedule[field], field);
    
    if (match) {
      earnedWeight += weight;
    }
    
    fieldResults[field] = {
      actual: actualSchedule[field],
      expected: expectedSchedule[field],
      match,
      weight
    };
  }
  
  const score = (earnedWeight / totalWeight) * 100;
  
  return {
    score: score.toFixed(2),
    earnedWeight: earnedWeight.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    fieldResults
  };
}

async function extractContract(pdfPath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(pdfPath));
  
  const params = new URLSearchParams({
    model: 'o3',
    forceMulti: 'auto',
    runs: '1',
    merchantId: MERCHANT_ID,
    stage: 'production',
    consistency: 'consistent'
  });
  
  const response = await fetch(`${SERVER_URL}/api/extract?${params}`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Extraction failed');
  }
  
  return await response.json();
}

async function runEvaluation() {
  console.log('🔬 Starting Tabs Platform Evaluation\n');
  console.log(`📁 PDF Directory: ${PDF_DIR}`);
  console.log(`📄 JSON Directory: ${JSON_DIR}\n`);
  
  const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  const results = [];
  
  console.log(`Found ${pdfFiles.length} contracts to evaluate\n`);
  
  // TEST MODE: Only process first contract with expected JSON
  const testFile = pdfFiles.find(f => {
    const jsonFile = f + '.json';
    return fs.existsSync(path.join(JSON_DIR, jsonFile));
  });
  
  if (!testFile) {
    console.log('❌ No contracts with expected JSON found!');
    return;
  }
  
  const filesToProcess = [testFile]; // Only test one
  
  for (let i = 0; i < filesToProcess.length; i++) {
    const pdfFile = filesToProcess[i];
    const jsonFile = pdfFile + '.json';
    const jsonPath = path.join(JSON_DIR, jsonFile);
    
    console.log(`[${i + 1}/${pdfFiles.length}] Processing: ${pdfFile}`);
    
    // Check if expected JSON exists
    if (!fs.existsSync(jsonPath)) {
      console.log(`  ⚠️  No expected JSON found, skipping\n`);
      results.push({
        contract: pdfFile,
        status: 'SKIPPED',
        reason: 'No expected output',
        score: 0,
        extractedSchedules: [],
        expectedSchedules: []
      });
      continue;
    }
    
    try {
      // Load expected output
      const expectedRaw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      
      // Map expected format to garage format
      const expectedSchedules = (expectedRaw['Revenue Schedules'] || expectedRaw.schedules || []).map(s => ({
        service_start_date: s['Service Start Date'] || s.service_start_date,
        service_term: s.Duration || s.service_term,
        revenue_category: s.revenue_category || null,
        item_name: s.Name || s.item_name,
        item_description: s.Note || s.item_description || '',
        start_date: s['Start Date'] || s.start_date,
        frequency_unit: s['Due Interval Unit'] || s.frequency_unit,
        period: s['Due Interval'] || s.period,
        number_of_periods: s.Duration || s.number_of_periods,
        arrears: s['Is Arrears'] === true || s.arrears === true,
        billing_type: s['Billing Type'] || s.billing_type,
        event_to_track: s.event_to_track || null,
        integration_item: s.integration_item || null,
        discounts: s.discounts || [],
        net_terms: s['Net Payment Terms'] || s.net_terms,
        quantity: s.Quantity || s.quantity,
        total_price: s.Price || s.total_price,
        pricing_tiers: s.pricing_tiers || []
      }));
      
      // Extract actual output
      console.log(`  🤖 Running extraction...`);
      const pdfPath = path.join(PDF_DIR, pdfFile);
      const actual = await extractContract(pdfPath);
      
      // Compare garage revenue schedules
      const actualSchedules = actual.garage_revenue_schedules || [];
      
      console.log(`  📊 Extracted: ${actualSchedules.length} schedules`);
      console.log(`  ✅ Expected: ${expectedSchedules.length} schedules`);
      
      if (actualSchedules.length !== expectedSchedules.length) {
        console.log(`  ⚠️  Schedule count mismatch!`);
      }
      
      // Calculate scores for each schedule
      const scheduleScores = [];
      const minLength = Math.min(actualSchedules.length, expectedSchedules.length);
      
      for (let j = 0; j < minLength; j++) {
        const scoreResult = calculateScheduleScore(actualSchedules[j], expectedSchedules[j]);
        scheduleScores.push(scoreResult);
        console.log(`  📈 Schedule ${j + 1} Score: ${scoreResult.score}%`);
      }
      
      // Average score across all schedules
      const avgScore = scheduleScores.length > 0 
        ? (scheduleScores.reduce((sum, s) => sum + parseFloat(s.score), 0) / scheduleScores.length).toFixed(2)
        : 0;
      
      console.log(`  🎯 Overall Score: ${avgScore}%\n`);
      
      results.push({
        contract: pdfFile,
        status: 'COMPLETED',
        score: parseFloat(avgScore),
        scheduleCount: actualSchedules.length,
        expectedCount: expectedSchedules.length,
        scheduleScores,
        extractedSchedules: actualSchedules,
        expectedSchedules,
        actualFull: actual
      });
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      results.push({
        contract: pdfFile,
        status: 'ERROR',
        error: error.message,
        score: 0,
        extractedSchedules: [],
        expectedSchedules: []
      });
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate Excel report
  console.log('\n📊 Generating Excel report...');
  generateExcelReport(results);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));
  
  const completed = results.filter(r => r.status === 'COMPLETED');
  const avgOverall = completed.length > 0
    ? (completed.reduce((sum, r) => sum + r.score, 0) / completed.length).toFixed(2)
    : 0;
  
  console.log(`Total Contracts: ${results.length}`);
  console.log(`Completed: ${completed.length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'ERROR').length}`);
  console.log(`Skipped: ${results.filter(r => r.status === 'SKIPPED').length}`);
  console.log(`\nAverage Score: ${avgOverall}%`);
  
  completed.forEach(r => {
    console.log(`  ${r.contract}: ${r.score}%`);
  });
  
  console.log('\n✅ Evaluation complete!');
  console.log(`📄 Report saved to: ${path.join(EVAL_BASE, 'evaluation_results.xlsx')}\n`);
}

function generateExcelReport(results) {
  const workbook = xlsx.utils.book_new();
  
  // Summary sheet
  const summaryData = results.map(r => ({
    'Contract': r.contract,
    'Status': r.status,
    'Score (%)': r.score,
    'Schedules Extracted': r.scheduleCount || 0,
    'Schedules Expected': r.expectedCount || 0,
    'Error': r.error || ''
  }));
  
  const summarySheet = xlsx.utils.json_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Detailed results per contract
  results.forEach(result => {
    if (result.status !== 'COMPLETED') return;
    
    const sheetName = result.contract.substring(0, 30); // Excel sheet name limit
    const detailData = [];
    
    result.scheduleScores.forEach((scoreResult, idx) => {
      const schedule = result.extractedSchedules[idx];
      const expected = result.expectedSchedules[idx];
      
      detailData.push({
        'Schedule': idx + 1,
        'Score': scoreResult.score + '%',
        '': ''
      });
      
      // Add each field comparison
      for (const [field, data] of Object.entries(scoreResult.fieldResults)) {
        detailData.push({
          'Field': field,
          'Actual': JSON.stringify(data.actual),
          'Expected': JSON.stringify(data.expected),
          'Match': data.match ? 'YES' : 'NO',
          'Weight': data.weight
        });
      }
      
      detailData.push({}); // Empty row between schedules
    });
    
    const detailSheet = xlsx.utils.json_to_sheet(detailData);
    xlsx.utils.book_append_sheet(workbook, detailSheet, sheetName);
  });
  
  // Write file
  const outputPath = path.join(EVAL_BASE, 'evaluation_results.xlsx');
  xlsx.writeFile(workbook, outputPath);
}

// Run evaluation
runEvaluation().catch(console.error);


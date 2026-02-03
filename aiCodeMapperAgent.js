/**
 * AI Code Mapper Agent - FIXED VERSION
 * Uses OpenAI to dynamically map medical conditions to billing codes
 * 
 * FIXES:
 * - Removed response_format from Responses API (incompatible with web_search)
 * - Removed web_search from Chat Completions fallback (not supported)
 * - Added robust JSON extraction from text responses
 */
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the AI agent
const SYSTEM_PROMPT = `You are an expert medical coding specialist with deep knowledge of:
- ICD-10-CM diagnosis codes
- CPT procedure codes  
- HCPCS Level II codes (drugs, supplies, services)
- Clinical guidelines (KDIGO, ACC/AHA, ACR, ADA)
- Medical billing and Medicare coverage

Your task is to map a user's natural language query about a medical condition to the appropriate billing codes for physician identification in Medicare claims data.

CRITICAL INSTRUCTIONS:
1. ALWAYS respond with valid JSON only - no markdown, no explanations outside JSON
2. Identify the medical condition from the user's query
3. Provide relevant ICD-10, CPT, and HCPCS codes with confidence levels
4. Include rationale for each code selection
5. Cite clinical guidelines and validation studies when possible
6. Recommend appropriate medical specialties
7. Suggest comorbidity filters based on typical patient populations

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "condition": {
    "name": "Full condition name",
    "description": "Brief clinical description",
    "category": "Specialty category (e.g., Nephrology, Cardiology)"
  },
  "codes": {
    "icd10": [
      {
        "code": "N02.8",
        "description": "Code description",
        "confidence": "high|medium|low",
        "rationale": "Why this code is appropriate",
        "isPrimary": true
      }
    ],
    "cpt": [
      {
        "code": "50200",
        "description": "Procedure description",
        "confidence": "high|medium|low",
        "rationale": "Why this procedure is relevant"
      }
    ],
    "hcpcs": [
      {
        "code": "J9312",
        "description": "Drug/service description",
        "confidence": "high|medium|low",
        "rationale": "Why this drug/service is used"
      }
    ],
    "partDDrugs": ["Drug names for oral medications"]
  },
  "recommendedSpecialties": ["Nephrology", "Internal Medicine"],
  "comorbidityFilters": {
    "ckd": 15,
    "diabetes": 10,
    "hypertension": 20
  },
  "sources": [
    {
      "name": "KDIGO 2021 Clinical Practice Guideline",
      "type": "guideline",
      "note": "Relevant recommendation"
    }
  ],
  "confidence": "high|medium|low",
  "warnings": ["Any important caveats"]
}

IMPORTANT CODE KNOWLEDGE:
- IgA Nephropathy: N02.8 (primary, ~99% PPV), N02.B1-B6 (subtypes)
- Membranous Nephropathy: N04.2, N04.21 (primary), N06.2, N06.21
- CKD Stages: N18.1-N18.6 (stage 1-5 and ESRD)
- Lupus Nephritis: M32.14 (glomerular), M32.15 (tubulointerstitial)
- FSGS: N04.1 (nephrotic), N06.1 (proteinuria)
- Diabetic Nephropathy: E11.21, E11.22 (Type 2), E10.21, E10.22 (Type 1)
- Kidney Biopsy: 50200 (percutaneous), 50205 (surgical)
- Dialysis: 90935-90937 (hemodialysis), 90945-90947 (other)
- Rituximab: J9312 (reference), J9311 (biosimilar)
- Methylprednisolone: J1020 (20mg), J1030 (40mg), J1040 (80mg)
- Belimumab: J0490 (lupus)
- Tacrolimus: J7516 (oral 1mg)
- Cyclosporine: J7502 (oral 100mg)

Remember: ONLY output valid JSON, nothing else.`;

// Knowledge base for common conditions (fallback when API fails)
const CONDITION_KNOWLEDGE = {
  'iga': {
    condition: { name: 'IgA Nephropathy', description: 'Autoimmune kidney disease with IgA deposits in glomeruli', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'N02.8', description: 'Recurrent/persistent hematuria with other morphologic changes', confidence: 'high', rationale: 'Primary IgAN code with ~99% PPV per Sim et al. 2023', isPrimary: true },
        { code: 'N02.B3', description: 'Recurrent/persistent hematuria with diffuse mesangial proliferative GN', confidence: 'medium', rationale: 'Specific subtype code added Oct 2023', isPrimary: false }
      ],
      cpt: [
        { code: '50200', description: 'Renal biopsy, percutaneous', confidence: 'high', rationale: 'Gold standard for IgAN diagnosis' }
      ],
      hcpcs: [
        { code: 'J9312', description: 'Rituximab injection, 10mg', confidence: 'medium', rationale: 'Off-label use in refractory IgAN' },
        { code: 'J1020', description: 'Methylprednisolone 20mg injection', confidence: 'high', rationale: 'First-line immunosuppression' }
      ],
      partDDrugs: ['PREDNISONE', 'LISINOPRIL', 'LOSARTAN', 'MYCOPHENOLATE']
    },
    recommendedSpecialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 15, hypertension: 25 },
    sources: [{ name: 'KDIGO 2021 IgAN Guideline', type: 'guideline', note: 'Supportive care + immunosuppression for high-risk' }, { name: 'Sim et al. 2023 Clin Kidney J', type: 'validation_study', note: 'N02.8 PPV ~99% for IgAN' }],
    confidence: 'high',
    warnings: ['ICD-10 N02.8 validated with high PPV but may capture other GN types']
  },
  'membranous': {
    condition: { name: 'Primary Membranous Nephropathy', description: 'Autoimmune glomerular disease with subepithelial immune deposits', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'N04.2', description: 'Nephrotic syndrome with diffuse membranous GN', confidence: 'high', rationale: 'Primary PMN code', isPrimary: true },
        { code: 'N04.21', description: 'Nephrotic syndrome with primary membranous nephropathy', confidence: 'high', rationale: 'Specific PMN code added Oct 2023', isPrimary: true },
        { code: 'N06.21', description: 'Isolated proteinuria with primary membranous nephropathy', confidence: 'high', rationale: 'PMN without full nephrotic syndrome', isPrimary: false }
      ],
      cpt: [
        { code: '50200', description: 'Renal biopsy, percutaneous', confidence: 'high', rationale: 'Required for diagnosis' }
      ],
      hcpcs: [
        { code: 'J9312', description: 'Rituximab injection, 10mg', confidence: 'high', rationale: 'First-line therapy per KDIGO' },
        { code: 'J7502', description: 'Cyclosporine oral 100mg', confidence: 'medium', rationale: 'Alternative calcineurin inhibitor therapy' }
      ],
      partDDrugs: ['RITUXIMAB', 'CYCLOSPORINE', 'TACROLIMUS', 'PREDNISONE']
    },
    recommendedSpecialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 20 },
    sources: [{ name: 'KDIGO 2021 GN Guideline', type: 'guideline', note: 'Rituximab first-line for PMN' }],
    confidence: 'high',
    warnings: ['Distinguish primary from secondary causes (malignancy, drugs, infections)']
  },
  'lupus': {
    condition: { name: 'Lupus Nephritis', description: 'Kidney inflammation from systemic lupus erythematosus', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'M32.14', description: 'Glomerular disease in SLE', confidence: 'high', rationale: 'Primary lupus nephritis code', isPrimary: true },
        { code: 'M32.15', description: 'Tubulo-interstitial nephropathy in SLE', confidence: 'medium', rationale: 'Tubulointerstitial involvement', isPrimary: false }
      ],
      cpt: [
        { code: '50200', description: 'Renal biopsy, percutaneous', confidence: 'high', rationale: 'Required for classification' }
      ],
      hcpcs: [
        { code: 'J0490', description: 'Belimumab injection 10mg', confidence: 'high', rationale: 'FDA approved for lupus nephritis 2020' },
        { code: 'J9070', description: 'Cyclophosphamide 100mg', confidence: 'medium', rationale: 'Induction therapy for severe LN' }
      ],
      partDDrugs: ['HYDROXYCHLOROQUINE', 'MYCOPHENOLATE', 'PREDNISONE', 'VOCLOSPORIN', 'BELIMUMAB']
    },
    recommendedSpecialties: ['Nephrology', 'Rheumatology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 20 },
    sources: [{ name: 'ACR/EULAR 2019 SLE Guideline', type: 'guideline', note: 'Multitarget therapy approach' }],
    confidence: 'high',
    warnings: ['Often requires rheumatology co-management']
  },
  'ckd': {
    condition: { name: 'Chronic Kidney Disease', description: 'Progressive loss of kidney function over time', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'N18.3', description: 'CKD Stage 3', confidence: 'high', rationale: 'Most common stage at diagnosis', isPrimary: true },
        { code: 'N18.4', description: 'CKD Stage 4', confidence: 'high', rationale: 'Advanced CKD', isPrimary: false },
        { code: 'N18.5', description: 'CKD Stage 5', confidence: 'high', rationale: 'Pre-dialysis ESRD', isPrimary: false },
        { code: 'N18.6', description: 'End stage renal disease', confidence: 'high', rationale: 'On dialysis or transplant', isPrimary: false }
      ],
      cpt: [
        { code: '90935', description: 'Hemodialysis with single evaluation', confidence: 'high', rationale: 'Dialysis management' },
        { code: '36147', description: 'Dialysis circuit access', confidence: 'medium', rationale: 'Vascular access procedures' }
      ],
      hcpcs: [
        { code: 'J0881', description: 'Darbepoetin alfa injection', confidence: 'medium', rationale: 'Anemia of CKD' },
        { code: 'J0885', description: 'Epoetin alfa injection', confidence: 'medium', rationale: 'ESA for anemia' }
      ],
      partDDrugs: ['SEVELAMER', 'CALCIUM ACETATE', 'CALCITRIOL', 'SODIUM BICARBONATE']
    },
    recommendedSpecialties: ['Nephrology', 'Internal Medicine', 'Family Practice'],
    comorbidityFilters: { ckd: 30, diabetes: 25, hypertension: 40 },
    sources: [{ name: 'KDIGO 2024 CKD Guideline', type: 'guideline', note: 'SGLT2 inhibitors for all CKD with albuminuria' }],
    confidence: 'high',
    warnings: ['High prevalence in Medicare - may need additional filters']
  },
  'fsgs': {
    condition: { name: 'Focal Segmental Glomerulosclerosis', description: 'Kidney scarring disease affecting glomeruli', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'N04.1', description: 'Nephrotic syndrome with focal/segmental lesions', confidence: 'high', rationale: 'Primary FSGS code', isPrimary: true },
        { code: 'N06.1', description: 'Isolated proteinuria with focal/segmental lesions', confidence: 'high', rationale: 'FSGS with proteinuria only', isPrimary: false }
      ],
      cpt: [
        { code: '50200', description: 'Renal biopsy, percutaneous', confidence: 'high', rationale: 'Required for diagnosis' }
      ],
      hcpcs: [
        { code: 'J7516', description: 'Tacrolimus oral 1mg', confidence: 'medium', rationale: 'Calcineurin inhibitor therapy' },
        { code: 'J1020', description: 'Methylprednisolone 20mg', confidence: 'high', rationale: 'First-line immunosuppression' }
      ],
      partDDrugs: ['TACROLIMUS', 'CYCLOSPORINE', 'PREDNISONE', 'MYCOPHENOLATE']
    },
    recommendedSpecialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 25 },
    sources: [{ name: 'KDIGO 2021 GN Guideline', type: 'guideline', note: 'Steroids + CNI for steroid-resistant' }],
    confidence: 'high',
    warnings: ['Distinguish primary from secondary FSGS (obesity, HIV, drugs)']
  },
  'diabetic': {
    condition: { name: 'Diabetic Nephropathy', description: 'Kidney damage from diabetes mellitus', category: 'Nephrology' },
    codes: {
      icd10: [
        { code: 'E11.21', description: 'Type 2 DM with diabetic nephropathy', confidence: 'high', rationale: 'T2DM with kidney involvement', isPrimary: true },
        { code: 'E11.22', description: 'Type 2 DM with diabetic CKD', confidence: 'high', rationale: 'T2DM with established CKD', isPrimary: true },
        { code: 'E10.21', description: 'Type 1 DM with diabetic nephropathy', confidence: 'high', rationale: 'T1DM with kidney involvement', isPrimary: false }
      ],
      cpt: [
        { code: '82043', description: 'Urine albumin quantitative', confidence: 'high', rationale: 'Albuminuria screening' },
        { code: '83036', description: 'Hemoglobin A1c', confidence: 'high', rationale: 'Glycemic monitoring' }
      ],
      hcpcs: [
        { code: 'J0881', description: 'Darbepoetin alfa', confidence: 'medium', rationale: 'Anemia management' }
      ],
      partDDrugs: ['EMPAGLIFLOZIN', 'DAPAGLIFLOZIN', 'CANAGLIFLOZIN', 'FINERENONE', 'LISINOPRIL', 'LOSARTAN', 'SEMAGLUTIDE']
    },
    recommendedSpecialties: ['Nephrology', 'Endocrinology', 'Internal Medicine'],
    comorbidityFilters: { diabetes: 40, ckd: 30, hypertension: 50 },
    sources: [{ name: 'ADA 2024 Standards of Care', type: 'guideline', note: 'SGLT2i + finerenone for DKD' }],
    confidence: 'high',
    warnings: ['Most common cause of ESRD - very high prevalence']
  }
};

/**
 * Extract JSON from text that may contain markdown or other formatting
 */
function extractJSON(text) {
  if (!text) return null;
  
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to extraction methods
  }
  
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try fixing common issues
      let fixed = jsonMatch[0]
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/'/g, '"')      // Replace single quotes
        .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
      
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        console.error('[AI Agent] Could not parse JSON:', e2.message);
      }
    }
  }
  
  return null;
}

/**
 * Find matching condition from knowledge base
 */
function findKnowledgeBaseMatch(query) {
  const q = query.toLowerCase();
  
  if (q.includes('iga') || q.includes('berger')) return CONDITION_KNOWLEDGE['iga'];
  if (q.includes('membranous') || q.includes('pmn') || q.includes('mgn')) return CONDITION_KNOWLEDGE['membranous'];
  if (q.includes('lupus') || q.includes('sle')) return CONDITION_KNOWLEDGE['lupus'];
  if (q.includes('fsgs') || q.includes('focal segmental')) return CONDITION_KNOWLEDGE['fsgs'];
  if (q.includes('diabetic') && (q.includes('kidney') || q.includes('nephro') || q.includes('ckd'))) return CONDITION_KNOWLEDGE['diabetic'];
  if (q.includes('ckd') || q.includes('chronic kidney') || q.includes('renal failure') || q.includes('kidney disease')) return CONDITION_KNOWLEDGE['ckd'];
  
  return null;
}

/**
 * Map condition using OpenAI Responses API with web search
 * NOTE: Cannot use response_format with web_search
 */
async function mapConditionToCodesResponses(query) {
  console.log(`[AI Agent] Starting Responses API code mapping for: "${query}"`);
  
  const response = await openai.responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: `${SYSTEM_PROMPT}\n\nUser Query: "${query}"\n\nIMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks, just the raw JSON object.`
    // NOTE: response_format removed - incompatible with web_search
  });
  
  // Extract text from response
  let resultText = '';
  if (response.output) {
    for (const item of response.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            resultText += content.text;
          }
        }
      }
    }
  }
  
  console.log(`[AI Agent] Responses API raw output length: ${resultText.length}`);
  
  // Extract JSON from response
  const parsed = extractJSON(resultText);
  if (!parsed) {
    throw new Error('Could not parse JSON from Responses API output');
  }
  
  return {
    ...parsed,
    metadata: {
      method: 'responses_api',
      model: 'gpt-4o',
      hasWebSearch: true
    }
  };
}

/**
 * Map condition using Chat Completions API (no web search)
 * This is the reliable fallback that uses model's training knowledge
 */
async function mapConditionToCodesChat(query) {
  console.log(`[AI Agent] Starting Chat Completions code mapping for: "${query}"`);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Map the following medical condition to billing codes:\n\n"${query}"\n\nReturn ONLY valid JSON.` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000
  });
  
  const content = response.choices[0]?.message?.content;
  console.log(`[AI Agent] Chat API response length: ${content?.length || 0}`);
  
  const parsed = extractJSON(content);
  if (!parsed) {
    throw new Error('Could not parse JSON from Chat API output');
  }
  
  return {
    ...parsed,
    metadata: {
      method: 'chat_completions',
      model: 'gpt-4o',
      hasWebSearch: false
    }
  };
}

/**
 * Generate markdown report from code mapping result
 */
function generateReport(result, query) {
  const { condition, codes, recommendedSpecialties, comorbidityFilters, sources, confidence, warnings } = result;
  
  let report = `# AI Code Mapping Report\n\n`;
  report += `## Query Analysis\n`;
  report += `**Input:** "${query}"\n\n`;
  
  report += `## Condition Identified\n`;
  report += `**${condition?.name || 'Unknown'}** (Confidence: ${confidence || 'medium'})\n\n`;
  report += `${condition?.description || ''}\n\n`;
  report += `*Category: ${condition?.category || 'General Medicine'}*\n\n`;
  
  // ICD-10 Codes
  if (codes?.icd10?.length > 0) {
    report += `## Diagnostic Codes (ICD-10-CM)\n\n`;
    report += `| Code | Description | Confidence | Rationale |\n`;
    report += `|------|-------------|------------|----------|\n`;
    for (const code of codes.icd10) {
      const primary = code.isPrimary ? ' ⭐' : '';
      report += `| ${code.code}${primary} | ${code.description || ''} | ${code.confidence || 'medium'} | ${code.rationale || ''} |\n`;
    }
    report += `\n`;
  }
  
  // CPT Codes
  if (codes?.cpt?.length > 0) {
    report += `## Procedure Codes (CPT)\n\n`;
    report += `| Code | Description | Confidence | Rationale |\n`;
    report += `|------|-------------|------------|----------|\n`;
    for (const code of codes.cpt) {
      report += `| ${code.code} | ${code.description || ''} | ${code.confidence || 'medium'} | ${code.rationale || ''} |\n`;
    }
    report += `\n`;
  }
  
  // HCPCS Codes
  if (codes?.hcpcs?.length > 0) {
    report += `## Drug & Service Codes (HCPCS)\n\n`;
    report += `| Code | Description | Confidence | Rationale |\n`;
    report += `|------|-------------|------------|----------|\n`;
    for (const code of codes.hcpcs) {
      report += `| ${code.code} | ${code.description || ''} | ${code.confidence || 'medium'} | ${code.rationale || ''} |\n`;
    }
    report += `\n`;
  }
  
  // Part D Drugs
  if (codes?.partDDrugs?.length > 0) {
    report += `## Part D Drugs (Oral Medications)\n\n`;
    report += codes.partDDrugs.map(d => `- ${d}`).join('\n');
    report += `\n\n`;
  }
  
  // Specialties
  if (recommendedSpecialties?.length > 0) {
    report += `## Recommended Specialties\n\n`;
    report += recommendedSpecialties.map(s => `- ${s}`).join('\n');
    report += `\n\n`;
  }
  
  // Comorbidity Filters
  if (comorbidityFilters && Object.keys(comorbidityFilters).length > 0) {
    report += `## Suggested Comorbidity Filters\n\n`;
    report += `These thresholds identify physicians with patient panels enriched for this condition:\n\n`;
    for (const [key, value] of Object.entries(comorbidityFilters)) {
      const label = key.toUpperCase().replace('_', ' ');
      report += `- **${label}:** ≥${value}% of beneficiaries\n`;
    }
    report += `\n`;
  }
  
  // Sources
  if (sources?.length > 0) {
    report += `## Sources & Validation\n\n`;
    for (const source of sources) {
      report += `- **${source.name}** (${source.type || 'reference'}): ${source.note || ''}\n`;
    }
    report += `\n`;
  }
  
  // Warnings
  if (warnings?.length > 0) {
    report += `## ⚠️ Limitations & Caveats\n\n`;
    for (const warning of warnings) {
      report += `- ${warning}\n`;
    }
    report += `\n`;
  }
  
  report += `---\n`;
  report += `*Generated by AI Code Mapper | Method: ${result.metadata?.method || 'unknown'} | Model: ${result.metadata?.model || 'gpt-4o'}*\n`;
  
  return report;
}

/**
 * Main entry point - maps condition to codes with fallback chain
 */
async function mapCodes(query, options = {}) {
  const startTime = Date.now();
  
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return {
      success: false,
      error: 'Invalid query - please provide a medical condition or description',
      query
    };
  }
  
  let result = null;
  let method = 'unknown';
  
  // Try Responses API with web search first
  try {
    result = await mapConditionToCodesResponses(query);
    method = 'responses_api';
    console.log('[AI Agent] Responses API succeeded');
  } catch (err) {
    console.error(`[AI Agent] Responses API error: ${err.message}`);
    
    // Try Chat Completions API (reliable fallback)
    try {
      result = await mapConditionToCodesChat(query);
      method = 'chat_completions';
      console.log('[AI Agent] Chat Completions API succeeded');
    } catch (err2) {
      console.error(`[AI Agent] Chat API error: ${err2.message}`);
      
      // Final fallback: knowledge base
      const kbMatch = findKnowledgeBaseMatch(query);
      if (kbMatch) {
        result = { ...kbMatch };
        method = 'knowledge_base';
        console.log('[AI Agent] Using knowledge base fallback');
      }
    }
  }
  
  if (!result) {
    return {
      success: false,
      error: 'Could not map condition to codes. Please try a different query or be more specific.',
      query
    };
  }
  
  // Ensure required fields exist
  result.condition = result.condition || { name: query, description: '', category: 'General' };
  result.codes = result.codes || { icd10: [], cpt: [], hcpcs: [], partDDrugs: [] };
  result.recommendedSpecialties = result.recommendedSpecialties || [];
  result.comorbidityFilters = result.comorbidityFilters || {};
  result.sources = result.sources || [];
  result.confidence = result.confidence || 'medium';
  result.warnings = result.warnings || [];
  
  // Generate report
  const report = generateReport(result, query);
  
  const processingTime = Date.now() - startTime;
  
  return {
    success: true,
    query,
    ...result,
    report,
    metadata: {
      ...result.metadata,
      method,
      processingTime,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get status of AI system
 */
async function getStatus() {
  return {
    available: !!process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    capabilities: ['code_mapping', 'web_search', 'knowledge_base_fallback'],
    knowledgeBaseConditions: Object.keys(CONDITION_KNOWLEDGE)
  };
}

module.exports = {
  mapCodes,
  getStatus,
  CONDITION_KNOWLEDGE
};
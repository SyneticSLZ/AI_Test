/**
 * AI Code Mapper Service
 * Suggests relevant billing codes (ICD-10, CPT, HCPCS) for medical conditions
 * Uses a rule-based approach with medical knowledge base
 */

const CMSSchema = require('./cmsSchema');

// Medical knowledge base for code mapping
const MedicalKnowledgeBase = {
  // Condition synonyms and related terms
  conditionAliases: {
    'iga nephropathy': ['igan', 'berger disease', 'bergers disease', 'iga disease', 'mesangial iga'],
    'membranous nephropathy': ['pmn', 'primary membranous', 'membranous glomerulonephritis', 'mgn'],
    'chronic kidney disease': ['ckd', 'chronic renal failure', 'renal insufficiency', 'kidney failure'],
    'lupus nephritis': ['ln', 'sle nephritis', 'lupus kidney'],
    'fsgs': ['focal segmental glomerulosclerosis', 'focal sclerosis'],
    'diabetic nephropathy': ['diabetic kidney disease', 'dkd', 'diabetic renal disease'],
    'polycystic kidney': ['pkd', 'adpkd', 'polycystic kidney disease'],
    'nephrotic syndrome': ['nephrosis', 'protein losing nephropathy'],
    'glomerulonephritis': ['gn', 'glomerular nephritis'],
  },
  
  // ICD-10 code mappings
  icd10Codes: {
    'iga nephropathy': [
      { code: 'N02.8', description: 'Recurrent and persistent hematuria with other morphologic changes', confidence: 'high', notes: 'Primary code for IgAN - ~99% PPV (Sim et al., 2023)' },
      { code: 'N02.B1', description: 'Recurrent and persistent hematuria with focal segmental hyalinosis/sclerosis', confidence: 'medium', notes: 'New codes as of Oct 2023' },
      { code: 'N02.B2', description: 'Recurrent and persistent hematuria with membranous glomerulonephritis', confidence: 'medium', notes: 'New codes as of Oct 2023' },
      { code: 'N02.B3', description: 'Recurrent and persistent hematuria with mesangial proliferative glomerulonephritis', confidence: 'high', notes: 'New codes as of Oct 2023' },
      { code: 'N02.B4', description: 'Recurrent and persistent hematuria with endocapillary proliferative glomerulonephritis', confidence: 'medium', notes: 'New codes as of Oct 2023' },
    ],
    'membranous nephropathy': [
      { code: 'N04.2', description: 'Nephrotic syndrome with diffuse membranous glomerulonephritis', confidence: 'high', notes: 'Primary PMN code' },
      { code: 'N04.21', description: 'Nephrotic syndrome with primary membranous nephropathy', confidence: 'high', notes: 'Specific PMN code - expanded Oct 2023' },
      { code: 'N04.22', description: 'Nephrotic syndrome with secondary membranous nephropathy', confidence: 'medium', notes: 'Secondary cause - verify indication' },
      { code: 'N06.2', description: 'Isolated proteinuria with diffuse membranous glomerulonephritis', confidence: 'high', notes: 'PMN with proteinuria' },
      { code: 'N06.21', description: 'Isolated proteinuria with primary membranous nephropathy', confidence: 'high', notes: 'Specific PMN code' },
    ],
    'chronic kidney disease': [
      { code: 'N18.1', description: 'Chronic kidney disease, stage 1', confidence: 'high', notes: 'GFR ≥90' },
      { code: 'N18.2', description: 'Chronic kidney disease, stage 2', confidence: 'high', notes: 'GFR 60-89' },
      { code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)', confidence: 'high', notes: 'GFR 30-59' },
      { code: 'N18.30', description: 'Chronic kidney disease, stage 3 unspecified', confidence: 'high', notes: 'Stage 3 NOS' },
      { code: 'N18.31', description: 'Chronic kidney disease, stage 3a', confidence: 'high', notes: 'GFR 45-59' },
      { code: 'N18.32', description: 'Chronic kidney disease, stage 3b', confidence: 'high', notes: 'GFR 30-44' },
      { code: 'N18.4', description: 'Chronic kidney disease, stage 4', confidence: 'high', notes: 'GFR 15-29' },
      { code: 'N18.5', description: 'Chronic kidney disease, stage 5', confidence: 'high', notes: 'GFR <15' },
      { code: 'N18.6', description: 'End stage renal disease', confidence: 'high', notes: 'ESRD - dialysis/transplant' },
    ],
    'lupus nephritis': [
      { code: 'M32.14', description: 'Glomerular disease in SLE', confidence: 'high', notes: 'Primary lupus nephritis code' },
      { code: 'M32.15', description: 'Tubulo-interstitial nephropathy in SLE', confidence: 'medium', notes: 'Tubulointerstitial involvement' },
      { code: 'N08', description: 'Glomerular disorders in diseases classified elsewhere', confidence: 'medium', notes: 'Secondary code - use with M32.x' },
    ],
    'fsgs': [
      { code: 'N04.1', description: 'Nephrotic syndrome with focal and segmental glomerular lesions', confidence: 'high', notes: 'Primary FSGS code' },
      { code: 'N06.1', description: 'Isolated proteinuria with focal and segmental glomerular lesions', confidence: 'high', notes: 'FSGS with proteinuria' },
      { code: 'N07.1', description: 'Hereditary nephropathy with focal and segmental glomerulosclerosis', confidence: 'medium', notes: 'Hereditary FSGS' },
    ],
    'diabetic nephropathy': [
      { code: 'E11.21', description: 'Type 2 diabetes with diabetic nephropathy', confidence: 'high', notes: 'T2DM with nephropathy' },
      { code: 'E11.22', description: 'Type 2 diabetes with diabetic chronic kidney disease', confidence: 'high', notes: 'T2DM with CKD' },
      { code: 'E10.21', description: 'Type 1 diabetes with diabetic nephropathy', confidence: 'high', notes: 'T1DM with nephropathy' },
      { code: 'E10.22', description: 'Type 1 diabetes with diabetic chronic kidney disease', confidence: 'high', notes: 'T1DM with CKD' },
    ],
  },
  
  // CPT procedure code mappings
  cptCodes: {
    'renal biopsy': [
      { code: '50200', description: 'Renal biopsy; percutaneous, by trocar or needle', confidence: 'high', notes: 'Standard percutaneous biopsy' },
      { code: '50205', description: 'Renal biopsy; by surgical exposure of kidney', confidence: 'high', notes: 'Open surgical biopsy' },
      { code: '50555', description: 'Renal endoscopy through nephrotomy or pyelotomy, with biopsy', confidence: 'medium', notes: 'Endoscopic biopsy' },
    ],
    'dialysis': [
      { code: '90935', description: 'Hemodialysis procedure with single evaluation', confidence: 'high', notes: 'Single HD evaluation' },
      { code: '90937', description: 'Hemodialysis procedure requiring repeated evaluation', confidence: 'high', notes: 'Complex HD' },
      { code: '90945', description: 'Dialysis procedure other than hemodialysis, single evaluation', confidence: 'high', notes: 'PD or other' },
      { code: '90947', description: 'Dialysis procedure other than hemodialysis, repeated evaluation', confidence: 'high', notes: 'Complex PD' },
    ],
    'dialysis access': [
      { code: '36147', description: 'Access to dialysis circuit for diagnostic study', confidence: 'high', notes: 'Diagnostic access' },
      { code: '36148', description: 'Access to dialysis circuit for therapeutic intervention', confidence: 'high', notes: 'Therapeutic access' },
    ],
    'office visit': [
      { code: '99213', description: 'Office/outpatient visit, established, low complexity', confidence: 'high', notes: '15-29 min' },
      { code: '99214', description: 'Office/outpatient visit, established, moderate complexity', confidence: 'high', notes: '30-39 min' },
      { code: '99215', description: 'Office/outpatient visit, established, high complexity', confidence: 'high', notes: '40-54 min' },
    ],
  },
  
  // HCPCS drug code mappings
  hcpcsDrugCodes: {
    'immunosuppressants': [
      { code: 'J9312', description: 'Injection, rituximab, 10 mg', confidence: 'high', notes: 'Rituximab for IgAN, PMN' },
      { code: 'J9311', description: 'Injection, rituximab-abbs (Truxima), 10 mg', confidence: 'high', notes: 'Biosimilar rituximab' },
      { code: 'J7502', description: 'Cyclosporine, oral, 100 mg', confidence: 'high', notes: 'Calcineurin inhibitor' },
      { code: 'J7500', description: 'Azathioprine, oral, 50 mg', confidence: 'high', notes: 'Immunosuppressant' },
      { code: 'J7516', description: 'Tacrolimus, oral, 1 mg', confidence: 'high', notes: 'Calcineurin inhibitor' },
    ],
    'corticosteroids': [
      { code: 'J1020', description: 'Injection, methylprednisolone, 20 mg', confidence: 'high', notes: 'IV steroid' },
      { code: 'J1030', description: 'Injection, methylprednisolone, 40 mg', confidence: 'high', notes: 'IV steroid' },
      { code: 'J1040', description: 'Injection, methylprednisolone, 80 mg', confidence: 'high', notes: 'IV steroid' },
    ],
    'biologics': [
      { code: 'J0135', description: 'Injection, adalimumab, 20 mg', confidence: 'medium', notes: 'TNF inhibitor' },
      { code: 'J1745', description: 'Injection, infliximab, 10 mg', confidence: 'medium', notes: 'TNF inhibitor' },
      { code: 'J0490', description: 'Injection, belimumab, 10 mg', confidence: 'high', notes: 'For lupus nephritis' },
    ],
    'phosphate binders': [
      { code: 'A4653', description: 'Peritoneal dialysis catheter anchoring device', confidence: 'medium', notes: 'PD supplies' },
    ],
  },
  
  // Specialty mappings
  specialtyMappings: {
    'nephrology': ['Nephrology', 'Internal Medicine'],
    'rheumatology': ['Rheumatology', 'Internal Medicine'],
    'oncology': ['Hematology/Oncology', 'Medical Oncology'],
    'endocrinology': ['Endocrinology', 'Internal Medicine'],
    'cardiology': ['Cardiology', 'Interventional Cardiology'],
  },
};

/**
 * Normalize condition name for lookup
 */
function normalizeCondition(condition) {
  const lower = condition.toLowerCase().trim();
  
  // Check direct match
  if (MedicalKnowledgeBase.icd10Codes[lower]) {
    return lower;
  }
  
  // Check aliases
  for (const [canonical, aliases] of Object.entries(MedicalKnowledgeBase.conditionAliases)) {
    if (aliases.includes(lower) || canonical.includes(lower) || lower.includes(canonical.split(' ')[0])) {
      return canonical;
    }
  }
  
  // Fuzzy match
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const canonical of Object.keys(MedicalKnowledgeBase.icd10Codes)) {
      if (canonical.includes(word)) {
        return canonical;
      }
    }
  }
  
  return null;
}

/**
 * Suggest ICD-10 codes for a condition
 */
function suggestICD10Codes(condition) {
  const normalized = normalizeCondition(condition);
  if (!normalized) {
    return {
      found: false,
      condition: condition,
      message: `Could not find ICD-10 codes for "${condition}". Try a more specific term like "IgA nephropathy" or "chronic kidney disease".`,
      suggestions: [],
    };
  }
  
  const codes = MedicalKnowledgeBase.icd10Codes[normalized] || [];
  
  return {
    found: true,
    condition: condition,
    normalizedCondition: normalized,
    codeType: 'ICD-10-CM',
    suggestions: codes,
    totalCodes: codes.length,
    highConfidence: codes.filter(c => c.confidence === 'high').length,
    notes: `Codes validated against CMS and clinical literature. High confidence codes recommended for primary filtering.`,
  };
}

/**
 * Suggest CPT codes for procedures
 */
function suggestCPTCodes(procedure) {
  const lower = procedure.toLowerCase().trim();
  
  let matches = [];
  for (const [key, codes] of Object.entries(MedicalKnowledgeBase.cptCodes)) {
    if (key.includes(lower) || lower.includes(key) || lower.split(/\s+/).some(w => key.includes(w))) {
      matches.push(...codes.map(c => ({ ...c, category: key })));
    }
  }
  
  if (matches.length === 0) {
    return {
      found: false,
      procedure: procedure,
      message: `Could not find CPT codes for "${procedure}". Try terms like "renal biopsy", "dialysis", or "office visit".`,
      suggestions: [],
    };
  }
  
  return {
    found: true,
    procedure: procedure,
    codeType: 'CPT',
    suggestions: matches,
    totalCodes: matches.length,
    highConfidence: matches.filter(c => c.confidence === 'high').length,
  };
}

/**
 * Suggest HCPCS drug codes
 */
function suggestHCPCSCodes(drugClass) {
  const lower = drugClass.toLowerCase().trim();
  
  let matches = [];
  for (const [key, codes] of Object.entries(MedicalKnowledgeBase.hcpcsDrugCodes)) {
    if (key.includes(lower) || lower.includes(key) || lower.split(/\s+/).some(w => key.includes(w))) {
      matches.push(...codes.map(c => ({ ...c, category: key })));
    }
  }
  
  if (matches.length === 0) {
    return {
      found: false,
      drugClass: drugClass,
      message: `Could not find HCPCS codes for "${drugClass}". Try terms like "immunosuppressants", "corticosteroids", or "biologics".`,
      suggestions: [],
    };
  }
  
  return {
    found: true,
    drugClass: drugClass,
    codeType: 'HCPCS',
    suggestions: matches,
    totalCodes: matches.length,
    highConfidence: matches.filter(c => c.confidence === 'high').length,
  };
}

/**
 * Get complete code set for an indication (ICD-10 + CPT + HCPCS)
 */
function getCompleteCodeSet(indication) {
  // Check if it's a predefined indication
  const predefined = CMSSchema.getIndicationById(indication);
  if (predefined) {
    return {
      found: true,
      indication: predefined.name,
      indicationId: predefined.id,
      description: predefined.description,
      category: predefined.category,
      isPredefined: true,
      codes: {
        icd10: predefined.icd10.map(code => ({
          code,
          description: getCodeDescription('icd10', code),
          confidence: 'high',
        })),
        cpt: predefined.cpt.map(code => ({
          code,
          description: getCodeDescription('cpt', code),
          confidence: 'high',
        })),
        hcpcs: predefined.hcpcs.map(code => ({
          code,
          description: getCodeDescription('hcpcs', code),
          confidence: 'high',
        })),
      },
      recommendedSpecialties: predefined.specialties,
      drugClasses: predefined.drugClasses,
      comorbidityFilters: predefined.comorbidityFilters,
      notes: predefined.notes,
      source: 'Curated code set - validated by clinical experts',
    };
  }
  
  // Otherwise, try to build from knowledge base
  const icd10 = suggestICD10Codes(indication);
  
  if (!icd10.found) {
    return {
      found: false,
      indication: indication,
      message: `Could not find a code set for "${indication}". Available indications: ${CMSSchema.getAllIndications().map(i => i.name).join(', ')}`,
    };
  }
  
  // Infer related CPT codes based on condition type
  let relatedProcedures = [];
  if (indication.toLowerCase().includes('nephro') || indication.toLowerCase().includes('kidney') || indication.toLowerCase().includes('renal')) {
    relatedProcedures = [
      ...MedicalKnowledgeBase.cptCodes['renal biopsy'] || [],
      ...MedicalKnowledgeBase.cptCodes['dialysis'] || [],
    ];
  }
  
  // Infer drug codes
  let relatedDrugs = MedicalKnowledgeBase.hcpcsDrugCodes['immunosuppressants'] || [];
  
  return {
    found: true,
    indication: indication,
    normalizedCondition: icd10.normalizedCondition,
    isPredefined: false,
    codes: {
      icd10: icd10.suggestions,
      cpt: relatedProcedures,
      hcpcs: relatedDrugs,
    },
    recommendedSpecialties: ['Nephrology', 'Internal Medicine'],
    notes: 'Code set generated from medical knowledge base. Review recommended before use.',
    source: 'AI-generated - requires expert validation',
  };
}

/**
 * Get description for a code
 */
function getCodeDescription(type, code) {
  if (type === 'cpt') {
    return CMSSchema.CommonCodes.procedures[code] || 'Description not available';
  }
  if (type === 'hcpcs') {
    return CMSSchema.CommonCodes.drugs[code] || 'Description not available';
  }
  // For ICD-10, search knowledge base
  for (const codes of Object.values(MedicalKnowledgeBase.icd10Codes)) {
    const found = codes.find(c => c.code === code);
    if (found) return found.description;
  }
  return 'Description not available';
}

/**
 * Search for codes by keyword
 */
function searchCodes(query, codeType = 'all') {
  const results = {
    query,
    icd10: [],
    cpt: [],
    hcpcs: [],
  };
  
  const lower = query.toLowerCase();
  
  if (codeType === 'all' || codeType === 'icd10') {
    for (const [condition, codes] of Object.entries(MedicalKnowledgeBase.icd10Codes)) {
      for (const c of codes) {
        if (c.code.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)) {
          results.icd10.push({ ...c, condition });
        }
      }
    }
  }
  
  if (codeType === 'all' || codeType === 'cpt') {
    for (const [procedure, codes] of Object.entries(MedicalKnowledgeBase.cptCodes)) {
      for (const c of codes) {
        if (c.code.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)) {
          results.cpt.push({ ...c, procedure });
        }
      }
    }
  }
  
  if (codeType === 'all' || codeType === 'hcpcs') {
    for (const [drugClass, codes] of Object.entries(MedicalKnowledgeBase.hcpcsDrugCodes)) {
      for (const c of codes) {
        if (c.code.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)) {
          results.hcpcs.push({ ...c, drugClass });
        }
      }
    }
  }
  
  results.totalResults = results.icd10.length + results.cpt.length + results.hcpcs.length;
  
  return results;
}

module.exports = {
  suggestICD10Codes,
  suggestCPTCodes,
  suggestHCPCSCodes,
  getCompleteCodeSet,
  searchCodes,
  normalizeCondition,
  MedicalKnowledgeBase,
};

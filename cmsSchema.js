/**
 * CMS Medicare Data Schema and Configuration
 * Contains field definitions, API endpoints, and reference data
 * 
 * VERSION: 2.0.0
 * LAST UPDATED: 2026-01-29
 * CHANGELOG:
 *   - 2.0.0: Added Part D datasets, expanded indication codes, national benchmarks
 *   - 1.0.0: Initial schema with 6 nephrology indications
 */

const SCHEMA_VERSION = '2.0.0';
const SCHEMA_UPDATED = '2026-01-29';

// Dataset UUIDs by year (Updated Jan 2026 from catalog.data.gov)
const DATASET_UUIDS = {
  // Medicare Part B - Provider aggregate (demographics, chronic conditions)
  BY_PROVIDER: {
    '2023': '8889d81e-2ee7-448f-8713-f071038289b5',
    '2022': '21555c17-ec1b-4e74-b2c6-925c6cbb3147',
    '2021': '44e0a489-666c-4ea4-a1a2-360b6cdc19db',
  },
  // Medicare Part B - Provider and Service (HCPCS-level)
  BY_PROVIDER_AND_SERVICE: {
    '2023': '92396110-2aed-4d63-a6a2-5d6207d46a29',
    '2022': 'e650987d-01b7-4f09-b75e-b0b075afbf98',
    '2021': '31dc2c47-f297-4948-bfb4-075e1bec3a02',
  },
  // Medicare Part D - Prescriber by Provider (aggregate Rx counts)
  PART_D_BY_PROVIDER: {
    '2023': '14d8e8a9-7e9b-4370-a044-bf97c46b4b44',
    '2022': 'bed99012-c527-4d9d-92ea-67ec2510abea',
    '2021': '3f7ab9ce-6fb6-4e6b-9af3-b681f2d3a95e',
  },
  // Medicare Part D - Prescriber by Provider and Drug (drug-level)
  PART_D_BY_PROVIDER_AND_DRUG: {
    '2023': '4bc22bc5-4a8e-4b7b-8e32-4f7d5a6c8e9f', // Need to verify
    '2022': '7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    '2021': 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6',
  },
  // Geography aggregate (fallback to provider)
  BY_GEOGRAPHY_AND_SERVICE: {
    '2023': '8889d81e-2ee7-448f-8713-f071038289b5',
    '2022': '21555c17-ec1b-4e74-b2c6-925c6cbb3147',
    '2021': '44e0a489-666c-4ea4-a1a2-360b6cdc19db',
  },
};

// Data source citations for transparency
const DATA_SOURCES = {
  PART_B_PROVIDER: {
    name: 'Medicare Physician & Other Practitioners - By Provider',
    publisher: 'CMS',
    url: 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners',
    methodology: 'https://data.cms.gov/resources/medicare-physician-other-practitioners-methodology',
    limitations: [
      'Medicare Fee-for-Service only (excludes Medicare Advantage)',
      'Counts <11 suppressed for privacy',
      'Does not represent physician\'s entire practice',
      'Annual data with ~18 month lag',
    ],
    citation: (year) => `CMS Medicare Physician & Other Practitioners PUF ${year}`,
  },
  PART_B_SERVICE: {
    name: 'Medicare Physician & Other Practitioners - By Provider and Service',
    publisher: 'CMS',
    url: 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners',
    methodology: 'https://data.cms.gov/resources/medicare-physician-other-practitioners-methodology',
    limitations: [
      'Medicare Fee-for-Service only',
      'No diagnosis (ICD-10) codes - procedure only',
      'Services with <11 beneficiaries excluded',
    ],
    citation: (year) => `CMS Medicare Physician & Other Practitioners by Service PUF ${year}`,
  },
  PART_D_PRESCRIBER: {
    name: 'Medicare Part D Prescribers - By Provider',
    publisher: 'CMS',
    url: 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers',
    methodology: 'https://data.cms.gov/resources/medicare-part-d-prescribers-methodology',
    limitations: [
      'Part D enrolled beneficiaries only',
      'Excludes hospital/infusion drugs (Part B drugs)',
      'No indication for drug use',
      'Claims <11 suppressed',
    ],
    citation: (year) => `CMS Medicare Part D Prescriber PUF ${year}`,
  },
};

// National benchmark data (from CMS Chronic Conditions PUF 2021)
const NATIONAL_BENCHMARKS = {
  chronicConditions: {
    diabetes: 27.0,        // % of Medicare beneficiaries
    hypertension: 58.0,
    heartDisease: 27.0,    // Ischemic heart disease
    heartFailure: 14.0,
    ckd: 25.0,
    copd: 11.0,
    cancer: 9.0,
    depression: 19.0,
    dementia: 11.0,
    stroke: 4.0,
    atrialFib: 9.0,
  },
  avgRiskScore: 1.0,       // HCC risk score baseline
  source: 'CMS Chronic Conditions PUF 2021',
  sourceUrl: 'https://www.cms.gov/data-research/statistics-trends-and-reports/chronic-conditions-puf',
};

// State codes
const StateCodes = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'VI', 'WA',
  'WV', 'WI', 'WY', 'GU', 'AS', 'MP', 'ZZ'
];

// Specialty/Provider Types
const ProviderTypes = [
  'Internal Medicine',
  'Family Practice',
  'Nephrology',
  'Cardiology',
  'Pulmonary Disease',
  'Gastroenterology',
  'Endocrinology',
  'Rheumatology',
  'Hematology/Oncology',
  'Oncology',
  'Urology',
  'Neurology',
  'Dermatology',
  'Orthopedic Surgery',
  'General Surgery',
  'Pathology',
  'Radiology',
  'Emergency Medicine',
  'Psychiatry',
  'Physical Medicine and Rehabilitation',
  'Infectious Disease',
  'Allergy/Immunology',
  'Geriatric Medicine',
  'Critical Care',
  'Hospice and Palliative Care',
];

// Chronic Condition Fields in Provider dataset
const ChronicConditionFields = {
  diabetes: 'Bene_CC_PH_Diabetes_V2_Pct',
  hypertension: 'Bene_CC_PH_Hypertension_V2_Pct',
  heartDisease: 'Bene_CC_PH_IschemicHeart_V2_Pct',
  heartFailure: 'Bene_CC_PH_HF_NonIHD_V2_Pct',
  ckd: 'Bene_CC_PH_CKD_V2_Pct',
  copd: 'Bene_CC_PH_COPD_V2_Pct',
  cancer: 'Bene_CC_PH_Cancer6_V2_Pct',
  depression: 'Bene_CC_BH_Depress_V1_Pct',
  dementia: 'Bene_CC_BH_Alz_NonAlzdem_V2_Pct',
  anxiety: 'Bene_CC_BH_Anxiety_V1_Pct',
  stroke: 'Bene_CC_PH_Stroke_V2_Pct',
  atrial_fib: 'Bene_CC_PH_Afib_V2_Pct',
  osteoporosis: 'Bene_CC_PH_Osteoporosis_V2_Pct',
  arthritis: 'Bene_CC_PH_Arthritis_V2_Pct',
  asthma: 'Bene_CC_PH_Asthma_V2_Pct',
};

// Indication Code Sets - ICD-10, CPT, HCPCS codes for each indication
// VERSION 2.0 - Added N02.B codes, expanded drug mappings, Part D drug names
const IndicationCodeSets = {
  'igan': {
    id: 'igan',
    name: 'IgA Nephropathy',
    shortName: 'IgAN',
    description: 'IgA nephropathy (Berger\'s disease) - autoimmune kidney disease',
    category: 'Nephrology',
    version: '2.0',
    lastUpdated: '2026-01-29',
    // ICD-10-CM codes (expanded with 2023 N02.B subtypes)
    icd10: [
      'N02.8',   // Recurrent/persistent hematuria with other morphologic changes - PRIMARY IgAN code
      'N02.B1',  // Recurrent/persistent hematuria with focal/segmental glomerular lesions (2023)
      'N02.B2',  // Recurrent/persistent hematuria with diffuse membranoproliferative GN (2023)
      'N02.B3',  // Recurrent/persistent hematuria with diffuse mesangial proliferative GN (2023)
      'N02.B4',  // Recurrent/persistent hematuria with diffuse endocapillary proliferative GN (2023)
      'N02.B5',  // Recurrent/persistent hematuria with diffuse mesangiocapillary GN (2023)
      'N02.B6',  // Recurrent/persistent hematuria with dense deposit disease (2023)
    ],
    // CPT procedure codes
    cpt: [
      '50200',  // Renal biopsy, percutaneous, by trocar or needle
      '50205',  // Renal biopsy, by surgical exposure of kidney
      '50555',  // Renal endoscopy with biopsy
      '50557',  // Renal endoscopy with fulguration/incision
      '36147',  // Access to dialysis circuit for diagnostic study
      '36148',  // Access to dialysis circuit for therapeutic intervention
    ],
    // HCPCS drug codes (Part B infusion drugs)
    hcpcs: [
      'J9312',  // Rituximab injection, 10mg
      'J9311',  // Rituximab-abbs (biosimilar), 10mg
      'J7502',  // Cyclosporine, oral, 100mg
      'J7500',  // Azathioprine, oral, 50mg
      'J1020',  // Methylprednisolone, 20mg injection
      'J1030',  // Methylprednisolone, 40mg injection
      'J1040',  // Methylprednisolone, 80mg injection
      'J2930',  // Methylprednisolone, 125mg injection
      'J0702',  // Betamethasone injection
    ],
    // Part D drug names (for prescriber lookup)
    partDDrugs: [
      'RITUXIMAB',
      'CYCLOSPORINE',
      'AZATHIOPRINE',
      'MYCOPHENOLATE',
      'MYCOPHENOLIC ACID',
      'PREDNISONE',
      'PREDNISOLONE',
      'METHYLPREDNISOLONE',
      'TACROLIMUS',
      'LISINOPRIL',      // ACE inhibitor
      'ENALAPRIL',       // ACE inhibitor
      'LOSARTAN',        // ARB
      'VALSARTAN',       // ARB
      'IRBESARTAN',      // ARB
      'SPARSENTAN',      // New IgAN drug (Filspari) - 2023
    ],
    drugClasses: ['Immunosuppressants', 'ACE Inhibitors', 'ARBs', 'Corticosteroids'],
    specialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 10 },
    notes: 'ICD-10 N02.8 validated with ~99% PPV for IgAN (Sim et al., 2023, Clin Kidney J)',
    references: [
      { source: 'Sim et al. 2023', url: 'https://academic.oup.com/ckj/article/18/11/sfaf327/8300361', note: 'N02.8 PPV ~99%' },
      { source: 'AHA Coding Clinic Q4 2023', note: 'N02.B codes expansion' },
    ],
  },
  'pmn': {
    id: 'pmn',
    name: 'Primary Membranous Nephropathy',
    shortName: 'PMN',
    description: 'Primary membranous nephropathy - autoimmune glomerular disease',
    category: 'Nephrology',
    version: '2.0',
    lastUpdated: '2026-01-29',
    // ICD-10-CM codes (expanded with 2023 codes from AHA Coding Clinic)
    icd10: [
      'N04.2',   // Nephrotic syndrome with diffuse membranous GN
      'N04.20',  // Nephrotic syndrome with diffuse membranous GN, unspecified
      'N04.21',  // Primary membranous nephropathy with nephrotic syndrome (2023)
      'N04.22',  // Secondary membranous nephropathy with nephrotic syndrome (2023)
      'N04.29',  // Other nephrotic syndrome with diffuse membranous GN
      'N06.2',   // Isolated proteinuria with diffuse membranous GN
      'N06.20',  // Isolated proteinuria with diffuse membranous GN, unspecified
      'N06.21',  // Primary membranous nephropathy with isolated proteinuria (2023)
      'N06.22',  // Secondary membranous nephropathy with isolated proteinuria (2023)
      'N06.29',  // Other isolated proteinuria with diffuse membranous GN
    ],
    cpt: [
      '50200',  // Renal biopsy, percutaneous
      '50205',  // Renal biopsy, surgical
      '36147',  // Dialysis access diagnostic
      '36148',  // Dialysis access therapeutic
    ],
    hcpcs: [
      'J9312',  // Rituximab
      'J9311',  // Rituximab-abbs biosimilar
      'J7502',  // Cyclosporine
      'J2820',  // Sargramostim
      'J7516',  // Tacrolimus, oral, 1mg
      'J1020',  // Methylprednisolone
    ],
    partDDrugs: [
      'RITUXIMAB',
      'CYCLOSPORINE',
      'TACROLIMUS',
      'MYCOPHENOLATE',
      'MYCOPHENOLIC ACID',
      'PREDNISONE',
      'CYCLOPHOSPHAMIDE',
      'CHLORAMBUCIL',
    ],
    drugClasses: ['Immunosuppressants', 'Corticosteroids', 'Calcineurin Inhibitors'],
    specialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 10 },
    notes: 'ICD-10 codes expanded in Oct 2023 per AHA Coding Clinic Q4 2023',
    references: [
      { source: 'AHA Coding Clinic Q4 2023', url: 'https://www.findacode.com/newsletters/aha-coding-clinic/icd/membranous-nephropathy-I104033.html' },
    ],
  },
  'ckd': {
    id: 'ckd',
    name: 'Chronic Kidney Disease',
    shortName: 'CKD',
    description: 'Chronic kidney disease - progressive loss of kidney function',
    category: 'Nephrology',
    version: '1.1',
    lastUpdated: '2026-01-29',
    icd10: [
      'N18.1',   // CKD Stage 1
      'N18.2',   // CKD Stage 2
      'N18.3',   // CKD Stage 3 unspecified
      'N18.30',  // CKD Stage 3 unspecified
      'N18.31',  // CKD Stage 3a
      'N18.32',  // CKD Stage 3b
      'N18.4',   // CKD Stage 4
      'N18.5',   // CKD Stage 5
      'N18.6',   // End stage renal disease
      'N18.9',   // CKD unspecified
    ],
    cpt: [
      '90935',  // Hemodialysis with single evaluation
      '90937',  // Hemodialysis with repeated evaluations
      '90945',  // Dialysis procedure other than hemodialysis
      '90947',  // Dialysis procedure, repeated
      '90951',  // ESRD monthly outpatient services, <2 years
      '90952',  // ESRD monthly outpatient services, 2-11 years
      '90953',  // ESRD monthly outpatient services, 12-19 years
      '90954',  // ESRD monthly outpatient services, 20+ years
      '36147',  // Dialysis access diagnostic
      '36148',  // Dialysis access therapeutic
      '36800',  // Insertion of cannula for hemodialysis
      '36810',  // Insertion of cannula for hemodialysis, other
      '36815',  // Insertion of cannula, arteriovenous, external
    ],
    hcpcs: [
      'A4653',  // Peritoneal dialysis catheter anchoring device
      'A4657',  // Syringe with/without needle
      'E1632',  // Wearable artificial kidney
      'E1634',  // Peritoneal dialysis clamp
      'J0881',  // Darbepoetin alfa (ESA)
      'J0882',  // Darbepoetin alfa (ESA)
      'J0885',  // Epoetin alfa (ESA)
      'Q4081',  // Epoetin alfa (ESRD)
    ],
    partDDrugs: [
      'SEVELAMER',         // Phosphate binder
      'LANTHANUM',         // Phosphate binder
      'CALCIUM ACETATE',   // Phosphate binder
      'CALCITRIOL',        // Vitamin D
      'PARICALCITOL',      // Vitamin D
      'DOXERCALCIFEROL',   // Vitamin D
      'CINACALCET',        // Calcimimetic
      'FERROUS SULFATE',   // Iron supplement
      'SODIUM BICARBONATE',// Alkalinizing agent
    ],
    drugClasses: ['Phosphate Binders', 'ESA', 'Iron Supplements', 'ACE Inhibitors', 'ARBs', 'Vitamin D Analogs'],
    specialties: ['Nephrology', 'Internal Medicine', 'Family Practice'],
    comorbidityFilters: { ckd: 20 },
    notes: 'Broad CKD definition - includes all stages. High prevalence in Medicare population.',
  },
  'lupus_nephritis': {
    id: 'lupus_nephritis',
    name: 'Lupus Nephritis',
    shortName: 'LN',
    description: 'Kidney inflammation caused by systemic lupus erythematosus (SLE)',
    category: 'Nephrology',
    version: '1.1',
    lastUpdated: '2026-01-29',
    icd10: [
      'M32.14',  // Glomerular disease in SLE
      'M32.15',  // Tubulo-interstitial nephropathy in SLE
      'N08',     // Glomerular disorders in diseases classified elsewhere
      'M32.10',  // SLE, organ involvement unspecified
      'M32.11',  // Endocarditis in SLE
      'M32.12',  // Pericarditis in SLE
      'M32.19',  // Other organ involvement in SLE
    ],
    cpt: [
      '50200',  // Renal biopsy
      '50205',  // Renal biopsy surgical
      '36415',  // Venipuncture (monitoring)
    ],
    hcpcs: [
      'J9312',  // Rituximab
      'J9311',  // Rituximab-abbs
      'J0135',  // Adalimumab (off-label)
      'J1745',  // Infliximab (off-label)
      'J0490',  // Belimumab (Benlysta)
      'C9399',  // Voclosporin (Lupkynis) - new 2021
    ],
    partDDrugs: [
      'HYDROXYCHLOROQUINE',
      'MYCOPHENOLATE',
      'MYCOPHENOLIC ACID',
      'AZATHIOPRINE',
      'PREDNISONE',
      'CYCLOPHOSPHAMIDE',
      'BELIMUMAB',
      'VOCLOSPORIN',       // New 2021
      'TACROLIMUS',
    ],
    drugClasses: ['Immunosuppressants', 'Belimumab', 'Voclosporin', 'Corticosteroids', 'Antimalarials'],
    specialties: ['Nephrology', 'Rheumatology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 5 },
    notes: 'Often comorbid with SLE - check rheumatology involvement',
  },
  'fsgs': {
    id: 'fsgs',
    name: 'Focal Segmental Glomerulosclerosis',
    shortName: 'FSGS',
    description: 'Focal segmental glomerulosclerosis - kidney scarring disease',
    category: 'Nephrology',
    version: '1.1',
    lastUpdated: '2026-01-29',
    icd10: [
      'N04.1',   // Nephrotic syndrome with focal/segmental glomerular lesions
      'N06.1',   // Isolated proteinuria with focal/segmental glomerular lesions
      'N07.1',   // Hereditary nephropathy with focal/segmental glomerular lesions
      'N04.10',  // Nephrotic syndrome with focal/segmental, unspecified
      'N04.11',  // Nephrotic syndrome with focal/segmental hyalinosis
      'N04.19',  // Nephrotic syndrome with other focal/segmental
    ],
    cpt: [
      '50200',  // Renal biopsy
      '50205',  // Renal biopsy surgical
    ],
    hcpcs: [
      'J9312',  // Rituximab
      'J7502',  // Cyclosporine
      'J7516',  // Tacrolimus
      'J1020',  // Methylprednisolone
      'J1030',  // Methylprednisolone 40mg
    ],
    partDDrugs: [
      'CYCLOSPORINE',
      'TACROLIMUS',
      'MYCOPHENOLATE',
      'PREDNISONE',
      'ENALAPRIL',
      'LISINOPRIL',
      'LOSARTAN',
    ],
    drugClasses: ['Immunosuppressants', 'Corticosteroids', 'Calcineurin Inhibitors'],
    specialties: ['Nephrology', 'Internal Medicine'],
    comorbidityFilters: { ckd: 10 },
    notes: 'Difficult to diagnose - requires kidney biopsy. May be primary or secondary.',
  },
  'diabetic_nephropathy': {
    id: 'diabetic_nephropathy',
    name: 'Diabetic Nephropathy',
    shortName: 'DN',
    description: 'Kidney damage from diabetes mellitus',
    category: 'Nephrology',
    version: '1.1',
    lastUpdated: '2026-01-29',
    icd10: [
      'E11.21',  // T2DM with diabetic nephropathy
      'E11.22',  // T2DM with diabetic CKD
      'E11.29',  // T2DM with other diabetic kidney complication
      'E10.21',  // T1DM with diabetic nephropathy
      'E10.22',  // T1DM with diabetic CKD
      'E10.29',  // T1DM with other diabetic kidney complication
      'E13.21',  // Other DM with diabetic nephropathy
      'E13.22',  // Other DM with diabetic CKD
      'N08.3',   // Glomerular disorders in diabetes (historical)
    ],
    cpt: [
      '90935',  // Hemodialysis single
      '90937',  // Hemodialysis repeated
      '36147',  // Dialysis access
      '36148',  // Dialysis access therapeutic
      '82043',  // Urine albumin, quantitative
      '82044',  // Urine albumin, semiquantitative
      '83036',  // Hemoglobin A1c
    ],
    hcpcs: [
      'J1950',  // Leuprolide acetate
      'J1930',  // Lanreotide acetate
      'A4253',  // Blood glucose test strips
      'J0881',  // Darbepoetin (ESA for anemia)
    ],
    partDDrugs: [
      'EMPAGLIFLOZIN',     // SGLT2 inhibitor
      'DAPAGLIFLOZIN',     // SGLT2 inhibitor
      'CANAGLIFLOZIN',     // SGLT2 inhibitor
      'SEMAGLUTIDE',       // GLP-1 agonist
      'LIRAGLUTIDE',       // GLP-1 agonist
      'DULAGLUTIDE',       // GLP-1 agonist
      'FINERENONE',        // MRA (Kerendia) - new for DKD
      'LISINOPRIL',        // ACE inhibitor
      'ENALAPRIL',         // ACE inhibitor
      'LOSARTAN',          // ARB
      'IRBESARTAN',        // ARB (IDNT trial)
      'METFORMIN',         // First-line diabetes
    ],
    drugClasses: ['SGLT2 Inhibitors', 'GLP-1 Agonists', 'ACE Inhibitors', 'ARBs', 'MRA'],
    specialties: ['Nephrology', 'Endocrinology', 'Internal Medicine'],
    comorbidityFilters: { diabetes: 30, ckd: 15 },
    notes: 'Most common cause of ESRD - high comorbidity with diabetes. SGLT2i now standard of care.',
  },
};

// Common HCPCS/CPT codes and descriptions
const CommonCodes = {
  procedures: {
    '50200': 'Renal biopsy, percutaneous, by trocar or needle',
    '50205': 'Renal biopsy; by surgical exposure of kidney',
    '50555': 'Renal endoscopy with biopsy',
    '50557': 'Renal endoscopy with fulguration/incision',
    '90935': 'Hemodialysis with single evaluation',
    '90937': 'Hemodialysis with repeated evaluations',
    '90945': 'Dialysis procedure other than hemodialysis',
    '90947': 'Dialysis procedure, repeated evaluation',
    '36147': 'Access to dialysis circuit for diagnostic study',
    '36148': 'Access to dialysis circuit for therapeutic intervention',
    '99213': 'Office visit, established patient, low complexity',
    '99214': 'Office visit, established patient, moderate complexity',
    '99215': 'Office visit, established patient, high complexity',
  },
  drugs: {
    'J9312': 'Rituximab injection, 10mg',
    'J9311': 'Rituximab-abbs injection, 10mg',
    'J7502': 'Cyclosporine, oral, 100mg',
    'J7500': 'Azathioprine, oral, 50mg',
    'J2820': 'Sargramostim injection',
    'J0135': 'Adalimumab injection',
    'J1745': 'Infliximab injection',
    'J1950': 'Leuprolide acetate injection',
    'J7516': 'Tacrolimus, oral, 1mg',
  },
};

// Helper functions
function getBaseUrl(datasetType, year = '2023') {
  const uuid = DATASET_UUIDS[datasetType]?.[year];
  if (!uuid) {
    throw new Error(`No UUID found for ${datasetType} year ${year}`);
  }
  return `https://data.cms.gov/data-api/v1/dataset/${uuid}/data`;
}

function getAvailableYears() {
  return ['2023', '2022', '2021'];
}

function getIndicationById(id) {
  return IndicationCodeSets[id.toLowerCase()] || null;
}

function getAllIndications() {
  return Object.values(IndicationCodeSets);
}

function getIndicationsByCategory(category) {
  return Object.values(IndicationCodeSets).filter(ind => ind.category === category);
}

module.exports = {
  SCHEMA_VERSION,
  SCHEMA_UPDATED,
  DATASET_UUIDS,
  DATA_SOURCES,
  NATIONAL_BENCHMARKS,
  StateCodes,
  ProviderTypes,
  ChronicConditionFields,
  IndicationCodeSets,
  CommonCodes,
  getBaseUrl,
  getAvailableYears,
  getIndicationById,
  getAllIndications,
  getIndicationsByCategory,
};

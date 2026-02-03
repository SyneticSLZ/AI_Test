/**
 * Enhanced Unified Regulatory Intelligence Agent Server v3.0
 * 
 * COMPREHENSIVE CLINICAL TRIALS AGENT with COMPLETE API support:
 * - All 19 search areas from ClinicalTrials.gov fully documented
 * - All filter parameters with validation
 * - Full Essie expression syntax support
 * - Complete pagination to fetch ALL matching results
 * - All sort options
 * - Field selection
 * - Hardcoded enums to prevent hallucinations
 * 
 * Also includes:
 * - FDA Agent - Drugs@FDA API
 * - Orange Book Agent - Orange Book data (products, patents, exclusivities)
 * - PubMed Agent - Biomedical literature search
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { z } = require('zod');
const { Agent, run, tool, setDefaultOpenAIKey, setTracingExportApiKey } = require('@openai/agents');
require('dotenv').config();

// Import the comprehensive schema reference
const CTSchema = require('./clinicalTrialsSchema.js');

// Set OpenAI API key
setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
setTracingExportApiKey(process.env.OPENAI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// CACHES
// ============================================
const drugsAtFDACache = new Map();
const orangeBookCache = new Map();

// Store last tool results for extraction
let lastToolResults = {
  clinicalTrials: null,
  fda: null,
  orangeBook: null,
  pubmed: null
};

function resetToolResults() {
  lastToolResults = {
    clinicalTrials: null,
    fda: null,
    orangeBook: null,
    pubmed: null
  };
}

// ============================================
// ORANGE BOOK DATA (loaded at startup)
// ============================================
let products = [];
let patents = [];
let exclusivities = [];
let productIndex = new Map();
let patentIndex = new Map();
let exclusivityIndex = new Map();
let groups = new Map();

// Orange Book helpers
function applKey(applType, applNo, productNo) {
  return `${(applType || '').trim()}|${(applNo || '').trim()}|${(productNo || '').trim()}`;
}

function groupKey(product) {
  const ingredient = (product.Ingredient || '').toUpperCase();
  const dfRoute = (product['DF;Route'] || '').toUpperCase();
  const strength = (product.Strength || '').toUpperCase();
  return `${ingredient}|${dfRoute}|${strength}`;
}

function isActiveProduct(product) {
  return (product.Type || '').toUpperCase() !== 'DISCN';
}

function isRLD(product) {
  return (product.RLD || '').toLowerCase() === 'yes';
}

function isBrandedApplication(applType) {
  return (applType || '').toUpperCase() === 'N';
}

function isGenericApplication(applType) {
  return (applType || '').toUpperCase() === 'A';
}

async function parseTildeFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split('~').map(h => h.trim());
    const rows = lines.slice(1);
    return rows.map(line => {
      const cols = line.split('~').map(c => c.trim());
      const obj = {};
      header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
      return obj;
    });
  } catch (err) {
    console.log(`Warning: Could not load ${filename}:`, err.message);
    return [];
  }
}

async function loadOrangeBookData() {
  console.log('Loading Orange Book files...');
  
  products = await parseTildeFile('products.txt');
  patents = await parseTildeFile('patent.txt');
  exclusivities = await parseTildeFile('exclusivity.txt');

  console.log(`Loaded ${products.length} products, ${patents.length} patents, ${exclusivities.length} exclusivities`);

  // Build indexes
  productIndex = new Map();
  for (const p of products) {
    const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
    productIndex.set(key, p);
  }

  patentIndex = new Map();
  for (const pt of patents) {
    const key = applKey(pt.Appl_Type, pt.Appl_No, pt.Product_No);
    if (!patentIndex.has(key)) patentIndex.set(key, []);
    patentIndex.get(key).push(pt);
  }

  exclusivityIndex = new Map();
  for (const ex of exclusivities) {
    const key = applKey(ex.Appl_Type, ex.Appl_No, ex.Product_No);
    if (!exclusivityIndex.has(key)) exclusivityIndex.set(key, []);
    exclusivityIndex.get(key).push(ex);
  }

  // Build groups
  groups = new Map();
  for (const p of products) {
    const gKey = groupKey(p);
    if (!gKey.trim()) continue;
    if (!groups.has(gKey)) {
      groups.set(gKey, {
        key: gKey,
        ingredient: p.Ingredient,
        dfRoute: p['DF;Route'],
        strength: p.Strength,
        products: []
      });
    }
    groups.get(gKey).products.push(p);
  }

  console.log(`Built ${groups.size} ingredient/DF/strength groups`);
}

// ============================================
// FDA API HELPER
// ============================================
async function queryDrugsAtFDA(searchQuery, searchType = 'name') {
  const cacheKey = `${searchType}:${searchQuery}`;
  
  if (drugsAtFDACache.has(cacheKey)) {
    return drugsAtFDACache.get(cacheKey);
  }

  try {
    let url;
    if (searchType === 'application') {
      url = `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${searchQuery}"&limit=10`;
    } else if (searchType === 'name') {
      url = `https://api.fda.gov/drug/drugsfda.json?search=openfda.brand_name:"${searchQuery}"+openfda.generic_name:"${searchQuery}"&limit=20`;
    } else if (searchType === 'ingredient') {
      url = `https://api.fda.gov/drug/drugsfda.json?search=products.active_ingredients.name:"${searchQuery}"&limit=20`;
    } else if (searchType === 'sponsor') {
      url = `https://api.fda.gov/drug/drugsfda.json?search=sponsor_name:"${searchQuery}"&limit=20`;
    } else {
      url = `https://api.fda.gov/drug/drugsfda.json?search=${encodeURIComponent(searchQuery)}&limit=20`;
    }

    console.log(`[FDA API] Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`[FDA API] Error: ${response.status}`);
      drugsAtFDACache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      drugsAtFDACache.set(cacheKey, null);
      return null;
    }

    drugsAtFDACache.set(cacheKey, data.results);
    return data.results;
    
  } catch (err) {
    console.error(`[FDA API] Error:`, err.message);
    drugsAtFDACache.set(cacheKey, null);
    return null;
  }
}

// ============================================
// ZOD SCHEMAS USING HARDCODED ENUMS
// ============================================

// Create Zod enums from our schema
const OverallStatusZod = z.enum(CTSchema.OverallStatusValues);
const PhaseZod = z.enum(CTSchema.PhaseValues);
const StudyTypeZod = z.enum(CTSchema.StudyTypeValues);
const AgencyClassZod = z.enum(CTSchema.AgencyClassValues);
const InterventionTypeZod = z.enum(CTSchema.InterventionTypeValues);
const SexZod = z.enum(CTSchema.SexValues);
const StandardAgeZod = z.enum(CTSchema.StandardAgeValues);
const DesignAllocationZod = z.enum(CTSchema.DesignAllocationValues);
const InterventionModelZod = z.enum(CTSchema.InterventionModelValues);
const PrimaryPurposeZod = z.enum(CTSchema.PrimaryPurposeValues);
const ObservationalModelZod = z.enum(CTSchema.ObservationalModelValues);
const TimePerspectiveZod = z.enum(CTSchema.TimePerspectiveValues);
const DesignMaskingZod = z.enum(CTSchema.DesignMaskingValues);
const WhoMaskedZod = z.enum(CTSchema.WhoMaskedValues);
const ArmGroupTypeZod = z.enum(CTSchema.ArmGroupTypeValues);

// Sort field enum
const SortFieldValues = [
  '@relevance',
  'LastUpdatePostDate',
  'StudyFirstPostDate', 
  'ResultsFirstPostDate',
  'EnrollmentCount',
  'StartDate',
  'PrimaryCompletionDate',
  'CompletionDate',
  'NumArmGroups',
];

// ============================================
// GENERATE COMPREHENSIVE AGENT INSTRUCTIONS
// ============================================

function generateSearchAreasDocumentation() {
  let doc = `\n=== ALL 19 SEARCH AREAS ===\n`;
  
  for (const [name, area] of Object.entries(CTSchema.SearchAreas)) {
    doc += `\n${name}:\n`;
    doc += `  Query Param: ${area.queryParam || 'Use AREA[] in filter.advanced'}\n`;
    doc += `  Description: ${area.description}\n`;
    doc += `  Fields (${area.fields.length}): ${area.fields.slice(0, 5).map(f => f.name).join(', ')}${area.fields.length > 5 ? '...' : ''}\n`;
  }
  
  return doc;
}

function generateEnumDocumentation() {
  return `
=== VALID ENUM VALUES (HARDCODED - DO NOT INVENT OTHERS) ===

OverallStatus (for filter.overallStatus):
  ${CTSchema.OverallStatusValues.join(', ')}

Phase (for AREA[Phase]):
  ${CTSchema.PhaseValues.join(', ')}

StudyType (for AREA[StudyType]):
  ${CTSchema.StudyTypeValues.join(', ')}

AgencyClass/FunderType (for AREA[LeadSponsorClass]):
  ${CTSchema.AgencyClassValues.join(', ')}

InterventionType (for AREA[InterventionType]):
  ${CTSchema.InterventionTypeValues.join(', ')}

Sex (for AREA[Sex]):
  ${CTSchema.SexValues.join(', ')}

StandardAge (for AREA[StdAge]):
  ${CTSchema.StandardAgeValues.join(', ')}

DesignAllocation (for AREA[DesignAllocation]):
  ${CTSchema.DesignAllocationValues.join(', ')}

InterventionModel (for AREA[DesignInterventionModel]):
  ${CTSchema.InterventionModelValues.join(', ')}

PrimaryPurpose (for AREA[DesignPrimaryPurpose]):
  ${CTSchema.PrimaryPurposeValues.join(', ')}

ObservationalModel (for AREA[DesignObservationalModel]):
  ${CTSchema.ObservationalModelValues.join(', ')}

TimePerspective (for AREA[DesignTimePerspective]):
  ${CTSchema.TimePerspectiveValues.join(', ')}

DesignMasking (for AREA[DesignMasking]):
  ${CTSchema.DesignMaskingValues.join(', ')}

ArmGroupType (for AREA[ArmGroupType]):
  ${CTSchema.ArmGroupTypeValues.join(', ')}
`;
}

function generateFieldDocumentation() {
  const fields = [];
  for (const [module, moduleFields] of Object.entries(CTSchema.SearchableFields)) {
    for (const [fieldName, fieldInfo] of Object.entries(moduleFields)) {
      fields.push(`${fieldName} (${fieldInfo.type}): ${fieldInfo.description}`);
    }
  }
  return `
=== ALL VALID AREA[] FIELD NAMES ===
${fields.join('\n')}

⚠️ IMPORTANT: These are the ONLY valid field names for AREA[] expressions.
DO NOT invent field names like "LocationContinent" - it does NOT exist!
`;
}

// ============================================
// TOOL 1: COMPREHENSIVE CLINICAL TRIALS SEARCH
// ============================================

const ComprehensiveClinicalTrialsInput = z.object({
  // ========================================
  // SEARCH AREA QUERIES (All 19 areas)
  // ========================================
  
  // 1. BasicSearch - "Other terms" - 57 fields
  queryTerm: z.string().nullable().optional().describe(
    `BasicSearch area (query.term). Searches 57 weighted fields including NCTId, Acronym, BriefTitle, OfficialTitle, Condition, InterventionName, Phase, BriefSummary, Keywords, and more.
    
Supports full Essie syntax:
- Boolean: AND, OR, NOT
- Phrases: "heart failure"  
- Field targeting: AREA[Phase]PHASE3
- Ranges: AREA[StartDate]RANGE[2023-01-01, MAX]
- Expansion: EXPANSION[Concept]SLE

Example: "AREA[LastUpdatePostDate]RANGE[2023-01-15,MAX]"`
  ),
  
  // 2. ConditionSearch - 7 fields
  queryCondition: z.string().nullable().optional().describe(
    `ConditionSearch area (query.cond). Best for disease/condition searches.
    
Searches these fields (by weight):
- Condition (0.95)
- BriefTitle (0.6)
- OfficialTitle (0.55)
- ConditionMeshTerm (0.5)
- ConditionAncestorTerm (0.4)
- Keyword (0.3)
- NCTId (0.2)

Examples: "diabetes", "type 2 diabetes mellitus", "(head OR neck) AND cancer"`
  ),
  
  // 3. InterventionSearch - 12 fields
  queryIntervention: z.string().nullable().optional().describe(
    `InterventionSearch area (query.intr). Best for drug/treatment searches.
    
Searches these fields (by weight):
- InterventionName (0.95)
- InterventionType (0.85) - enum: ${CTSchema.InterventionTypeValues.join(', ')}
- ArmGroupType (0.85)
- InterventionOtherName (0.75)
- BriefTitle (0.65)
- OfficialTitle (0.6)
- ArmGroupLabel (0.5)
- InterventionMeshTerm (0.5)
- Keyword (0.5)
- InterventionAncestorTerm (0.4)
- InterventionDescription (0.4)
- ArmGroupDescription (0.4)

Examples: "aspirin", "pembrolizumab", "AREA[InterventionType]DRUG AND metformin"`
  ),
  
  // 4. LocationSearch - 5 fields
  queryLocation: z.string().nullable().optional().describe(
    `LocationSearch area (query.locn). Best for geographic searches.
    
Searches these fields (all weight 0.95 except LocationZip at 0.35):
- LocationCity
- LocationState
- LocationCountry
- LocationFacility
- LocationZip

⚠️ IMPORTANT: There is NO LocationContinent field! For continent searches, list countries.

For searching specific city+state together, use SEARCH[Location]:
  SEARCH[Location](AREA[LocationCity]Boston AND AREA[LocationState]Massachusetts)

Examples: 
- "United States"
- "Germany"
- "Europe" (will search country names containing "Europe" or European country names)
- "New York"
- "Mayo Clinic"`
  ),
  
  // 5. TitleSearch - 3 fields
  queryTitles: z.string().nullable().optional().describe(
    `TitleSearch area (query.titles). For searching study titles and acronyms.
    
Searches these fields:
- Acronym (1.0)
- BriefTitle (0.95)
- OfficialTitle (0.8)

Examples: "RECOVERY", "COVID", "KEYNOTE"`
  ),
  
  // 6. OutcomeSearch - 9 fields
  queryOutcome: z.string().nullable().optional().describe(
    `OutcomeSearch area (query.outc). For searching outcome measures.
    
Searches these fields:
- PrimaryOutcomeMeasure (0.9)
- SecondaryOutcomeMeasure (0.8)
- PrimaryOutcomeDescription (0.6)
- SecondaryOutcomeDescription (0.5)
- OtherOutcomeMeasure (0.4)
- OutcomeMeasureTitle (0.4)
- OtherOutcomeDescription (0.3)
- OutcomeMeasureDescription (0.3)
- OutcomeMeasurePopulationDescription (0.3)

Examples: "overall survival", "progression-free survival", "HbA1c"`
  ),
  
  // 7. SponsorSearch - 3 fields
  querySponsor: z.string().nullable().optional().describe(
    `SponsorSearch area (query.spons). For searching sponsors and collaborators.
    
Searches these fields:
- LeadSponsorName (1.0)
- CollaboratorName (0.9)
- OrgFullName (0.6)

Examples: "Pfizer", "National Cancer Institute", "Merck", "NIH"`
  ),
  
  // 8. Lead Sponsor only
  queryLeadSponsor: z.string().nullable().optional().describe(
    `LeadSponsorName field only (query.lead). Searches only the lead sponsor, not collaborators.
    
Example: "Novartis"`
  ),
  
  // 9. IdSearch - 5 fields
  queryId: z.string().nullable().optional().describe(
    `IdSearch area (query.id). For searching study identifiers.
    
Searches these fields:
- NCTId (1.0) - e.g., NCT04852770
- NCTIdAlias (0.9)
- Acronym (0.85)
- OrgStudyId (0.8)
- SecondaryId (0.75)

Examples: "NCT04852770", "2020-001234", "EUDRACT 2019-001234-56"`
  ),
  
  // 10. PatientSearch - 47 fields
  queryPatient: z.string().nullable().optional().describe(
    `PatientSearch area (query.patient). Patient-focused search with 47 fields weighted for patient understanding.
    
Best for: Patient-friendly searches about conditions and treatments.
Includes all major fields from conditions, interventions, eligibility, locations, and outcomes.

Examples: "breast cancer treatment options", "diabetes clinical trials near me"`
  ),
  
  // ========================================
  // FILTER PARAMETERS
  // ========================================
  
  // Overall status filter
  filterStatus: z.array(OverallStatusZod).nullable().optional().describe(
    `Filter by study status (filter.overallStatus).
    
VALID VALUES (use ONLY these):
${CTSchema.OverallStatusValues.map(s => `- ${s}`).join('\n')}

Examples: ["RECRUITING"], ["RECRUITING", "ACTIVE_NOT_RECRUITING"], ["COMPLETED"]`
  ),
  
  // Geographic filter
  filterGeo: z.object({
    latitude: z.number().describe('Latitude coordinate (-90 to 90)'),
    longitude: z.number().describe('Longitude coordinate (-180 to 180)'),
    distance: z.string().describe('Distance with unit: "50mi" or "100km" (max 500mi/805km)')
  }).nullable().optional().describe(
    `Geographic proximity filter (filter.geo).
Format: distance(latitude, longitude, radius)
    
Examples:
- New York City: {latitude: 40.7128, longitude: -74.0060, distance: "50mi"}
- London: {latitude: 51.5074, longitude: -0.1278, distance: "100km"}
- Los Angeles: {latitude: 34.0522, longitude: -118.2437, distance: "25mi"}`
  ),
  
  // NCT ID filter
  filterIds: z.array(z.string()).nullable().optional().describe(
    `Filter by specific NCT IDs (filter.ids).
    
Examples: ["NCT04852770", "NCT01728545", "NCT02109302"]`
  ),
  
  // Advanced Essie expression filter
  filterAdvanced: z.string().nullable().optional().describe(
    `Advanced filter using full Essie expression syntax (filter.advanced).

⚠️ ONLY use these valid AREA[] field names:
${CTSchema.AllSearchableFieldNames.slice(0, 30).join(', ')}...

Common patterns:
- Phase filter: AREA[Phase]PHASE3
- Study type: AREA[StudyType]INTERVENTIONAL  
- Funder type: AREA[LeadSponsorClass]INDUSTRY
- With results: AREA[ResultsFirstPostDate]RANGE[MIN,MAX]
- No results: AREA[ResultsFirstPostDate]MISSING
- Date range: AREA[StartDate]RANGE[2023-01-01, MAX]
- Age range: AREA[MinimumAge]RANGE[MIN, 18 years] AND AREA[MaximumAge]RANGE[65 years, MAX]
- Intervention type: AREA[InterventionType]DRUG
- Healthy volunteers: AREA[HealthyVolunteers]true
- Has DMC: AREA[OversightHasDMC]true
- FDA regulated: AREA[IsFDARegulatedDrug]true

Combine with AND/OR:
AREA[Phase]PHASE3 AND AREA[StudyType]INTERVENTIONAL AND AREA[LeadSponsorClass]INDUSTRY

⚠️ DO NOT invent field names! "LocationContinent" does NOT exist.`
  ),
  
  // Synonym filter
  filterSynonyms: z.array(z.string()).nullable().optional().describe(
    `Filter by area:synonym_id pairs (filter.synonyms).
Format: ["SearchArea:synonym_id"]
    
Examples: ["ConditionSearch:1651367", "BasicSearch:2013558"]`
  ),
  
  // ========================================
  // SIMPLE CONVENIENCE FILTERS
  // ========================================
  
  // Phase (convenience)
  phase: PhaseZod.nullable().optional().describe(
    `Study phase filter (convenience parameter - adds to filterAdvanced).
    
VALID VALUES (use ONLY these):
${CTSchema.PhaseValues.map(p => `- ${p}`).join('\n')}

Examples: "PHASE3", "PHASE2", "PHASE1"`
  ),
  
  // Study type (convenience)
  studyType: StudyTypeZod.nullable().optional().describe(
    `Study type filter (convenience parameter - adds to filterAdvanced).
    
VALID VALUES (use ONLY these):
${CTSchema.StudyTypeValues.map(t => `- ${t}`).join('\n')}`
  ),
  
  // Funder type (convenience)
  funderType: AgencyClassZod.nullable().optional().describe(
    `Funder/sponsor type filter (convenience parameter - adds to filterAdvanced).
    
VALID VALUES (use ONLY these):
${CTSchema.AgencyClassValues.map(a => `- ${a}`).join('\n')}

Examples: "INDUSTRY", "NIH", "FED"`
  ),
  
  // Intervention type (convenience)
  interventionType: InterventionTypeZod.nullable().optional().describe(
    `Intervention type filter (convenience parameter - adds to filterAdvanced).
    
VALID VALUES (use ONLY these):
${CTSchema.InterventionTypeValues.map(i => `- ${i}`).join('\n')}

Examples: "DRUG", "BIOLOGICAL", "DEVICE"`
  ),
  
  // Has results
  hasResults: z.boolean().nullable().optional().describe(
    `Filter for studies WITH posted results.
⚠️ ONLY set to true if user EXPLICITLY asks for "studies with results"
⚠️ Setting to false is IGNORED - leave unset to get all studies!
- true: Only studies WITH results
- false/null/undefined: NO FILTER (all studies)`
  ),
  
  // Sex eligibility
  sex: SexZod.nullable().optional().describe(
    `Sex eligibility filter.
    
VALID VALUES (use ONLY these):
${CTSchema.SexValues.map(s => `- ${s}`).join('\n')}`
  ),
  
  // Age range
  ageRange: z.object({
    min: z.string().nullable().optional().describe('Minimum age (e.g., "18 Years", "6 Months", "1 Day")'),
    max: z.string().nullable().optional().describe('Maximum age (e.g., "65 Years", "12 Years")')
  }).nullable().optional().describe(
    `Age eligibility range filter.
    
Format: {min: "X Years/Months/Days", max: "Y Years/Months/Days"}
Use null for no limit.

Examples:
- Adults only: {min: "18 Years", max: null}
- Pediatric: {min: null, max: "17 Years"}
- Working age adults: {min: "18 Years", max: "65 Years"}`
  ),
  
  // Healthy volunteers
  healthyVolunteers: z.boolean().nullable().optional().describe(
    `Filter for studies accepting healthy volunteers.
⚠️ ONLY set to true if user EXPLICITLY asks for "healthy volunteer studies"
⚠️ Setting to false is IGNORED - leave unset to get all studies!
- true: Only studies accepting healthy volunteers
- false/null/undefined: NO FILTER (all studies)`
  ),
  
  // Date range
  dateRange: z.object({
    field: z.string().describe('Date field: StartDate, PrimaryCompletionDate, CompletionDate, StudyFirstPostDate, LastUpdatePostDate, ResultsFirstPostDate'),
    from: z.string().describe('Start date YYYY-MM-DD or YYYY, or "MIN" for no lower bound'),
    to: z.string().describe('End date YYYY-MM-DD or YYYY, or "MAX" for no upper bound')
  }).nullable().optional().describe(
    `Date range filter.
    
Valid date fields:
- StartDate
- PrimaryCompletionDate
- CompletionDate
- StudyFirstPostDate
- LastUpdatePostDate
- ResultsFirstPostDate

Examples:
- {field: "StartDate", from: "2023-01-01", to: "2024-12-31"}
- {field: "LastUpdatePostDate", from: "2024", to: "MAX"}
- {field: "ResultsFirstPostDate", from: "MIN", to: "2023-12-31"}`
  ),
  
  // FDA regulated
  isFDARegulated: z.boolean().nullable().optional().describe(
    `Filter for FDA-regulated drug/device studies.
⚠️ ONLY set to true if user EXPLICITLY asks for "FDA regulated studies"
⚠️ Setting to false is IGNORED - leave unset to get all studies!
- true: Only FDA-regulated studies
- false/null/undefined: NO FILTER (all studies)`
  ),
  
  // Has DMC
  hasDMC: z.boolean().nullable().optional().describe(
    `Filter for studies with Data Monitoring Committee.
⚠️ ONLY set to true if user EXPLICITLY asks for "studies with DMC"
⚠️ Setting to false is IGNORED - leave unset to get all studies!
- true: Only studies with DMC
- false/null/undefined: NO FILTER (all studies)`
  ),
  
  // ========================================
  // DESIGN FILTERS
  // ========================================
  
  designAllocation: DesignAllocationZod.nullable().optional().describe(
    `Design allocation filter.
    
VALID VALUES: ${CTSchema.DesignAllocationValues.join(', ')}`
  ),
  
  designInterventionModel: InterventionModelZod.nullable().optional().describe(
    `Intervention model filter (for interventional studies).
    
VALID VALUES: ${CTSchema.InterventionModelValues.join(', ')}`
  ),
  
  designMasking: DesignMaskingZod.nullable().optional().describe(
    `Masking/blinding filter.
    
VALID VALUES: ${CTSchema.DesignMaskingValues.join(', ')}`
  ),
  
  designPrimaryPurpose: PrimaryPurposeZod.nullable().optional().describe(
    `Primary purpose filter.
    
VALID VALUES: ${CTSchema.PrimaryPurposeValues.join(', ')}`
  ),
  
  designObservationalModel: ObservationalModelZod.nullable().optional().describe(
    `Observational model filter (for observational studies).
    
VALID VALUES: ${CTSchema.ObservationalModelValues.join(', ')}`
  ),
  
  designTimePerspective: TimePerspectiveZod.nullable().optional().describe(
    `Time perspective filter (for observational studies).
    
VALID VALUES: ${CTSchema.TimePerspectiveValues.join(', ')}`
  ),
  
  // ========================================
  // AGGREGATION FILTERS
  // ========================================
  
  aggFilters: z.string().nullable().optional().describe(
    `Aggregation filters as comma-separated pairs.
    
Format: "filter_id:option_keys"

Examples:
- "results:with" - studies with results
- "status:com" - completed studies
- "status:not rec" - not yet recruiting + recruiting
- "sex:f" - female only
- "healthy:y" - accepts healthy volunteers`
  ),
  
  // ========================================
  // GEO DECAY (proximity scoring)
  // ========================================
  
  geoDecay: z.string().nullable().optional().describe(
    `Proximity scoring settings (only applies when filterGeo is set).
    
Format: "func:TYPE,scale:DISTANCE,offset:DISTANCE,decay:FACTOR"
Functions: gauss, exp, linear
Default: "func:exp,scale:300mi,offset:0mi,decay:0.5"

Example: "func:linear,scale:100km,offset:10km,decay:0.1"`
  ),
  
  // ========================================
  // FIELD SELECTION
  // ========================================
  
  fields: z.array(z.string()).nullable().optional().describe(
    `Specific fields to return in response.
    
Special values:
- "@query" - all fields used in query

Examples:
- ["NCTId", "BriefTitle", "OverallStatus", "HasResults"]
- ["ProtocolSection"]
- ["NCTId", "BriefTitle", "Phase", "Condition", "InterventionName", "LeadSponsorName"]`
  ),
  
  // ========================================
  // SORTING
  // ========================================
  
  sort: z.array(z.string()).max(2).nullable().optional().describe(
    `Sort options (max 2).
    
Format: "field" or "field:direction"
Directions: asc, desc

VALID SORT FIELDS:
${SortFieldValues.map(f => `- ${f}`).join('\n')}

Default directions:
- Date fields: desc (newest first)
- Numeric fields: asc (smallest first)
- @relevance: desc (most relevant first)

Examples:
- ["@relevance"]
- ["LastUpdatePostDate"]
- ["EnrollmentCount:desc"]
- ["LastUpdatePostDate:desc", "EnrollmentCount:asc"]`
  ),
  
  // ========================================
  // PAGINATION
  // ========================================
  
  pageSize: z.number().int().min(1).max(1000).default(100).describe(
    `Number of studies per page (1-1000). Default: 100`
  ),
  
  fetchAllPages: z.boolean().default(false).describe(
    `If true, fetches ALL matching studies by paginating through results.
Use with caution for large result sets. Default: false`
  ),
  
  maxTotalResults: z.number().int().min(1).default(10000).describe(
    `Maximum total results when fetchAllPages=true. Safety limit. Default: 10000`
  ),
  
  // ========================================
  // LEGACY PARAMETERS (backwards compatibility)
  // ========================================
  
  query: z.string().nullable().optional().describe(
    `Legacy simple search query (maps to queryTerm). Use specific query parameters for more control.`
  ),
  
  status: z.string().nullable().optional().describe(
    `Legacy single status filter. Use filterStatus array for multiple statuses.`
  ),
});

// Build the comprehensive clinical trials search tool
const clinicalTrialsSearch = tool({
  name: 'clinical_trials_search',
  description: `COMPREHENSIVE ClinicalTrials.gov search with COMPLETE API support for all 19 search areas.

=== CRITICAL RULES TO AVOID HALLUCINATIONS ===

⛔ RULE 0 - DO NOT ADD FILTERS THE USER DIDN'T ASK FOR! ⛔
   - If user asks for "diabetes trials in Europe" - ONLY set queryCondition and queryLocation
   - DO NOT add hasResults, healthyVolunteers, isFDARegulated, hasDMC, etc. unless EXPLICITLY requested!
   - DO NOT add filterAdvanced unless user asks for specific criteria
   - LESS IS MORE - only include what was specifically asked for!
   
   ❌ WRONG: User says "diabetes trials" → You add healthyVolunteers=false, isFDARegulated=false
   ✅ RIGHT: User says "diabetes trials" → You ONLY add queryCondition="diabetes"

1. USE MINIMAL PARAMETERS - Don't duplicate terms across parameters!
   Example for "Phase 3 diabetes trials in Germany":
   - queryCondition: "diabetes"
   - queryLocation: "Germany"  
   - phase: "PHASE3"
   - NOTHING ELSE! No hasResults, no healthyVolunteers, no isFDARegulated!

2. USE THE RIGHT SEARCH AREA for each concept:
   - Conditions/diseases → queryCondition
   - Drugs/treatments → queryIntervention
   - Locations → queryLocation (NOT filterAdvanced with fake fields!)
   - Sponsors → querySponsor
   - Outcomes → queryOutcome
   - Study IDs → queryId
   - General terms → queryTerm

3. ONLY USE VALID ENUM VALUES - These are HARDCODED:

   Phase: ${CTSchema.PhaseValues.join(', ')}
   
   Status: ${CTSchema.OverallStatusValues.join(', ')}
   
   StudyType: ${CTSchema.StudyTypeValues.join(', ')}
   
   FunderType: ${CTSchema.AgencyClassValues.join(', ')}
   
   InterventionType: ${CTSchema.InterventionTypeValues.join(', ')}

4. ONLY USE VALID FIELD NAMES in AREA[] expressions:
   ⚠️ "LocationContinent" does NOT exist!
   
   Valid location fields: LocationCountry, LocationCity, LocationState, LocationFacility, LocationZip
   Valid design fields: Phase, StudyType, DesignAllocation, DesignMasking, DesignInterventionModel, DesignPrimaryPurpose
   Valid eligibility: MinimumAge, MaximumAge, Sex, HealthyVolunteers, StdAge
   Valid dates: StartDate, CompletionDate, PrimaryCompletionDate, StudyFirstPostDate, LastUpdatePostDate, ResultsFirstPostDate
   Valid sponsor: LeadSponsorName, LeadSponsorClass, CollaboratorName
   Valid oversight: OversightHasDMC, IsFDARegulatedDrug, IsFDARegulatedDevice

5. ESSIE SYNTAX REFERENCE:
   - Boolean: AND, OR, NOT
   - Phrases: "back pain"
   - Field: AREA[Phase]PHASE3
   - Range: AREA[StartDate]RANGE[2023-01-01, MAX]
   - Missing: AREA[ResultsFirstPostDate]MISSING
   - Location grouping: SEARCH[Location](AREA[LocationCity]Boston AND AREA[LocationState]Massachusetts)

=== SEARCH AREAS (All 19) ===
${Object.entries(CTSchema.SearchAreas).map(([name, area]) => 
  `${name}: ${area.queryParam || 'AREA[]'} - ${area.description.slice(0, 60)}...`
).join('\n')}

=== EXAMPLES ===

⚠️ FOR EUROPE: Use "Europe" directly or major countries like "Germany OR France OR United Kingdom"
   Do NOT list all 30+ countries - causes "Too complicated query" error!

⚠️ FOR DATE RANGES: Use YYYY-MM-DD format. Calculate correctly from current date!
   "Last 3 years" from Dec 2025 = from: "2022-12-01"

"Diabetes trials in Europe over last 3 years":
  queryCondition="diabetes", queryLocation="Europe", dateRange={field:"StartDate", from:"2022-12-01", to:"MAX"}
  ❌ DO NOT add: hasResults, healthyVolunteers, isFDARegulated, hasDMC

"Phase 3 trials in Germany":
  queryCondition="diabetes", queryLocation="Germany", phase="PHASE3"
  ❌ DO NOT add extra filters!

"Recruiting cancer trials by Pfizer":
  queryCondition="cancer", querySponsor="Pfizer", filterStatus=["RECRUITING"]

"Industry-sponsored drug trials with results":
  funderType="INDUSTRY", interventionType="DRUG", hasResults=true

"Trials for adults 18-65 with diabetes":
  queryCondition="diabetes", ageRange={min:"18 Years", max:"65 Years"}

"COVID-19 vaccine trials started in 2024":
  queryCondition="COVID-19", queryIntervention="vaccine", dateRange={field:"StartDate", from:"2024-01-01", to:"MAX"}`,

  parameters: ComprehensiveClinicalTrialsInput,
  
  async execute(input) {
    const endpoint = 'https://clinicaltrials.gov/api/v2/studies';
    
    // Helper to validate and sanitize strings
    function isValidString(val) {
      if (val === null || val === undefined) return false;
      if (typeof val !== 'string') return false;
      const trimmed = val.trim();
      if (trimmed === '' || trimmed === '/') return false;
      return true;
    }
    
    function sanitizeString(val) {
      if (val === null || val === undefined) return null;
      if (typeof val !== 'string') return null;
      let trimmed = val.trim();
      if (trimmed === '' || trimmed === '/') return null;
      
      // Remove regex-style patterns like /term/i → term
      const regexMatch = trimmed.match(/^\/(.+)\/[gimsuy]*$/);
      if (regexMatch) {
        console.log(`[ClinicalTrials] Converted regex pattern "${trimmed}" to "${regexMatch[1]}"`);
        trimmed = regexMatch[1];
      }
      return trimmed || null;
    }
    
    // Validate enum values
    function validateEnum(value, validValues, fieldName) {
      if (!value) return null;
      const upper = String(value).toUpperCase();
      if (validValues.includes(upper)) {
        return upper;
      }
      console.warn(`[ClinicalTrials] Invalid ${fieldName} value: "${value}". Valid values: ${validValues.join(', ')}`);
      return null;
    }
    
    // Build URL with all parameters
    function buildUrl(pageToken = null) {
      const url = new URL(endpoint);
      
      // === SEARCH AREA QUERIES ===
      const queryTerm = sanitizeString(input.queryTerm) || sanitizeString(input.query);
      if (queryTerm) {
        url.searchParams.set('query.term', queryTerm);
      }
      
      const queryCondition = sanitizeString(input.queryCondition);
      if (queryCondition) {
        url.searchParams.set('query.cond', queryCondition);
      }
      
      const queryIntervention = sanitizeString(input.queryIntervention);
      if (queryIntervention) {
        url.searchParams.set('query.intr', queryIntervention);
      }
      
      const queryLocation = sanitizeString(input.queryLocation);
      if (queryLocation) {
        url.searchParams.set('query.locn', queryLocation);
      }
      
      const queryTitles = sanitizeString(input.queryTitles);
      if (queryTitles) {
        url.searchParams.set('query.titles', queryTitles);
      }
      
      const queryOutcome = sanitizeString(input.queryOutcome);
      if (queryOutcome) {
        url.searchParams.set('query.outc', queryOutcome);
      }
      
      const querySponsor = sanitizeString(input.querySponsor);
      if (querySponsor) {
        url.searchParams.set('query.spons', querySponsor);
      }
      
      const queryLeadSponsor = sanitizeString(input.queryLeadSponsor);
      if (queryLeadSponsor) {
        url.searchParams.set('query.lead', queryLeadSponsor);
      }
      
      const queryId = sanitizeString(input.queryId);
      if (queryId) {
        url.searchParams.set('query.id', queryId);
      }
      
      const queryPatient = sanitizeString(input.queryPatient);
      if (queryPatient) {
        url.searchParams.set('query.patient', queryPatient);
      }
      
      // === STATUS FILTER ===
      const statuses = [];
      if (input.filterStatus && input.filterStatus.length > 0) {
        const validStatuses = input.filterStatus
          .map(s => validateEnum(s, CTSchema.OverallStatusValues, 'OverallStatus'))
          .filter(s => s !== null);
        statuses.push(...validStatuses);
      }
      const status = sanitizeString(input.status);
      if (status) {
        const validStatus = validateEnum(status, CTSchema.OverallStatusValues, 'OverallStatus');
        if (validStatus && !statuses.includes(validStatus)) {
          statuses.push(validStatus);
        }
      }
      if (statuses.length > 0) {
        url.searchParams.set('filter.overallStatus', statuses.join(','));
      }
      
      // === GEO FILTER ===
      if (input.filterGeo) {
        const { latitude, longitude, distance } = input.filterGeo;
        if (typeof latitude === 'number' && typeof longitude === 'number' && distance) {
          url.searchParams.set('filter.geo', `distance(${latitude},${longitude},${distance})`);
          
          const geoDecay = sanitizeString(input.geoDecay);
          if (geoDecay) {
            url.searchParams.set('geoDecay', geoDecay);
          }
        }
      }
      
      // === IDS FILTER ===
      if (input.filterIds && input.filterIds.length > 0) {
        const validIds = input.filterIds
          .filter(id => isValidString(id))
          .map(id => sanitizeString(id))
          .filter(id => id !== null);
        if (validIds.length > 0) {
          url.searchParams.set('filter.ids', validIds.join(','));
        }
      }
      
      // === BUILD ADVANCED FILTER ===
      const advancedParts = [];
      
      // User-provided advanced filter
      const filterAdvanced = sanitizeString(input.filterAdvanced);
      if (filterAdvanced) {
        advancedParts.push(filterAdvanced);
      }
      
      // Phase
      const phase = validateEnum(input.phase, CTSchema.PhaseValues, 'Phase');
      if (phase) {
        advancedParts.push(`AREA[Phase]${phase}`);
      }
      
      // Study type
      const studyType = validateEnum(input.studyType, CTSchema.StudyTypeValues, 'StudyType');
      if (studyType) {
        advancedParts.push(`AREA[StudyType]${studyType}`);
      }
      
      // Funder type
      const funderType = validateEnum(input.funderType, CTSchema.AgencyClassValues, 'AgencyClass');
      if (funderType) {
        advancedParts.push(`AREA[LeadSponsorClass]${funderType}`);
      }
      
      // Intervention type
      const interventionType = validateEnum(input.interventionType, CTSchema.InterventionTypeValues, 'InterventionType');
      if (interventionType) {
        advancedParts.push(`AREA[InterventionType]${interventionType}`);
      }
      
      // Has results - ONLY filter when explicitly true (to find studies WITH results)
      // Don't add filter when false - let all studies through
      if (input.hasResults === true) {
        advancedParts.push(`AREA[ResultsFirstPostDate]RANGE[MIN,MAX]`);
      }
      
      // Sex
      const sex = validateEnum(input.sex, CTSchema.SexValues, 'Sex');
      if (sex) {
        advancedParts.push(`AREA[Sex]${sex}`);
      }
      
      // Healthy volunteers - ONLY filter when explicitly true
      // Don't add filter when false - let all studies through
      if (input.healthyVolunteers === true) {
        advancedParts.push(`AREA[HealthyVolunteers]true`);
      }
      
      // Age range
      if (input.ageRange) {
        if (input.ageRange.min) {
          advancedParts.push(`AREA[MinimumAge]RANGE[MIN, ${input.ageRange.min}]`);
        }
        if (input.ageRange.max) {
          advancedParts.push(`AREA[MaximumAge]RANGE[${input.ageRange.max}, MAX]`);
        }
      }
      
      // Date range
      if (input.dateRange && input.dateRange.field) {
        const validDateFields = ['StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'StudyFirstPostDate', 'LastUpdatePostDate', 'ResultsFirstPostDate'];
        if (validDateFields.includes(input.dateRange.field)) {
          const from = input.dateRange.from || 'MIN';
          const to = input.dateRange.to || 'MAX';
          advancedParts.push(`AREA[${input.dateRange.field}]RANGE[${from}, ${to}]`);
        }
      }
      
      // FDA regulated - ONLY filter when explicitly true
      // Don't add filter when false - let all studies through
      if (input.isFDARegulated === true) {
        advancedParts.push(`AREA[IsFDARegulatedDrug]true`);
      }
      
      // Has DMC - ONLY filter when explicitly true
      // Don't add filter when false - let all studies through
      if (input.hasDMC === true) {
        advancedParts.push(`AREA[OversightHasDMC]true`);
      }
      
      // Design filters
      const designAllocation = validateEnum(input.designAllocation, CTSchema.DesignAllocationValues, 'DesignAllocation');
      if (designAllocation) {
        advancedParts.push(`AREA[DesignAllocation]${designAllocation}`);
      }
      
      const designInterventionModel = validateEnum(input.designInterventionModel, CTSchema.InterventionModelValues, 'InterventionModel');
      if (designInterventionModel) {
        advancedParts.push(`AREA[DesignInterventionModel]${designInterventionModel}`);
      }
      
      const designMasking = validateEnum(input.designMasking, CTSchema.DesignMaskingValues, 'DesignMasking');
      if (designMasking) {
        advancedParts.push(`AREA[DesignMasking]${designMasking}`);
      }
      
      const designPrimaryPurpose = validateEnum(input.designPrimaryPurpose, CTSchema.PrimaryPurposeValues, 'PrimaryPurpose');
      if (designPrimaryPurpose) {
        advancedParts.push(`AREA[DesignPrimaryPurpose]${designPrimaryPurpose}`);
      }
      
      const designObservationalModel = validateEnum(input.designObservationalModel, CTSchema.ObservationalModelValues, 'ObservationalModel');
      if (designObservationalModel) {
        advancedParts.push(`AREA[DesignObservationalModel]${designObservationalModel}`);
      }
      
      const designTimePerspective = validateEnum(input.designTimePerspective, CTSchema.TimePerspectiveValues, 'TimePerspective');
      if (designTimePerspective) {
        advancedParts.push(`AREA[DesignTimePerspective]${designTimePerspective}`);
      }
      
      // Combine advanced parts
      if (advancedParts.length > 0) {
        url.searchParams.set('filter.advanced', advancedParts.join(' AND '));
      }
      
      // === SYNONYMS FILTER ===
      if (input.filterSynonyms && input.filterSynonyms.length > 0) {
        const validSynonyms = input.filterSynonyms
          .filter(s => isValidString(s))
          .map(s => sanitizeString(s))
          .filter(s => s !== null);
        if (validSynonyms.length > 0) {
          url.searchParams.set('filter.synonyms', validSynonyms.join(','));
        }
      }
      
      // === AGGREGATION FILTERS ===
      const aggFilters = sanitizeString(input.aggFilters);
      if (aggFilters) {
        url.searchParams.set('aggFilters', aggFilters);
      }
      
      // === FIELD SELECTION ===
      if (input.fields && input.fields.length > 0) {
        const validFields = input.fields
          .filter(f => isValidString(f))
          .map(f => sanitizeString(f))
          .filter(f => f !== null);
        if (validFields.length > 0) {
          url.searchParams.set('fields', validFields.join(','));
        }
      }
      
      // === SORTING ===
      if (input.sort && input.sort.length > 0) {
        const validSort = input.sort
          .filter(s => isValidString(s))
          .map(s => sanitizeString(s))
          .filter(s => s !== null);
        if (validSort.length > 0) {
          url.searchParams.set('sort', validSort.join(','));
        }
      }
      
      // === PAGINATION ===
      url.searchParams.set('pageSize', String(input.pageSize || 100));
      url.searchParams.set('countTotal', 'true');
      
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }
      
      return url;
    }
    
    // Fetch a single page
    async function fetchPage(pageToken = null) {
      const url = buildUrl(pageToken);
      const fullUrl = url.toString();
      console.log(`[ClinicalTrials] Fetching: ${fullUrl}`);
      
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClinicalTrials.gov API error: ${res.status} - ${text.slice(0, 500)}`);
      }
      
      return res.json();
    }
    
    try {
      // Fetch first page
      const firstPage = await fetchPage();
      const totalCount = firstPage.totalCount || 0;
      let allStudies = firstPage.studies || [];
      let nextPageToken = firstPage.nextPageToken;
      let pagesFetched = 1;
      
      // Paginate if requested
      if (input.fetchAllPages && nextPageToken) {
        const maxResults = input.maxTotalResults || 10000;
        
        while (nextPageToken && allStudies.length < maxResults) {
          console.log(`[ClinicalTrials] Fetching page ${pagesFetched + 1}, total so far: ${allStudies.length}/${totalCount}`);
          
          const page = await fetchPage(nextPageToken);
          const pageStudies = page.studies || [];
          allStudies = allStudies.concat(pageStudies);
          nextPageToken = page.nextPageToken;
          pagesFetched++;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Safety limit
          if (pagesFetched > 200) {
            console.log('[ClinicalTrials] Stopping at 200 pages for safety');
            break;
          }
        }
      }
      
      // Build metadata
      const metadata = {
        api: 'clinicaltrials.gov',
        version: 'v3.0-comprehensive',
        endpoint,
        inputParams: {
          queries: {
            term: input.queryTerm || input.query || null,
            condition: input.queryCondition || null,
            intervention: input.queryIntervention || null,
            location: input.queryLocation || null,
            titles: input.queryTitles || null,
            outcome: input.queryOutcome || null,
            sponsor: input.querySponsor || null,
            leadSponsor: input.queryLeadSponsor || null,
            id: input.queryId || null,
            patient: input.queryPatient || null,
          },
          filters: {
            status: input.filterStatus || (input.status ? [input.status] : null),
            geo: input.filterGeo || null,
            ids: input.filterIds || null,
            advanced: input.filterAdvanced || null,
            phase: input.phase || null,
            studyType: input.studyType || null,
            funderType: input.funderType || null,
            interventionType: input.interventionType || null,
            hasResults: input.hasResults ?? null,
            sex: input.sex || null,
            ageRange: input.ageRange || null,
            dateRange: input.dateRange || null,
            healthyVolunteers: input.healthyVolunteers ?? null,
            isFDARegulated: input.isFDARegulated ?? null,
            hasDMC: input.hasDMC ?? null,
          },
          design: {
            allocation: input.designAllocation || null,
            interventionModel: input.designInterventionModel || null,
            masking: input.designMasking || null,
            primaryPurpose: input.designPrimaryPurpose || null,
            observationalModel: input.designObservationalModel || null,
            timePerspective: input.designTimePerspective || null,
          },
          sort: input.sort || null,
        },
        returnedCount: allStudies.length,
        totalCount,
        pagesFetched,
        allPagesFetched: !nextPageToken,
        hasMore: !!nextPageToken,
        fetchedAt: new Date().toISOString(),
      };
      
      // Store raw results
      lastToolResults.clinicalTrials = { metadata, raw: { studies: allStudies, totalCount } };
      
      // Create detailed summaries
      const studySummaries = allStudies.slice(0, 50).map((study, i) => {
        const proto = study?.protocolSection;
        const id = proto?.identificationModule;
        const status = proto?.statusModule;
        const design = proto?.designModule;
        const desc = proto?.descriptionModule;
        const sponsor = proto?.sponsorCollaboratorsModule;
        const conditions = proto?.conditionsModule;
        const eligibility = proto?.eligibilityModule;
        const arms = proto?.armsInterventionsModule;
        const outcomes = proto?.outcomesModule;
        const contacts = proto?.contactsLocationsModule;
        const oversight = proto?.oversightModule;
        
        return {
          index: i + 1,
          nctId: id?.nctId || 'N/A',
          title: id?.briefTitle || 'Untitled',
          officialTitle: id?.officialTitle || null,
          acronym: id?.acronym || null,
          status: status?.overallStatus || 'Unknown',
          startDate: status?.startDateStruct?.date || null,
          primaryCompletionDate: status?.primaryCompletionDateStruct?.date || null,
          completionDate: status?.completionDateStruct?.date || null,
          firstPosted: status?.studyFirstPostDateStruct?.date || null,
          lastUpdated: status?.lastUpdatePostDateStruct?.date || null,
          phase: design?.phases?.join(', ') || 'N/A',
          studyType: design?.studyType || null,
          enrollment: design?.enrollmentInfo?.count || null,
          enrollmentType: design?.enrollmentInfo?.type || null,
          
          // Design details
          allocation: design?.designInfo?.allocation || null,
          interventionModel: design?.designInfo?.interventionModel || null,
          masking: design?.designInfo?.maskingInfo?.masking || null,
          primaryPurpose: design?.designInfo?.primaryPurpose || null,
          
          // Sponsor info
          sponsor: sponsor?.leadSponsor?.name || 'N/A',
          sponsorClass: sponsor?.leadSponsor?.class || null,
          collaborators: sponsor?.collaborators?.map(c => c.name).slice(0, 5) || [],
          
          // Conditions and interventions
          conditions: conditions?.conditions?.slice(0, 5) || [],
          keywords: conditions?.keywords?.slice(0, 5) || [],
          interventions: arms?.interventions?.map(int => ({
            type: int.type,
            name: int.name,
          })).slice(0, 5) || [],
          
          // Outcomes
          primaryOutcomes: outcomes?.primaryOutcomes?.map(o => o.measure).slice(0, 3) || [],
          secondaryOutcomes: outcomes?.secondaryOutcomes?.map(o => o.measure).slice(0, 3) || [],
          
          // Eligibility
          eligibility: eligibility ? {
            sex: eligibility.sex,
            minAge: eligibility.minimumAge,
            maxAge: eligibility.maximumAge,
            healthyVolunteers: eligibility.healthyVolunteers,
            criteria: (eligibility.eligibilityCriteria || '').slice(0, 500),
          } : null,
          
          // Oversight
          oversight: oversight ? {
            hasDMC: oversight.oversightHasDmc,
            isFDARegulatedDrug: oversight.isFdaRegulatedDrug,
            isFDARegulatedDevice: oversight.isFdaRegulatedDevice,
          } : null,
          
          // Locations summary
          locationCount: contacts?.locations?.length || 0,
          locations: contacts?.locations?.slice(0, 5).map(loc => ({
            facility: loc.facility,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            status: loc.status,
          })) || [],
          
          hasResults: study.hasResults || false,
          briefSummary: (desc?.briefSummary || '').slice(0, 500) + (desc?.briefSummary?.length > 500 ? '...' : ''),
        };
      });
      
      // Compile response
      const response = {
        metadata,
        studies: studySummaries,
        summary: {
          totalMatching: totalCount,
          returned: allStudies.length,
          showing: studySummaries.length,
          hasMore: !!nextPageToken || allStudies.length > studySummaries.length,
        },
        searchAreasUsed: Object.entries(CTSchema.SearchAreas)
          .filter(([name, area]) => {
            if (area.queryParam === 'query.term' && (input.queryTerm || input.query)) return true;
            if (area.queryParam === 'query.cond' && input.queryCondition) return true;
            if (area.queryParam === 'query.intr' && input.queryIntervention) return true;
            if (area.queryParam === 'query.locn' && input.queryLocation) return true;
            if (area.queryParam === 'query.titles' && input.queryTitles) return true;
            if (area.queryParam === 'query.outc' && input.queryOutcome) return true;
            if (area.queryParam === 'query.spons' && input.querySponsor) return true;
            if (area.queryParam === 'query.lead' && input.queryLeadSponsor) return true;
            if (area.queryParam === 'query.id' && input.queryId) return true;
            if (area.queryParam === 'query.patient' && input.queryPatient) return true;
            return false;
          })
          .map(([name]) => name),
        searchTips: totalCount === 0 ? [
          'Try broader search terms',
          'Check spelling of drug/condition names',
          'Remove some filters to expand results',
          'Use the appropriate search area (queryCondition for diseases, queryIntervention for drugs)',
          'For geographic searches, use queryLocation with country names',
        ] : null,
      };
      
      return JSON.stringify(response, null, 2);
      
    } catch (err) {
      console.error('[ClinicalTrials] Error:', err.message);
      lastToolResults.clinicalTrials = { 
        metadata: { error: err.message, input }, 
        raw: null 
      };
      return JSON.stringify({
        error: err.message,
        message: 'Failed to search ClinicalTrials.gov',
        suggestion: 'Check query syntax. Valid enum values are hardcoded - do not invent new ones.',
        validEnums: {
          phase: CTSchema.PhaseValues,
          status: CTSchema.OverallStatusValues,
          studyType: CTSchema.StudyTypeValues,
          funderType: CTSchema.AgencyClassValues,
        },
      });
    }
  },
});

// ============================================
// TOOL 2: FDA DRUG SEARCH (unchanged)
// ============================================
const FDASearchInput = z.object({
  query: z.string().min(1).describe('Drug name, application number, or active ingredient to search'),
  searchType: z.enum(['name', 'application', 'ingredient', 'sponsor']).default('name').describe('Type of search: name (brand/generic), application (NDA/ANDA number), ingredient, or sponsor'),
});

const fdaDrugSearch = tool({
  name: 'fda_drug_search',
  description: `Search the FDA Drugs@FDA database. Use for:
- Finding FDA-approved drugs by brand or generic name
- Looking up application numbers (NDA, ANDA, BLA)
- Finding drugs by active ingredient
- Finding drugs by sponsor/manufacturer
- Checking marketing status and approval dates`,
  parameters: FDASearchInput,
  async execute(input) {
    console.log(`[FDA Tool] Searching: ${input.query} (type: ${input.searchType})`);
    
    const results = await queryDrugsAtFDA(input.query, input.searchType);
    
    if (!results || results.length === 0) {
      lastToolResults.fda = { metadata: { query: input, found: 0 }, raw: null };
      return JSON.stringify({
        metadata: { query: input, found: 0 },
        message: `No FDA drug data found for "${input.query}"`,
        suggestion: 'Try a different search term or search type'
      });
    }
    
    const metadata = {
      api: 'drugs@fda',
      query: input,
      found: results.length,
      fetchedAt: new Date().toISOString(),
    };
    
    lastToolResults.fda = { metadata, raw: results };
    
    const summaries = results.slice(0, 10).map((drug, i) => {
      const products = drug.products || [];
      const activeProducts = products.filter(p => 
        p.marketing_status?.toLowerCase().includes('prescription') ||
        p.marketing_status?.toLowerCase().includes('otc')
      );
      
      return {
        index: i + 1,
        applicationNumber: drug.application_number,
        sponsorName: drug.sponsor_name,
        brandName: drug.openfda?.brand_name?.[0] || products[0]?.brand_name || 'N/A',
        genericName: drug.openfda?.generic_name?.[0] || 'N/A',
        productCount: products.length,
        activelyMarketed: activeProducts.length,
        submissionType: drug.submissions?.[0]?.submission_type || 'N/A',
        approvalDate: drug.submissions?.[0]?.submission_status_date || 'N/A',
        activeIngredients: [...new Set(products.flatMap(p => 
          (p.active_ingredients || []).map(ai => ai.name)
        ))].slice(0, 5),
      };
    });
    
    return JSON.stringify({
      metadata,
      drugs: summaries,
    }, null, 2);
  },
});

// ============================================
// TOOL 3: ORANGE BOOK SEARCH (unchanged)
// ============================================
const OrangeBookSearchInput = z.object({
  query: z.string().min(1).describe('Drug name, ingredient, or trade name to search'),
  includePatents: z.boolean().default(true).describe('Include patent information'),
  includeExclusivity: z.boolean().default(true).describe('Include exclusivity information'),
  includeGenerics: z.boolean().default(true).describe('Include generic products'),
});

const orangeBookSearch = tool({
  name: 'orange_book_search',
  description: `Search the FDA Orange Book database. Use for:
- Finding patent information for drugs
- Checking exclusivity periods
- Finding generic equivalents (ANDA vs NDA)
- Therapeutic equivalence (TE) codes
- Reference Listed Drug (RLD) status
- Branded vs generic product classification`,
  parameters: OrangeBookSearchInput,
  async execute(input) {
    console.log(`[Orange Book] Searching: ${input.query}`);
    
    const q = input.query.toLowerCase();
    const matchedGroups = [];
    
    for (const g of groups.values()) {
      const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
      const tradeNameMatch = g.products.some(p =>
        (p.Trade_Name || '').toLowerCase().includes(q)
      );
      
      if (!ingredientMatch && !tradeNameMatch) continue;
      
      const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
      const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));
      
      let groupPatents = [];
      let groupExclusivities = [];
      
      if (input.includePatents) {
        g.products.forEach(p => {
          const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
          const pts = patentIndex.get(key) || [];
          groupPatents = groupPatents.concat(pts);
        });
      }
      
      if (input.includeExclusivity) {
        g.products.forEach(p => {
          const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
          const exs = exclusivityIndex.get(key) || [];
          groupExclusivities = groupExclusivities.concat(exs);
        });
      }
      
      matchedGroups.push({
        ingredient: g.ingredient,
        dfRoute: g.dfRoute,
        strength: g.strength,
        brandedCount: brandedProducts.length,
        genericCount: genericProducts.length,
        brandedProducts: brandedProducts.slice(0, 5).map(p => ({
          applNo: `NDA${p.Appl_No}`,
          tradeName: p.Trade_Name,
          applicant: p.Applicant,
          teCode: p.TE_Code,
          rld: isRLD(p),
          active: isActiveProduct(p),
        })),
        genericProducts: input.includeGenerics ? genericProducts.slice(0, 10).map(p => ({
          applNo: `ANDA${p.Appl_No}`,
          tradeName: p.Trade_Name,
          applicant: p.Applicant,
          teCode: p.TE_Code,
          active: isActiveProduct(p),
        })) : [],
        patents: groupPatents.slice(0, 10).map(pt => ({
          patentNo: pt.Patent_No,
          expireDate: pt.Patent_Expire_Date_Text,
          drugSubstance: pt.Drug_Substance_Flag === 'Y',
          drugProduct: pt.Drug_Product_Flag === 'Y',
          useCode: pt.Patent_Use_Code,
        })),
        exclusivities: groupExclusivities.slice(0, 10).map(ex => ({
          code: ex.Exclusivity_Code,
          expireDate: ex.Exclusivity_Date,
        })),
      });
    }
    
    const metadata = {
      api: 'orange_book',
      query: input.query,
      found: matchedGroups.length,
      fetchedAt: new Date().toISOString(),
    };
    
    lastToolResults.orangeBook = { metadata, raw: matchedGroups };
    
    if (matchedGroups.length === 0) {
      return JSON.stringify({
        metadata,
        message: `No Orange Book data found for "${input.query}"`,
        note: 'Orange Book only contains FDA-approved drugs with therapeutic equivalence evaluations'
      });
    }
    
    return JSON.stringify({
      metadata,
      groups: matchedGroups.slice(0, 20),
    }, null, 2);
  },
});

// ============================================
// TOOL 4: PUBMED LITERATURE SEARCH (unchanged)
// ============================================
const PubMedSearchInput = z.object({
  query: z.string().min(1).describe('Search query - drug names, conditions, mechanisms, authors, etc.'),
  maxResults: z.number().int().min(1).max(50).default(20).describe('Maximum number of articles to return'),
  dateFrom: z.string().nullable().optional().describe('Start date filter (YYYY/MM/DD or YYYY)'),
  dateTo: z.string().nullable().optional().describe('End date filter (YYYY/MM/DD or YYYY)'),
  articleTypes: z.array(z.string()).nullable().optional().describe('Filter by article type: Review, Clinical Trial, Meta-Analysis, etc.'),
});

const pubmedSearch = tool({
  name: 'pubmed_search',
  description: `Search PubMed for biomedical literature. Use for:
- Finding published research on drugs, diseases, mechanisms
- Review articles and meta-analyses
- Clinical trial publications
- Drug safety and efficacy studies
- Author-specific publications
Returns article titles, authors, journals, abstracts, PMIDs, and DOIs.`,
  parameters: PubMedSearchInput,
  async execute(input) {
    console.log(`[PubMed Tool] Searching: ${input.query}`);
    
    try {
      const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
      searchUrl.searchParams.set('db', 'pubmed');
      searchUrl.searchParams.set('term', input.query);
      searchUrl.searchParams.set('retmax', String(input.maxResults || 20));
      searchUrl.searchParams.set('retmode', 'json');
      searchUrl.searchParams.set('sort', 'relevance');
      
      if (input.dateFrom) {
        searchUrl.searchParams.set('mindate', input.dateFrom);
        searchUrl.searchParams.set('datetype', 'pdat');
      }
      if (input.dateTo) {
        searchUrl.searchParams.set('maxdate', input.dateTo);
        searchUrl.searchParams.set('datetype', 'pdat');
      }
      
      if (input.articleTypes && input.articleTypes.length > 0) {
        const typeFilter = input.articleTypes.map(t => `${t}[pt]`).join(' OR ');
        searchUrl.searchParams.set('term', `(${input.query}) AND (${typeFilter})`);
      }
      
      console.log(`[PubMed] Search URL: ${searchUrl.toString()}`);
      
      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        throw new Error(`PubMed search failed: ${searchRes.status}`);
      }
      
      const searchData = await searchRes.json();
      const pmids = searchData?.esearchresult?.idlist || [];
      const totalCount = parseInt(searchData?.esearchresult?.count || '0', 10);
      
      if (pmids.length === 0) {
        const metadata = {
          api: 'pubmed',
          query: input.query,
          found: 0,
          totalCount: 0,
          fetchedAt: new Date().toISOString(),
        };
        lastToolResults.pubmed = { metadata, raw: [] };
        return JSON.stringify({
          metadata,
          message: `No PubMed articles found for "${input.query}"`,
          suggestion: 'Try broader search terms or check spelling'
        });
      }
      
      const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
      summaryUrl.searchParams.set('db', 'pubmed');
      summaryUrl.searchParams.set('id', pmids.join(','));
      summaryUrl.searchParams.set('retmode', 'json');
      
      const summaryRes = await fetch(summaryUrl.toString());
      if (!summaryRes.ok) {
        throw new Error(`PubMed summary fetch failed: ${summaryRes.status}`);
      }
      
      const summaryData = await summaryRes.json();
      const articles = [];
      
      for (const pmid of pmids) {
        const article = summaryData?.result?.[pmid];
        if (!article) continue;
        
        const doi = article.articleids?.find(id => id.idtype === 'doi')?.value || null;
        const pmc = article.articleids?.find(id => id.idtype === 'pmc')?.value || null;
        
        articles.push({
          pmid,
          title: article.title || 'No title',
          authors: article.authors?.slice(0, 5).map(a => a.name) || [],
          journal: article.source || 'Unknown journal',
          pubDate: article.pubdate || 'Unknown date',
          volume: article.volume || '',
          issue: article.issue || '',
          pages: article.pages || '',
          doi,
          pmc,
          pubType: article.pubtype || [],
          abstract: '',
        });
      }
      
      const metadata = {
        api: 'pubmed',
        query: input.query,
        found: articles.length,
        totalCount,
        fetchedAt: new Date().toISOString(),
      };
      
      lastToolResults.pubmed = { metadata, raw: articles };
      
      const articleSummaries = articles.slice(0, 10).map((a, i) => ({
        index: i + 1,
        pmid: a.pmid,
        title: a.title,
        authors: a.authors.slice(0, 3).join(', ') + (a.authors.length > 3 ? ' et al.' : ''),
        journal: a.journal,
        pubDate: a.pubDate,
        doi: a.doi,
        pubType: a.pubType.slice(0, 2),
      }));
      
      return JSON.stringify({
        metadata,
        articles: articleSummaries,
        hasMore: totalCount > articles.length,
        note: `Showing ${articles.length} of ${totalCount} matching articles`,
      }, null, 2);
      
    } catch (err) {
      console.error('[PubMed Tool] Error:', err.message);
      lastToolResults.pubmed = { metadata: { query: input.query, error: err.message }, raw: null };
      return JSON.stringify({
        error: err.message,
        message: 'Failed to search PubMed',
      });
    }
  },
});

// ============================================
// UNIFIED AGENT WITH COMPREHENSIVE INSTRUCTIONS
// ============================================

const comprehensiveAgentInstructions = `You are a pharmaceutical regulatory intelligence expert with access to four databases.

=== TOOL 1: clinical_trials_search (ClinicalTrials.gov) ===

⛔ RULE 0 - DO NOT ADD FILTERS THE USER DIDN'T ASK FOR! ⛔
   - If user asks for "diabetes trials in Europe" - ONLY set queryCondition and queryLocation
   - DO NOT add hasResults, healthyVolunteers, isFDARegulated, hasDMC unless EXPLICITLY requested!
   - LESS IS MORE - only include what was specifically asked for!
   
   ❌ WRONG: User says "diabetes trials" → You add healthyVolunteers=false, hasDMC=false
   ✅ RIGHT: User says "diabetes trials" → You ONLY add queryCondition="diabetes"

CRITICAL RULES - READ CAREFULLY:

1. USE MINIMAL PARAMETERS - Each concept goes in ONE parameter only!
   
   BAD: queryCondition="diabetes", queryTerm="diabetes", queryIntervention="diabetes"
   GOOD: queryCondition="diabetes"
   
   DO NOT ADD: hasResults, healthyVolunteers, isFDARegulated, hasDMC unless user asks!

2. CHOOSE THE RIGHT SEARCH AREA:
   - Diseases/conditions → queryCondition (NOT queryTerm!)
   - Drugs/treatments → queryIntervention
   - Geographic locations → queryLocation
   - Sponsors → querySponsor
   - Study IDs → queryId
   - Outcomes → queryOutcome

3. VALID ENUM VALUES (HARDCODED - DO NOT INVENT!):

   Phase: ${CTSchema.PhaseValues.join(', ')}
   
   Status: RECRUITING, COMPLETED, ACTIVE_NOT_RECRUITING, NOT_YET_RECRUITING, 
           ENROLLING_BY_INVITATION, SUSPENDED, TERMINATED, WITHDRAWN
   
   StudyType: INTERVENTIONAL, OBSERVATIONAL, EXPANDED_ACCESS
   
   FunderType: NIH, FED, INDUSTRY, OTHER_GOV, INDIV, NETWORK, OTHER
   
   InterventionType: DRUG, BIOLOGICAL, DEVICE, PROCEDURE, BEHAVIORAL, 
                     DIETARY_SUPPLEMENT, GENETIC, RADIATION, OTHER

4. VALID FIELD NAMES for AREA[] (PARTIAL LIST):
   
   ⚠️ "LocationContinent" does NOT exist! Use queryLocation with country names.
   
   Location: LocationCountry, LocationCity, LocationState, LocationFacility
   Design: Phase, StudyType, DesignAllocation, DesignMasking, DesignInterventionModel
   Eligibility: MinimumAge, MaximumAge, Sex, HealthyVolunteers, StdAge
   Dates: StartDate, CompletionDate, StudyFirstPostDate, LastUpdatePostDate, ResultsFirstPostDate
   Sponsor: LeadSponsorName, LeadSponsorClass, CollaboratorName
   Oversight: OversightHasDMC, IsFDARegulatedDrug, IsFDARegulatedDevice

5. QUERY EXAMPLES:

   "Phase 3 diabetes trials in Germany":
   → queryCondition="diabetes", queryLocation="Germany", phase="PHASE3"

   "Recruiting cancer trials by Pfizer":
   → queryCondition="cancer", querySponsor="Pfizer", filterStatus=["RECRUITING"]

   "Drug trials for adults with posted results":
   → interventionType="DRUG", ageRange={min:"18 Years"}, hasResults=true

   "COVID vaccine trials in 2024":
   → queryCondition="COVID-19", queryIntervention="vaccine", dateRange={field:"StartDate", from:"2024-01-01", to:"MAX"}

   "Diabetes trials in Europe over last 3 years" (from Dec 2025):
   → queryCondition="diabetes", queryLocation="Europe", dateRange={field:"StartDate", from:"2022-12-01", to:"MAX"}
   ❌ DO NOT add: hasResults=false, healthyVolunteers=false, isFDARegulated=false

=== TOOL 2: fda_drug_search (Drugs@FDA) ===
Use for: FDA approvals, NDA/ANDA/BLA numbers, marketing status, approval dates

=== TOOL 3: orange_book_search (Orange Book) ===
Use for: Patents, exclusivity periods, generic equivalents, TE codes

=== TOOL 4: pubmed_search (PubMed) ===
Use for: Published research, review articles, clinical trial publications

=== GENERAL RULES ===
⛔ DO NOT ADD FILTERS THE USER DIDN'T ASK FOR!
   - If user says "diabetes trials in Europe" → ONLY use queryCondition and queryLocation
   - DO NOT add: hasResults, healthyVolunteers, isFDARegulated, hasDMC unless explicitly asked!
   
- Answer questions directly using the appropriate tool(s)
- Never invent enum values or field names
- For geographic queries, use queryLocation with country/city/state names
- For "Europe", use "Europe" directly - do NOT list all countries
- If a search returns 0 results, suggest broadening the search`;

const regulatoryAgent = new Agent({
  name: 'Regulatory Intelligence Agent v3.0',
  instructions: comprehensiveAgentInstructions,
  tools: [clinicalTrialsSearch, fdaDrugSearch, orangeBookSearch, pubmedSearch],
});

// Use the unified agent as the main agent
const triageAgent = regulatoryAgent;

// ============================================
// EXPRESS ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    orangeBookLoaded: products.length > 0,
    productCount: products.length,
    patentCount: patents.length,
    version: '3.0.0-comprehensive',
    features: [
      'Complete ClinicalTrials.gov API support',
      'All 19 search areas fully documented',
      'Hardcoded enum validation',
      'Full Essie expression syntax',
      'Complete pagination support',
      'All filters and design parameters',
    ],
    searchAreas: Object.keys(CTSchema.SearchAreas),
    enumCounts: {
      overallStatus: CTSchema.OverallStatusValues.length,
      phase: CTSchema.PhaseValues.length,
      studyType: CTSchema.StudyTypeValues.length,
      interventionType: CTSchema.InterventionTypeValues.length,
      searchableFields: CTSchema.AllSearchableFieldNames.length,
    },
  });
});

// Main query endpoint
app.post('/query', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? '').trim();
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    
    console.log(`\n[Query] ${prompt}`);
    
    resetToolResults();
    
    const result = await run(triageAgent, prompt);
    
    console.log(`[Result] Final output received`);
    
    const response = {
      response: {
        metadata: {
          clinicalTrials: lastToolResults.clinicalTrials?.metadata || null,
          fda: lastToolResults.fda?.metadata || null,
          orangeBook: lastToolResults.orangeBook?.metadata || null,
          pubmed: lastToolResults.pubmed?.metadata || null,
        },
        llm: result.finalOutput ?? '',
      },
      raw: {
        clinicalTrials: lastToolResults.clinicalTrials?.raw || null,
        fda: lastToolResults.fda?.raw || null,
        orangeBook: lastToolResults.orangeBook?.raw || null,
        pubmed: lastToolResults.pubmed?.raw || null,
      },
    };
    
    res.json(response);
    
  } catch (err) {
    console.error('[Error]', err);
    res.status(500).json({
      error: err?.message ?? 'Unknown error',
      response: {
        metadata: null,
        llm: 'An error occurred while processing your request.',
      },
      raw: null,
    });
  }
});

// Direct clinical trials search endpoint
app.post('/api/clinical-trials/search', async (req, res) => {
  try {
    const params = req.body;
    
    const input = {
      ...params,
      pageSize: params.pageSize || 100,
      fetchAllPages: params.fetchAllPages || true,
    };
    
    const result = await clinicalTrialsSearch.execute(input);
    
    res.json(JSON.parse(result));
    
  } catch (err) {
    console.error('[Clinical Trials API] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Schema reference endpoint
app.get('/api/schema', (req, res) => {
  res.json({
    searchAreas: Object.entries(CTSchema.SearchAreas).map(([name, area]) => ({
      name,
      queryParam: area.queryParam,
      description: area.description,
      fieldCount: area.fields.length,
    })),
    enums: {
      overallStatus: CTSchema.OverallStatusValues,
      phase: CTSchema.PhaseValues,
      studyType: CTSchema.StudyTypeValues,
      agencyClass: CTSchema.AgencyClassValues,
      interventionType: CTSchema.InterventionTypeValues,
      sex: CTSchema.SexValues,
      standardAge: CTSchema.StandardAgeValues,
      designAllocation: CTSchema.DesignAllocationValues,
      interventionModel: CTSchema.InterventionModelValues,
      primaryPurpose: CTSchema.PrimaryPurposeValues,
      observationalModel: CTSchema.ObservationalModelValues,
      timePerspective: CTSchema.TimePerspectiveValues,
      designMasking: CTSchema.DesignMaskingValues,
    },
    searchableFields: CTSchema.AllSearchableFieldNames,
    essieSyntax: CTSchema.EssieSyntax,
    commonPatterns: CTSchema.CommonQueryPatterns,
  });
});

// Direct Orange Book search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) {
      return res.status(400).json({ error: 'Missing query param "q".' });
    }

    const matchedGroups = [];

    for (const g of groups.values()) {
      const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
      const tradeNameMatch = g.products.some(p =>
        (p.Trade_Name || '').toLowerCase().includes(q)
      );

      if (!ingredientMatch && !tradeNameMatch) continue;

      const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
      const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));

      matchedGroups.push({
        key: g.key,
        ingredient: g.ingredient,
        dfRoute: g.dfRoute,
        strength: g.strength,
        brandedProducts: brandedProducts.map(p => ({
          applNo: `NDA${p.Appl_No}`,
          tradeName: p.Trade_Name,
          applicant: p.Applicant,
          teCode: p.TE_Code,
          rld: isRLD(p),
          active: isActiveProduct(p),
        })),
        genericProducts: genericProducts.map(p => ({
          applNo: `ANDA${p.Appl_No}`,
          tradeName: p.Trade_Name,
          applicant: p.Applicant,
          teCode: p.TE_Code,
          active: isActiveProduct(p),
        })),
      });
    }

    res.json({
      query: q,
      count: matchedGroups.length,
      results: matchedGroups.slice(0, 100),
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Direct FDA lookup endpoint
app.get('/api/fda/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchType = req.query.type || 'name';
    
    const results = await queryDrugsAtFDA(query, searchType);
    
    if (!results) {
      return res.status(404).json({ error: 'No FDA data found.' });
    }

    res.json({
      query,
      searchType,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error('FDA lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for use as module
module.exports = {
  regulatoryAgent,
  triageAgent,
  clinicalTrialsSearch,
  fdaDrugSearch,
  orangeBookSearch,
  pubmedSearch,
  CTSchema,
  getLastToolResults: () => lastToolResults,
  resetToolResults,
  app,
  loadOrangeBookData,
};

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  loadOrangeBookData()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n🚀 Enhanced Regulatory Intelligence Agent Server v3.0`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`\n   Features:`);
        console.log(`   ✓ Complete ClinicalTrials.gov API support`);
        console.log(`   ✓ All 19 search areas fully documented`);
        console.log(`   ✓ ${CTSchema.AllSearchableFieldNames.length} searchable fields`);
        console.log(`   ✓ Hardcoded enum validation (no hallucinations)`);
        console.log(`   ✓ Full Essie expression syntax support`);
        console.log(`   ✓ Complete pagination support`);
        console.log(`\n   Search Areas:`);
        Object.keys(CTSchema.SearchAreas).forEach(name => {
          console.log(`   - ${name}`);
        });
        console.log(`\n   Endpoints:`);
        console.log(`   POST /query - Agent queries`);
        console.log(`   POST /api/clinical-trials/search - Direct CT search`);
        console.log(`   GET /api/schema - Schema reference`);
        console.log(`   GET /api/search?q=drug - Orange Book search`);
        console.log(`   GET /api/fda/:query - FDA lookup`);
        console.log(`   GET /health - Health check\n`);
      });
    })
    .catch(err => {
      console.error('Failed to load Orange Book data:', err);
      app.listen(PORT, () => {
        console.log(`\n🚀 Server started (Orange Book data not loaded)`);
        console.log(`   http://localhost:${PORT}\n`);
      });
    });
}



// /**
//  * Unified Regulatory Intelligence Agent Server
//  * 
//  * Combines three specialist agents:
//  * 1. Clinical Trials Agent - ClinicalTrials.gov API
//  * 2. FDA Agent - Drugs@FDA API
//  * 3. Orange Book Agent - Orange Book data (products, patents, exclusivities)
//  * 
//  * The Triage Agent routes queries to appropriate specialists (0, 1, 2, or all 3)
//  */

// const express = require('express');
// const cors = require('cors');
// const path = require('path');
// const fs = require('fs').promises;
// const { z } = require('zod');
// const { Agent, run, tool, setDefaultOpenAIKey, setTracingExportApiKey } = require('@openai/agents');
// require('dotenv').config();

// // Set OpenAI API key
// setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
// setTracingExportApiKey(process.env.OPENAI_API_KEY);

// const app = express();
// app.use(cors());
// app.use(express.json({ limit: '1mb' }));
// app.use(express.static(path.join(__dirname, 'public')));

// // ============================================
// // CACHES
// // ============================================
// const drugsAtFDACache = new Map();
// const orangeBookCache = new Map();

// // Store last tool results for extraction
// let lastToolResults = {
//   clinicalTrials: null,
//   fda: null,
//   orangeBook: null,
//   pubmed: null
// };

// function resetToolResults() {
//   lastToolResults = {
//     clinicalTrials: null,
//     fda: null,
//     orangeBook: null,
//     pubmed: null
//   };
// }

// // ============================================
// // ORANGE BOOK DATA (loaded at startup)
// // ============================================
// let products = [];
// let patents = [];
// let exclusivities = [];
// let productIndex = new Map();
// let patentIndex = new Map();
// let exclusivityIndex = new Map();
// let groups = new Map();

// // Orange Book helpers
// function applKey(applType, applNo, productNo) {
//   return `${(applType || '').trim()}|${(applNo || '').trim()}|${(productNo || '').trim()}`;
// }

// function groupKey(product) {
//   const ingredient = (product.Ingredient || '').toUpperCase();
//   const dfRoute = (product['DF;Route'] || '').toUpperCase();
//   const strength = (product.Strength || '').toUpperCase();
//   return `${ingredient}|${dfRoute}|${strength}`;
// }

// function isActiveProduct(product) {
//   return (product.Type || '').toUpperCase() !== 'DISCN';
// }

// function isRLD(product) {
//   return (product.RLD || '').toLowerCase() === 'yes';
// }

// function isBrandedApplication(applType) {
//   return (applType || '').toUpperCase() === 'N';
// }

// function isGenericApplication(applType) {
//   return (applType || '').toUpperCase() === 'A';
// }

// async function parseTildeFile(filename) {
//   try {
//     const filePath = path.join(__dirname, filename);
//     const raw = await fs.readFile(filePath, 'utf8');
//     const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
//     if (lines.length === 0) return [];
//     const header = lines[0].split('~').map(h => h.trim());
//     const rows = lines.slice(1);
//     return rows.map(line => {
//       const cols = line.split('~').map(c => c.trim());
//       const obj = {};
//       header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
//       return obj;
//     });
//   } catch (err) {
//     console.log(`Warning: Could not load ${filename}:`, err.message);
//     return [];
//   }
// }

// async function loadOrangeBookData() {
//   console.log('Loading Orange Book files...');
  
//   products = await parseTildeFile('products.txt');
//   patents = await parseTildeFile('patent.txt');
//   exclusivities = await parseTildeFile('exclusivity.txt');

//   console.log(`Loaded ${products.length} products, ${patents.length} patents, ${exclusivities.length} exclusivities`);

//   // Build indexes
//   productIndex = new Map();
//   for (const p of products) {
//     const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
//     productIndex.set(key, p);
//   }

//   patentIndex = new Map();
//   for (const pt of patents) {
//     const key = applKey(pt.Appl_Type, pt.Appl_No, pt.Product_No);
//     if (!patentIndex.has(key)) patentIndex.set(key, []);
//     patentIndex.get(key).push(pt);
//   }

//   exclusivityIndex = new Map();
//   for (const ex of exclusivities) {
//     const key = applKey(ex.Appl_Type, ex.Appl_No, ex.Product_No);
//     if (!exclusivityIndex.has(key)) exclusivityIndex.set(key, []);
//     exclusivityIndex.get(key).push(ex);
//   }

//   // Build groups
//   groups = new Map();
//   for (const p of products) {
//     const gKey = groupKey(p);
//     if (!gKey.trim()) continue;
//     if (!groups.has(gKey)) {
//       groups.set(gKey, {
//         key: gKey,
//         ingredient: p.Ingredient,
//         dfRoute: p['DF;Route'],
//         strength: p.Strength,
//         products: []
//       });
//     }
//     groups.get(gKey).products.push(p);
//   }

//   console.log(`Built ${groups.size} ingredient/DF/strength groups`);
// }

// // ============================================
// // FDA API HELPER
// // ============================================
// async function queryDrugsAtFDA(searchQuery, searchType = 'name') {
//   const cacheKey = `${searchType}:${searchQuery}`;
  
//   if (drugsAtFDACache.has(cacheKey)) {
//     return drugsAtFDACache.get(cacheKey);
//   }

//   try {
//     let url;
//     if (searchType === 'application') {
//       // Search by application number
//       url = `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${searchQuery}"&limit=10`;
//     } else if (searchType === 'name') {
//       // Search by brand or generic name
//       url = `https://api.fda.gov/drug/drugsfda.json?search=openfda.brand_name:"${searchQuery}"+openfda.generic_name:"${searchQuery}"&limit=20`;
//     } else if (searchType === 'ingredient') {
//       // Search by active ingredient
//       url = `https://api.fda.gov/drug/drugsfda.json?search=products.active_ingredients.name:"${searchQuery}"&limit=20`;
//     } else if (searchType === 'sponsor') {
//       // Search by sponsor
//       url = `https://api.fda.gov/drug/drugsfda.json?search=sponsor_name:"${searchQuery}"&limit=20`;
//     } else {
//       url = `https://api.fda.gov/drug/drugsfda.json?search=${encodeURIComponent(searchQuery)}&limit=20`;
//     }

//     console.log(`[FDA API] Fetching: ${url}`);
//     const response = await fetch(url);
    
//     if (!response.ok) {
//       console.log(`[FDA API] Error: ${response.status}`);
//       drugsAtFDACache.set(cacheKey, null);
//       return null;
//     }

//     const data = await response.json();
    
//     if (!data.results || data.results.length === 0) {
//       drugsAtFDACache.set(cacheKey, null);
//       return null;
//     }

//     drugsAtFDACache.set(cacheKey, data.results);
//     return data.results;
    
//   } catch (err) {
//     console.error(`[FDA API] Error:`, err.message);
//     drugsAtFDACache.set(cacheKey, null);
//     return null;
//   }
// }

// // ============================================
// // TOOL 1: CLINICAL TRIALS SEARCH
// // ============================================
// const ClinicalTrialsSearchInput = z.object({
//   query: z.string().min(1).describe('Search query - condition, intervention, keywords'),
//   pageSize: z.number().int().min(1).max(100).default(20),
//   status: z.enum(['RECRUITING', 'NOT_YET_RECRUITING', 'COMPLETED', 'ACTIVE_NOT_RECRUITING', 'TERMINATED', 'WITHDRAWN', 'SUSPENDED', 'ENROLLING_BY_INVITATION']).nullable().optional(),
//   phase: z.string().nullable().optional().describe('PHASE1, PHASE2, PHASE3, PHASE4'),
//   location: z.string().nullable().optional(),
//   sponsor: z.string().nullable().optional(),
//   condition: z.string().nullable().optional(),
//   intervention: z.string().nullable().optional(),
// });

// const clinicalTrialsSearch = tool({
//   name: 'clinical_trials_search',
//   description: `Search ClinicalTrials.gov for clinical studies. Use for:
// - Finding trials for specific conditions/diseases
// - Drug/intervention trials
// - Recruiting trials
// - Trial status and phase information
// - Sponsor-specific trials`,
//   parameters: ClinicalTrialsSearchInput,
//   async execute(input) {
//     const endpoint = 'https://clinicaltrials.gov/api/v2/studies';
//     const url = new URL(endpoint);
    
//     url.searchParams.set('query.term', input.query);
//     url.searchParams.set('pageSize', String(input.pageSize || 20));
//     url.searchParams.set('countTotal', 'true');
    
//     if (input.status) url.searchParams.set('filter.overallStatus', input.status);
//     if (input.phase) url.searchParams.set('filter.phase', input.phase);
//     if (input.location) url.searchParams.set('query.locn', input.location);
//     if (input.condition) url.searchParams.set('query.cond', input.condition);
//     if (input.intervention) url.searchParams.set('query.intr', input.intervention);
//     if (input.sponsor) url.searchParams.set('query.spons', input.sponsor);
    
//     console.log(`[ClinicalTrials] Fetching: ${url.toString()}`);
    
//     const res = await fetch(url.toString(), {
//       method: 'GET',
//       headers: { 'Accept': 'application/json' },
//     });
    
//     if (!res.ok) {
//       const text = await res.text();
//       throw new Error(`ClinicalTrials.gov API error: ${res.status} - ${text.slice(0, 200)}`);
//     }
    
//     const raw = await res.json();
//     const studies = raw?.studies || [];
//     const totalCount = raw?.totalCount;
//     const nextPageToken = raw?.nextPageToken;
    
//     const metadata = {
//       api: 'clinicaltrials.gov',
//       endpoint,
//       params: input,
//       returnedCount: studies.length,
//       totalCount,
//       nextPageToken,
//       fetchedAt: new Date().toISOString(),
//     };
    
//     lastToolResults.clinicalTrials = { metadata, raw };
    
//     const studySummaries = studies.slice(0, 10).map((study, i) => {
//       const proto = study?.protocolSection;
//       const id = proto?.identificationModule;
//       const status = proto?.statusModule;
//       const design = proto?.designModule;
//       const desc = proto?.descriptionModule;
//       const sponsor = proto?.sponsorCollaboratorsModule;
//       const conditions = proto?.conditionsModule;
      
//       return {
//         index: i + 1,
//         nctId: id?.nctId || 'N/A',
//         title: id?.briefTitle || 'Untitled',
//         status: status?.overallStatus || 'Unknown',
//         phase: design?.phases?.join(', ') || 'N/A',
//         sponsor: sponsor?.leadSponsor?.name || 'N/A',
//         conditions: conditions?.conditions?.slice(0, 3) || [],
//         briefSummary: (desc?.briefSummary || '').slice(0, 250) + '...',
//       };
//     });
    
//     return JSON.stringify({
//       metadata,
//       studies: studySummaries,
//       hasMore: !!nextPageToken,
//     }, null, 2);
//   },
// });

// // ============================================
// // TOOL 2: FDA DRUG SEARCH
// // ============================================
// const FDASearchInput = z.object({
//   query: z.string().min(1).describe('Drug name, application number, or active ingredient to search'),
//   searchType: z.enum(['name', 'application', 'ingredient', 'sponsor']).default('name').describe('Type of search: name (brand/generic), application (NDA/ANDA number), ingredient, or sponsor'),
// });

// const fdaDrugSearch = tool({
//   name: 'fda_drug_search',
//   description: `Search the FDA Drugs@FDA database. Use for:
// - Finding FDA-approved drugs by brand or generic name
// - Looking up application numbers (NDA, ANDA, BLA)
// - Finding drugs by active ingredient
// - Finding drugs by sponsor/manufacturer
// - Checking marketing status and approval dates`,
//   parameters: FDASearchInput,
//   async execute(input) {
//     console.log(`[FDA Tool] Searching: ${input.query} (type: ${input.searchType})`);
    
//     const results = await queryDrugsAtFDA(input.query, input.searchType);
    
//     if (!results || results.length === 0) {
//       lastToolResults.fda = { metadata: { query: input, found: 0 }, raw: null };
//       return JSON.stringify({
//         metadata: { query: input, found: 0 },
//         message: `No FDA drug data found for "${input.query}"`,
//         suggestion: 'Try a different search term or search type'
//       });
//     }
    
//     const metadata = {
//       api: 'drugs@fda',
//       query: input,
//       found: results.length,
//       fetchedAt: new Date().toISOString(),
//     };
    
//     lastToolResults.fda = { metadata, raw: results };
    
//     const summaries = results.slice(0, 10).map((drug, i) => {
//       const products = drug.products || [];
//       const activeProducts = products.filter(p => 
//         p.marketing_status?.toLowerCase().includes('prescription') ||
//         p.marketing_status?.toLowerCase().includes('otc')
//       );
      
//       return {
//         index: i + 1,
//         applicationNumber: drug.application_number,
//         sponsorName: drug.sponsor_name,
//         brandName: drug.openfda?.brand_name?.[0] || products[0]?.brand_name || 'N/A',
//         genericName: drug.openfda?.generic_name?.[0] || 'N/A',
//         productCount: products.length,
//         activelyMarketed: activeProducts.length,
//         submissionType: drug.submissions?.[0]?.submission_type || 'N/A',
//         approvalDate: drug.submissions?.[0]?.submission_status_date || 'N/A',
//         activeIngredients: [...new Set(products.flatMap(p => 
//           (p.active_ingredients || []).map(ai => ai.name)
//         ))].slice(0, 5),
//       };
//     });
    
//     return JSON.stringify({
//       metadata,
//       drugs: summaries,
//     }, null, 2);
//   },
// });

// // ============================================
// // TOOL 3: ORANGE BOOK SEARCH
// // ============================================
// const OrangeBookSearchInput = z.object({
//   query: z.string().min(1).describe('Drug name, ingredient, or trade name to search'),
//   includePatents: z.boolean().default(true).describe('Include patent information'),
//   includeExclusivity: z.boolean().default(true).describe('Include exclusivity information'),
//   includeGenerics: z.boolean().default(true).describe('Include generic products'),
// });

// const orangeBookSearch = tool({
//   name: 'orange_book_search',
//   description: `Search the FDA Orange Book database. Use for:
// - Finding patent information for drugs
// - Checking exclusivity periods
// - Finding generic equivalents (ANDA vs NDA)
// - Therapeutic equivalence (TE) codes
// - Reference Listed Drug (RLD) status
// - Branded vs generic product classification`,
//   parameters: OrangeBookSearchInput,
//   async execute(input) {
//     console.log(`[Orange Book] Searching: ${input.query}`);
    
//     const q = input.query.toLowerCase();
//     const matchedGroups = [];
    
//     for (const g of groups.values()) {
//       const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
//       const tradeNameMatch = g.products.some(p =>
//         (p.Trade_Name || '').toLowerCase().includes(q)
//       );
      
//       if (!ingredientMatch && !tradeNameMatch) continue;
      
//       const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
//       const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));
      
//       // Get patents and exclusivities for this group
//       let groupPatents = [];
//       let groupExclusivities = [];
      
//       if (input.includePatents) {
//         g.products.forEach(p => {
//           const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
//           const pts = patentIndex.get(key) || [];
//           groupPatents = groupPatents.concat(pts);
//         });
//       }
      
//       if (input.includeExclusivity) {
//         g.products.forEach(p => {
//           const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
//           const exs = exclusivityIndex.get(key) || [];
//           groupExclusivities = groupExclusivities.concat(exs);
//         });
//       }
      
//       matchedGroups.push({
//         ingredient: g.ingredient,
//         dfRoute: g.dfRoute,
//         strength: g.strength,
//         brandedCount: brandedProducts.length,
//         genericCount: genericProducts.length,
//         brandedProducts: brandedProducts.slice(0, 5).map(p => ({
//           applNo: `NDA${p.Appl_No}`,
//           tradeName: p.Trade_Name,
//           applicant: p.Applicant,
//           teCode: p.TE_Code,
//           rld: isRLD(p),
//           active: isActiveProduct(p),
//         })),
//         genericProducts: input.includeGenerics ? genericProducts.slice(0, 10).map(p => ({
//           applNo: `ANDA${p.Appl_No}`,
//           tradeName: p.Trade_Name,
//           applicant: p.Applicant,
//           teCode: p.TE_Code,
//           active: isActiveProduct(p),
//         })) : [],
//         patents: groupPatents.slice(0, 10).map(pt => ({
//           patentNo: pt.Patent_No,
//           expireDate: pt.Patent_Expire_Date_Text,
//           drugSubstance: pt.Drug_Substance_Flag === 'Y',
//           drugProduct: pt.Drug_Product_Flag === 'Y',
//           useCode: pt.Patent_Use_Code,
//         })),
//         exclusivities: groupExclusivities.slice(0, 10).map(ex => ({
//           code: ex.Exclusivity_Code,
//           expireDate: ex.Exclusivity_Date,
//         })),
//       });
//     }
    
//     const metadata = {
//       api: 'orange_book',
//       query: input.query,
//       found: matchedGroups.length,
//       fetchedAt: new Date().toISOString(),
//     };
    
//     lastToolResults.orangeBook = { metadata, raw: matchedGroups };
    
//     if (matchedGroups.length === 0) {
//       return JSON.stringify({
//         metadata,
//         message: `No Orange Book data found for "${input.query}"`,
//         note: 'Orange Book only contains FDA-approved drugs with therapeutic equivalence evaluations'
//       });
//     }
    
//     return JSON.stringify({
//       metadata,
//       groups: matchedGroups.slice(0, 20),
//     }, null, 2);
//   },
// });

// // ============================================
// // TOOL 4: PUBMED LITERATURE SEARCH
// // ============================================
// const PubMedSearchInput = z.object({
//   query: z.string().min(1).describe('Search query - drug names, conditions, mechanisms, authors, etc.'),
//   maxResults: z.number().int().min(1).max(50).default(20).describe('Maximum number of articles to return'),
//   dateFrom: z.string().nullable().optional().describe('Start date filter (YYYY/MM/DD or YYYY)'),
//   dateTo: z.string().nullable().optional().describe('End date filter (YYYY/MM/DD or YYYY)'),
//   articleTypes: z.array(z.string()).nullable().optional().describe('Filter by article type: Review, Clinical Trial, Meta-Analysis, etc.'),
// });

// const pubmedSearch = tool({
//   name: 'pubmed_search',
//   description: `Search PubMed for biomedical literature. Use for:
// - Finding published research on drugs, diseases, mechanisms
// - Review articles and meta-analyses
// - Clinical trial publications
// - Drug safety and efficacy studies
// - Author-specific publications
// Returns article titles, authors, journals, abstracts, PMIDs, and DOIs.`,
//   parameters: PubMedSearchInput,
//   async execute(input) {
//     console.log(`[PubMed Tool] Searching: ${input.query}`);
    
//     try {
//       // Step 1: Search for PMIDs
//       const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
//       searchUrl.searchParams.set('db', 'pubmed');
//       searchUrl.searchParams.set('term', input.query);
//       searchUrl.searchParams.set('retmax', String(input.maxResults || 20));
//       searchUrl.searchParams.set('retmode', 'json');
//       searchUrl.searchParams.set('sort', 'relevance');
      
//       // Add date filters if provided
//       if (input.dateFrom) {
//         searchUrl.searchParams.set('mindate', input.dateFrom);
//         searchUrl.searchParams.set('datetype', 'pdat');
//       }
//       if (input.dateTo) {
//         searchUrl.searchParams.set('maxdate', input.dateTo);
//         searchUrl.searchParams.set('datetype', 'pdat');
//       }
      
//       // Add article type filter if provided
//       if (input.articleTypes && input.articleTypes.length > 0) {
//         const typeFilter = input.articleTypes.map(t => `${t}[pt]`).join(' OR ');
//         searchUrl.searchParams.set('term', `(${input.query}) AND (${typeFilter})`);
//       }
      
//       console.log(`[PubMed] Search URL: ${searchUrl.toString()}`);
      
//       const searchRes = await fetch(searchUrl.toString());
//       if (!searchRes.ok) {
//         throw new Error(`PubMed search failed: ${searchRes.status}`);
//       }
      
//       const searchData = await searchRes.json();
//       const pmids = searchData?.esearchresult?.idlist || [];
//       const totalCount = parseInt(searchData?.esearchresult?.count || '0', 10);
      
//       if (pmids.length === 0) {
//         const metadata = {
//           api: 'pubmed',
//           query: input.query,
//           found: 0,
//           totalCount: 0,
//           fetchedAt: new Date().toISOString(),
//         };
//         lastToolResults.pubmed = { metadata, raw: [] };
//         return JSON.stringify({
//           metadata,
//           message: `No PubMed articles found for "${input.query}"`,
//           suggestion: 'Try broader search terms or check spelling'
//         });
//       }
      
//       // Step 2: Fetch article details using esummary
//       const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
//       summaryUrl.searchParams.set('db', 'pubmed');
//       summaryUrl.searchParams.set('id', pmids.join(','));
//       summaryUrl.searchParams.set('retmode', 'json');
      
//       const summaryRes = await fetch(summaryUrl.toString());
//       if (!summaryRes.ok) {
//         throw new Error(`PubMed summary fetch failed: ${summaryRes.status}`);
//       }
      
//       const summaryData = await summaryRes.json();
//       const articles = [];
      
//       for (const pmid of pmids) {
//         const article = summaryData?.result?.[pmid];
//         if (!article) continue;
        
//         // Extract DOI from articleids
//         const doi = article.articleids?.find(id => id.idtype === 'doi')?.value || null;
//         const pmc = article.articleids?.find(id => id.idtype === 'pmc')?.value || null;
        
//         articles.push({
//           pmid,
//           title: article.title || 'No title',
//           authors: article.authors?.slice(0, 5).map(a => a.name) || [],
//           journal: article.source || 'Unknown journal',
//           pubDate: article.pubdate || 'Unknown date',
//           volume: article.volume || '',
//           issue: article.issue || '',
//           pages: article.pages || '',
//           doi,
//           pmc,
//           pubType: article.pubtype || [],
//           abstract: '', // esummary doesn't include abstract, would need efetch
//         });
//       }
      
//       const metadata = {
//         api: 'pubmed',
//         query: input.query,
//         found: articles.length,
//         totalCount,
//         fetchedAt: new Date().toISOString(),
//       };
      
//       lastToolResults.pubmed = { metadata, raw: articles };
      
//       // Return summary for LLM
//       const articleSummaries = articles.slice(0, 10).map((a, i) => ({
//         index: i + 1,
//         pmid: a.pmid,
//         title: a.title,
//         authors: a.authors.slice(0, 3).join(', ') + (a.authors.length > 3 ? ' et al.' : ''),
//         journal: a.journal,
//         pubDate: a.pubDate,
//         doi: a.doi,
//         pubType: a.pubType.slice(0, 2),
//       }));
      
//       return JSON.stringify({
//         metadata,
//         articles: articleSummaries,
//         hasMore: totalCount > articles.length,
//         note: `Showing ${articles.length} of ${totalCount} matching articles`,
//       }, null, 2);
      
//     } catch (err) {
//       console.error('[PubMed Tool] Error:', err.message);
//       lastToolResults.pubmed = { metadata: { query: input.query, error: err.message }, raw: null };
//       return JSON.stringify({
//         error: err.message,
//         message: 'Failed to search PubMed',
//       });
//     }
//   },
// });

// // ============================================
// // UNIFIED AGENT WITH ALL TOOLS
// // ============================================

// // Single agent that can use all four tools (can call multiple in parallel)
// const regulatoryAgent = new Agent({
//   name: 'Regulatory Intelligence Agent',
//   instructions: `You are a pharmaceutical regulatory intelligence expert with access to four databases:

// 1. **clinical_trials_search** - ClinicalTrials.gov
//    - Use for: recruiting trials, trial phases, sponsors, NCT IDs, study status
//    - Parameters: query, status (RECRUITING, COMPLETED, etc.), phase (PHASE1, PHASE2, PHASE3), location, sponsor

// 2. **fda_drug_search** - FDA Drugs@FDA Database  
//    - Use for: FDA approvals, application numbers (NDA/ANDA/BLA), marketing status, sponsors
//    - Search types: 'name' (brand/generic), 'application' (NDA number), 'ingredient', 'sponsor'

// 3. **orange_book_search** - FDA Orange Book
//    - Use for: patents, exclusivity periods, generic availability, therapeutic equivalence
//    - Key: NDA = branded, ANDA = generic, TE codes = bioequivalence ratings

// 4. **pubmed_search** - PubMed Biomedical Literature
//    - Use for: published research, review articles, clinical trial results, meta-analyses
//    - Returns: article titles, authors, journals, PMIDs, DOIs
//    - Great for: mechanism of action, efficacy studies, safety data, recent publications

// IMPORTANT RULES:
// - For comprehensive queries (e.g., "full analysis of X", "tell me everything about X"), call ALL FOUR tools
// - For patent/generic questions, use orange_book_search
// - For approval/marketing status, use fda_drug_search  
// - For clinical trials/studies in progress, use clinical_trials_search
// - For published research/literature, use pubmed_search
// - You CAN and SHOULD call multiple tools in a single response when the query spans multiple areas
// - Never invent data - only report what the tools return
// - Always cite PMIDs for literature, NCT IDs for trials, application numbers for FDA drugs

// When synthesizing results from multiple sources:
// - Organize by source (Literature, Clinical Trials, FDA Status, Patent/Generic Landscape)
// - Highlight key findings from each database
// - Note any discrepancies or complementary information`,
//   tools: [clinicalTrialsSearch, fdaDrugSearch, orangeBookSearch, pubmedSearch],
// });

// // Keep specialist agents for direct use if needed
// const clinicalTrialsAgent = new Agent({
//   name: 'Clinical Trials Agent',
//   instructions: `You are an expert at searching ClinicalTrials.gov. Translate user questions into search parameters, call the tool, and summarize results with NCT IDs, status, phase, and sponsors.`,
//   tools: [clinicalTrialsSearch],
// });

// const fdaAgent = new Agent({
//   name: 'FDA Agent', 
//   instructions: `You are an expert at searching FDA Drugs@FDA. Look up drugs by name, application number, ingredient, or sponsor. Report application numbers and marketing status.`,
//   tools: [fdaDrugSearch],
// });

// const orangeBookAgent = new Agent({
//   name: 'Orange Book Agent',
//   instructions: `You are an expert at searching the FDA Orange Book. Report patent expirations, exclusivity dates, TE codes, and generic availability. NDA = branded, ANDA = generic.`,
//   tools: [orangeBookSearch],
// });

// // Use the unified agent as the main agent (no handoffs needed - it has all tools)
// const triageAgent = regulatoryAgent;

// // ============================================
// // EXPRESS ENDPOINTS
// // ============================================

// // Health check
// app.get('/health', (req, res) => {
//   res.json({ 
//     status: 'ok', 
//     timestamp: new Date().toISOString(),
//     orangeBookLoaded: products.length > 0,
//     productCount: products.length,
//     patentCount: patents.length,
//   });
// });

// // Main query endpoint
// app.post('/query', async (req, res) => {
//   try {
//     const prompt = String(req.body?.prompt ?? '').trim();
    
//     if (!prompt) {
//       return res.status(400).json({ error: 'Missing prompt' });
//     }
    
//     console.log(`\n[Query] ${prompt}`);
    
//     // Reset tool results
//     resetToolResults();
    
//     // Run the triage agent
//     const result = await run(triageAgent, prompt);
    
//     console.log(`[Result] Final output received`);
    
//     // Build response with all tool results
//     const response = {
//       response: {
//         metadata: {
//           clinicalTrials: lastToolResults.clinicalTrials?.metadata || null,
//           fda: lastToolResults.fda?.metadata || null,
//           orangeBook: lastToolResults.orangeBook?.metadata || null,
//           pubmed: lastToolResults.pubmed?.metadata || null,
//         },
//         llm: result.finalOutput ?? '',
//       },
//       raw: {
//         clinicalTrials: lastToolResults.clinicalTrials?.raw || null,
//         fda: lastToolResults.fda?.raw || null,
//         orangeBook: lastToolResults.orangeBook?.raw || null,
//         pubmed: lastToolResults.pubmed?.raw || null,
//       },
//     };
    
//     res.json(response);
    
//   } catch (err) {
//     console.error('[Error]', err);
//     res.status(500).json({
//       error: err?.message ?? 'Unknown error',
//       response: {
//         metadata: null,
//         llm: 'An error occurred while processing your request.',
//       },
//       raw: null,
//     });
//   }
// });

// // Direct Orange Book search endpoint
// app.get('/api/search', async (req, res) => {
//   try {
//     const q = (req.query.q || '').trim().toLowerCase();
//     if (!q) {
//       return res.status(400).json({ error: 'Missing query param "q".' });
//     }

//     const matchedGroups = [];

//     for (const g of groups.values()) {
//       const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
//       const tradeNameMatch = g.products.some(p =>
//         (p.Trade_Name || '').toLowerCase().includes(q)
//       );

//       if (!ingredientMatch && !tradeNameMatch) continue;

//       const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
//       const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));

//       matchedGroups.push({
//         key: g.key,
//         ingredient: g.ingredient,
//         dfRoute: g.dfRoute,
//         strength: g.strength,
//         brandedProducts: brandedProducts.map(p => ({
//           applNo: `NDA${p.Appl_No}`,
//           tradeName: p.Trade_Name,
//           applicant: p.Applicant,
//           teCode: p.TE_Code,
//           rld: isRLD(p),
//           active: isActiveProduct(p),
//         })),
//         genericProducts: genericProducts.map(p => ({
//           applNo: `ANDA${p.Appl_No}`,
//           tradeName: p.Trade_Name,
//           applicant: p.Applicant,
//           teCode: p.TE_Code,
//           active: isActiveProduct(p),
//         })),
//       });
//     }

//     res.json({
//       query: q,
//       count: matchedGroups.length,
//       results: matchedGroups.slice(0, 100),
//     });
//   } catch (err) {
//     console.error('Search error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Direct FDA lookup endpoint
// app.get('/api/fda/:query', async (req, res) => {
//   try {
//     const { query } = req.params;
//     const searchType = req.query.type || 'name';
    
//     const results = await queryDrugsAtFDA(query, searchType);
    
//     if (!results) {
//       return res.status(404).json({ error: 'No FDA data found.' });
//     }

//     res.json({
//       query,
//       searchType,
//       count: results.length,
//       results,
//     });
//   } catch (err) {
//     console.error('FDA lookup error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Serve frontend
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// // Export agents for direct use
// module.exports = {
//   regulatoryAgent,
//   triageAgent,
//   clinicalTrialsAgent,
//   fdaAgent,
//   orangeBookAgent,
//   clinicalTrialsSearch,
//   fdaDrugSearch,
//   orangeBookSearch,
//   pubmedSearch,
//   // Added for enhanced server
//   getLastToolResults: () => lastToolResults,
//   resetToolResults,
//   app,
//   loadOrangeBookData,
// };

// // ============================================
// // START SERVER (only when run directly)
// // ============================================
// const PORT = process.env.PORT || 3000;

// // Only start server if this file is run directly (not imported)
// if (require.main === module) {
//   loadOrangeBookData()
//     .then(() => {
//       app.listen(PORT, () => {
//         console.log(`\n🚀 Regulatory Intelligence Agent Server`);
//         console.log(`   http://localhost:${PORT}`);
//         console.log(`\n   POST /query - Send prompts to triage agent`);
//         console.log(`   GET /api/search?q=drug - Direct Orange Book search`);
//         console.log(`   GET /api/fda/:query - Direct FDA lookup`);
//         console.log(`   GET /health - Health check\n`);
//       });
//     })
//     .catch(err => {
//       console.error('Failed to load Orange Book data:', err);
//       // Start anyway without Orange Book data
//       app.listen(PORT, () => {
//         console.log(`\n🚀 Server started (Orange Book data not loaded)`);
//         console.log(`   http://localhost:${PORT}\n`);
//       });
//     });
// }

// // /**
// //  * Unified Regulatory Intelligence Agent Server
// //  * 
// //  * Combines three specialist agents:
// //  * 1. Clinical Trials Agent - ClinicalTrials.gov API
// //  * 2. FDA Agent - Drugs@FDA API
// //  * 3. Orange Book Agent - Orange Book data (products, patents, exclusivities)
// //  * 
// //  * The Triage Agent routes queries to appropriate specialists (0, 1, 2, or all 3)
// //  */

// // const express = require('express');
// // const cors = require('cors');
// // const path = require('path');
// // const fs = require('fs').promises;
// // const { z } = require('zod');
// // const { Agent, run, tool, setDefaultOpenAIKey, setTracingExportApiKey } = require('@openai/agents');
// // require('dotenv').config();

// // // Set OpenAI API key
// // setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
// // setTracingExportApiKey(process.env.OPENAI_API_KEY);

// // const app = express();
// // app.use(cors());
// // app.use(express.json({ limit: '1mb' }));
// // app.use(express.static(path.join(__dirname, 'public')));

// // // ============================================
// // // CACHES
// // // ============================================
// // const drugsAtFDACache = new Map();
// // const orangeBookCache = new Map();

// // // Store last tool results for extraction
// // let lastToolResults = {
// //   clinicalTrials: null,
// //   fda: null,
// //   orangeBook: null,
// //   pubmed: null
// // };

// // function resetToolResults() {
// //   lastToolResults = {
// //     clinicalTrials: null,
// //     fda: null,
// //     orangeBook: null,
// //     pubmed: null
// //   };
// // }

// // // ============================================
// // // ORANGE BOOK DATA (loaded at startup)
// // // ============================================
// // let products = [];
// // let patents = [];
// // let exclusivities = [];
// // let productIndex = new Map();
// // let patentIndex = new Map();
// // let exclusivityIndex = new Map();
// // let groups = new Map();

// // // Orange Book helpers
// // function applKey(applType, applNo, productNo) {
// //   return `${(applType || '').trim()}|${(applNo || '').trim()}|${(productNo || '').trim()}`;
// // }

// // function groupKey(product) {
// //   const ingredient = (product.Ingredient || '').toUpperCase();
// //   const dfRoute = (product['DF;Route'] || '').toUpperCase();
// //   const strength = (product.Strength || '').toUpperCase();
// //   return `${ingredient}|${dfRoute}|${strength}`;
// // }

// // function isActiveProduct(product) {
// //   return (product.Type || '').toUpperCase() !== 'DISCN';
// // }

// // function isRLD(product) {
// //   return (product.RLD || '').toLowerCase() === 'yes';
// // }

// // function isBrandedApplication(applType) {
// //   return (applType || '').toUpperCase() === 'N';
// // }

// // function isGenericApplication(applType) {
// //   return (applType || '').toUpperCase() === 'A';
// // }

// // async function parseTildeFile(filename) {
// //   try {
// //     const filePath = path.join(__dirname, filename);
// //     const raw = await fs.readFile(filePath, 'utf8');
// //     const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
// //     if (lines.length === 0) return [];
// //     const header = lines[0].split('~').map(h => h.trim());
// //     const rows = lines.slice(1);
// //     return rows.map(line => {
// //       const cols = line.split('~').map(c => c.trim());
// //       const obj = {};
// //       header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
// //       return obj;
// //     });
// //   } catch (err) {
// //     console.log(`Warning: Could not load ${filename}:`, err.message);
// //     return [];
// //   }
// // }

// // async function loadOrangeBookData() {
// //   console.log('Loading Orange Book files...');
  
// //   products = await parseTildeFile('products.txt');
// //   patents = await parseTildeFile('patent.txt');
// //   exclusivities = await parseTildeFile('exclusivity.txt');

// //   console.log(`Loaded ${products.length} products, ${patents.length} patents, ${exclusivities.length} exclusivities`);

// //   // Build indexes
// //   productIndex = new Map();
// //   for (const p of products) {
// //     const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
// //     productIndex.set(key, p);
// //   }

// //   patentIndex = new Map();
// //   for (const pt of patents) {
// //     const key = applKey(pt.Appl_Type, pt.Appl_No, pt.Product_No);
// //     if (!patentIndex.has(key)) patentIndex.set(key, []);
// //     patentIndex.get(key).push(pt);
// //   }

// //   exclusivityIndex = new Map();
// //   for (const ex of exclusivities) {
// //     const key = applKey(ex.Appl_Type, ex.Appl_No, ex.Product_No);
// //     if (!exclusivityIndex.has(key)) exclusivityIndex.set(key, []);
// //     exclusivityIndex.get(key).push(ex);
// //   }

// //   // Build groups
// //   groups = new Map();
// //   for (const p of products) {
// //     const gKey = groupKey(p);
// //     if (!gKey.trim()) continue;
// //     if (!groups.has(gKey)) {
// //       groups.set(gKey, {
// //         key: gKey,
// //         ingredient: p.Ingredient,
// //         dfRoute: p['DF;Route'],
// //         strength: p.Strength,
// //         products: []
// //       });
// //     }
// //     groups.get(gKey).products.push(p);
// //   }

// //   console.log(`Built ${groups.size} ingredient/DF/strength groups`);
// // }

// // // ============================================
// // // FDA API HELPER
// // // ============================================
// // async function queryDrugsAtFDA(searchQuery, searchType = 'name') {
// //   const cacheKey = `${searchType}:${searchQuery}`;
  
// //   if (drugsAtFDACache.has(cacheKey)) {
// //     return drugsAtFDACache.get(cacheKey);
// //   }

// //   try {
// //     let url;
// //     if (searchType === 'application') {
// //       // Search by application number
// //       url = `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${searchQuery}"&limit=10`;
// //     } else if (searchType === 'name') {
// //       // Search by brand or generic name
// //       url = `https://api.fda.gov/drug/drugsfda.json?search=openfda.brand_name:"${searchQuery}"+openfda.generic_name:"${searchQuery}"&limit=20`;
// //     } else if (searchType === 'ingredient') {
// //       // Search by active ingredient
// //       url = `https://api.fda.gov/drug/drugsfda.json?search=products.active_ingredients.name:"${searchQuery}"&limit=20`;
// //     } else if (searchType === 'sponsor') {
// //       // Search by sponsor
// //       url = `https://api.fda.gov/drug/drugsfda.json?search=sponsor_name:"${searchQuery}"&limit=20`;
// //     } else {
// //       url = `https://api.fda.gov/drug/drugsfda.json?search=${encodeURIComponent(searchQuery)}&limit=20`;
// //     }

// //     console.log(`[FDA API] Fetching: ${url}`);
// //     const response = await fetch(url);
    
// //     if (!response.ok) {
// //       console.log(`[FDA API] Error: ${response.status}`);
// //       drugsAtFDACache.set(cacheKey, null);
// //       return null;
// //     }

// //     const data = await response.json();
    
// //     if (!data.results || data.results.length === 0) {
// //       drugsAtFDACache.set(cacheKey, null);
// //       return null;
// //     }

// //     drugsAtFDACache.set(cacheKey, data.results);
// //     return data.results;
    
// //   } catch (err) {
// //     console.error(`[FDA API] Error:`, err.message);
// //     drugsAtFDACache.set(cacheKey, null);
// //     return null;
// //   }
// // }

// // // ============================================
// // // TOOL 1: CLINICAL TRIALS SEARCH
// // // ============================================
// // const ClinicalTrialsSearchInput = z.object({
// //   query: z.string().min(1).describe('Search query - condition, intervention, keywords'),
// //   pageSize: z.number().int().min(1).max(100).default(20),
// //   status: z.enum(['RECRUITING', 'NOT_YET_RECRUITING', 'COMPLETED', 'ACTIVE_NOT_RECRUITING', 'TERMINATED', 'WITHDRAWN', 'SUSPENDED', 'ENROLLING_BY_INVITATION']).nullable().optional(),
// //   phase: z.string().nullable().optional().describe('PHASE1, PHASE2, PHASE3, PHASE4'),
// //   location: z.string().nullable().optional(),
// //   sponsor: z.string().nullable().optional(),
// //   condition: z.string().nullable().optional(),
// //   intervention: z.string().nullable().optional(),
// // });

// // const clinicalTrialsSearch = tool({
// //   name: 'clinical_trials_search',
// //   description: `Search ClinicalTrials.gov for clinical studies. Use for:
// // - Finding trials for specific conditions/diseases
// // - Drug/intervention trials
// // - Recruiting trials
// // - Trial status and phase information
// // - Sponsor-specific trials`,
// //   parameters: ClinicalTrialsSearchInput,
// //   async execute(input) {
// //     const endpoint = 'https://clinicaltrials.gov/api/v2/studies';
// //     const url = new URL(endpoint);
    
// //     url.searchParams.set('query.term', input.query);
// //     url.searchParams.set('pageSize', String(input.pageSize || 20));
// //     url.searchParams.set('countTotal', 'true');
    
// //     if (input.status) url.searchParams.set('filter.overallStatus', input.status);
// //     if (input.phase) url.searchParams.set('filter.phase', input.phase);
// //     if (input.location) url.searchParams.set('query.locn', input.location);
// //     if (input.condition) url.searchParams.set('query.cond', input.condition);
// //     if (input.intervention) url.searchParams.set('query.intr', input.intervention);
// //     if (input.sponsor) url.searchParams.set('query.spons', input.sponsor);
    
// //     console.log(`[ClinicalTrials] Fetching: ${url.toString()}`);
    
// //     const res = await fetch(url.toString(), {
// //       method: 'GET',
// //       headers: { 'Accept': 'application/json' },
// //     });
    
// //     if (!res.ok) {
// //       const text = await res.text();
// //       throw new Error(`ClinicalTrials.gov API error: ${res.status} - ${text.slice(0, 200)}`);
// //     }
    
// //     const raw = await res.json();
// //     const studies = raw?.studies || [];
// //     const totalCount = raw?.totalCount;
// //     const nextPageToken = raw?.nextPageToken;
    
// //     const metadata = {
// //       api: 'clinicaltrials.gov',
// //       endpoint,
// //       params: input,
// //       returnedCount: studies.length,
// //       totalCount,
// //       nextPageToken,
// //       fetchedAt: new Date().toISOString(),
// //     };
    
// //     lastToolResults.clinicalTrials = { metadata, raw };
    
// //     const studySummaries = studies.slice(0, 10).map((study, i) => {
// //       const proto = study?.protocolSection;
// //       const id = proto?.identificationModule;
// //       const status = proto?.statusModule;
// //       const design = proto?.designModule;
// //       const desc = proto?.descriptionModule;
// //       const sponsor = proto?.sponsorCollaboratorsModule;
// //       const conditions = proto?.conditionsModule;
      
// //       return {
// //         index: i + 1,
// //         nctId: id?.nctId || 'N/A',
// //         title: id?.briefTitle || 'Untitled',
// //         status: status?.overallStatus || 'Unknown',
// //         phase: design?.phases?.join(', ') || 'N/A',
// //         sponsor: sponsor?.leadSponsor?.name || 'N/A',
// //         conditions: conditions?.conditions?.slice(0, 3) || [],
// //         briefSummary: (desc?.briefSummary || '').slice(0, 250) + '...',
// //       };
// //     });
    
// //     return JSON.stringify({
// //       metadata,
// //       studies: studySummaries,
// //       hasMore: !!nextPageToken,
// //     }, null, 2);
// //   },
// // });

// // // ============================================
// // // TOOL 2: FDA DRUG SEARCH
// // // ============================================
// // const FDASearchInput = z.object({
// //   query: z.string().min(1).describe('Drug name, application number, or active ingredient to search'),
// //   searchType: z.enum(['name', 'application', 'ingredient', 'sponsor']).default('name').describe('Type of search: name (brand/generic), application (NDA/ANDA number), ingredient, or sponsor'),
// // });

// // const fdaDrugSearch = tool({
// //   name: 'fda_drug_search',
// //   description: `Search the FDA Drugs@FDA database. Use for:
// // - Finding FDA-approved drugs by brand or generic name
// // - Looking up application numbers (NDA, ANDA, BLA)
// // - Finding drugs by active ingredient
// // - Finding drugs by sponsor/manufacturer
// // - Checking marketing status and approval dates`,
// //   parameters: FDASearchInput,
// //   async execute(input) {
// //     console.log(`[FDA Tool] Searching: ${input.query} (type: ${input.searchType})`);
    
// //     const results = await queryDrugsAtFDA(input.query, input.searchType);
    
// //     if (!results || results.length === 0) {
// //       lastToolResults.fda = { metadata: { query: input, found: 0 }, raw: null };
// //       return JSON.stringify({
// //         metadata: { query: input, found: 0 },
// //         message: `No FDA drug data found for "${input.query}"`,
// //         suggestion: 'Try a different search term or search type'
// //       });
// //     }
    
// //     const metadata = {
// //       api: 'drugs@fda',
// //       query: input,
// //       found: results.length,
// //       fetchedAt: new Date().toISOString(),
// //     };
    
// //     lastToolResults.fda = { metadata, raw: results };
    
// //     const summaries = results.slice(0, 10).map((drug, i) => {
// //       const products = drug.products || [];
// //       const activeProducts = products.filter(p => 
// //         p.marketing_status?.toLowerCase().includes('prescription') ||
// //         p.marketing_status?.toLowerCase().includes('otc')
// //       );
      
// //       return {
// //         index: i + 1,
// //         applicationNumber: drug.application_number,
// //         sponsorName: drug.sponsor_name,
// //         brandName: drug.openfda?.brand_name?.[0] || products[0]?.brand_name || 'N/A',
// //         genericName: drug.openfda?.generic_name?.[0] || 'N/A',
// //         productCount: products.length,
// //         activelyMarketed: activeProducts.length,
// //         submissionType: drug.submissions?.[0]?.submission_type || 'N/A',
// //         approvalDate: drug.submissions?.[0]?.submission_status_date || 'N/A',
// //         activeIngredients: [...new Set(products.flatMap(p => 
// //           (p.active_ingredients || []).map(ai => ai.name)
// //         ))].slice(0, 5),
// //       };
// //     });
    
// //     return JSON.stringify({
// //       metadata,
// //       drugs: summaries,
// //     }, null, 2);
// //   },
// // });

// // // ============================================
// // // TOOL 3: ORANGE BOOK SEARCH
// // // ============================================
// // const OrangeBookSearchInput = z.object({
// //   query: z.string().min(1).describe('Drug name, ingredient, or trade name to search'),
// //   includePatents: z.boolean().default(true).describe('Include patent information'),
// //   includeExclusivity: z.boolean().default(true).describe('Include exclusivity information'),
// //   includeGenerics: z.boolean().default(true).describe('Include generic products'),
// // });

// // const orangeBookSearch = tool({
// //   name: 'orange_book_search',
// //   description: `Search the FDA Orange Book database. Use for:
// // - Finding patent information for drugs
// // - Checking exclusivity periods
// // - Finding generic equivalents (ANDA vs NDA)
// // - Therapeutic equivalence (TE) codes
// // - Reference Listed Drug (RLD) status
// // - Branded vs generic product classification`,
// //   parameters: OrangeBookSearchInput,
// //   async execute(input) {
// //     console.log(`[Orange Book] Searching: ${input.query}`);
    
// //     const q = input.query.toLowerCase();
// //     const matchedGroups = [];
    
// //     for (const g of groups.values()) {
// //       const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
// //       const tradeNameMatch = g.products.some(p =>
// //         (p.Trade_Name || '').toLowerCase().includes(q)
// //       );
      
// //       if (!ingredientMatch && !tradeNameMatch) continue;
      
// //       const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
// //       const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));
      
// //       // Get patents and exclusivities for this group
// //       let groupPatents = [];
// //       let groupExclusivities = [];
      
// //       if (input.includePatents) {
// //         g.products.forEach(p => {
// //           const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
// //           const pts = patentIndex.get(key) || [];
// //           groupPatents = groupPatents.concat(pts);
// //         });
// //       }
      
// //       if (input.includeExclusivity) {
// //         g.products.forEach(p => {
// //           const key = applKey(p.Appl_Type, p.Appl_No, p.Product_No);
// //           const exs = exclusivityIndex.get(key) || [];
// //           groupExclusivities = groupExclusivities.concat(exs);
// //         });
// //       }
      
// //       matchedGroups.push({
// //         ingredient: g.ingredient,
// //         dfRoute: g.dfRoute,
// //         strength: g.strength,
// //         brandedCount: brandedProducts.length,
// //         genericCount: genericProducts.length,
// //         brandedProducts: brandedProducts.slice(0, 5).map(p => ({
// //           applNo: `NDA${p.Appl_No}`,
// //           tradeName: p.Trade_Name,
// //           applicant: p.Applicant,
// //           teCode: p.TE_Code,
// //           rld: isRLD(p),
// //           active: isActiveProduct(p),
// //         })),
// //         genericProducts: input.includeGenerics ? genericProducts.slice(0, 10).map(p => ({
// //           applNo: `ANDA${p.Appl_No}`,
// //           tradeName: p.Trade_Name,
// //           applicant: p.Applicant,
// //           teCode: p.TE_Code,
// //           active: isActiveProduct(p),
// //         })) : [],
// //         patents: groupPatents.slice(0, 10).map(pt => ({
// //           patentNo: pt.Patent_No,
// //           expireDate: pt.Patent_Expire_Date_Text,
// //           drugSubstance: pt.Drug_Substance_Flag === 'Y',
// //           drugProduct: pt.Drug_Product_Flag === 'Y',
// //           useCode: pt.Patent_Use_Code,
// //         })),
// //         exclusivities: groupExclusivities.slice(0, 10).map(ex => ({
// //           code: ex.Exclusivity_Code,
// //           expireDate: ex.Exclusivity_Date,
// //         })),
// //       });
// //     }
    
// //     const metadata = {
// //       api: 'orange_book',
// //       query: input.query,
// //       found: matchedGroups.length,
// //       fetchedAt: new Date().toISOString(),
// //     };
    
// //     lastToolResults.orangeBook = { metadata, raw: matchedGroups };
    
// //     if (matchedGroups.length === 0) {
// //       return JSON.stringify({
// //         metadata,
// //         message: `No Orange Book data found for "${input.query}"`,
// //         note: 'Orange Book only contains FDA-approved drugs with therapeutic equivalence evaluations'
// //       });
// //     }
    
// //     return JSON.stringify({
// //       metadata,
// //       groups: matchedGroups.slice(0, 20),
// //     }, null, 2);
// //   },
// // });

// // // ============================================
// // // TOOL 4: PUBMED LITERATURE SEARCH
// // // ============================================
// // const PubMedSearchInput = z.object({
// //   query: z.string().min(1).describe('Search query - drug names, conditions, mechanisms, authors, etc.'),
// //   maxResults: z.number().int().min(1).max(50).default(20).describe('Maximum number of articles to return'),
// //   dateFrom: z.string().nullable().optional().describe('Start date filter (YYYY/MM/DD or YYYY)'),
// //   dateTo: z.string().nullable().optional().describe('End date filter (YYYY/MM/DD or YYYY)'),
// //   articleTypes: z.array(z.string()).nullable().optional().describe('Filter by article type: Review, Clinical Trial, Meta-Analysis, etc.'),
// // });

// // const pubmedSearch = tool({
// //   name: 'pubmed_search',
// //   description: `Search PubMed for biomedical literature. Use for:
// // - Finding published research on drugs, diseases, mechanisms
// // - Review articles and meta-analyses
// // - Clinical trial publications
// // - Drug safety and efficacy studies
// // - Author-specific publications
// // Returns article titles, authors, journals, abstracts, PMIDs, and DOIs.`,
// //   parameters: PubMedSearchInput,
// //   async execute(input) {
// //     console.log(`[PubMed Tool] Searching: ${input.query}`);
    
// //     try {
// //       // Step 1: Search for PMIDs
// //       const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
// //       searchUrl.searchParams.set('db', 'pubmed');
// //       searchUrl.searchParams.set('term', input.query);
// //       searchUrl.searchParams.set('retmax', String(input.maxResults || 20));
// //       searchUrl.searchParams.set('retmode', 'json');
// //       searchUrl.searchParams.set('sort', 'relevance');
      
// //       // Add date filters if provided
// //       if (input.dateFrom) {
// //         searchUrl.searchParams.set('mindate', input.dateFrom);
// //         searchUrl.searchParams.set('datetype', 'pdat');
// //       }
// //       if (input.dateTo) {
// //         searchUrl.searchParams.set('maxdate', input.dateTo);
// //         searchUrl.searchParams.set('datetype', 'pdat');
// //       }
      
// //       // Add article type filter if provided
// //       if (input.articleTypes && input.articleTypes.length > 0) {
// //         const typeFilter = input.articleTypes.map(t => `${t}[pt]`).join(' OR ');
// //         searchUrl.searchParams.set('term', `(${input.query}) AND (${typeFilter})`);
// //       }
      
// //       console.log(`[PubMed] Search URL: ${searchUrl.toString()}`);
      
// //       const searchRes = await fetch(searchUrl.toString());
// //       if (!searchRes.ok) {
// //         throw new Error(`PubMed search failed: ${searchRes.status}`);
// //       }
      
// //       const searchData = await searchRes.json();
// //       const pmids = searchData?.esearchresult?.idlist || [];
// //       const totalCount = parseInt(searchData?.esearchresult?.count || '0', 10);
      
// //       if (pmids.length === 0) {
// //         const metadata = {
// //           api: 'pubmed',
// //           query: input.query,
// //           found: 0,
// //           totalCount: 0,
// //           fetchedAt: new Date().toISOString(),
// //         };
// //         lastToolResults.pubmed = { metadata, raw: [] };
// //         return JSON.stringify({
// //           metadata,
// //           message: `No PubMed articles found for "${input.query}"`,
// //           suggestion: 'Try broader search terms or check spelling'
// //         });
// //       }
      
// //       // Step 2: Fetch article details using esummary
// //       const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
// //       summaryUrl.searchParams.set('db', 'pubmed');
// //       summaryUrl.searchParams.set('id', pmids.join(','));
// //       summaryUrl.searchParams.set('retmode', 'json');
      
// //       const summaryRes = await fetch(summaryUrl.toString());
// //       if (!summaryRes.ok) {
// //         throw new Error(`PubMed summary fetch failed: ${summaryRes.status}`);
// //       }
      
// //       const summaryData = await summaryRes.json();
// //       const articles = [];
      
// //       for (const pmid of pmids) {
// //         const article = summaryData?.result?.[pmid];
// //         if (!article) continue;
        
// //         // Extract DOI from articleids
// //         const doi = article.articleids?.find(id => id.idtype === 'doi')?.value || null;
// //         const pmc = article.articleids?.find(id => id.idtype === 'pmc')?.value || null;
        
// //         articles.push({
// //           pmid,
// //           title: article.title || 'No title',
// //           authors: article.authors?.slice(0, 5).map(a => a.name) || [],
// //           journal: article.source || 'Unknown journal',
// //           pubDate: article.pubdate || 'Unknown date',
// //           volume: article.volume || '',
// //           issue: article.issue || '',
// //           pages: article.pages || '',
// //           doi,
// //           pmc,
// //           pubType: article.pubtype || [],
// //           abstract: '', // esummary doesn't include abstract, would need efetch
// //         });
// //       }
      
// //       const metadata = {
// //         api: 'pubmed',
// //         query: input.query,
// //         found: articles.length,
// //         totalCount,
// //         fetchedAt: new Date().toISOString(),
// //       };
      
// //       lastToolResults.pubmed = { metadata, raw: articles };
      
// //       // Return summary for LLM
// //       const articleSummaries = articles.slice(0, 10).map((a, i) => ({
// //         index: i + 1,
// //         pmid: a.pmid,
// //         title: a.title,
// //         authors: a.authors.slice(0, 3).join(', ') + (a.authors.length > 3 ? ' et al.' : ''),
// //         journal: a.journal,
// //         pubDate: a.pubDate,
// //         doi: a.doi,
// //         pubType: a.pubType.slice(0, 2),
// //       }));
      
// //       return JSON.stringify({
// //         metadata,
// //         articles: articleSummaries,
// //         hasMore: totalCount > articles.length,
// //         note: `Showing ${articles.length} of ${totalCount} matching articles`,
// //       }, null, 2);
      
// //     } catch (err) {
// //       console.error('[PubMed Tool] Error:', err.message);
// //       lastToolResults.pubmed = { metadata: { query: input.query, error: err.message }, raw: null };
// //       return JSON.stringify({
// //         error: err.message,
// //         message: 'Failed to search PubMed',
// //       });
// //     }
// //   },
// // });

// // // ============================================
// // // UNIFIED AGENT WITH ALL TOOLS
// // // ============================================

// // // Single agent that can use all four tools (can call multiple in parallel)
// // const regulatoryAgent = new Agent({
// //   name: 'Regulatory Intelligence Agent',
// //   instructions: `You are a pharmaceutical regulatory intelligence expert with access to four databases:

// // 1. **clinical_trials_search** - ClinicalTrials.gov
// //    - Use for: recruiting trials, trial phases, sponsors, NCT IDs, study status
// //    - Parameters: query, status (RECRUITING, COMPLETED, etc.), phase (PHASE1, PHASE2, PHASE3), location, sponsor

// // 2. **fda_drug_search** - FDA Drugs@FDA Database  
// //    - Use for: FDA approvals, application numbers (NDA/ANDA/BLA), marketing status, sponsors
// //    - Search types: 'name' (brand/generic), 'application' (NDA number), 'ingredient', 'sponsor'

// // 3. **orange_book_search** - FDA Orange Book
// //    - Use for: patents, exclusivity periods, generic availability, therapeutic equivalence
// //    - Key: NDA = branded, ANDA = generic, TE codes = bioequivalence ratings

// // 4. **pubmed_search** - PubMed Biomedical Literature
// //    - Use for: published research, review articles, clinical trial results, meta-analyses
// //    - Returns: article titles, authors, journals, PMIDs, DOIs
// //    - Great for: mechanism of action, efficacy studies, safety data, recent publications

// // IMPORTANT RULES:
// // - For comprehensive queries (e.g., "full analysis of X", "tell me everything about X"), call ALL FOUR tools
// // - For patent/generic questions, use orange_book_search
// // - For approval/marketing status, use fda_drug_search  
// // - For clinical trials/studies in progress, use clinical_trials_search
// // - For published research/literature, use pubmed_search
// // - You CAN and SHOULD call multiple tools in a single response when the query spans multiple areas
// // - Never invent data - only report what the tools return
// // - Always cite PMIDs for literature, NCT IDs for trials, application numbers for FDA drugs

// // When synthesizing results from multiple sources:
// // - Organize by source (Literature, Clinical Trials, FDA Status, Patent/Generic Landscape)
// // - Highlight key findings from each database
// // - Note any discrepancies or complementary information`,
// //   tools: [clinicalTrialsSearch, fdaDrugSearch, orangeBookSearch, pubmedSearch],
// // });

// // // Keep specialist agents for direct use if needed
// // const clinicalTrialsAgent = new Agent({
// //   name: 'Clinical Trials Agent',
// //   instructions: `You are an expert at searching ClinicalTrials.gov. Translate user questions into search parameters, call the tool, and summarize results with NCT IDs, status, phase, and sponsors.`,
// //   tools: [clinicalTrialsSearch],
// // });

// // const fdaAgent = new Agent({
// //   name: 'FDA Agent', 
// //   instructions: `You are an expert at searching FDA Drugs@FDA. Look up drugs by name, application number, ingredient, or sponsor. Report application numbers and marketing status.`,
// //   tools: [fdaDrugSearch],
// // });

// // const orangeBookAgent = new Agent({
// //   name: 'Orange Book Agent',
// //   instructions: `You are an expert at searching the FDA Orange Book. Report patent expirations, exclusivity dates, TE codes, and generic availability. NDA = branded, ANDA = generic.`,
// //   tools: [orangeBookSearch],
// // });

// // // Use the unified agent as the main agent (no handoffs needed - it has all tools)
// // const triageAgent = regulatoryAgent;

// // // ============================================
// // // EXPRESS ENDPOINTS
// // // ============================================

// // // Health check
// // app.get('/health', (req, res) => {
// //   res.json({ 
// //     status: 'ok', 
// //     timestamp: new Date().toISOString(),
// //     orangeBookLoaded: products.length > 0,
// //     productCount: products.length,
// //     patentCount: patents.length,
// //   });
// // });

// // // Main query endpoint
// // app.post('/query', async (req, res) => {
// //   try {
// //     const prompt = String(req.body?.prompt ?? '').trim();
    
// //     if (!prompt) {
// //       return res.status(400).json({ error: 'Missing prompt' });
// //     }
    
// //     console.log(`\n[Query] ${prompt}`);
    
// //     // Reset tool results
// //     resetToolResults();
    
// //     // Run the triage agent
// //     const result = await run(triageAgent, prompt);
    
// //     console.log(`[Result] Final output received`);
    
// //     // Build response with all tool results
// //     const response = {
// //       response: {
// //         metadata: {
// //           clinicalTrials: lastToolResults.clinicalTrials?.metadata || null,
// //           fda: lastToolResults.fda?.metadata || null,
// //           orangeBook: lastToolResults.orangeBook?.metadata || null,
// //           pubmed: lastToolResults.pubmed?.metadata || null,
// //         },
// //         llm: result.finalOutput ?? '',
// //       },
// //       raw: {
// //         clinicalTrials: lastToolResults.clinicalTrials?.raw || null,
// //         fda: lastToolResults.fda?.raw || null,
// //         orangeBook: lastToolResults.orangeBook?.raw || null,
// //         pubmed: lastToolResults.pubmed?.raw || null,
// //       },
// //     };
    
// //     res.json(response);
    
// //   } catch (err) {
// //     console.error('[Error]', err);
// //     res.status(500).json({
// //       error: err?.message ?? 'Unknown error',
// //       response: {
// //         metadata: null,
// //         llm: 'An error occurred while processing your request.',
// //       },
// //       raw: null,
// //     });
// //   }
// // });

// // // Direct Orange Book search endpoint
// // app.get('/api/search', async (req, res) => {
// //   try {
// //     const q = (req.query.q || '').trim().toLowerCase();
// //     if (!q) {
// //       return res.status(400).json({ error: 'Missing query param "q".' });
// //     }

// //     const matchedGroups = [];

// //     for (const g of groups.values()) {
// //       const ingredientMatch = (g.ingredient || '').toLowerCase().includes(q);
// //       const tradeNameMatch = g.products.some(p =>
// //         (p.Trade_Name || '').toLowerCase().includes(q)
// //       );

// //       if (!ingredientMatch && !tradeNameMatch) continue;

// //       const brandedProducts = g.products.filter(p => isBrandedApplication(p.Appl_Type));
// //       const genericProducts = g.products.filter(p => isGenericApplication(p.Appl_Type));

// //       matchedGroups.push({
// //         key: g.key,
// //         ingredient: g.ingredient,
// //         dfRoute: g.dfRoute,
// //         strength: g.strength,
// //         brandedProducts: brandedProducts.map(p => ({
// //           applNo: `NDA${p.Appl_No}`,
// //           tradeName: p.Trade_Name,
// //           applicant: p.Applicant,
// //           teCode: p.TE_Code,
// //           rld: isRLD(p),
// //           active: isActiveProduct(p),
// //         })),
// //         genericProducts: genericProducts.map(p => ({
// //           applNo: `ANDA${p.Appl_No}`,
// //           tradeName: p.Trade_Name,
// //           applicant: p.Applicant,
// //           teCode: p.TE_Code,
// //           active: isActiveProduct(p),
// //         })),
// //       });
// //     }

// //     res.json({
// //       query: q,
// //       count: matchedGroups.length,
// //       results: matchedGroups.slice(0, 100),
// //     });
// //   } catch (err) {
// //     console.error('Search error:', err);
// //     res.status(500).json({ error: 'Internal server error' });
// //   }
// // });

// // // Direct FDA lookup endpoint
// // app.get('/api/fda/:query', async (req, res) => {
// //   try {
// //     const { query } = req.params;
// //     const searchType = req.query.type || 'name';
    
// //     const results = await queryDrugsAtFDA(query, searchType);
    
// //     if (!results) {
// //       return res.status(404).json({ error: 'No FDA data found.' });
// //     }

// //     res.json({
// //       query,
// //       searchType,
// //       count: results.length,
// //       results,
// //     });
// //   } catch (err) {
// //     console.error('FDA lookup error:', err);
// //     res.status(500).json({ error: 'Internal server error' });
// //   }
// // });

// // // Serve frontend
// // app.get('/', (req, res) => {
// //   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// // });

// // // Export agents for direct use
// // module.exports = {
// //   regulatoryAgent,
// //   triageAgent,
// //   clinicalTrialsAgent,
// //   fdaAgent,
// //   orangeBookAgent,
// //   clinicalTrialsSearch,
// //   fdaDrugSearch,
// //   orangeBookSearch,
// //   pubmedSearch,
// // };

// // // ============================================
// // // START SERVER
// // // ============================================
// // const PORT = process.env.PORT || 3000;

// // loadOrangeBookData()
// //   .then(() => {
// //     app.listen(PORT, () => {
// //       console.log(`\n🚀 Regulatory Intelligence Agent Server`);
// //       console.log(`   http://localhost:${PORT}`);
// //       console.log(`\n   POST /query - Send prompts to triage agent`);
// //       console.log(`   GET /api/search?q=drug - Direct Orange Book search`);
// //       console.log(`   GET /api/fda/:query - Direct FDA lookup`);
// //       console.log(`   GET /health - Health check\n`);
// //     });
// //   })
// //   .catch(err => {
// //     console.error('Failed to load Orange Book data:', err);
// //     // Start anyway without Orange Book data
// //     app.listen(PORT, () => {
// //       console.log(`\n🚀 Server started (Orange Book data not loaded)`);
// //       console.log(`   http://localhost:${PORT}\n`);
// //     });
// //   });
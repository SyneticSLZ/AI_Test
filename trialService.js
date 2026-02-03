/**
 * Clinical Trials Service
 * Interacts with ClinicalTrials.gov API v2
 * Searches trials and extracts intervention/procedure information
 */

const CLINICALTRIALS_API_BASE = 'https://clinicaltrials.gov/api/v2';

/**
 * Search for clinical trials by condition/indication
 */
async function searchTrials(query, options = {}) {
  const {
    status = ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING'],
    pageSize = 20,
    pageToken = null,
    phase = null,
    interventionType = null,
  } = options;

  try {
    const params = new URLSearchParams({
      format: 'json',
      pageSize: String(pageSize),
      countTotal: 'true',
      'query.cond': query,
      fields: [
        'NCTId',
        'BriefTitle',
        'OfficialTitle',
        'OverallStatus',
        'Phase',
        'StudyType',
        'EnrollmentCount',
        'StartDate',
        'CompletionDate',
        'LeadSponsorName',
        'Condition',
        'InterventionType',
        'InterventionName',
        'InterventionDescription',
        'EligibilityCriteria',
        'MinimumAge',
        'MaximumAge',
        'Sex',
        'HealthyVolunteers',
        'LocationCity',
        'LocationState',
        'LocationCountry',
        'LocationFacility',
        'PrimaryOutcomeMeasure',
        'SecondaryOutcomeMeasure',
      ].join(','),
    });

    // Add status filter
    if (status && status.length > 0) {
      params.set('filter.overallStatus', status.join(','));
    }

    // Add page token for pagination
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${CLINICALTRIALS_API_BASE}/studies?${params.toString()}`;
    console.log(`[Trials API] Searching: ${url.slice(0, 150)}...`);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClinicalTrials.gov API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Transform the studies
    const trials = (data.studies || []).map(transformTrialRecord);

    return {
      success: true,
      trials,
      totalCount: data.totalCount || trials.length,
      nextPageToken: data.nextPageToken || null,
      query,
    };
  } catch (error) {
    console.error('[Trials API] Search error:', error);
    return {
      success: false,
      error: error.message,
      trials: [],
      totalCount: 0,
    };
  }
}

/**
 * Get detailed information for a single trial
 */
async function getTrialDetails(nctId) {
  try {
    const params = new URLSearchParams({
      format: 'json',
    });

    const url = `${CLINICALTRIALS_API_BASE}/studies/${nctId}?${params.toString()}`;
    console.log(`[Trials API] Fetching trial: ${nctId}`);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Trial not found: ${nctId}`);
    }

    const data = await response.json();
    return {
      success: true,
      trial: transformTrialRecord({ protocolSection: data.protocolSection, hasResults: data.hasResults }),
      raw: data,
    };
  } catch (error) {
    console.error('[Trials API] Get trial error:', error);
    return {
      success: false,
      error: error.message,
      trial: null,
    };
  }
}

/**
 * Transform a raw trial record into a clean format
 */
function transformTrialRecord(study) {
  const protocol = study.protocolSection || {};
  const identification = protocol.identificationModule || {};
  const status = protocol.statusModule || {};
  const description = protocol.descriptionModule || {};
  const conditions = protocol.conditionsModule || {};
  const design = protocol.designModule || {};
  const eligibility = protocol.eligibilityModule || {};
  const contacts = protocol.contactsLocationsModule || {};
  const arms = protocol.armsInterventionsModule || {};
  const outcomes = protocol.outcomesModule || {};
  const sponsor = protocol.sponsorCollaboratorsModule || {};

  // Extract interventions
  const interventions = (arms.interventions || []).map(int => ({
    type: int.type || 'OTHER',
    name: int.name || '',
    description: int.description || '',
    armGroupLabels: int.armGroupLabels || [],
    otherNames: int.otherNames || [],
  }));

  // Categorize interventions
  const drugs = interventions.filter(i => i.type === 'DRUG' || i.type === 'BIOLOGICAL');
  const procedures = interventions.filter(i => i.type === 'PROCEDURE');
  const devices = interventions.filter(i => i.type === 'DEVICE');
  const other = interventions.filter(i => !['DRUG', 'BIOLOGICAL', 'PROCEDURE', 'DEVICE'].includes(i.type));

  // Extract locations
  const locations = (contacts.locations || []).map(loc => ({
    facility: loc.facility || '',
    city: loc.city || '',
    state: loc.state || '',
    country: loc.country || '',
    status: loc.status || '',
  }));

  // US locations count
  const usLocations = locations.filter(l => l.country === 'United States' || l.country === 'US');

  return {
    nctId: identification.nctId || '',
    briefTitle: identification.briefTitle || '',
    officialTitle: identification.officialTitle || '',
    acronym: identification.acronym || null,
    
    // Status
    overallStatus: status.overallStatus || '',
    statusVerifiedDate: status.statusVerifiedDate || '',
    startDate: status.startDateStruct?.date || '',
    completionDate: status.completionDateStruct?.date || '',
    lastUpdatePostDate: status.lastUpdatePostDateStruct?.date || '',
    
    // Design
    studyType: design.studyType || '',
    phases: design.phases || [],
    enrollment: design.enrollmentInfo?.count || 0,
    enrollmentType: design.enrollmentInfo?.type || '',
    
    // Conditions
    conditions: conditions.conditions || [],
    keywords: conditions.keywords || [],
    
    // Interventions (categorized)
    interventions,
    drugs,
    procedures,
    devices,
    otherInterventions: other,
    
    // Eligibility
    eligibilityCriteria: eligibility.eligibilityCriteria || '',
    sex: eligibility.sex || 'ALL',
    minimumAge: eligibility.minimumAge || '',
    maximumAge: eligibility.maximumAge || '',
    healthyVolunteers: eligibility.healthyVolunteers === 'Yes',
    
    // Sponsor
    leadSponsor: sponsor.leadSponsor?.name || '',
    sponsorClass: sponsor.leadSponsor?.class || '',
    collaborators: (sponsor.collaborators || []).map(c => c.name),
    
    // Outcomes
    primaryOutcomes: (outcomes.primaryOutcomes || []).map(o => ({
      measure: o.measure || '',
      description: o.description || '',
      timeFrame: o.timeFrame || '',
    })),
    secondaryOutcomes: (outcomes.secondaryOutcomes || []).map(o => ({
      measure: o.measure || '',
      description: o.description || '',
      timeFrame: o.timeFrame || '',
    })),
    
    // Locations
    locations,
    usLocationsCount: usLocations.length,
    totalLocationsCount: locations.length,
    
    // Description
    briefSummary: description.briefSummary || '',
    detailedDescription: description.detailedDescription || '',
    
    // Has results
    hasResults: study.hasResults || false,
    
    // Computed fields for display
    phaseDisplay: formatPhases(design.phases),
    statusDisplay: formatStatus(status.overallStatus),
    interventionSummary: summarizeInterventions(interventions),
  };
}

/**
 * Extract searchable terms from a trial for code mapping
 */
function extractTrialSearchTerms(trial) {
  const terms = {
    conditions: trial.conditions || [],
    drugs: [],
    procedures: [],
    devices: [],
    otherTerms: [],
  };

  // Extract drug names
  for (const drug of (trial.drugs || [])) {
    if (drug.name) terms.drugs.push(drug.name);
    if (drug.otherNames) terms.drugs.push(...drug.otherNames);
  }

  // Extract procedure names
  for (const proc of (trial.procedures || [])) {
    if (proc.name) terms.procedures.push(proc.name);
  }

  // Extract device names
  for (const device of (trial.devices || [])) {
    if (device.name) terms.devices.push(device.name);
  }

  // Extract from eligibility criteria (look for common patterns)
  const criteria = trial.eligibilityCriteria || '';
  
  // Look for common nephrology procedures
  const procedurePatterns = [
    { pattern: /renal biopsy|kidney biopsy/gi, term: 'renal biopsy' },
    { pattern: /hemodialysis|dialysis/gi, term: 'dialysis' },
    { pattern: /peritoneal dialysis/gi, term: 'peritoneal dialysis' },
    { pattern: /kidney transplant|renal transplant/gi, term: 'kidney transplant' },
  ];

  for (const { pattern, term } of procedurePatterns) {
    if (pattern.test(criteria) && !terms.procedures.includes(term)) {
      terms.procedures.push(term);
    }
  }

  // Deduplicate
  terms.drugs = [...new Set(terms.drugs.map(d => d.toLowerCase()))];
  terms.procedures = [...new Set(terms.procedures.map(p => p.toLowerCase()))];
  terms.devices = [...new Set(terms.devices.map(d => d.toLowerCase()))];

  return terms;
}

/**
 * Build AI query from trial interventions
 */
function buildTrialCodeQuery(trial) {
  const parts = [];
  
  // Add conditions
  if (trial.conditions && trial.conditions.length > 0) {
    parts.push(`Condition: ${trial.conditions.slice(0, 3).join(', ')}`);
  }

  // Add drugs
  if (trial.drugs && trial.drugs.length > 0) {
    const drugNames = trial.drugs.map(d => d.name).filter(Boolean).slice(0, 5);
    if (drugNames.length > 0) {
      parts.push(`Drugs/Biologics: ${drugNames.join(', ')}`);
    }
  }

  // Add procedures
  if (trial.procedures && trial.procedures.length > 0) {
    const procNames = trial.procedures.map(p => p.name).filter(Boolean).slice(0, 5);
    if (procNames.length > 0) {
      parts.push(`Procedures: ${procNames.join(', ')}`);
    }
  }

  // If no specific interventions, use the brief summary
  if (parts.length <= 1 && trial.briefSummary) {
    const summary = trial.briefSummary.slice(0, 500);
    parts.push(`Study: ${summary}`);
  }

  return parts.join('. ');
}

/**
 * Format phases for display
 */
function formatPhases(phases) {
  if (!phases || phases.length === 0) return 'N/A';
  return phases.map(p => {
    switch (p) {
      case 'EARLY_PHASE1': return 'Early Phase 1';
      case 'PHASE1': return 'Phase 1';
      case 'PHASE2': return 'Phase 2';
      case 'PHASE3': return 'Phase 3';
      case 'PHASE4': return 'Phase 4';
      case 'NA': return 'N/A';
      default: return p;
    }
  }).join(' / ');
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const statusMap = {
    'RECRUITING': 'Recruiting',
    'NOT_YET_RECRUITING': 'Not Yet Recruiting',
    'ACTIVE_NOT_RECRUITING': 'Active, Not Recruiting',
    'COMPLETED': 'Completed',
    'SUSPENDED': 'Suspended',
    'TERMINATED': 'Terminated',
    'WITHDRAWN': 'Withdrawn',
    'ENROLLING_BY_INVITATION': 'Enrolling by Invitation',
    'UNKNOWN': 'Unknown',
  };
  return statusMap[status] || status;
}

/**
 * Summarize interventions for display
 */
function summarizeInterventions(interventions) {
  if (!interventions || interventions.length === 0) return 'No interventions specified';
  
  const types = {};
  for (const int of interventions) {
    const type = int.type || 'OTHER';
    if (!types[type]) types[type] = [];
    types[type].push(int.name);
  }

  const parts = [];
  if (types.DRUG) parts.push(`${types.DRUG.length} drug(s)`);
  if (types.BIOLOGICAL) parts.push(`${types.BIOLOGICAL.length} biologic(s)`);
  if (types.PROCEDURE) parts.push(`${types.PROCEDURE.length} procedure(s)`);
  if (types.DEVICE) parts.push(`${types.DEVICE.length} device(s)`);
  if (types.OTHER) parts.push(`${types.OTHER.length} other`);

  return parts.join(', ') || 'See details';
}

/**
 * Search trials with automatic status filter for active trials
 */
async function searchActiveTrials(query, options = {}) {
  return searchTrials(query, {
    ...options,
    status: ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'],
  });
}

/**
 * Search all trials (including completed)
 */
async function searchAllTrials(query, options = {}) {
  return searchTrials(query, {
    ...options,
    status: null, // No status filter
  });
}

module.exports = {
  searchTrials,
  searchActiveTrials,
  searchAllTrials,
  getTrialDetails,
  transformTrialRecord,
  extractTrialSearchTerms,
  buildTrialCodeQuery,
  formatPhases,
  formatStatus,
};

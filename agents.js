/**
 * ================================================================================
 * LEAF INTELLIGENCE - ADVANCED MULTI-AGENT RESEARCH & STATISTICS SYSTEM
 * ================================================================================
 * 
 * A comprehensive AI-powered research platform combining:
 * - Deep ClinicalTrials.gov schema understanding
 * - Advanced statistical modeling and analysis
 * - Multi-dimensional data exploration
 * - Intelligent query parsing and field mapping
 * - Research synthesis and protocol generation
 * - Publication-ready reporting
 * 
 * CAPABILITIES:
 * - Endpoint/Outcome Analysis (primary, secondary, efficacy, safety)
 * - Placebo & Comparator Analysis
 * - Phase Distribution & Progression
 * - Sponsor & Funding Analysis
 * - Geographic Distribution
 * - Enrollment Statistics
 * - Time-to-Completion Analysis
 * - Results & Efficacy Synthesis
 * - Adverse Event Profiling
 * - Protocol Template Generation
 * - Cross-Trial Comparisons
 * - Trend Analysis Over Time
 * 
 * @author Leaf Intelligence Team
 * @version 3.0.0
 */

const { Agent, webSearchTool, fileSearchTool  } = require('@openai/agents');

// ============================================================================
// SECTION 1: COMPREHENSIVE CLINICALTRIALS.GOV SCHEMA
// ============================================================================

/**
 * Complete field registry with metadata for intelligent field selection
 * Each field includes: path, type, description, analysis capabilities, and search relevance
 */
const FIELD_REGISTRY = {
  // ==========================================
  // IDENTIFICATION FIELDS
  // ==========================================
  nctId: {
    path: 'protocolSection.identificationModule.nctId',
    type: 'string',
    description: 'Unique NCT identifier',
    analysisType: ['identification', 'linking'],
    example: 'NCT05123456',
    required: true
  },
  briefTitle: {
    path: 'protocolSection.identificationModule.briefTitle',
    type: 'string',
    description: 'Brief study title (max 300 chars)',
    analysisType: ['text', 'search', 'display'],
    searchable: true
  },
  officialTitle: {
    path: 'protocolSection.identificationModule.officialTitle',
    type: 'string',
    description: 'Full official study title',
    analysisType: ['text', 'search'],
    searchable: true
  },
  nctIdAliases: {
  path: 'protocolSection.identificationModule.nctIdAliases',
  type: 'array',
  itemType: 'string',
  description: 'Obsolete/duplicate NCT IDs redirected to this study',
  analysisType: ['identification', 'linking']
},

secondaryIdInfos: {
  path: 'protocolSection.identificationModule.secondaryIdInfos',
  type: 'array',
  itemFields: {
    id: { type: 'string' },
    type: { type: 'enum', values: ['NIH', 'FDA', 'VA', 'CDC', 'AHRQ', 'SAMHSA', 'OTHER_GRANT', 'EUDRACT_NUMBER', 'CTIS', 'REGISTRY', 'OTHER'] },
    domain: { type: 'string' },
    link: { type: 'string' }
  },
  description: 'Secondary identifiers including grant numbers, EudraCT',
  analysisType: ['identification', 'regulatory', 'linking'],
  critical: true
},
  acronym: {
    path: 'protocolSection.identificationModule.acronym',
    type: 'string',
    description: 'Study acronym (e.g., KEYNOTE-001)',
    analysisType: ['identification', 'search']
  },
  orgStudyId: {
    path: 'protocolSection.identificationModule.orgStudyIdInfo.id',
    type: 'string',
    description: 'Organization study ID',
    analysisType: ['identification', 'linking']
  },
  organizationName: {
    path: 'protocolSection.identificationModule.organization.fullName',
    type: 'string',
    description: 'Submitting organization name',
    analysisType: ['categorical', 'grouping']
  },
  organizationClass: {
    path: 'protocolSection.identificationModule.organization.class',
    type: 'enum',
    values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'AMBIG', 'OTHER', 'UNKNOWN'],
    description: 'Organization classification',
    analysisType: ['categorical', 'distribution', 'comparison']
  },

  // ==========================================
  // STATUS FIELDS
  // ==========================================
  overallStatus: {
    path: 'protocolSection.statusModule.overallStatus',
    type: 'enum',
    values: [
      'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'ENROLLING_BY_INVITATION',
      'NOT_YET_RECRUITING', 'RECRUITING', 'SUSPENDED', 'TERMINATED',
      'WITHDRAWN', 'AVAILABLE', 'NO_LONGER_AVAILABLE',
      'TEMPORARILY_NOT_AVAILABLE', 'APPROVED_FOR_MARKETING', 'WITHHELD', 'UNKNOWN'
    ],
    description: 'Current recruitment/study status',
    analysisType: ['categorical', 'distribution', 'filtering', 'timeline'],
    critical: true
  },
  whyStopped: {
  path: 'protocolSection.statusModule.whyStopped',
  type: 'string',
  description: 'Reason study was stopped/terminated/withdrawn',
  analysisType: ['text', 'categorical', 'quality'],
  critical: true,
  searchable: true
},
delayedPosting: {
  path: 'protocolSection.statusModule.delayedPosting',
  type: 'boolean',
  description: 'Results posting delayed',
  analysisType: ['boolean', 'compliance']
},

  lastKnownStatus: {
    path: 'protocolSection.statusModule.lastKnownStatus',
    type: 'string',
    description: 'Last known status for older studies',
    analysisType: ['categorical']
  },
  statusVerifiedDate: {
    path: 'protocolSection.statusModule.statusVerifiedDate',
    type: 'date',
    format: 'YYYY-MM',
    description: 'Date status was last verified',
    analysisType: ['temporal', 'quality']
  },
  startDate: {
    path: 'protocolSection.statusModule.startDateStruct.date',
    type: 'date',
    description: 'Study start date',
    analysisType: ['temporal', 'timeline', 'trend']
  },
  startDateType: {
    path: 'protocolSection.statusModule.startDateStruct.type',
    type: 'enum',
    values: ['ACTUAL', 'ESTIMATED'],
    description: 'Whether start date is actual or estimated',
    analysisType: ['quality', 'filtering']
  },
  primaryCompletionDate: {
    path: 'protocolSection.statusModule.primaryCompletionDateStruct.date',
    type: 'date',
    description: 'Primary completion date (last subject last visit for primary outcome)',
    analysisType: ['temporal', 'timeline', 'duration']
  },
  primaryCompletionDateType: {
    path: 'protocolSection.statusModule.primaryCompletionDateStruct.type',
    type: 'enum',
    values: ['ACTUAL', 'ESTIMATED'],
    description: 'Whether primary completion date is actual or estimated',
    analysisType: ['quality', 'filtering']
  },
  completionDate: {
    path: 'protocolSection.statusModule.completionDateStruct.date',
    type: 'date',
    description: 'Study completion date',
    analysisType: ['temporal', 'timeline', 'duration']
  },
  completionDateType: {
    path: 'protocolSection.statusModule.completionDateStruct.type',
    type: 'enum',
    values: ['ACTUAL', 'ESTIMATED'],
    description: 'Whether completion date is actual or estimated',
    analysisType: ['quality', 'filtering']
  },
  studyFirstSubmitDate: {
    path: 'protocolSection.statusModule.studyFirstSubmitDate',
    type: 'date',
    description: 'First submitted to ClinicalTrials.gov',
    analysisType: ['temporal', 'trend']
  },
  studyFirstPostDate: {
    path: 'protocolSection.statusModule.studyFirstPostDateStruct.date',
    type: 'date',
    description: 'First posted on ClinicalTrials.gov',
    analysisType: ['temporal', 'trend']
  },
  resultsFirstSubmitDate: {
    path: 'protocolSection.statusModule.resultsFirstSubmitDate',
    type: 'date',
    description: 'Results first submitted date',
    analysisType: ['temporal', 'results', 'compliance']
  },
  resultsFirstPostDate: {
    path: 'protocolSection.statusModule.resultsFirstPostDateStruct.date',
    type: 'date',
    description: 'Results first posted date',
    analysisType: ['temporal', 'results', 'compliance']
  },
  lastUpdateSubmitDate: {
    path: 'protocolSection.statusModule.lastUpdateSubmitDate',
    type: 'date',
    description: 'Last update submitted',
    analysisType: ['temporal', 'quality']
  },
  lastUpdatePostDate: {
    path: 'protocolSection.statusModule.lastUpdatePostDateStruct.date',
    type: 'date',
    description: 'Last update posted',
    analysisType: ['temporal', 'quality']
  },

  // ==========================================
  // SPONSOR/COLLABORATOR FIELDS
  // ==========================================
  leadSponsorName: {
    path: 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name',
    type: 'string',
    description: 'Lead sponsor organization name',
    analysisType: ['categorical', 'grouping', 'comparison'],
    critical: true
  },
  leadSponsorClass: {
    path: 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class',
    type: 'enum',
    values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'OTHER', 'UNKNOWN'],
    description: 'Lead sponsor classification (INDUSTRY vs academic, etc.)',
    analysisType: ['categorical', 'distribution', 'comparison', 'filtering'],
    critical: true
  },
  collaborators: {
    path: 'protocolSection.sponsorCollaboratorsModule.collaborators',
    type: 'array',
    itemFields: {
      name: { type: 'string', description: 'Collaborator name' },
      class: { type: 'enum', values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'OTHER', 'UNKNOWN'] }
    },
    description: 'Study collaborators',
    analysisType: ['categorical', 'network', 'counting']
  },
  responsiblePartyType: {
    path: 'protocolSection.sponsorCollaboratorsModule.responsibleParty.type',
    type: 'enum',
    values: ['SPONSOR', 'PRINCIPAL_INVESTIGATOR', 'SPONSOR_INVESTIGATOR'],
    description: 'Type of responsible party',
    analysisType: ['categorical']
  },
  responsiblePartyName: {
    path: 'protocolSection.sponsorCollaboratorsModule.responsibleParty.investigatorFullName',
    type: 'string',
    description: 'Responsible party investigator name',
    analysisType: ['identification']
  },
  responsiblePartyAffiliation: {
    path: 'protocolSection.sponsorCollaboratorsModule.responsibleParty.investigatorAffiliation',
    type: 'string',
    description: 'Responsible party affiliation',
    analysisType: ['categorical', 'grouping']
  },

  // ==========================================
  // OVERSIGHT FIELDS
  // ==========================================
  hasDmc: {
    path: 'protocolSection.oversightModule.oversightHasDmc',
    type: 'boolean',
    description: 'Has Data Monitoring Committee',
    analysisType: ['boolean', 'quality', 'filtering']
  },
  isFdaRegulatedDrug: {
    path: 'protocolSection.oversightModule.isFdaRegulatedDrug',
    type: 'boolean',
    description: 'FDA regulated drug study',
    analysisType: ['boolean', 'regulatory', 'filtering'],
    critical: true
  },
  isFdaRegulatedDevice: {
    path: 'protocolSection.oversightModule.isFdaRegulatedDevice',
    type: 'boolean',
    description: 'FDA regulated device study',
    analysisType: ['boolean', 'regulatory', 'filtering']
  },
  isUnapprovedDevice: {
    path: 'protocolSection.oversightModule.isUnapprovedDevice',
    type: 'boolean',
    description: 'Unapproved device',
    analysisType: ['boolean', 'regulatory']
  },
  isPpsd: {
    path: 'protocolSection.oversightModule.isPpsd',
    type: 'boolean',
    description: 'Pediatric postmarket surveillance',
    analysisType: ['boolean', 'regulatory']
  },
  isUsExport: {
    path: 'protocolSection.oversightModule.isUsExport',
    type: 'boolean',
    description: 'US export',
    analysisType: ['boolean', 'regulatory']
  },
  fdaaa801Violation: {
    path: 'protocolSection.oversightModule.fdaaa801Violation',
    type: 'boolean',
    description: 'Has FDAAA 801 violation',
    analysisType: ['boolean', 'compliance', 'quality']
  },

  // ==========================================
  // DESCRIPTION FIELDS
  // ==========================================
  briefSummary: {
    path: 'protocolSection.descriptionModule.briefSummary',
    type: 'string',
    description: 'Brief summary of study (max 5000 chars)',
    analysisType: ['text', 'search', 'nlp'],
    searchable: true
  },
  detailedDescription: {
    path: 'protocolSection.descriptionModule.detailedDescription',
    type: 'string',
    description: 'Detailed description',
    analysisType: ['text', 'search', 'nlp'],
    searchable: true
  },

  // ==========================================
  // CONDITIONS FIELDS
  // ==========================================
  conditions: {
    path: 'protocolSection.conditionsModule.conditions',
    type: 'array',
    itemType: 'string',
    description: 'Conditions/diseases being studied',
    analysisType: ['categorical', 'distribution', 'search', 'grouping'],
    critical: true
  },
  keywords: {
    path: 'protocolSection.conditionsModule.keywords',
    type: 'array',
    itemType: 'string',
    description: 'Study keywords',
    analysisType: ['categorical', 'search', 'clustering']
  },

  // ==========================================
  // DESIGN FIELDS - CRITICAL FOR ANALYSIS
  // ==========================================
  studyType: {
    path: 'protocolSection.designModule.studyType',
    type: 'enum',
    values: ['INTERVENTIONAL', 'OBSERVATIONAL', 'EXPANDED_ACCESS'],
    description: 'Type of study',
    analysisType: ['categorical', 'distribution', 'filtering'],
    critical: true
  },
  phases: {
    path: 'protocolSection.designModule.phases',
    type: 'array',
    itemType: 'enum',
    values: ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA'],
    description: 'Study phase(s)',
    analysisType: ['categorical', 'distribution', 'filtering', 'comparison'],
    critical: true
  },
  allocation: {
    path: 'protocolSection.designModule.designInfo.allocation',
    type: 'enum',
    values: ['RANDOMIZED', 'NON_RANDOMIZED', 'NA'],
    description: 'Allocation method',
    analysisType: ['categorical', 'quality', 'filtering']
  },
  interventionModel: {
    path: 'protocolSection.designModule.designInfo.interventionModel',
    type: 'enum',
    values: ['SINGLE_GROUP', 'PARALLEL', 'CROSSOVER', 'FACTORIAL', 'SEQUENTIAL'],
    description: 'Intervention model',
    analysisType: ['categorical', 'distribution', 'design']
  },
  interventionModelDescription: {
    path: 'protocolSection.designModule.designInfo.interventionModelDescription',
    type: 'string',
    description: 'Intervention model description',
    analysisType: ['text']
  },
  primaryPurpose: {
    path: 'protocolSection.designModule.designInfo.primaryPurpose',
    type: 'enum',
    values: ['TREATMENT', 'PREVENTION', 'DIAGNOSTIC', 'ECT', 'SUPPORTIVE_CARE', 'SCREENING', 'HEALTH_SERVICES_RESEARCH', 'BASIC_SCIENCE', 'DEVICE_FEASIBILITY', 'OTHER'],
    description: 'Primary purpose of study',
    analysisType: ['categorical', 'distribution', 'filtering']
  },
  observationalModel: {
    path: 'protocolSection.designModule.designInfo.observationalModel',
    type: 'enum',
    values: ['COHORT', 'CASE_CONTROL', 'CASE_ONLY', 'CASE_CROSSOVER', 'ECOLOGIC_OR_COMMUNITY', 'FAMILY_BASED', 'DEFINED_POPULATION', 'NATURAL_HISTORY', 'OTHER'],
    description: 'Observational study model',
    analysisType: ['categorical', 'distribution']
  },
  timePerspective: {
    path: 'protocolSection.designModule.designInfo.timePerspective',
    type: 'enum',
    values: ['PROSPECTIVE', 'RETROSPECTIVE', 'CROSS_SECTIONAL', 'OTHER'],
    description: 'Time perspective',
    analysisType: ['categorical', 'distribution']
  },
  masking: {
    path: 'protocolSection.designModule.designInfo.maskingInfo.masking',
    type: 'enum',
    values: ['NONE', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE'],
    description: 'Blinding/masking level',
    analysisType: ['categorical', 'quality', 'distribution'],
    critical: true
  },
  maskingDescription: {
    path: 'protocolSection.designModule.designInfo.maskingInfo.maskingDescription',
    type: 'string',
    description: 'Masking description',
    analysisType: ['text']
  },
  whoMasked: {
    path: 'protocolSection.designModule.designInfo.maskingInfo.whoMasked',
    type: 'array',
    itemType: 'enum',
    values: ['PARTICIPANT', 'CARE_PROVIDER', 'INVESTIGATOR', 'OUTCOMES_ASSESSOR'],
    description: 'Who is masked',
    analysisType: ['categorical', 'quality']
  },
  enrollment: {
    path: 'protocolSection.designModule.enrollmentInfo.count',
    type: 'integer',
    description: 'Target or actual enrollment number',
    analysisType: ['numeric', 'statistics', 'distribution', 'comparison'],
    critical: true
  },
  enrollmentType: {
    path: 'protocolSection.designModule.enrollmentInfo.type',
    type: 'enum',
    values: ['ACTUAL', 'ESTIMATED'],
    description: 'Whether enrollment is actual or estimated',
    analysisType: ['categorical', 'quality', 'filtering']
  },
  targetDuration: {
    path: 'protocolSection.designModule.targetDuration',
    type: 'string',
    description: 'Target study duration',
    analysisType: ['text', 'duration']
  },
  numberOfGroups: {
    path: 'protocolSection.designModule.numberOfGroups',
    type: 'integer',
    description: 'Number of study groups/cohorts',
    analysisType: ['numeric', 'design']
  },
  biospecRetention: {
    path: 'protocolSection.designModule.bioSpec.retention',
    type: 'enum',
    values: ['NONE_RETAINED', 'SAMPLES_WITH_DNA', 'SAMPLES_WITHOUT_DNA'],
    description: 'Biospecimen retention',
    analysisType: ['categorical']
  },

  // ==========================================
  // ARMS/GROUPS FIELDS - CRITICAL FOR PLACEBO ANALYSIS
  // ==========================================
  armGroups: {
    path: 'protocolSection.armsInterventionsModule.armGroups',
    type: 'array',
    itemFields: {
      label: { type: 'string', description: 'Arm label/name' },
      type: {
        type: 'enum',
        values: ['EXPERIMENTAL', 'ACTIVE_COMPARATOR', 'PLACEBO_COMPARATOR', 'SHAM_COMPARATOR', 'NO_INTERVENTION', 'OTHER'],
        description: 'Arm type - PLACEBO_COMPARATOR indicates placebo-controlled'
      },
      description: { type: 'string', description: 'Arm description' },
      interventionNames: { type: 'array', itemType: 'string', description: 'Interventions in this arm' }
    },
    description: 'Study arms/groups',
    analysisType: ['categorical', 'design', 'placebo', 'comparison'],
    critical: true
  },

  // ==========================================
  // INTERVENTIONS FIELDS
  // ==========================================
  interventions: {
    path: 'protocolSection.armsInterventionsModule.interventions',
    type: 'array',
    itemFields: {
      type: {
        type: 'enum',
        values: ['DRUG', 'DEVICE', 'BIOLOGICAL', 'PROCEDURE', 'RADIATION', 'BEHAVIORAL', 'GENETIC', 'DIETARY_SUPPLEMENT', 'COMBINATION_PRODUCT', 'DIAGNOSTIC_TEST', 'OTHER'],
        description: 'Intervention type'
      },
      name: { type: 'string', description: 'Intervention name' },
      description: { type: 'string', description: 'Intervention description' },
      armGroupLabels: { type: 'array', itemType: 'string', description: 'Arms using this intervention' },
      otherNames: { type: 'array', itemType: 'string', description: 'Other names for intervention' }
    },
    description: 'Study interventions',
    analysisType: ['categorical', 'distribution', 'search', 'grouping'],
    critical: true
  },

  // ==========================================
  // OUTCOMES FIELDS - CRITICAL FOR ENDPOINT ANALYSIS
  // ==========================================
  primaryOutcomes: {
    path: 'protocolSection.outcomesModule.primaryOutcomes',
    type: 'array',
    itemFields: {
      measure: { type: 'string', description: 'Primary outcome measure name' },
      description: { type: 'string', description: 'Outcome description' },
      timeFrame: { type: 'string', description: 'Time frame for measurement' }
    },
    description: 'Primary endpoints',
    analysisType: ['endpoints', 'text', 'counting', 'comparison'],
    critical: true
  },
  secondaryOutcomes: {
    path: 'protocolSection.outcomesModule.secondaryOutcomes',
    type: 'array',
    itemFields: {
      measure: { type: 'string', description: 'Secondary outcome measure name' },
      description: { type: 'string', description: 'Outcome description' },
      timeFrame: { type: 'string', description: 'Time frame for measurement' }
    },
    description: 'Secondary endpoints',
    analysisType: ['endpoints', 'text', 'counting']
  },
  otherOutcomes: {
    path: 'protocolSection.outcomesModule.otherOutcomes',
    type: 'array',
    itemFields: {
      measure: { type: 'string', description: 'Other outcome measure name' },
      description: { type: 'string', description: 'Outcome description' },
      timeFrame: { type: 'string', description: 'Time frame for measurement' }
    },
    description: 'Other/exploratory endpoints',
    analysisType: ['endpoints', 'text', 'counting']
  },

  // ==========================================
  // ELIGIBILITY FIELDS
  // ==========================================
  eligibilityCriteria: {
    path: 'protocolSection.eligibilityModule.eligibilityCriteria',
    type: 'string',
    description: 'Full eligibility criteria text (inclusion/exclusion)',
    analysisType: ['text', 'nlp', 'protocol']
  },
  healthyVolunteers: {
    path: 'protocolSection.eligibilityModule.healthyVolunteers',
    type: 'boolean',
    description: 'Accepts healthy volunteers',
    analysisType: ['boolean', 'filtering', 'distribution']
  },
  sex: {
    path: 'protocolSection.eligibilityModule.sex',
    type: 'enum',
    values: ['FEMALE', 'MALE', 'ALL'],
    description: 'Sex eligibility',
    analysisType: ['categorical', 'distribution']
  },
  genderBased: {
    path: 'protocolSection.eligibilityModule.genderBased',
    type: 'boolean',
    description: 'Gender-based eligibility',
    analysisType: ['boolean']
  },
  minimumAge: {
    path: 'protocolSection.eligibilityModule.minimumAge',
    type: 'string',
    format: 'age',
    description: 'Minimum age (e.g., "18 Years")',
    analysisType: ['numeric', 'range', 'distribution']
  },
  maximumAge: {
    path: 'protocolSection.eligibilityModule.maximumAge',
    type: 'string',
    format: 'age',
    description: 'Maximum age (e.g., "65 Years")',
    analysisType: ['numeric', 'range', 'distribution']
  },
  stdAges: {
    path: 'protocolSection.eligibilityModule.stdAges',
    type: 'array',
    itemType: 'enum',
    values: ['CHILD', 'ADULT', 'OLDER_ADULT'],
    description: 'Standard age categories',
    analysisType: ['categorical', 'distribution']
  },
  studyPopulation: {
    path: 'protocolSection.eligibilityModule.studyPopulation',
    type: 'string',
    description: 'Study population description',
    analysisType: ['text']
  },
  samplingMethod: {
    path: 'protocolSection.eligibilityModule.samplingMethod',
    type: 'enum',
    values: ['PROBABILITY_SAMPLE', 'NON_PROBABILITY_SAMPLE'],
    description: 'Sampling method',
    analysisType: ['categorical']
  },

  // ==========================================
  // CONTACTS/LOCATIONS FIELDS
  // ==========================================
  centralContacts: {
    path: 'protocolSection.contactsLocationsModule.centralContacts',
    type: 'array',
    itemFields: {
      name: { type: 'string' },
      role: { type: 'enum', values: ['CONTACT', 'PRINCIPAL_INVESTIGATOR', 'STUDY_CHAIR', 'STUDY_DIRECTOR', 'SUB_INVESTIGATOR'] },
      phone: { type: 'string' },
      email: { type: 'string' }
    },
    description: 'Central contacts',
    analysisType: ['contact']
  },
  overallOfficials: {
    path: 'protocolSection.contactsLocationsModule.overallOfficials',
    type: 'array',
    itemFields: {
      name: { type: 'string' },
      affiliation: { type: 'string' },
      role: { type: 'enum', values: ['PRINCIPAL_INVESTIGATOR', 'STUDY_CHAIR', 'STUDY_DIRECTOR', 'SUB_INVESTIGATOR'] }
    },
    description: 'Overall study officials',
    analysisType: ['personnel', 'network']
  },
  locations: {
    path: 'protocolSection.contactsLocationsModule.locations',
    type: 'array',
    itemFields: {
      facility: { type: 'string', description: 'Facility name' },
      status: { type: 'enum', values: ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED', 'TERMINATED'] },
      city: { type: 'string' },
      state: { type: 'string' },
      zip: { type: 'string' },
      country: { type: 'string', description: 'Country name' },
      geoPoint: {
        lat: { type: 'number' },
        lon: { type: 'number' }
      }
    },
    description: 'Study locations/sites',
    analysisType: ['geographic', 'distribution', 'counting'],
    critical: true
  },

  // ==========================================
  // REFERENCES FIELDS
  // ==========================================
  references: {
    path: 'protocolSection.referencesModule.references',
    type: 'array',
    itemFields: {
      pmid: { type: 'string', description: 'PubMed ID' },
      type: { type: 'enum', values: ['BACKGROUND', 'RESULT', 'DERIVED'] },
      citation: { type: 'string' }
    },
    description: 'Literature references',
    analysisType: ['linking', 'literature']
  },
  seeAlsoLinks: {
    path: 'protocolSection.referencesModule.seeAlsoLinks',
    type: 'array',
    itemFields: {
      label: { type: 'string' },
      url: { type: 'string' }
    },
    description: 'Related links',
    analysisType: ['linking']
  },

  // ==========================================
  // IPD SHARING FIELDS
  // ==========================================
  ipdSharing: {
    path: 'protocolSection.ipdSharingStatementModule.ipdSharing',
    type: 'enum',
    values: ['YES', 'NO', 'UNDECIDED'],
    description: 'Individual participant data sharing plan',
    analysisType: ['categorical', 'quality']
  },
  ipdSharingDescription: {
    path: 'protocolSection.ipdSharingStatementModule.description',
    type: 'string',
    description: 'IPD sharing description',
    analysisType: ['text']
  },
  ipdSharingInfoTypes: {
    path: 'protocolSection.ipdSharingStatementModule.infoTypes',
    type: 'array',
    itemType: 'string',
    description: 'Types of IPD to be shared',
    analysisType: ['categorical']
  },
  ipdSharingTimeFrame: {
    path: 'protocolSection.ipdSharingStatementModule.timeFrame',
    type: 'string',
    description: 'IPD sharing time frame',
    analysisType: ['text']
  },
  ipdSharingAccessCriteria: {
    path: 'protocolSection.ipdSharingStatementModule.accessCriteria',
    type: 'string',
    description: 'IPD access criteria',
    analysisType: ['text']
  },

  // ==========================================
  // RESULTS SECTION FIELDS
  // ==========================================
  hasResults: {
    path: 'hasResults',
    type: 'boolean',
    description: 'Whether trial has posted results',
    analysisType: ['boolean', 'filtering', 'results'],
    critical: true
  },
  
  // Participant Flow
  participantFlowPreAssignment: {
    path: 'resultsSection.participantFlowModule.preAssignmentDetails',
    type: 'string',
    description: 'Pre-assignment details',
    analysisType: ['text', 'results']
  },
  participantFlowRecruitment: {
    path: 'resultsSection.participantFlowModule.recruitmentDetails',
    type: 'string',
    description: 'Recruitment details',
    analysisType: ['text', 'results']
  },
  participantFlowGroups: {
    path: 'resultsSection.participantFlowModule.groups',
    type: 'array',
    description: 'Participant flow groups',
    analysisType: ['results', 'flow']
  },
  outcomeAnalyses: {
  path: 'resultsSection.outcomeMeasuresModule.outcomeMeasures[].analyses',
  type: 'array',
  itemFields: {
    pValue: { type: 'string' },
    statisticalMethod: { type: 'string' },
    paramValue: { type: 'number' },
    ciLowerLimit: { type: 'string' },
    ciUpperLimit: { type: 'string' },
    ciPctValue: { type: 'string' },
    nonInferiorityType: { type: 'enum', values: ['SUPERIORITY', 'NON_INFERIORITY', 'EQUIVALENCE', 'OTHER'] }
  },
  description: 'Statistical analyses on outcomes',
  analysisType: ['results', 'statistics', 'efficacy', 'meta-analysis'],
  critical: true
},
  participantFlowPeriods: {
    path: 'resultsSection.participantFlowModule.periods',
    type: 'array',
    description: 'Participant flow periods',
    analysisType: ['results', 'flow']
  },

  // Baseline Characteristics
  baselinePopulationDescription: {
    path: 'resultsSection.baselineCharacteristicsModule.populationDescription',
    type: 'string',
    description: 'Baseline population description',
    analysisType: ['text', 'results']
  },
  baselineGroups: {
    path: 'resultsSection.baselineCharacteristicsModule.groups',
    type: 'array',
    description: 'Baseline characteristic groups',
    analysisType: ['results', 'baseline']
  },
  baselineMeasures: {
    path: 'resultsSection.baselineCharacteristicsModule.measures',
    type: 'array',
    description: 'Baseline measures',
    analysisType: ['results', 'baseline', 'statistics']
  },

  // Outcome Measures (Results)
  outcomeMeasures: {
    path: 'resultsSection.outcomeMeasuresModule.outcomeMeasures',
    type: 'array',
    itemFields: {
      type: { type: 'enum', values: ['PRIMARY', 'SECONDARY', 'OTHER_PRE_SPECIFIED', 'POST_HOC'] },
      title: { type: 'string' },
      description: { type: 'string' },
      populationDescription: { type: 'string' },
      reportingStatus: { type: 'enum', values: ['POSTED', 'NOT_POSTED'] },
      paramType: { type: 'string' },
      dispersionType: { type: 'string' },
      unitOfMeasure: { type: 'string' },
      timeFrame: { type: 'string' },
      groups: { type: 'array' },
      denoms: { type: 'array' },
      classes: { type: 'array' },
      analyses: { type: 'array' }
    },
    description: 'Outcome measure results',
    analysisType: ['results', 'efficacy', 'endpoints', 'statistics'],
    critical: true
  },

  // Adverse Events
  adverseEventsFrequencyThreshold: {
    path: 'resultsSection.adverseEventsModule.frequencyThreshold',
    type: 'string',
    description: 'AE frequency threshold for reporting',
    analysisType: ['results', 'safety']
  },
  adverseEventsTimeFrame: {
    path: 'resultsSection.adverseEventsModule.timeFrame',
    type: 'string',
    description: 'AE reporting time frame',
    analysisType: ['results', 'safety']
  },
  adverseEventsDescription: {
    path: 'resultsSection.adverseEventsModule.description',
    type: 'string',
    description: 'AE reporting description',
    analysisType: ['text', 'results', 'safety']
  },
  adverseEventGroups: {
    path: 'resultsSection.adverseEventsModule.eventGroups',
    type: 'array',
    description: 'Adverse event groups',
    analysisType: ['results', 'safety', 'statistics']
  },
  seriousAdverseEvents: {
    path: 'resultsSection.adverseEventsModule.seriousEvents',
    type: 'array',
    description: 'Serious adverse events',
    analysisType: ['results', 'safety', 'statistics'],
    critical: true
  },
  otherAdverseEvents: {
    path: 'resultsSection.adverseEventsModule.otherEvents',
    type: 'array',
    description: 'Other adverse events',
    analysisType: ['results', 'safety', 'statistics']
  },

  // More Info
  limitationsAndCaveats: {
    path: 'resultsSection.moreInfoModule.limitationsAndCaveats.description',
    type: 'string',
    description: 'Study limitations and caveats',
    analysisType: ['text', 'results', 'quality']
  },
  certainAgreement: {
    path: 'resultsSection.moreInfoModule.certainAgreement',
    type: 'object',
    description: 'Certain agreement information',
    analysisType: ['results']
  },
  pointOfContact: {
    path: 'resultsSection.moreInfoModule.pointOfContact',
    type: 'object',
    description: 'Results point of contact',
    analysisType: ['contact', 'results']
  },

  // ==========================================
  // DERIVED SECTION FIELDS
  // ==========================================
  conditionMeshTerms: {
    path: 'derivedSection.conditionBrowseModule.meshes',
    type: 'array',
    description: 'Condition MeSH terms',
    analysisType: ['categorical', 'ontology']
  },
  interventionMeshTerms: {
    path: 'derivedSection.interventionBrowseModule.meshes',
    type: 'array',
    description: 'Intervention MeSH terms',
    analysisType: ['categorical', 'ontology']
  },

  // ==========================================
  // DOCUMENT SECTION FIELDS
  // ==========================================
  largeDocs: {
    path: 'documentSection.largeDocumentModule.largeDocs',
    type: 'array',
    itemFields: {
      typeAbbrev: { type: 'string' },
      hasProtocol: { type: 'boolean' },
      hasSap: { type: 'boolean' },
      hasIcf: { type: 'boolean' },
      label: { type: 'string' },
      date: { type: 'date' },
      filename: { type: 'string' },
      size: { type: 'integer' }
    },
    description: 'Uploaded documents (protocol, SAP, ICF)',
    analysisType: ['documents', 'quality']
  }
};

// ============================================================================
// SECTION 2: INTELLIGENT QUERY ANALYZER
// ============================================================================

/**
 * Query intent patterns mapped to analysis types and required fields
 */
const QUERY_INTENT_PATTERNS = {
  // Endpoint/Outcome Analysis
  endpoints: {
    patterns: [
      /\b(endpoint|endpoints|outcome|outcomes|measure|measures|efficacy)\b/i,
      /\b(primary|secondary|exploratory)\s*(endpoint|outcome|measure)/i,
      /\b(met|achieved|reached)\s*(endpoint|outcome|primary)/i
    ],
    requiredFields: ['primaryOutcomes', 'secondaryOutcomes', 'otherOutcomes', 'outcomeMeasures'],
    analysisTypes: ['endpoints', 'efficacy'],
    description: 'Analyze study endpoints and outcomes'
  },
  
  // Placebo/Comparator Analysis
  placebo: {
    patterns: [
      /\b(placebo|sham|comparator|controlled|control\s*arm|control\s*group)\b/i,
      /\b(placebo.?controlled|double.?blind|single.?blind)\b/i,
      /\b(active\s*comparator|head.?to.?head)\b/i
    ],
    requiredFields: ['armGroups', 'interventions', 'masking', 'allocation'],
    analysisTypes: ['placebo', 'design', 'comparison'],
    description: 'Analyze placebo and comparator arms'
  },
  
  // Phase Analysis
  phase: {
    patterns: [
      /\b(phase|phases)\b/i,
      /\bphase\s*[1-4]/i,
      /\b(early\s*phase|pivotal|registration|confirmatory)\b/i
    ],
    requiredFields: ['phases', 'studyType'],
    analysisTypes: ['distribution', 'categorical'],
    description: 'Analyze trial phases'
  },
  
  // Enrollment/Sample Size Analysis
  enrollment: {
    patterns: [
      /\b(enrollment|enroll|participants?|subjects?|patients?|sample\s*size)\b/i,
      /\b(how\s*many|number\s*of)\s*(patients?|participants?|subjects?|people)\b/i,
      /\b(average|mean|median|total)\s*(enrollment|sample|size)\b/i
    ],
    requiredFields: ['enrollment', 'enrollmentType'],
    analysisTypes: ['numeric', 'statistics'],
    description: 'Analyze enrollment and sample sizes'
  },
  
  // Status Analysis
  status: {
    patterns: [
      /\b(status|recruiting|completed|terminated|withdrawn|active)\b/i,
      /\b(current|ongoing|finished|stopped)\b/i
    ],
    requiredFields: ['overallStatus', 'lastKnownStatus'],
    analysisTypes: ['categorical', 'distribution'],
    description: 'Analyze trial statuses'
  },
  
  // Sponsor Analysis
  sponsor: {
    patterns: [
      /\b(sponsor|sponsors|funded|funding|industry|academic|nih|government)\b/i,
      /\b(pharmaceutical|pharma|biotech|company|companies)\b/i
    ],
    requiredFields: ['leadSponsorName', 'leadSponsorClass', 'collaborators'],
    analysisTypes: ['categorical', 'distribution', 'comparison'],
    description: 'Analyze sponsors and funding'
  },
  
  // Geographic Analysis
  geographic: {
    patterns: [
      /\b(country|countries|location|locations|site|sites|geographic|region)\b/i,
      /\b(where|international|multinational|global)\b/i,
      /\b(united\s*states|us|europe|asia|china|japan)\b/i
    ],
    requiredFields: ['locations'],
    analysisTypes: ['geographic', 'distribution'],
    description: 'Analyze geographic distribution'
  },
  
  // Results Analysis
  results: {
    patterns: [
      /\b(results?|findings?|data|posted|reported)\b/i,
      /\b(with\s*results|have\s*results|results\s*available)\b/i,
      /\b(efficacy|effectiveness|safety)\s*(results?|data|findings?)\b/i
    ],
    requiredFields: ['hasResults', 'outcomeMeasures', 'resultsFirstPostDate'],
    analysisTypes: ['results', 'efficacy'],
    description: 'Analyze trials with results'
  },
  
  // Safety/Adverse Events Analysis
  safety: {
    patterns: [
      /\b(safety|adverse|side\s*effect|toxicity|ae|sae|serious)\b/i,
      /\b(harm|risk|tolerability|discontinuation)\b/i
    ],
    requiredFields: ['seriousAdverseEvents', 'otherAdverseEvents', 'adverseEventGroups'],
    analysisTypes: ['safety', 'results'],
    description: 'Analyze safety and adverse events'
  },
  
  // Design Analysis
  design: {
    patterns: [
      /\b(design|randomized|blinded|masked|allocation|intervention\s*model)\b/i,
      /\b(parallel|crossover|factorial|single\s*group)\b/i
    ],
    requiredFields: ['allocation', 'interventionModel', 'masking', 'whoMasked', 'primaryPurpose'],
    analysisTypes: ['design', 'categorical'],
    description: 'Analyze study design'
  },
  
  // Intervention Analysis
  intervention: {
    patterns: [
      /\b(intervention|interventions|treatment|treatments|drug|drugs|device|devices)\b/i,
      /\b(therapy|therapies|procedure|procedures|biological|biologics)\b/i
    ],
    requiredFields: ['interventions', 'armGroups'],
    analysisTypes: ['categorical', 'distribution'],
    description: 'Analyze interventions'
  },
  
  // Duration/Timeline Analysis
  timeline: {
    patterns: [
      /\b(duration|timeline|time|length|when|date|year|month)\b/i,
      /\b(started|completed|how\s*long|time\s*to)\b/i,
      /\b(trend|over\s*time|temporal)\b/i
    ],
    requiredFields: ['startDate', 'completionDate', 'primaryCompletionDate', 'studyFirstPostDate'],
    analysisTypes: ['temporal', 'trend'],
    description: 'Analyze timelines and durations'
  },
  
  // Eligibility Analysis
  eligibility: {
    patterns: [
      /\b(eligibility|eligible|inclusion|exclusion|criteria)\b/i,
      /\b(age|sex|gender|healthy\s*volunteer)\b/i
    ],
    requiredFields: ['eligibilityCriteria', 'minimumAge', 'maximumAge', 'sex', 'healthyVolunteers', 'stdAges'],
    analysisTypes: ['eligibility', 'text'],
    description: 'Analyze eligibility criteria'
  },
  
  // Protocol Generation
  protocol: {
    patterns: [
      /\b(protocol|template|design\s*a|create\s*a|build\s*a|generate\s*a)\b/i,
      /\b(based\s*on|similar\s*to|like\s*these)\b/i
    ],
    requiredFields: ['briefTitle', 'conditions', 'interventions', 'armGroups', 'primaryOutcomes', 
                     'secondaryOutcomes', 'eligibilityCriteria', 'enrollment', 'phases', 'masking'],
    analysisTypes: ['protocol', 'synthesis'],
    description: 'Generate protocol template'
  },
  
  // Comparison Analysis
  comparison: {
    patterns: [
      /\b(compare|comparison|versus|vs|differ|difference)\b/i,
      /\b(between|across|among)\b/i
    ],
    requiredFields: [], // Determined dynamically
    analysisTypes: ['comparison'],
    description: 'Compare trials or groups'
  },
  
  // Count/Basic Stats
  count: {
    patterns: [
      /\b(how\s*many|count|total|number)\b/i,
      /\b(list|show|display|give\s*me)\b/i
    ],
    requiredFields: ['nctId', 'briefTitle'],
    analysisTypes: ['counting'],
    description: 'Count or list trials'
  }
};

/**
 * Analyze a query to determine intent and required fields
 */
function analyzeQueryIntent(query) {
  const results = {
    detectedIntents: [],
    requiredFields: new Set(['nctId', 'briefTitle']), // Always include basics
    analysisTypes: new Set(),
    confidence: 0,
    queryKeywords: []
  };
  
  // Extract keywords
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  results.queryKeywords = words;
  
  // Check each pattern
  for (const [intentName, intentConfig] of Object.entries(QUERY_INTENT_PATTERNS)) {
    for (const pattern of intentConfig.patterns) {
      if (pattern.test(query)) {
        results.detectedIntents.push({
          intent: intentName,
          description: intentConfig.description,
          confidence: 0.8
        });
        
        // Add required fields
        intentConfig.requiredFields.forEach(f => results.requiredFields.add(f));
        
        // Add analysis types
        intentConfig.analysisTypes.forEach(t => results.analysisTypes.add(t));
        
        break; // Only match once per intent
      }
    }
  }
  
  // Calculate overall confidence
  results.confidence = results.detectedIntents.length > 0 
    ? Math.min(0.95, 0.5 + (results.detectedIntents.length * 0.15))
    : 0.3;
  
  // If no specific intent, add common fields
  if (results.detectedIntents.length === 0) {
    results.detectedIntents.push({
      intent: 'general',
      description: 'General analysis',
      confidence: 0.5
    });
    ['overallStatus', 'phases', 'enrollment', 'leadSponsorClass', 'conditions']
      .forEach(f => results.requiredFields.add(f));
    results.analysisTypes.add('summary');
  }
  
  return {
    ...results,
    requiredFields: Array.from(results.requiredFields),
    analysisTypes: Array.from(results.analysisTypes)
  };
}

// ============================================================================
// SECTION 3: DATA EXTRACTION UTILITIES
// ============================================================================

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array notation like "armGroups[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current[part];
    }
  }
  
  return current;
}

/**
 * Extract specified fields from trial data
 */
function extractTrialFields(trial, fieldNames) {
  const extracted = {};
  
  for (const fieldName of fieldNames) {
    const fieldConfig = FIELD_REGISTRY[fieldName];
    if (fieldConfig) {
      extracted[fieldName] = getNestedValue(trial, fieldConfig.path);
    }
  }
  
  return extracted;
}

/**
 * Parse age string to months
 */
function parseAgeToMonths(ageStr) {
  if (!ageStr) return null;
  
  const match = ageStr.match(/(\d+)\s*(year|month|week|day)/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'year': return value * 12;
    case 'month': return value;
    case 'week': return value / 4.33;
    case 'day': return value / 30.44;
    default: return null;
  }
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Calculate duration between two dates in days
 */
function calculateDurationDays(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return null;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// SECTION 4: COMPREHENSIVE STATISTICAL OPERATIONS
// ============================================================================

/**
 * Core statistics calculator
 */
class StatisticsEngine {
  
  /**
   * Calculate descriptive statistics for numeric array
   */
  static descriptiveStats(values) {
    const valid = values.filter(v => v != null && !isNaN(v)).map(Number);
    
    if (valid.length === 0) {
      return {
        count: 0,
        missing: values.length,
        mean: null,
        median: null,
        min: null,
        max: null,
        stdDev: null,
        variance: null,
        sum: null,
        percentile25: null,
        percentile75: null,
        iqr: null
      };
    }
    
    const sorted = [...valid].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    // Median
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    
    // Variance and Std Dev
    const squaredDiffs = sorted.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Percentiles
    const percentile = (p) => {
      const index = (p / 100) * (n - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return sorted[lower];
      return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
    };
    
    const p25 = percentile(25);
    const p75 = percentile(75);
    
    return {
      count: n,
      missing: values.length - n,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: sorted[0],
      max: sorted[n - 1],
      stdDev: Math.round(stdDev * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      sum,
      percentile25: Math.round(p25 * 100) / 100,
      percentile75: Math.round(p75 * 100) / 100,
      iqr: Math.round((p75 - p25) * 100) / 100,
      range: sorted[n - 1] - sorted[0]
    };
  }
  
  /**
   * Calculate frequency distribution for categorical data
   */
  static frequencyDistribution(values, options = {}) {
    const { sortBy = 'count', limit = null, includePercentage = true } = options;
    
    const counts = {};
    let total = 0;
    let missing = 0;
    
    values.forEach(v => {
      if (v == null || v === '' || v === undefined) {
        missing++;
      } else if (Array.isArray(v)) {
        // Handle arrays (like phases)
        v.forEach(item => {
          counts[item] = (counts[item] || 0) + 1;
          total++;
        });
      } else {
        counts[v] = (counts[v] || 0) + 1;
        total++;
      }
    });
    
    let entries = Object.entries(counts);
    
    // Sort
    if (sortBy === 'count') {
      entries.sort((a, b) => b[1] - a[1]);
    } else if (sortBy === 'alpha') {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    } else if (sortBy === 'custom' && options.customOrder) {
      const order = options.customOrder;
      entries.sort((a, b) => {
        const aIdx = order.indexOf(a[0]);
        const bIdx = order.indexOf(b[0]);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    }
    
    // Limit
    if (limit && entries.length > limit) {
      const shown = entries.slice(0, limit);
      const otherCount = entries.slice(limit).reduce((sum, [, c]) => sum + c, 0);
      entries = [...shown, ['Other', otherCount]];
    }
    
    // Build result
    const distribution = entries.map(([value, count]) => ({
      value,
      count,
      percentage: includePercentage ? Math.round((count / total) * 1000) / 10 : undefined
    }));
    
    return {
      distribution,
      total,
      uniqueValues: Object.keys(counts).length,
      missing,
      mode: entries[0]?.[0] || null,
      modeCount: entries[0]?.[1] || 0
    };
  }
  
  /**
   * Create histogram buckets for numeric data
   */
  static histogram(values, options = {}) {
    const { buckets = 'auto', customBuckets = null } = options;
    
    const valid = values.filter(v => v != null && !isNaN(v)).map(Number);
    if (valid.length === 0) return { buckets: [], stats: null };
    
    const sorted = [...valid].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    let bucketDefs;
    
    if (customBuckets) {
      bucketDefs = customBuckets;
    } else if (buckets === 'auto') {
      // Use Sturges' formula
      const numBuckets = Math.ceil(Math.log2(valid.length) + 1);
      const bucketWidth = (max - min) / numBuckets;
      bucketDefs = [];
      for (let i = 0; i < numBuckets; i++) {
        const start = min + i * bucketWidth;
        const end = min + (i + 1) * bucketWidth;
        bucketDefs.push({
          label: `${Math.round(start)}-${Math.round(end)}`,
          min: start,
          max: end
        });
      }
    } else {
      // Predefined bucket sets
      const presets = {
        enrollment: [
          { label: '1-50', min: 1, max: 50 },
          { label: '51-100', min: 51, max: 100 },
          { label: '101-200', min: 101, max: 200 },
          { label: '201-500', min: 201, max: 500 },
          { label: '501-1000', min: 501, max: 1000 },
          { label: '1001-5000', min: 1001, max: 5000 },
          { label: '5001+', min: 5001, max: Infinity }
        ],
        duration: [
          { label: '<6 months', min: 0, max: 180 },
          { label: '6-12 months', min: 181, max: 365 },
          { label: '1-2 years', min: 366, max: 730 },
          { label: '2-3 years', min: 731, max: 1095 },
          { label: '3-5 years', min: 1096, max: 1825 },
          { label: '5+ years', min: 1826, max: Infinity }
        ],
        year: [] // Generated dynamically
      };
      bucketDefs = presets[buckets] || presets.enrollment;
    }
    
    // Count values in buckets
    const result = bucketDefs.map(b => ({ ...b, count: 0 }));
    valid.forEach(v => {
      const bucket = result.find(b => v >= b.min && v <= b.max);
      if (bucket) bucket.count++;
    });
    
    return {
      buckets: result.filter(b => b.count > 0),
      stats: this.descriptiveStats(valid),
      totalCounted: valid.length,
      missing: values.length - valid.length
    };
  }
  
  /**
   * Cross-tabulation (contingency table)
   */
  static crossTab(values1, values2, labels = ['Variable 1', 'Variable 2']) {
    const table = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;
    
    for (let i = 0; i < values1.length; i++) {
      const v1 = values1[i] ?? 'Missing';
      const v2 = values2[i] ?? 'Missing';
      
      if (!table[v1]) table[v1] = {};
      table[v1][v2] = (table[v1][v2] || 0) + 1;
      rowTotals[v1] = (rowTotals[v1] || 0) + 1;
      colTotals[v2] = (colTotals[v2] || 0) + 1;
      grandTotal++;
    }
    
    return {
      table,
      rowTotals,
      colTotals,
      grandTotal,
      rowLabels: Object.keys(rowTotals),
      colLabels: Object.keys(colTotals),
      labels
    };
  }
  
  /**
   * Time series aggregation
   */
  static timeSeriesAggregate(dates, options = {}) {
    const { granularity = 'year', valueField = null, values = null } = options;
    
    const aggregated = {};
    
    for (let i = 0; i < dates.length; i++) {
      const date = parseDate(dates[i]);
      if (!date) continue;
      
      let key;
      switch (granularity) {
        case 'year':
          key = date.getFullYear().toString();
          break;
        case 'quarter':
          key = `${date.getFullYear()} Q${Math.ceil((date.getMonth() + 1) / 3)}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.getFullYear().toString();
      }
      
      if (!aggregated[key]) {
        aggregated[key] = { count: 0, values: [] };
      }
      aggregated[key].count++;
      
      if (values && values[i] != null) {
        aggregated[key].values.push(values[i]);
      }
    }
    
    // Sort by key
    const sorted = Object.entries(aggregated)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, data]) => ({
        period,
        count: data.count,
        ...(data.values.length > 0 && {
          sum: data.values.reduce((a, b) => a + b, 0),
          avg: data.values.reduce((a, b) => a + b, 0) / data.values.length
        })
      }));
    
    return {
      series: sorted,
      granularity,
      totalPeriods: sorted.length,
      totalCount: sorted.reduce((sum, p) => sum + p.count, 0)
    };
  }
}

// ============================================================================
// SECTION 5: SPECIALIZED ANALYZERS
// ============================================================================

/**
 * Endpoint Analyzer - Deep analysis of trial outcomes
 */
class EndpointAnalyzer {
  
  static analyzeEndpoints(trials) {
    const analysis = {
      summary: {
        totalTrials: trials.length,
        trialsWithPrimary: 0,
        trialsWithSecondary: 0,
        trialsWithResults: 0,
        totalPrimaryEndpoints: 0,
        totalSecondaryEndpoints: 0,
        avgPrimaryPerTrial: 0,
        avgSecondaryPerTrial: 0
      },
      primaryEndpoints: [],
      secondaryEndpoints: [],
      endpointCategories: {},
      timeFrames: {},
      byPhase: {},
      trialDetails: []
    };
    
    // Common endpoint patterns for categorization
    const endpointPatterns = {
      'Overall Survival': /\b(overall\s*survival|os\b|death|mortality)/i,
      'Progression-Free Survival': /\b(progression.?free|pfs\b|disease.?free|dfs\b)/i,
      'Response Rate': /\b(response\s*rate|orr\b|overall\s*response|objective\s*response|complete\s*response|partial\s*response)/i,
      'Quality of Life': /\b(quality\s*of\s*life|qol\b|hrqol|patient.?reported|pro\b)/i,
      'Safety/Adverse Events': /\b(adverse|safety|toxicity|side\s*effect|tolerability|ae\b|sae\b)/i,
      'Biomarker': /\b(biomarker|marker|expression|level|concentration)/i,
      'Duration of Response': /\b(duration\s*of\s*response|dor\b)/i,
      'Time to Event': /\b(time\s*to|tte\b|ttf\b|ttp\b)/i,
      'Change from Baseline': /\b(change\s*from\s*baseline|cfb\b|improvement|reduction)/i,
      'Pharmacokinetics': /\b(pharmacokinetic|pk\b|auc\b|cmax|half.?life|clearance)/i,
      'Other': /.*/
    };
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
      const phases = getNestedValue(trial, 'protocolSection.designModule.phases') || [];
      const hasResults = trial.hasResults || !!trial.resultsSection;
      
      const primaryOutcomes = getNestedValue(trial, 'protocolSection.outcomesModule.primaryOutcomes') || [];
      const secondaryOutcomes = getNestedValue(trial, 'protocolSection.outcomesModule.secondaryOutcomes') || [];
      
      // Track counts
      if (primaryOutcomes.length > 0) analysis.summary.trialsWithPrimary++;
      if (secondaryOutcomes.length > 0) analysis.summary.trialsWithSecondary++;
      if (hasResults) analysis.summary.trialsWithResults++;
      
      analysis.summary.totalPrimaryEndpoints += primaryOutcomes.length;
      analysis.summary.totalSecondaryEndpoints += secondaryOutcomes.length;
      
      // Process primary endpoints
      primaryOutcomes.forEach(outcome => {
        const measure = outcome.measure || 'Not specified';
        const timeFrame = outcome.timeFrame || 'Not specified';
        
        // Categorize
        let category = 'Other';
        for (const [cat, pattern] of Object.entries(endpointPatterns)) {
          if (pattern.test(measure)) {
            category = cat;
            break;
          }
        }
        
        analysis.primaryEndpoints.push({
          nctId,
          measure,
          description: outcome.description,
          timeFrame,
          category,
          phase: phases.join(', ') || 'N/A'
        });
        
        // Count categories
        analysis.endpointCategories[category] = (analysis.endpointCategories[category] || 0) + 1;
        
        // Count timeframes
        analysis.timeFrames[timeFrame] = (analysis.timeFrames[timeFrame] || 0) + 1;
        
        // By phase
        phases.forEach(phase => {
          if (!analysis.byPhase[phase]) {
            analysis.byPhase[phase] = { primary: 0, secondary: 0, categories: {} };
          }
          analysis.byPhase[phase].primary++;
          analysis.byPhase[phase].categories[category] = (analysis.byPhase[phase].categories[category] || 0) + 1;
        });
      });
      
      // Process secondary endpoints
      secondaryOutcomes.forEach(outcome => {
        analysis.secondaryEndpoints.push({
          nctId,
          measure: outcome.measure || 'Not specified',
          description: outcome.description,
          timeFrame: outcome.timeFrame || 'Not specified'
        });
        
        phases.forEach(phase => {
          if (!analysis.byPhase[phase]) {
            analysis.byPhase[phase] = { primary: 0, secondary: 0, categories: {} };
          }
          analysis.byPhase[phase].secondary++;
        });
      });
      
      // Trial detail
      analysis.trialDetails.push({
        nctId,
        title: title?.slice(0, 100),
        phases: phases.join(', ') || 'N/A',
        primaryCount: primaryOutcomes.length,
        secondaryCount: secondaryOutcomes.length,
        hasResults,
        primaryEndpoints: primaryOutcomes.map(o => o.measure).slice(0, 3)
      });
    });
    
    // Calculate averages
    analysis.summary.avgPrimaryPerTrial = analysis.summary.trialsWithPrimary > 0
      ? Math.round((analysis.summary.totalPrimaryEndpoints / analysis.summary.trialsWithPrimary) * 10) / 10
      : 0;
    analysis.summary.avgSecondaryPerTrial = analysis.summary.trialsWithSecondary > 0
      ? Math.round((analysis.summary.totalSecondaryEndpoints / analysis.summary.trialsWithSecondary) * 10) / 10
      : 0;
    
    return analysis;
  }
  
  static analyzeResultsOutcomes(trials) {
    const analysis = {
      trialsWithResults: 0,
      outcomeMeasures: [],
      byType: { PRIMARY: [], SECONDARY: [], OTHER_PRE_SPECIFIED: [], POST_HOC: [] },
      statisticalMethods: {},
      reportingStatus: { POSTED: 0, NOT_POSTED: 0 }
    };
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const outcomeMeasures = getNestedValue(trial, 'resultsSection.outcomeMeasuresModule.outcomeMeasures') || [];
      
      if (outcomeMeasures.length > 0) {
        analysis.trialsWithResults++;
        
        outcomeMeasures.forEach(om => {
          const entry = {
            nctId,
            type: om.type || 'UNKNOWN',
            title: om.title,
            reportingStatus: om.reportingStatus,
            paramType: om.paramType,
            dispersionType: om.dispersionType,
            unitOfMeasure: om.unitOfMeasure,
            timeFrame: om.timeFrame,
            groupCount: om.groups?.length || 0,
            hasAnalyses: (om.analyses?.length || 0) > 0
          };
          
          analysis.outcomeMeasures.push(entry);
          
          if (analysis.byType[om.type]) {
            analysis.byType[om.type].push(entry);
          }
          
          if (om.reportingStatus) {
            analysis.reportingStatus[om.reportingStatus] = (analysis.reportingStatus[om.reportingStatus] || 0) + 1;
          }
          
          if (om.paramType) {
            analysis.statisticalMethods[om.paramType] = (analysis.statisticalMethods[om.paramType] || 0) + 1;
          }
        });
      }
    });
    
    return analysis;
  }
}

/**
 * Placebo & Comparator Analyzer
 */
class PlaceboAnalyzer {
  
  static analyze(trials) {
    const analysis = {
      summary: {
        totalTrials: trials.length,
        placeboControlled: 0,
        shamControlled: 0,
        activeComparator: 0,
        noIntervention: 0,
        singleArm: 0,
        multiArm: 0
      },
      armDistribution: {},
      placeboTrials: [],
      activeComparatorTrials: [],
      byPhase: {},
      byMasking: {},
      detailedArms: []
    };
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
      const phases = getNestedValue(trial, 'protocolSection.designModule.phases') || [];
      const masking = getNestedValue(trial, 'protocolSection.designModule.designInfo.maskingInfo.masking');
      const armGroups = getNestedValue(trial, 'protocolSection.armsInterventionsModule.armGroups') || [];
      
      // Track arm counts
      const armCount = armGroups.length;
      if (armCount === 1) analysis.summary.singleArm++;
      else if (armCount > 1) analysis.summary.multiArm++;
      
      // Analyze each arm
      let hasPlacebo = false;
      let hasSham = false;
      let hasActiveComparator = false;
      let hasNoIntervention = false;
      
      const trialArms = [];
      
      armGroups.forEach(arm => {
        const armType = arm.type || 'UNKNOWN';
        analysis.armDistribution[armType] = (analysis.armDistribution[armType] || 0) + 1;
        
        trialArms.push({
          label: arm.label,
          type: armType,
          description: arm.description?.slice(0, 200),
          interventions: arm.interventionNames || []
        });
        
        if (armType === 'PLACEBO_COMPARATOR' || 
            (arm.label && arm.label.toLowerCase().includes('placebo')) ||
            (arm.description && arm.description.toLowerCase().includes('placebo'))) {
          hasPlacebo = true;
        }
        
        if (armType === 'SHAM_COMPARATOR' ||
            (arm.label && arm.label.toLowerCase().includes('sham'))) {
          hasSham = true;
        }
        
        if (armType === 'ACTIVE_COMPARATOR') {
          hasActiveComparator = true;
        }
        
        if (armType === 'NO_INTERVENTION') {
          hasNoIntervention = true;
        }
      });
      
      // Update summary
      if (hasPlacebo) {
        analysis.summary.placeboControlled++;
        analysis.placeboTrials.push({
          nctId,
          title: title?.slice(0, 100),
          phases: phases.join(', '),
          masking,
          armCount,
          arms: trialArms
        });
      }
      
      if (hasSham) analysis.summary.shamControlled++;
      
      if (hasActiveComparator) {
        analysis.summary.activeComparator++;
        analysis.activeComparatorTrials.push({
          nctId,
          title: title?.slice(0, 100),
          phases: phases.join(', '),
          armCount
        });
      }
      
      if (hasNoIntervention) analysis.summary.noIntervention++;
      
      // By phase
      phases.forEach(phase => {
        if (!analysis.byPhase[phase]) {
          analysis.byPhase[phase] = { total: 0, placebo: 0, active: 0, sham: 0 };
        }
        analysis.byPhase[phase].total++;
        if (hasPlacebo) analysis.byPhase[phase].placebo++;
        if (hasActiveComparator) analysis.byPhase[phase].active++;
        if (hasSham) analysis.byPhase[phase].sham++;
      });
      
      // By masking
      if (masking) {
        if (!analysis.byMasking[masking]) {
          analysis.byMasking[masking] = { total: 0, placebo: 0 };
        }
        analysis.byMasking[masking].total++;
        if (hasPlacebo) analysis.byMasking[masking].placebo++;
      }
      
      analysis.detailedArms.push({
        nctId,
        armCount,
        hasPlacebo,
        hasActiveComparator,
        hasSham,
        arms: trialArms
      });
    });
    
    // Calculate percentages
    analysis.summary.placeboPercentage = trials.length > 0
      ? Math.round((analysis.summary.placeboControlled / trials.length) * 1000) / 10
      : 0;
    analysis.summary.activeComparatorPercentage = trials.length > 0
      ? Math.round((analysis.summary.activeComparator / trials.length) * 1000) / 10
      : 0;
    
    return analysis;
  }
}

/**
 * Safety & Adverse Events Analyzer
 */
class SafetyAnalyzer {
  
  static analyze(trials) {
    const analysis = {
      summary: {
        totalTrials: trials.length,
        trialsWithAEData: 0,
        trialsWithSAEData: 0,
        totalSeriousEvents: 0,
        totalOtherEvents: 0
      },
      seriousEvents: [],
      otherEvents: [],
      byOrganSystem: {},
      mostCommonSAEs: {},
      mostCommonOtherAEs: {},
      trialDetails: []
    };
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
      const aeModule = trial.resultsSection?.adverseEventsModule;
      
      if (!aeModule) return;
      
      const seriousEvents = aeModule.seriousEvents || [];
      const otherEvents = aeModule.otherEvents || [];
      const eventGroups = aeModule.eventGroups || [];
      
      if (seriousEvents.length > 0 || otherEvents.length > 0) {
        analysis.summary.trialsWithAEData++;
      }
      
      if (seriousEvents.length > 0) {
        analysis.summary.trialsWithSAEData++;
        analysis.summary.totalSeriousEvents += seriousEvents.length;
        
        seriousEvents.forEach(event => {
          const term = event.term || 'Unknown';
          const organSystem = event.organSystem || 'Unknown';
          
          analysis.mostCommonSAEs[term] = (analysis.mostCommonSAEs[term] || 0) + 1;
          
          if (!analysis.byOrganSystem[organSystem]) {
            analysis.byOrganSystem[organSystem] = { serious: 0, other: 0 };
          }
          analysis.byOrganSystem[organSystem].serious++;
          
          analysis.seriousEvents.push({
            nctId,
            term,
            organSystem,
            sourceVocabulary: event.sourceVocabulary,
            stats: event.stats
          });
        });
      }
      
      if (otherEvents.length > 0) {
        analysis.summary.totalOtherEvents += otherEvents.length;
        
        otherEvents.forEach(event => {
          const term = event.term || 'Unknown';
          const organSystem = event.organSystem || 'Unknown';
          
          analysis.mostCommonOtherAEs[term] = (analysis.mostCommonOtherAEs[term] || 0) + 1;
          
          if (!analysis.byOrganSystem[organSystem]) {
            analysis.byOrganSystem[organSystem] = { serious: 0, other: 0 };
          }
          analysis.byOrganSystem[organSystem].other++;
        });
      }
      
      analysis.trialDetails.push({
        nctId,
        title: title?.slice(0, 80),
        seriousEventCount: seriousEvents.length,
        otherEventCount: otherEvents.length,
        groupCount: eventGroups.length,
        timeFrame: aeModule.timeFrame,
        frequencyThreshold: aeModule.frequencyThreshold
      });
    });
    
    // Sort most common
    analysis.topSAEs = Object.entries(analysis.mostCommonSAEs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, count]) => ({ term, count }));
    
    analysis.topOtherAEs = Object.entries(analysis.mostCommonOtherAEs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, count]) => ({ term, count }));
    
    return analysis;
  }
}

/**
 * Geographic Analyzer
 */
class GeographicAnalyzer {
  
  static analyze(trials) {
    const analysis = {
      summary: {
        totalTrials: trials.length,
        trialsWithLocations: 0,
        totalSites: 0,
        totalCountries: 0,
        avgSitesPerTrial: 0,
        multinationalTrials: 0
      },
      byCountry: {},
      byRegion: {},
      topFacilities: {},
      trialGeography: [],
      countryPairs: {}
    };
    
    // Region mapping
    const regionMap = {
      'United States': 'North America',
      'Canada': 'North America',
      'Mexico': 'North America',
      'United Kingdom': 'Europe',
      'Germany': 'Europe',
      'France': 'Europe',
      'Italy': 'Europe',
      'Spain': 'Europe',
      'Netherlands': 'Europe',
      'Belgium': 'Europe',
      'Poland': 'Europe',
      'Czech Republic': 'Europe',
      'Hungary': 'Europe',
      'Austria': 'Europe',
      'Switzerland': 'Europe',
      'Sweden': 'Europe',
      'Denmark': 'Europe',
      'Norway': 'Europe',
      'Finland': 'Europe',
      'Ireland': 'Europe',
      'Portugal': 'Europe',
      'Greece': 'Europe',
      'Romania': 'Europe',
      'Bulgaria': 'Europe',
      'China': 'Asia',
      'Japan': 'Asia',
      'Korea, Republic of': 'Asia',
      'South Korea': 'Asia',
      'Taiwan': 'Asia',
      'India': 'Asia',
      'Thailand': 'Asia',
      'Malaysia': 'Asia',
      'Singapore': 'Asia',
      'Hong Kong': 'Asia',
      'Philippines': 'Asia',
      'Vietnam': 'Asia',
      'Indonesia': 'Asia',
      'Australia': 'Oceania',
      'New Zealand': 'Oceania',
      'Brazil': 'South America',
      'Argentina': 'South America',
      'Chile': 'South America',
      'Colombia': 'South America',
      'Peru': 'South America',
      'South Africa': 'Africa',
      'Egypt': 'Africa',
      'Israel': 'Middle East',
      'Turkey': 'Middle East',
      'Saudi Arabia': 'Middle East',
      'Russian Federation': 'Europe/Asia',
      'Russia': 'Europe/Asia',
      'Ukraine': 'Europe'
    };
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const locations = getNestedValue(trial, 'protocolSection.contactsLocationsModule.locations') || [];
      
      if (locations.length === 0) return;
      
      analysis.summary.trialsWithLocations++;
      analysis.summary.totalSites += locations.length;
      
      const trialCountries = new Set();
      const trialRegions = new Set();
      
      locations.forEach(loc => {
        const country = loc.country;
        const facility = loc.facility;
        
        if (country) {
          trialCountries.add(country);
          analysis.byCountry[country] = (analysis.byCountry[country] || 0) + 1;
          
          const region = regionMap[country] || 'Other';
          trialRegions.add(region);
          analysis.byRegion[region] = (analysis.byRegion[region] || 0) + 1;
        }
        
        if (facility) {
          analysis.topFacilities[facility] = (analysis.topFacilities[facility] || 0) + 1;
        }
      });
      
      if (trialCountries.size > 1) {
        analysis.summary.multinationalTrials++;
      }
      
      analysis.trialGeography.push({
        nctId,
        siteCount: locations.length,
        countryCount: trialCountries.size,
        countries: Array.from(trialCountries),
        regions: Array.from(trialRegions),
        isMultinational: trialCountries.size > 1
      });
    });
    
    // Calculate summary stats
    analysis.summary.totalCountries = Object.keys(analysis.byCountry).length;
    analysis.summary.avgSitesPerTrial = analysis.summary.trialsWithLocations > 0
      ? Math.round((analysis.summary.totalSites / analysis.summary.trialsWithLocations) * 10) / 10
      : 0;
    
    // Sort countries and facilities
    analysis.topCountries = Object.entries(analysis.byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([country, count]) => ({ country, count }));
    
    analysis.topFacilitiesList = Object.entries(analysis.topFacilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([facility, count]) => ({ facility, count }));
    
    return analysis;
  }
}

/**
 * Protocol Synthesizer - Generate protocol templates from trial data
 */
class ProtocolSynthesizer {
  
  static synthesize(trials, options = {}) {
    const { focusCondition = null, focusIntervention = null } = options;
    
    if (trials.length === 0) {
      return { error: 'No trials provided for synthesis' };
    }
    
    const synthesis = {
      metadata: {
        sourceTrialCount: trials.length,
        generatedDate: new Date().toISOString(),
        focusCondition,
        focusIntervention
      },
      recommendedDesign: {},
      commonElements: {},
      suggestedEndpoints: { primary: [], secondary: [] },
      eligibilityTemplate: {},
      armStructure: [],
      statisticalConsiderations: {},
      sourceTrials: []
    };
    
    // Aggregate design elements
    const phases = {};
    const allocations = {};
    const models = {};
    const maskings = {};
    const purposes = {};
    const enrollments = [];
    const durations = [];
    const conditions = {};
    const interventionTypes = {};
    const primaryEndpoints = {};
    const secondaryEndpoints = {};
    const armTypes = {};
    const ages = { min: [], max: [] };
    const sexes = {};
    
    trials.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
      
      // Phases
      const trialPhases = getNestedValue(trial, 'protocolSection.designModule.phases') || [];
      trialPhases.forEach(p => { phases[p] = (phases[p] || 0) + 1; });
      
      // Design elements
      const allocation = getNestedValue(trial, 'protocolSection.designModule.designInfo.allocation');
      if (allocation) allocations[allocation] = (allocations[allocation] || 0) + 1;
      
      const model = getNestedValue(trial, 'protocolSection.designModule.designInfo.interventionModel');
      if (model) models[model] = (models[model] || 0) + 1;
      
      const masking = getNestedValue(trial, 'protocolSection.designModule.designInfo.maskingInfo.masking');
      if (masking) maskings[masking] = (maskings[masking] || 0) + 1;
      
      const purpose = getNestedValue(trial, 'protocolSection.designModule.designInfo.primaryPurpose');
      if (purpose) purposes[purpose] = (purposes[purpose] || 0) + 1;
      
      // Enrollment
      const enrollment = getNestedValue(trial, 'protocolSection.designModule.enrollmentInfo.count');
      if (enrollment) enrollments.push(enrollment);
      
      // Duration
      const startDate = getNestedValue(trial, 'protocolSection.statusModule.startDateStruct.date');
      const completionDate = getNestedValue(trial, 'protocolSection.statusModule.completionDateStruct.date');
      const duration = calculateDurationDays(startDate, completionDate);
      if (duration && duration > 0) durations.push(duration);
      
      // Conditions
      const trialConditions = getNestedValue(trial, 'protocolSection.conditionsModule.conditions') || [];
      trialConditions.forEach(c => { conditions[c] = (conditions[c] || 0) + 1; });
      
      // Interventions
      const interventions = getNestedValue(trial, 'protocolSection.armsInterventionsModule.interventions') || [];
      interventions.forEach(int => {
        if (int.type) interventionTypes[int.type] = (interventionTypes[int.type] || 0) + 1;
      });
      
      // Endpoints
      const primaryOuts = getNestedValue(trial, 'protocolSection.outcomesModule.primaryOutcomes') || [];
      primaryOuts.forEach(o => {
        if (o.measure) {
          const key = o.measure.toLowerCase().slice(0, 100);
          if (!primaryEndpoints[key]) primaryEndpoints[key] = { measure: o.measure, timeFrame: o.timeFrame, count: 0 };
          primaryEndpoints[key].count++;
        }
      });
      
      const secondaryOuts = getNestedValue(trial, 'protocolSection.outcomesModule.secondaryOutcomes') || [];
      secondaryOuts.forEach(o => {
        if (o.measure) {
          const key = o.measure.toLowerCase().slice(0, 100);
          if (!secondaryEndpoints[key]) secondaryEndpoints[key] = { measure: o.measure, timeFrame: o.timeFrame, count: 0 };
          secondaryEndpoints[key].count++;
        }
      });
      
      // Arms
      const armGroups = getNestedValue(trial, 'protocolSection.armsInterventionsModule.armGroups') || [];
      armGroups.forEach(arm => {
        if (arm.type) armTypes[arm.type] = (armTypes[arm.type] || 0) + 1;
      });
      
      // Eligibility
      const minAge = getNestedValue(trial, 'protocolSection.eligibilityModule.minimumAge');
      const maxAge = getNestedValue(trial, 'protocolSection.eligibilityModule.maximumAge');
      if (minAge) ages.min.push(parseAgeToMonths(minAge));
      if (maxAge) ages.max.push(parseAgeToMonths(maxAge));
      
      const sex = getNestedValue(trial, 'protocolSection.eligibilityModule.sex');
      if (sex) sexes[sex] = (sexes[sex] || 0) + 1;
      
      synthesis.sourceTrials.push({
        nctId,
        title: title?.slice(0, 80),
        phase: trialPhases.join(', '),
        enrollment
      });
    });
    
    // Determine most common (recommended) design elements
    const mostCommon = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
    
    synthesis.recommendedDesign = {
      phase: mostCommon(phases)?.[0] || 'PHASE3',
      allocation: mostCommon(allocations)?.[0] || 'RANDOMIZED',
      interventionModel: mostCommon(models)?.[0] || 'PARALLEL',
      masking: mostCommon(maskings)?.[0] || 'DOUBLE',
      primaryPurpose: mostCommon(purposes)?.[0] || 'TREATMENT',
      enrollmentTarget: enrollments.length > 0 ? StatisticsEngine.descriptiveStats(enrollments).median : 100,
      estimatedDuration: durations.length > 0 
        ? `${Math.round(StatisticsEngine.descriptiveStats(durations).median / 30)} months`
        : '24 months'
    };
    
    synthesis.commonElements = {
      topConditions: Object.entries(conditions).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topInterventionTypes: Object.entries(interventionTypes).sort((a, b) => b[1] - a[1]).slice(0, 3),
      armTypeDistribution: armTypes,
      phaseDistribution: phases
    };
    
    // Top endpoints
    synthesis.suggestedEndpoints.primary = Object.values(primaryEndpoints)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(e => ({ measure: e.measure, timeFrame: e.timeFrame, usedInTrials: e.count }));
    
    synthesis.suggestedEndpoints.secondary = Object.values(secondaryEndpoints)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(e => ({ measure: e.measure, timeFrame: e.timeFrame, usedInTrials: e.count }));
    
    // Eligibility template
    const validMinAges = ages.min.filter(a => a != null);
    const validMaxAges = ages.max.filter(a => a != null);
    
    synthesis.eligibilityTemplate = {
      suggestedMinAge: validMinAges.length > 0 
        ? `${Math.round(StatisticsEngine.descriptiveStats(validMinAges).median / 12)} years`
        : '18 years',
      suggestedMaxAge: validMaxAges.length > 0 && StatisticsEngine.descriptiveStats(validMaxAges).median < 1200
        ? `${Math.round(StatisticsEngine.descriptiveStats(validMaxAges).median / 12)} years`
        : 'No upper limit',
      sex: mostCommon(sexes)?.[0] || 'ALL'
    };
    
    // Arm structure recommendation
    const topArmTypes = Object.entries(armTypes).sort((a, b) => b[1] - a[1]);
    if (topArmTypes.some(([t]) => t === 'PLACEBO_COMPARATOR')) {
      synthesis.armStructure.push({ type: 'EXPERIMENTAL', description: 'Active treatment arm' });
      synthesis.armStructure.push({ type: 'PLACEBO_COMPARATOR', description: 'Placebo comparator arm' });
    } else if (topArmTypes.some(([t]) => t === 'ACTIVE_COMPARATOR')) {
      synthesis.armStructure.push({ type: 'EXPERIMENTAL', description: 'Investigational treatment arm' });
      synthesis.armStructure.push({ type: 'ACTIVE_COMPARATOR', description: 'Active comparator arm' });
    } else {
      synthesis.armStructure.push({ type: 'EXPERIMENTAL', description: 'Treatment arm' });
    }
    
    // Statistical considerations
    const enrollmentStats = StatisticsEngine.descriptiveStats(enrollments);
    synthesis.statisticalConsiderations = {
      sampleSizeRange: {
        recommended: enrollmentStats.median || 100,
        interquartileRange: `${enrollmentStats.percentile25 || 50} - ${enrollmentStats.percentile75 || 200}`,
        note: 'Sample size should be determined by power analysis based on expected effect size'
      },
      randomizationRatio: synthesis.armStructure.length === 2 ? '1:1' : `1:${synthesis.armStructure.length - 1}`,
      blindingLevel: synthesis.recommendedDesign.masking
    };
    
    return synthesis;
  }
}

// ============================================================================
// SECTION 6: MASTER STATISTICAL OPERATION EXECUTOR
// ============================================================================

/**
 * Execute comprehensive statistical operations based on query analysis
 */
async function executeStatisticalOperation(query, trials, options = {}) {
  if (!trials || trials.length === 0) {
    return {
      success: false,
      error: 'No trial data available for analysis',
      result: null,
      chartData: null
    };
  }
  
  // Analyze query intent
  const queryAnalysis = analyzeQueryIntent(query);
  
const result = {
    success: true,
    query,
    queryAnalysis,
    sampleSize: trials.length,
    analyses: [],
    summary: {},
    chartData: [],  // Array to support multiple charts
    tables: [],
    recommendations: []
};
  
  const queryLower = query.toLowerCase();
  
  try {
    // ========================================
    // ENDPOINT ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('endpoints') || 
        /\b(endpoint|outcome|measure|efficacy|primary|secondary)\b/i.test(query)) {
      
      const endpointAnalysis = EndpointAnalyzer.analyzeEndpoints(trials);
      result.analyses.push({
        type: 'endpoints',
        title: 'Endpoint Analysis',
        data: endpointAnalysis
      });
      
      // Chart: Endpoint categories
      const categoryData = Object.entries(endpointAnalysis.endpointCategories)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value }));
      
      if (categoryData.length > 0) {
        result.chartData.push({
          type: 'bar',
          title: 'Primary Endpoint Categories',
          data: categoryData,
          xAxis: 'Category',
          yAxis: 'Count'
        });
      }
      
      // If asking about results specifically
      if (/\b(results?|posted|reported|met|achieved)\b/i.test(query)) {
        const resultsAnalysis = EndpointAnalyzer.analyzeResultsOutcomes(trials);
        result.analyses.push({
          type: 'resultsOutcomes',
          title: 'Results Outcome Analysis',
          data: resultsAnalysis
        });
      }
    }
    
    // ========================================
    // PLACEBO/COMPARATOR ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('placebo') || 
        /\b(placebo|sham|comparator|control|arm|blind)\b/i.test(query)) {
      
      const placeboAnalysis = PlaceboAnalyzer.analyze(trials);
      result.analyses.push({
        type: 'placebo',
        title: 'Placebo & Comparator Analysis',
        data: placeboAnalysis
      });
      
      // Chart: Arm type distribution
      const armData = Object.entries(placeboAnalysis.armDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ 
          label: label.replace(/_/g, ' '), 
          value 
        }));
      
      result.chartData.push({
        type: 'pie',
        title: 'Arm Type Distribution',
        data: armData,
        xAxis: 'Arm Type',
        yAxis: 'Count'
      });
    }
    
    // ========================================
    // PHASE DISTRIBUTION
    // ========================================
    if (queryAnalysis.analysisTypes.includes('distribution') && 
        (queryAnalysis.requiredFields.includes('phases') || /\bphase/i.test(query))) {
      
      const phaseValues = trials.map(t => getNestedValue(t, 'protocolSection.designModule.phases'));
      const phaseStats = StatisticsEngine.frequencyDistribution(phaseValues, {
        sortBy: 'custom',
        customOrder: ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA']
      });
      
      result.analyses.push({
        type: 'phaseDistribution',
        title: 'Phase Distribution',
        data: phaseStats
      });
      
      result.chartData.push({
        type: 'bar',
        title: 'Trial Distribution by Phase',
        data: phaseStats.distribution.map(d => ({
          label: d.value.replace('PHASE', 'Phase ').replace('EARLY_', 'Early ').replace('NA', 'N/A'),
          value: d.count
        })),
        xAxis: 'Phase',
        yAxis: 'Number of Trials'
      });
    }
    
    // ========================================
    // ENROLLMENT STATISTICS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('statistics') || 
        /\b(enrollment|enroll|participants?|sample\s*size|how\s*many\s*(patients?|people|subjects?))\b/i.test(query)) {
      
      const enrollments = trials.map(t => getNestedValue(t, 'protocolSection.designModule.enrollmentInfo.count'));
      const enrollmentStats = StatisticsEngine.descriptiveStats(enrollments);
      const enrollmentHist = StatisticsEngine.histogram(enrollments, { buckets: 'enrollment' });
      
      result.analyses.push({
        type: 'enrollment',
        title: 'Enrollment Statistics',
        data: {
          statistics: enrollmentStats,
          histogram: enrollmentHist
        }
      });
      
      result.chartData.push({
        type: 'bar',
        title: 'Enrollment Distribution',
        data: enrollmentHist.buckets.map(b => ({ label: b.label, value: b.count })),
        xAxis: 'Enrollment Range',
        yAxis: 'Number of Trials'
      });
      
      // Add summary stats to result
      result.summary.enrollment = enrollmentStats;
    }
    
    // ========================================
    // STATUS DISTRIBUTION
    // ========================================
    if (/\b(status|recruiting|completed|terminated|active|withdrawn)\b/i.test(query)) {
      
      const statusValues = trials.map(t => getNestedValue(t, 'protocolSection.statusModule.overallStatus'));
      const statusStats = StatisticsEngine.frequencyDistribution(statusValues, { sortBy: 'count' });
      
      result.analyses.push({
        type: 'statusDistribution',
        title: 'Status Distribution',
        data: statusStats
      });
      
      if (!result.chartData) {
        result.chartData.push({
          type: 'pie',
          title: 'Trial Status Distribution',
          data: statusStats.distribution.map(d => ({
            label: d.value.replace(/_/g, ' '),
            value: d.count
          })),
          xAxis: 'Status',
          yAxis: 'Count'
        });
      }
    }
    
    // ========================================
    // SPONSOR ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('comparison') && 
        /\b(sponsor|industry|academic|nih|funded|funding|pharma)\b/i.test(query)) {
      
      const sponsorClasses = trials.map(t => 
        getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class')
      );
      const sponsorClassStats = StatisticsEngine.frequencyDistribution(sponsorClasses, { sortBy: 'count' });
      
      const sponsorNames = trials.map(t => 
        getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name')
      );
      const sponsorNameStats = StatisticsEngine.frequencyDistribution(sponsorNames, { 
        sortBy: 'count', 
        limit: 15 
      });
      
      result.analyses.push({
        type: 'sponsorAnalysis',
        title: 'Sponsor Analysis',
        data: {
          byClass: sponsorClassStats,
          byName: sponsorNameStats
        }
      });
      
      result.chartData.push({
        type: 'pie',
        title: 'Sponsor Type Distribution',
        data: sponsorClassStats.distribution.map(d => ({
          label: d.value === 'INDUSTRY' ? 'Industry' :
                 d.value === 'NIH' ? 'NIH' :
                 d.value === 'OTHER' ? 'Academic/Other' :
                 d.value === 'FED' ? 'Federal' :
                 d.value === 'OTHER_GOV' ? 'Other Government' :
                 d.value === 'NETWORK' ? 'Network' :
                 d.value || 'Unknown',
          value: d.count
        })),
        xAxis: 'Sponsor Type',
        yAxis: 'Count'
      });
    }
    
    // ========================================
    // GEOGRAPHIC ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('geographic') || 
        /\b(country|countries|location|site|geographic|region|where|international)\b/i.test(query)) {
      
      const geoAnalysis = GeographicAnalyzer.analyze(trials);
      result.analyses.push({
        type: 'geographic',
        title: 'Geographic Distribution',
        data: geoAnalysis
      });
      
      result.chartData.push({
        type: 'bar',
        title: 'Top Countries by Trial Count',
        data: geoAnalysis.topCountries.slice(0, 10).map(c => ({
          label: c.country,
          value: c.count
        })),
        xAxis: 'Country',
        yAxis: 'Number of Trials'
      });
    }
    
    // ========================================
    // SAFETY ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('safety') || 
        /\b(safety|adverse|ae|sae|side\s*effect|toxicity)\b/i.test(query)) {
      
      const safetyAnalysis = SafetyAnalyzer.analyze(trials);
      result.analyses.push({
        type: 'safety',
        title: 'Safety & Adverse Events Analysis',
        data: safetyAnalysis
      });
      
      if (safetyAnalysis.topSAEs.length > 0) {
        result.chartData.push({
          type: 'bar',
          title: 'Most Common Serious Adverse Events',
          data: safetyAnalysis.topSAEs.slice(0, 10).map(e => ({
            label: e.term.slice(0, 30),
            value: e.count
          })),
          xAxis: 'Adverse Event',
          yAxis: 'Count'
        });
      }
    }
    
    // ========================================
    // TIMELINE/TREND ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('temporal') || 
        /\b(trend|over\s*time|year|when|timeline|temporal)\b/i.test(query)) {
      
      const startDates = trials.map(t => 
        getNestedValue(t, 'protocolSection.statusModule.startDateStruct.date')
      );
      const timeSeries = StatisticsEngine.timeSeriesAggregate(startDates, { granularity: 'year' });
      
      result.analyses.push({
        type: 'timeline',
        title: 'Trial Start Timeline',
        data: timeSeries
      });
      
      result.chartData.push({
        type: 'line',
        title: 'Trials Started by Year',
        data: timeSeries.series.map(s => ({
          label: s.period,
          value: s.count
        })),
        xAxis: 'Year',
        yAxis: 'Number of Trials'
      });
    }
    
    // ========================================
    // DESIGN ANALYSIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('design') || 
        /\b(design|randomized|blind|masked|allocation|parallel|crossover)\b/i.test(query)) {
      
      const designElements = {
        allocation: trials.map(t => getNestedValue(t, 'protocolSection.designModule.designInfo.allocation')),
        model: trials.map(t => getNestedValue(t, 'protocolSection.designModule.designInfo.interventionModel')),
        masking: trials.map(t => getNestedValue(t, 'protocolSection.designModule.designInfo.maskingInfo.masking')),
        purpose: trials.map(t => getNestedValue(t, 'protocolSection.designModule.designInfo.primaryPurpose'))
      };
      
      result.analyses.push({
        type: 'design',
        title: 'Study Design Analysis',
        data: {
          allocation: StatisticsEngine.frequencyDistribution(designElements.allocation),
          interventionModel: StatisticsEngine.frequencyDistribution(designElements.model),
          masking: StatisticsEngine.frequencyDistribution(designElements.masking),
          primaryPurpose: StatisticsEngine.frequencyDistribution(designElements.purpose)
        }
      });
      
      // Chart: Masking distribution
      const maskingStats = StatisticsEngine.frequencyDistribution(designElements.masking);
      result.chartData.push({
        type: 'pie',
        title: 'Blinding/Masking Distribution',
        data: maskingStats.distribution.map(d => ({
          label: d.value === 'NONE' ? 'Open Label' : d.value || 'Unknown',
          value: d.count
        })),
        xAxis: 'Masking Level',
        yAxis: 'Count'
      });
    }
    
    // ========================================
    // INTERVENTION ANALYSIS
    // ========================================
    if (/\b(intervention|drug|device|biological|treatment\s*type)\b/i.test(query)) {
      
      const interventionTypes = [];
      const interventionNames = [];
      
      trials.forEach(t => {
        const interventions = getNestedValue(t, 'protocolSection.armsInterventionsModule.interventions') || [];
        interventions.forEach(int => {
          if (int.type) interventionTypes.push(int.type);
          if (int.name) interventionNames.push(int.name);
        });
      });
      
      result.analyses.push({
        type: 'interventions',
        title: 'Intervention Analysis',
        data: {
          byType: StatisticsEngine.frequencyDistribution(interventionTypes),
          topInterventions: StatisticsEngine.frequencyDistribution(interventionNames, { limit: 20 })
        }
      });
      
      const typeStats = StatisticsEngine.frequencyDistribution(interventionTypes);
      result.chartData.push({
        type: 'pie',
        title: 'Intervention Type Distribution',
        data: typeStats.distribution.map(d => ({
          label: d.value || 'Unknown',
          value: d.count
        })),
        xAxis: 'Type',
        yAxis: 'Count'
      });
    }
    
    // ========================================
    // PROTOCOL SYNTHESIS
    // ========================================
    if (queryAnalysis.analysisTypes.includes('protocol') || 
        /\b(protocol|template|design\s*a|build\s*a|create\s*a|generate)\b/i.test(query)) {
      
      const synthesis = ProtocolSynthesizer.synthesize(trials);
      result.analyses.push({
        type: 'protocolSynthesis',
        title: 'Protocol Template Synthesis',
        data: synthesis
      });
    }
    
    // ========================================
    // RESULTS/WITH RESULTS ANALYSIS
    // ========================================
    if (/\b(results?|with\s*results|posted\s*results|has\s*results)\b/i.test(query)) {
      
      const withResults = trials.filter(t => t.hasResults || !!t.resultsSection);
      const withoutResults = trials.filter(t => !t.hasResults && !t.resultsSection);
      
      result.analyses.push({
        type: 'resultsAvailability',
        title: 'Results Availability',
        data: {
          withResults: withResults.length,
          withoutResults: withoutResults.length,
          percentage: Math.round((withResults.length / trials.length) * 1000) / 10,
          trialsList: withResults.slice(0, 50).map(t => ({
            nctId: getNestedValue(t, 'protocolSection.identificationModule.nctId'),
            title: getNestedValue(t, 'protocolSection.identificationModule.briefTitle')?.slice(0, 80),
            status: getNestedValue(t, 'protocolSection.statusModule.overallStatus'),
            resultsPosted: getNestedValue(t, 'protocolSection.statusModule.resultsFirstPostDateStruct.date')
          }))
        }
      });
      
      if (!result.chartData) {
        result.chartData.push({
          type: 'pie',
          title: 'Results Availability',
          data: [
            { label: 'With Results', value: withResults.length },
            { label: 'Without Results', value: withoutResults.length }
          ],
          xAxis: 'Status',
          yAxis: 'Count'
        });
      }
    }
    
    // ========================================
    // CROSS-TABULATION / COMPARISON
    // ========================================
    if (queryAnalysis.analysisTypes.includes('comparison') || 
        /\b(compare|versus|vs|by\s+\w+\s+and)\b/i.test(query)) {
      
      // Default comparison: Phase vs Sponsor Class
      const phases = trials.map(t => {
        const p = getNestedValue(t, 'protocolSection.designModule.phases');
        return Array.isArray(p) ? p[0] : p;
      });
      const sponsorClasses = trials.map(t => 
        getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class')
      );
      
      const crossTab = StatisticsEngine.crossTab(phases, sponsorClasses, ['Phase', 'Sponsor Type']);
      
      result.analyses.push({
        type: 'crossTabulation',
        title: 'Phase by Sponsor Type Cross-Tabulation',
        data: crossTab
      });
    }
    
    // ========================================
    // SIMPLE COUNT (fallback)
    // ========================================
    if (queryAnalysis.analysisTypes.includes('counting') || result.analyses.length === 0) {
      
      // Generate comprehensive summary
      const phases = trials.map(t => getNestedValue(t, 'protocolSection.designModule.phases'));
      const statuses = trials.map(t => getNestedValue(t, 'protocolSection.statusModule.overallStatus'));
      const sponsorClasses = trials.map(t => getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class'));
      const enrollments = trials.map(t => getNestedValue(t, 'protocolSection.designModule.enrollmentInfo.count'));
      
      result.analyses.push({
        type: 'summary',
        title: 'Comprehensive Summary',
        data: {
          totalTrials: trials.length,
          phases: StatisticsEngine.frequencyDistribution(phases),
          statuses: StatisticsEngine.frequencyDistribution(statuses),
          sponsorTypes: StatisticsEngine.frequencyDistribution(sponsorClasses),
          enrollment: StatisticsEngine.descriptiveStats(enrollments),
          trialsWithResults: trials.filter(t => t.hasResults).length
        }
      });
      
      // Default chart: Phase distribution
      const phaseStats = StatisticsEngine.frequencyDistribution(phases, {
        sortBy: 'custom',
        customOrder: ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA']
      });
      
      result.chartData.push({
        type: 'bar',
        title: 'Trial Overview by Phase',
        data: phaseStats.distribution.map(d => ({
          label: String(d.value || 'N/A').replace('PHASE', 'Phase ').replace('EARLY_', 'Early '),
          value: d.count
        })),
        xAxis: 'Phase',
        yAxis: 'Number of Trials'
      });
    }
    
    // Build summary
    result.summary.totalTrials = trials.length;
    result.summary.analysesPerformed = result.analyses.map(a => a.type);
    
  } catch (error) {
    console.error('[Stats Engine] Error:', error);
    result.success = false;
    result.error = error.message;
  }
  
  return result;
}

// ============================================================================
// SECTION 7: AGENT DEFINITIONS
// ============================================================================


//  const lessdeepAgent = new Agent({
//     name: 'FDA Regulatory Assistant',
//     // model: "gpt-4o",
//     model: "gpt-5.2-chat-latest",
//   modelSettings: {
//     // reasoning: {
//     //   effort: "high",
//     //   summary: "auto"
//     // },
//     store: true
//   },
//   instructions: `
// You are a global regulatory affairs assistant. You must be able to answer regulatory questions for ALL jurisdictions, ALL product classes, and ALL development stages (investigational, approval, post-market, lifecycle management).

// You MUST always run web searches and return real evidence from real sources. Never plan. Never ask for permission. Always execute and deliver the answer in the same response.

// You must refer to the guidance documents and use them to formulate your approach to the users question as they form the exact expectations the FDA need / have put out. YOu should find nuance here and ensure that the output specifically is traiined to handle nuance very very well.

// Hard rules:
// - Do the work now. Never ask “Would you like me to…” or “Should I proceed”.
// - Use American Spelling, not british
// - Never output a plan, outline, proposal, or “next steps”. You must deliver the completed answer immediately.
// - Never say “I will” or “I can” — just do it.
// - No hallucination. Every factual statement MUST be backed by a real source OR explicitly labelled “no source found”.
// - If a tool or resource fails, state the failure AND still provide best-available validated information.
// - If no data exists, you must say “No official regulatory source found after authoritative search” AND provide the closest available precedent.

// Jurisdiction Priority (R1):
// 1. FDA (US)  
// 2. EMA / EC / EU Regulations  
// 3. ICH Guidelines (baseline harmonization)  
// 4. Other major regulators: MHRA, PMDA, Health Canada, TGA, Swissmedic, ANVISA, NMPA, HSA, WHO, etc.  
// 5. National authority where question is country-specific  



// 📌 **CRITICAL: Link Verification Protocol**

// For EVERY document you cite:
// 1. First get the document from vector DB
// 2. IMMEDIATELY run a web search: "FDA [exact document title] site:fda.gov"
// 3. Extract the WORKING web page URL (not PDF) from search results
// 4. Test format: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/[guidance-name]
// 5. If only PDF exists, use: https://www.fda.gov/media/[ID]/download

// NEVER cite a link without verifying it via web search first.
// NEVER use placeholder URLs or broken links.
// If a document cannot be found on web: state "Document referenced in internal DB but current web link not available - search FDA guidance database for: [exact title]"

// Example citation format:
// **Oncology Therapeutic Radiopharmaceuticals: Dosage Optimization During Clinical Development** (August 2025)  
// [View Guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/oncology-therapeutic-radiopharmaceuticals-dosage-optimization-during-clinical-development)

// For 21 CFR:
// **21 CFR § 312.23** - IND Content and Format  
// [View Regulation](https://www.ecfr.gov/current/title-21/section-312.23)

// #
// 🎯 Scope Requirements (G1 + 3)
// You must support ALL of the following product categories:
// - Drugs (small molecules)
// - Biologics
// - Biosimilars / interchangeability
// - Cell & gene therapies (ATMPs, RMAT)
// - Vaccines
// - Combination products
// - Medical devices (all classes)
// - IVDs (including EU IVDR)
// - Software as a Medical Device (SaMD)
// - AI/ML adaptive medical software
// - Digital therapeutics
// - Orphan, pediatric, breakthrough, PRIME, Sakigake, conditional, accelerated, rolling review
// - Post-market safety, PV, REMS, RMP, PSUR, DSUR, etc.

// #
// 📌 Mandatory Regulatory Data Pipeline
// For EVERY regulatory question, you must follow this pipeline:

// 1. Internal vector DB search in this order:
//    - FDA Guidance DB
//    - CGMP DB
//    - MAPP DB
//    - Global guidance DB (EMA, PMDA, MHRA, Health Canada, TGA, WHO, ICH)

// 2. Verify document recency using official source search
//    - If superseded, cite the replacement only

// 3. Anchor to primary law
//    - FDA: 21 CFR (eCFR.gov)
//    - EU: EUR-Lex Regulations & Directives
//    - UK: MHRA legislation
//    - Japan: PMD Act
//    - ICH: Published Q/M/S/E guidelines
//    - Others: official government regulatory site

// 4. Web search for additional authoritative sources:
//    - FDA Guidance Database
//    - EMA GUIDANCE + CHMP reports
//    - MHRA / GOV.UK
//    - PMDA English portal
//    - Health Canada monographs
//    - TGA Australia regulations
//    - ANVISA RDC
//    - NMPA notices
//    - WHO TRS docs
//    - ICH guideline PDFs
//    - Federal Register, EUR-Lex, UK legislation.gov.uk
//    - Drugs@FDA, EMA EPAR, PMDA reports
//    - ClinicalTrials.gov, EU CTR, JapicCTI
//    - PubMed
//    - DailyMed
//    - Company filings (10-K, press, etc.)

// #
// 📌 Evidence Rule (E2 — Hybrid Mode)

// ✅ **Exact verbatim quotes REQUIRED for binding regulatory sources:**
// - FDA: 21 CFR, Guidance, MAPP, Federal Register, review memos
// - EMA: EU Regulations (e.g., 2017/745, 536/2014), Directives, CHMP opinions
// - ICH: official guideline language
// - PMDA: law sections when available
// - MHRA: legislation clauses
// - WHO: official TRS text

// Quotes must include:
// - Page or article/section reference
// - Full URL

// Example:
// “FDA may rescind Breakthrough Therapy designation…” (Section IV, p. 3)  
// https://www.fda.gov/media/xxxxxxxx/download

// ✅ **Summaries allowed but MUST be cited for:**
// - ClinicalTrials.gov
// - PubMed scientific papers
// - Press releases
// - Corporate investor decks
// - EMA assessment reports
// - PMDA non-translated docs

// ❌ You may NEVER paraphrase CFR, EMA regulations, or guidance text.

// #
// 📌 Clinical Trials Rule
// Whenever a trial is referenced, include NCTID (or EU CTR ID, or JapicCTI ID).

// If no identifier exists:
// NCTID not assigned / not locatable after authoritative search

// #
// 📌 Failure Handling
// If any resource fails, output:

// “[Source] unavailable — fallback applied. Partial result below.”

// You must still produce the answer.

// #
// 📌 Formatting Rules (MANDATORY)
// - Full Markdown report format
// - Professional tone, FDA/EMA reviewer style
// - Use emojis only in section headers or to guide scanning
// - Very limited bullet points
// - Start with # Title
// - End with ## 🔗 References containing ALL real URLs

// #
// 📌 Auto-Rejection Rule
// If the model begins output with:
// “Here is a plan…”, “Let me know if you want me to proceed…”, “Next steps…”
// → discard the draft and regenerate a fully executed answer.

// #
// 📌 Output must ALWAYS be a completed regulatory answer, not a plan.

//   YOU MUST LINK TO THE EXACT DOCUMENT  YOU MUST LINK EXACTLY TO THEZSOURCE AAND RUN A SEARCH TO TRY AND ESURE ITS A VALID LINK AND NOT JUST TO THEDATABASEOR THE GENERAL PAGE OR THE 404 - it must be the real link
// Hard rules:
// - Do the work now. Never ask for permission or say “Would you like me to…”.
// - Never describe a plan, proposal, outline, or “next steps.” Execute immediately and return the final answer in the same response.
// - Never say “I will” or “once confirmed” — you must act, not plan.
// - Always cite full FDA URLs (https://www.fda.gov/... or https://www.accessdata.fda.gov/…).
// - If a tool fails, state the failure and still return the best-available validated result with sources.
// - If no data exists, explicitly state “No FDA record found after authoritative search” and provide nearest valid precedent.

// If the response draft contains phrasing such as:
// “would you like me to…”, “I will now”, “next steps”, “proposed”, “plan”, “once approved”
// → discard the draft and regenerate as a completed answer.

// #
// You are a world-class assistant that formats every response as a clean, clear, and beautifully structured **professional report** using **Markdown** syntax. Always prioritize **clarity**, **readability**, and **depth**, using formatting techniques that make the content visually elegant, easy to navigate, and highly informative. Your responses must be superior in both structure and content — on par with, or better than, outputs from top LLMs like Claude, Grok, or Gemini.

// USE BULLET POINTS SPARINGLY PLEASE.

// 🎯 **Core Goals**
// - Deliver deep, insightful, accurate responses
// - Format with absolute consistency and precision
// - Always prioritize **readability**, **scan-ability**, and **professionalism**

// 📐 **Formatting Guidelines (Always Follow Strictly)**

// ### 🧱 Structure
// - Start with a clear # Title that reflects the topic
// - Use ## for major sections and ### for subsections
// - Add **line breaks** between sections for clean separation
// - Use **bold** for key terms, **italic** for clarifications or nuances

// ### 🔹 Lists & Logical Flow
// - Use bullet points for unordered items  
// - Use numbered lists for steps, sequences, or priority
// - Indent nested points with 2 spaces
// - Always ensure list content is logically grouped and titled

// ### 📊 Tables (When Relevant)
// - Use clean Markdown tables for comparisons, data, feature matrices, etc.
// - Always include **headers** with bold text
// - Ensure tables fit standard screen widths and remain scannable

// ### 🔎 Clarity Techniques
// - Use short paragraphs (2–4 sentences max)
// - Bold major insights and key actions
// - Emphasize takeaways or warnings with relevant icons (⚠️, ✅, 🔍)

// ### 💻 Code / Commands / Syntax
// - Use triple backticks for multi-line code or logs
// - Use single backticks for inline commands, paths, or variables
// - Add inline comments if it helps understanding

// ### 🎨 Emoji Guidelines
// - Use emojis sparingly to improve **visual guidance**
// - Only place emojis:
//   - At section headers ## 📌 Key Points
//   - At the start of bullet points if they aid scanning 🔹 Feature:
// - Never overuse or distract from professional tone

// 📌 **Section Suggestions (Use as Appropriate)**
//  - ## 📌 Direct Answer 
// - # Overview
// - ## Analysis
// - ## Insights -💡 Why This Matters  
// - ## 🔄 Next Steps 
// - ## Pros & Cons
// - ## Summary / Conclusion
// - ## Additional Resources
// - ## 🔗 References
// - ## FAQ

// #
// 📌 **Regulatory Data Acquisition Workflow (MANDATORY)**  
// You must always follow this exact sourcing sequence for any FDA regulatory question:

// 1. Query internal vector databases in this priority:
//    - FDA GUIDANCE DB (official guidances)
//    - CGMP DB (21 CFR Parts 210/211 context)
//    - MAPP DB (CDER internal policy)

// 2. Verify guidance recency on the web (FDA Guidance Database)  
//    - If superseded, cite the replacement, not the old one

// 3. Anchor to controlling law in **21 CFR** using:  
//    https://www.ecfr.gov/current/title-21



// #
// 📌 **Clinical Trials Rule**
// Whenever any trial is mentioned, include the NCTID:
// e.g., Semaglutide GLP-1 Trial — NCT01234567

// If no NCT exists:
// NCTID not assigned / not locatable after authoritative search

// #
// 📌 **Failure Mode Rule**
// If a tool or source fails, respond like:

// “ClinicalTrials.gov unreachable — partial results below (FDA sources validated).”

// Never output “I could not complete this, would you like me to retry?”

// #
// 📌 **Execution Rule**
// You must never plan, propose, or ask permission — you must produce the full answer in the same response.


//   `,
// //     instructions: `
    
// // You are an FDA regulatory assistant. For time-sensitive queries (e.g., “latest”), you MUST run web searches and return the actual results with FDA primary sources.

// // Hard rules:
// // - Do the work now. Never ask for permission or say “Would you like me to…”.
// // - Always cite full FDA URLs (https://www.fda.gov/... or https://www.accessdata.fda.gov/…).
// // - If a tool fails, say which tool failed and provide best-effort partial results with sources.

// // #
// // You are a world-class assistant that formats every response as a clean, clear, and beautifully structured **professional report** using **Markdown** syntax. Always prioritize **clarity**, **readability**, and **depth**, using formatting techniques that make the content visually elegant, easy to navigate, and highly informative. Your responses must be superior in both structure and content — on par with, or better than, outputs from top LLMs like Claude, Grok, or Gemini.


// // USE BULLET POINTS SPARINGLY PLEASE.

// // 🎯 **Core Goals**
// // - Deliver deep, insightful, accurate responses
// // - Format with absolute consistency and precision
// // - Always prioritize **readability**, **scan-ability**, and **professionalism**

// // 📐 **Formatting Guidelines (Always Follow Strictly)**

// // ### 🧱 Structure
// // - Start with a clear # Title that reflects the topic
// // - Use ## for major sections and ### for subsections
// // - Add **line breaks** between sections for clean separation
// // - Use **bold** for key terms, **italic** for clarifications or nuances

// // ### 🔹 Lists & Logical Flow
// // - Use bullet points for unordered items  
// // - Use numbered lists for steps, sequences, or priority
// // - Indent nested points with 2 spaces
// // - Always ensure list content is logically grouped and titled

// // ### 📊 Tables (When Relevant)
// // - Use clean Markdown tables for comparisons, data, feature matrices, etc.
// // - Always include **headers** with bold text
// // - Ensure tables fit standard screen widths and remain scannable

// // ### 🔎 Clarity Techniques
// // - Use short paragraphs (2–4 sentences max)
// // - Bold major insights and key actions
// // - Emphasize takeaways or warnings with relevant icons (⚠️, ✅, 🔍)

// // ### 💻 Code / Commands / Syntax
// // - Use triple backticks  for multi-line code or logs
// // - Use single backticks  for inline commands, paths, or variables
// // - Add inline comments if it helps understanding

// // ### 🎨 Emoji Guidelines
// // - Use emojis sparingly to improve **visual guidance**
// // - Only place emojis:
// //   - At section headers ## 📌 Key Points
// //   - At the start of bullet points if they aid scanning 🔹 Feature:
// // - Never overuse or distract from professional tone

// // 📌 **Section Suggestions (Use as Appropriate)**
// //  - ## 📌 Direct Answer 
// // - # Overview
// // - ## Analysis
// // - ## Insights -💡 Why This Matters  
// // - ## 🔄 Next Steps 
// // - ## Pros & Cons
// // - ## Summary / Conclusion
// // - ## Additional Resources
// // - ## 🔗 References
// // - ## FAQ

// //  🧑‍🎨 Refined Output Format Instructions

// // To ensure visually stunning and highly scannable formatting, follow these additional formatting rules:

// // 🎨 Section Headers with Emoji + Color

// // Use emoji icons to denote section types. Place the emoji at the start of the section title line in Markdown. Examples:

// // ## 📕 Direct Answer
// // ## 💡 Why This Matters
// // ## 📌 Key Points
// // ## 🔗 References
// // ## ⚠️ Requires Confirmation


// // Each emoji maps to a color-coded header in the frontend.

// // ✅ Inline Icons in Lists (Sparingly)

// // Use inline emojis to guide the eye in list items. Examples:

// // ✅ Confirmed or completed point

// // 🔍 Key insight or highlight

// // ⚠️ Pending user action or warning

// // 💡 Insight or trick

// // Do not overuse — only 1 emoji per list item maximum.

// // 🧾 References and Links

// // Use:

// // - [FDA Source](https://www.fda.gov/...)


// // And place them under a ## 🔗 References section.

// // make sureyou format the response in that way please. 
    
    
// //     You are an expert regulatory counsel assistant that handles complicatied, nuanced regulatory pathway and short form responses. You handle surface level queries like greetings or non-specific questions, and then if the request is regulatory or FDA related, you must use the vector database you have access to and find relevant guidances that are relevant to the question.

// //     for every single regulatory question you must find in my vector database, EVERY single relevant guidance for the query, i.e radiopharmacuticals must return every single guidance documents that contains or references this area. Then you must check the web to see if the guidance document and make sure its the most current up to date version. I then need to you to search for the exact link to this guidance document and display it to the user ensure the link is real and does not give an fda nothing ffound page. 



// //     for example if the user queries about radiopharmaceuticals, or a single specific drug, or theraputic area, find all relevant guidance documents - such as for example radiopharmacuticals must get this one - Oncology Therapeutic Radiopharmaceuticals: Dosage Optimization During Clinical Development
// // Draft Guidance for Industry
// // August 2025 - see how tus 2025 - many guidance documents have updated versions so you must always cehck everything properly.
// //     this is always the first layer. collect every signel guidance doc ument that is relevant to the query from the vector database. Then check the web to see if its the most current version. then get the exact link to the real guidance document on fda.gov.

// //     after this , read from all the guidance documents and find the corresponding MAPPS documents that work with tehse guidnaces ,and tailored to the specific query. you need to then use theese to then search for 21 cfr part and subpart that is relevant to the query. - these 3 sources create the actual fda regulation ( cfr ) , way the fda tell industry how FDA interprets regulations (guidance documetns) and how the FDA staff how to implement those interpretations internally.( Mapps)




// // Always show full URLs in citations (e.g., https://www.fda.gov/media/.../download). Never shorten to just (fda.gov).

// //     this now forms your full corpus to answer the user's question. and the contxt to begin detailed web searches for precedent trials, drugs@fda records, dailymed labels, pubmed articles and whatever else is relevant to the query.

// //     you must alwasys follow this process for every single regulatory question asked. never skip any step.

// //     you must always answer the users question directly , using fda wording and reviewer language. you must always cite exact sources with direct links. never fabricate information or provide vague answers. if you cannot find the information, state that clearly.

// //     Style
// // Narrative, strategic memo with regulatory reasoning and sequencing, FDA reviewer voice, precise and conservative, justification-driven, aligned to CFR text, present both sides if evidence is mixed.

// // Depth on FDA reasoning
// // High — gives rationale for each FDA expectation, clinical and quality steps, and references to FDA thinking

// // Focus
// // Practical roadmap for development and interactions (Pre-RFD → Pre-IND → NDA)
// // Formal regulatory documentation and precedent synthesis

// // Clarity for non-specialists
// // More readable, plain English, strategic with any detailed terms explained.

// // - Human-readable, step-by-step FDA engagement plan
// // - Explains why each step matters
// // - Covers FDA mindset (“what FDA thinks”)


// // if there is no precedent ,  you must explain directly why and also then search for close matches. for example, semiglutide has no trials for Type 1 diabetes in singapore but there are 3 trials of semiglutide for non type 1 diabetes  YOU MUST MENTION THE CRRITERIA AND THE DIFFERENCE , i.e you must state clearly that there were no found exact matchhes for xxxxxx and so here are the closest exmaples and why they may still be useful .

// // if the user asks for a question outside the FDA dursdiction , for example the possibility of a brazil approval - you must use your web search and research the brazil regulatory authority website and find the relevant guidance documents and regulations that apply to the user's question from there and answer in full. 


// // if the user asks about bringing a certainn drug to a new market, or a regulatory pathway, you must do into depth about how other people have done similar, issues they faces, fda thinking towards theier specific case studies, and the exact pathway they went down - for example show me all the studies they had to do toet approval - Clinical trials, link phase 1 to phase 2 to phase 3, so for example you can see a companies journey, from IND to phase 1 to phase 2 to phase 3 etc..



// // if they mention how thee user has a speciic idea on how to go about it - for example they want to do an accelerated approval pathway - you must check if this is possible, and then explain in depth how to do this, what the fda expects, what precedent there is, what guidances apply, what mapps apply, what cfr parts and subparts apply, what clinical trials are needed, what data is needed, what manufacturing controls are needed, labeling expectations etc. you must be very detailed and specific in your response.

// // similarly if they want to skipping redundant preclinical testing e.g they already have the data from chinese studies - you must check if this is possible, and then explain in depth how to do this, what the fda expects, what precedent there is, what guidances apply, what mapps apply, what cfr parts and subparts apply, what clinical trials are needed, what data is needed, what manufacturing controls are needed, labeling expectations etc. you must be very detailed and specific in your response.    
// // everythign must be in the context of the fda regulations, guidances and mapps as well as precedent 

// // use the documents to prepare a full, detailed answer to the user's question.


// // Always show full URLs in citations (e.g., https://www.fda.gov/media/.../download). Never shorten to just (fda.gov).


// // Then go to the government website https://www.ecfr.gov/current/title-21 and find the relevant subpart, then use this to run further web searches and create a well thought out answer to the user's request, in line with the CFR part and the guidance document, citing them exactly and looking up the actual links to the real guidance documents.

// // You must create a clear answer in FDA reviewer language that uses context and actual information from the web - drugs@fda, clinical trials, pubmed, dailymed and whatever official source is relevant. Construct the answer based off this - act as a regulatory consultant giving advice and answers.


// // Every answer you give must be comprehensive, well thought out, and cite exact sources with direct links. You must never fabricate information or provide vague answers. If you cannot find the information, state that clearly.

// // Rules for querying and answering:
// // 1) Always start by checking your internal vector databases for relevant guidances, MAPPs, and cGMP documents.
// // 2) Formulate your queries based on the user's question to find the most relevant documents.

// // never leave out any part of the answer - be very detailed and specific in your response.

// // You must always consult all internal vector databases in this priority:
// // 1) FDA GUIDANCE DB (official guidances)
// // 2) CGMP DB (cGMP policies/guidances; 21 CFR Parts 210/211 context)
// // 3) MAPP DB (CDER Manual of Policies and Procedures)

// // Then anchor to primary law/regulation via eCFR Title 21. After internal retrieval, perform authority-first web checks to verify recency/supersedence and to capture missing sources:
// // - FDA Guidance Database, Federal Register, Drugs@FDA, DailyMed, ClinicalTrials.gov, PubMed, EMA.

// // Querying rules
// // - Run the same core query across GUIDANCE, CGMP, MAPP; then re-run with synonyms if coverage is weak.
// // - Extract precise, context-preserving quotes (≤60 words). Capture section/page identifiers where available.
// // - Verify whether each guidance/MAPP has a newer/revised/superseding version. If superseded, cite the replacement and state it clearly.

// // Routing hints
// // - Manufacturing/quality/validation/data integrity/inspections: prioritize CGMP hits, corroborate with GUIDANCE and MAPP.
// // - CDER policy/classification/review practices: prioritize MAPP hits, corroborate with GUIDANCE and CFR.
// // - Application content/CMC format/labeling/clinical: prioritize GUIDANCE, corroborate with CGMP and MAPP.

// // Answer style
// // - Write in FDA reviewer language: precise, conservative, justification-driven. Align interpretations to controlling CFR text. If evidence is mixed, present both sides and explain the basis.



// // YOU MUT DETERMINE THE BEST OUTPUT STRUCTURE FOR THE OUTPUT TO BEST ANSWEEEER THE USERS QUESTION.
// // Clinical trials requirement
// // - Whenever any clinical trial is mentioned, include the exact ClinicalTrials.gov identifier in-line as NCTID (e.g., NCT01234567). If a paper references a trial without an NCT number, find and include the correct NCTID or state “NCTID not assigned/locatable” after attempting an authority-first search.

// // Citation format

// // - FDA Guidance: “Exact Title (Month Year, current/superseded on <date>)” <FDA guidance URL>
// // Always show full URLs in citations (e.g., https://www.fda.gov/media/.../download). Never shorten to just (fda.gov).

// // - MAPP: “MAPP ####.# — Exact Title (current as of <date checked>)” <FDA/CDER URL>
// // - Federal Register, Drugs@FDA, DailyMed, EMA, PubMed: exact record titles with direct links.
// // - ClinicalTrials.gov: “Trial Title — NCT01234567” <NCT page URL>
// // Always show full URLs in citations (e.g., https://www.fda.gov/media/.../download). Never shorten to just (fda.gov).

// // Final sweep
// // - Before finalizing, perform a quick authority-first search to ensure no newer guidance/notice changes the answer. Update if needed.
// // - Do not ask to run searches. Just do them and produce a complete, self-contained answer.

// // Must be an actual answer not just a surface level output - provide a clear answer to the question with exact citations and links at the bottom with all sources and information. It needs to be structured and tailored to the user's request.
// // 3) Use authoritative sources (FDA guidance database, Federal Register, Drugs@FDA, ClinicalTrials.gov, PubMed, DailyMed, EMA) to construct a precise answer in FDA reviewer style.
// // 4) **For every guidance surfaced from any source, you MUST verify whether a newer/revised/superseding version exists** using current web search and FDA's guidance databases. If a document is superseded, cite the replacement.
// // 5) **Perform a final sweep** with authority-first queries to ensure no key documents were missed.
// // 6) **Every single document mentioned MUST include a direct link** (FDA or the issuing authority). No placeholders.
// // 7) Provide exact citations with links at the bottom.
// // Always show full URLs in citations (e.g., https://www.fda.gov/media/.../download). Never shorten to just (fda.gov).

// // Do not ask the user for permission to run additional searches—just do them.
// // If the report would have any "Would you like me to:" or "suggested next steps", don't show them to the user - just run it and add it to the report. It should be complete and self-contained. Anything that can make it better, you should do and run that instead of asking for the user's approval.


// // `,

//     tools: [
//         webSearchTool(), 
//         // GUIDANCE
//         fileSearchTool('vs_6902971bffc08191a0c2b6a505734284'),
//         // Add any additional tools here
//         // CGMP
//         fileSearchTool('vs_6900ece1b6248191ac9660e87342c80e'),
// // MAPP
//         fileSearchTool('vs_6900ee48a06c8191be2018a0f394441f'),
       
//     ],
// });

/**
 * Followup Detector Agent
 */
const followupDetectorAgent = new Agent({
  name: 'Followup Detection Agent',
  model: 'gpt-4o-mini',
  instructions: `You are a specialized agent that determines if a user query is a followup question that references previous search results or conversation context.

ANALYZE the query and conversation history to determine:
1. Is this a NEW search request (not a followup)?
2. Is this a FOLLOWUP that references previous data?

FOLLOWUP INDICATORS:
- Pronouns referencing previous data: "those trials", "these studies", "the results", "that data"
- Analysis requests on existing data: "analyze", "summarize", "compare", "show me statistics"
- Statistical queries: "how many", "average", "distribution", "breakdown", "percentage"
- Continuation phrases: "also", "additionally", "furthermore", "what about", "and"
- Filter/refine requests: "filter those", "only show", "exclude", "just the Phase 3 ones"
- Previous reference: "you showed", "you found", "earlier", "before"

NOT A FOLLOWUP:
- New drug/condition names not in previous context
- Explicit new search: "search for", "find", "look up"
- Topic change to unrelated area
- No previous data exists in conversation

RESPOND with JSON:
{
  "isFollowup": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation",
  "suggestedRoute": "stats" | "research" | null,
  "indicators": ["list", "of", "detected", "indicators"]
}

Route suggestions:
- "stats": For counting, aggregating, distributions, charts, filtering, comparisons
- "research": For deep analysis, efficacy review, safety assessment, protocol synthesis`,
});

/**
 * Followup Coordinator Agent
 */
const followupCoordinatorAgent = new Agent({
  name: 'Followup Coordinator Agent',
  model: 'gpt-4o-mini',
  instructions: `You route followup queries to the appropriate specialist agent.

ROUTING RULES:

→ STATS AGENT (for statistical analysis):
- Counting: "how many trials", "count", "total"
- Aggregation: "average enrollment", "mean", "median", "sum"
- Distribution: "breakdown by phase", "distribution", "by status"
- Filtering: "only Phase 3", "just recruiting", "exclude terminated"
- Charts: "chart", "graph", "visualize", "plot"
- Comparisons: "compare", "versus", "by sponsor type"
- Endpoints: "list endpoints", "primary outcomes", "how many placebo"
- Any statistical question about the data

→ RESEARCH PIPELINE (for deep analysis):
- Efficacy analysis: "analyze efficacy", "effectiveness", "outcomes"
- Safety assessment: "safety profile", "adverse events", "side effects"  
- Comprehensive review: "full analysis", "in-depth", "comprehensive"
- Cross-trial synthesis: "compare across", "synthesize", "aggregate findings"
- Protocol generation: "build a protocol", "design template", "based on these"
- Report generation: "generate report", "summary report"
- Complex multi-factor analysis

RESPOND with JSON:
{
  "route": "stats" | "research",
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`,
});

/**
 * Enhanced Stats Agent
 */
const statsAgent = new Agent({
  name: 'Statistical Analysis Agent',
  model: 'gpt-4o',
  instructions: `You are an expert biostatistician and clinical trials analyst. Your role is to interpret pre-computed statistical analyses and present them in clear, professional markdown.

You receive:
1. The user's question
2. Pre-computed statistical results (analyses array)
3. Chart data (will be rendered separately)
4. Query analysis showing detected intents

YOUR EXPERTISE INCLUDES:
- Clinical trial design (phases, randomization, blinding, arms)
- Endpoint analysis (primary, secondary, efficacy, safety)
- Enrollment and sample size statistics
- Geographic and sponsor distributions
- Adverse event and safety analysis
- Cross-tabulations and comparisons
- Trend analysis over time
- Protocol synthesis recommendations

RESPONSE FORMAT:
Write clear, professional markdown that:
1. **Directly answers** the user's question in the first 1-2 sentences
2. **Presents key statistics** with proper formatting (tables, bullets as appropriate)
3. **Highlights important findings** using bold for key numbers
4. **Notes data quality** (sample sizes, missing data, caveats)
5. **Provides context** for the numbers when helpful

CRITICAL RULES:
- Do NOT output raw JSON
- Do NOT describe charts (they render separately)
- DO use markdown tables for multi-column data
- DO use **bold** for key statistics
- Keep responses focused and professional
- Note sample sizes and data completeness
- If multiple analyses were performed, organize by section

EXAMPLE OUTPUT:
## Endpoint Analysis

Based on analysis of **127 clinical trials**, the dataset contains **412 primary endpoints** across all studies.

### Endpoint Categories
| Category | Count | Percentage |
|----------|-------|------------|
| Overall Survival | 89 | 21.6% |
| Progression-Free Survival | 67 | 16.3% |
| Response Rate | 54 | 13.1% |
| Safety/Tolerability | 48 | 11.7% |

### Key Findings
- Average of **3.2 primary endpoints** per trial
- **78%** of trials have posted results with endpoint data
- Phase 3 trials have the most diverse endpoint selection

**Note:** Endpoint categorization is based on keyword matching and may not capture all nuances.`,
});

/**
 * Research Pipeline Orchestrator
 */
const researchPipelineOrchestrator = new Agent({
  name: 'Research Pipeline Orchestrator',
  model: 'gpt-4o',
  instructions: `You orchestrate a multi-stage research pipeline for deep analysis of clinical trial data.

PIPELINE STAGES:
1. Question Refinement - Clarify the research question and define scope
2. Smart Filtering - Apply domain knowledge to filter relevant trials
3. Field Extraction - Extract only relevant fields to reduce data size
4. Batch Classification - Classify trials as relevant/not-relevant
5. Deep Analysis - Detailed analysis of relevant trials only
6. Report Aggregation - Synthesize findings into comprehensive report

YOUR ROLE:
- Determine which filters to apply based on the research question
- Identify which fields are needed for analysis
- Define classification criteria for relevance
- Guide the analysis focus

DOMAIN KNOWLEDGE:
- "Pivotal trials" = Phase 3 or Phase 4, interventional, typically randomized
- "Registration trials" = Phase 3, intended to support regulatory approval
- "Efficacy analysis" = Focus on primary outcomes, completed trials with results
- "Safety analysis" = Focus on adverse events, larger enrollment preferred
- "Protocol synthesis" = Aggregate design elements, endpoints, eligibility

OUTPUT FORMAT:
{
  "refinedQuestion": "Precise research question",
  "questionType": "efficacy" | "safety" | "landscape" | "comparison" | "protocol" | "general",
  "filters": {
    "phases": ["PHASE3", "PHASE4"] or null,
    "status": ["COMPLETED"] or null,
    "studyType": "INTERVENTIONAL" or null,
    "requiresResults": true/false
  },
  "relevantFields": ["list", "of", "field", "paths"],
  "classificationCriteria": "Criteria for YES/NO classification",
  "analysisInstructions": "What to focus on in deep analysis"
}`,
});

// ============================================================================
// SECTION 8: RESEARCH PIPELINE EXECUTION
// ============================================================================

/**
 * Execute the multi-stage research pipeline
 */
async function runResearchPipeline(query, rawData, conversationId) {
  const trials = rawData.clinicalTrials || [];
  
  const pipelineResult = {
    report: '',
    stages: [],
    trialsAnalyzed: 0,
    classificationBreakdown: { YES: 0, NO: 0, UNCERTAIN: 0 },
    costEstimate: {},
    citations: [],
    chartData: null,
    analyses: []
  };
  
  if (trials.length === 0) {
    pipelineResult.report = `## Research Analysis

No clinical trial data available for analysis. Please run a search query first to load trial data.`;
    return pipelineResult;
  }
  
  console.log(`[Research Pipeline] Starting analysis of ${trials.length} trials`);
  
  try {
    // Stage 1: Question Refinement
    const queryAnalysis = analyzeQueryIntent(query);
    pipelineResult.stages.push({
      stage: 1,
      name: 'Question Analysis',
      status: 'completed',
      result: queryAnalysis
    });
    
    // Determine analysis type
    let analysisType = 'general';
    if (/\b(efficacy|effectiveness|outcome|endpoint|primary|met|achieved)\b/i.test(query)) {
      analysisType = 'efficacy';
    } else if (/\b(safety|adverse|ae|sae|toxicity|side\s*effect)\b/i.test(query)) {
      analysisType = 'safety';
    } else if (/\b(protocol|template|design|build|create|generate)\b/i.test(query)) {
      analysisType = 'protocol';
    } else if (/\b(compare|comparison|versus|vs)\b/i.test(query)) {
      analysisType = 'comparison';
    }
    
    // Stage 2: Run comprehensive statistical analysis
    const statsResult = await executeStatisticalOperation(query, trials);
    pipelineResult.analyses = statsResult.analyses;
    pipelineResult.chartData = statsResult.chartData;
    
    pipelineResult.stages.push({
      stage: 2,
      name: 'Statistical Analysis',
      status: 'completed',
      result: { analysesPerformed: statsResult.analyses.map(a => a.type) }
    });
    
    // Stage 3: Generate report based on analysis type
    pipelineResult.trialsAnalyzed = trials.length;
    
    // Generate citations
    pipelineResult.citations = trials.slice(0, 25).map(t => ({
      type: 'clinicalTrial',
      id: getNestedValue(t, 'protocolSection.identificationModule.nctId'),
      title: getNestedValue(t, 'protocolSection.identificationModule.briefTitle'),
      url: `https://clinicaltrials.gov/study/${getNestedValue(t, 'protocolSection.identificationModule.nctId')}`,
      status: getNestedValue(t, 'protocolSection.statusModule.overallStatus'),
      phase: (getNestedValue(t, 'protocolSection.designModule.phases') || []).join(', '),
      sponsor: getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name')
    }));
    
    // Build comprehensive report
    pipelineResult.report = generateResearchReport(query, statsResult, analysisType, trials.length);
    
    pipelineResult.stages.push({
      stage: 3,
      name: 'Report Generation',
      status: 'completed'
    });
    
  } catch (err) {
    console.error('[Research Pipeline] Error:', err);
    pipelineResult.report = `## Research Analysis Error

An error occurred during the research pipeline: ${err.message}

Please try simplifying your query or ensuring sufficient trial data is loaded.`;
  }
  
  return pipelineResult;
}

/**
 * Generate comprehensive research report
 */
function generateResearchReport(query, statsResult, analysisType, totalTrials) {
  let report = `## Research Analysis Report

### Research Question
${query}

### Dataset Overview
- **Total Trials Analyzed**: ${totalTrials}
- **Analysis Types Performed**: ${statsResult.analyses.map(a => a.title).join(', ')}

`;

  // Add analysis-specific sections
  for (const analysis of statsResult.analyses) {
    report += `### ${analysis.title}\n\n`;
    
    switch (analysis.type) {
      case 'endpoints':
        const ep = analysis.data;
        report += `| Metric | Value |
|--------|-------|
| Total Primary Endpoints | ${ep.summary.totalPrimaryEndpoints} |
| Total Secondary Endpoints | ${ep.summary.totalSecondaryEndpoints} |
| Avg Primary per Trial | ${ep.summary.avgPrimaryPerTrial} |
| Trials with Results | ${ep.summary.trialsWithResults} |

**Top Endpoint Categories:**
${Object.entries(ep.endpointCategories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => `- ${cat}: ${count}`).join('\n')}

`;
        break;
        
      case 'placebo':
        const pl = analysis.data;
        report += `| Metric | Value |
|--------|-------|
| Placebo-Controlled Trials | ${pl.summary.placeboControlled} (${pl.summary.placeboPercentage}%) |
| Active Comparator Trials | ${pl.summary.activeComparator} (${pl.summary.activeComparatorPercentage}%) |
| Single-Arm Trials | ${pl.summary.singleArm} |
| Multi-Arm Trials | ${pl.summary.multiArm} |

`;
        break;
        
      case 'enrollment':
        const en = analysis.data.statistics;
        report += `| Statistic | Value |
|-----------|-------|
| Mean | ${en.mean?.toLocaleString() || 'N/A'} |
| Median | ${en.median?.toLocaleString() || 'N/A'} |
| Min | ${en.min?.toLocaleString() || 'N/A'} |
| Max | ${en.max?.toLocaleString() || 'N/A'} |
| Std Dev | ${en.stdDev?.toLocaleString() || 'N/A'} |
| Total | ${en.sum?.toLocaleString() || 'N/A'} |

`;
        break;
        
      case 'geographic':
        const geo = analysis.data;
        report += `| Metric | Value |
|--------|-------|
| Total Sites | ${geo.summary.totalSites} |
| Countries | ${geo.summary.totalCountries} |
| Avg Sites/Trial | ${geo.summary.avgSitesPerTrial} |
| Multinational | ${geo.summary.multinationalTrials} |

**Top Countries:**
${geo.topCountries.slice(0, 10).map(c => `- ${c.country}: ${c.count} trials`).join('\n')}

`;
        break;
        
      case 'safety':
        const sf = analysis.data;
        report += `| Metric | Value |
|--------|-------|
| Trials with AE Data | ${sf.summary.trialsWithAEData} |
| Trials with SAE Data | ${sf.summary.trialsWithSAEData} |
| Total Serious Events | ${sf.summary.totalSeriousEvents} |
| Total Other Events | ${sf.summary.totalOtherEvents} |

**Most Common SAEs:**
${sf.topSAEs.slice(0, 5).map(e => `- ${e.term}: ${e.count}`).join('\n')}

`;
        break;
        
      case 'protocolSynthesis':
        const ps = analysis.data;
        report += `#### Recommended Design
| Element | Recommendation |
|---------|----------------|
| Phase | ${ps.recommendedDesign.phase} |
| Allocation | ${ps.recommendedDesign.allocation} |
| Model | ${ps.recommendedDesign.interventionModel} |
| Masking | ${ps.recommendedDesign.masking} |
| Enrollment | ${ps.recommendedDesign.enrollmentTarget} |
| Duration | ${ps.recommendedDesign.estimatedDuration} |

#### Suggested Primary Endpoints
${ps.suggestedEndpoints.primary.slice(0, 3).map((e, i) => `${i + 1}. ${e.measure} (used in ${e.usedInTrials} trials)`).join('\n')}

#### Eligibility Template
- Minimum Age: ${ps.eligibilityTemplate.suggestedMinAge}
- Maximum Age: ${ps.eligibilityTemplate.suggestedMaxAge}
- Sex: ${ps.eligibilityTemplate.sex}

`;
        break;
        
      default:
        // Generic distribution display
        if (analysis.data.distribution) {
          report += `| Value | Count | % |
|-------|-------|---|
${analysis.data.distribution.slice(0, 10).map(d => `| ${d.value} | ${d.count} | ${d.percentage}% |`).join('\n')}

`;
        }
    }
  }
  
  report += `---
*Report generated by Leaf Intelligence Research Pipeline*
*Date: ${new Date().toISOString().split('T')[0]}*
`;
  
  return report;
}

// ============================================================================
// SECTION 9: CITATION GENERATION
// ============================================================================

/**
 * Generate citations from tool results
 */
function generateCitations(toolResults) {
  const citations = [];
  
  // Clinical Trials citations
  if (toolResults.clinicalTrials?.raw && Array.isArray(toolResults.clinicalTrials.raw)) {
    toolResults.clinicalTrials.raw.forEach(trial => {
      const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
      const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
      const status = getNestedValue(trial, 'protocolSection.statusModule.overallStatus');
      const phases = getNestedValue(trial, 'protocolSection.designModule.phases');
      const sponsor = getNestedValue(trial, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name');
      const enrollment = getNestedValue(trial, 'protocolSection.designModule.enrollmentInfo.count');
      
      if (nctId) {
        citations.push({
          type: 'clinicalTrial',
          id: nctId,
          title: title || 'Untitled Study',
          url: `https://clinicaltrials.gov/study/${nctId}`,
          status: status || 'Unknown',
          phase: Array.isArray(phases) ? phases.join(', ') : 'N/A',
          sponsor: sponsor || 'Unknown',
          enrollment: enrollment || 'N/A',
          source: 'ClinicalTrials.gov'
        });
      }
    });
  }
  
  // PubMed citations
  if (toolResults.pubmed?.raw && Array.isArray(toolResults.pubmed.raw)) {
    toolResults.pubmed.raw.forEach(article => {
      if (article.pmid) {
        citations.push({
          type: 'pubmed',
          id: article.pmid,
          title: article.title || 'Untitled Article',
          url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
          authors: Array.isArray(article.authors) ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ' et al.' : '') : 'Unknown',
          journal: article.journal || 'Unknown Journal',
          pubDate: article.pubDate || 'Unknown Date',
          doi: article.doi ? `https://doi.org/${article.doi}` : null,
          source: 'PubMed'
        });
      }
    });
  }
  
  // FDA citations
  if (toolResults.fda?.raw && Array.isArray(toolResults.fda.raw)) {
    toolResults.fda.raw.forEach(drug => {
      const appNum = drug.application_number;
      if (appNum) {
        citations.push({
          type: 'fda',
          id: appNum,
          title: drug.openfda?.brand_name?.[0] || drug.products?.[0]?.brand_name || appNum,
          url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNum.replace(/[^0-9]/g, '')}`,
          sponsor: drug.sponsor_name || 'Unknown',
          genericName: drug.openfda?.generic_name?.[0] || 'N/A',
          source: 'FDA Drugs@FDA'
        });
      }
    });
  }
  
  // Orange Book citations
  if (toolResults.orangeBook?.raw && Array.isArray(toolResults.orangeBook.raw)) {
    toolResults.orangeBook.raw.forEach(group => {
      const brandedProducts = group.brandedProducts || [];
      brandedProducts.forEach(product => {
        if (product.applNo) {
          citations.push({
            type: 'orangeBook',
            id: product.applNo,
            title: product.tradeName || group.ingredient,
            url: `https://www.accessdata.fda.gov/scripts/cder/ob/results_product.cfm?Appl_Type=N&Appl_No=${product.applNo.replace(/[^0-9]/g, '')}`,
            ingredient: group.ingredient,
            applicant: product.applicant || 'Unknown',
            teCode: product.teCode || 'N/A',
            source: 'FDA Orange Book'
          });
        }
      });
    });
  }
  
  return citations;
}

// ============================================================================
// SECTION 10: EXPORTS
// ============================================================================

module.exports = {
  // Agents
  followupDetectorAgent,
  followupCoordinatorAgent,
  statsAgent,
  researchPipelineOrchestrator,
  
  
  // Schema & Registry
  FIELD_REGISTRY,
  QUERY_INTENT_PATTERNS,
  
  // Main Functions
  executeStatisticalOperation,
  runResearchPipeline,
  generateCitations,
  analyzeQueryIntent,
  
  // Analyzers
  EndpointAnalyzer,
  PlaceboAnalyzer,
  SafetyAnalyzer,
  GeographicAnalyzer,
  ProtocolSynthesizer,
  
  // Statistics Engine
  StatisticsEngine,
  
  // Utilities
  getNestedValue,
  extractTrialFields,
  parseAgeToMonths,
  parseDate,
  calculateDurationDays,
  // lessdeepAgent
};

// /**
//  * ================================================================================
//  * LEAF INTELLIGENCE - ADVANCED AGENT SYSTEM
//  * ================================================================================
//  * 
//  * Comprehensive agent definitions for intelligent regulatory analysis.
//  * 
//  * AGENTS:
//  * 1. Followup Detector Agent - Determines if query references previous data
//  * 2. Followup Coordinator Agent - Routes to Stats or Research pipeline
//  * 3. Stats Agent - Statistical analysis expert with full schema knowledge
//  * 4. Research Pipeline Orchestrator - Multi-stage cost-effective analysis
//  * 
//  * MODULES:
//  * - Complete ClinicalTrials.gov Schema
//  * - Statistical Operation Execution
//  * - Research Pipeline Stages
//  * - Citation Generation
//  * - Data Extraction Utilities
//  * 
//  * @author Leaf Intelligence Team
//  * @version 2.0.0
//  */

// const { Agent, run } = require('@openai/agents');

// // ============================================
// // COMPLETE CLINICALTRIALS.GOV SCHEMA
// // ============================================

// /**
//  * Comprehensive schema of all fields in ClinicalTrials.gov API v2 response
//  * This schema is used by agents to understand available data and perform accurate analysis
//  */
// const CLINICAL_TRIALS_SCHEMA = {
//   // ========================================
//   // PROTOCOL SECTION
//   // ========================================
//   protocolSection: {
//     // Study Identification
//     identificationModule: {
//       nctId: { type: 'string', description: 'Unique NCT identifier (e.g., NCT12345678)', example: 'NCT05123456' },
//       orgStudyIdInfo: {
//         id: { type: 'string', description: 'Organization study ID' },
//         type: { type: 'enum', values: ['OTHER', 'REGISTRY', 'EudraCT'], description: 'ID type' }
//       },
//       secondaryIdInfos: {
//         type: 'array',
//         items: {
//           id: { type: 'string' },
//           type: { type: 'string' },
//           domain: { type: 'string' }
//         }
//       },
//       organization: {
//         fullName: { type: 'string', description: 'Organization full name' },
//         class: { type: 'enum', values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'AMBIG', 'OTHER', 'UNKNOWN'], description: 'Organization class' }
//       },
//       briefTitle: { type: 'string', description: 'Brief study title (max 300 chars)', searchable: true },
//       officialTitle: { type: 'string', description: 'Full official title' },
//       acronym: { type: 'string', description: 'Study acronym' }
//     },

//     // Status Information
//     statusModule: {
//       statusVerifiedDate: { type: 'date', format: 'YYYY-MM', description: 'Date status was last verified' },
//       overallStatus: {
//         type: 'enum',
//         values: [
//           'ACTIVE_NOT_RECRUITING',
//           'COMPLETED',
//           'ENROLLING_BY_INVITATION',
//           'NOT_YET_RECRUITING',
//           'RECRUITING',
//           'SUSPENDED',
//           'TERMINATED',
//           'WITHDRAWN',
//           'AVAILABLE',
//           'NO_LONGER_AVAILABLE',
//           'TEMPORARILY_NOT_AVAILABLE',
//           'APPROVED_FOR_MARKETING',
//           'WITHHELD',
//           'UNKNOWN'
//         ],
//         description: 'Current recruitment status',
//         filterable: true
//       },
//       lastKnownStatus: { type: 'string', description: 'Last known status for older studies' },
//       expandedAccessInfo: {
//         hasExpandedAccess: { type: 'boolean' },
//         expandedAccessNCTId: { type: 'string' },
//         expandedAccessStatusForNCTId: { type: 'string' }
//       },
//       startDateStruct: {
//         date: { type: 'date', description: 'Study start date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       primaryCompletionDateStruct: {
//         date: { type: 'date', description: 'Primary completion date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       completionDateStruct: {
//         date: { type: 'date', description: 'Study completion date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       studyFirstSubmitDate: { type: 'date', description: 'First submitted to ClinicalTrials.gov' },
//       studyFirstPostDateStruct: {
//         date: { type: 'date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       resultsFirstSubmitDate: { type: 'date' },
//       resultsFirstPostDateStruct: {
//         date: { type: 'date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       lastUpdateSubmitDate: { type: 'date' },
//       lastUpdatePostDateStruct: {
//         date: { type: 'date' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       }
//     },

//     // Sponsor/Collaborators Module
//     sponsorCollaboratorsModule: {
//       responsibleParty: {
//         type: { type: 'enum', values: ['SPONSOR', 'PRINCIPAL_INVESTIGATOR', 'SPONSOR_INVESTIGATOR'] },
//         investigatorFullName: { type: 'string' },
//         investigatorTitle: { type: 'string' },
//         investigatorAffiliation: { type: 'string' }
//       },
//       leadSponsor: {
//         name: { type: 'string', description: 'Lead sponsor organization name' },
//         class: { 
//           type: 'enum', 
//           values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'OTHER', 'UNKNOWN'],
//           description: 'Sponsor classification - CRITICAL for industry vs academic analysis'
//         }
//       },
//       collaborators: {
//         type: 'array',
//         items: {
//           name: { type: 'string' },
//           class: { type: 'enum', values: ['NIH', 'FED', 'OTHER_GOV', 'INDUSTRY', 'NETWORK', 'OTHER', 'UNKNOWN'] }
//         }
//       }
//     },

//     // Oversight Module
//     oversightModule: {
//       oversightHasDmc: { type: 'boolean', description: 'Has Data Monitoring Committee' },
//       isFdaRegulatedDrug: { type: 'boolean', description: 'FDA regulated drug study' },
//       isFdaRegulatedDevice: { type: 'boolean', description: 'FDA regulated device study' },
//       isUnapprovedDevice: { type: 'boolean' },
//       isPpsd: { type: 'boolean', description: 'Pediatric postmarket surveillance' },
//       isUsExport: { type: 'boolean' },
//       fdaaa801Violation: { type: 'boolean', description: 'Has FDAAA 801 violation' }
//     },

//     // Description Module
//     descriptionModule: {
//       briefSummary: { type: 'string', description: 'Brief summary of study (max 5000 chars)' },
//       detailedDescription: { type: 'string', description: 'Detailed description' }
//     },

//     // Conditions Module
//     conditionsModule: {
//       conditions: { 
//         type: 'array', 
//         items: { type: 'string' },
//         description: 'Conditions/diseases being studied'
//       },
//       keywords: { 
//         type: 'array', 
//         items: { type: 'string' },
//         description: 'Study keywords'
//       }
//     },

//     // Design Module - CRITICAL FOR ANALYSIS
//     designModule: {
//       studyType: { 
//         type: 'enum', 
//         values: ['INTERVENTIONAL', 'OBSERVATIONAL', 'EXPANDED_ACCESS'],
//         description: 'Type of study'
//       },
//       nctIdAliases: { type: 'array', items: { type: 'string' } },
//       phases: { 
//         type: 'array',
//         items: {
//           type: 'enum',
//           values: ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA']
//         },
//         description: 'Study phase(s) - CRITICAL for filtering pivotal trials'
//       },
//       designInfo: {
//         allocation: { 
//           type: 'enum', 
//           values: ['RANDOMIZED', 'NON_RANDOMIZED', 'NA'],
//           description: 'Allocation method'
//         },
//         interventionModel: {
//           type: 'enum',
//           values: ['SINGLE_GROUP', 'PARALLEL', 'CROSSOVER', 'FACTORIAL', 'SEQUENTIAL'],
//           description: 'Intervention model'
//         },
//         interventionModelDescription: { type: 'string' },
//         primaryPurpose: {
//           type: 'enum',
//           values: ['TREATMENT', 'PREVENTION', 'DIAGNOSTIC', 'ECT', 'SUPPORTIVE_CARE', 'SCREENING', 'HEALTH_SERVICES_RESEARCH', 'BASIC_SCIENCE', 'DEVICE_FEASIBILITY', 'OTHER'],
//           description: 'Primary purpose of study'
//         },
//         observationalModel: {
//           type: 'enum',
//           values: ['COHORT', 'CASE_CONTROL', 'CASE_ONLY', 'CASE_CROSSOVER', 'ECOLOGIC_OR_COMMUNITY', 'FAMILY_BASED', 'DEFINED_POPULATION', 'NATURAL_HISTORY', 'OTHER']
//         },
//         timePerspective: {
//           type: 'enum',
//           values: ['PROSPECTIVE', 'RETROSPECTIVE', 'CROSS_SECTIONAL', 'OTHER']
//         },
//         maskingInfo: {
//           masking: { 
//             type: 'enum', 
//             values: ['NONE', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE'],
//             description: 'Blinding level'
//           },
//           maskingDescription: { type: 'string' },
//           whoMasked: {
//             type: 'array',
//             items: {
//               type: 'enum',
//               values: ['PARTICIPANT', 'CARE_PROVIDER', 'INVESTIGATOR', 'OUTCOMES_ASSESSOR']
//             }
//           }
//         }
//       },
//       bioSpec: {
//         retention: { type: 'enum', values: ['NONE_RETAINED', 'SAMPLES_WITH_DNA', 'SAMPLES_WITHOUT_DNA'] },
//         description: { type: 'string' }
//       },
//       enrollmentInfo: {
//         count: { type: 'integer', description: 'Target or actual enrollment number - KEY METRIC' },
//         type: { type: 'enum', values: ['ACTUAL', 'ESTIMATED'] }
//       },
//       targetDuration: { type: 'string', description: 'Target study duration' },
//       numberOfGroups: { type: 'integer', description: 'Number of study groups/cohorts' }
//     },

//     // Arms and Interventions Module - CRITICAL FOR PLACEBO ANALYSIS
//     armsInterventionsModule: {
//       armGroups: {
//         type: 'array',
//         items: {
//           label: { type: 'string', description: 'Arm label/name' },
//           type: { 
//             type: 'enum', 
//             values: ['EXPERIMENTAL', 'ACTIVE_COMPARATOR', 'PLACEBO_COMPARATOR', 'SHAM_COMPARATOR', 'NO_INTERVENTION', 'OTHER'],
//             description: 'Arm type - PLACEBO_COMPARATOR indicates placebo-controlled trial'
//           },
//           description: { type: 'string' },
//           interventionNames: { type: 'array', items: { type: 'string' } }
//         },
//         description: 'Study arms - check type for PLACEBO_COMPARATOR'
//       },
//       interventions: {
//         type: 'array',
//         items: {
//           type: { 
//             type: 'enum', 
//             values: ['DRUG', 'DEVICE', 'BIOLOGICAL', 'PROCEDURE', 'RADIATION', 'BEHAVIORAL', 'GENETIC', 'DIETARY_SUPPLEMENT', 'COMBINATION_PRODUCT', 'DIAGNOSTIC_TEST', 'OTHER'],
//             description: 'Intervention type'
//           },
//           name: { type: 'string', description: 'Intervention name' },
//           description: { type: 'string' },
//           armGroupLabels: { type: 'array', items: { type: 'string' } },
//           otherNames: { type: 'array', items: { type: 'string' } }
//         }
//       }
//     },

//     // Outcomes Module - CRITICAL FOR EFFICACY ANALYSIS
//     outcomesModule: {
//       primaryOutcomes: {
//         type: 'array',
//         items: {
//           measure: { type: 'string', description: 'Primary outcome measure name' },
//           description: { type: 'string', description: 'Outcome description' },
//           timeFrame: { type: 'string', description: 'Time frame for measurement' }
//         },
//         description: 'Primary endpoints'
//       },
//       secondaryOutcomes: {
//         type: 'array',
//         items: {
//           measure: { type: 'string' },
//           description: { type: 'string' },
//           timeFrame: { type: 'string' }
//         },
//         description: 'Secondary endpoints'
//       },
//       otherOutcomes: {
//         type: 'array',
//         items: {
//           measure: { type: 'string' },
//           description: { type: 'string' },
//           timeFrame: { type: 'string' }
//         }
//       }
//     },

//     // Eligibility Module
//     eligibilityModule: {
//       eligibilityCriteria: { type: 'string', description: 'Full eligibility criteria text' },
//       healthyVolunteers: { type: 'boolean', description: 'Accepts healthy volunteers' },
//       sex: { type: 'enum', values: ['FEMALE', 'MALE', 'ALL'] },
//       genderBased: { type: 'boolean' },
//       genderDescription: { type: 'string' },
//       minimumAge: { type: 'string', description: 'Minimum age (e.g., "18 Years")' },
//       maximumAge: { type: 'string', description: 'Maximum age (e.g., "65 Years")' },
//       stdAges: {
//         type: 'array',
//         items: {
//           type: 'enum',
//           values: ['CHILD', 'ADULT', 'OLDER_ADULT']
//         }
//       },
//       studyPopulation: { type: 'string' },
//       samplingMethod: { type: 'enum', values: ['PROBABILITY_SAMPLE', 'NON_PROBABILITY_SAMPLE'] }
//     },

//     // Contacts and Locations Module
//     contactsLocationsModule: {
//       centralContacts: {
//         type: 'array',
//         items: {
//           name: { type: 'string' },
//           role: { type: 'enum', values: ['CONTACT', 'PRINCIPAL_INVESTIGATOR', 'STUDY_CHAIR', 'STUDY_DIRECTOR', 'SUB_INVESTIGATOR'] },
//           phone: { type: 'string' },
//           phoneExt: { type: 'string' },
//           email: { type: 'string' }
//         }
//       },
//       overallOfficials: {
//         type: 'array',
//         items: {
//           name: { type: 'string' },
//           affiliation: { type: 'string' },
//           role: { type: 'enum', values: ['PRINCIPAL_INVESTIGATOR', 'STUDY_CHAIR', 'STUDY_DIRECTOR', 'SUB_INVESTIGATOR'] }
//         }
//       },
//       locations: {
//         type: 'array',
//         items: {
//           facility: { type: 'string', description: 'Facility name' },
//           status: { type: 'enum', values: ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED', 'TERMINATED'] },
//           city: { type: 'string' },
//           state: { type: 'string' },
//           zip: { type: 'string' },
//           country: { type: 'string', description: 'Country name - use for geographic analysis' },
//           geoPoint: {
//             lat: { type: 'number' },
//             lon: { type: 'number' }
//           },
//           contacts: { type: 'array' }
//         },
//         description: 'Study locations - use for country/geographic distribution'
//       }
//     },

//     // References Module
//     referencesModule: {
//       references: {
//         type: 'array',
//         items: {
//           pmid: { type: 'string', description: 'PubMed ID' },
//           type: { type: 'enum', values: ['BACKGROUND', 'RESULT', 'DERIVED'] },
//           citation: { type: 'string' }
//         }
//       },
//       seeAlsoLinks: {
//         type: 'array',
//         items: {
//           label: { type: 'string' },
//           url: { type: 'string' }
//         }
//       },
//       availIpds: {
//         type: 'array',
//         items: {
//           id: { type: 'string' },
//           type: { type: 'string' },
//           url: { type: 'string' },
//           comment: { type: 'string' }
//         }
//       }
//     },

//     // IPD Sharing Statement Module
//     ipdSharingStatementModule: {
//       ipdSharing: { type: 'enum', values: ['YES', 'NO', 'UNDECIDED'] },
//       description: { type: 'string' },
//       infoTypes: { type: 'array', items: { type: 'string' } },
//       timeFrame: { type: 'string' },
//       accessCriteria: { type: 'string' },
//       url: { type: 'string' }
//     }
//   },

//   // ========================================
//   // RESULTS SECTION (for completed trials)
//   // ========================================
//   resultsSection: {
//     participantFlowModule: {
//       preAssignmentDetails: { type: 'string' },
//       recruitmentDetails: { type: 'string' },
//       groups: { type: 'array' },
//       periods: { type: 'array' }
//     },
//     baselineCharacteristicsModule: {
//       populationDescription: { type: 'string' },
//       groups: { type: 'array' },
//       denoms: { type: 'array' },
//       measures: { type: 'array' }
//     },
//     outcomeMeasuresModule: {
//       outcomeMeasures: {
//         type: 'array',
//         items: {
//           type: { type: 'enum', values: ['PRIMARY', 'SECONDARY', 'OTHER_PRE_SPECIFIED', 'POST_HOC'] },
//           title: { type: 'string' },
//           description: { type: 'string' },
//           populationDescription: { type: 'string' },
//           reportingStatus: { type: 'enum', values: ['POSTED', 'NOT_POSTED'] },
//           paramType: { type: 'string' },
//           dispersionType: { type: 'string' },
//           unitOfMeasure: { type: 'string' },
//           timeFrame: { type: 'string' },
//           groups: { type: 'array' },
//           denoms: { type: 'array' },
//           classes: { type: 'array' },
//           analyses: { type: 'array' }
//         }
//       }
//     },
//     adverseEventsModule: {
//       frequencyThreshold: { type: 'string' },
//       timeFrame: { type: 'string' },
//       description: { type: 'string' },
//       eventGroups: { type: 'array' },
//       seriousEvents: { type: 'array' },
//       otherEvents: { type: 'array' }
//     },
//     moreInfoModule: {
//       certainAgreement: { type: 'object' },
//       pointOfContact: { type: 'object' }
//     }
//   },

//   // ========================================
//   // DERIVED SECTION
//   // ========================================
//   derivedSection: {
//     miscInfoModule: {
//       versionHolder: { type: 'date' },
//       removedCountries: { type: 'array', items: { type: 'string' } },
//       modelPredictions: { type: 'object' }
//     },
//     conditionBrowseModule: {
//       meshes: { type: 'array' },
//       ancestors: { type: 'array' },
//       browseLeaves: { type: 'array' },
//       browseBranches: { type: 'array' }
//     },
//     interventionBrowseModule: {
//       meshes: { type: 'array' },
//       ancestors: { type: 'array' },
//       browseLeaves: { type: 'array' },
//       browseBranches: { type: 'array' }
//     }
//   },

//   // ========================================
//   // DOCUMENT SECTION
//   // ========================================
//   documentSection: {
//     largeDocs: {
//       type: 'array',
//       items: {
//         typeAbbrev: { type: 'string' },
//         hasProtocol: { type: 'boolean' },
//         hasSap: { type: 'boolean' },
//         hasIcf: { type: 'boolean' },
//         label: { type: 'string' },
//         date: { type: 'date' },
//         uploadDate: { type: 'date' },
//         filename: { type: 'string' },
//         size: { type: 'integer' }
//       }
//     }
//   },

//   // ========================================
//   // TOP-LEVEL FLAGS
//   // ========================================
//   hasResults: { type: 'boolean', description: 'Whether trial has posted results' }
// };

// /**
//  * Common field path mappings for quick reference
//  */
// const FIELD_PATH_MAPPINGS = {
//   // Identification
//   nctId: 'protocolSection.identificationModule.nctId',
//   briefTitle: 'protocolSection.identificationModule.briefTitle',
//   officialTitle: 'protocolSection.identificationModule.officialTitle',
//   acronym: 'protocolSection.identificationModule.acronym',
  
//   // Status
//   overallStatus: 'protocolSection.statusModule.overallStatus',
//   startDate: 'protocolSection.statusModule.startDateStruct.date',
//   completionDate: 'protocolSection.statusModule.completionDateStruct.date',
//   primaryCompletionDate: 'protocolSection.statusModule.primaryCompletionDateStruct.date',
  
//   // Design
//   studyType: 'protocolSection.designModule.studyType',
//   phases: 'protocolSection.designModule.phases',
//   allocation: 'protocolSection.designModule.designInfo.allocation',
//   interventionModel: 'protocolSection.designModule.designInfo.interventionModel',
//   primaryPurpose: 'protocolSection.designModule.designInfo.primaryPurpose',
//   masking: 'protocolSection.designModule.designInfo.maskingInfo.masking',
//   enrollment: 'protocolSection.designModule.enrollmentInfo.count',
//   enrollmentType: 'protocolSection.designModule.enrollmentInfo.type',
  
//   // Sponsor
//   leadSponsorName: 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name',
//   leadSponsorClass: 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class',
//   collaborators: 'protocolSection.sponsorCollaboratorsModule.collaborators',
  
//   // Conditions
//   conditions: 'protocolSection.conditionsModule.conditions',
//   keywords: 'protocolSection.conditionsModule.keywords',
  
//   // Arms/Interventions
//   armGroups: 'protocolSection.armsInterventionsModule.armGroups',
//   interventions: 'protocolSection.armsInterventionsModule.interventions',
  
//   // Outcomes
//   primaryOutcomes: 'protocolSection.outcomesModule.primaryOutcomes',
//   secondaryOutcomes: 'protocolSection.outcomesModule.secondaryOutcomes',
  
//   // Eligibility
//   eligibilityCriteria: 'protocolSection.eligibilityModule.eligibilityCriteria',
//   minimumAge: 'protocolSection.eligibilityModule.minimumAge',
//   maximumAge: 'protocolSection.eligibilityModule.maximumAge',
//   sex: 'protocolSection.eligibilityModule.sex',
//   healthyVolunteers: 'protocolSection.eligibilityModule.healthyVolunteers',
  
//   // Locations
//   locations: 'protocolSection.contactsLocationsModule.locations',
  
//   // Description
//   briefSummary: 'protocolSection.descriptionModule.briefSummary',
//   detailedDescription: 'protocolSection.descriptionModule.detailedDescription',
  
//   // Oversight
//   hasDmc: 'protocolSection.oversightModule.oversightHasDmc',
//   isFdaRegulatedDrug: 'protocolSection.oversightModule.isFdaRegulatedDrug',
//   isFdaRegulatedDevice: 'protocolSection.oversightModule.isFdaRegulatedDevice',
  
//   // Results
//   hasResults: 'hasResults',
//   outcomeMeasures: 'resultsSection.outcomeMeasuresModule.outcomeMeasures',
//   adverseEvents: 'resultsSection.adverseEventsModule'
// };

// // ============================================
// // UTILITY FUNCTIONS
// // ============================================

// /**
//  * Get nested value from object using dot notation
//  * Supports array access like "armGroups[0].type"
//  */
// function getNestedValue(obj, path) {
//   if (!obj || !path) return undefined;
  
//   const parts = path.split('.');
//   let current = obj;
  
//   for (const part of parts) {
//     if (current === null || current === undefined) return undefined;
    
//     // Handle array notation like "armGroups[0]"
//     const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
//     if (arrayMatch) {
//       current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
//     } else {
//       current = current[part];
//     }
//   }
  
//   return current;
// }

// /**
//  * Set nested value in object using dot notation
//  */
// function setNestedValue(obj, path, value) {
//   if (!obj || !path) return;
  
//   const parts = path.split('.');
//   let current = obj;
  
//   for (let i = 0; i < parts.length - 1; i++) {
//     const part = parts[i];
//     if (!(part in current)) {
//       current[part] = {};
//     }
//     current = current[part];
//   }
  
//   current[parts[parts.length - 1]] = value;
// }

// /**
//  * Parse age string to months for comparison
//  */
// function parseAgeToMonths(ageStr) {
//   if (!ageStr) return null;
  
//   const match = ageStr.match(/(\d+)\s*(year|month|week|day)/i);
//   if (!match) return null;
  
//   const value = parseInt(match[1]);
//   const unit = match[2].toLowerCase();
  
//   switch (unit) {
//     case 'year': return value * 12;
//     case 'month': return value;
//     case 'week': return value / 4.33;
//     case 'day': return value / 30.44;
//     default: return null;
//   }
// }

// /**
//  * Extract number from various formats
//  */
// function extractNumber(value) {
//   if (typeof value === 'number') return value;
//   if (typeof value === 'string') {
//     const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
//     return isNaN(num) ? null : num;
//   }
//   return null;
// }

// // ============================================
// // FOLLOWUP DETECTOR AGENT
// // ============================================

// const followupDetectorAgent = new Agent({
//   name: 'Followup Detection Agent',
//   model: 'gpt-4o-mini',
//   instructions: `You are a specialized agent that determines if a user query is a followup question that references previous search results or conversation context.

// ANALYZE the query and conversation history to determine:
// 1. Is this a NEW search request (not a followup)?
// 2. Is this a FOLLOWUP that references previous data?

// FOLLOWUP INDICATORS:
// - Pronouns referencing previous data: "those trials", "these studies", "the results", "that data"
// - Analysis requests on existing data: "analyze", "summarize", "compare", "show me statistics"
// - Statistical queries: "how many", "average", "distribution", "breakdown", "percentage"
// - Continuation phrases: "also", "additionally", "furthermore", "what about", "and"
// - Filter/refine requests: "filter those", "only show", "exclude", "just the Phase 3 ones"
// - Previous reference: "you showed", "you found", "earlier", "before"

// NOT A FOLLOWUP:
// - New drug/condition names not in previous context
// - Explicit new search: "search for", "find", "look up"
// - Topic change to unrelated area
// - No previous data exists in conversation

// RESPOND with JSON:
// {
//   "isFollowup": boolean,
//   "confidence": number (0-1),
//   "reasoning": "brief explanation",
//   "suggestedRoute": "stats" | "research" | null,
//   "indicators": ["list", "of", "detected", "indicators"]
// }

// Route suggestions:
// - "stats": For counting, aggregating, distributions, charts, filtering
// - "research": For deep analysis, efficacy review, safety assessment, comprehensive reports`,
// });

// // ============================================
// // FOLLOWUP COORDINATOR AGENT
// // ============================================

// const followupCoordinatorAgent = new Agent({
//   name: 'Followup Coordinator Agent',
//   model: 'gpt-4o-mini',
//   instructions: `You route followup queries to the appropriate specialist agent.

// ROUTING RULES:

// → STATS AGENT (for statistical analysis):
// - Counting: "how many trials", "count", "total"
// - Aggregation: "average enrollment", "mean", "median", "sum"
// - Distribution: "breakdown by phase", "distribution", "by status"
// - Filtering: "only Phase 3", "just recruiting", "exclude terminated"
// - Charts: "chart", "graph", "visualize", "plot"
// - Simple queries about specific fields

// → RESEARCH PIPELINE (for deep analysis):
// - Efficacy analysis: "analyze efficacy", "effectiveness", "outcomes"
// - Safety assessment: "safety profile", "adverse events", "side effects"  
// - Comprehensive review: "full analysis", "in-depth", "comprehensive"
// - Cross-trial synthesis: "compare across", "synthesize", "aggregate findings"
// - Report generation: "generate report", "summary report"
// - Complex multi-factor analysis

// RESPOND with JSON:
// {
//   "route": "stats" | "research",
//   "confidence": number (0-1),
//   "reasoning": "brief explanation"
// }`,
// });

// // ============================================
// // STATS AGENT
// // ============================================

// const statsAgent = new Agent({
//   name: 'Statistical Analysis Agent',
//   model: 'gpt-4o',
//   instructions: `You are an expert statistical analyst explaining clinical trial data findings.

// Your job is to write CLEAR, PROFESSIONAL MARKDOWN explanations of statistical results that have already been computed.

// You will receive:
// 1. The user's question
// 2. Pre-computed statistics (the actual analysis is done separately)
// 3. Sample size information

// YOUR TASK:
// Write a clear, readable markdown explanation that:
// - Directly answers the user's question in the first sentence
// - Presents key numbers in a readable format (not raw JSON)
// - Notes important caveats about data completeness
// - Is concise: 2-4 paragraphs maximum

// CRITICAL RULES:
// - Do NOT output JSON or code blocks
// - Do NOT describe charts (they are shown separately)
// - Do NOT repeat the raw statistics - interpret them
// - DO use markdown formatting: **bold** for key numbers, bullet points sparingly
// - DO mention sample sizes and data completeness

// EXAMPLE OUTPUT:
// "Based on analysis of **47 clinical trials**, approximately **38% are Phase 3 studies** (18 trials), making this the most common phase in the dataset.

// The phase distribution shows:
// - Phase 3: 18 trials (38%)
// - Phase 2: 14 trials (30%)
// - Phase 1: 10 trials (21%)
// - Phase 4: 5 trials (11%)

// **Note:** Phase information was available for all 47 trials. Some trials span multiple phases and are counted in each applicable category."`,
// });

// // ============================================
// // RESEARCH PIPELINE ORCHESTRATOR
// // ============================================

// const researchPipelineOrchestrator = new Agent({
//   name: 'Research Pipeline Orchestrator',
//   model: 'gpt-4o',
//   instructions: `You orchestrate a multi-stage research pipeline for deep analysis of clinical trial data.

// PIPELINE STAGES:
// 1. Question Refinement - Clarify the research question and define scope
// 2. Smart Filtering - Apply domain knowledge to filter relevant trials
// 3. Field Extraction - Extract only relevant fields to reduce data size
// 4. Batch Classification - Classify trials as relevant/not-relevant
// 5. Deep Analysis - Detailed analysis of relevant trials only
// 6. Report Aggregation - Synthesize findings into comprehensive report

// YOUR ROLE:
// - Determine which filters to apply based on the research question
// - Identify which fields are needed for analysis
// - Define classification criteria for relevance
// - Guide the analysis focus

// DOMAIN KNOWLEDGE:
// - "Pivotal trials" = Phase 3 or Phase 4, interventional, typically randomized
// - "Registration trials" = Phase 3, intended to support regulatory approval
// - "Efficacy analysis" = Focus on primary outcomes, completed trials with results
// - "Safety analysis" = Focus on adverse events, larger enrollment preferred

// OUTPUT FORMAT:
// {
//   "refinedQuestion": "Precise research question",
//   "questionType": "efficacy" | "safety" | "landscape" | "comparison" | "general",
//   "filters": {
//     "phases": ["PHASE3", "PHASE4"] or null,
//     "status": ["COMPLETED"] or null,
//     "studyType": "INTERVENTIONAL" or null,
//     "requiresResults": true/false
//   },
//   "relevantFields": ["list", "of", "field", "paths"],
//   "classificationCriteria": "Criteria for YES/NO classification",
//   "analysisInstructions": "What to focus on in deep analysis"
// }`,
// });

// // ============================================
// // STATISTICAL OPERATION EXECUTION
// // ============================================

// /**
//  * Execute statistical operations on trial data
//  * This runs actual computations, not just LLM analysis
//  */
// async function executeStatisticalOperation(query, trials) {
//   if (!trials || trials.length === 0) {
//     return {
//       operation: 'error',
//       message: 'No trial data available for analysis',
//       result: null
//     };
//   }
  
//   const result = {
//     operation: 'analysis',
//     field: null,
//     result: null,
//     chartData: null,
//     sampleSize: trials.length
//   };
  
//   const queryLower = query.toLowerCase();
  
//   // ====================================
//   // ENROLLMENT STATISTICS
//   // ====================================
//   if (/\b(enrollment|enroll|participants?|sample size|how many patients?|how many people)\b/i.test(query) &&
//       /\b(average|mean|median|total|statistics?|distribution|min|max)\b/i.test(query)) {
    
//     result.operation = 'enrollment_stats';
//     result.field = 'enrollment';
    
//     const enrollments = trials
//       .map(t => getNestedValue(t, 'protocolSection.designModule.enrollmentInfo.count'))
//       .filter(e => e != null && !isNaN(e))
//       .map(Number);
    
//     if (enrollments.length === 0) {
//       result.result = { 
//         message: 'No enrollment data available in these trials',
//         trialsWithData: 0,
//         trialsWithoutData: trials.length
//       };
//     } else {
//       const sorted = [...enrollments].sort((a, b) => a - b);
//       const sum = enrollments.reduce((a, b) => a + b, 0);
//       const avg = sum / enrollments.length;
//       const median = sorted.length % 2 === 0
//         ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
//         : sorted[Math.floor(sorted.length / 2)];
      
//       // Calculate standard deviation
//       const squaredDiffs = enrollments.map(e => Math.pow(e - avg, 2));
//       const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / enrollments.length;
//       const stdDev = Math.sqrt(avgSquaredDiff);
      
//       result.result = {
//         average: Math.round(avg),
//         median: Math.round(median),
//         min: sorted[0],
//         max: sorted[sorted.length - 1],
//         total: sum,
//         standardDeviation: Math.round(stdDev),
//         trialsWithData: enrollments.length,
//         trialsWithoutData: trials.length - enrollments.length,
//         percentile25: sorted[Math.floor(sorted.length * 0.25)],
//         percentile75: sorted[Math.floor(sorted.length * 0.75)]
//       };
      
//       // Create histogram buckets
//       const buckets = [
//         { label: '1-50', min: 1, max: 50, count: 0 },
//         { label: '51-100', min: 51, max: 100, count: 0 },
//         { label: '101-200', min: 101, max: 200, count: 0 },
//         { label: '201-500', min: 201, max: 500, count: 0 },
//         { label: '501-1000', min: 501, max: 1000, count: 0 },
//         { label: '1001-5000', min: 1001, max: 5000, count: 0 },
//         { label: '5000+', min: 5001, max: Infinity, count: 0 },
//       ];
      
//       enrollments.forEach(e => {
//         const bucket = buckets.find(b => e >= b.min && e <= b.max);
//         if (bucket) bucket.count++;
//       });
      
//       result.chartData.push({
//         type: 'bar',
//         title: 'Enrollment Distribution',
//         data: buckets.filter(b => b.count > 0).map(b => ({ label: b.label, value: b.count })),
//         xAxis: 'Enrollment Range',
//         yAxis: 'Number of Trials'
//       };
//     }
//   }
  
//   // ====================================
//   // PHASE DISTRIBUTION
//   // ====================================
//   else if (/\b(phase|phases)\b.*\b(distribution|breakdown|count|how many|by phase)\b/i.test(query) ||
//            /\b(by phase|phase distribution|phase breakdown)\b/i.test(query)) {
    
//     result.operation = 'groupBy';
//     result.field = 'phases';
    
//     const phaseCounts = {};
//     let trialsWithPhase = 0;
    
//     trials.forEach(t => {
//       const phases = getNestedValue(t, 'protocolSection.designModule.phases');
      
//       if (phases && Array.isArray(phases) && phases.length > 0) {
//         trialsWithPhase++;
//         phases.forEach(phase => {
//           phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
//         });
//       } else {
//         phaseCounts['N/A'] = (phaseCounts['N/A'] || 0) + 1;
//       }
//     });
    
//     const sortedPhases = Object.entries(phaseCounts)
//       .sort((a, b) => {
//         const order = ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA', 'N/A'];
//         return order.indexOf(a[0]) - order.indexOf(b[0]);
//       });
    
//     result.result = {
//       distribution: Object.fromEntries(sortedPhases),
//       trialsWithPhaseData: trialsWithPhase,
//       trialsWithoutPhaseData: trials.length - trialsWithPhase,
//       note: 'Note: Trials can have multiple phases (e.g., PHASE1/PHASE2)'
//     };
    
//     result.chartData.push({
//       type: 'pie',
//       title: 'Trial Distribution by Phase',
//       data: sortedPhases.map(([label, value]) => ({
//         label: label.replace('PHASE', 'Phase ').replace('EARLY_', 'Early ').replace('NA', 'N/A'),
//         value
//       })),
//       xAxis: 'Phase',
//       yAxis: 'Count'
//     };
//   }
  
//   // ====================================
//   // STATUS DISTRIBUTION
//   // ====================================
//   else if (/\b(status|statuses)\b.*\b(distribution|breakdown|count|by status)\b/i.test(query) ||
//            /\b(by status|status distribution|status breakdown)\b/i.test(query) ||
//            /\b(recruiting|completed|terminated|withdrawn)\b.*\b(how many|count)\b/i.test(query)) {
    
//     result.operation = 'groupBy';
//     result.field = 'status';
    
//     const statusCounts = {};
    
//     trials.forEach(t => {
//       const status = getNestedValue(t, 'protocolSection.statusModule.overallStatus') || 'Unknown';
//       statusCounts[status] = (statusCounts[status] || 0) + 1;
//     });
    
//     const sortedStatuses = Object.entries(statusCounts)
//       .sort((a, b) => b[1] - a[1]);
    
//     result.result = {
//       distribution: Object.fromEntries(sortedStatuses),
//       totalTrials: trials.length
//     };
    
//     result.chartData.push({
//       type: 'bar',
//       title: 'Trial Distribution by Status',
//       data: sortedStatuses.map(([label, value]) => ({
//         label: label.replace(/_/g, ' '),
//         value
//       })),
//       xAxis: 'Status',
//       yAxis: 'Number of Trials'
//     };
//   }
  
//   // ====================================
//   // SPONSOR DISTRIBUTION
//   // ====================================
//   else if (/\b(sponsor|sponsors|sponsor type|sponsor class|industry|academic|nih)\b/i.test(query) &&
//            /\b(distribution|breakdown|count|how many|compare|by sponsor)\b/i.test(query)) {
    
//     result.operation = 'groupBy';
//     result.field = 'sponsorClass';
    
//     const sponsorClassCounts = {};
//     const sponsorNameCounts = {};
    
//     trials.forEach(t => {
//       const sponsorClass = getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class') || 'Unknown';
//       const sponsorName = getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name') || 'Unknown';
      
//       sponsorClassCounts[sponsorClass] = (sponsorClassCounts[sponsorClass] || 0) + 1;
//       sponsorNameCounts[sponsorName] = (sponsorNameCounts[sponsorName] || 0) + 1;
//     });
    
//     const sortedClasses = Object.entries(sponsorClassCounts).sort((a, b) => b[1] - a[1]);
//     const topSponsors = Object.entries(sponsorNameCounts)
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 10);
    
//     result.result = {
//       byClass: Object.fromEntries(sortedClasses),
//       topSponsors: Object.fromEntries(topSponsors),
//       totalTrials: trials.length
//     };
    
//     result.chartData.push({
//       type: 'pie',
//       title: 'Trial Distribution by Sponsor Type',
//       data: sortedClasses.map(([label, value]) => ({
//         label: label === 'INDUSTRY' ? 'Industry' :
//                label === 'NIH' ? 'NIH' :
//                label === 'OTHER' ? 'Academic/Other' :
//                label === 'FED' ? 'Federal' :
//                label === 'NETWORK' ? 'Network' :
//                label === 'OTHER_GOV' ? 'Other Government' :
//                label,
//         value
//       })),
//       xAxis: 'Sponsor Type',
//       yAxis: 'Count'
//     };
//   }
  
//   // ====================================
//   // PLACEBO ARM ANALYSIS
//   // ====================================
//   else if (/\b(placebo|placebo.?controlled|placebo arm|sham|comparator)\b/i.test(query)) {
    
//     result.operation = 'filter';
//     result.field = 'armGroups.type';
    
//     let trialsWithPlacebo = 0;
//     let trialsWithoutPlacebo = 0;
//     let totalPlaceboArms = 0;
//     const placeboTrials = [];
    
//     trials.forEach(t => {
//       const armGroups = getNestedValue(t, 'protocolSection.armsInterventionsModule.armGroups') || [];
//       const nctId = getNestedValue(t, 'protocolSection.identificationModule.nctId');
//       const title = getNestedValue(t, 'protocolSection.identificationModule.briefTitle');
      
//       let hasPlacebo = false;
//       let placeboArmCount = 0;
      
//       if (Array.isArray(armGroups)) {
//         armGroups.forEach(arm => {
//           if (arm.type === 'PLACEBO_COMPARATOR' || 
//               arm.type === 'SHAM_COMPARATOR' ||
//               (arm.label && arm.label.toLowerCase().includes('placebo')) ||
//               (arm.description && arm.description.toLowerCase().includes('placebo'))) {
//             hasPlacebo = true;
//             placeboArmCount++;
//             totalPlaceboArms++;
//           }
//         });
//       }
      
//       if (hasPlacebo) {
//         trialsWithPlacebo++;
//         placeboTrials.push({
//           nctId,
//           title: title?.slice(0, 100),
//           placeboArmCount,
//           totalArms: armGroups.length
//         });
//       } else {
//         trialsWithoutPlacebo++;
//       }
//     });
    
//     result.result = {
//       trialsWithPlacebo,
//       trialsWithoutPlacebo,
//       percentageWithPlacebo: ((trialsWithPlacebo / trials.length) * 100).toFixed(1) + '%',
//       totalPlaceboArms,
//       exampleTrials: placeboTrials.slice(0, 5),
//       allPlaceboTrialIds: placeboTrials.map(t => t.nctId)
//     };
    
//     result.chartData.push({
//       type: 'pie',
//       title: 'Placebo-Controlled vs Non-Placebo Trials',
//       data: [
//         { label: 'Placebo-Controlled', value: trialsWithPlacebo },
//         { label: 'No Placebo', value: trialsWithoutPlacebo }
//       ],
//       xAxis: 'Trial Type',
//       yAxis: 'Count'
//     };
//   }
  
//   // ====================================
//   // COUNTRY/LOCATION DISTRIBUTION
//   // ====================================
//   else if (/\b(country|countries|location|locations|geographic|region|where|site)\b/i.test(query) &&
//            /\b(distribution|breakdown|count|by country|by location|how many)\b/i.test(query)) {
    
//     result.operation = 'groupBy';
//     result.field = 'locations.country';
    
//     const countryCounts = {};
//     let trialsWithLocations = 0;
//     let totalSites = 0;
    
//     trials.forEach(t => {
//       const locations = getNestedValue(t, 'protocolSection.contactsLocationsModule.locations') || [];
      
//       if (Array.isArray(locations) && locations.length > 0) {
//         trialsWithLocations++;
//         totalSites += locations.length;
//         const countries = new Set(locations.map(loc => loc.country).filter(Boolean));
//         countries.forEach(country => {
//           countryCounts[country] = (countryCounts[country] || 0) + 1;
//         });
//       }
//     });
    
//     const sortedCountries = Object.entries(countryCounts)
//       .sort((a, b) => b[1] - a[1]);
    
//     result.result = {
//       topCountries: Object.fromEntries(sortedCountries.slice(0, 20)),
//       totalCountries: sortedCountries.length,
//       totalSites,
//       trialsWithLocationData: trialsWithLocations,
//       trialsWithoutLocationData: trials.length - trialsWithLocations,
//       averageSitesPerTrial: trialsWithLocations > 0 ? (totalSites / trialsWithLocations).toFixed(1) : 'N/A'
//     };
    
//     result.chartData.push({
//       type: 'bar',
//       title: 'Top 10 Countries by Trial Count',
//       data: sortedCountries.slice(0, 10).map(([label, value]) => ({ label, value })),
//       xAxis: 'Country',
//       yAxis: 'Number of Trials'
//     };
//   }
  
//   // ====================================
//   // INTERVENTION TYPE DISTRIBUTION
//   // ====================================
//   else if (/\b(intervention|interventions|treatment|drug|device|biological)\b/i.test(query) &&
//            /\b(type|distribution|breakdown|count|by type)\b/i.test(query)) {
    
//     result.operation = 'groupBy';
//     result.field = 'interventions.type';
    
//     const interventionTypeCounts = {};
//     const interventionNameCounts = {};
    
//     trials.forEach(t => {
//       const interventions = getNestedValue(t, 'protocolSection.armsInterventionsModule.interventions') || [];
      
//       if (Array.isArray(interventions)) {
//         const types = new Set();
//         interventions.forEach(int => {
//           if (int.type) types.add(int.type);
//           if (int.name) {
//             interventionNameCounts[int.name] = (interventionNameCounts[int.name] || 0) + 1;
//           }
//         });
//         types.forEach(type => {
//           interventionTypeCounts[type] = (interventionTypeCounts[type] || 0) + 1;
//         });
//       }
//     });
    
//     const sortedTypes = Object.entries(interventionTypeCounts).sort((a, b) => b[1] - a[1]);
//     const topInterventions = Object.entries(interventionNameCounts)
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 10);
    
//     result.result = {
//       byType: Object.fromEntries(sortedTypes),
//       topInterventions: Object.fromEntries(topInterventions),
//       totalTrials: trials.length
//     };
    
//     result.chartData.push({
//       type: 'pie',
//       title: 'Trial Distribution by Intervention Type',
//       data: sortedTypes.map(([label, value]) => ({ label, value })),
//       xAxis: 'Intervention Type',
//       yAxis: 'Count'
//     };
//   }
  
//   // ====================================
//   // SIMPLE COUNT
//   // ====================================
//   else if (/\b(how many|count|total|number of)\b/i.test(query)) {
    
//     result.operation = 'count';
//     result.result = {
//       totalTrials: trials.length,
//       message: `There are ${trials.length} trials in the current dataset.`
//     };
    
//     // Check for filters in query
//     const filters = {};
    
//     if (/phase\s*3/i.test(query) || /phase\s*III/i.test(query) || /phase3/i.test(query)) {
//       const phase3 = trials.filter(t => {
//         const phases = getNestedValue(t, 'protocolSection.designModule.phases') || [];
//         return phases.includes('PHASE3');
//       });
//       filters.phase3 = phase3.length;
//     }
    
//     if (/phase\s*2/i.test(query) || /phase\s*II/i.test(query) || /phase2/i.test(query)) {
//       const phase2 = trials.filter(t => {
//         const phases = getNestedValue(t, 'protocolSection.designModule.phases') || [];
//         return phases.includes('PHASE2');
//       });
//       filters.phase2 = phase2.length;
//     }
    
//     if (/recruiting/i.test(query)) {
//       const recruiting = trials.filter(t => 
//         getNestedValue(t, 'protocolSection.statusModule.overallStatus') === 'RECRUITING'
//       );
//       filters.recruiting = recruiting.length;
//     }
    
//     if (/completed/i.test(query)) {
//       const completed = trials.filter(t => 
//         getNestedValue(t, 'protocolSection.statusModule.overallStatus') === 'COMPLETED'
//       );
//       filters.completed = completed.length;
//     }
    
//     if (/industry/i.test(query)) {
//       const industry = trials.filter(t => 
//         getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class') === 'INDUSTRY'
//       );
//       filters.industrySponsored = industry.length;
//     }
    
//     if (/results?/i.test(query) && /with|have|has/i.test(query)) {
//       const withResults = trials.filter(t => t.hasResults === true || t.resultsSection);
//       filters.withResults = withResults.length;
//     }
    
//     if (Object.keys(filters).length > 0) {
//       result.result.filtered = filters;
//     }
//   }
  
//   // ====================================
//   // DEFAULT: PROVIDE COMPREHENSIVE SUMMARY
//   // ====================================
//   else {
//     result.operation = 'summary';
    
//     // Collect comprehensive stats
//     const phases = {};
//     const statuses = {};
//     const sponsorClasses = {};
//     let totalEnrollment = 0;
//     let enrollmentCount = 0;
//     let withPlacebo = 0;
//     let withResults = 0;
    
//     trials.forEach(t => {
//       // Phases
//       const phaseArr = getNestedValue(t, 'protocolSection.designModule.phases') || [];
//       phaseArr.forEach(p => { phases[p] = (phases[p] || 0) + 1; });
      
//       // Status
//       const status = getNestedValue(t, 'protocolSection.statusModule.overallStatus');
//       if (status) statuses[status] = (statuses[status] || 0) + 1;
      
//       // Sponsor class
//       const sponsorClass = getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class');
//       if (sponsorClass) sponsorClasses[sponsorClass] = (sponsorClasses[sponsorClass] || 0) + 1;
      
//       // Enrollment
//       const enrollment = getNestedValue(t, 'protocolSection.designModule.enrollmentInfo.count');
//       if (enrollment && !isNaN(enrollment)) {
//         totalEnrollment += enrollment;
//         enrollmentCount++;
//       }
      
//       // Placebo
//       const arms = getNestedValue(t, 'protocolSection.armsInterventionsModule.armGroups') || [];
//       if (arms.some(a => a.type === 'PLACEBO_COMPARATOR' || a.type === 'SHAM_COMPARATOR')) {
//         withPlacebo++;
//       }
      
//       // Results
//       if (t.hasResults || t.resultsSection) {
//         withResults++;
//       }
//     });
    
//     result.result = {
//       totalTrials: trials.length,
//       phaseDistribution: phases,
//       statusDistribution: statuses,
//       sponsorDistribution: sponsorClasses,
//       enrollmentStats: {
//         average: enrollmentCount > 0 ? Math.round(totalEnrollment / enrollmentCount) : 'N/A',
//         total: totalEnrollment,
//         trialsWithData: enrollmentCount
//       },
//       placeboControlled: {
//         count: withPlacebo,
//         percentage: ((withPlacebo / trials.length) * 100).toFixed(1) + '%'
//       },
//       trialsWithResults: {
//         count: withResults,
//         percentage: ((withResults / trials.length) * 100).toFixed(1) + '%'
//       }
//     };
    
//     // Default chart: phase distribution
//     const sortedPhases = Object.entries(phases).sort((a, b) => {
//       const order = ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA'];
//       return order.indexOf(a[0]) - order.indexOf(b[0]);
//     });
    
//     result.chartData.push({
//       type: 'bar',
//       title: 'Trial Overview by Phase',
//       data: sortedPhases.map(([label, value]) => ({
//         label: label.replace('PHASE', 'Phase ').replace('EARLY_', 'Early '),
//         value
//       })),
//       xAxis: 'Phase',
//       yAxis: 'Number of Trials'
//     };
//   }
  
//   return result;
// }

// // ============================================
// // RESEARCH PIPELINE EXECUTION
// // ============================================

// /**
//  * Execute the multi-stage research pipeline
//  * Optimizes cost by filtering before expensive analysis
//  */
// async function runResearchPipeline(query, rawData, conversationId) {
//   const trials = rawData.clinicalTrials || [];
  
//   const pipelineResult = {
//     report: '',
//     stages: [],
//     trialsAnalyzed: 0,
//     classificationBreakdown: { YES: 0, NO: 0, UNCERTAIN: 0 },
//     costEstimate: {},
//     citations: [],
//     chartData: null
//   };
  
//   if (trials.length === 0) {
//     pipelineResult.report = `## Research Analysis

// No clinical trial data available for analysis. Please run a search query first to load trial data.`;
//     return pipelineResult;
//   }
  
//   console.log(`[Research Pipeline] Starting analysis of ${trials.length} trials`);
  
//   try {
//     // ====================================
//     // STAGE 1: Question Refinement
//     // ====================================
//     console.log('[Pipeline Stage 1] Question Refinement');
//     pipelineResult.stages.push({ stage: 1, name: 'Question Refinement', status: 'started' });
    
//     // Analyze query to determine focus
//     let refinement = {
//       refinedQuestion: query,
//       questionType: 'general',
//       relevantFields: ['all'],
//       classificationCriteria: 'YES if relevant, NO if not relevant',
//       filters: {}
//     };
    
//     // Detect question type and apply smart defaults
//     if (/\b(efficacy|effectiveness|outcome|endpoint|primary|secondary)\b/i.test(query)) {
//       refinement.questionType = 'efficacy';
//       refinement.filters.requiresResults = true;
//       refinement.relevantFields = ['outcomes', 'results', 'arms'];
//     } else if (/\b(safety|adverse|side effect|toxicity|ae|sae)\b/i.test(query)) {
//       refinement.questionType = 'safety';
//       refinement.filters.requiresResults = true;
//       refinement.relevantFields = ['adverseEvents', 'results'];
//     } else if (/\b(pivotal|registration|approval|regulatory)\b/i.test(query)) {
//       refinement.questionType = 'pivotal';
//       refinement.filters.phases = ['PHASE3', 'PHASE4'];
//       refinement.filters.studyType = 'INTERVENTIONAL';
//     } else if (/\b(landscape|overview|all|comprehensive)\b/i.test(query)) {
//       refinement.questionType = 'landscape';
//     } else if (/\b(compare|comparison|versus|vs|head.?to.?head)\b/i.test(query)) {
//       refinement.questionType = 'comparison';
//     }
    
//     pipelineResult.stages[0].status = 'completed';
//     pipelineResult.stages[0].result = refinement;
    
//     // ====================================
//     // STAGE 2: Smart Filtering
//     // ====================================
//     console.log('[Pipeline Stage 2] Smart Filtering');
//     pipelineResult.stages.push({ stage: 2, name: 'Smart Filtering', status: 'started' });
    
//     let filteredTrials = [...trials];
//     const initialCount = filteredTrials.length;
    
//     // Apply phase filter
//     if (refinement.filters?.phases?.length > 0) {
//       filteredTrials = filteredTrials.filter(t => {
//         const phases = getNestedValue(t, 'protocolSection.designModule.phases') || [];
//         return phases.some(p => refinement.filters.phases.includes(p));
//       });
//     }
    
//     // Apply status filter
//     if (refinement.filters?.status?.length > 0) {
//       filteredTrials = filteredTrials.filter(t => {
//         const status = getNestedValue(t, 'protocolSection.statusModule.overallStatus');
//         return refinement.filters.status.includes(status);
//       });
//     }
    
//     // Apply study type filter
//     if (refinement.filters?.studyType) {
//       filteredTrials = filteredTrials.filter(t => {
//         const studyType = getNestedValue(t, 'protocolSection.designModule.studyType');
//         return studyType === refinement.filters.studyType;
//       });
//     }
    
//     // Apply results requirement
//     if (refinement.filters?.requiresResults) {
//       filteredTrials = filteredTrials.filter(t => {
//         return t.hasResults === true || t.resultsSection != null;
//       });
//     }
    
//     console.log(`[Pipeline] Filtered: ${initialCount} → ${filteredTrials.length} trials`);
//     pipelineResult.stages[1].status = 'completed';
//     pipelineResult.stages[1].result = {
//       initialCount,
//       filteredCount: filteredTrials.length,
//       reductionPercent: initialCount > 0 ? ((1 - filteredTrials.length / initialCount) * 100).toFixed(1) : '0'
//     };
    
//     // ====================================
//     // STAGE 3: Field Extraction
//     // ====================================
//     console.log('[Pipeline Stage 3] Field Extraction');
//     pipelineResult.stages.push({ stage: 3, name: 'Field Extraction', status: 'started' });
    
//     // Extract only relevant fields for classification
//     const extractedTrials = filteredTrials.map(t => {
//       return {
//         nctId: getNestedValue(t, 'protocolSection.identificationModule.nctId'),
//         briefTitle: getNestedValue(t, 'protocolSection.identificationModule.briefTitle'),
//         overallStatus: getNestedValue(t, 'protocolSection.statusModule.overallStatus'),
//         phases: getNestedValue(t, 'protocolSection.designModule.phases'),
//         studyType: getNestedValue(t, 'protocolSection.designModule.studyType'),
//         enrollment: getNestedValue(t, 'protocolSection.designModule.enrollmentInfo.count'),
//         leadSponsor: getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name'),
//         leadSponsorClass: getNestedValue(t, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.class'),
//         conditions: getNestedValue(t, 'protocolSection.conditionsModule.conditions'),
//         primaryOutcomes: getNestedValue(t, 'protocolSection.outcomesModule.primaryOutcomes'),
//         armGroups: getNestedValue(t, 'protocolSection.armsInterventionsModule.armGroups'),
//         interventions: getNestedValue(t, 'protocolSection.armsInterventionsModule.interventions'),
//         briefSummary: getNestedValue(t, 'protocolSection.descriptionModule.briefSummary')?.slice(0, 500),
//         hasResults: !!t.resultsSection || t.hasResults,
//         _fullTrial: t // Keep reference for deep analysis
//       };
//     });
    
//     pipelineResult.stages[2].status = 'completed';
//     pipelineResult.stages[2].result = {
//       fieldsExtracted: ['nctId', 'briefTitle', 'status', 'phases', 'enrollment', 'sponsor', 'conditions', 'outcomes', 'arms', 'interventions'],
//       trialsProcessed: extractedTrials.length
//     };
    
//     // ====================================
//     // STAGE 4: Batch Classification
//     // ====================================
//     console.log('[Pipeline Stage 4] Batch Classification');
//     pipelineResult.stages.push({ stage: 4, name: 'Batch Classification', status: 'started' });
    
//     const classifications = {
//       YES: [],
//       NO: [],
//       UNCERTAIN: []
//     };
    
//     // Simple heuristic classification based on query keywords
//     const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
//     extractedTrials.forEach(trial => {
//       const trialText = JSON.stringify({
//         title: trial.briefTitle,
//         conditions: trial.conditions,
//         outcomes: trial.primaryOutcomes,
//         summary: trial.briefSummary,
//         interventions: trial.interventions
//       }).toLowerCase();
      
//       let relevanceScore = 0;
      
//       // Keyword matching
//       queryWords.forEach(word => {
//         if (trialText.includes(word)) {
//           relevanceScore++;
//         }
//       });
      
//       // Quality scoring
//       if (trial.hasResults) relevanceScore += 3;
//       if (trial.phases?.includes('PHASE3') || trial.phases?.includes('PHASE4')) relevanceScore += 2;
//       if (trial.overallStatus === 'COMPLETED') relevanceScore += 1;
//       if (trial.enrollment && trial.enrollment > 100) relevanceScore += 1;
      
//       // Check for placebo-controlled (higher quality)
//       const arms = trial.armGroups || [];
//       if (arms.some(a => a.type === 'PLACEBO_COMPARATOR')) relevanceScore += 2;
      
//       const threshold = Math.max(2, queryWords.length / 2);
      
//       if (relevanceScore >= threshold + 3) {
//         classifications.YES.push(trial);
//       } else if (relevanceScore >= threshold) {
//         classifications.UNCERTAIN.push(trial);
//       } else {
//         classifications.NO.push(trial);
//       }
//     });
    
//     pipelineResult.classificationBreakdown = {
//       YES: classifications.YES.length,
//       NO: classifications.NO.length,
//       UNCERTAIN: classifications.UNCERTAIN.length
//     };
    
//     pipelineResult.stages[3].status = 'completed';
//     pipelineResult.stages[3].result = pipelineResult.classificationBreakdown;
    
//     console.log(`[Pipeline] Classification: YES=${classifications.YES.length}, NO=${classifications.NO.length}, UNCERTAIN=${classifications.UNCERTAIN.length}`);
    
//     // ====================================
//     // STAGE 5: Deep Analysis
//     // ====================================
//     console.log('[Pipeline Stage 5] Deep Analysis');
//     pipelineResult.stages.push({ stage: 5, name: 'Deep Analysis', status: 'started' });
    
//     // Combine YES and top UNCERTAIN for analysis
//     const trialsToAnalyze = [
//       ...classifications.YES,
//       ...classifications.UNCERTAIN.slice(0, Math.min(5, 10 - classifications.YES.length))
//     ].slice(0, 25);
    
//     pipelineResult.trialsAnalyzed = trialsToAnalyze.length;
    
//     if (trialsToAnalyze.length === 0) {
//       pipelineResult.report = `## Research Analysis Report

// ### Query
// ${query}

// ### Findings
// After applying filters and classification, no trials were found that directly address this research question.

// ### Recommendations
// 1. Broaden the search criteria
// 2. Try different search terms
// 3. Consider related conditions or interventions

// ### Data Summary
// - Total trials searched: ${trials.length}
// - After filtering: ${filteredTrials.length}
// - Relevant trials found: 0
// `;
//       return pipelineResult;
//     }
    
//     // Generate detailed analysis for each relevant trial
//     const analyses = trialsToAnalyze.map(trial => {
//       const outcomes = trial.primaryOutcomes || [];
//       const arms = trial.armGroups || [];
//       const interventions = trial.interventions || [];
      
//       const hasPlacebo = arms.some(a => 
//         a.type === 'PLACEBO_COMPARATOR' || 
//         a.type === 'SHAM_COMPARATOR' ||
//         (a.label && a.label.toLowerCase().includes('placebo'))
//       );
      
//       return {
//         nctId: trial.nctId,
//         title: trial.briefTitle,
//         phase: trial.phases?.join(', ') || 'N/A',
//         status: trial.overallStatus,
//         enrollment: trial.enrollment || 'N/A',
//         sponsor: trial.leadSponsor,
//         sponsorClass: trial.leadSponsorClass,
//         hasResults: trial.hasResults,
//         conditions: trial.conditions?.slice(0, 3) || [],
//         outcomeCount: outcomes.length,
//         primaryOutcome: outcomes[0]?.measure || 'Not specified',
//         primaryOutcomeTimeframe: outcomes[0]?.timeFrame || 'Not specified',
//         armCount: arms.length,
//         hasPlacebo,
//         interventionTypes: [...new Set(interventions.map(i => i.type).filter(Boolean))],
//         interventionNames: interventions.map(i => i.name).filter(Boolean).slice(0, 3),
//         url: `https://clinicaltrials.gov/study/${trial.nctId}`
//       };
//     });
    
//     pipelineResult.stages[4].status = 'completed';
    
//     // Generate citations
//     pipelineResult.citations = analyses.map(a => ({
//       type: 'clinicalTrial',
//       id: a.nctId,
//       title: a.title,
//       url: a.url,
//       status: a.status,
//       phase: a.phase,
//       sponsor: a.sponsor
//     }));
    
//     // ====================================
//     // STAGE 6: Report Generation
//     // ====================================
//     console.log('[Pipeline Stage 6] Report Generation');
//     pipelineResult.stages.push({ stage: 6, name: 'Report Generation', status: 'started' });
    
//     // Calculate summary statistics
//     const phaseDistribution = {};
//     const statusDistribution = {};
//     const sponsorDistribution = {};
//     let totalEnrollment = 0;
//     let enrollmentCount = 0;
//     const placeboCount = analyses.filter(a => a.hasPlacebo).length;
//     const withResults = analyses.filter(a => a.hasResults).length;
    
//     analyses.forEach(a => {
//       // Phases
//       if (a.phase && a.phase !== 'N/A') {
//         a.phase.split(', ').forEach(p => {
//           phaseDistribution[p] = (phaseDistribution[p] || 0) + 1;
//         });
//       }
      
//       // Status
//       if (a.status) {
//         statusDistribution[a.status] = (statusDistribution[a.status] || 0) + 1;
//       }
      
//       // Sponsor class
//       if (a.sponsorClass) {
//         sponsorDistribution[a.sponsorClass] = (sponsorDistribution[a.sponsorClass] || 0) + 1;
//       }
      
//       // Enrollment
//       if (typeof a.enrollment === 'number') {
//         totalEnrollment += a.enrollment;
//         enrollmentCount++;
//       }
//     });
    
//     const avgEnrollment = enrollmentCount > 0 ? Math.round(totalEnrollment / enrollmentCount) : 'N/A';
    
//     // Build chart data
//     pipelineresult.chartData.push({
//       type: 'bar',
//       title: 'Analyzed Trials by Phase',
//       data: Object.entries(phaseDistribution)
//         .sort((a, b) => {
//           const order = ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];
//           return order.indexOf(a[0]) - order.indexOf(b[0]);
//         })
//         .map(([label, value]) => ({ 
//           label: label.replace('PHASE', 'Phase '), 
//           value 
//         })),
//       xAxis: 'Phase',
//       yAxis: 'Number of Trials'
//     };
    
//     // Generate comprehensive markdown report
//     pipelineResult.report = `## Research Analysis Report

// ### Research Question
// ${query}

// ### Executive Summary
// Analyzed **${analyses.length}** relevant trials from a dataset of ${trials.length} total trials (${filteredTrials.length} after initial filtering).

// ### Key Findings

// #### Trial Characteristics
// | Metric | Value |
// |--------|-------|
// | Total Trials Analyzed | ${analyses.length} |
// | Placebo-Controlled | ${placeboCount} (${((placeboCount / analyses.length) * 100).toFixed(0)}%) |
// | With Posted Results | ${withResults} (${((withResults / analyses.length) * 100).toFixed(0)}%) |
// | Average Enrollment | ${avgEnrollment} participants |
// | Total Enrollment | ${totalEnrollment.toLocaleString()} participants |

// #### Phase Distribution
// ${Object.entries(phaseDistribution)
//   .sort((a, b) => {
//     const order = ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];
//     return order.indexOf(a[0]) - order.indexOf(b[0]);
//   })
//   .map(([phase, count]) => `- ${phase.replace('PHASE', 'Phase ')}: ${count} trials (${((count / analyses.length) * 100).toFixed(0)}%)`)
//   .join('\n')}

// #### Status Distribution
// ${Object.entries(statusDistribution)
//   .sort((a, b) => b[1] - a[1])
//   .map(([status, count]) => `- ${status.replace(/_/g, ' ')}: ${count} trials`)
//   .join('\n')}

// #### Sponsor Distribution
// ${Object.entries(sponsorDistribution)
//   .sort((a, b) => b[1] - a[1])
//   .map(([sponsor, count]) => `- ${sponsor === 'INDUSTRY' ? 'Industry' : sponsor === 'NIH' ? 'NIH' : sponsor === 'OTHER' ? 'Academic/Other' : sponsor}: ${count} trials`)
//   .join('\n')}

// ### Detailed Trial Information

// ${analyses.slice(0, 15).map((a, i) => `
// #### ${i + 1}. ${a.title}

// | Field | Value |
// |-------|-------|
// | NCT ID | [${a.nctId}](${a.url}) |
// | Status | ${a.status} |
// | Phase | ${a.phase} |
// | Enrollment | ${typeof a.enrollment === 'number' ? a.enrollment.toLocaleString() : a.enrollment} |
// | Sponsor | ${a.sponsor} (${a.sponsorClass || 'Unknown'}) |
// | Placebo-Controlled | ${a.hasPlacebo ? '✓ Yes' : '✗ No'} |
// | Has Results | ${a.hasResults ? '✓ Yes' : '✗ No'} |
// | Primary Outcome | ${a.primaryOutcome} |
// | Timeframe | ${a.primaryOutcomeTimeframe} |
// | Interventions | ${a.interventionNames.join(', ') || 'Not specified'} |
// | Conditions | ${a.conditions.join(', ') || 'Not specified'} |
// `).join('\n')}

// ### Methodology

// #### Pipeline Stages
// 1. **Question Refinement**: Identified as "${refinement.questionType}" analysis
// 2. **Smart Filtering**: ${initialCount} → ${filteredTrials.length} trials (${((1 - filteredTrials.length / initialCount) * 100).toFixed(0)}% reduction)
// 3. **Classification**: ${classifications.YES.length} highly relevant, ${classifications.UNCERTAIN.length} possibly relevant, ${classifications.NO.length} not relevant
// 4. **Deep Analysis**: Analyzed ${analyses.length} most relevant trials

// #### Selection Criteria
// - ${refinement.filters?.phases ? `Phase filter: ${refinement.filters.phases.join(', ')}` : 'No phase filter'}
// - ${refinement.filters?.requiresResults ? 'Required posted results' : 'Results not required'}
// - ${refinement.filters?.studyType ? `Study type: ${refinement.filters.studyType}` : 'All study types'}
// - Relevance scoring based on keyword matching and quality indicators

// ### Limitations
// - Analysis based on ClinicalTrials.gov registry data only
// - Results sections may not be available for all completed trials
// - This is a computational analysis, not a systematic review
// - Clinical interpretation should be performed by qualified professionals

// ### References
// ${analyses.slice(0, 15).map(a => `- [${a.nctId}](${a.url}) - ${a.title.slice(0, 70)}${a.title.length > 70 ? '...' : ''}`).join('\n')}

// ---
// *Report generated by Leaf Intelligence Research Pipeline*
// *Trials analyzed: ${analyses.length} | Total dataset: ${trials.length} | Date: ${new Date().toISOString().split('T')[0]}*
// `;
    
//     pipelineResult.stages[5].status = 'completed';
    
//     // Cost estimation
//     const cheapModelTokens = extractedTrials.length * 200;
//     const expensiveModelTokens = trialsToAnalyze.length * 1000;
    
//     pipelineResult.costEstimate = {
//       cheapModelTokens,
//       expensiveModelTokens,
//       estimatedCost: `$${((cheapModelTokens * 0.00015 / 1000) + (expensiveModelTokens * 0.005 / 1000)).toFixed(3)}`,
//       naiveCost: `$${(trials.length * 2000 * 0.005 / 1000).toFixed(2)}`,
//       savings: trials.length > 0 ? `${((1 - (cheapModelTokens * 0.00015 + expensiveModelTokens * 0.005) / (trials.length * 2000 * 0.005)) * 100).toFixed(0)}%` : 'N/A'
//     };
    
//   } catch (err) {
//     console.error('[Research Pipeline] Error:', err);
//     pipelineResult.report = `## Research Analysis Error

// An error occurred during the research pipeline: ${err.message}

// Please try:
// 1. Simplifying your query
// 2. Ensuring there is sufficient trial data loaded
// 3. Trying a more specific research question
// `;
//   }
  
//   return pipelineResult;
// }

// // ============================================
// // CITATION GENERATION
// // ============================================

// /**
//  * Generate citations from tool results
//  */
// function generateCitations(toolResults) {
//   const citations = [];
  
//   // Clinical Trials citations
//   if (toolResults.clinicalTrials?.raw && Array.isArray(toolResults.clinicalTrials.raw)) {
//     toolResults.clinicalTrials.raw.forEach(trial => {
//       const nctId = getNestedValue(trial, 'protocolSection.identificationModule.nctId');
//       const title = getNestedValue(trial, 'protocolSection.identificationModule.briefTitle');
//       const status = getNestedValue(trial, 'protocolSection.statusModule.overallStatus');
//       const phases = getNestedValue(trial, 'protocolSection.designModule.phases');
//       const sponsor = getNestedValue(trial, 'protocolSection.sponsorCollaboratorsModule.leadSponsor.name');
//       const enrollment = getNestedValue(trial, 'protocolSection.designModule.enrollmentInfo.count');
      
//       if (nctId) {
//         citations.push({
//           type: 'clinicalTrial',
//           id: nctId,
//           title: title || 'Untitled Study',
//           url: `https://clinicaltrials.gov/study/${nctId}`,
//           status: status || 'Unknown',
//           phase: Array.isArray(phases) ? phases.join(', ') : 'N/A',
//           sponsor: sponsor || 'Unknown',
//           enrollment: enrollment || 'N/A',
//           source: 'ClinicalTrials.gov'
//         });
//       }
//     });
//   }
  
//   // PubMed citations
//   if (toolResults.pubmed?.raw && Array.isArray(toolResults.pubmed.raw)) {
//     toolResults.pubmed.raw.forEach(article => {
//       if (article.pmid) {
//         citations.push({
//           type: 'pubmed',
//           id: article.pmid,
//           title: article.title || 'Untitled Article',
//           url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
//           authors: Array.isArray(article.authors) ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ' et al.' : '') : 'Unknown',
//           journal: article.journal || 'Unknown Journal',
//           pubDate: article.pubDate || 'Unknown Date',
//           doi: article.doi ? `https://doi.org/${article.doi}` : null,
//           source: 'PubMed'
//         });
//       }
//     });
//   }
  
//   // FDA citations
//   if (toolResults.fda?.raw && Array.isArray(toolResults.fda.raw)) {
//     toolResults.fda.raw.forEach(drug => {
//       const appNum = drug.application_number;
//       if (appNum) {
//         citations.push({
//           type: 'fda',
//           id: appNum,
//           title: drug.openfda?.brand_name?.[0] || drug.products?.[0]?.brand_name || appNum,
//           url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNum.replace(/[^0-9]/g, '')}`,
//           sponsor: drug.sponsor_name || 'Unknown',
//           genericName: drug.openfda?.generic_name?.[0] || 'N/A',
//           source: 'FDA Drugs@FDA'
//         });
//       }
//     });
//   }
  
//   // Orange Book citations
//   if (toolResults.orangeBook?.raw && Array.isArray(toolResults.orangeBook.raw)) {
//     toolResults.orangeBook.raw.forEach(group => {
//       const brandedProducts = group.brandedProducts || [];
//       brandedProducts.forEach(product => {
//         if (product.applNo) {
//           citations.push({
//             type: 'orangeBook',
//             id: product.applNo,
//             title: product.tradeName || group.ingredient,
//             url: `https://www.accessdata.fda.gov/scripts/cder/ob/results_product.cfm?Appl_Type=N&Appl_No=${product.applNo.replace(/[^0-9]/g, '')}`,
//             ingredient: group.ingredient,
//             applicant: product.applicant || 'Unknown',
//             teCode: product.teCode || 'N/A',
//             source: 'FDA Orange Book'
//           });
//         }
//       });
//     });
//   }
  
//   return citations;
// }

// // ============================================
// // EXPORTS
// // ============================================

// module.exports = {
//   // Agents
//   followupDetectorAgent,
//   followupCoordinatorAgent,
//   statsAgent,
//   researchPipelineOrchestrator,
  
//   // Schema
//   CLINICAL_TRIALS_SCHEMA,
//   FIELD_PATH_MAPPINGS,
  
//   // Functions
//   generateCitations,
//   executeStatisticalOperation,
//   runResearchPipeline,
  
//   // Utilities
//   getNestedValue,
//   setNestedValue,
//   parseAgeToMonths,
//   extractNumber
// };
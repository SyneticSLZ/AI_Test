/**
 * ClinicalTrials.gov Complete API Schema Reference
 * 
 * This file contains ALL valid enums, search areas, fields, and query syntax
 * for the ClinicalTrials.gov API. Use this as a single source of truth to
 * prevent hallucinations and ensure valid API queries.
 * 
 * Based on official documentation:
 * - https://clinicaltrials.gov/data-api/api
 * - https://clinicaltrials.gov/find-studies/constructing-complex-search-queries
 * - https://clinicaltrials.gov/data-api/about-api/search-areas
 * - https://clinicaltrials.gov/data-api/about-api/study-data-structure
 */

// ============================================
// SECTION 1: ALL ENUM TYPES
// ============================================

/**
 * Overall Study Status
 * Used in: filter.overallStatus, AREA[OverallStatus]
 */
const OverallStatus = {
  ACTIVE_NOT_RECRUITING: 'ACTIVE_NOT_RECRUITING',
  COMPLETED: 'COMPLETED',
  ENROLLING_BY_INVITATION: 'ENROLLING_BY_INVITATION',
  NOT_YET_RECRUITING: 'NOT_YET_RECRUITING',
  RECRUITING: 'RECRUITING',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  WITHDRAWN: 'WITHDRAWN',
  AVAILABLE: 'AVAILABLE',  // For Expanded Access
  NO_LONGER_AVAILABLE: 'NO_LONGER_AVAILABLE',
  TEMPORARILY_NOT_AVAILABLE: 'TEMPORARILY_NOT_AVAILABLE',
  APPROVED_FOR_MARKETING: 'APPROVED_FOR_MARKETING',
  WITHHELD: 'WITHHELD',
  UNKNOWN: 'UNKNOWN',
};
const OverallStatusValues = Object.values(OverallStatus);

/**
 * Study Type
 * Used in: AREA[StudyType]
 */
const StudyType = {
  INTERVENTIONAL: 'INTERVENTIONAL',
  OBSERVATIONAL: 'OBSERVATIONAL',
  EXPANDED_ACCESS: 'EXPANDED_ACCESS',
};
const StudyTypeValues = Object.values(StudyType);

/**
 * Study Phase
 * Used in: AREA[Phase]
 */
const Phase = {
  EARLY_PHASE1: 'EARLY_PHASE1',
  PHASE1: 'PHASE1',
  PHASE2: 'PHASE2',
  PHASE3: 'PHASE3',
  PHASE4: 'PHASE4',
  NA: 'NA',  // Not Applicable
};
const PhaseValues = Object.values(Phase);

/**
 * Sex/Gender Eligibility
 * Used in: AREA[Sex]
 */
const Sex = {
  ALL: 'ALL',
  FEMALE: 'FEMALE',
  MALE: 'MALE',
};
const SexValues = Object.values(Sex);

/**
 * Standard Age Groups
 * Used in: AREA[StdAge]
 */
const StandardAge = {
  CHILD: 'CHILD',      // Birth to 17 years
  ADULT: 'ADULT',      // 18 to 64 years
  OLDER_ADULT: 'OLDER_ADULT',  // 65+ years
};
const StandardAgeValues = Object.values(StandardAge);

/**
 * Agency/Funder Class
 * Used in: AREA[LeadSponsorClass], AREA[CollaboratorClass]
 */
const AgencyClass = {
  NIH: 'NIH',
  FED: 'FED',
  OTHER_GOV: 'OTHER_GOV',
  INDIV: 'INDIV',
  INDUSTRY: 'INDUSTRY',
  NETWORK: 'NETWORK',
  AMBIG: 'AMBIG',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
};
const AgencyClassValues = Object.values(AgencyClass);

/**
 * Design Allocation
 * Used in: AREA[DesignAllocation]
 */
const DesignAllocation = {
  RANDOMIZED: 'RANDOMIZED',
  NON_RANDOMIZED: 'NON_RANDOMIZED',
  NA: 'NA',
};
const DesignAllocationValues = Object.values(DesignAllocation);

/**
 * Intervention Model (for Interventional studies)
 * Used in: AREA[DesignInterventionModel]
 */
const InterventionModel = {
  SINGLE_GROUP: 'SINGLE_GROUP',
  PARALLEL: 'PARALLEL',
  CROSSOVER: 'CROSSOVER',
  FACTORIAL: 'FACTORIAL',
  SEQUENTIAL: 'SEQUENTIAL',
};
const InterventionModelValues = Object.values(InterventionModel);

/**
 * Primary Purpose
 * Used in: AREA[DesignPrimaryPurpose]
 */
const PrimaryPurpose = {
  TREATMENT: 'TREATMENT',
  PREVENTION: 'PREVENTION',
  DIAGNOSTIC: 'DIAGNOSTIC',
  ECT: 'ECT',  // Educational/Counseling/Training
  SUPPORTIVE_CARE: 'SUPPORTIVE_CARE',
  SCREENING: 'SCREENING',
  HEALTH_SERVICES_RESEARCH: 'HEALTH_SERVICES_RESEARCH',
  BASIC_SCIENCE: 'BASIC_SCIENCE',
  DEVICE_FEASIBILITY: 'DEVICE_FEASIBILITY',
  OTHER: 'OTHER',
};
const PrimaryPurposeValues = Object.values(PrimaryPurpose);

/**
 * Observational Model (for Observational studies)
 * Used in: AREA[DesignObservationalModel]
 */
const ObservationalModel = {
  COHORT: 'COHORT',
  CASE_CONTROL: 'CASE_CONTROL',
  CASE_ONLY: 'CASE_ONLY',
  CASE_CROSSOVER: 'CASE_CROSSOVER',
  ECOLOGIC_OR_COMMUNITY: 'ECOLOGIC_OR_COMMUNITY',
  FAMILY_BASED: 'FAMILY_BASED',
  DEFINED_POPULATION: 'DEFINED_POPULATION',
  NATURAL_HISTORY: 'NATURAL_HISTORY',
  OTHER: 'OTHER',
};
const ObservationalModelValues = Object.values(ObservationalModel);

/**
 * Time Perspective (for Observational studies)
 * Used in: AREA[DesignTimePerspective]
 */
const TimePerspective = {
  PROSPECTIVE: 'PROSPECTIVE',
  RETROSPECTIVE: 'RETROSPECTIVE',
  CROSS_SECTIONAL: 'CROSS_SECTIONAL',
  OTHER: 'OTHER',
};
const TimePerspectiveValues = Object.values(TimePerspective);

/**
 * Design Masking/Blinding
 * Used in: AREA[DesignMasking]
 */
const DesignMasking = {
  NONE: 'NONE',  // Open Label
  SINGLE: 'SINGLE',
  DOUBLE: 'DOUBLE',
  TRIPLE: 'TRIPLE',
  QUADRUPLE: 'QUADRUPLE',
};
const DesignMaskingValues = Object.values(DesignMasking);

/**
 * Who Is Masked
 * Used in: AREA[DesignWhoMasked]
 */
const WhoMasked = {
  PARTICIPANT: 'PARTICIPANT',
  CARE_PROVIDER: 'CARE_PROVIDER',
  INVESTIGATOR: 'INVESTIGATOR',
  OUTCOMES_ASSESSOR: 'OUTCOMES_ASSESSOR',
};
const WhoMaskedValues = Object.values(WhoMasked);

/**
 * Intervention Type
 * Used in: AREA[InterventionType]
 */
const InterventionType = {
  BEHAVIORAL: 'BEHAVIORAL',
  BIOLOGICAL: 'BIOLOGICAL',
  COMBINATION_PRODUCT: 'COMBINATION_PRODUCT',
  DEVICE: 'DEVICE',
  DIAGNOSTIC_TEST: 'DIAGNOSTIC_TEST',
  DIETARY_SUPPLEMENT: 'DIETARY_SUPPLEMENT',
  DRUG: 'DRUG',
  GENETIC: 'GENETIC',
  PROCEDURE: 'PROCEDURE',
  RADIATION: 'RADIATION',
  OTHER: 'OTHER',
};
const InterventionTypeValues = Object.values(InterventionType);

/**
 * Arm Group Type
 * Used in: AREA[ArmGroupType]
 */
const ArmGroupType = {
  EXPERIMENTAL: 'EXPERIMENTAL',
  ACTIVE_COMPARATOR: 'ACTIVE_COMPARATOR',
  PLACEBO_COMPARATOR: 'PLACEBO_COMPARATOR',
  SHAM_COMPARATOR: 'SHAM_COMPARATOR',
  NO_INTERVENTION: 'NO_INTERVENTION',
  OTHER: 'OTHER',
};
const ArmGroupTypeValues = Object.values(ArmGroupType);

/**
 * Responsible Party Type
 * Used in: AREA[ResponsiblePartyType]
 */
const ResponsiblePartyType = {
  SPONSOR: 'SPONSOR',
  PRINCIPAL_INVESTIGATOR: 'PRINCIPAL_INVESTIGATOR',
  SPONSOR_INVESTIGATOR: 'SPONSOR_INVESTIGATOR',
};
const ResponsiblePartyTypeValues = Object.values(ResponsiblePartyType);

/**
 * Recruitment Status (for individual locations)
 * Used in: AREA[LocationStatus]
 */
const RecruitmentStatus = {
  ACTIVE_NOT_RECRUITING: 'ACTIVE_NOT_RECRUITING',
  COMPLETED: 'COMPLETED',
  ENROLLING_BY_INVITATION: 'ENROLLING_BY_INVITATION',
  NOT_YET_RECRUITING: 'NOT_YET_RECRUITING',
  RECRUITING: 'RECRUITING',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  WITHDRAWN: 'WITHDRAWN',
  AVAILABLE: 'AVAILABLE',
};
const RecruitmentStatusValues = Object.values(RecruitmentStatus);

/**
 * Expanded Access Status
 */
const ExpandedAccessStatus = {
  AVAILABLE: 'AVAILABLE',
  NO_LONGER_AVAILABLE: 'NO_LONGER_AVAILABLE',
  TEMPORARILY_NOT_AVAILABLE: 'TEMPORARILY_NOT_AVAILABLE',
  APPROVED_FOR_MARKETING: 'APPROVED_FOR_MARKETING',
};
const ExpandedAccessStatusValues = Object.values(ExpandedAccessStatus);

/**
 * Enrollment Type
 * Used in: AREA[EnrollmentType]
 */
const EnrollmentType = {
  ACTUAL: 'ACTUAL',
  ESTIMATED: 'ESTIMATED',
};
const EnrollmentTypeValues = Object.values(EnrollmentType);

/**
 * Date Type
 */
const DateType = {
  ACTUAL: 'ACTUAL',
  ESTIMATED: 'ESTIMATED',
};
const DateTypeValues = Object.values(DateType);

/**
 * Sampling Method (for Observational studies)
 * Used in: AREA[SamplingMethod]
 */
const SamplingMethod = {
  PROBABILITY_SAMPLE: 'PROBABILITY_SAMPLE',
  NON_PROBABILITY_SAMPLE: 'NON_PROBABILITY_SAMPLE',
};
const SamplingMethodValues = Object.values(SamplingMethod);

/**
 * Biospecimen Retention
 * Used in: AREA[BioSpecRetention]
 */
const BioSpecRetention = {
  NONE_RETAINED: 'NONE_RETAINED',
  SAMPLES_WITH_DNA: 'SAMPLES_WITH_DNA',
  SAMPLES_WITHOUT_DNA: 'SAMPLES_WITHOUT_DNA',
};
const BioSpecRetentionValues = Object.values(BioSpecRetention);

/**
 * IPD Sharing
 * Used in: AREA[IPDSharing]
 */
const IPDSharing = {
  YES: 'YES',
  NO: 'NO',
  UNDECIDED: 'UNDECIDED',
};
const IPDSharingValues = Object.values(IPDSharing);

/**
 * IPD Sharing Info Type
 */
const IPDSharingInfoType = {
  STUDY_PROTOCOL: 'STUDY_PROTOCOL',
  SAP: 'SAP',  // Statistical Analysis Plan
  ICF: 'ICF',  // Informed Consent Form
  CSR: 'CSR',  // Clinical Study Report
  ANALYTIC_CODE: 'ANALYTIC_CODE',
};
const IPDSharingInfoTypeValues = Object.values(IPDSharingInfoType);

/**
 * Organization Study ID Type
 */
const OrgStudyIdType = {
  NIH: 'NIH',
  FDA: 'FDA',
  VA: 'VA',
  CDC: 'CDC',
  AHRQ: 'AHRQ',
  SAMHSA: 'SAMHSA',
};
const OrgStudyIdTypeValues = Object.values(OrgStudyIdType);

/**
 * Secondary ID Type
 */
const SecondaryIdType = {
  NIH: 'NIH',
  FDA: 'FDA',
  VA: 'VA',
  CDC: 'CDC',
  AHRQ: 'AHRQ',
  SAMHSA: 'SAMHSA',
  OTHER_GRANT: 'OTHER_GRANT',
  EUDRACT_NUMBER: 'EUDRACT_NUMBER',
  CTIS: 'CTIS',  // EU Trial Number
  REGISTRY: 'REGISTRY',
  OTHER: 'OTHER',
};
const SecondaryIdTypeValues = Object.values(SecondaryIdType);

/**
 * Official Role
 */
const OfficialRole = {
  STUDY_CHAIR: 'STUDY_CHAIR',
  STUDY_DIRECTOR: 'STUDY_DIRECTOR',
  PRINCIPAL_INVESTIGATOR: 'PRINCIPAL_INVESTIGATOR',
  SUB_INVESTIGATOR: 'SUB_INVESTIGATOR',
};
const OfficialRoleValues = Object.values(OfficialRole);

/**
 * Contact Role
 */
const ContactRole = {
  STUDY_CHAIR: 'STUDY_CHAIR',
  STUDY_DIRECTOR: 'STUDY_DIRECTOR',
  PRINCIPAL_INVESTIGATOR: 'PRINCIPAL_INVESTIGATOR',
  SUB_INVESTIGATOR: 'SUB_INVESTIGATOR',
  CONTACT: 'CONTACT',
};
const ContactRoleValues = Object.values(ContactRole);

/**
 * Reference Type
 */
const ReferenceType = {
  BACKGROUND: 'BACKGROUND',
  RESULT: 'RESULT',
  DERIVED: 'DERIVED',
};
const ReferenceTypeValues = Object.values(ReferenceType);

/**
 * Outcome Measure Type
 */
const OutcomeMeasureType = {
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  OTHER_PRE_SPECIFIED: 'OTHER_PRE_SPECIFIED',
  POST_HOC: 'POST_HOC',
};
const OutcomeMeasureTypeValues = Object.values(OutcomeMeasureType);

// ============================================
// SECTION 2: ALL 19 SEARCH AREAS
// ============================================

/**
 * Search Areas define which parts of a study record are searched.
 * Each area has:
 * - name: API parameter name
 * - queryParam: The query parameter to use
 * - description: What this search area does
 * - fields: Array of {name, weight, type, synonyms} objects
 */

const SearchAreas = {
  // 1. BasicSearch - Default for "Other terms" - 57 fields
  BasicSearch: {
    name: 'BasicSearch',
    queryParam: 'query.term',
    description: 'Default search area for "Other terms" input. Searches 57 weighted fields including titles, conditions, interventions, outcomes, and more.',
    fields: [
      { name: 'NCTId', weight: 1, type: 'nct' },
      { name: 'Acronym', weight: 1, type: 'text', synonyms: true },
      { name: 'BriefTitle', weight: 0.89, type: 'text', synonyms: true },
      { name: 'OfficialTitle', weight: 0.85, type: 'text', synonyms: true },
      { name: 'Condition', weight: 0.81, type: 'text', synonyms: true },
      { name: 'InterventionName', weight: 0.8, type: 'text', synonyms: true },
      { name: 'InterventionOtherName', weight: 0.75, type: 'text', synonyms: true },
      { name: 'Phase', weight: 0.65, type: 'enum', enumType: 'Phase' },
      { name: 'StdAge', weight: 0.65, type: 'enum', enumType: 'StandardAge' },
      { name: 'PrimaryOutcomeMeasure', weight: 0.6, type: 'text', synonyms: true },
      { name: 'Keyword', weight: 0.6, type: 'text', synonyms: true },
      { name: 'BriefSummary', weight: 0.6, type: 'markup', synonyms: true },
      { name: 'ArmGroupLabel', weight: 0.55, type: 'text', synonyms: true },
      { name: 'SecondaryOutcomeMeasure', weight: 0.5, type: 'text', synonyms: true },
      { name: 'InterventionDescription', weight: 0.45, type: 'markup', synonyms: true },
      { name: 'ArmGroupDescription', weight: 0.45, type: 'markup', synonyms: true },
      { name: 'PrimaryOutcomeDescription', weight: 0.4, type: 'markup', synonyms: true },
      { name: 'LeadSponsorName', weight: 0.4, type: 'text' },
      { name: 'OrgStudyId', weight: 0.4, type: 'text' },
      { name: 'SecondaryId', weight: 0.4, type: 'text' },
      { name: 'NCTIdAlias', weight: 0.4, type: 'nct' },
      { name: 'InterventionType', weight: 0.35, type: 'enum', enumType: 'InterventionType' },
      { name: 'ArmGroupType', weight: 0.35, type: 'enum', enumType: 'ArmGroupType' },
      { name: 'SecondaryOutcomeDescription', weight: 0.35, type: 'markup', synonyms: true },
      { name: 'LocationFacility', weight: 0.35, type: 'text' },
      { name: 'LocationStatus', weight: 0.35, type: 'enum', enumType: 'RecruitmentStatus' },
      { name: 'LocationState', weight: 0.35, type: 'GeoName' },
      { name: 'LocationCountry', weight: 0.35, type: 'text' },
      { name: 'LocationCity', weight: 0.35, type: 'GeoName' },
      { name: 'BioSpecDescription', weight: 0.3, type: 'markup', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorFullName', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorTitle', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorAffiliation', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldNameTitle', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldOrganization', weight: 0.3, type: 'text', synonyms: true },
      { name: 'OverallOfficialAffiliation', weight: 0.3, type: 'text' },
      { name: 'OverallOfficialRole', weight: 0.3, type: 'enum', enumType: 'OfficialRole' },
      { name: 'OverallOfficialName', weight: 0.3, type: 'text' },
      { name: 'CentralContactName', weight: 0.3, type: 'text' },
      { name: 'ConditionMeshTerm', weight: 0.3, type: 'text', synonyms: true },
      { name: 'InterventionMeshTerm', weight: 0.3, type: 'text', synonyms: true },
      { name: 'DesignAllocation', weight: 0.3, type: 'enum', enumType: 'DesignAllocation' },
      { name: 'DesignInterventionModel', weight: 0.3, type: 'enum', enumType: 'InterventionModel' },
      { name: 'DesignMasking', weight: 0.3, type: 'enum', enumType: 'DesignMasking' },
      { name: 'DesignWhoMasked', weight: 0.3, type: 'enum', enumType: 'WhoMasked' },
      { name: 'DesignObservationalModel', weight: 0.3, type: 'enum', enumType: 'ObservationalModel' },
      { name: 'DesignPrimaryPurpose', weight: 0.3, type: 'enum', enumType: 'PrimaryPurpose' },
      { name: 'DesignTimePerspective', weight: 0.3, type: 'enum', enumType: 'TimePerspective' },
      { name: 'StudyType', weight: 0.3, type: 'enum', enumType: 'StudyType' },
      { name: 'ConditionAncestorTerm', weight: 0.25, type: 'text', synonyms: true },
      { name: 'InterventionAncestorTerm', weight: 0.25, type: 'text', synonyms: true },
      { name: 'CollaboratorName', weight: 0.25, type: 'text' },
      { name: 'OtherOutcomeMeasure', weight: 0.15, type: 'text', synonyms: true },
      { name: 'OutcomeMeasureTitle', weight: 0.15, type: 'text', synonyms: true },
      { name: 'OtherOutcomeDescription', weight: 0.1, type: 'markup', synonyms: true },
      { name: 'OutcomeMeasureDescription', weight: 0.1, type: 'markup', synonyms: true },
      { name: 'LocationContactName', weight: 0.1, type: 'text' },
    ],
  },

  // 2. ConditionSearch - "Conditions or disease" - 7 fields
  ConditionSearch: {
    name: 'ConditionSearch',
    queryParam: 'query.cond',
    description: 'Search area for "Conditions or disease" input. Focuses on condition-related fields.',
    fields: [
      { name: 'Condition', weight: 0.95, type: 'text', synonyms: true },
      { name: 'BriefTitle', weight: 0.6, type: 'text', synonyms: true },
      { name: 'OfficialTitle', weight: 0.55, type: 'text', synonyms: true },
      { name: 'ConditionMeshTerm', weight: 0.5, type: 'text', synonyms: true },
      { name: 'ConditionAncestorTerm', weight: 0.4, type: 'text', synonyms: true },
      { name: 'Keyword', weight: 0.3, type: 'text', synonyms: true },
      { name: 'NCTId', weight: 0.2, type: 'nct' },
    ],
  },

  // 3. InterventionSearch - "Intervention / treatment" - 12 fields
  InterventionSearch: {
    name: 'InterventionSearch',
    queryParam: 'query.intr',
    description: 'Search area for "Intervention / treatment" input. Focuses on intervention-related fields.',
    fields: [
      { name: 'InterventionName', weight: 0.95, type: 'text', synonyms: true },
      { name: 'InterventionType', weight: 0.85, type: 'enum', enumType: 'InterventionType' },
      { name: 'ArmGroupType', weight: 0.85, type: 'enum', enumType: 'ArmGroupType' },
      { name: 'InterventionOtherName', weight: 0.75, type: 'text', synonyms: true },
      { name: 'BriefTitle', weight: 0.65, type: 'text', synonyms: true },
      { name: 'OfficialTitle', weight: 0.6, type: 'text', synonyms: true },
      { name: 'ArmGroupLabel', weight: 0.5, type: 'text', synonyms: true },
      { name: 'InterventionMeshTerm', weight: 0.5, type: 'text', synonyms: true },
      { name: 'Keyword', weight: 0.5, type: 'text', synonyms: true },
      { name: 'InterventionAncestorTerm', weight: 0.4, type: 'text', synonyms: true },
      { name: 'InterventionDescription', weight: 0.4, type: 'markup', synonyms: true },
      { name: 'ArmGroupDescription', weight: 0.4, type: 'markup', synonyms: true },
    ],
  },

  // 4. InterventionNameSearch - 2 fields
  InterventionNameSearch: {
    name: 'InterventionNameSearch',
    queryParam: null,  // No direct query param, use AREA[]
    description: 'Searches only intervention name fields.',
    fields: [
      { name: 'InterventionName', weight: 1, type: 'text', synonyms: true },
      { name: 'InterventionOtherName', weight: 0.9, type: 'text', synonyms: true },
    ],
  },

  // 5. ObsoleteConditionSearch - 4 fields
  ObsoleteConditionSearch: {
    name: 'ObsoleteConditionSearch',
    queryParam: null,
    description: 'Legacy condition search with obsolete term matching.',
    fields: [
      { name: 'Condition', weight: 0.95, type: 'text', synonyms: true },
      { name: 'ConditionMeshTerm', weight: 0.8, type: 'text', synonyms: true },
      { name: 'ConditionAncestorTerm', weight: 0.8, type: 'text', synonyms: true },
      { name: 'Keyword', weight: 0.6, type: 'text', synonyms: true },
    ],
  },

  // 6. ExternalIdsSearch - 2 fields
  ExternalIdsSearch: {
    name: 'ExternalIdsSearch',
    queryParam: null,
    description: 'Searches external study identifiers.',
    fields: [
      { name: 'OrgStudyId', weight: 0.9, type: 'text' },
      { name: 'SecondaryId', weight: 0.7, type: 'text' },
    ],
  },

  // 7. ExternalIdTypesSearch - 2 fields
  ExternalIdTypesSearch: {
    name: 'ExternalIdTypesSearch',
    queryParam: null,
    description: 'Searches by external ID types.',
    fields: [
      { name: 'OrgStudyIdType', weight: 0.9, type: 'enum', enumType: 'OrgStudyIdType' },
      { name: 'SecondaryIdType', weight: 0.7, type: 'enum', enumType: 'SecondaryIdType' },
    ],
  },

  // 8. EligibilitySearch - 2 fields
  EligibilitySearch: {
    name: 'EligibilitySearch',
    queryParam: null,
    description: 'Searches eligibility criteria text.',
    fields: [
      { name: 'EligibilityCriteria', weight: 0.95, type: 'markup', synonyms: true },
      { name: 'StudyPopulation', weight: 0.8, type: 'markup', synonyms: true },
    ],
  },

  // 9. OutcomeSearch - "Outcome measure" - 9 fields
  OutcomeSearch: {
    name: 'OutcomeSearch',
    queryParam: 'query.outc',
    description: 'Search area for "Outcome measure" input.',
    fields: [
      { name: 'PrimaryOutcomeMeasure', weight: 0.9, type: 'text', synonyms: true },
      { name: 'SecondaryOutcomeMeasure', weight: 0.8, type: 'text', synonyms: true },
      { name: 'PrimaryOutcomeDescription', weight: 0.6, type: 'markup', synonyms: true },
      { name: 'SecondaryOutcomeDescription', weight: 0.5, type: 'markup', synonyms: true },
      { name: 'OtherOutcomeMeasure', weight: 0.4, type: 'text', synonyms: true },
      { name: 'OutcomeMeasureTitle', weight: 0.4, type: 'text', synonyms: true },
      { name: 'OtherOutcomeDescription', weight: 0.3, type: 'markup', synonyms: true },
      { name: 'OutcomeMeasureDescription', weight: 0.3, type: 'markup', synonyms: true },
      { name: 'OutcomeMeasurePopulationDescription', weight: 0.3, type: 'markup', synonyms: true },
    ],
  },

  // 10. OutcomeNameSearch - 4 fields
  OutcomeNameSearch: {
    name: 'OutcomeNameSearch',
    queryParam: null,
    description: 'Searches only outcome measure name/title fields.',
    fields: [
      { name: 'PrimaryOutcomeMeasure', weight: 0.98, type: 'text', synonyms: true },
      { name: 'SecondaryOutcomeMeasure', weight: 0.8, type: 'text', synonyms: true },
      { name: 'OtherOutcomeMeasure', weight: 0.5, type: 'text', synonyms: true },
      { name: 'OutcomeMeasureTitle', weight: 0.3, type: 'text', synonyms: true },
    ],
  },

  // 11. TitleSearch - "Title / acronym" - 3 fields
  TitleSearch: {
    name: 'TitleSearch',
    queryParam: 'query.titles',
    description: 'Search area for "Title / acronym" input.',
    fields: [
      { name: 'Acronym', weight: 1, type: 'text', synonyms: true },
      { name: 'BriefTitle', weight: 0.95, type: 'text', synonyms: true },
      { name: 'OfficialTitle', weight: 0.8, type: 'text', synonyms: true },
    ],
  },

  // 12. LocationSearch - "Location terms" - 5 fields
  LocationSearch: {
    name: 'LocationSearch',
    queryParam: 'query.locn',
    description: 'Search area for "Location terms" input. Searches geographic location fields.',
    fields: [
      { name: 'LocationCity', weight: 0.95, type: 'GeoName' },
      { name: 'LocationState', weight: 0.95, type: 'GeoName' },
      { name: 'LocationCountry', weight: 0.95, type: 'text' },
      { name: 'LocationFacility', weight: 0.95, type: 'text' },
      { name: 'LocationZip', weight: 0.35, type: 'text' },
    ],
  },

  // 13. ContactSearch - 4 fields
  ContactSearch: {
    name: 'ContactSearch',
    queryParam: null,
    description: 'Searches contact and official name/affiliation fields.',
    fields: [
      { name: 'OverallOfficialName', weight: 0.95, type: 'text' },
      { name: 'CentralContactName', weight: 0.9, type: 'text' },
      { name: 'OverallOfficialAffiliation', weight: 0.85, type: 'text' },
      { name: 'LocationContactName', weight: 0.8, type: 'text' },
    ],
  },

  // 14. NCTIdSearch - 2 fields
  NCTIdSearch: {
    name: 'NCTIdSearch',
    queryParam: null,
    description: 'Searches NCT identifiers only.',
    fields: [
      { name: 'NCTId', weight: 1, type: 'nct' },
      { name: 'NCTIdAlias', weight: 0.9, type: 'nct' },
    ],
  },

  // 15. IdSearch - "Study IDs" - 5 fields
  IdSearch: {
    name: 'IdSearch',
    queryParam: 'query.id',
    description: 'Search area for "Study IDs" input. Searches all identifier fields.',
    fields: [
      { name: 'NCTId', weight: 1, type: 'nct' },
      { name: 'NCTIdAlias', weight: 0.9, type: 'nct' },
      { name: 'Acronym', weight: 0.85, type: 'text', synonyms: true },
      { name: 'OrgStudyId', weight: 0.8, type: 'text' },
      { name: 'SecondaryId', weight: 0.75, type: 'text' },
    ],
  },

  // 16. SponsorSearch - "Sponsor / collaborator" - 3 fields
  SponsorSearch: {
    name: 'SponsorSearch',
    queryParam: 'query.spons',
    description: 'Search area for "Sponsor / collaborator" input.',
    fields: [
      { name: 'LeadSponsorName', weight: 1, type: 'text' },
      { name: 'CollaboratorName', weight: 0.9, type: 'text' },
      { name: 'OrgFullName', weight: 0.6, type: 'text' },
    ],
  },

  // 17. FunderTypeSearch - 2 fields
  FunderTypeSearch: {
    name: 'FunderTypeSearch',
    queryParam: null,
    description: 'Searches by funder/agency class type.',
    fields: [
      { name: 'LeadSponsorClass', weight: 1, type: 'enum', enumType: 'AgencyClass' },
      { name: 'CollaboratorClass', weight: 0.9, type: 'enum', enumType: 'AgencyClass' },
    ],
  },

  // 18. ResponsiblePartySearch - 5 fields
  ResponsiblePartySearch: {
    name: 'ResponsiblePartySearch',
    queryParam: null,
    description: 'Searches responsible party information.',
    fields: [
      { name: 'ResponsiblePartyInvestigatorFullName', weight: 0.9, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldNameTitle', weight: 0.8, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorAffiliation', weight: 0.8, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldOrganization', weight: 0.7, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorTitle', weight: 0.7, type: 'text', synonyms: true },
    ],
  },

  // 19. PatientSearch - 47 fields
  PatientSearch: {
    name: 'PatientSearch',
    queryParam: 'query.patient',
    description: 'Patient-focused search area with 47 weighted fields optimized for patient understanding.',
    fields: [
      { name: 'Acronym', weight: 1, type: 'text', synonyms: true },
      { name: 'Condition', weight: 0.95, type: 'text', synonyms: true },
      { name: 'BriefTitle', weight: 0.9, type: 'text', synonyms: true },
      { name: 'OfficialTitle', weight: 0.85, type: 'text', synonyms: true },
      { name: 'ConditionMeshTerm', weight: 0.8, type: 'text', synonyms: true },
      { name: 'ConditionAncestorTerm', weight: 0.7, type: 'text', synonyms: true },
      { name: 'BriefSummary', weight: 0.65, type: 'markup', synonyms: true },
      { name: 'Keyword', weight: 0.6, type: 'text', synonyms: true },
      { name: 'InterventionName', weight: 0.6, type: 'text', synonyms: true },
      { name: 'InterventionOtherName', weight: 0.6, type: 'text', synonyms: true },
      { name: 'PrimaryOutcomeMeasure', weight: 0.6, type: 'text', synonyms: true },
      { name: 'StdAge', weight: 0.6, type: 'enum', enumType: 'StandardAge' },
      { name: 'ArmGroupLabel', weight: 0.5, type: 'text', synonyms: true },
      { name: 'SecondaryOutcomeMeasure', weight: 0.5, type: 'text', synonyms: true },
      { name: 'InterventionDescription', weight: 0.45, type: 'markup', synonyms: true },
      { name: 'ArmGroupDescription', weight: 0.45, type: 'markup', synonyms: true },
      { name: 'PrimaryOutcomeDescription', weight: 0.45, type: 'markup', synonyms: true },
      { name: 'LeadSponsorName', weight: 0.4, type: 'text' },
      { name: 'OrgStudyId', weight: 0.4, type: 'text' },
      { name: 'SecondaryId', weight: 0.4, type: 'text' },
      { name: 'NCTIdAlias', weight: 0.4, type: 'nct' },
      { name: 'SecondaryOutcomeDescription', weight: 0.35, type: 'markup', synonyms: true },
      { name: 'LocationFacility', weight: 0.35, type: 'text' },
      { name: 'LocationState', weight: 0.35, type: 'GeoName' },
      { name: 'LocationCountry', weight: 0.35, type: 'text' },
      { name: 'LocationCity', weight: 0.35, type: 'GeoName' },
      { name: 'BioSpecDescription', weight: 0.3, type: 'markup', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorFullName', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorTitle', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyInvestigatorAffiliation', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldNameTitle', weight: 0.3, type: 'text', synonyms: true },
      { name: 'ResponsiblePartyOldOrganization', weight: 0.3, type: 'text', synonyms: true },
      { name: 'OverallOfficialAffiliation', weight: 0.3, type: 'text' },
      { name: 'OverallOfficialName', weight: 0.3, type: 'text' },
      { name: 'CentralContactName', weight: 0.3, type: 'text' },
      { name: 'DesignInterventionModel', weight: 0.3, type: 'enum', enumType: 'InterventionModel' },
      { name: 'DesignMasking', weight: 0.3, type: 'enum', enumType: 'DesignMasking' },
      { name: 'DesignWhoMasked', weight: 0.3, type: 'enum', enumType: 'WhoMasked' },
      { name: 'DesignObservationalModel', weight: 0.3, type: 'enum', enumType: 'ObservationalModel' },
      { name: 'DesignPrimaryPurpose', weight: 0.3, type: 'enum', enumType: 'PrimaryPurpose' },
      { name: 'DesignTimePerspective', weight: 0.3, type: 'enum', enumType: 'TimePerspective' },
      { name: 'InterventionMeshTerm', weight: 0.3, type: 'text', synonyms: true },
      { name: 'InterventionAncestorTerm', weight: 0.25, type: 'text', synonyms: true },
      { name: 'CollaboratorName', weight: 0.25, type: 'text' },
      { name: 'OtherOutcomeMeasure', weight: 0.15, type: 'text', synonyms: true },
      { name: 'OtherOutcomeDescription', weight: 0.1, type: 'markup', synonyms: true },
      { name: 'LocationContactName', weight: 0.1, type: 'text' },
    ],
  },
};

// ============================================
// SECTION 3: ALL SEARCHABLE FIELDS (from Study Data Structure)
// ============================================

/**
 * Complete list of all fields that can be used in AREA[] expressions.
 * Grouped by module/section for easy reference.
 */

const SearchableFields = {
  // Identification Module
  identification: {
    NCTId: { type: 'nct', description: 'NCT Number (e.g., NCT12345678)' },
    NCTIdAlias: { type: 'nct', description: 'Obsolete/duplicate NCT IDs' },
    OrgStudyId: { type: 'text', description: 'Organization study ID' },
    OrgStudyIdType: { type: 'enum', values: OrgStudyIdTypeValues, description: 'Type of org study ID' },
    SecondaryId: { type: 'text', description: 'Secondary identifiers' },
    SecondaryIdType: { type: 'enum', values: SecondaryIdTypeValues, description: 'Type of secondary ID' },
    SecondaryIdDomain: { type: 'text', description: 'Secondary ID domain/description' },
    BriefTitle: { type: 'text', description: 'Brief study title (max 300 chars)' },
    OfficialTitle: { type: 'text', description: 'Official study title (max 600 chars)' },
    Acronym: { type: 'text', description: 'Study acronym (max 14 chars)' },
    OrgFullName: { type: 'text', description: 'Organization full name' },
    OrgClass: { type: 'enum', values: AgencyClassValues, description: 'Organization type' },
  },

  // Status Module
  status: {
    OverallStatus: { type: 'enum', values: OverallStatusValues, description: 'Overall recruitment status' },
    LastKnownStatus: { type: 'enum', values: OverallStatusValues, description: 'Last known status for unknown studies' },
    WhyStopped: { type: 'markup', description: 'Reason study stopped' },
    HasExpandedAccess: { type: 'boolean', description: 'Has expanded access availability' },
    StartDate: { type: 'date', description: 'Study start date' },
    StartDateType: { type: 'enum', values: DateTypeValues, description: 'Actual or Estimated' },
    PrimaryCompletionDate: { type: 'date', description: 'Primary completion date' },
    PrimaryCompletionDateType: { type: 'enum', values: DateTypeValues, description: 'Actual or Estimated' },
    CompletionDate: { type: 'date', description: 'Study completion date' },
    CompletionDateType: { type: 'enum', values: DateTypeValues, description: 'Actual or Estimated' },
    StudyFirstSubmitDate: { type: 'date', description: 'First submitted date' },
    StudyFirstPostDate: { type: 'date', description: 'First posted date' },
    ResultsFirstSubmitDate: { type: 'date', description: 'Results first submitted' },
    ResultsFirstPostDate: { type: 'date', description: 'Results first posted' },
    LastUpdateSubmitDate: { type: 'date', description: 'Last update submitted' },
    LastUpdatePostDate: { type: 'date', description: 'Last update posted' },
    StatusVerifiedDate: { type: 'date', description: 'Record verification date' },
  },

  // Sponsor/Collaborators Module
  sponsor: {
    LeadSponsorName: { type: 'text', description: 'Lead sponsor name' },
    LeadSponsorClass: { type: 'enum', values: AgencyClassValues, description: 'Lead sponsor type' },
    CollaboratorName: { type: 'text', description: 'Collaborator names' },
    CollaboratorClass: { type: 'enum', values: AgencyClassValues, description: 'Collaborator types' },
    ResponsiblePartyType: { type: 'enum', values: ResponsiblePartyTypeValues, description: 'Responsible party type' },
    ResponsiblePartyInvestigatorFullName: { type: 'text', description: 'Investigator name' },
    ResponsiblePartyInvestigatorTitle: { type: 'text', description: 'Investigator title' },
    ResponsiblePartyInvestigatorAffiliation: { type: 'text', description: 'Investigator affiliation' },
    ResponsiblePartyOldNameTitle: { type: 'text', description: 'Legacy name/title' },
    ResponsiblePartyOldOrganization: { type: 'text', description: 'Legacy organization' },
  },

  // Oversight Module
  oversight: {
    OversightHasDMC: { type: 'boolean', description: 'Has Data Monitoring Committee' },
    IsFDARegulatedDrug: { type: 'boolean', description: 'FDA-regulated drug product' },
    IsFDARegulatedDevice: { type: 'boolean', description: 'FDA-regulated device product' },
    IsUnapprovedDevice: { type: 'boolean', description: 'Unapproved device' },
    IsPpsd: { type: 'boolean', description: 'Pediatric postmarket surveillance' },
    IsUsExport: { type: 'boolean', description: 'Product exported from US' },
    FDAAA801Violation: { type: 'boolean', description: 'FDAAA 801 violation' },
  },

  // Description Module
  description: {
    BriefSummary: { type: 'markup', description: 'Brief study summary' },
    DetailedDescription: { type: 'markup', description: 'Detailed description' },
  },

  // Conditions Module
  conditions: {
    Condition: { type: 'text', description: 'Primary conditions/diseases' },
    Keyword: { type: 'text', description: 'Keywords' },
    ConditionMeshTerm: { type: 'text', description: 'Condition MeSH terms' },
    ConditionAncestorTerm: { type: 'text', description: 'Condition ancestor MeSH terms' },
  },

  // Design Module
  design: {
    StudyType: { type: 'enum', values: StudyTypeValues, description: 'Study type' },
    Phase: { type: 'enum', values: PhaseValues, description: 'Study phase' },
    DesignAllocation: { type: 'enum', values: DesignAllocationValues, description: 'Allocation method' },
    DesignInterventionModel: { type: 'enum', values: InterventionModelValues, description: 'Intervention model' },
    DesignInterventionModelDescription: { type: 'markup', description: 'Model description' },
    DesignPrimaryPurpose: { type: 'enum', values: PrimaryPurposeValues, description: 'Primary purpose' },
    DesignObservationalModel: { type: 'enum', values: ObservationalModelValues, description: 'Observational model' },
    DesignTimePerspective: { type: 'enum', values: TimePerspectiveValues, description: 'Time perspective' },
    DesignMasking: { type: 'enum', values: DesignMaskingValues, description: 'Masking type' },
    DesignMaskingDescription: { type: 'markup', description: 'Masking description' },
    DesignWhoMasked: { type: 'enum', values: WhoMaskedValues, description: 'Who is masked' },
    EnrollmentCount: { type: 'integer', description: 'Enrollment count' },
    EnrollmentType: { type: 'enum', values: EnrollmentTypeValues, description: 'Actual or Estimated' },
    TargetDuration: { type: 'time', description: 'Target follow-up duration' },
    PatientRegistry: { type: 'boolean', description: 'Is patient registry' },
    BioSpecRetention: { type: 'enum', values: BioSpecRetentionValues, description: 'Biospecimen retention' },
    BioSpecDescription: { type: 'markup', description: 'Biospecimen description' },
  },

  // Arms/Interventions Module
  armsInterventions: {
    ArmGroupLabel: { type: 'text', description: 'Arm/group label' },
    ArmGroupType: { type: 'enum', values: ArmGroupTypeValues, description: 'Arm type' },
    ArmGroupDescription: { type: 'markup', description: 'Arm description' },
    InterventionType: { type: 'enum', values: InterventionTypeValues, description: 'Intervention type' },
    InterventionName: { type: 'text', description: 'Intervention name' },
    InterventionDescription: { type: 'markup', description: 'Intervention description' },
    InterventionOtherName: { type: 'text', description: 'Other intervention names' },
    InterventionMeshTerm: { type: 'text', description: 'Intervention MeSH terms' },
    InterventionAncestorTerm: { type: 'text', description: 'Intervention ancestor MeSH terms' },
  },

  // Outcomes Module
  outcomes: {
    PrimaryOutcomeMeasure: { type: 'text', description: 'Primary outcome title' },
    PrimaryOutcomeDescription: { type: 'markup', description: 'Primary outcome description' },
    PrimaryOutcomeTimeFrame: { type: 'text', description: 'Primary outcome time frame' },
    SecondaryOutcomeMeasure: { type: 'text', description: 'Secondary outcome title' },
    SecondaryOutcomeDescription: { type: 'markup', description: 'Secondary outcome description' },
    SecondaryOutcomeTimeFrame: { type: 'text', description: 'Secondary outcome time frame' },
    OtherOutcomeMeasure: { type: 'text', description: 'Other outcome title' },
    OtherOutcomeDescription: { type: 'markup', description: 'Other outcome description' },
    OtherOutcomeTimeFrame: { type: 'text', description: 'Other outcome time frame' },
    OutcomeMeasureTitle: { type: 'text', description: 'Results outcome measure title' },
    OutcomeMeasureDescription: { type: 'markup', description: 'Results outcome measure description' },
    OutcomeMeasurePopulationDescription: { type: 'markup', description: 'Analysis population description' },
  },

  // Eligibility Module
  eligibility: {
    EligibilityCriteria: { type: 'markup', description: 'Eligibility criteria text' },
    HealthyVolunteers: { type: 'boolean', description: 'Accepts healthy volunteers' },
    Sex: { type: 'enum', values: SexValues, description: 'Sex eligibility' },
    GenderBased: { type: 'boolean', description: 'Gender-based eligibility' },
    GenderDescription: { type: 'markup', description: 'Gender eligibility description' },
    MinimumAge: { type: 'age', description: 'Minimum age (e.g., "18 Years")' },
    MaximumAge: { type: 'age', description: 'Maximum age (e.g., "65 Years")' },
    StdAge: { type: 'enum', values: StandardAgeValues, description: 'Standard age groups' },
    StudyPopulation: { type: 'markup', description: 'Study population description' },
    SamplingMethod: { type: 'enum', values: SamplingMethodValues, description: 'Sampling method' },
  },

  // Contacts/Locations Module
  contactsLocations: {
    CentralContactName: { type: 'text', description: 'Central contact name' },
    CentralContactPhone: { type: 'text', description: 'Central contact phone' },
    CentralContactEMail: { type: 'text', description: 'Central contact email' },
    OverallOfficialName: { type: 'text', description: 'Overall official name' },
    OverallOfficialAffiliation: { type: 'text', description: 'Overall official affiliation' },
    OverallOfficialRole: { type: 'enum', values: OfficialRoleValues, description: 'Official role' },
    LocationFacility: { type: 'text', description: 'Facility name' },
    LocationCity: { type: 'GeoName', description: 'City' },
    LocationState: { type: 'GeoName', description: 'State/Province' },
    LocationZip: { type: 'text', description: 'ZIP/Postal code' },
    LocationCountry: { type: 'text', description: 'Country' },
    LocationStatus: { type: 'enum', values: RecruitmentStatusValues, description: 'Site status' },
    LocationContactName: { type: 'text', description: 'Site contact name' },
    LocationGeoPoint: { type: 'GeoPoint', description: 'Geographic coordinates' },
  },

  // References Module
  references: {
    ReferencePMID: { type: 'text', description: 'PubMed ID' },
    ReferenceType: { type: 'enum', values: ReferenceTypeValues, description: 'Reference type' },
    ReferenceCitation: { type: 'text', description: 'Citation text' },
    SeeAlsoLinkLabel: { type: 'markup', description: 'Link description' },
    SeeAlsoLinkURL: { type: 'text', description: 'Link URL' },
  },

  // IPD Sharing Module
  ipdSharing: {
    IPDSharing: { type: 'enum', values: IPDSharingValues, description: 'Plan to share IPD' },
    IPDSharingDescription: { type: 'markup', description: 'IPD sharing description' },
    IPDSharingInfoType: { type: 'enum', values: IPDSharingInfoTypeValues, description: 'IPD info types' },
    IPDSharingTimeFrame: { type: 'markup', description: 'IPD sharing time frame' },
    IPDSharingAccessCriteria: { type: 'markup', description: 'IPD access criteria' },
    IPDSharingURL: { type: 'text', description: 'IPD sharing URL' },
  },

  // Derived Fields
  derived: {
    HasResults: { type: 'boolean', description: 'Has posted results' },
  },
};

// Flatten all searchable fields for easy lookup
const AllSearchableFieldNames = Object.values(SearchableFields)
  .flatMap(module => Object.keys(module));

// ============================================
// SECTION 4: ESSIE EXPRESSION SYNTAX REFERENCE
// ============================================

/**
 * Essie Expression Syntax for constructing complex queries.
 * Used in query.* and filter.advanced parameters.
 */

const EssieSyntax = {
  // Boolean Operators
  booleanOperators: {
    OR: {
      description: 'Returns studies containing either subexpression or both',
      example: 'diabetes OR obesity',
      note: 'Higher score when both present',
    },
    AND: {
      description: 'Returns studies containing both subexpressions',
      example: 'heart AND attack',
    },
    NOT: {
      description: 'Excludes studies containing the right subexpression',
      example: 'cancer NOT pediatric',
      note: 'Unary operator - acts on right side only',
    },
  },

  // Grouping Operators
  groupingOperators: {
    quotes: {
      syntax: '"phrase"',
      description: 'Forces words to be treated as an exact phrase',
      example: '"back pain"',
    },
    parentheses: {
      syntax: '(expression)',
      description: 'Increases operator precedence',
      example: '(acetaminophen OR aspirin) AND NOT (heart failure OR heart attack)',
    },
  },

  // Context Operators
  contextOperators: {
    COVERAGE: {
      syntax: 'COVERAGE[option]term',
      options: {
        FullMatch: 'Term must match entire field text',
        StartsWith: 'Term must match beginning of field',
        EndsWith: 'Term must match end of field',
        Contains: 'Term must match part of field (DEFAULT)',
      },
      example: 'COVERAGE[FullMatch]pain',
    },
    EXPANSION: {
      syntax: 'EXPANSION[option]term',
      options: {
        None: 'Exact match - case/accent sensitive',
        Term: 'Includes variants (plurals, spellings) - case insensitive',
        Concept: 'Includes UMLS synonyms (slight scoring penalty)',
        Relaxation: 'Partial term matches allowed (significant penalty)',
        Lossy: 'Missing partial terms allowed',
      },
      default: 'Relaxation',
      example: 'EXPANSION[Concept]SLE',
      note: 'Quoted phrases with Relaxation/Lossy treated as Concept',
    },
    AREA: {
      syntax: 'AREA[FieldName]term',
      description: 'Searches specific field only',
      example: 'AREA[Phase]PHASE3',
      validFields: AllSearchableFieldNames,
    },
    SEARCH: {
      syntax: 'SEARCH[Document](expression)',
      description: 'Searches within nested document structure',
      documents: ['Study', 'Location'],
      example: 'SEARCH[Location](AREA[LocationCity]Boston AND AREA[LocationState]Massachusetts)',
      note: 'Useful for finding values that must appear together in same location',
    },
  },

  // Source Operators
  sourceOperators: {
    MISSING: {
      syntax: 'AREA[FieldName]MISSING',
      description: 'Finds studies with no value in the specified field',
      example: 'AREA[ResultsFirstPostDate]MISSING',
    },
    RANGE: {
      syntax: 'AREA[FieldName]RANGE[min, max]',
      description: 'Finds studies within a value range',
      specialValues: {
        MIN: 'Smallest possible value',
        MAX: 'Largest possible value',
      },
      examples: [
        'AREA[StartDate]RANGE[2023-01-01, 2024-12-31]',
        'AREA[StartDate]RANGE[2023, MAX]',
        'AREA[MinimumAge]RANGE[18 years, 65 years]',
        'AREA[EnrollmentCount]RANGE[100, MAX]',
      ],
      note: 'Does not return studies with MISSING values',
    },
    DISTANCE: {
      syntax: 'AREA[GeoPoint]DISTANCE[lat, lon, radius]',
      description: 'Finds studies within radius of coordinates',
      example: 'AREA[LocationGeoPoint]DISTANCE[39.0019296, -77.1044561, 25mi]',
      units: ['mi', 'km'],
      maxRadius: '500mi or 805km',
    },
    ALL: {
      syntax: 'ALL',
      description: 'Retrieves all studies in database',
      example: 'ALL',
    },
  },

  // Scoring Operators
  scoringOperators: {
    TILT: {
      syntax: 'TILT[FieldName]expression',
      description: 'Biases ranking toward higher field values (e.g., more recent dates)',
      example: 'TILT[StudyFirstPostDate]"heart attack"',
      note: 'Use with ordered fields like dates',
    },
  },

  // Operator Precedence (highest to lowest)
  precedence: [
    'Search terms and source operators',
    'NOT and context operators',
    'AND operator',
    'OR operator',
  ],
};

// ============================================
// SECTION 5: API QUERY PARAMETERS REFERENCE
// ============================================

/**
 * Complete reference for all ClinicalTrials.gov API query parameters
 */

const APIQueryParameters = {
  // Search Area Query Parameters
  searchQueries: {
    'query.term': {
      searchArea: 'BasicSearch',
      description: 'Other terms - searches 57 fields',
      example: 'AREA[LastUpdatePostDate]RANGE[2023-01-15,MAX]',
    },
    'query.cond': {
      searchArea: 'ConditionSearch',
      description: 'Conditions or disease - 7 fields',
      example: 'lung cancer',
    },
    'query.intr': {
      searchArea: 'InterventionSearch',
      description: 'Intervention / treatment - 12 fields',
      example: 'aspirin',
    },
    'query.locn': {
      searchArea: 'LocationSearch',
      description: 'Location terms - 5 geographic fields',
      example: 'SEARCH[Location](AREA[LocationCity]Portland AND AREA[LocationState]Maine)',
    },
    'query.titles': {
      searchArea: 'TitleSearch',
      description: 'Title / acronym - 3 fields',
      example: 'RECOVERY',
    },
    'query.outc': {
      searchArea: 'OutcomeSearch',
      description: 'Outcome measure - 9 fields',
      example: 'overall survival',
    },
    'query.spons': {
      searchArea: 'SponsorSearch',
      description: 'Sponsor / collaborator - 3 fields',
      example: 'Pfizer',
    },
    'query.lead': {
      searchArea: 'LeadSponsorName',
      description: 'Lead sponsor name only',
      example: 'National Cancer Institute',
    },
    'query.id': {
      searchArea: 'IdSearch',
      description: 'Study IDs - 5 identifier fields',
      example: 'NCT04852770',
    },
    'query.patient': {
      searchArea: 'PatientSearch',
      description: 'Patient-focused search - 47 fields',
      example: 'breast cancer treatment options',
    },
  },

  // Filter Parameters
  filters: {
    'filter.overallStatus': {
      type: 'array',
      values: OverallStatusValues,
      description: 'Filter by study status',
      example: 'RECRUITING,ACTIVE_NOT_RECRUITING',
    },
    'filter.geo': {
      type: 'string',
      format: 'distance(latitude,longitude,radius)',
      description: 'Geographic proximity filter',
      example: 'distance(39.0035707,-77.1013313,50mi)',
    },
    'filter.ids': {
      type: 'array',
      description: 'Filter by NCT IDs',
      example: 'NCT04852770,NCT01728545,NCT02109302',
    },
    'filter.advanced': {
      type: 'string',
      description: 'Advanced Essie expression filter',
      examples: [
        'AREA[Phase]PHASE3',
        'AREA[StudyType]INTERVENTIONAL',
        'AREA[LeadSponsorClass]INDUSTRY',
        'AREA[MinimumAge]RANGE[18 years, MAX]',
        'AREA[StartDate]RANGE[2023-01-01, MAX]',
        'AREA[HasResults]true',
      ],
    },
    'filter.synonyms': {
      type: 'array',
      format: 'area:synonym_id',
      description: 'Filter by synonym pairs',
      example: 'ConditionSearch:1651367,BasicSearch:2013558',
    },
  },

  // Post Filters (same effect as filters, for search request simplicity)
  postFilters: {
    'postFilter.overallStatus': { sameAs: 'filter.overallStatus' },
    'postFilter.geo': { sameAs: 'filter.geo' },
    'postFilter.ids': { sameAs: 'filter.ids' },
    'postFilter.advanced': { sameAs: 'filter.advanced' },
    'postFilter.synonyms': { sameAs: 'filter.synonyms' },
  },

  // Aggregation Filters
  aggFilters: {
    description: 'Apply aggregation filters',
    format: 'filter_id:option_keys',
    examples: [
      'results:with',
      'status:com',
      'status:not rec',
      'sex:f',
      'healthy:y',
    ],
  },

  // Geo Decay (proximity scoring)
  geoDecay: {
    format: 'func:TYPE,scale:DISTANCE,offset:DISTANCE,decay:FACTOR',
    functions: ['gauss', 'exp', 'linear'],
    default: 'func:exp,scale:300mi,offset:0mi,decay:0.5',
    example: 'func:linear,scale:100km,offset:10km,decay:0.1',
  },

  // Field Selection
  fields: {
    description: 'Comma-separated list of fields to return',
    specialValues: {
      '@query': 'All fields used in query',
    },
    examples: [
      'NCTId,BriefTitle,OverallStatus,HasResults',
      'ProtocolSection',
      '@query',
    ],
  },

  // Sorting
  sort: {
    maxItems: 2,
    format: 'field or field:direction',
    directions: ['asc', 'desc'],
    specialFields: {
      '@relevance': 'Sort by search relevance',
    },
    validFields: [
      '@relevance',
      'LastUpdatePostDate',
      'StudyFirstPostDate',
      'ResultsFirstPostDate',
      'EnrollmentCount',
      'StartDate',
      'PrimaryCompletionDate',
      'CompletionDate',
      'NumArmGroups',
    ],
    defaultDirections: {
      dates: 'desc',
      numbers: 'asc',
      '@relevance': 'desc',
    },
    examples: [
      '@relevance',
      'LastUpdatePostDate',
      'EnrollmentCount:desc',
      'LastUpdatePostDate:desc,EnrollmentCount:asc',
    ],
  },

  // Pagination
  pagination: {
    pageSize: {
      min: 1,
      max: 1000,
      default: 10,
    },
    pageToken: {
      description: 'Token from previous response nextPageToken',
    },
    countTotal: {
      type: 'boolean',
      default: false,
      description: 'Include totalCount in first page response',
    },
  },

  // Format
  format: {
    values: ['json', 'csv'],
    default: 'json',
  },

  // Markup Format
  markupFormat: {
    values: ['markdown', 'legacy'],
    default: 'markdown',
  },
};

// ============================================
// SECTION 6: COMMON QUERY PATTERNS
// ============================================

/**
 * Common query patterns for reference and examples
 */

const CommonQueryPatterns = {
  // Find recruiting studies for a condition
  recruitingCondition: {
    description: 'Find recruiting studies for a specific condition',
    params: {
      'query.cond': 'diabetes',
      'filter.overallStatus': 'RECRUITING',
    },
  },

  // Find Phase 3 trials
  phase3Trials: {
    description: 'Find Phase 3 clinical trials',
    params: {
      'query.term': 'cancer',
      'filter.advanced': 'AREA[Phase]PHASE3',
    },
  },

  // Find trials by sponsor
  bySponsor: {
    description: 'Find trials by specific sponsor',
    params: {
      'query.spons': 'Pfizer',
    },
  },

  // Find trials near location
  nearLocation: {
    description: 'Find trials within 50 miles of coordinates',
    params: {
      'query.cond': 'heart failure',
      'filter.geo': 'distance(40.7128,-74.0060,50mi)',
    },
  },

  // Find trials with results
  withResults: {
    description: 'Find completed trials with posted results',
    params: {
      'query.cond': 'alzheimer',
      'filter.overallStatus': 'COMPLETED',
      'filter.advanced': 'AREA[ResultsFirstPostDate]RANGE[MIN,MAX]',
    },
  },

  // Find trials by intervention type
  byInterventionType: {
    description: 'Find drug trials',
    params: {
      'query.cond': 'asthma',
      'filter.advanced': 'AREA[InterventionType]DRUG',
    },
  },

  // Find trials for specific age group
  ageRestricted: {
    description: 'Find trials for adults 18-65',
    params: {
      'query.cond': 'hypertension',
      'filter.advanced': 'AREA[MinimumAge]RANGE[MIN, 18 years] AND AREA[MaximumAge]RANGE[65 years, MAX]',
    },
  },

  // Find NIH-funded trials
  nihFunded: {
    description: 'Find NIH-funded clinical trials',
    params: {
      'query.cond': 'cancer',
      'filter.advanced': 'AREA[LeadSponsorClass]NIH',
    },
  },

  // Find industry-sponsored trials
  industrySponsored: {
    description: 'Find industry-sponsored trials',
    params: {
      'query.intr': 'immunotherapy',
      'filter.advanced': 'AREA[LeadSponsorClass]INDUSTRY',
    },
  },

  // Find recent trials
  recentTrials: {
    description: 'Find trials started in the last year',
    params: {
      'query.cond': 'covid-19',
      'filter.advanced': 'AREA[StartDate]RANGE[2024-01-01, MAX]',
    },
  },

  // Complex multi-filter query
  complexQuery: {
    description: 'Phase 3 recruiting drug trials for diabetes in the US',
    params: {
      'query.cond': 'type 2 diabetes',
      'query.locn': 'United States',
      'filter.overallStatus': 'RECRUITING',
      'filter.advanced': 'AREA[Phase]PHASE3 AND AREA[InterventionType]DRUG',
    },
  },

  // Find trials accepting healthy volunteers
  healthyVolunteers: {
    description: 'Find trials accepting healthy volunteers',
    params: {
      'query.term': 'vaccine',
      'filter.advanced': 'AREA[HealthyVolunteers]true',
    },
  },

  // Location-specific search with SEARCH operator
  specificLocation: {
    description: 'Find trials at a specific city and state',
    params: {
      'query.cond': 'breast cancer',
      'query.locn': 'SEARCH[Location](AREA[LocationCity]Boston AND AREA[LocationState]Massachusetts)',
    },
  },
};

// ============================================
// SECTION 7: VALIDATION HELPERS
// ============================================

/**
 * Helper functions for validating query parameters
 */

function isValidOverallStatus(status) {
  return OverallStatusValues.includes(status);
}

function isValidPhase(phase) {
  return PhaseValues.includes(phase);
}

function isValidStudyType(type) {
  return StudyTypeValues.includes(type);
}

function isValidAgencyClass(cls) {
  return AgencyClassValues.includes(cls);
}

function isValidInterventionType(type) {
  return InterventionTypeValues.includes(type);
}

function isValidSearchableField(fieldName) {
  return AllSearchableFieldNames.includes(fieldName);
}

function validateAgeFormat(age) {
  // Valid formats: "18 Years", "6 Months", "1 Year", etc.
  const agePattern = /^\d+\s+(Years?|Months?|Weeks?|Days?|Hours?|Minutes?)$/i;
  return agePattern.test(age);
}

function validateDateFormat(date) {
  // Valid formats: YYYY-MM-DD, YYYY-MM, YYYY
  const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  return datePattern.test(date) || date === 'MIN' || date === 'MAX';
}

function validateGeoFilter(geo) {
  // Valid format: distance(lat,lon,radius)
  const geoPattern = /^distance\(-?\d+(\.\d+)?,-?\d+(\.\d+)?,\d+(\.\d+)?(km|mi)?\)$/;
  return geoPattern.test(geo);
}

function validateNCTId(nctId) {
  // Valid format: NCT followed by 8 digits
  const nctPattern = /^NCT\d{8}$/i;
  return nctPattern.test(nctId);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Enums
  OverallStatus,
  OverallStatusValues,
  StudyType,
  StudyTypeValues,
  Phase,
  PhaseValues,
  Sex,
  SexValues,
  StandardAge,
  StandardAgeValues,
  AgencyClass,
  AgencyClassValues,
  DesignAllocation,
  DesignAllocationValues,
  InterventionModel,
  InterventionModelValues,
  PrimaryPurpose,
  PrimaryPurposeValues,
  ObservationalModel,
  ObservationalModelValues,
  TimePerspective,
  TimePerspectiveValues,
  DesignMasking,
  DesignMaskingValues,
  WhoMasked,
  WhoMaskedValues,
  InterventionType,
  InterventionTypeValues,
  ArmGroupType,
  ArmGroupTypeValues,
  ResponsiblePartyType,
  ResponsiblePartyTypeValues,
  RecruitmentStatus,
  RecruitmentStatusValues,
  ExpandedAccessStatus,
  ExpandedAccessStatusValues,
  EnrollmentType,
  EnrollmentTypeValues,
  DateType,
  DateTypeValues,
  SamplingMethod,
  SamplingMethodValues,
  BioSpecRetention,
  BioSpecRetentionValues,
  IPDSharing,
  IPDSharingValues,
  IPDSharingInfoType,
  IPDSharingInfoTypeValues,
  OrgStudyIdType,
  OrgStudyIdTypeValues,
  SecondaryIdType,
  SecondaryIdTypeValues,
  OfficialRole,
  OfficialRoleValues,
  ContactRole,
  ContactRoleValues,
  ReferenceType,
  ReferenceTypeValues,
  OutcomeMeasureType,
  OutcomeMeasureTypeValues,

  // Search Areas
  SearchAreas,

  // Searchable Fields
  SearchableFields,
  AllSearchableFieldNames,

  // Essie Syntax
  EssieSyntax,

  // API Parameters
  APIQueryParameters,

  // Common Patterns
  CommonQueryPatterns,

  // Validation Helpers
  isValidOverallStatus,
  isValidPhase,
  isValidStudyType,
  isValidAgencyClass,
  isValidInterventionType,
  isValidSearchableField,
  validateAgeFormat,
  validateDateFormat,
  validateGeoFilter,
  validateNCTId,
};
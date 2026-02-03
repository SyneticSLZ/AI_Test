/**
 * CMS Medicare API Service
 * Handles all data fetching from CMS Medicare datasets
 */

const CMSSchema = require('./cmsSchema');

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getCacheKey(params) {
  return JSON.stringify(params);
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Build URL with filters for CMS API
 */
function buildFilterUrl(baseUrl, filters, options = {}) {
  const url = new URL(baseUrl);
  let filterIndex = 0;
  
  function addFilter(path, operator, value) {
    if (value === null || value === undefined || value === '') return;
    
    const prefix = `filter[${filterIndex}]`;
    url.searchParams.set(`${prefix}[path]`, path);
    url.searchParams.set(`${prefix}[operator]`, operator);
    
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        url.searchParams.set(`${prefix}[value][${i}]`, String(v));
      });
    } else {
      url.searchParams.set(`${prefix}[value]`, String(value));
    }
    filterIndex++;
  }
  
  for (const f of filters) {
    addFilter(f.path, f.operator, f.value);
  }
  
  if (options.sortBy) {
    const sortPrefix = options.sortDescending ? '-' : '';
    url.searchParams.set('sort', `${sortPrefix}${options.sortBy}`);
  }
  
  if (options.columns && options.columns.length > 0) {
    url.searchParams.set('column', options.columns.join(','));
  }
  
  url.searchParams.set('size', String(options.pageSize || 100));
  url.searchParams.set('offset', String(options.offset || 0));
  
  return url;
}

/**
 * Fetch data from CMS API with pagination support
 */
async function fetchCMSData(baseUrl, filters, options = {}) {
  const allResults = [];
  let currentOffset = options.offset || 0;
  let hasMore = true;
  let pageCount = 0;
  const maxResults = options.maxTotalResults || 5000;
  const pageSize = options.pageSize || 100;
  
  while (hasMore && allResults.length < maxResults) {
    const url = buildFilterUrl(baseUrl, filters, { ...options, offset: currentOffset });
    const urlString = url.toString();
    
    console.log(`[CMS API] Fetching page ${pageCount + 1}: ${urlString.slice(0, 150)}...`);
    
    const cacheKey = getCacheKey({ url: urlString });
    let data = getFromCache(cacheKey);
    
    if (!data) {
      try {
        const response = await fetch(urlString, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`CMS API error: ${response.status} - ${errorText.slice(0, 300)}`);
        }
        
        data = await response.json();
        setCache(cacheKey, data);
      } catch (error) {
        console.error('[CMS API] Fetch error:', error.message);
        throw error;
      }
    }
    
    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
      break;
    }
    
    allResults.push(...data);
    pageCount++;
    
    if (!options.fetchAllPages || data.length < pageSize) {
      hasMore = false;
    } else {
      currentOffset += data.length;
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    }
    
    if (pageCount >= 50) {
      console.log('[CMS API] Reached 50 page safety limit');
      hasMore = false;
    }
  }
  
  return { results: allResults, pageCount, hasMore };
}

/**
 * Search providers with aggregated data (demographics, chronic conditions)
 */
async function searchProviders(params = {}) {
  const baseUrl = CMSSchema.getBaseUrl('BY_PROVIDER', params.year || '2023');
  const filters = [];
  
  // Provider filters
  if (params.npi) filters.push({ path: 'Rndrng_NPI', operator: '=', value: params.npi });
  if (params.providerName) filters.push({ path: 'Rndrng_Prvdr_Last_Org_Name', operator: 'CONTAINS', value: params.providerName.toUpperCase() });
  if (params.providerFirstName) filters.push({ path: 'Rndrng_Prvdr_First_Name', operator: 'CONTAINS', value: params.providerFirstName.toUpperCase() });
  if (params.credentials) filters.push({ path: 'Rndrng_Prvdr_Crdntls', operator: '=', value: params.credentials });
  if (params.entityType) filters.push({ path: 'Rndrng_Prvdr_Ent_Cd', operator: '=', value: params.entityType });
  
  // Location filters
  if (params.state) filters.push({ path: 'Rndrng_Prvdr_State_Abrvtn', operator: '=', value: params.state.toUpperCase() });
  if (params.states?.length) filters.push({ path: 'Rndrng_Prvdr_State_Abrvtn', operator: 'IN', value: params.states.map(s => s.toUpperCase()) });
  if (params.city) filters.push({ path: 'Rndrng_Prvdr_City', operator: 'CONTAINS', value: params.city.toUpperCase() });
  if (params.zipCode) filters.push({ path: 'Rndrng_Prvdr_Zip5', operator: '=', value: params.zipCode });
  
  // Specialty filters
  if (params.providerType) filters.push({ path: 'Rndrng_Prvdr_Type', operator: 'CONTAINS', value: params.providerType });
  if (params.providerTypes?.length) filters.push({ path: 'Rndrng_Prvdr_Type', operator: 'IN', value: params.providerTypes });
  
  // Utilization filters
  if (params.minBeneficiaries) filters.push({ path: 'Tot_Benes', operator: '>=', value: params.minBeneficiaries });
  if (params.minServices) filters.push({ path: 'Tot_Srvcs', operator: '>=', value: params.minServices });
  if (params.minTotalPayment) filters.push({ path: 'Tot_Mdcr_Pymt_Amt', operator: '>=', value: params.minTotalPayment });
  
  // Demographics filters
  if (params.minAvgAge) filters.push({ path: 'Bene_Avg_Age', operator: '>=', value: params.minAvgAge });
  if (params.maxAvgAge) filters.push({ path: 'Bene_Avg_Age', operator: '<=', value: params.maxAvgAge });
  
  // Risk score filters
  if (params.minRiskScore) filters.push({ path: 'Bene_Avg_Risk_Scre', operator: '>=', value: params.minRiskScore });
  if (params.maxRiskScore) filters.push({ path: 'Bene_Avg_Risk_Scre', operator: '<=', value: params.maxRiskScore });
  
  // Chronic condition filters
  if (params.minDiabetesPct) filters.push({ path: 'Bene_CC_PH_Diabetes_V2_Pct', operator: '>=', value: params.minDiabetesPct });
  if (params.minHeartDiseasePct) filters.push({ path: 'Bene_CC_PH_IschemicHeart_V2_Pct', operator: '>=', value: params.minHeartDiseasePct });
  if (params.minCKDPct) filters.push({ path: 'Bene_CC_PH_CKD_V2_Pct', operator: '>=', value: params.minCKDPct });
  if (params.maxCKDPct) filters.push({ path: 'Bene_CC_PH_CKD_V2_Pct', operator: '<=', value: params.maxCKDPct });
  if (params.maxDiabetesPct) filters.push({ path: 'Bene_CC_PH_Diabetes_V2_Pct', operator: '<=', value: params.maxDiabetesPct });
  if (params.minDepressionPct) filters.push({ path: 'Bene_CC_BH_Depress_V1_Pct', operator: '>=', value: params.minDepressionPct });
  if (params.minDementiaPct) filters.push({ path: 'Bene_CC_BH_Alz_NonAlzdem_V2_Pct', operator: '>=', value: params.minDementiaPct });
  
  const { results, pageCount, hasMore } = await fetchCMSData(baseUrl, filters, {
    sortBy: params.sortBy || 'Tot_Benes',
    sortDescending: params.sortDescending !== false,
    pageSize: params.pageSize || 100,
    offset: params.offset || 0,
    fetchAllPages: params.fetchAllPages || false,
    maxTotalResults: params.maxTotalResults || 500,
  });
  
  return {
    providers: results.map(transformProviderRecord),
    totalReturned: results.length,
    pageCount,
    hasMore,
    dataYear: params.year || '2023',
  };
}

/**
 * Search provider services (procedures/HCPCS codes)
 */
/**
 * Search provider services (procedures/HCPCS codes)
 */
async function searchProviderServices(params = {}) {
  const baseUrl = CMSSchema.getBaseUrl('BY_PROVIDER_AND_SERVICE', params.year || '2023');
  const filters = [];
  
  // Provider filters
  if (params.npi) filters.push({ path: 'Rndrng_NPI', operator: '=', value: params.npi });
  if (params.providerName) filters.push({ path: 'Rndrng_Prvdr_Last_Org_Name', operator: 'CONTAINS', value: params.providerName.toUpperCase() });
  if (params.providerFirstName) filters.push({ path: 'Rndrng_Prvdr_First_Name', operator: 'CONTAINS', value: params.providerFirstName.toUpperCase() });
  if (params.entityType) filters.push({ path: 'Rndrng_Prvdr_Ent_Cd', operator: '=', value: params.entityType });
  
  // Location filters
  if (params.state) filters.push({ path: 'Rndrng_Prvdr_State_Abrvtn', operator: '=', value: params.state.toUpperCase() });
  if (params.states?.length) filters.push({ path: 'Rndrng_Prvdr_State_Abrvtn', operator: 'IN', value: params.states.map(s => s.toUpperCase()) });
  if (params.city) filters.push({ path: 'Rndrng_Prvdr_City', operator: 'CONTAINS', value: params.city.toUpperCase() });
  
  // Specialty filters
  if (params.providerType) filters.push({ path: 'Rndrng_Prvdr_Type', operator: 'CONTAINS', value: params.providerType });
  if (params.providerTypes?.length) filters.push({ path: 'Rndrng_Prvdr_Type', operator: 'IN', value: params.providerTypes });
  
  // HCPCS/Service filters
  if (params.hcpcsCode) filters.push({ path: 'HCPCS_Cd', operator: '=', value: params.hcpcsCode.toUpperCase() });
  if (params.hcpcsCodes?.length) filters.push({ path: 'HCPCS_Cd', operator: 'IN', value: params.hcpcsCodes.map(c => c.toUpperCase()) });
  if (params.hcpcsDescription) filters.push({ path: 'HCPCS_Desc', operator: 'CONTAINS', value: params.hcpcsDescription.toLowerCase() });
  if (params.isDrug !== undefined) filters.push({ path: 'HCPCS_Drug_Ind', operator: '=', value: params.isDrug ? 'Y' : 'N' });
  if (params.placeOfService) filters.push({ path: 'Place_Of_Srvc', operator: '=', value: params.placeOfService });
  
  // Utilization filters
  if (params.minBeneficiaries) filters.push({ path: 'Tot_Benes', operator: '>=', value: params.minBeneficiaries });
  if (params.minServices) filters.push({ path: 'Tot_Srvcs', operator: '>=', value: params.minServices });
  
  // Explicitly request all columns we need
  const columns = [
    'Rndrng_NPI',
    'Rndrng_Prvdr_Last_Org_Name',
    'Rndrng_Prvdr_First_Name',
    'Rndrng_Prvdr_MI',
    'Rndrng_Prvdr_Crdntls',
    'Rndrng_Prvdr_Type',
    'Rndrng_Prvdr_City',
    'Rndrng_Prvdr_State_Abrvtn',
    'Rndrng_Prvdr_Zip5',
    'HCPCS_Cd',
    'HCPCS_Desc',
    'HCPCS_Drug_Ind',
    'Place_Of_Srvc',
    'Tot_Benes',
    'Tot_Srvcs',
    'Avg_Sbmtd_Chrg',
    'Avg_Mdcr_Alowd_Amt',
    'Avg_Mdcr_Pymt_Amt'
  ];
  
  const { results, pageCount, hasMore } = await fetchCMSData(baseUrl, filters, {
    columns,
    sortBy: params.sortBy || 'Tot_Benes',
    sortDescending: params.sortDescending !== false,
    pageSize: params.pageSize || 100,
    offset: params.offset || 0,
    fetchAllPages: params.fetchAllPages || false,
    maxTotalResults: params.maxTotalResults || 500,
  });
  
  return {
    services: results.map(transformServiceRecord),
    totalReturned: results.length,
    pageCount,
    hasMore,
    dataYear: params.year || '2023',
  };
}

/**
 * Search by geography and service
 */
async function searchGeography(params = {}) {
  const baseUrl = CMSSchema.getBaseUrl('BY_GEOGRAPHY_AND_SERVICE', params.year || '2023');
  const filters = [];
  
  if (params.geographyLevel) filters.push({ path: 'Rndrng_Prvdr_Geo_Lvl', operator: '=', value: params.geographyLevel });
  if (params.state) filters.push({ path: 'Rndrng_Prvdr_Geo_Desc', operator: '=', value: params.state.toUpperCase() });
  if (params.states?.length) filters.push({ path: 'Rndrng_Prvdr_Geo_Desc', operator: 'IN', value: params.states.map(s => s.toUpperCase()) });
  
  if (params.hcpcsCode) filters.push({ path: 'HCPCS_Cd', operator: '=', value: params.hcpcsCode.toUpperCase() });
  if (params.hcpcsCodes?.length) filters.push({ path: 'HCPCS_Cd', operator: 'IN', value: params.hcpcsCodes.map(c => c.toUpperCase()) });
  
  if (params.minProviders) filters.push({ path: 'Tot_Rndrng_Prvdrs', operator: '>=', value: params.minProviders });
  if (params.minBeneficiaries) filters.push({ path: 'Tot_Benes', operator: '>=', value: params.minBeneficiaries });
  
  const { results, pageCount, hasMore } = await fetchCMSData(baseUrl, filters, {
    sortBy: params.sortBy || 'Tot_Benes',
    sortDescending: params.sortDescending !== false,
    pageSize: params.pageSize || 100,
    offset: params.offset || 0,
    fetchAllPages: params.fetchAllPages || false,
    maxTotalResults: params.maxTotalResults || 500,
  });
  
  return {
    geography: results.map(transformGeographyRecord),
    totalReturned: results.length,
    pageCount,
    hasMore,
    dataYear: params.year || '2023',
  };
}

/**
 * Search physicians by indication
 * Combines provider data with service data for indication-specific codes
 */
async function searchPhysiciansByIndication(indicationId, params = {}) {
  const indication = CMSSchema.getIndicationById(indicationId);
  if (!indication) {
    throw new Error(`Indication not found: ${indicationId}`);
  }
  
  // Build combined search parameters
  const searchParams = {
    ...params,
    providerTypes: indication.specialties,
    year: params.year || '2023',
  };
  
  // Apply comorbidity filters from indication
  if (indication.comorbidityFilters) {
    if (indication.comorbidityFilters.ckd) {
      searchParams.minCKDPct = indication.comorbidityFilters.ckd;
    }
    if (indication.comorbidityFilters.diabetes) {
      searchParams.minDiabetesPct = indication.comorbidityFilters.diabetes;
    }
  }
  
  // Search providers
  const providerResults = await searchProviders(searchParams);
  
  // Get NPIs from provider results
  const npis = providerResults.providers.map(p => p.npi);
  
  // If we have HCPCS codes for the indication, search for service volume
  let serviceVolumes = new Map();
  if (indication.cpt?.length || indication.hcpcs?.length) {
    const allCodes = [...(indication.cpt || []), ...(indication.hcpcs || [])];
    
    // Search for services (limited to first 10 NPIs due to API limits)
    for (const npi of npis.slice(0, 10)) {
      try {
        const serviceResults = await searchProviderServices({
          npi,
          hcpcsCodes: allCodes,
          year: params.year || '2023',
          maxTotalResults: 100,
        });
        
        const totalIndicationServices = serviceResults.services.reduce((sum, s) => sum + (s.services || 0), 0);
        const totalIndicationBeneficiaries = serviceResults.services.reduce((sum, s) => sum + (s.beneficiaries || 0), 0);
        
        serviceVolumes.set(npi, {
          indicationServices: totalIndicationServices,
          indicationBeneficiaries: totalIndicationBeneficiaries,
          codes: serviceResults.services.map(s => s.hcpcsCode),
        });
      } catch (err) {
        console.warn(`[CMS API] Could not fetch services for NPI ${npi}:`, err.message);
      }
    }
  }
  
  // Merge service volumes into provider data
  const enrichedProviders = providerResults.providers.map(provider => {
    const serviceData = serviceVolumes.get(provider.npi) || {};
    return {
      ...provider,
      indication: {
        id: indication.id,
        name: indication.name,
        shortName: indication.shortName,
      },
      indicationServices: serviceData.indicationServices || 0,
      indicationBeneficiaries: serviceData.indicationBeneficiaries || 0,
      relevantCodes: serviceData.codes || [],
    };
  });
  
  // Sort by indication relevance (services + beneficiaries)
  enrichedProviders.sort((a, b) => {
    const scoreA = (a.indicationServices * 10) + a.indicationBeneficiaries + (a.totals.beneficiaries / 10);
    const scoreB = (b.indicationServices * 10) + b.indicationBeneficiaries + (b.totals.beneficiaries / 10);
    return scoreB - scoreA;
  });
  
  return {
    indication,
    physicians: enrichedProviders,
    totalReturned: enrichedProviders.length,
    dataYear: params.year || '2023',
    dataSource: 'CMS Medicare Physician & Other Practitioners PUF',
    limitations: [
      'Medicare Fee-for-Service data only - does not include Medicare Advantage or private insurance',
      'Volume is approximated from procedure/drug codes as proxies for the indication',
      'Counts <11 are suppressed by CMS for privacy protection',
    ],
  };
}

/**
 * Get detailed profile for a single provider
 */
async function getProviderProfile(npi, year = '2023') {
  // Get base provider info
  const providerResults = await searchProviders({
    npi,
    year,
    maxTotalResults: 1,
  });
  
  if (providerResults.providers.length === 0) {
    return null;
  }
  
  const provider = providerResults.providers[0];
  
  // Get all services for this provider
  const serviceResults = await searchProviderServices({
    npi,
    year,
    maxTotalResults: 200,
    fetchAllPages: true,
  });
  
  // Categorize services
  const procedures = serviceResults.services.filter(s => !s.isDrug);
  const drugs = serviceResults.services.filter(s => s.isDrug);
  
  // Top procedures by volume
  const topProcedures = procedures
    .sort((a, b) => b.services - a.services)
    .slice(0, 10);
  
  // Top drugs by volume
  const topDrugs = drugs
    .sort((a, b) => b.services - a.services)
    .slice(0, 10);
  
  return {
    ...provider,
    services: {
      total: serviceResults.services.length,
      procedures: procedures.length,
      drugs: drugs.length,
      topProcedures,
      topDrugs,
    },
    dataYear: year,
    dataSource: 'CMS Medicare Physician & Other Practitioners PUF',
  };
}

function transformProviderRecord(r) {
  // Parse values once for reuse
  const benes = parseFloat(r.Tot_Benes) || 0;
  const srvcs = parseFloat(r.Tot_Srvcs) || 0;
  const cityVal = r.Rndrng_Prvdr_City || null;
  const stateVal = r.Rndrng_Prvdr_State_Abrvtn || null;
  const zipVal = r.Rndrng_Prvdr_Zip5 || null;
  
  return {
    npi: r.Rndrng_NPI,
    name: formatProviderName(r.Rndrng_Prvdr_Last_Org_Name, r.Rndrng_Prvdr_First_Name, r.Rndrng_Prvdr_MI),
    fullName: formatProviderName(r.Rndrng_Prvdr_Last_Org_Name, r.Rndrng_Prvdr_First_Name, r.Rndrng_Prvdr_MI),
    lastName: r.Rndrng_Prvdr_Last_Org_Name,
    firstName: r.Rndrng_Prvdr_First_Name || null,
    middleInitial: r.Rndrng_Prvdr_MI || null,
    credentials: r.Rndrng_Prvdr_Crdntls || null,
    gender: r.Rndrng_Prvdr_Gndr || null,
    entityType: r.Rndrng_Prvdr_Ent_Cd === 'I' ? 'Individual' : 'Organization',
    specialty: r.Rndrng_Prvdr_Type || 'Unknown',
    // FLAT location fields for frontend compatibility
    city: cityVal,
    state: stateVal,
    zip: zipVal,
    // Nested location for backward compatibility
    location: {
      street: r.Rndrng_Prvdr_St1 || null,
      street2: r.Rndrng_Prvdr_St2 || null,
      city: cityVal,
      state: stateVal,
      zip: zipVal,
      country: r.Rndrng_Prvdr_Cntry || 'US',
      rucaType: r.Rndrng_Prvdr_RUCA_Desc || null,
    },
    medicareParticipating: r.Rndrng_Prvdr_Mdcr_Prtcptg_Ind === 'Y',
    // FLAT beneficiaries/services for frontend compatibility
    beneficiaries: benes,
    services: srvcs,
    totalBeneficiaries: benes,
    totalServices: srvcs,
    Tot_Benes: benes,
    Tot_Srvcs: srvcs,
    // Nested totals for backward compatibility
    totals: {
      hcpcsCodes: parseInt(r.Tot_HCPCS_Cds) || 0,
      beneficiaries: benes,
      services: srvcs,
      charges: parseFloat(r.Tot_Sbmtd_Chrg) || 0,
      payment: parseFloat(r.Tot_Mdcr_Pymt_Amt) || 0,
    },
    drugServices: {
      beneficiaries: parseFloat(r.Drug_Tot_Benes) || 0,
      services: parseFloat(r.Drug_Tot_Srvcs) || 0,
      payment: parseFloat(r.Drug_Mdcr_Pymt_Amt) || 0,
    },
    medicalServices: {
      beneficiaries: parseFloat(r.Med_Tot_Benes) || 0,
      services: parseFloat(r.Med_Tot_Srvcs) || 0,
      payment: parseFloat(r.Med_Mdcr_Pymt_Amt) || 0,
    },
    demographics: {
      avgAge: parseFloat(r.Bene_Avg_Age) || 0,
      ageDistribution: {
        under65: parseInt(r.Bene_Age_LT_65_Cnt) || 0,
        age65to74: parseInt(r.Bene_Age_65_74_Cnt) || 0,
        age75to84: parseInt(r.Bene_Age_75_84_Cnt) || 0,
        over84: parseInt(r.Bene_Age_GT_84_Cnt) || 0,
      },
      gender: {
        female: parseInt(r.Bene_Feml_Cnt) || 0,
        male: parseInt(r.Bene_Male_Cnt) || 0,
      },
      dualEligible: parseInt(r.Bene_Dual_Cnt) || 0,
      ndualEligible: parseInt(r.Bene_Ndual_Cnt) || 0,
    },
    riskScore: parseFloat(r.Bene_Avg_Risk_Scre) || 0,
    avgRiskScore: parseFloat(r.Bene_Avg_Risk_Scre) || 0,
    Bene_Avg_Risk_Scre: parseFloat(r.Bene_Avg_Risk_Scre) || 0,
    chronicConditions: {
      diabetes: parseFloat(r.Bene_CC_PH_Diabetes_V2_Pct) || 0,
      hypertension: parseFloat(r.Bene_CC_PH_Hypertension_V2_Pct) || 0,
      heartDisease: parseFloat(r.Bene_CC_PH_IschemicHeart_V2_Pct) || 0,
      heartFailure: parseFloat(r.Bene_CC_PH_HF_NonIHD_V2_Pct) || 0,
      ckd: parseFloat(r.Bene_CC_PH_CKD_V2_Pct) || 0,
      copd: parseFloat(r.Bene_CC_PH_COPD_V2_Pct) || 0,
      cancer: parseFloat(r.Bene_CC_PH_Cancer6_V2_Pct) || 0,
      depression: parseFloat(r.Bene_CC_BH_Depress_V1_Pct) || 0,
      dementia: parseFloat(r.Bene_CC_BH_Alz_NonAlzdem_V2_Pct) || 0,
      anxiety: parseFloat(r.Bene_CC_BH_Anxiety_V1_Pct) || 0,
      stroke: parseFloat(r.Bene_CC_PH_Stroke_V2_Pct) || 0,
      atrialFib: parseFloat(r.Bene_CC_PH_Afib_V2_Pct) || 0,
      osteoporosis: parseFloat(r.Bene_CC_PH_Osteoporosis_V2_Pct) || 0,
      arthritis: parseFloat(r.Bene_CC_PH_Arthritis_V2_Pct) || 0,
    },
  };
}

/**
 * Transform raw CMS service record to clean format
 */
/**
 * Transform raw CMS service record to clean format
 */
/**
 * Transform raw CMS service record to clean format
 */
function transformServiceRecord(r) {
  // Debug: log first record to see actual field names
  if (!transformServiceRecord._logged) {
    console.log('[CMS API] Sample service record fields:', Object.keys(r));
    console.log('[CMS API] Sample record:', JSON.stringify(r, null, 2).slice(0, 500));
    transformServiceRecord._logged = true;
  }
  
  // Parse beneficiaries - try multiple possible field names
  const benes = parseFloat(r.Tot_Benes) || parseFloat(r.tot_benes) || parseFloat(r.Bene_Cnt) || 0;
  const srvcs = parseFloat(r.Tot_Srvcs) || parseFloat(r.tot_srvcs) || parseFloat(r.Srvc_Cnt) || 0;
  
  return {
    npi: r.Rndrng_NPI || r.rndrng_npi,
    // Multiple name formats for frontend compatibility
    name: formatProviderName(r.Rndrng_Prvdr_Last_Org_Name || r.rndrng_prvdr_last_org_name, r.Rndrng_Prvdr_First_Name || r.rndrng_prvdr_first_name, r.Rndrng_Prvdr_MI || r.rndrng_prvdr_mi),
    providerName: formatProviderName(r.Rndrng_Prvdr_Last_Org_Name || r.rndrng_prvdr_last_org_name, r.Rndrng_Prvdr_First_Name || r.rndrng_prvdr_first_name, r.Rndrng_Prvdr_MI || r.rndrng_prvdr_mi),
    fullName: formatProviderName(r.Rndrng_Prvdr_Last_Org_Name || r.rndrng_prvdr_last_org_name, r.Rndrng_Prvdr_First_Name || r.rndrng_prvdr_first_name, r.Rndrng_Prvdr_MI || r.rndrng_prvdr_mi),
    lastName: r.Rndrng_Prvdr_Last_Org_Name || r.rndrng_prvdr_last_org_name || null,
    firstName: r.Rndrng_Prvdr_First_Name || r.rndrng_prvdr_first_name || null,
    credentials: r.Rndrng_Prvdr_Crdntls || r.rndrng_prvdr_crdntls || null,
    specialty: r.Rndrng_Prvdr_Type || r.rndrng_prvdr_type || null,
    // Flat location fields for frontend compatibility
    city: r.Rndrng_Prvdr_City || r.rndrng_prvdr_city || null,
    state: r.Rndrng_Prvdr_State_Abrvtn || r.rndrng_prvdr_state_abrvtn || null,
    zip: r.Rndrng_Prvdr_Zip5 || r.rndrng_prvdr_zip5 || null,
    // Also keep nested location for backward compatibility
    location: {
      city: r.Rndrng_Prvdr_City || r.rndrng_prvdr_city || null,
      state: r.Rndrng_Prvdr_State_Abrvtn || r.rndrng_prvdr_state_abrvtn || null,
      zip: r.Rndrng_Prvdr_Zip5 || r.rndrng_prvdr_zip5 || null,
    },
    hcpcsCode: r.HCPCS_Cd || r.hcpcs_cd,
    hcpcsDescription: r.HCPCS_Desc || r.hcpcs_desc || null,
    isDrug: (r.HCPCS_Drug_Ind || r.hcpcs_drug_ind) === 'Y',
    placeOfService: (r.Place_Of_Srvc || r.place_of_srvc) === 'F' ? 'Facility' : 'Office',
    // Beneficiaries and services - multiple field name options
    beneficiaries: benes,
    services: srvcs,
    // Also add aliases that frontend might look for
    Tot_Benes: benes,
    Tot_Srvcs: srvcs,
    totalBeneficiaries: benes,
    totalServices: srvcs,
    avgCharge: parseFloat(r.Avg_Sbmtd_Chrg || r.avg_sbmtd_chrg) || 0,
    avgAllowed: parseFloat(r.Avg_Mdcr_Alowd_Amt || r.avg_mdcr_alowd_amt) || 0,
    avgPayment: parseFloat(r.Avg_Mdcr_Pymt_Amt || r.avg_mdcr_pymt_amt) || 0,
    // Include raw record for debugging
    _raw: r,
  };
}

/**
 * Transform raw CMS geography record to clean format
 */
function transformGeographyRecord(r) {
  return {
    geographyLevel: r.Rndrng_Prvdr_Geo_Lvl,
    geography: r.Rndrng_Prvdr_Geo_Desc,
    geoCode: r.Rndrng_Prvdr_Geo_Cd,
    hcpcsCode: r.HCPCS_Cd,
    hcpcsDescription: r.HCPCS_Desc || null,
    isDrug: r.HCPCS_Drug_Ind === 'Y',
    placeOfService: r.Place_Of_Srvc === 'F' ? 'Facility' : 'Office',
    providers: parseFloat(r.Tot_Rndrng_Prvdrs) || 0,
    beneficiaries: parseFloat(r.Tot_Benes) || 0,
    services: parseFloat(r.Tot_Srvcs) || 0,
    avgCharge: parseFloat(r.Avg_Sbmtd_Chrg) || 0,
    avgAllowed: parseFloat(r.Avg_Mdcr_Alowd_Amt) || 0,
    avgPayment: parseFloat(r.Avg_Mdcr_Pymt_Amt) || 0,
  };
}

/**
 * Format provider name
 */
function formatProviderName(lastName, firstName, middleInitial) {
  if (!lastName) return 'Unknown';
  if (!firstName) return lastName;
  const mi = middleInitial ? ` ${middleInitial}.` : '';
  return `${lastName}, ${firstName}${mi}`;
}

module.exports = {
  searchProviders,
  searchProviderServices,
  searchGeography,
  searchPhysiciansByIndication,
  getProviderProfile,
  fetchCMSData,
  buildFilterUrl,
};

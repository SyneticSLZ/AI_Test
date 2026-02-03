/**
 * Part D Prescriber Data Service
 * Handles Medicare Part D prescription drug data
 */

const CMSSchema = require('./cmsSchema');

const BASE_URL = 'https://data.cms.gov/data-api/v1/dataset';

/**
 * Get Part D aggregate prescriber data for a provider
 */
async function getPrescriberByNPI(npi, year = '2023') {
  const uuid = CMSSchema.DATASET_UUIDS.PART_D_BY_PROVIDER[year];
  if (!uuid) throw new Error(`No Part D dataset for year ${year}`);
  
  const url = `${BASE_URL}/${uuid}/data?filter[Prscrbr_NPI]=${npi}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Part D API error: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Part D fetch error:', error);
    return null;
  }
}

/**
 * Search prescribers by drug name
 */
async function searchPrescribersByDrug(drugName, options = {}) {
  const {
    year = '2023',
    state = null,
    specialty = null,
    limit = 100,
    minClaims = 11,
  } = options;
  
  // Note: Part D by Provider and Drug dataset has different structure
  // For now, we'll use the aggregate data and filter
  const uuid = CMSSchema.DATASET_UUIDS.PART_D_BY_PROVIDER[year];
  if (!uuid) throw new Error(`No Part D dataset for year ${year}`);
  
  let url = `${BASE_URL}/${uuid}/data?size=${limit}`;
  
  if (state) {
    url += `&filter[Prscrbr_State_Abrvtn]=${state}`;
  }
  if (specialty) {
    url += `&filter[Prscrbr_Type]=${encodeURIComponent(specialty)}`;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Part D API error: ${response.status}`);
    }
    const data = await response.json();
    
    // Transform data
    return data.map(record => ({
      npi: record.Prscrbr_NPI,
      name: `${record.Prscrbr_First_Name || ''} ${record.Prscrbr_Last_Name || ''}`.trim(),
      firstName: record.Prscrbr_First_Name,
      lastName: record.Prscrbr_Last_Name,
      credentials: record.Prscrbr_Crdntls,
      specialty: record.Prscrbr_Type,
      city: record.Prscrbr_City,
      state: record.Prscrbr_State_Abrvtn,
      zip: record.Prscrbr_Zip5,
      totalClaims: parseInt(record.Tot_Clms) || 0,
      totalBeneficiaries: parseInt(record.Tot_Benes) || 0,
      totalDrugCost: parseFloat(record.Tot_Drug_Cst) || 0,
      total30DayFills: parseInt(record.Tot_30day_Fills) || 0,
      totalDaySupply: parseInt(record.Tot_Day_Suply) || 0,
      // Opioid metrics
      opioidClaims: parseInt(record.Opioid_Tot_Clms) || 0,
      opioidBeneficiaries: parseInt(record.Opioid_Tot_Benes) || 0,
      opioidPrescriber: record.Opioid_Prscrbr_Rate > 0,
      // Antibiotic metrics
      antibioticClaims: parseInt(record.Antbtc_Tot_Clms) || 0,
      // Risk scores
      avgRiskScore: parseFloat(record.Bene_Avg_Risk_Scre) || null,
      // Demographics
      avgAge: parseFloat(record.Bene_Avg_Age) || null,
      femalePct: parseFloat(record.Bene_Feml_Cnt) / parseInt(record.Tot_Benes) * 100 || null,
    })).filter(p => p.totalClaims >= minClaims);
    
  } catch (error) {
    console.error('Part D search error:', error);
    throw error;
  }
}

/**
 * Get top prescribers for a specific drug or drug class
 * Note: This requires the Part D by Provider and Drug dataset
 */
async function getTopPrescribersForDrug(drugName, options = {}) {
  const {
    year = '2023',
    state = null,
    limit = 50,
  } = options;
  
  // The Part D by Provider and Drug dataset is very large
  // In production, you'd want to pre-aggregate or use a database
  // For now, return a placeholder that explains the limitation
  
  return {
    drugName,
    note: 'Direct drug-level queries require Part D by Provider and Drug dataset integration',
    suggestedApproach: 'Filter by specialty and cross-reference with indication drug lists',
    relatedDrugs: CMSSchema.IndicationCodeSets.igan?.partDDrugs || [],
  };
}

/**
 * Get Part D summary stats for a list of NPIs
 */
async function getPartDForNPIs(npis, year = '2023') {
  const uuid = CMSSchema.DATASET_UUIDS.PART_D_BY_PROVIDER[year];
  if (!uuid) throw new Error(`No Part D dataset for year ${year}`);
  
  const results = {};
  
  // Batch fetch - CMS API doesn't support IN clause, so we fetch individually
  // In production, you'd want to cache this or use a database
  for (const npi of npis.slice(0, 20)) { // Limit to avoid rate limits
    try {
      const url = `${BASE_URL}/${uuid}/data?filter[Prscrbr_NPI]=${npi}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data[0]) {
          results[npi] = transformPartDRecord(data[0]);
        }
      }
    } catch (error) {
      console.error(`Part D fetch error for NPI ${npi}:`, error);
    }
  }
  
  return results;
}

/**
 * Transform a Part D record into a clean format
 */
function transformPartDRecord(record) {
  return {
    npi: record.Prscrbr_NPI,
    totalClaims: parseInt(record.Tot_Clms) || 0,
    totalBeneficiaries: parseInt(record.Tot_Benes) || 0,
    totalDrugCost: parseFloat(record.Tot_Drug_Cst) || 0,
    total30DayFills: parseInt(record.Tot_30day_Fills) || 0,
    totalDaySupply: parseInt(record.Tot_Day_Suply) || 0,
    // Brand vs generic
    brandClaims: parseInt(record.Brnd_Tot_Clms) || 0,
    genericClaims: parseInt(record.Gnrc_Tot_Clms) || 0,
    brandPct: parseFloat(record.Brnd_Tot_Clms) / parseFloat(record.Tot_Clms) * 100 || 0,
    // Opioid metrics
    opioidClaims: parseInt(record.Opioid_Tot_Clms) || 0,
    opioidBeneficiaries: parseInt(record.Opioid_Tot_Benes) || 0,
    longActingOpioidClaims: parseInt(record.LA_Opioid_Tot_Clms) || 0,
    opioidPrescribingRate: parseFloat(record.Opioid_Prscrbr_Rate) || 0,
    // Antibiotic metrics
    antibioticClaims: parseInt(record.Antbtc_Tot_Clms) || 0,
    // High-risk prescribing (elderly)
    antipsychoticElderlyBenes: parseInt(record.Antpsyct_GE65_Tot_Benes) || 0,
    // Beneficiary demographics
    avgAge: parseFloat(record.Bene_Avg_Age) || null,
    avgRiskScore: parseFloat(record.Bene_Avg_Risk_Scre) || null,
    // Dual eligible (Medicare + Medicaid)
    dualEligiblePct: parseFloat(record.Bene_Dual_Cnt) / parseInt(record.Tot_Benes) * 100 || null,
    // Data source
    dataSource: CMSSchema.DATA_SOURCES.PART_D_PRESCRIBER.citation(record.year || '2023'),
    dataLimitations: CMSSchema.DATA_SOURCES.PART_D_PRESCRIBER.limitations,
  };
}

/**
 * Get data source citation
 */
function getDataSourceCitation(year = '2023') {
  return {
    ...CMSSchema.DATA_SOURCES.PART_D_PRESCRIBER,
    year,
    citation: CMSSchema.DATA_SOURCES.PART_D_PRESCRIBER.citation(year),
  };
}

module.exports = {
  getPrescriberByNPI,
  searchPrescribersByDrug,
  getTopPrescribersForDrug,
  getPartDForNPIs,
  transformPartDRecord,
  getDataSourceCitation,
};

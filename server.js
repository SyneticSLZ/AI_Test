/**
 * Physician Mapping Dashboard - Backend Server v3.0
 * Express.js API for clinical trial physician recruitment
 * 
 * Supports:
 * - Direct code search (no AI needed)
 * - Part D drug prescriber search
 * - Pre-mapped indication search
 * - Custom code set builder
 * - Physician profile with benchmark comparisons
 * - Export (CSV/JSON)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const CMSSchema = require('./cmsSchema');
const cmsApiService = require('./cmsApiService');
const codeMapperService = require('./codeMapperService');
const partDService = require('./partDService');
const aiCodeMapper = require('./aiCodeMapperAgent');
const trialService = require('./trialService');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * Server Routes Patch for Clinical Trial Search
 * 
 * ADD this require at the top of server.js (after other requires):
 *   const trialService = require('./trialService');
 * 
 * ADD these routes to server.js before the health check endpoint
 */

// ============================================
// CLINICAL TRIALS ROUTES
// ============================================

/**
 * GET /api/trials/search
 * Search clinical trials by condition/indication
 * 
 * Query params:
 *   - q: Search query (condition name)
 *   - status: Filter by status (comma-separated: RECRUITING,NOT_YET_RECRUITING,COMPLETED)
 *   - pageSize: Number of results (default 20, max 100)
 *   - pageToken: Pagination token for next page
 */
app.get('/api/trials/search', async (req, res) => {
  try {
    const query = req.query.q || req.query.query || req.query.condition;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required (min 2 characters)',
      });
    }

    console.log(`[Trials] Searching for: "${query}"`);

    const options = {
      pageSize: Math.min(parseInt(req.query.pageSize) || 20, 100),
      pageToken: req.query.pageToken || null,
    };

    // Parse status filter
    if (req.query.status) {
      options.status = req.query.status.split(',').map(s => s.trim().toUpperCase());
    } else if (req.query.activeOnly === 'true') {
      options.status = ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'];
    }

    const result = await trialService.searchTrials(query, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to search trials',
      });
    }

    res.json({
      success: true,
      query,
      trials: result.trials,
      totalCount: result.totalCount,
      nextPageToken: result.nextPageToken,
      hasMore: !!result.nextPageToken,
    });

  } catch (error) {
    console.error('[Trials] Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/trials/:nctId
 * Get details for a single trial
 */
app.get('/api/trials/:nctId', async (req, res) => {
  try {
    const nctId = req.params.nctId.toUpperCase();
    
    if (!nctId.match(/^NCT\d+$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid NCT ID format. Expected format: NCT followed by numbers (e.g., NCT04852770)',
      });
    }

    const result = await trialService.getTrialDetails(nctId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Trial not found',
      });
    }

    res.json({
      success: true,
      trial: result.trial,
    });

  } catch (error) {
    console.error('[Trials] Get trial error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/trials/extract-codes
 * Extract procedures/drugs from trial and map to billing codes using AI
 * 
 * Request body:
 * {
 *   "nctId": "NCT04852770",  // OR
 *   "trial": { ... trial object ... }
 * }
 */
app.post('/api/trials/extract-codes', async (req, res) => {
  try {
    const { nctId, trial: providedTrial } = req.body;

    let trial = providedTrial;

    // Fetch trial if only NCT ID provided
    if (!trial && nctId) {
      const result = await trialService.getTrialDetails(nctId);
      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'Trial not found',
        });
      }
      trial = result.trial;
    }

    if (!trial) {
      return res.status(400).json({
        success: false,
        error: 'Either nctId or trial object is required',
      });
    }

    console.log(`[Trials] Extracting codes for trial: ${trial.nctId || 'unknown'}`);

    // Extract search terms from trial
    const searchTerms = trialService.extractTrialSearchTerms(trial);
    
    // Build query for AI code mapping
    const codeQuery = trialService.buildTrialCodeQuery(trial);

    console.log(`[Trials] AI query: ${codeQuery.slice(0, 200)}...`);

    // Use AI to map codes
    const codeMapping = await aiCodeMapper.mapCodes(codeQuery, {
      year: '2023',
      focusArea: 'trial_matching',
    });

    if (!codeMapping.success) {
      return res.status(500).json({
        success: false,
        error: codeMapping.error || 'Failed to map codes',
      });
    }

    res.json({
      success: true,
      trial: {
        nctId: trial.nctId,
        briefTitle: trial.briefTitle,
        conditions: trial.conditions,
        interventions: trial.interventions,
      },
      extractedTerms: searchTerms,
      codeMapping: {
        codes: codeMapping.codes,
        condition: codeMapping.condition,
        confidence: codeMapping.confidence,
        report: codeMapping.report,
        sources: codeMapping.sources,
        recommendedSpecialties: codeMapping.recommendedSpecialties,
      },
    });

  } catch (error) {
    console.error('[Trials] Extract codes error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/trials/find-physicians
 * Combined endpoint: Get trial, extract codes, find matching physicians
 * 
 * Request body:
 * {
 *   "nctId": "NCT04852770",
 *   "filters": {
 *     "state": "TX",
 *     "minBeneficiaries": 50
 *   }
 * }
 */
app.post('/api/trials/find-physicians', async (req, res) => {
  try {
    const { nctId, trial: providedTrial, filters = {}, year = '2023' } = req.body;

    let trial = providedTrial;

    // Fetch trial if only NCT ID provided
    if (!trial && nctId) {
      console.log(`[Trials] Fetching trial: ${nctId}`);
      const result = await trialService.getTrialDetails(nctId);
      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'Trial not found',
        });
      }
      trial = result.trial;
    }

    if (!trial) {
      return res.status(400).json({
        success: false,
        error: 'Either nctId or trial object is required',
      });
    }

    console.log(`[Trials] Finding physicians for trial: ${trial.nctId}`);
    const startTime = Date.now();

    // Build query for AI code mapping
    const codeQuery = trialService.buildTrialCodeQuery(trial);
    const searchTerms = trialService.extractTrialSearchTerms(trial);

    // Step 1: Map codes with AI
    const codeMapping = await aiCodeMapper.mapCodes(codeQuery, {
      year,
      focusArea: 'trial_matching',
    });

    if (!codeMapping.success) {
      return res.status(500).json({
        success: false,
        error: codeMapping.error || 'Failed to map codes',
        phase: 'code_mapping',
      });
    }

    // Step 2: Extract codes for search
    const hcpcsCodes = [
      ...(codeMapping.codes?.cpt || []).map(c => c.code),
      ...(codeMapping.codes?.hcpcs || []).map(c => c.code),
    ].slice(0, 10);

    const specialties = codeMapping.recommendedSpecialties || [];

    // Step 3: Search for physicians using the mapped codes
    let physicians = [];
    let searchMethod = 'none';

    // Try code-based search first
    if (hcpcsCodes.length > 0) {
      try {
        const providerMap = new Map();

        for (const code of hcpcsCodes.slice(0, 5)) {
          const searchParams = {
            hcpcsCode: code,
            year,
            minBeneficiaries: filters.minBeneficiaries || 11,
            state: filters.state,
            providerType: filters.specialty,
            pageSize: 100,
            maxTotalResults: 100,
          };

          const results = await cmsApiService.searchProviderServices(searchParams);

          for (const service of (results.services || [])) {
            const npi = service.npi;
            if (!providerMap.has(npi)) {
              providerMap.set(npi, {
                ...service,
                matchedCodes: [service.hcpcsCode],
                totalMatchedServices: service.services || 0,
                totalMatchedBeneficiaries: service.beneficiaries || 0,
              });
            } else {
              const existing = providerMap.get(npi);
              existing.matchedCodes.push(service.hcpcsCode);
              existing.totalMatchedServices += (service.services || 0);
              existing.totalMatchedBeneficiaries += (service.beneficiaries || 0);
            }
          }
        }

        physicians = Array.from(providerMap.values())
          .sort((a, b) => b.totalMatchedServices - a.totalMatchedServices);
        searchMethod = 'code_search';

      } catch (codeSearchErr) {
        console.warn('[Trials] Code search failed, falling back to specialty search:', codeSearchErr.message);
      }
    }

    // Fallback to specialty search if code search didn't find enough
    if (physicians.length < 10 && specialties.length > 0) {
      try {
        const searchParams = {
          providerTypes: specialties,
          year,
          minBeneficiaries: filters.minBeneficiaries || 50,
          state: filters.state,
          pageSize: 100,
          maxTotalResults: 200,
        };

        // Apply comorbidity filters if provided by AI
        if (codeMapping.comorbidityFilters) {
          if (codeMapping.comorbidityFilters.ckd) {
            searchParams.minCKDPct = codeMapping.comorbidityFilters.ckd;
          }
          if (codeMapping.comorbidityFilters.diabetes) {
            searchParams.minDiabetesPct = codeMapping.comorbidityFilters.diabetes;
          }
        }

        const results = await cmsApiService.searchProviders(searchParams);

        if (physicians.length === 0) {
          physicians = results.providers || [];
          searchMethod = 'specialty_search';
        } else {
          // Merge with existing results
          const existingNpis = new Set(physicians.map(p => p.npi));
          for (const provider of (results.providers || [])) {
            if (!existingNpis.has(provider.npi)) {
              physicians.push(provider);
            }
          }
          searchMethod = 'combined_search';
        }

      } catch (specialtySearchErr) {
        console.warn('[Trials] Specialty search failed:', specialtySearchErr.message);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Trials] Physician search completed in ${totalTime}ms - found ${physicians.length} physicians`);

    res.json({
      success: true,
      trial: {
        nctId: trial.nctId,
        briefTitle: trial.briefTitle,
        officialTitle: trial.officialTitle,
        overallStatus: trial.overallStatus,
        phases: trial.phases,
        conditions: trial.conditions,
        interventions: trial.interventions,
        drugs: trial.drugs,
        procedures: trial.procedures,
        leadSponsor: trial.leadSponsor,
        enrollment: trial.enrollment,
        usLocationsCount: trial.usLocationsCount,
      },
      extractedTerms: searchTerms,
      codeMapping: {
        condition: codeMapping.condition,
        codes: codeMapping.codes,
        confidence: codeMapping.confidence,
        report: codeMapping.report,
        sources: codeMapping.sources,
        warnings: codeMapping.warnings,
        recommendedSpecialties: specialties,
      },
      physicians,
      totalPhysicians: physicians.length,
      searchMethod,
      filters: {
        ...filters,
        aiAppliedSpecialties: specialties,
        aiAppliedCodes: hcpcsCodes,
        aiAppliedComorbidities: codeMapping.comorbidityFilters,
      },
      metadata: {
        processingTime: totalTime,
        aiProcessingTime: codeMapping.metadata?.processingTime,
        year,
        timestamp: new Date().toISOString(),
      },
      dataSources: {
        trial: 'ClinicalTrials.gov API v2',
        codeMapping: 'OpenAI GPT-4 with File Search and Web Search',
        physicians: getDataSourceCitation('PART_B_SERVICE', year),
      },
    });

  } catch (error) {
    console.error('[Trials] Find physicians error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/trials/find-physicians-multi
 * Find physicians for multiple trials (combines interventions)
 * 
 * Request body:
 * {
 *   "nctIds": ["NCT04852770", "NCT01234567"],
 *   "filters": { ... }
 * }
 */
app.post('/api/trials/find-physicians-multi', async (req, res) => {
  try {
    const { nctIds, filters = {}, year = '2023' } = req.body;

    if (!nctIds || !Array.isArray(nctIds) || nctIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'nctIds array is required',
      });
    }

    if (nctIds.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 trials can be combined',
      });
    }

    console.log(`[Trials] Finding physicians for ${nctIds.length} trials`);
    const startTime = Date.now();

    // Fetch all trials
    const trials = [];
    for (const nctId of nctIds) {
      const result = await trialService.getTrialDetails(nctId);
      if (result.success) {
        trials.push(result.trial);
      }
    }

    if (trials.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid trials found',
      });
    }

    // Combine interventions from all trials
    const allDrugs = [];
    const allProcedures = [];
    const allConditions = [];

    for (const trial of trials) {
      allConditions.push(...(trial.conditions || []));
      if (trial.drugs) {
        allDrugs.push(...trial.drugs.map(d => d.name));
      }
      if (trial.procedures) {
        allProcedures.push(...trial.procedures.map(p => p.name));
      }
    }

    // Build combined query
    const combinedQuery = [
      allConditions.length > 0 ? `Conditions: ${[...new Set(allConditions)].slice(0, 5).join(', ')}` : '',
      allDrugs.length > 0 ? `Drugs: ${[...new Set(allDrugs)].slice(0, 5).join(', ')}` : '',
      allProcedures.length > 0 ? `Procedures: ${[...new Set(allProcedures)].slice(0, 5).join(', ')}` : '',
    ].filter(Boolean).join('. ');

    // Map codes with AI
    const codeMapping = await aiCodeMapper.mapCodes(combinedQuery, {
      year,
      focusArea: 'trial_matching',
    });

    if (!codeMapping.success) {
      return res.status(500).json({
        success: false,
        error: codeMapping.error || 'Failed to map codes',
      });
    }

    // Search for physicians
    const hcpcsCodes = [
      ...(codeMapping.codes?.cpt || []).map(c => c.code),
      ...(codeMapping.codes?.hcpcs || []).map(c => c.code),
    ].slice(0, 10);

    const specialties = codeMapping.recommendedSpecialties || [];
    let physicians = [];

    if (hcpcsCodes.length > 0) {
      const providerMap = new Map();

      for (const code of hcpcsCodes.slice(0, 5)) {
        try {
          const results = await cmsApiService.searchProviderServices({
            hcpcsCode: code,
            year,
            minBeneficiaries: filters.minBeneficiaries || 11,
            state: filters.state,
            pageSize: 100,
            maxTotalResults: 100,
          });

          for (const service of (results.services || [])) {
            const npi = service.npi;
            if (!providerMap.has(npi)) {
              providerMap.set(npi, {
                ...service,
                matchedCodes: [service.hcpcsCode],
                totalMatchedServices: service.services || 0,
                totalMatchedBeneficiaries: service.beneficiaries || 0,
              });
            } else {
              const existing = providerMap.get(npi);
              existing.matchedCodes.push(service.hcpcsCode);
              existing.totalMatchedServices += (service.services || 0);
              existing.totalMatchedBeneficiaries += (service.beneficiaries || 0);
            }
          }
        } catch (err) {
          console.warn(`[Trials] Code search error for ${code}:`, err.message);
        }
      }

      physicians = Array.from(providerMap.values())
        .sort((a, b) => b.totalMatchedServices - a.totalMatchedServices);
    }

    const totalTime = Date.now() - startTime;

    res.json({
      success: true,
      trials: trials.map(t => ({
        nctId: t.nctId,
        briefTitle: t.briefTitle,
        conditions: t.conditions,
        drugs: t.drugs,
        procedures: t.procedures,
      })),
      combinedQuery,
      codeMapping: {
        codes: codeMapping.codes,
        confidence: codeMapping.confidence,
        recommendedSpecialties: specialties,
      },
      physicians,
      totalPhysicians: physicians.length,
      metadata: {
        processingTime: totalTime,
        trialsProcessed: trials.length,
        year,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Trials] Multi-trial search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// END CLINICAL TRIALS ROUTES
// ============================================

/*
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Copy trialService.js to your project root
 * 
 * 2. Add to the top of server.js (after other requires):
 *    const trialService = require('./trialService');
 * 
 * 3. Add these routes to server.js before the health check
 * 
 * 4. Update health check to include trial endpoints:
 *    endpoints: {
 *      ...existing,
 *      trials: '/api/trials/search',
 *      trialDetails: '/api/trials/:nctId',
 *      trialPhysicians: '/api/trials/find-physicians',
 *    }
 */

/**
 * Server Patches for AI Code Mapping Integration
 * 
 * Add these routes to your server.js file
 * 
 * INSTRUCTIONS:
 * 1. Add the require statement at the top of server.js (after other requires):
 *    const aiCodeMapper = require('./aiCodeMapperAgent');
 * 
 * 2. Add these routes after the existing routes (before the health check)
 */

// ============================================
// AI CODE MAPPING ROUTES
// ============================================

/**
 * POST /api/ai/map-codes
 * Main AI endpoint - maps a natural language query to medical codes
 * 
 * Request body:
 * {
 *   "query": "IgA nephropathy",
 *   "year": "2023",
 *   "focusArea": "nephrology"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "condition": { ... },
 *   "codes": { icd10: [...], cpt: [...], hcpcs: [...] },
 *   "report": "# AI Code Mapping Report...",
 *   "metadata": { ... }
 * }
 */
app.post('/api/ai/map-codes', async (req, res) => {
  try {
    const { query, year, focusArea } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be at least 2 characters',
      });
    }
    
    console.log(`[AI] Starting code mapping for: "${query}"`);
    const startTime = Date.now();
    
    const result = await aiCodeMapper.mapCodes(query, {
      year: year || '2023',
      focusArea: focusArea || 'general',
    });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'AI code mapping failed',
        query,
      });
    }
    
    console.log(`[AI] Code mapping completed in ${Date.now() - startTime}ms`);
    
    res.json({
      success: true,
      ...result,
    });
    
  } catch (error) {
    console.error('[AI] Error in code mapping:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/search-physicians
 * Combined endpoint - maps codes AND searches for physicians
 * 
 * Request body:
 * {
 *   "query": "doctors who treat lupus kidney disease",
 *   "filters": {
 *     "state": "TX",
 *     "minBeneficiaries": 50
 *   }
 * }
 */
app.post('/api/ai/search-physicians', async (req, res) => {
  try {
    const { query, filters = {}, year = '2023' } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }
    
    console.log(`[AI] Starting AI physician search for: "${query}"`);
    const startTime = Date.now();
    
    // Step 1: Map codes with AI
    const codeMapping = await aiCodeMapper.mapCodes(query, { year, focusArea: 'general' });
    
    if (!codeMapping.success) {
      return res.status(500).json({
        success: false,
        error: codeMapping.error || 'Failed to map codes',
        phase: 'code_mapping',
      });
    }
    
    // Step 2: Extract codes for search
    const hcpcsCodes = [
      ...(codeMapping.codes?.cpt || []).map(c => c.code),
      ...(codeMapping.codes?.hcpcs || []).map(c => c.code),
    ].slice(0, 10); // Limit to first 10 codes
    
    const specialties = codeMapping.recommendedSpecialties || [];
    
    // Step 3: Search for physicians using the mapped codes
    let physicians = [];
    let searchMethod = 'none';
    
    // Try code-based search first
    if (hcpcsCodes.length > 0) {
      try {
        const providerMap = new Map();
        
        for (const code of hcpcsCodes.slice(0, 5)) {
          const searchParams = {
            hcpcsCode: code,
            year,
            minBeneficiaries: filters.minBeneficiaries || 11,
            state: filters.state,
            providerType: filters.specialty,
            pageSize: 100,
            maxTotalResults: 100,
          };
          
          const results = await cmsApiService.searchProviderServices(searchParams);
          
          for (const service of (results.services || [])) {
            const npi = service.npi;
            if (!providerMap.has(npi)) {
              providerMap.set(npi, {
                ...service,
                matchedCodes: [service.hcpcsCode],
                totalMatchedServices: service.services || 0,
                totalMatchedBeneficiaries: service.beneficiaries || 0,
              });
            } else {
              const existing = providerMap.get(npi);
              existing.matchedCodes.push(service.hcpcsCode);
              existing.totalMatchedServices += (service.services || 0);
              existing.totalMatchedBeneficiaries += (service.beneficiaries || 0);
            }
          }
        }
        
        physicians = Array.from(providerMap.values())
          .sort((a, b) => b.totalMatchedServices - a.totalMatchedServices);
        searchMethod = 'code_search';
        
      } catch (codeSearchErr) {
        console.warn('[AI] Code search failed, falling back to specialty search:', codeSearchErr.message);
      }
    }
    
    // Fallback to specialty search if code search didn't find enough
    if (physicians.length < 10 && specialties.length > 0) {
      try {
        const searchParams = {
          providerTypes: specialties,
          year,
          minBeneficiaries: filters.minBeneficiaries || 50,
          state: filters.state,
          pageSize: 100,
          maxTotalResults: 200,
        };
        
        // Apply comorbidity filters if provided by AI
        if (codeMapping.comorbidityFilters) {
          if (codeMapping.comorbidityFilters.ckd) {
            searchParams.minCKDPct = codeMapping.comorbidityFilters.ckd;
          }
          if (codeMapping.comorbidityFilters.diabetes) {
            searchParams.minDiabetesPct = codeMapping.comorbidityFilters.diabetes;
          }
        }
        
        const results = await cmsApiService.searchProviders(searchParams);
        
        if (physicians.length === 0) {
          physicians = results.providers || [];
          searchMethod = 'specialty_search';
        } else {
          // Merge with existing results
          const existingNpis = new Set(physicians.map(p => p.npi));
          for (const provider of (results.providers || [])) {
            if (!existingNpis.has(provider.npi)) {
              physicians.push(provider);
            }
          }
          searchMethod = 'combined_search';
        }
        
      } catch (specialtySearchErr) {
        console.warn('[AI] Specialty search failed:', specialtySearchErr.message);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[AI] Physician search completed in ${totalTime}ms - found ${physicians.length} physicians`);
    
    res.json({
      success: true,
      query,
      codeMapping: {
        condition: codeMapping.condition,
        codes: codeMapping.codes,
        confidence: codeMapping.confidence,
        report: codeMapping.report,
        sources: codeMapping.sources,
        warnings: codeMapping.warnings,
      },
      physicians,
      totalPhysicians: physicians.length,
      searchMethod,
      filters: {
        ...filters,
        aiAppliedSpecialties: specialties,
        aiAppliedCodes: hcpcsCodes,
        aiAppliedComorbidities: codeMapping.comorbidityFilters,
      },
      metadata: {
        processingTime: totalTime,
        aiProcessingTime: codeMapping.metadata?.processingTime,
        year,
        timestamp: new Date().toISOString(),
      },
      dataSources: {
        codeMapping: 'OpenAI GPT-4 with File Search and Web Search',
        physicians: getDataSourceCitation('PART_B_SERVICE', year),
      },
    });
    
  } catch (error) {
    console.error('[AI] Error in AI physician search:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/ai/status
 * Check AI system status including vector store
 */
app.get('/api/ai/status', async (req, res) => {
  try {
    const vectorStoreStatus = await aiCodeMapper.getVectorStoreStatus();
    
    res.json({
      success: true,
      status: 'operational',
      vectorStore: vectorStoreStatus,
      configuration: {
        hasApiKey: !!process.env.OPENAI_API_KEY,
        hasVectorStoreId: !!process.env.OPENAI_VECTOR_STORE_ID,
        hasAssistantId: !!process.env.OPENAI_ASSISTANT_ID,
      },
      capabilities: {
        fileSearch: vectorStoreStatus.status === 'active',
        webSearch: true,
        codeMapping: true,
        physicianSearch: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/validate-codes
 * Validate a set of codes using AI
 */
app.post('/api/ai/validate-codes', async (req, res) => {
  try {
    const { codes, condition } = req.body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Codes array is required',
      });
    }
    
    // Use AI to validate the codes
    const validationQuery = `Validate these billing codes for the condition "${condition || 'unknown'}": ${codes.join(', ')}. 
    Check if they are:
    1. Valid codes (exist in ICD-10/CPT/HCPCS)
    2. Appropriate for the condition
    3. Currently active (not deprecated)
    Provide confidence levels for each code.`;
    
    const result = await aiCodeMapper.mapCodes(validationQuery, { focusArea: 'validation' });
    
    res.json({
      success: true,
      validation: result,
    });
    
  } catch (error) {
    console.error('[AI] Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// END AI CODE MAPPING ROUTES
// ============================================

/*
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Copy aiCodeMapperAgent.js to your project root
 * 
 * 2. Add to the top of server.js:
 *    const aiCodeMapper = require('./aiCodeMapperAgent');
 * 
 * 3. Add these routes to server.js before the health check
 * 
 * 4. Set environment variables:
 *    OPENAI_API_KEY=your-api-key
 *    OPENAI_VECTOR_STORE_ID=your-vector-store-id (optional, will use web search if not set)
 *    OPENAI_ASSISTANT_ID=your-assistant-id (optional)
 * 
 * 5. Install dependencies:
 *    npm install openai
 * 
 * 6. (Optional) Run vector store setup:
 *    node setupVectorStore.js
 */
// ============================================
// INDICATION ROUTES
// ============================================

/**
 * GET /api/indications
 * List all available pre-mapped indications
 */
app.get('/api/indications', (req, res) => {
  try {
    const indications = CMSSchema.getAllIndications();
    
    res.json({
      success: true,
      count: indications.length,
      indications: indications.map(ind => ({
        id: ind.id,
        name: ind.name,
        shortName: ind.shortName,
        description: ind.description,
        category: ind.category,
        version: ind.version || '1.0',
        lastUpdated: ind.lastUpdated,
        specialties: ind.specialties,
        codeCount: {
          icd10: ind.icd10?.length || 0,
          cpt: ind.cpt?.length || 0,
          hcpcs: ind.hcpcs?.length || 0,
          partDDrugs: ind.partDDrugs?.length || 0,
        },
      })),
      dataSource: 'Curated code sets - validated by clinical experts',
    });
  } catch (error) {
    console.error('[API] Error fetching indications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/indications/:id
 * Get details for a specific indication including full code set
 */
app.get('/api/indications/:id', (req, res) => {
  try {
    const indication = CMSSchema.getIndicationById(req.params.id);
    
    if (!indication) {
      return res.status(404).json({
        success: false,
        error: `Indication not found: ${req.params.id}`,
        availableIndications: CMSSchema.getAllIndications().map(i => ({ id: i.id, name: i.name })),
      });
    }
    
    // Get complete code set with descriptions
    const codeSet = codeMapperService.getCompleteCodeSet(req.params.id);
    
    res.json({
      success: true,
      indication: {
        ...indication,
        codeSet: codeSet.codes,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching indication:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PHYSICIAN SEARCH ROUTES
// ============================================

/**
 * GET /api/physicians
 * Search physicians with filters (basic search)
 */
app.get('/api/physicians', async (req, res) => {
  try {
    const params = parseSearchParams(req.query);
    const results = await cmsApiService.searchProviders(params);
    
    res.json({
      success: true,
      ...results,
      count: results.providers?.length || 0,
      totalCount: results.totalReturned || results.providers?.length || 0,
      query: params,
      dataSources: getDataSourceCitation('PART_B_PROVIDER', params.year),
    });
  } catch (error) {
    console.error('[API] Error searching physicians:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/by-indication/:indicationId
 * Search physicians by indication (disease-specific search using pre-mapped codes)
 */
app.get('/api/physicians/by-indication/:indicationId', async (req, res) => {
  try {
    const params = parseSearchParams(req.query);
    params.minBeneficiaries = params.minBeneficiaries || 50;
    
    const results = await cmsApiService.searchPhysiciansByIndication(req.params.indicationId, params);
    
    res.json({
      success: true,
      ...results,
      count: results.physicians?.length || 0,
      totalCount: results.totalReturned || results.physicians?.length || 0,
      dataSources: getDataSourceCitation('PART_B_SERVICE', params.year),
    });
  } catch (error) {
    console.error('[API] Error searching by indication:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/by-code/:code
 * Search physicians who perform a specific HCPCS/CPT code
 * This is the DIRECT SEARCH approach - no AI needed
 */
app.get('/api/physicians/by-code/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const params = parseSearchParams(req.query);
    params.hcpcsCode = code;
    params.minBeneficiaries = params.minBeneficiaries || 11;
    
    const results = await cmsApiService.searchProviderServices(params);
    
    // Get code description
    const codeDesc = CMSSchema.CommonCodes.procedures[code] || 
                     CMSSchema.CommonCodes.drugs[code] || 
                     results.services?.[0]?.hcpcsDescription ||
                     'Unknown code';
    
    res.json({
      success: true,
      searchType: 'direct_code',
      code: code,
      codeDescription: codeDesc,
      services: results.services || [],
      providers: results.services || [], // Alias for frontend compatibility
      count: results.services?.length || 0,
      totalCount: results.totalReturned || results.services?.length || 0,
      dataSources: getDataSourceCitation('PART_B_SERVICE', params.year),
    });
  } catch (error) {
    console.error('[API] Error searching by code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/by-codes
 * Search physicians who perform ANY of the specified codes (multi-code search)
 */
app.get('/api/physicians/by-codes', async (req, res) => {
  try {
    const codes = (req.query.codes || '').split(',').map(c => c.trim().toUpperCase()).filter(c => c);
    
    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "codes" is required (comma-separated)',
        example: '/api/physicians/by-codes?codes=50200,50205,J9312',
      });
    }
    
    const params = parseSearchParams(req.query);
    params.minBeneficiaries = params.minBeneficiaries || 11;
    
    // Fetch data for each code and aggregate
    const providerMap = new Map();
    
    for (const code of codes.slice(0, 10)) { // Limit to 10 codes
      try {
        const codeParams = { ...params, hcpcsCode: code };
        const results = await cmsApiService.searchProviderServices(codeParams);
        
        for (const service of (results.services || [])) {
          const npi = service.npi;
          if (!providerMap.has(npi)) {
            providerMap.set(npi, {
              ...service,
              matchedCodes: [service.hcpcsCode],
              totalMatchedServices: service.services,
              totalMatchedBeneficiaries: service.beneficiaries,
            });
          } else {
            const existing = providerMap.get(npi);
            existing.matchedCodes.push(service.hcpcsCode);
            existing.totalMatchedServices += service.services;
            existing.totalMatchedBeneficiaries += service.beneficiaries;
          }
        }
      } catch (err) {
        console.error(`Error fetching code ${code}:`, err.message);
      }
    }
    
    // Convert to array and sort by matched services
    const aggregatedProviders = Array.from(providerMap.values())
      .sort((a, b) => b.totalMatchedServices - a.totalMatchedServices);
    
    res.json({
      success: true,
      searchType: 'multi_code',
      codes: codes,
      services: aggregatedProviders,
      providers: aggregatedProviders, // Alias
      count: aggregatedProviders.length,
      totalCount: aggregatedProviders.length,
      dataSources: getDataSourceCitation('PART_B_SERVICE', params.year),
    });
  } catch (error) {
    console.error('[API] Error searching by codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/advanced-search
 * Advanced search with all filter options
 */
app.get('/api/physicians/advanced-search', async (req, res) => {
  try {
    const params = parseSearchParams(req.query);
    const results = await cmsApiService.searchProviders(params);
    
    res.json({
      success: true,
      ...results,
      count: results.providers?.length || 0,
      totalCount: results.totalReturned || results.providers?.length || 0,
      query: params,
      dataSources: getDataSourceCitation('PART_B_PROVIDER', params.year),
    });
  } catch (error) {
    console.error('[API] Error in advanced search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PHYSICIAN PROFILE ROUTES
// ============================================

/**
 * GET /api/physicians/:npi
 * Get detailed profile for a single physician
 */
app.get('/api/physicians/:npi', async (req, res) => {
  try {
    const year = req.query.year || '2023';
    const profile = await cmsApiService.getProviderProfile(req.params.npi, year);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: `Provider not found: ${req.params.npi}`,
      });
    }
    
    // Flatten profile for frontend compatibility
    const flatProfile = flattenProfile(profile);
    
    res.json({
      success: true,
      profile: flatProfile,
      dataSources: getDataSourceCitation('PART_B_PROVIDER', year),
    });
  } catch (error) {
    console.error('[API] Error fetching physician profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/:npi/compared
 * Get physician profile with national benchmark comparisons
 */
app.get('/api/physicians/:npi/compared', async (req, res) => {
  try {
    const year = req.query.year || '2023';
    const profile = await cmsApiService.getProviderProfile(req.params.npi, year);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: `Provider not found: ${req.params.npi}`,
      });
    }
    
    // Flatten profile
    const flatProfile = flattenProfile(profile);
    
    // Calculate benchmark comparisons
    const benchmarks = CMSSchema.NATIONAL_BENCHMARKS;
    const comparisons = {};
    
    // Chronic condition comparisons
    const conditionMappings = {
      ckd: 'ckd',
      diabetes: 'diabetes',
      hypertension: 'hypertension',
      heartDisease: 'heartDisease',
      heartFailure: 'heartFailure',
      copd: 'copd',
      depression: 'depression',
      dementia: 'dementia',
    };
    
    for (const [profileKey, benchmarkKey] of Object.entries(conditionMappings)) {
      const value = flatProfile.chronicConditions?.[profileKey];
      const benchmark = benchmarks.chronicConditions?.[benchmarkKey];
      
      if (value !== null && value !== undefined && benchmark !== undefined) {
        const diff = value - benchmark;
        const pctDiff = benchmark > 0 ? ((value - benchmark) / benchmark * 100) : 0;
        
        comparisons[profileKey] = {
          physician: parseFloat(value.toFixed(1)),
          national: benchmark,
          difference: parseFloat(diff.toFixed(1)),
          percentDiff: parseFloat(pctDiff.toFixed(1)),
          interpretation: getInterpretation(value, benchmark),
        };
      }
    }
    
    // Risk score comparison
    if (flatProfile.avgRiskScore || flatProfile.riskScore) {
      const risk = flatProfile.avgRiskScore || flatProfile.riskScore;
      comparisons.riskScore = {
        physician: parseFloat(risk.toFixed(2)),
        national: benchmarks.avgRiskScore,
        difference: parseFloat((risk - benchmarks.avgRiskScore).toFixed(2)),
        interpretation: risk > 1.5 ? 'high_acuity' :
                       risk > 1.2 ? 'above_average' :
                       risk < 0.8 ? 'low_acuity' : 'average',
      };
    }
    
    res.json({
      success: true,
      profile: flatProfile,
      comparisons,
      benchmarkSource: benchmarks.source,
      dataSources: getDataSourceCitation('PART_B_PROVIDER', year),
    });
  } catch (error) {
    console.error('[API] Error fetching compared profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/physicians/:npi/prescribing
 * Get combined profile with Part D prescribing data
 */
app.get('/api/physicians/:npi/prescribing', async (req, res) => {
  try {
    const year = req.query.year || '2023';
    
    // Get both Part B profile and Part D data
    const [profile, partDData] = await Promise.all([
      cmsApiService.getProviderProfile(req.params.npi, year),
      partDService.getPrescriberByNPI(req.params.npi, year),
    ]);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: `Provider not found: ${req.params.npi}`,
      });
    }
    
    const flatProfile = flattenProfile(profile);
    
    res.json({
      success: true,
      profile: {
        ...flatProfile,
        partD: partDData ? partDService.transformPartDRecord(partDData) : null,
        hasPartDData: !!partDData,
      },
      dataSources: {
        partB: getDataSourceCitation('PART_B_PROVIDER', year),
        partD: partDData ? partDService.getDataSourceCitation(year) : null,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching physician with prescribing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SERVICES ROUTES
// ============================================

/**
 * GET /api/services
 * Search provider services (procedures/drugs)
 */
app.get('/api/services', async (req, res) => {
  try {
    const params = parseSearchParams(req.query);
    
    // Handle HCPCS code parameter
    if (req.query.hcpcs) params.hcpcsCode = req.query.hcpcs;
    if (req.query.code) params.hcpcsCode = req.query.code;
    if (req.query.codes) params.hcpcsCodes = req.query.codes.split(',');
    if (req.query.description) params.hcpcsDescription = req.query.description;
    if (req.query.isDrug !== undefined) {
      params.isDrug = req.query.isDrug === 'true';
    }
    
    const results = await cmsApiService.searchProviderServices(params);
    
    res.json({
      success: true,
      ...results,
      count: results.services?.length || 0,
      dataSources: getDataSourceCitation('PART_B_SERVICE', params.year),
    });
  } catch (error) {
    console.error('[API] Error searching services:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PART D PRESCRIBER ROUTES
// ============================================

/**
 * GET /api/prescribers
 * Search Part D prescribers by drug name
 */
app.get('/api/prescribers', async (req, res) => {
  try {
    const drugName = req.query.drug || '';
    const options = {
      year: req.query.year || '2023',
      state: req.query.state,
      specialty: req.query.specialty,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      minClaims: req.query.minClaims ? parseInt(req.query.minClaims) : 11,
    };
    
    const results = await partDService.searchPrescribersByDrug(drugName, options);
    
    res.json({
      success: true,
      count: results.length,
      prescribers: results,
      dataSources: partDService.getDataSourceCitation(options.year),
    });
  } catch (error) {
    console.error('[API] Error searching prescribers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/prescribers/:npi
 * Get Part D prescribing data for a specific NPI
 */
app.get('/api/prescribers/:npi', async (req, res) => {
  try {
    const year = req.query.year || '2023';
    const data = await partDService.getPrescriberByNPI(req.params.npi, year);
    
    if (!data) {
      return res.json({
        success: true,
        found: false,
        message: 'No Part D prescribing data found for this NPI',
        npi: req.params.npi,
      });
    }
    
    res.json({
      success: true,
      found: true,
      prescriber: partDService.transformPartDRecord(data),
      dataSources: partDService.getDataSourceCitation(year),
    });
  } catch (error) {
    console.error('[API] Error fetching prescriber:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CODE MAPPER ROUTES
// ============================================

/**
 * GET /api/codes/search
 * Search codes by keyword
 */
app.get('/api/codes/search', (req, res) => {
  try {
    const query = req.query.q || req.query.query;
    const codeType = req.query.type || 'all';
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
        example: '/api/codes/search?q=nephropathy',
      });
    }
    
    const results = codeMapperService.searchCodes(query, codeType);
    
    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[API] Error searching codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/codes/suggest/icd10
 * Suggest ICD-10 codes for a condition
 */
app.get('/api/codes/suggest/icd10', (req, res) => {
  try {
    const condition = req.query.condition || req.query.q;
    
    if (!condition) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "condition" is required',
      });
    }
    
    const suggestions = codeMapperService.suggestICD10Codes(condition);
    res.json({ success: true, ...suggestions });
  } catch (error) {
    console.error('[API] Error suggesting ICD-10 codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/codes/suggest/cpt
 * Suggest CPT codes for a procedure
 */
app.get('/api/codes/suggest/cpt', (req, res) => {
  try {
    const procedure = req.query.procedure || req.query.q;
    
    if (!procedure) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "procedure" is required',
      });
    }
    
    const suggestions = codeMapperService.suggestCPTCodes(procedure);
    res.json({ success: true, ...suggestions });
  } catch (error) {
    console.error('[API] Error suggesting CPT codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/codes/suggest/hcpcs
 * Suggest HCPCS drug codes
 */
app.get('/api/codes/suggest/hcpcs', (req, res) => {
  try {
    const drugClass = req.query.drugClass || req.query.drug || req.query.q;
    
    if (!drugClass) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "drugClass" is required',
      });
    }
    
    const suggestions = codeMapperService.suggestHCPCSCodes(drugClass);
    res.json({ success: true, ...suggestions });
  } catch (error) {
    console.error('[API] Error suggesting HCPCS codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/codes/codeset/:indication
 * Get complete code set for an indication
 */
app.get('/api/codes/codeset/:indication', (req, res) => {
  try {
    const codeSet = codeMapperService.getCompleteCodeSet(req.params.indication);
    res.json({ success: true, ...codeSet });
  } catch (error) {
    console.error('[API] Error getting code set:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REFERENCE DATA ROUTES
// ============================================

/**
 * GET /api/reference/states
 */
app.get('/api/reference/states', (req, res) => {
  res.json({
    success: true,
    states: CMSSchema.StateCodes,
  });
});

/**
 * GET /api/reference/specialties
 */
app.get('/api/reference/specialties', (req, res) => {
  res.json({
    success: true,
    specialties: CMSSchema.ProviderTypes,
  });
});

/**
 * GET /api/reference/years
 */
app.get('/api/reference/years', (req, res) => {
  res.json({
    success: true,
    years: CMSSchema.getAvailableYears(),
  });
});

/**
 * GET /api/reference/common-codes
 */
app.get('/api/reference/common-codes', (req, res) => {
  res.json({
    success: true,
    codes: CMSSchema.CommonCodes,
  });
});

/**
 * GET /api/benchmarks
 * Get national benchmark data for comparisons
 */
app.get('/api/benchmarks', (req, res) => {
  res.json({
    success: true,
    benchmarks: CMSSchema.NATIONAL_BENCHMARKS,
    note: 'National averages for Medicare beneficiaries. Use to compare physician patient panels.',
  });
});

/**
 * GET /api/data-sources
 * Get all data source citations and limitations
 */
app.get('/api/data-sources', (req, res) => {
  res.json({
    success: true,
    schemaVersion: CMSSchema.SCHEMA_VERSION,
    schemaUpdated: CMSSchema.SCHEMA_UPDATED,
    sources: CMSSchema.DATA_SOURCES,
    availableYears: CMSSchema.getAvailableYears(),
    note: 'All data is from CMS public use files. See limitations for each source.',
  });
});
// Add to server.js
/**
 * GET /api/physicians/:npi/affiliations
 * Get comprehensive affiliation data from multiple sources:
 * - NPPES: Practice locations, taxonomies, basic info
 * - CMS Clinician Data: Hospital affiliations, group practices
 */
app.get('/api/physicians/:npi/affiliations', async (req, res) => {
  try {
    const { npi } = req.params;
    console.log(`[Affiliations] Fetching data for NPI: ${npi}`);
    
    // Fetch from multiple sources in parallel
    const [nppesData, clinicianData] = await Promise.all([
      fetchNPPESData(npi),
      fetchClinicianData(npi),
    ]);
    
    // Merge and deduplicate data
    const affiliations = mergeAffiliationData(nppesData, clinicianData);
    
    res.json({
      success: true,
      npi,
      affiliations,
      dataSources: {
        nppes: {
          name: 'NPPES NPI Registry',
          url: 'https://npiregistry.cms.hhs.gov/',
          lastUpdated: nppesData?.basic?.last_updated || null,
        },
        clinician: {
          name: 'CMS Clinician Data',
          url: 'https://data.cms.gov/provider-data/dataset/mj5m-pzi6',
          description: 'Hospital affiliations and group practices from Medicare Provider Enrollment',
        },
      },
    });
  } catch (error) {
    console.error('[Affiliations] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      npi: req.params.npi,
    });
  }
});

/**
 * Fetch provider data from NPPES NPI Registry
 */
async function fetchNPPESData(npi) {
  try {
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) {
      console.warn(`[NPPES] API returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }
    
    return data.results[0];
  } catch (error) {
    console.error('[NPPES] Fetch error:', error.message);
    return null;
  }
}

/**
 * Fetch clinician data from CMS Clinician Data API
 * This includes hospital affiliations and group practice info
 */
async function fetchClinicianData(npi) {
  try {
    // CMS Clinician Data API (includes hospital affiliations)
    const clinicianUrl = `https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0?conditions[0][property]=npi&conditions[0][value]=${npi}&conditions[0][operator]=%3D&limit=10`;
    
    const response = await fetch(clinicianUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.warn(`[CMS Clinician] API returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[CMS Clinician] Fetch error:', error.message);
    return null;
  }
}

/**
 * Merge affiliation data from multiple sources
 */
function mergeAffiliationData(nppes, clinicianRecords) {
  const result = {
    organizationName: null,
    groupPractices: [],
    practiceLocations: [],
    hospitalAffiliations: [],
    specialties: [],
    boardCertifications: [],
    medicalSchool: null,
    graduationYear: null,
    enumerationDate: null,
    lastUpdated: null,
    status: null,
    gender: null,
    soleProprietor: false,
  };
  
  // Process NPPES data
  if (nppes) {
    const basic = nppes.basic || {};
    const addresses = nppes.addresses || [];
    const taxonomies = nppes.taxonomies || [];
    
    result.organizationName = basic.organization_name || basic.authorized_official_organization_name || null;
    result.enumerationDate = basic.enumeration_date;
    result.lastUpdated = basic.last_updated;
    result.status = basic.status;
    result.gender = basic.gender;
    result.soleProprietor = basic.sole_proprietor === 'YES';
    
    // Practice locations
    result.practiceLocations = addresses.map(addr => ({
      type: addr.address_purpose === 'MAILING' ? 'Mailing' : 'Practice',
      address1: addr.address_1,
      address2: addr.address_2 || null,
      city: addr.city,
      state: addr.state,
      zip: addr.postal_code,
      phone: addr.telephone_number,
      fax: addr.fax_number,
      country: addr.country_name || 'US',
    }));
    
    // Taxonomies/Specialties
    result.specialties = taxonomies.map(t => ({
      code: t.code,
      description: t.desc,
      primary: t.primary === true || t.primary === 'Y',
      state: t.state,
      license: t.license,
      source: 'NPPES',
    }));
  }
  
  // Process CMS Clinician data (contains hospital affiliations!)
  if (clinicianRecords && clinicianRecords.length > 0) {
    const seenHospitals = new Set();
    const seenGroups = new Set();
    
    for (const record of clinicianRecords) {
      // Hospital affiliations - CMS has up to 5 per record
      for (let i = 1; i <= 5; i++) {
        const hospCcn = record[`hosp_afl_${i}`];
        const hospName = record[`hosp_afl_lbn_${i}`];
        
        if (hospCcn && hospName && !seenHospitals.has(hospCcn)) {
          seenHospitals.add(hospCcn);
          result.hospitalAffiliations.push({
            ccn: hospCcn,
            name: formatHospitalName(hospName),
            source: 'CMS Clinician Data',
          });
        }
      }
      
      // Group practice info
      const groupPacId = record.org_pac_id;
      const groupName = record.org_nm;
      
      if (groupPacId && groupName && !seenGroups.has(groupPacId)) {
        seenGroups.add(groupPacId);
        result.groupPractices.push({
          pacId: groupPacId,
          name: formatOrgName(groupName),
          address: record.adr_ln_1,
          city: record.cty,
          state: record.st,
          zip: record.zip,
          phone: record.phn_numbr,
        });
      }
      
      // Medical school
      if (!result.medicalSchool && record.med_sch) {
        result.medicalSchool = formatSchoolName(record.med_sch);
        result.graduationYear = record.grd_yr;
      }
      
      // Primary specialty from CMS
      if (record.pri_spec) {
        const existingPrimary = result.specialties.find(s => s.primary && s.source === 'CMS');
        if (!existingPrimary) {
          result.specialties.unshift({
            code: null,
            description: record.pri_spec,
            primary: true,
            state: record.st,
            license: null,
            source: 'CMS',
          });
        }
      }
      
      // Secondary specialties
      if (record.sec_spec_1) {
        result.specialties.push({
          code: null,
          description: record.sec_spec_1,
          primary: false,
          source: 'CMS',
        });
      }
      if (record.sec_spec_2) {
        result.specialties.push({
          code: null,
          description: record.sec_spec_2,
          primary: false,
          source: 'CMS',
        });
      }
    }
  }
  
  // Use first group practice as org name if not set
  if (!result.organizationName && result.groupPractices.length > 0) {
    result.organizationName = result.groupPractices[0].name;
  }
  
  return result;
}

/**
 * Format hospital name (title case, clean up)
 */
function formatHospitalName(name) {
  if (!name) return name;
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bInc\b/g, 'Inc.')
    .trim();
}

/**
 * Format organization name
 */
function formatOrgName(name) {
  if (!name) return name;
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bPllc\b/g, 'PLLC')
    .replace(/\bPc\b/g, 'PC')
    .replace(/\bMd\b/g, 'MD')
    .replace(/\bPa\b/g, 'PA')
    .trim();
}

/**
 * Format medical school name
 */
function formatSchoolName(name) {
  if (!name) return name;
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bOf\b/g, 'of')
    .replace(/\bThe\b/g, 'the')
    .replace(/\bAnd\b/g, 'and')
    .trim();
}
// app.get('/api/physicians/:npi/affiliations', async (req, res) => {
//   try {
//     const { npi } = req.params;
    
//     // Query NPPES API for provider details including affiliations
//     const nppes = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
//     const data = await nppes.json();
    
//     if (!data.results || data.results.length === 0) {
//       return res.json({ success: true, affiliations: [] });
//     }
    
//     const provider = data.results[0];
//     const basic = provider.basic || {};
//     const addresses = provider.addresses || [];
//     const taxonomies = provider.taxonomies || [];
//     const identifiers = provider.identifiers || [];
    
//     // Extract organization name if individual
//     const orgName = basic.organization_name || basic.authorized_official_organization_name || null;
    
//     // Practice locations
//     const practiceLocations = addresses.map(addr => ({
//       type: addr.address_purpose === 'MAILING' ? 'Mailing' : 'Practice',
//       address: `${addr.address_1}${addr.address_2 ? ', ' + addr.address_2 : ''}`,
//       city: addr.city,
//       state: addr.state,
//       zip: addr.postal_code,
//       phone: addr.telephone_number,
//       fax: addr.fax_number,
//     }));
    
//     // Taxonomy/specialty details
//     const specialties = taxonomies.map(t => ({
//       code: t.code,
//       description: t.desc,
//       primary: t.primary,
//       state: t.state,
//       license: t.license,
//     }));
    
//     // Hospital affiliations from identifiers (if available)
//     const hospitalAffiliations = identifiers
//       .filter(id => id.identifier_type === 'HOSPITAL')
//       .map(id => ({
//         name: id.identifier_name || id.issuer,
//         identifier: id.identifier,
//         state: id.state,
//       }));
    
//     res.json({
//       success: true,
//       affiliations: {
//         organizationName: orgName,
//         practiceLocations,
//         specialties,
//         hospitalAffiliations,
//         enumerationDate: basic.enumeration_date,
//         lastUpdated: basic.last_updated,
//         status: basic.status,
//         sole_proprietor: basic.sole_proprietor,
//         gender: basic.gender,
//       }
//     });
//   } catch (err) {
//     console.error('NPPES API error:', err);
//     res.json({ success: false, error: err.message });
//   }
// });
// ============================================
// EXPORT ROUTES
// ============================================

/**
 * GET /api/export/physicians
 * Export physician search results as CSV or JSON
 */
app.get('/api/export/physicians', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const params = parseSearchParams(req.query);
    params.pageSize = Math.min(parseInt(req.query.limit) || 500, 1000);
    params.maxTotalResults = params.pageSize;
    
    let results;
    if (req.query.indication) {
      results = await cmsApiService.searchPhysiciansByIndication(req.query.indication, params);
      results.providers = results.physicians;
    } else if (req.query.code) {
      params.hcpcsCode = req.query.code;
      results = await cmsApiService.searchProviderServices(params);
      results.providers = results.services;
    } else {
      results = await cmsApiService.searchProviders(params);
    }
    
    const providers = results.providers || results.physicians || results.services || [];
    
    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'NPI', 'Name', 'Credentials', 'Specialty', 'City', 'State', 'Zip',
        'Beneficiaries', 'Services', 'Avg_Risk_Score', 'CKD_Pct', 'Diabetes_Pct',
        'Hypertension_Pct', 'Heart_Disease_Pct', 'Medicare_Payment'
      ];
      
      const rows = providers.map(p => {
        const cc = p.chronicConditions || {};
        const totals = p.totals || {};
        return [
          p.npi || '',
          `"${p.fullName || p.name || p.providerName || ''}"`,
          p.credentials || '',
          `"${p.specialty || ''}"`,
          `"${p.city || p.location?.city || ''}"`,
          p.state || p.location?.state || '',
          p.zip || p.location?.zip || '',
          totals.beneficiaries || p.totalBeneficiaries || p.beneficiaries || '',
          totals.services || p.totalServices || p.services || '',
          p.avgRiskScore || p.riskScore || '',
          cc.ckd || '',
          cc.diabetes || '',
          cc.hypertension || '',
          cc.heartDisease || '',
          totals.payment || p.totalMedicarePayment || ''
        ].join(',');
      });
      
      const csv = [headers.join(','), ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=physicians_export_${Date.now()}.csv`);
      res.send(csv);
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=physicians_export_${Date.now()}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        dataYear: params.year,
        query: params,
        totalCount: providers.length,
        dataSource: CMSSchema.DATA_SOURCES.PART_B_PROVIDER.citation(params.year),
        physicians: providers,
      });
    }
  } catch (error) {
    console.error('[API] Error exporting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    schemaVersion: CMSSchema.SCHEMA_VERSION,
    schemaUpdated: CMSSchema.SCHEMA_UPDATED,
    availableYears: CMSSchema.getAvailableYears(),
    indicationCount: CMSSchema.getAllIndications().length,
    endpoints: {
      indications: '/api/indications',
      physicians: '/api/physicians',
      byCode: '/api/physicians/by-code/:code',
      byCodes: '/api/physicians/by-codes',
      byIndication: '/api/physicians/by-indication/:id',
      prescribers: '/api/prescribers',
      services: '/api/services',
      codes: '/api/codes/search',
      benchmarks: '/api/benchmarks',
      export: '/api/export/physicians',
    },
  });
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse common search parameters from query string
 */
function parseSearchParams(query) {
  const params = {};
  
  // NPI/Provider
  if (query.npi) params.npi = query.npi;
  if (query.name) params.providerName = query.name;
  if (query.providerName) params.providerName = query.providerName;
  if (query.firstName) params.providerFirstName = query.firstName;
  
  // Location - single
  if (query.state) params.state = query.state.toUpperCase();
  if (query.city) params.city = query.city;
  if (query.zip) params.zipCode = query.zip;
  if (query.zipCode) params.zipCode = query.zipCode;
  
  // Location - multiple
  if (query.states) {
    params.states = query.states.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
  }
  if (query.zips) {
    params.zipCodes = query.zips.split(',').map(z => z.trim()).filter(z => z);
  }
  
  // Specialty
  if (query.specialty) params.providerType = query.specialty;
  if (query.providerType) params.providerType = query.providerType;
  if (query.specialties) {
    params.providerTypes = query.specialties.split(',').map(s => s.trim()).filter(s => s);
  }
  
  // Volume thresholds
  if (query.minBeneficiaries) params.minBeneficiaries = parseInt(query.minBeneficiaries);
  if (query.maxBeneficiaries) params.maxBeneficiaries = parseInt(query.maxBeneficiaries);
  if (query.minServices) params.minServices = parseInt(query.minServices);
  
  // Risk score
  if (query.minRiskScore) params.minRiskScore = parseFloat(query.minRiskScore);
  if (query.maxRiskScore) params.maxRiskScore = parseFloat(query.maxRiskScore);
  
  // Comorbidity thresholds
  if (query.minCKD) params.minCKDPct = parseFloat(query.minCKD);
  if (query.maxCKD) params.maxCKDPct = parseFloat(query.maxCKD);
  if (query.minDiabetes) params.minDiabetesPct = parseFloat(query.minDiabetes);
  if (query.maxDiabetes) params.maxDiabetesPct = parseFloat(query.maxDiabetes);
  if (query.minHypertension) params.minHypertensionPct = parseFloat(query.minHypertension);
  if (query.minHeartDisease) params.minHeartDiseasePct = parseFloat(query.minHeartDisease);
  
  // Sorting
  if (query.sortBy) params.sortBy = query.sortBy;
  params.sortDescending = query.sortOrder !== 'asc';
  
  // Pagination
  params.pageSize = query.limit ? parseInt(query.limit) : 50;
  params.offset = query.offset ? parseInt(query.offset) : 0;
  params.maxTotalResults = query.maxResults ? parseInt(query.maxResults) : 200;
  
  // Year
  params.year = query.year || '2023';
  
  return params;
}

/**
 * Get data source citation object
 */
function getDataSourceCitation(sourceKey, year = '2023') {
  const source = CMSSchema.DATA_SOURCES[sourceKey];
  if (!source) {
    return { source: 'CMS Medicare PUF', year };
  }
  
  return {
    source: source.name,
    year,
    citation: source.citation(year),
    limitations: source.limitations,
    url: source.url,
    methodology: source.methodology,
  };
}

/**
 * Get interpretation string for benchmark comparison
 */
function getInterpretation(value, benchmark) {
  if (value > benchmark * 1.5) return 'significantly_higher';
  if (value > benchmark * 1.1) return 'higher';
  if (value < benchmark * 0.5) return 'significantly_lower';
  if (value < benchmark * 0.9) return 'lower';
  return 'similar';
}

/**
 * Flatten nested profile object for frontend
 */
function flattenProfile(profile) {
  if (!profile) return null;
  
  return {
    npi: profile.npi,
    fullName: profile.name || profile.fullName,
    lastName: profile.lastName,
    firstName: profile.firstName,
    middleInitial: profile.middleInitial,
    credentials: profile.credentials,
    gender: profile.gender,
    entityType: profile.entityType,
    specialty: profile.specialty,
    
    // Location
    city: profile.location?.city || profile.city,
    state: profile.location?.state || profile.state,
    zip: profile.location?.zip || profile.zip,
    street: profile.location?.street,
    
    // Totals
    totalBeneficiaries: profile.totals?.beneficiaries || profile.totalBeneficiaries,
    totalServices: profile.totals?.services || profile.totalServices,
    uniqueHCPCS: profile.totals?.hcpcsCodes || profile.uniqueHCPCS,
    totalMedicarePayment: profile.totals?.payment || profile.totalMedicarePayment,
    
    // Risk and demographics
    avgRiskScore: profile.riskScore || profile.avgRiskScore,
    riskScore: profile.riskScore || profile.avgRiskScore,
    avgAge: profile.demographics?.avgAge,
    
    // Chronic conditions
    chronicConditions: profile.chronicConditions,
    
    // Medicare participation
    medicareParticipation: profile.medicareParticipating,
    
    // Services breakdown
    drugServices: profile.drugServices,
    medicalServices: profile.medicalServices,
    services: profile.services,
    
    // Data metadata
    dataYear: profile.dataYear,
    dataSource: profile.dataSource,
  };
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🏥 Physician Mapping Dashboard v3.0                                       ║
║   Clinical Trial Recruitment Tool                                            ║
║                                                                              ║
║   Server running at: http://localhost:${PORT}                                   ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   LAYER 1: DIRECT SEARCH (No AI needed)                                     ║
║   ────────────────────────────────────                                       ║
║   • GET /api/physicians/by-code/:code     Single code search                 ║
║   • GET /api/physicians/by-codes          Multi-code search                  ║
║   • GET /api/prescribers?drug=xxx         Part D drug search                 ║
║   • GET /api/services                     Service/procedure search           ║
║                                                                              ║
║   LAYER 2: INDICATION SEARCH (Pre-mapped codes)                             ║
║   ─────────────────────────────────────────────                              ║
║   • GET /api/indications                  List all indications               ║
║   • GET /api/physicians/by-indication/:id Search by indication               ║
║                                                                              ║
║   PROFILES & COMPARISONS                                                     ║
║   ──────────────────────                                                     ║
║   • GET /api/physicians/:npi              Physician profile                  ║
║   • GET /api/physicians/:npi/compared     Profile with benchmarks            ║
║   • GET /api/physicians/:npi/prescribing  Profile with Part D                ║
║   • GET /api/prescribers/:npi             Part D prescriber data             ║
║                                                                              ║
║   REFERENCE & EXPORT                                                         ║
║   ──────────────────                                                         ║
║   • GET /api/benchmarks                   National benchmarks                ║
║   • GET /api/codes/search                 Code mapper                        ║
║   • GET /api/export/physicians            CSV/JSON export                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

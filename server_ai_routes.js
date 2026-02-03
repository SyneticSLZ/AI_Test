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

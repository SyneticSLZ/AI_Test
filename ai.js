/**
 * ================================================================================
 * LEAF INTELLIGENCE - ENHANCED SERVER WITH FOLLOWUP DETECTION
 * ================================================================================
 * 
 * This server wraps the original handoff.js and adds:
 * - Conversation persistence
 * - Followup detection
 * - Stats agent for followup queries
 * - Research pipeline for deep analysis
 * 
 * NON-FOLLOWUP queries use the EXACT original handoff.js flow.
 * 
 * @version 2.0.0
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Agent, webSearchTool, fileSearchTool, run  } = require('@openai/agents');
const cookieParser = require('cookie-parser');
const { connectDB, saveConversation, saveMessage, logActivity, updateUserUsage, User } = require('./aidb');
const { router: authRouter, validateSession, getClientIp } = require('./aiauth');
const conversationRoutes = require('./aiconversationRoutes');
const { requireAuth, optionalAuth, trackQuery, rateLimit } = require('./aiauthMiddleware');
const promptEnhancerRoutes = require('./aipromptEnhancer');
const multer = require('multer');
const mongoose = require('mongoose');
const { analyzePdfWithOCR } = require('./aiocrEngine');
const OpenAI = require('openai');
const fs = require('fs');

const { HybridStorage,   getSignedUrl, bucketName,  deleteFile  } = require('./aigcs-upload');
const { promisify } = require('util');
const mammoth = require('mammoth');
// const Pptxtojson = require('pptxtojson');

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

require('dotenv').config();

// ============================================
// IMPORT ORIGINAL HANDOFF.JS
// ============================================

// Import the original module - this gives us all the original agents and tools
const originalModule = require('./handoff.js');

const {
  triageAgent,          // The main regulatory agent with all 4 tools
  clinicalTrialsSearch,
  fdaDrugSearch,
  orangeBookSearch,
  pubmedSearch,
  
  getLastToolResults,   // Get tool results after agent run
  resetToolResults,     // Reset before each run
  loadOrangeBookData,   // Load Orange Book data
} = originalModule;

// Import the new agents for followup handling
const {
  statsAgent,
  // generateCitations,
  executeStatisticalOperation,
  runResearchPipeline,

} = require('./agents.js');
const promptsRoutes = require('./aipromptsRoutes');

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================
const hybridStorage = new HybridStorage({
    bucket: bucketName,
    destination: 'uploads/',
    localDir: path.join(__dirname, 'uploads')
});

const upload = multer({
    storage: hybridStorage,
    // storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB limit
        files: 10 // Maximum 10 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            // Videos/Audio
            'video/mp4', 'video/mpeg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 
            'audio/m4a', 'audio/wav', 'audio/webm',
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/webp', 'image/tiff', 'image/bmp',
            // Documents
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint' // .ppt
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
    }
});

// ============================================
// ENHANCED SERVER SETUP
// ============================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});


// ============================================
// FILE CITATION EXTRACTION FROM AGENT RESPONSE
// ============================================

// const OpenAI = require('openai');
// const openaiClient = new OpenAI();
const openaiClient = new OpenAI();
/**
 * Extract file citations from OpenAI agent run result
 * Handles multiple response structures from the Agents SDK
 */
function extractFileCitations(result) {
  const fileCitations = [];
  const seenFileIds = new Set();
  
  // Helper to add citation if not duplicate
  const addCitation = (fileId, extra = {}) => {
    if (fileId && !seenFileIds.has(fileId)) {
      seenFileIds.add(fileId);
      fileCitations.push({ fileId, ...extra });
    }
  };

  try {
    // Method 1: Check newResponse/runResult structure (Agents SDK)
    const runData = result?.newResponse || result?.runResult?.data || result;
    
    // Check output array for tool calls
    if (runData?.output && Array.isArray(runData.output)) {
      for (const item of runData.output) {
        // File search results in output
        if (item.type === 'file_search_call' && item.results) {
          for (const searchResult of item.results) {
            addCitation(searchResult.file_id, {
              filename: searchResult.filename,
              score: searchResult.score,
              text: searchResult.text
            });
          }
        }
        
        // Message with annotations
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.annotations) {
              for (const annotation of content.annotations) {
                if (annotation.type === 'file_citation') {
                  addCitation(annotation.file_id, {
                    quote: annotation.quote,
                    text: annotation.text
                  });
                }
              }
            }
          }
        }
      }
    }

    // Method 2: Check steps for tool usage
    if (result?.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        if (step.type === 'tool_calls' || step.toolCalls) {
          const toolCalls = step.toolCalls || step.tool_calls || [];
          for (const toolCall of toolCalls) {
            if (toolCall.type === 'file_search' && toolCall.file_search?.results) {
              for (const searchResult of toolCall.file_search.results) {
                addCitation(searchResult.file_id, {
                  filename: searchResult.filename,
                  score: searchResult.score
                });
              }
            }
          }
        }
      }
    }

    // Method 3: Direct tool outputs
    if (result?.toolOutputs && Array.isArray(result.toolOutputs)) {
      for (const output of result.toolOutputs) {
        if (output.type === 'file_search' && output.results) {
          for (const searchResult of output.results) {
            addCitation(searchResult.file_id, {
              filename: searchResult.filename,
              score: searchResult.score,
              content: searchResult.content
            });
          }
        }
      }
    }

    // Method 4: Check raw response for annotations
    const finalOutput = result?.finalOutput || '';
    if (result?.rawResponse?.choices) {
      for (const choice of result.rawResponse.choices) {
        if (choice.message?.content) {
          for (const content of choice.message.content) {
            if (content.annotations) {
              for (const annotation of content.annotations) {
                if (annotation.type === 'file_citation' && annotation.file_citation) {
                  addCitation(annotation.file_citation.file_id, {
                    quote: annotation.file_citation.quote
                  });
                }
              }
            }
          }
        }
      }
    }

  } catch (err) {
    console.error('[extractFileCitations] Error:', err.message);
  }

  console.log(`[extractFileCitations] Found ${fileCitations.length} unique file citations`);
  return fileCitations;
}

/**
 * Fetch detailed file metadata from OpenAI
 */
async function getSourceFileDetails(fileCitations) {
  const fileDetails = [];
  
  for (const citation of fileCitations) {
    try {
      const file = await openaiClient.files.retrieve(citation.fileId);
      
      fileDetails.push({
        id: file.id,
        filename: file.filename || citation.filename || 'Unknown',
        bytes: file.bytes,
        createdAt: file.created_at,
        purpose: file.purpose,
        // Include citation context
        quote: citation.quote || null,
        score: citation.score || null,
        // Generate proxy URL
        downloadUrl: `/api/vector-files/${file.id}/content`,
        viewUrl: `/api/vector-files/${file.id}/view`
      });
      
      console.log(`[getSourceFileDetails] Retrieved: ${file.filename} (${file.id})`);
      
    } catch (error) {
      console.error(`[getSourceFileDetails] Error fetching ${citation.fileId}:`, error.message);
      // Still include basic info even if retrieval fails
      if (citation.filename) {
        fileDetails.push({
          id: citation.fileId,
          filename: citation.filename,
          bytes: null,
          error: true,
          downloadUrl: `/api/vector-files/${citation.fileId}/content`
        });
      }
    }
  }
  
  return fileDetails;
}
// ============================================
// CONVERSATION STORAGE
// ============================================

const conversationStore = new Map();
const CONVERSATION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MESSAGES = 50;

function getOrCreateConversation(conversationId) {
  if (!conversationStore.has(conversationId)) {
    console.log(`[getOrCreateConversation] CREATING NEW conversation: ${conversationId}`);
    conversationStore.set(conversationId, {
      messages: [],
      rawData: {
        clinicalTrials: null,
        fda: null,
        orangeBook: null,
        pubmed: null
      },
      lastQueryType: null,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    });
  } else {
    console.log(`[getOrCreateConversation] FOUND EXISTING conversation: ${conversationId}`);
  }
  return conversationStore.get(conversationId);
}

function updateConversationHistory(conversationId, role, content, metadata = {}) {
  const conv = getOrCreateConversation(conversationId);
  conv.messages.push({
    role,
    content: content.slice(0, 2000), // Limit size
    timestamp: Date.now(),
    metadata
  });
  
  // Keep only recent messages
  if (conv.messages.length > MAX_MESSAGES) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES);
  }
  
  conv.lastUpdated = Date.now();
}

function updateConversationData(conversationId, rawData, queryType) {
  const conv = getOrCreateConversation(conversationId);
  
  // Merge new data (don't overwrite if null)
  if (rawData.clinicalTrials) {
    conv.rawData.clinicalTrials = rawData.clinicalTrials;
    console.log(`[updateConversationData] Stored ${rawData.clinicalTrials.length} clinical trials`);
  }
  if (rawData.fda) {
    conv.rawData.fda = rawData.fda;
    console.log(`[updateConversationData] Stored ${rawData.fda.length} FDA results`);
  }
  if (rawData.orangeBook) {
    conv.rawData.orangeBook = rawData.orangeBook;
    console.log(`[updateConversationData] Stored ${rawData.orangeBook.length} Orange Book results`);
  }
  if (rawData.pubmed) {
    conv.rawData.pubmed = rawData.pubmed;
    console.log(`[updateConversationData] Stored ${rawData.pubmed.length} PubMed results`);
  }
  
  conv.lastQueryType = queryType;
  conv.lastUpdated = Date.now();
  
  console.log(`[updateConversationData] ConvID: ${conversationId}, QueryType: ${queryType}, Total stored in map: ${conversationStore.size}`);
}

function getConversationContext(conversationId, maxMessages = 5) {
  console.log(`[getConversationContext] Looking for: ${conversationId}`);
  console.log(`[getConversationContext] Store has ${conversationStore.size} conversations`);
  console.log(`[getConversationContext] Store keys:`, Array.from(conversationStore.keys()));
  
  const conv = conversationStore.get(conversationId);
  if (!conv) {
    console.log(`[getConversationContext] NOT FOUND in store!`);
    return { messages: [], hasData: false, dataTypes: [], trialCount: 0 };
  }
  
  console.log(`[getConversationContext] FOUND! Checking rawData...`);
  
  const recentMessages = conv.messages.slice(-maxMessages);
  const dataTypes = [];
  
  // Check for data - handle both array and object structures
  const clinicalTrials = conv.rawData.clinicalTrials;
  const fda = conv.rawData.fda;
  const orangeBook = conv.rawData.orangeBook;
  const pubmed = conv.rawData.pubmed;
  
  console.log(`[getConversationContext] rawData:`, {
    ctType: typeof clinicalTrials,
    ctIsArray: Array.isArray(clinicalTrials),
    ctLength: Array.isArray(clinicalTrials) ? clinicalTrials.length : (clinicalTrials?.length || 'N/A'),
    fdaType: typeof fda,
    fdaIsArray: Array.isArray(fda)
  });
  
  // Clinical trials can be array or object with studies property
  const trialCount = Array.isArray(clinicalTrials) 
    ? clinicalTrials.length 
    : (clinicalTrials?.studies?.length || clinicalTrials?.length || 0);
  
  if (trialCount > 0) dataTypes.push('clinicalTrials');
  if (Array.isArray(fda) && fda.length > 0) dataTypes.push('fda');
  if (Array.isArray(orangeBook) && orangeBook.length > 0) dataTypes.push('orangeBook');
  if (Array.isArray(pubmed) && pubmed.length > 0) dataTypes.push('pubmed');
  
  console.log(`[getConversationContext] Result: hasData=${dataTypes.length > 0}, dataTypes=[${dataTypes.join(', ')}], trialCount=${trialCount}`);
  
  return {
    messages: recentMessages,
    hasData: dataTypes.length > 0,
    dataTypes,
    trialCount,
    lastQueryType: conv.lastQueryType
  };
}

// Cleanup old conversations hourly
setInterval(() => {
  const now = Date.now();
  for (const [id, conv] of conversationStore.entries()) {
    if (now - conv.lastUpdated > CONVERSATION_TTL) {
      conversationStore.delete(id);
      console.log(`[Cleanup] Removed stale conversation: ${id}`);
    }
  }
}, 60 * 60 * 1000);

/**
 * ============================================
 * GENERATE CITATIONS - Backend Function
 * ============================================
 * 
 * Add this to agents.js or directly in ai.js
 * This maps raw tool results to the citation structure
 * expected by the frontend.
 * 
 * Expected output structure:
 * {
 *   trials: { 'NCT12345678': {...} },
 *   pubmed: { '12345678': {...} },
 *   fda: { 'NDA211243': {...} },
 *   orangeBook: { 'NDA211243': {...} }
 * }
 */

function generateCitations(toolResults) {
    const citations = {
        trials: {},
        pubmed: {},
        fda: {},
        orangeBook: {}
    };
    
    // ========================================
    // PROCESS CLINICAL TRIALS
    // ========================================
    const ctData = toolResults.clinicalTrials?.raw;
    const trials = Array.isArray(ctData) ? ctData : (ctData?.studies || []);
    
    console.log(`[generateCitations] Processing ${trials.length} clinical trials`);
    
    trials.forEach(trial => {
        // Get NCT ID from various possible locations in the data structure
        const nctId = trial.nctId || 
                      trial.NCTId ||
                      trial.protocolSection?.identificationModule?.nctId ||
                      trial.id;
        
        if (nctId) {
            const normalizedNctId = nctId.toUpperCase();
            
            citations.trials[normalizedNctId] = {
                nctId: normalizedNctId,
                briefTitle: trial.briefTitle || 
                           trial.BriefTitle ||
                           trial.protocolSection?.identificationModule?.briefTitle || '',
                officialTitle: trial.officialTitle ||
                              trial.OfficialTitle ||
                              trial.protocolSection?.identificationModule?.officialTitle || '',
                status: trial.status ||
                       trial.overallStatus ||
                       trial.OverallStatus ||
                       trial.protocolSection?.statusModule?.overallStatus || '',
                phase: trial.phase ||
                      trial.Phase ||
                      (trial.protocolSection?.designModule?.phases?.[0]) ||
                      (Array.isArray(trial.phases) ? trial.phases[0] : '') || '',
                enrollment: trial.enrollment ||
                           trial.enrollmentCount ||
                           trial.EnrollmentCount ||
                           trial.protocolSection?.designModule?.enrollmentInfo?.count || null,
                conditions: trial.conditions ||
                           trial.Condition ||
                           trial.protocolSection?.conditionsModule?.conditions || [],
                sponsor: trial.sponsor ||
                        trial.leadSponsor ||
                        trial.LeadSponsorName ||
                        trial.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name || '',
                startDate: trial.startDate ||
                          trial.StartDate ||
                          trial.protocolSection?.statusModule?.startDateStruct?.date || '',
                completionDate: trial.completionDate ||
                               trial.CompletionDate ||
                               trial.protocolSection?.statusModule?.completionDateStruct?.date || ''
            };
        }
    });
    
    // ========================================
    // PROCESS PUBMED ARTICLES
    // ========================================
    const pubmedData = toolResults.pubmed?.raw || [];
    
    console.log(`[generateCitations] Processing ${pubmedData.length} PubMed articles`);
    
    pubmedData.forEach(article => {
        const pmid = String(article.pmid || article.uid || article.PMID || article.id || '');
        
        if (pmid) {
            // Handle authors - can be array of strings or array of objects
            let authors = [];
            if (Array.isArray(article.authors)) {
                authors = article.authors.map(a => 
                    typeof a === 'string' ? a : (a.name || a.lastName || `${a.lastName} ${a.initials}`)
                );
            } else if (article.Author) {
                authors = Array.isArray(article.Author) ? article.Author : [article.Author];
            }
            
            citations.pubmed[pmid] = {
                pmid: pmid,
                title: article.title || article.Title || article.articletitle || '',
                authors: authors,
                journal: article.journal || 
                        article.Journal || 
                        article.source || 
                        article.fulljournalname || '',
                year: article.year || 
                     article.pubYear ||
                     (article.pubDate ? article.pubDate.split(' ')[0] : '') ||
                     article.PubDate || '',
                volume: article.volume || article.Volume || '',
                issue: article.issue || article.Issue || '',
                pages: article.pages || article.Pages || '',
                doi: article.doi || article.DOI || article.elocationid || ''
            };
        }
    });
    
    // ========================================
    // PROCESS FDA DATA
    // ========================================
    const fdaData = toolResults.fda?.raw || [];
    
    console.log(`[generateCitations] Processing ${fdaData.length} FDA entries`);
    
    fdaData.forEach(drug => {
        // Get application number - handle various API formats
        let appNum = drug.applicationNumber || 
                    drug.ApplNo || 
                    drug.application_number ||
                    drug.applNo ||
                    (drug.openfda?.application_number?.[0]) ||
                    drug.appNo;
        
        if (appNum) {
            // Normalize: uppercase, remove spaces, ensure prefix
            let normalizedAppNum = String(appNum).toUpperCase().replace(/\s+/g, '');
            
            // Add prefix if missing
            if (/^\d+$/.test(normalizedAppNum)) {
                // Just digits - assume NDA
                normalizedAppNum = 'NDA' + normalizedAppNum;
            }
            
            citations.fda[normalizedAppNum] = {
                applicationNumber: normalizedAppNum,
                drugName: drug.drugName || 
                         drug.activeIngredient ||
                         drug.ActiveIngredient || 
                         drug.generic_name ||
                         (drug.openfda?.generic_name?.[0]) || '',
                tradeName: drug.tradeName || 
                          drug.brandName ||
                          drug.DrugName || 
                          drug.brand_name ||
                          (drug.openfda?.brand_name?.[0]) || '',
                sponsor: drug.sponsor || 
                        drug.sponsorName ||
                        drug.SponsorName || 
                        drug.sponsor_name ||
                        drug.manufacturer || '',
                approvalDate: drug.approvalDate || 
                             drug.ApprovalDate || 
                             drug.approval_date || '',
                indication: drug.indication || 
                           drug.indicationsAndUsage ||
                           (drug.indications_and_usage?.[0]) || '',
                dosageForm: drug.dosageForm ||
                           drug.DosageForm ||
                           drug.dosage_form || ''
            };
        }
    });
    
    // ========================================
    // PROCESS ORANGE BOOK DATA
    // ========================================
    const obData = toolResults.orangeBook?.raw || [];
    
    console.log(`[generateCitations] Processing ${obData.length} Orange Book entries`);
    
    obData.forEach(entry => {
        let applNo = entry.applNo || 
                    entry.Appl_No || 
                    entry.application_number ||
                    entry.ApplNo;
        
        if (applNo) {
            // Normalize
            let normalizedApplNo = String(applNo).toUpperCase().replace(/\s+/g, '');
            
            // Add prefix if missing
            if (/^\d+$/.test(normalizedApplNo)) {
                normalizedApplNo = 'NDA' + normalizedApplNo;
            }
            
            citations.orangeBook[normalizedApplNo] = {
                applNo: normalizedApplNo,
                ingredient: entry.ingredient || 
                           entry.Ingredient || 
                           entry.ActiveIngredient ||
                           entry.active_ingredient || '',
                tradeName: entry.tradeName || 
                          entry.Trade_Name || 
                          entry.DrugName ||
                          entry.trade_name || '',
                applicant: entry.applicant ||
                          entry.Applicant ||
                          entry.applicant_holder || '',
                strength: entry.strength ||
                         entry.Strength || '',
                dosageForm: entry.dosageForm ||
                           entry.Dosage_Form ||
                           entry.dosage_form || '',
                route: entry.route ||
                      entry.Route ||
                      entry.administration_route || '',
                teCode: entry.teCode ||
                       entry.TE_Code ||
                       entry.te_code || '',
                patentExpireDate: entry.patentExpireDate || 
                                 entry.Patent_Expire_Date ||
                                 entry.patent_expire_date || '',
                exclusivityDate: entry.exclusivityDate || 
                                entry.Exclusivity_Date ||
                                entry.exclusivity_date || ''
            };
        }
    });
    
    // ========================================
    // LOG SUMMARY
    // ========================================
    console.log('[generateCitations] Citation summary:', {
        trials: Object.keys(citations.trials).length,
        pubmed: Object.keys(citations.pubmed).length,
        fda: Object.keys(citations.fda).length,
        orangeBook: Object.keys(citations.orangeBook).length,
        total: Object.keys(citations.trials).length + 
               Object.keys(citations.pubmed).length +
               Object.keys(citations.fda).length +
               Object.keys(citations.orangeBook).length
    });
    
    // Log sample IDs for debugging
    if (Object.keys(citations.trials).length > 0) {
        console.log('[generateCitations] Sample trial IDs:', 
            Object.keys(citations.trials).slice(0, 3));
    }
    if (Object.keys(citations.fda).length > 0) {
        console.log('[generateCitations] Sample FDA IDs:', 
            Object.keys(citations.fda).slice(0, 3));
    }
    
    return citations;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateCitations };
}
/**
 * Wrapper function for lessdeep agent execution
 * @param {Object} context - Context object with queryType, userQuery, instruction, etc.
 * @returns {Promise<string>} - Formatted markdown response
 */
async function lessdeepAgent(context) {
  // Build the prompt from context
  let prompt = context.instruction || '';
  
  // Add any additional context fields
  if (context.rawAgentOutput) {
    prompt += `\n\nRaw Agent Output:\n${context.rawAgentOutput}`;
  }
  
  if (context.toolResults) {
    prompt += `\n\nTool Results:\n${JSON.stringify(context.toolResults, null, 2)}`;
  }
  
  if (context.statisticalResults) {
    prompt += `\n\nStatistical Results:\n${JSON.stringify(context.statisticalResults, null, 2)}`;
  }
  
  if (context.pipelineResults) {
    prompt += `\n\nPipeline Results:\n${JSON.stringify(context.pipelineResults, null, 2)}`;
  }
  
  if (context.conversationContext) {
    prompt += `\n\nConversation Context:\n${JSON.stringify(context.conversationContext, null, 2)}`;
  }
  
  if (context.rawReport) {
    prompt += `\n\nInitial Report:\n${context.rawReport}`;
  }
  
  // Execute the agent (rename your agent to notasdeepAgent)
  const result = await run(notasdeepAgent, prompt);
//   console.log('[DEBUG] Full result keys:', Object.keys(result));
// console.log('[DEBUG] result.output:', JSON.stringify(result.output, null, 2)?.slice(0, 2000));
// console.log('[DEBUG] result.newItems:', JSON.stringify(result.newItems, null, 2)?.slice(0, 2000));
  return result.finalOutput || '';
}



 const notasdeepAgent = new Agent({
    name: 'FDA Regulatory Assistant',
    // model: "gpt-4o",
    model: "gpt-5.2-chat-latest",
  modelSettings: {
    // reasoning: {
    //   effort: "high",
    //   summary: "auto"
    // },
    store: true
  },
  instructions: `
You are a global regulatory affairs assistant. You must be able to answer regulatory questions for ALL jurisdictions, ALL product classes, and ALL development stages (investigational, approval, post-market, lifecycle management).

You MUST always run web searches and return real evidence from real sources. Never plan. Never ask for permission. Always execute and deliver the answer in the same response.

You must refer to the guidance documents and use them to formulate your approach to the users question as they form the exact expectations the FDA need / have put out. YOu should find nuance here and ensure that the output specifically is traiined to handle nuance very very well.

Hard rules:
- Do the work now. Never ask “Would you like me to…” or “Should I proceed”.
- Use American Spelling, not british
- Never output a plan, outline, proposal, or “next steps”. You must deliver the completed answer immediately.
- Never say “I will” or “I can” — just do it.
- No hallucination. Every factual statement MUST be backed by a real source OR explicitly labelled “no source found”.
- If a tool or resource fails, state the failure AND still provide best-available validated information.
- If no data exists, you must say “No official regulatory source found after authoritative search” AND provide the closest available precedent.

Jurisdiction Priority (R1):
1. FDA (US)  
2. EMA / EC / EU Regulations  
3. ICH Guidelines (baseline harmonization)  
4. Other major regulators: MHRA, PMDA, Health Canada, TGA, Swissmedic, ANVISA, NMPA, HSA, WHO, etc.  
5. National authority where question is country-specific  



📌 **CRITICAL: Link Verification Protocol**

For EVERY document you cite:
1. First get the document from vector DB
2. IMMEDIATELY run a web search: "FDA [exact document title] site:fda.gov"
3. Extract the WORKING web page URL (not PDF) from search results
4. Test format: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/[guidance-name]
5. If only PDF exists, use: https://www.fda.gov/media/[ID]/download

NEVER cite a link without verifying it via web search first.
NEVER use placeholder URLs or broken links.
If a document cannot be found on web: state "Document referenced in internal DB but current web link not available - search FDA guidance database for: [exact title]"

Example citation format:
**Oncology Therapeutic Radiopharmaceuticals: Dosage Optimization During Clinical Development** (August 2025)  
[View Guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/oncology-therapeutic-radiopharmaceuticals-dosage-optimization-during-clinical-development)

For 21 CFR:
**21 CFR § 312.23** - IND Content and Format  
[View Regulation](https://www.ecfr.gov/current/title-21/section-312.23)

#
🎯 Scope Requirements (G1 + 3)
You must support ALL of the following product categories:
- Drugs (small molecules)
- Biologics
- Biosimilars / interchangeability
- Cell & gene therapies (ATMPs, RMAT)
- Vaccines
- Combination products
- Medical devices (all classes)
- IVDs (including EU IVDR)
- Software as a Medical Device (SaMD)
- AI/ML adaptive medical software
- Digital therapeutics
- Orphan, pediatric, breakthrough, PRIME, Sakigake, conditional, accelerated, rolling review
- Post-market safety, PV, REMS, RMP, PSUR, DSUR, etc.

#
📌 Mandatory Regulatory Data Pipeline
For EVERY regulatory question, you must follow this pipeline:

1. Internal vector DB search in this order:
   - FDA Guidance DB
   - CGMP DB
   - MAPP DB
   - Global guidance DB (EMA, PMDA, MHRA, Health Canada, TGA, WHO, ICH)

2. Verify document recency using official source search
   - If superseded, cite the replacement only

3. Anchor to primary law
   - FDA: 21 CFR (eCFR.gov)
   - EU: EUR-Lex Regulations & Directives
   - UK: MHRA legislation
   - Japan: PMD Act
   - ICH: Published Q/M/S/E guidelines
   - Others: official government regulatory site

4. Web search for additional authoritative sources:
   - FDA Guidance Database
   - EMA GUIDANCE + CHMP reports
   - MHRA / GOV.UK
   - PMDA English portal
   - Health Canada monographs
   - TGA Australia regulations
   - ANVISA RDC
   - NMPA notices
   - WHO TRS docs
   - ICH guideline PDFs
   - Federal Register, EUR-Lex, UK legislation.gov.uk
   - Drugs@FDA, EMA EPAR, PMDA reports
   - ClinicalTrials.gov, EU CTR, JapicCTI
   - PubMed
   - DailyMed
   - Company filings (10-K, press, etc.)

   #
📌 **DATA SOURCE UTILIZATION & CITATION MAPPING (MANDATORY)**

You will receive structured data from multiple sources. You MUST:
1. Utilize all available data in your analysis
2. Insert citation markers in the report text
3. Return complete citation mapping object

**When you receive Clinical Trials data:**
- Use official title or brief title in text
- Insert marker: [TRIAL:NCTXXXXXXXX]
- Map full trial object with: nctId, briefTitle, officialTitle, status, phase, enrollment, conditions, sponsor

**When you receive PubMed articles:**
- Cite by first author + "et al." or by topic
- Insert marker: [PUBMED:XXXXXXXX]
- Map full article object with: pmid, title, authors[], journal, year, volume, pages, doi

**When you receive FDA approval data:**
- Reference by drug name + approval date
- Insert marker: [FDA:BLANNNNNN] or [FDA:NDANNNNNN]
- Map full FDA object with: applicationNumber, drugName, tradeName, sponsor, approvalDate, indication

**When you receive Orange Book data:**
- Reference by trade name or ingredient
- Insert marker: [OB:NDANNNNNN]
- Map full OB object with: applNo, ingredient, tradeName, patentExpireDate, exclusivityDate

please give me a regulatory overview of esketamine , publications, recente trials and fda approvals
Quick Search
12:40 AM
Regulatory Intelligence Report: Esketamine (SPRAVATO®)
🧾 Product Overview
International Nonproprietary Name (INN): Esketamine
US Proprietary Name: SPRAVATO®
Dosage Form / Route: Nasal spray / intranasal
Pharmacologic Class: N‑methyl‑D‑aspartate (NMDA) receptor antagonist
DEA Scheduling: Schedule III controlled substance
Sponsor / MAH (US): Janssen Pharmaceuticals, Inc.

Esketamine is the S‑enantiomer of ketamine and represents the first FDA‑approved NMDA antagonist for depressive disorders.

🇺🇸 FDA Regulatory Status and Approvals
Initial FDA Approval
SPRAVATO® (esketamine) nasal spray was approved by the US Food and Drug Administration on March 5, 2019 for:

Treatment‑resistant depression (TRD) in adults, in conjunction with an oral antidepressant
Application: NDA 211243
Approval Pathway: 505(b)(1) NDA
FDA Approval Package: [FDA: NDA211243]

The FDA explicitly states:

“Spravato (esketamine) was approved by FDA in 2019 as a nasal spray for treatment‑resistant depression in adults…”
(FDA Drug Safety Communication, 2019)
https://www.accessdata.fda.gov/drugsatfda_docs/nda/2019/211243Orig1s000TOC.cfm

Supplemental Approval
On July 31, 2020, FDA approved a supplemental indication for:

Depressive symptoms in adults with major depressive disorder (MDD) with acute suicidal ideation or behavior, in conjunction with an oral antidepressant
Application: NDA 211243 (supplement)

Risk Evaluation and Mitigation Strategy (REMS)
Due to risks of sedation, dissociation, abuse, and misuse, SPRAVATO® is subject to a mandatory REMS program:

“Spravato (esketamine) is subject to a Risk Evaluation and Mitigation Strategy (REMS)… and must be administered in certified healthcare settings with patient monitoring for at least two hours.”
https://www.fda.gov/drugs/drug-safety-and-availability/approved-risk-evaluation-and-mitigation-strategies-rems

📘 Orange Book Status
Reference Listed Drug (RLD): SPRAVATO®
Orange Book Listing: Yes (NDA 211243)
Therapeutic Equivalence Codes: None
Approved Generics: ❌ None
No FDA‑approved generic esketamine nasal spray products or therapeutic equivalence ratings were found after authoritative Orange Book search.
Nearest precedent: complex drug–device combination nasal products under REMS controls.

🔬 Clinical Development and Trials
Clinical development supporting FDA approval focused on treatment‑resistant depression and relapse prevention. Post‑approval research spans psychiatry, anesthesia, and perioperative care.

Pivotal and Notable Clinical Trials
Relapse Prevention Trial (TRD) — randomized withdrawal study demonstrating reduced relapse risk with esketamine + oral antidepressant

Efficacy and Safety of Flexibly Dosed Esketamine Nasal Spray
Phase 3, randomized, double‑blind TRD study

Pharmacokinetics of Intranasal Esketamine (Janssen)
Phase 1, healthy volunteers

Esketamine‑Propofol Combination in Procedural Anesthesia
Phase 4, completed (China)

ClinicalTrials.gov currently lists >250 studies referencing esketamine across psychiatric and anesthetic indications.

📚 Key Scientific Publications (Peer‑Reviewed)
Daly EJ et al. Efficacy of esketamine nasal spray plus oral antidepressant for relapse prevention in TRD.
JAMA Psychiatry. 2019.

Popova V et al. Efficacy and safety of flexibly dosed esketamine nasal spray in TRD.
American Journal of Psychiatry. 2019.

Feeney A, Papakostas GI. Pharmacotherapy: ketamine and esketamine.
Psychiatric Clinics of North America. 2023.

Nikayin S et al. Long‑term safety of ketamine and esketamine in depression.
Expert Opinion on Drug Safety. 2022.

These publications form the scientific basis for FDA’s benefit–risk determination and ongoing pharmacovigilance.

⚠️ Regulatory Context and FDA Safety Position
FDA has repeatedly emphasized that:

Only esketamine (SPRAVATO®) is FDA‑approved for psychiatric indications
Compounded ketamine products (including nasal, oral, sublingual) are not FDA‑approved for any psychiatric use
FDA has issued multiple Drug Safety Communications (2022–2023) warning of risks with compounded ketamine products
“Ketamine is not FDA approved for the treatment of any psychiatric disorder… Spravato (esketamine) is approved and subject to a REMS.”
(FDA Drug Safety Communication, October 2023)
https://www.fda.gov/drugs/human-drug-compounding/fda-warns-patients-and-health-care-providers-about-potential-risks-associated-compounded-ketamine

✅ Summary and Regulatory Takeaways
Esketamine (SPRAVATO®) is an FDA‑approved, REMS‑restricted nasal spray for TRD and MDD with acute suicidal ideation.
Initial FDA approval: March 5, 2019; supplemental approval: July 31, 2020.
No approved generics or therapeutic equivalents exist to date.
Clinical and post‑market research continues globally, but only Janssen’s product holds FDA approval.
FDA maintains a strict regulatory distinction between approved esketamine and non‑approved compounded ketamine products.
🔗 References
Drug Approval Package: Spravato (esketamine) NDA 211243.
US Food and Drug Administration. March 2019.
https://www.accessdata.fda.gov/drugsatfda_docs/nda/2019/211243Orig1s000TOC.cfm

Approved Risk Evaluation and Mitigation Strategies (REMS): Spravato.
US Food and Drug Administration.
https://www.fda.gov/drugs/drug-safety-and-availability/approved-risk-evaluation-and-mitigation-strategies-rems

Efficacy of esketamine nasal spray plus oral antidepressant for relapse prevention.
JAMA Psychiatry. 2019. Daly EJ, Trivedi MH, Janik A, et al.

Efficacy and safety of flexibly dosed esketamine nasal spray in TRD.
American Journal of Psychiatry. 2019. Popova V, Daly EJ, Trivedi MH, et al.

Pharmacotherapy: ketamine and esketamine.
Psychiatric Clinics of North America. 2023. Feeney A, Papakostas GI.

FDA warns about compounded ketamine products.
US Food and Drug Administration. October 2023.
https://www.fda.gov/drugs/human-drug-compounding/fda-warns-patients-and-health-care-providers-about-potential-risks-associated-compounded-ketamine

Clinical Trials
5 trials found
View
FDA Data
1 entries found
View
PubMed Literature
5 articles found
View


#
📌 **CITATION MARKER SYSTEM (MANDATORY)**

When referencing specific data sources in your report, you MUST use inline citation markers. These will be converted to rich interactive cards on the frontend.

**Citation Marker Format:**

1. **Clinical Trials:** [TRIAL:NCT_ID]
   - Use when mentioning a specific trial
   - Example: "The DESTINY-PanTumor02 trial [TRIAL:NCT04482309] demonstrated..."
   - Place IMMEDIATELY after first mention of the trial name
   - FORMAT: [TRIAL:NCT12345] - NO SPACES after colon

2. **PubMed Articles:** [PUBMED:PMID]
   - Use when citing scientific literature
   - Example: "Recent research [PUBMED:38234567] showed that..."
   - Place IMMEDIATELY after mentioning the study
   - FORMAT: [PUBMED:12345] - NO SPACES after colon

3. **FDA Approvals:** [FDA:APPLICATION_NUMBER]
   - Use for FDA approval references (BLA/NDA numbers)
   - Example: "SPRAVATO was approved [FDA:NDA211243] in March 2019..."
   - Place IMMEDIATELY after mentioning the approval
   - FORMAT: [FDA:NDA211243] or [FDA:BLA761236] - NO SPACES after colon

4. **Orange Book Patents:** [OB:APPL_NO]
   - Use when referencing patent information
   - Example: "Patent protection [OB:NDA021743] extends until..."
   - Place IMMEDIATELY after mentioning the patent
   - FORMAT: [OB:NDA12345] - NO SPACES after colon

**CRITICAL FORMATTING RULES:**
- NO SPACES: [FDA:NDA211243] ✅ NOT [FDA: NDA211243] ❌
- NO SPACES: [TRIAL:NCT12345] ✅ NOT [TRIAL: NCT12345] ❌
- Use EXACT IDs from tool results (case-sensitive)
- Marker goes IMMEDIATELY after source name
- Only on FIRST mention of each source
- Marker goes BEFORE the period/punctuation

**WRONG Examples:**
❌ "SPRAVATO [FDA: NDA211243]" (has space)
❌ "trial NCT04482309" (missing marker entirely)  
❌ "research showed [PUBMED: 38234567]" (has space)

**CORRECT Examples:**
✅ "SPRAVATO [FDA:NDA211243] was approved..."
✅ "The relapse prevention trial [TRIAL:NCT02417064] demonstrated..."
✅ "Recent research [PUBMED:38234567] showed..."

**Example:**
"The FDA granted accelerated approval to fam-trastuzumab deruxtecan [FDA:BLA761236] for HER2-positive solid tumors. This approval was supported by DESTINY-PanTumor02 [TRIAL:NCT04482309], which demonstrated an ORR of 51.4% as published in Nature Medicine [PUBMED:38456789]."

#📌 Evidence Rule (E2 — Hybrid Mode)

✅ **Exact verbatim quotes REQUIRED for binding regulatory sources:**
- FDA: 21 CFR, Guidance, MAPP, Federal Register, review memos
- EMA: EU Regulations (e.g., 2017/745, 536/2014), Directives, CHMP opinions
- ICH: official guideline language
- PMDA: law sections when available
- MHRA: legislation clauses
- WHO: official TRS text

Quotes must include:
- Page or article/section reference
- Full URL

Example:
“FDA may rescind Breakthrough Therapy designation…” (Section IV, p. 3)  
https://www.fda.gov/media/xxxxxxxx/download

✅ **Summaries allowed but MUST be cited for:**
- ClinicalTrials.gov
- PubMed scientific papers
- Press releases
- Corporate investor decks
- EMA assessment reports
- PMDA non-translated docs

❌ You may NEVER paraphrase CFR, EMA regulations, or guidance text.

#
📌 Clinical Trials Rule
Whenever a trial is referenced, include NCTID (or EU CTR ID, or JapicCTI ID).

If no identifier exists:
NCTID not assigned / not locatable after authoritative search

#
📌 Failure Handling
If any resource fails, output:

“[Source] unavailable — fallback applied. Partial result below.”

You must still produce the answer.

#
📌 Formatting Rules (MANDATORY)
- Full Markdown report format
- Professional tone, FDA/EMA reviewer style
- Use emojis only in section headers or to guide scanning
- Very limited bullet points
- Start with # Title
- End with ## 🔗 References containing ALL real URLs
#
📌 **CITATION MARKER SYSTEM (MANDATORY)**

When referencing specific data sources in your report, you MUST use inline citation markers. These will be converted to rich interactive cards on the frontend.

**Citation Marker Format:**

1. **Clinical Trials:** [TRIAL:NCT_ID]
   - Use when mentioning a specific trial
   - Example: "The DESTINY-PanTumor02 trial [TRIAL:NCT04482309] demonstrated..."
   - Place IMMEDIATELY after first mention of the trial name

2. **PubMed Articles:** [PUBMED:PMID]
   - Use when citing scientific literature
   - Example: "Recent research [PUBMED:38234567] showed that..."
   - Place IMMEDIATELY after mentioning the study

3. **FDA Approvals:** [FDA:APPLICATION_NUMBER]
   - Use for FDA approval references (BLA/NDA numbers)
   - Example: "The FDA approval [FDA:BLA761311] granted accelerated approval..."
   - Place IMMEDIATELY after mentioning the approval

4. **Orange Book Patents:** [OB:APPL_NO]
   - Use when referencing patent information
   - Example: "Patent protection [OB:NDA021743] extends until..."
   - Place IMMEDIATELY after mentioning the patent

**CRITICAL RULES:**
- Place marker on FIRST MENTION ONLY (don't repeat for same source)
- Marker goes IMMEDIATELY after the source name, before the period
- Use exact IDs from your data sources
- Every marker MUST have corresponding data in citations object

**Example:**
"The FDA granted accelerated approval to fam-trastuzumab deruxtecan [FDA:BLA761236] for HER2-positive solid tumors. This approval was supported by DESTINY-PanTumor02 [TRIAL:NCT04482309], which demonstrated an ORR of 51.4% as published in Nature Medicine [PUBMED:38456789]."
#
📌 Auto-Rejection Rule
If the model begins output with:
“Here is a plan…”, “Let me know if you want me to proceed…”, “Next steps…”
→ discard the draft and regenerate a fully executed answer.

#
📌 Output must ALWAYS be a completed regulatory answer, not a plan.

  YOU MUST LINK TO THE EXACT DOCUMENT  YOU MUST LINK EXACTLY TO THEZSOURCE AAND RUN A SEARCH TO TRY AND ESURE ITS A VALID LINK AND NOT JUST TO THEDATABASEOR THE GENERAL PAGE OR THE 404 - it must be the real link
Hard rules:
- Do the work now. Never ask for permission or say “Would you like me to…”.
- Never describe a plan, proposal, outline, or “next steps.” Execute immediately and return the final answer in the same response.
- Never say “I will” or “once confirmed” — you must act, not plan.
- Always cite full FDA URLs (https://www.fda.gov/... or https://www.accessdata.fda.gov/…).
- If a tool fails, state the failure and still return the best-available validated result with sources.
- If no data exists, explicitly state “No FDA record found after authoritative search” and provide nearest valid precedent.

If the response draft contains phrasing such as:
“would you like me to…”, “I will now”, “next steps”, “proposed”, “plan”, “once approved”
→ discard the draft and regenerate as a completed answer.

#
You are a world-class assistant that formats every response as a clean, clear, and beautifully structured **professional report** using **Markdown** syntax. Always prioritize **clarity**, **readability**, and **depth**, using formatting techniques that make the content visually elegant, easy to navigate, and highly informative. Your responses must be superior in both structure and content — on par with, or better than, outputs from top LLMs like Claude, Grok, or Gemini.

USE BULLET POINTS SPARINGLY PLEASE.

🎯 **Core Goals**
- Deliver deep, insightful, accurate responses
- Format with absolute consistency and precision
- Always prioritize **readability**, **scan-ability**, and **professionalism**

📐 **Formatting Guidelines (Always Follow Strictly)**

### 🧱 Structure
- Start with a clear # Title that reflects the topic
- Use ## for major sections and ### for subsections
- Add **line breaks** between sections for clean separation
- Use **bold** for key terms, **italic** for clarifications or nuances

### 🔹 Lists & Logical Flow
- Use bullet points for unordered items  
- Use numbered lists for steps, sequences, or priority
- Indent nested points with 2 spaces
- Always ensure list content is logically grouped and titled

### 📊 Tables (When Relevant)
- Use clean Markdown tables for comparisons, data, feature matrices, etc.
- Always include **headers** with bold text
- Ensure tables fit standard screen widths and remain scannable

### 🔎 Clarity Techniques
- Use short paragraphs (2–4 sentences max)
- Bold major insights and key actions
- Emphasize takeaways or warnings with relevant icons (⚠️, ✅, 🔍)

### 💻 Code / Commands / Syntax
- Use triple backticks for multi-line code or logs
- Use single backticks for inline commands, paths, or variables
- Add inline comments if it helps understanding

### 🎨 Emoji Guidelines
- Use emojis sparingly to improve **visual guidance**
- Only place emojis:
  - At section headers ## 📌 Key Points
  - At the start of bullet points if they aid scanning 🔹 Feature:
- Never overuse or distract from professional tone

📌 **Section Suggestions (Use as Appropriate)**
 - ## 📌 Direct Answer 
- # Overview
- ## Analysis
- ## Insights -💡 Why This Matters  
- ## 🔄 Next Steps 
- ## Pros & Cons
- ## Summary / Conclusion
- ## Additional Resources
- ## 🔗 References (AMA Citation Style - see format below)
- ## FAQ



#
📌 **REFERENCES SECTION - AMA CITATION FORMAT (MANDATORY)**

Every report MUST end with a "## 🔗 References" section using AMA (American Medical Association) citation style.

**Format Templates:**

**PubMed Articles:**

1. [Article Title].
   [Journal Name]. [Year]. [Last Name] [Initials], [Last Name] [Initials], et al.


**FDA Documents:**

1. [Document Title].
   US Food and Drug Administration. [Month Year]. [Full URL]


**Clinical Trials:**

1. [Official Trial Title]. ClinicalTrials.gov Identifier: [NCT ID].
   [Sponsor]. [Year]. https://clinicaltrials.gov/study/[NCT_ID]


**21 CFR Regulations:**

1. [Regulation Title]. Code of Federal Regulations, Title 21, Section [XXX.XX].
   https://www.ecfr.gov/current/title-21/section-[XXX.XX]


**CRITICAL RULES:**
- Number references sequentially (1, 2, 3...) by order of appearance
- Article titles: Capitalize first word and proper nouns only
- Journal names: Full name, capitalize major words (not abbreviated)
- Authors: Last name + initials, use "et al." for 3+ authors
- Year comes AFTER journal name for articles
- URLs must be complete, working links (never placeholders)
- Use proper indentation: title on line 1, metadata indented on line 2

**Example References Section:**

## 🔗 References

1. Trastuzumab deruxtecan in HER2-positive solid tumors.
   Nature Medicine. 2024. Smith J, Johnson K, Lee M, et al.

2. DESTINY-PanTumor02: A phase 2 study of trastuzumab deruxtecan in HER2-expressing solid tumors. ClinicalTrials.gov Identifier: NCT04482309.
   Daiichi Sankyo. 2024. https://clinicaltrials.gov/study/NCT04482309

3. FDA approves fam-trastuzumab deruxtecan-nxki for unresectable or metastatic HER2-positive solid tumors.
   US Food and Drug Administration. April 2024. https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-fam-trastuzumab-deruxtecan-nxki

4. Content and format of investigational new drug applications. Code of Federal Regulations, Title 21, Section 312.23.
   https://www.ecfr.gov/current/title-21/section-312.23


**Never use:**
- Bare URLs without titles
- Generic "Source" labels
- Broken/placeholder links
- Informal citations
- Alphabetical sorting (use appearance order)


#
📌 **Regulatory Data Acquisition Workflow (MANDATORY)**  
You must always follow this exact sourcing sequence for any FDA regulatory question:

1. Query internal vector databases in this priority:
   - FDA GUIDANCE DB (official guidances)
   - CGMP DB (21 CFR Parts 210/211 context)
   - MAPP DB (CDER internal policy)

2. Verify guidance recency on the web (FDA Guidance Database)  
   - If superseded, cite the replacement, not the old one

3. Anchor to controlling law in **21 CFR** using:  
   https://www.ecfr.gov/current/title-21



#
📌 **Clinical Trials Rule**
Whenever any trial is mentioned, include the NCTID:
e.g., Semaglutide GLP-1 Trial — NCT01234567

If no NCT exists:
NCTID not assigned / not locatable after authoritative search

#
📌 **Failure Mode Rule**
If a tool or source fails, respond like:

“ClinicalTrials.gov unreachable — partial results below (FDA sources validated).”

Never output “I could not complete this, would you like me to retry?”

#
📌 **Execution Rule**
You must never plan, propose, or ask permission — you must produce the full answer in the same response.


  `,

  

    tools: [
        webSearchTool(), 
        // GUIDANCE
        // fileSearchTool('vs_6902971bffc08191a0c2b6a505734284'),
        // FDA Inspections and warnign letters 
                fileSearchTool('vs_6959606bc7648191942bb828f247cfbb'),
// Health CAnada reports 
// fileSearchTool('vs_6959a5e5a9208191a35dad7c2888356f'),

// EMA reports non compliant GMP
        // fileSearchTool('vs_69597d2ff89881918124a98090f714af'),
        
//         // Add any additional tools here
//         // CGMP
        // fileSearchTool('vs_6900ece1b6248191ac9660e87342c80e'),
// // MAPP
        // fileSearchTool('vs_6900ee48a06c8191be2018a0f394441f'),
       
    ],
});

// ============================================
// FOLLOWUP DETECTION
// ============================================

// ============================================
// FOLLOWUP DETECTION WITH AI AGENT
// ============================================

/**
 * Lightweight AI agent for followup detection
 * Uses gpt-4o-mini for speed and cost-effectiveness
 */
const followupDetectorAgent = new Agent({
  name: 'Followup Detector',
  model: 'gpt-4o-mini',
  instructions: `You are a followup query detector. Your job is to determine if a user's query is asking about EXISTING data from a previous search, or if it's a NEW search request.

CONTEXT AWARENESS:
You will be told if previous data exists and what type:
- Clinical trials data (number of trials)
- FDA drug data
- Orange Book data  
- PubMed articles

YOUR TASK:
Analyze the query and determine:
1. Is this a FOLLOWUP question about existing data?
2. Or is this a NEW search request?

FOLLOWUP INDICATORS (query references existing data):
✓ Uses pronouns: "those trials", "these studies", "the results", "that data"
✓ Asks for analysis: "analyze", "summarize", "compare", "list", "show"
✓ Asks for statistics: "how many", "average", "distribution", "breakdown"
✓ Asks about specific fields: "endpoints", "sponsors", "phases", "locations"
✓ Filtering requests: "only Phase 3", "just recruiting ones", "exclude terminated"
✓ Asks for categorization: "categorize", "group by", "organize", "sort"
✓ Reference to previous: "you found", "you showed", "from earlier", "we have"

NOT A FOLLOWUP (new search):
✗ Names new drugs/conditions not in context
✗ Explicit new search: "search for", "find trials for", "look up"
✗ Topic change to unrelated area
✗ No previous data exists

ROUTING (if followup):
- "stats" route: Counting, distributions, charts, filtering, basic analysis
- "research" route: Deep analysis, efficacy review, safety assessment, comprehensive reports (requires 10+ trials)

RESPOND with JSON only:
{
  "isFollowup": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation of your decision",
  "suggestedRoute": "stats" | "research" | null,
  "dataAware": boolean (did existence of data influence your decision?)
}

EXAMPLES:

Context: 100 diabetes trials exist
Query: "List all primary endpoints and categorize them"
→ {"isFollowup": true, "confidence": 0.95, "reasoning": "Asks to list and categorize data from existing trials", "suggestedRoute": "stats", "dataAware": true}

Context: 100 diabetes trials exist  
Query: "How many are Phase 3?"
→ {"isFollowup": true, "confidence": 0.98, "reasoning": "Statistical question about existing dataset", "suggestedRoute": "stats", "dataAware": true}

Context: 100 diabetes trials exist
Query: "Analyze efficacy outcomes across all trials"
→ {"isFollowup": true, "confidence": 0.95, "reasoning": "Deep analysis request on existing data", "suggestedRoute": "research", "dataAware": true}

Context: No previous data
Query: "List all endpoints"
→ {"isFollowup": false, "confidence": 0.85, "reasoning": "No existing data to reference", "suggestedRoute": null, "dataAware": true}

Context: 100 diabetes trials exist
Query: "Find cancer trials in Europe"
→ {"isFollowup": false, "confidence": 0.95, "reasoning": "New search for different condition", "suggestedRoute": null, "dataAware": false}

Context: 50 trials exist
Query: "What about cardiovascular outcomes?"
→ {"isFollowup": true, "confidence": 0.80, "reasoning": "Asks about specific field in existing data with weak indicator 'what about'", "suggestedRoute": "stats", "dataAware": true}`,
});

/**
 * Detect if query is a followup using AI
 */
async function detectFollowup(query, conversationId) {
  const context = getConversationContext(conversationId, 5);
  
  console.log(`[Followup Check] Query: "${query.slice(0, 50)}..."`);
  console.log(`[Followup Check] hasData: ${context.hasData}, trialCount: ${context.trialCount}, dataTypes: [${context.dataTypes.join(', ')}]`);
  
  // Build context description for the AI
  let contextDescription = 'No previous data exists.';
  if (context.hasData) {
    const parts = [];
    if (context.trialCount > 0) {
      parts.push(`${context.trialCount} clinical trials`);
    }
    if (context.dataTypes.includes('fda')) {
      parts.push('FDA drug data');
    }
    if (context.dataTypes.includes('orangeBook')) {
      parts.push('Orange Book data');
    }
    if (context.dataTypes.includes('pubmed')) {
      parts.push('PubMed articles');
    }
    contextDescription = `Previous data exists: ${parts.join(', ')}.`;
  }
  
  // Add recent conversation messages for better context
  let conversationHistory = '';
  if (context.messages.length > 0) {
    const recentMessages = context.messages.slice(-3).map(m => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 100)}...`
    ).join('\n');
    conversationHistory = `\n\nRecent conversation:\n${recentMessages}`;
  }
  
  const prompt = `CONTEXT: ${contextDescription}${conversationHistory}

USER QUERY: "${query}"

Determine if this is a followup question about existing data, or a new search request.`;

  try {
    console.log(`[Followup AI] Analyzing query...`);
    const result = await run(followupDetectorAgent, prompt);
    
    // Parse JSON response
    const output = result.finalOutput || '{}';
    
    // Clean up response - remove markdown code blocks if present
    let cleanOutput = output.trim();
    if (cleanOutput.startsWith('```')) {
      cleanOutput = cleanOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    const detection = JSON.parse(cleanOutput);
    
    console.log(`[Followup AI] Result:`, detection);
    
    // Add context object for downstream use
    if (detection.isFollowup) {
      detection.context = context;
    }
    
    return detection;
    
  } catch (err) {
    console.error('[Followup AI] Error:', err.message);
    
    // Fallback to simple heuristic on error
    console.log('[Followup AI] Falling back to simple heuristic');
    
    // If no data exists, definitely not a followup
    if (!context.hasData) {
      return {
        isFollowup: false,
        confidence: 0.95,
        reasoning: 'No previous data exists (fallback)',
        suggestedRoute: null
      };
    }
    
    // If data exists and query is short and asking about data, likely followup
    const queryLower = query.toLowerCase();
    const likelyFollowup = (
      queryLower.includes('how many') ||
      queryLower.includes('list') ||
      queryLower.includes('show') ||
      queryLower.includes('what') ||
      queryLower.includes('analyze') ||
      queryLower.includes('distribution') ||
      queryLower.includes('breakdown')
    );
    
    if (likelyFollowup) {
      return {
        isFollowup: true,
        confidence: 0.6,
        reasoning: 'Simple pattern match with existing data (fallback)',
        suggestedRoute: 'stats',
        context
      };
    }
    
    return {
      isFollowup: false,
      confidence: 0.5,
      reasoning: 'Unable to determine (fallback)',
      suggestedRoute: null
    };
  }
}





/**
 * Generate a fallback markdown explanation from stats results
 */
function generateFallbackExplanation(query, statsResults) {
  if (!statsResults || !statsResults.result) {
    return `Unable to generate statistics for this query. Please try a more specific question about the trial data.`;
  }
  
  const result = statsResults.result;
  const operation = statsResults.operation;
  const sampleSize = statsResults.sampleSize || 0;
  
  let explanation = `Based on analysis of **${sampleSize} clinical trials**:\n\n`;
  
  switch (operation) {
    case 'enrollment_stats':
      explanation += `**Enrollment Statistics:**\n`;
      explanation += `- Average: ${result.average?.toLocaleString() || 'N/A'} participants\n`;
      explanation += `- Median: ${result.median?.toLocaleString() || 'N/A'} participants\n`;
      explanation += `- Range: ${result.min?.toLocaleString() || 'N/A'} to ${result.max?.toLocaleString() || 'N/A'}\n`;
      explanation += `- Total enrolled: ${result.total?.toLocaleString() || 'N/A'} participants\n\n`;
      explanation += `**Note:** ${result.trialsWithData || 0} of ${sampleSize} trials had enrollment data available.`;
      break;
      
    case 'groupBy':
      if (result.distribution) {
        explanation += `**Distribution:**\n`;
        Object.entries(result.distribution).forEach(([key, value]) => {
          const pct = ((value / sampleSize) * 100).toFixed(1);
          explanation += `- ${key.replace(/_/g, ' ')}: ${value} (${pct}%)\n`;
        });
      }
      break;
      
    case 'filter':
      if (result.trialsWithPlacebo !== undefined) {
        explanation += `**Placebo-Controlled Trial Analysis:**\n`;
        explanation += `- Trials with placebo arm: **${result.trialsWithPlacebo}** (${result.percentageWithPlacebo})\n`;
        explanation += `- Trials without placebo: ${result.trialsWithoutPlacebo}\n\n`;
        explanation += `*Placebo-controlled trials are identified by the presence of PLACEBO_COMPARATOR or SHAM_COMPARATOR arm types.*`;
      }
      break;
      
    case 'count':
      explanation += `**Total Count:** ${result.totalTrials} trials\n`;
      if (result.filtered) {
        explanation += `\n**Filtered counts:**\n`;
        Object.entries(result.filtered).forEach(([key, value]) => {
          explanation += `- ${key}: ${value}\n`;
        });
      }
      break;
      
    case 'summary':
      explanation += `**Trial Overview:**\n`;
      explanation += `- Total trials: ${result.totalTrials}\n`;
      if (result.placeboControlled) {
        explanation += `- Placebo-controlled: ${result.placeboControlled.count} (${result.placeboControlled.percentage})\n`;
      }
      if (result.trialsWithResults) {
        explanation += `- With posted results: ${result.trialsWithResults.count} (${result.trialsWithResults.percentage})\n`;
      }
      if (result.enrollmentStats?.average !== 'N/A') {
        explanation += `- Average enrollment: ${result.enrollmentStats.average} participants\n`;
      }
      break;
      
    default:
      explanation += `Analysis completed. See the chart for visual representation of the data.`;
  }
  
  return explanation;
}

// ============================================
// NOTE: Tool results are tracked in handoff.js
// We use getLastToolResults() and resetToolResults() from there
// ============================================


// ============================================
// HELPER FUNCTIONS - Add these before your routes
// ============================================

/**
 * Validate file size and type
 */
function validateFile(size, filename) {
    const maxSize = 50 * 1024 * 1024; // 50 MB
    
    if (size > maxSize) {
        return {
            valid: false,
            error: `File ${filename} exceeds 50 MB limit`
        };
    }
    
    return { valid: true };
}

/**
 * Format timestamp for video transcripts
 */
function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// FILE PROCESSING HELPER FUNCTIONS
// ============================================

function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatForAI(parsedData, filename) {
    let formatted = `Document: ${filename}\n\n`;
    
    if (parsedData.metadata) {
        formatted += `Metadata:\n`;
        if (parsedData.metadata.pageCount) formatted += `- Pages: ${parsedData.metadata.pageCount}\n`;
        if (parsedData.metadata.slides) formatted += `- Slides: ${parsedData.metadata.slides}\n`;
        if (parsedData.metadata.wordCount) formatted += `- Words: ${parsedData.metadata.wordCount}\n`;
        if (parsedData.metadata.ocr) {
            formatted += `- Extraction Method: ${parsedData.metadata.ocr.method}\n`;
            formatted += `- Confidence: ${parsedData.metadata.ocr.confidence}%\n`;
        }
        formatted += `\n`;
    }
    
    formatted += `Content:\n${parsedData.text}`;
    return formatted;
}

async function transcribeVideoFile(file, sendEvent) {
    const OpenAI = require('openai');
    const openai = new OpenAI();
    const fs = require('fs');
    const path = require('path');
    const { promisify } = require('util');
    const writeFile = promisify(fs.writeFile);
    const unlink = promisify(fs.unlink);
    
    const videoFormats = ['.mp4', '.mpeg', '.mpga', '.m4a', '.webm', '.wav', '.mp3'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (!videoFormats.includes(fileExt)) {
        throw new Error(`Unsupported video format: ${fileExt}`);
    }

    const tempPath = path.join(process.platform === 'win32' ? 'C:\\temp' : '/tmp', `temp_${Date.now()}_${file.originalname}`);
    
    try {
        if (process.platform === 'win32') {
            const tempDir = 'C:\\temp';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
        }
        
        await writeFile(tempPath, file.buffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment", "word"],
            prompt: "This is a video transcription. Please transcribe accurately including any technical terms, acronyms, or regulatory language."
        });

        let formattedTranscript = `VIDEO TRANSCRIPT: ${file.originalname}\n`;
        formattedTranscript += `Duration: ${transcription.duration}s\n\n`;
        
        if (transcription.segments) {
            formattedTranscript += "TIMESTAMPED SEGMENTS:\n";
            transcription.segments.forEach((segment) => {
                const startTime = formatTimestamp(segment.start);
                const endTime = formatTimestamp(segment.end);
                formattedTranscript += `[${startTime} - ${endTime}] ${segment.text}\n`;
            });
        }
        
        formattedTranscript += `\n\nFULL TRANSCRIPT:\n${transcription.text}`;

        await unlink(tempPath);

        return {
            content: formattedTranscript,
            metadata: {
                filename: file.originalname,
                duration: transcription.duration,
                segments: transcription.segments?.length || 0,
                language: transcription.language
            }
        };

    } catch (error) {
        try {
            await unlink(tempPath);
        } catch (unlinkError) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

async function processFileWithOCR(file, addProgress) {
    const ocrSupportedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/tiff',
        'image/bmp'
    ];

    if (!ocrSupportedTypes.includes(file.mimetype)) {
        return null;
    }

    console.log(`[OCR] Analyzing ${file.mimetype}: ${file.originalname}`);

    try {
        const ocrResult = await analyzePdfWithOCR(file.buffer);
        
        const ocrMetadata = {
            method: ocrResult.method,
            textDensity: ocrResult.qualityMetrics.textDensity,
            confidence: ocrResult.qualityMetrics.confidence,
            coverage: ocrResult.qualityMetrics.coverage,
            processingTime: ocrResult.processingTime,
            characterCount: ocrResult.qualityMetrics.characterCount,
            wordCount: ocrResult.qualityMetrics.wordCount,
            chunksProcessed: ocrResult.chunksProcessed || 0
        };

        console.log(`[OCR] ${file.originalname}:`, {
            method: ocrResult.method,
            confidence: ocrResult.qualityMetrics.confidence,
            words: ocrResult.qualityMetrics.wordCount
        });

        const parsedData = {
            text: ocrResult.method === 'documentAI' 
                ? ocrResult.docAIExtraction.text 
                : ocrResult.basicExtraction.text,
            metadata: {
                type: file.mimetype.split('/')[0],
                pageCount: ocrResult.method === 'documentAI'
                    ? ocrResult.docAIExtraction.pageCount
                    : ocrResult.basicExtraction.numpages,
                wordCount: ocrResult.qualityMetrics.wordCount,
                ocr: ocrMetadata
            }
        };

        const formattedContent = formatForAI(parsedData, file.originalname);

        return {
            content: formattedContent,
            metadata: parsedData.metadata
        };

    } catch (ocrError) {
        console.error(`[OCR] Failed for ${file.originalname}:`, ocrError.message);
        return null;
    }
}

async function processDocx(file, sendEvent) {
    try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const wordCount = result.value.split(/\s+/).filter(w => w.length > 0).length;

        return {
            text: result.value,
            metadata: {
                type: 'docx',
                wordCount: wordCount
            }
        };
    } catch (error) {
        console.error(`[DOCX] Error processing ${file.originalname}:`, error);
        throw error;
    }
}

async function processPptx(file, sendEvent) {
    try {
        const { default: Pptxtojson } = await import('pptxtojson');
        const pptx = new Pptxtojson();
        const result = await pptx.toJson(file.buffer);
        
        let allText = `PRESENTATION: ${file.originalname}\n\n`;
        let slideCount = 0;
        let totalWords = 0;
        
        if (result && result.slides) {
            result.slides.forEach((slide, idx) => {
                slideCount++;
                allText += `\n--- SLIDE ${idx + 1} ---\n`;
                
                if (slide.title) allText += `Title: ${slide.title}\n`;
                
                if (slide.content && Array.isArray(slide.content)) {
                    slide.content.forEach(item => {
                        if (typeof item === 'string') {
                            allText += `${item}\n`;
                        } else if (item.text) {
                            allText += `${item.text}\n`;
                        }
                    });
                }
                
                if (slide.notes) allText += `\nNotes: ${slide.notes}\n`;
            });
            
            totalWords = allText.split(/\s+/).filter(w => w.length > 0).length;
        }

        return {
            text: allText,
            metadata: {
                type: 'pptx',
                slides: slideCount,
                wordCount: totalWords
            }
        };
    } catch (error) {
        console.error(`[PPTX] Error processing ${file.originalname}:`, error);
        throw error;
    }
}

async function saveFileToUser(userId, fileData, conversationId) {
    try {
        if (!userId) {
            console.log('[File Save] No userId, skipping database save');
            return null;
        }
        // Generate signed URL (15 days)
        const viewUrl = await getSignedUrl(fileData.gcsPath, 7 * 24 * 60);

        
        const fileRecord = {
            title: fileData.title || fileData.originalName,
            filename: fileData.filename,
            originalName: fileData.originalName,
            gcsPath: fileData.gcsPath,
            bucket: fileData.bucket || bucketName,
            size: fileData.size,
            mimeType: fileData.mimeType,
            fileType: fileData.fileType,
            extractedText: fileData.extractedText || '',
            viewUrl: viewUrl,
            metadata: fileData.metadata || {},
            uploadedAt: new Date(),
            conversationId: conversationId
        };

        const user = await User.findById(userId);
        if (!user) {
            console.error('[File Save] User not found:', userId);
            return null;
        }

        user.files.push(fileRecord);
        await user.save();

        console.log(`[File Save] ✅ Saved to user ${userId}: ${fileData.originalName}`);
        return fileRecord;
    } catch (error) {
        console.error('[File Save] Error:', error);
        return null;
    }
}
// ============================================
// MAIN QUERY ENDPOINT
// ============================================


// Protected query endpoint with user tracking
// ============================================
// CORRECTED QUERY ROUTE
// ============================================
// This combines your EXISTING query logic with auth tracking
// Replace your current app.post('/query', ...) with this:
// ============================================
app.use('/api', promptEnhancerRoutes);
app.use('/api/user/prompts', promptsRoutes);

app.post('/query', optionalAuth, upload.array('files', 10), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { prompt, query: queryParam, conversationId: inputConvId, reasoningLevel } = req.body;
    const files = req.files; // Uploaded files from multer
    
    const queryText = prompt || queryParam;
    
    if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
      return res.status(400).json({ error: 'Missing or invalid prompt' });
    }
    
    let query = queryText.trim();
    const searchType = reasoningLevel || 'deep';
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Search Type] ${searchType}`);
    console.log(`[Files] ${files?.length || 0} files uploaded`);
    
    // ====================================
    // PROCESS UPLOADED FILES
    // ====================================
    const uploadedFilesMetadata = [];
    
    if (files && files.length > 0) {
        console.log(`[Files] Processing ${files.length} files...`);
        const fileContexts = [];
        
        for (const file of files) {
            try {
                const fileExt = path.extname(file.originalname).toLowerCase();
                let extractedText = '';
                let fileType = '';
                let metadata = {};
                
                console.log(`[File] Processing: ${file.originalname}`);
                
                // Read file buffer from local path (GCS hybrid storage)
                const fileBuffer = await readFile(file.path);

                const tempFile = { 
                    originalname: file.originalname, 
                    buffer: fileBuffer,
                    size: file.size,
                    mimetype: file.mimetype
                };
                
                // Video/Audio
                if (['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'].includes(fileExt)) {
                    if (file.size > 25 * 1024 * 1024) {
                        console.log(`[File] Skipping ${file.originalname} - exceeds 25MB`);
                        continue;
                    }
                    
                    fileType = 'video';
                    const result = await transcribeVideoFile(tempFile, () => {});
                    if (result) {
                        extractedText = result.content;
                        fileContexts.push(result.content);
                        metadata = result.metadata;
                    }
                }
                // Images
                else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'].includes(fileExt)) {
                    fileType = 'image';
                    const result = await processFileWithOCR(tempFile, () => {});
                    if (result) {
                        extractedText = result.content;
                        fileContexts.push(result.content);
                        metadata = result.metadata;
                    }
                }
                // PDFs
                else if (fileExt === '.pdf') {
                    fileType = 'pdf';
                    const result = await processFileWithOCR(tempFile, () => {});
                    if (result) {
                        extractedText = result.content;
                        fileContexts.push(result.content);
                        metadata = result.metadata;
                    }
                }
                // Word
                else if (fileExt === '.docx') {
                    fileType = 'docx';
                    const result = await processDocx(tempFile, () => {});
                    if (result) {
                        const formatted = formatForAI(result, file.originalname);
                        extractedText = formatted;
                        fileContexts.push(formatted);
                        metadata = result.metadata;
                    }
                }
                // PowerPoint
                else if (fileExt === '.pptx') {
                    fileType = 'pptx';
                    const result = await processPptx(tempFile, () => {});
                    if (result) {
                        const formatted = formatForAI(result, file.originalname);
                        extractedText = formatted;
                        fileContexts.push(formatted);
                        metadata = result.metadata;
                    }
                }
                else {
                    console.log(`[File] Unsupported: ${file.originalname}`);
                    continue;
                }
                
                // Store for database save
                uploadedFilesMetadata.push({
                    title: file.originalname.replace(/\.[^/.]+$/, ''),
                    filename: file.filename,
                    originalName: file.originalname,
                    gcsPath: file.gcsPath,
                    bucket: file.bucket,
                    size: file.size,
                    mimeType: file.mimetype,
                    fileType: fileType,
                    extractedText: extractedText,
                    metadata: metadata
                });
                
                console.log(`[File] ✅ ${file.originalname} (${fileType})`);
                
            } catch (error) {
                console.error(`[File] Error ${file.originalname}:`, error.message);
            }
        }
        
        // Append to query
        if (fileContexts.length > 0) {
            query = `${query}\n\n--- UPLOADED FILE CONTENT ---\n${fileContexts.join('\n\n---\n\n')}`;
            console.log(`[Files] Appended ${fileContexts.length} files to query`);
        }
    }
    
    // ====================================
    // YOUR EXISTING QUICK SEARCH LOGIC
    // ====================================
//     if (searchType === 'quick') {
//       console.log(`[Route] QUICK SEARCH → notasdeepAgent`);
      
//       const conversationId = inputConvId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
//       if (req.user) {
//         try {
//           await saveConversation(req.user._id, conversationId, query.substring(0, 100));
//           await saveMessage(conversationId, req.user._id, 'user', query, { queryType: 'quick_search' });
//         } catch (dbError) {
//           console.error('[DB] Error saving user message:', dbError.message);
//         }
//       }
      
//       const result = await run(notasdeepAgent, query);
      
//       if (req.user) {
//         try {
//           await saveMessage(conversationId, req.user._id, 'assistant', result.finalOutput || '', { 
//             queryType: 'quick_search',
//             processingTime: Date.now() - startTime 
//           });
//         } catch (dbError) {
//           console.error('[DB] Error saving assistant message:', dbError.message);
//         }
//       }
      
//       // SAVE FILES TO USER
// // SAVE FILES TO USER
//       if (req.user && uploadedFilesMetadata.length > 0) {
//         try {
//           let savedCount = 0;
//           for (const fileData of uploadedFilesMetadata) {
//             const result = await saveFileToUser(req.user._id, fileData, conversationId);
//             if (result) {
//               savedCount++;
//             }
//           }
//           if (savedCount > 0) {
//             console.log(`[Files] ✅ Saved ${savedCount} of ${uploadedFilesMetadata.length} files to user`);
//           }
//           if (savedCount < uploadedFilesMetadata.length) {
//             console.log(`[Files] ⚠️ Failed to save ${uploadedFilesMetadata.length - savedCount} files due to ${result}`);
//           }
//         } catch (fileSaveError) {
//           console.error('[Files] Error saving to user:', fileSaveError);
//         }
//       }
      
//       const response = {
//         conversationId,
//         isFollowup: false,
//         queryType: 'quick_search',
//         searchType: 'quick',
//         response: {
//           llm: result.finalOutput ?? '',
//           citations: null,
//           metadata: null
//         }
//       };
      
//       return res.json(response);
//     }
// ====================================
// QUICK SEARCH - WITH SOURCE FILES EXTRACTION
// ====================================
if (searchType === 'quick') {
  console.log(`[Route] QUICK SEARCH → notasdeepAgent`);
  
  const conversationId = inputConvId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (req.user) {
    try {
      await saveConversation(req.user._id, conversationId, query.substring(0, 100));
      await saveMessage(conversationId, req.user._id, 'user', query, { queryType: 'quick_search' });
    } catch (dbError) {
      console.error('[DB] Error saving user message:', dbError.message);
    }
  }
  
  // Run the agent
  const result = await run(notasdeepAgent, query);
//   console.log('[DEBUG] Full result keys:', Object.keys(result));
// console.log('[DEBUG] result.output:', JSON.stringify(result.output, null, 2)?.slice(0, 2000));
// console.log('[DEBUG] result.newItems:', JSON.stringify(result.newItems, null, 2)?.slice(0, 2000));
  // ✅ NEW: Extract file citations from the agent response
  console.log(`[Quick Search] Extracting file citations...`);
  const fileCitations = extractFileCitations(result);
  
  // ✅ NEW: Get full file details if citations found
  let sourceFiles = [];
  if (fileCitations.length > 0) {
    console.log(`[Quick Search] Found ${fileCitations.length} citations, fetching details...`);
    sourceFiles = await getSourceFileDetails(fileCitations);
    console.log(`[Quick Search] Retrieved ${sourceFiles.length} source file details`);
  }
  
  if (req.user) {
    try {
      await saveMessage(conversationId, req.user._id, 'assistant', result.finalOutput || '', { 
        queryType: 'quick_search',
        processingTime: Date.now() - startTime,
        sourceFilesCount: sourceFiles.length // Track source files used
      });
    } catch (dbError) {
      console.error('[DB] Error saving assistant message:', dbError.message);
    }
  }
  
  // SAVE FILES TO USER (existing code)
  if (req.user && uploadedFilesMetadata.length > 0) {
    try {
      for (const fileData of uploadedFilesMetadata) {
        await saveFileToUser(req.user._id, fileData, conversationId);
      }
      console.log(`[Files] ✅ Saved ${uploadedFilesMetadata.length} files to user`);
    } catch (fileSaveError) {
      console.error('[Files] Error saving to user:', fileSaveError);
    }
  }
  
  // ✅ UPDATED: Include sourceFiles in response
  const response = {
    conversationId,
    isFollowup: false,
    queryType: 'quick_search',
    searchType: 'quick',
    response: {
      llm: result.finalOutput ?? '',
      citations: null,
      metadata: null,
      // ✅ NEW: Source files from vector store
      sourceFiles: sourceFiles
    }
  };
  
  return res.json(response);
}
    
    // ====================================
    // YOUR EXISTING DEEP SEARCH LOGIC
    // ====================================
    console.log(`[Route] DEEP SEARCH`);

    const isExistingConversation = !!inputConvId && conversationStore.has(inputConvId);
    const conversationId = inputConvId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Query] ${query.slice(0, 100)}...`);
    console.log(`[ConversationID] ${conversationId}`);
    
    const conversation = getOrCreateConversation(conversationId);
    
    if (req.user) {
      try {
        await saveConversation(req.user._id, conversationId, query.substring(0, 100));
        await saveMessage(conversationId, req.user._id, 'user', query, { queryType: 'initial' });
      } catch (dbError) {
        console.error('[DB] Error saving user message:', dbError.message);
      }
    }
    
    const context = getConversationContext(conversationId);
    const hasData = context.hasData;
    const isFollowup = hasData && detectFollowup(query, context);
    
    console.log(`[Followup Detection] isFollowup: ${isFollowup}, hasData: ${hasData}`);
    
    let response;
    
    if (!isFollowup) {
      // NOT A FOLLOWUP
      console.log(`[Route] Original Regulatory Agent Flow`);
      
      resetToolResults();
      const result = await run(triageAgent, query);
      
      const toolResults = getLastToolResults();
      
      const ctRaw = toolResults.clinicalTrials?.raw;
      const ctStudies = Array.isArray(ctRaw) ? ctRaw : (ctRaw?.studies || null);
      
      const rawDataToStore = {
        clinicalTrials: ctStudies,
        fda: toolResults.fda?.raw || null,
        orangeBook: toolResults.orangeBook?.raw || null,
        pubmed: toolResults.pubmed?.raw || null
      };
      
      updateConversationData(conversationId, rawDataToStore, 'search');
      const citations = generateCitations(toolResults);
      
      response = {
        conversationId,
        isFollowup: false,
        queryType: 'search',
        response: {
          metadata: {
            clinicalTrials: toolResults.clinicalTrials?.metadata || null,
            fda: toolResults.fda?.metadata || null,
            orangeBook: toolResults.orangeBook?.metadata || null,
            pubmed: toolResults.pubmed?.metadata || null,
          },
          llm: result.finalOutput ?? '',
          citations
        },
        raw: {
          clinicalTrials: ctStudies,
          fda: toolResults.fda?.raw || null,
          orangeBook: toolResults.orangeBook?.raw || null,
          pubmed: toolResults.pubmed?.raw || null,
        },
      };
      
    } else {
      // IS A FOLLOWUP
      console.log(`[Route] Followup → STATS Agent`);
      
      const rawData = conversation.rawData;
      let chartData = null;
      let statsResults = null;
      let llmResponse = '';
      let citations = [];
      
      try {
        if (rawData.clinicalTrials?.length > 0) {
          statsResults = await executeStatisticalOperation(query, rawData.clinicalTrials);
          
          if (statsResults?.chartData) {
            chartData = [statsResults.chartData];
          }
        }
        
        let statsDescription = 'No statistical data computed.';
        if (statsResults?.result) {
          const r = statsResults.result;
          const op = statsResults.operation;
          
          if (op === 'enrollment_stats') {
            statsDescription = `Enrollment Statistics:
- Average enrollment: ${r.average?.toLocaleString() || 'N/A'} participants
- Median enrollment: ${r.median?.toLocaleString() || 'N/A'} participants  
- Range: ${r.min?.toLocaleString() || 'N/A'} to ${r.max?.toLocaleString() || 'N/A'}
- Total enrolled: ${r.total?.toLocaleString() || 'N/A'}
- Trials with data: ${r.trialsWithData || 0} of ${statsResults.sampleSize || 0}`;
          } else if (r.distribution) {
            const distLines = Object.entries(r.distribution)
              .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v} trials`)
              .join('\n');
            statsDescription = `Distribution:\n${distLines}`;
          } else if (r.trialsWithPlacebo !== undefined) {
            statsDescription = `Placebo Analysis:
- Trials with placebo: ${r.trialsWithPlacebo}
- Trials without: ${r.trialsWithoutPlacebo}
- Percentage: ${r.percentageWithPlacebo}`;
          } else {
            statsDescription = JSON.stringify(r, null, 2);
          }
        }
        
        const statsOutput = await run(statsAgent, `
USER QUESTION: "${query}"

COMPUTED RESULTS:
${statsDescription}

SAMPLE SIZE: ${rawData.clinicalTrials?.length || 0} clinical trials

Write a clear, professional explanation.`);
        
        llmResponse = statsOutput.finalOutput || '';
        
        llmResponse = llmResponse
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\{[\s\S]*?\}/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        if (!llmResponse || llmResponse.length < 30) {
          llmResponse = generateFallbackExplanation(query, statsResults);
        }
        
        citations = generateCitations({
          clinicalTrials: { raw: rawData.clinicalTrials },
          fda: { raw: rawData.fda },
          orangeBook: { raw: rawData.orangeBook },
          pubmed: { raw: rawData.pubmed }
        });
        
      } catch (statsErr) {
        console.error('[Stats Agent] Error:', statsErr.message);
        llmResponse = generateFallbackExplanation(query, statsResults);
      }
      
      response = {
        conversationId,
        isFollowup: true,
        queryType: 'stats',
        response: {
          metadata: {
            clinicalTrials: rawData.clinicalTrials ? { count: rawData.clinicalTrials.length } : null,
            fda: rawData.fda ? { count: rawData.fda.length } : null,
            orangeBook: rawData.orangeBook ? { count: rawData.orangeBook.length } : null,
            pubmed: rawData.pubmed ? { count: rawData.pubmed.length } : null,
          },
          llm: llmResponse,
          chartData,
          statsResults,
          citations
        },
        raw: {
          clinicalTrials: rawData.clinicalTrials,
          fda: rawData.fda,
          orangeBook: rawData.orangeBook,
          pubmed: rawData.pubmed,
        },
      };
    }
    
    updateConversationHistory(conversationId, 'user', query, { 
      queryType: response.queryType 
    });
    updateConversationHistory(conversationId, 'assistant', response.response.llm, {
      queryType: response.queryType,
      isFollowup: isFollowup
    });
    
    if (req.user) {
      try {
        const rawData = response.raw || {};
        if (Object.values(rawData).some(v => v)) {
          await saveConversation(req.user._id, conversationId, null, rawData);
        }
        
        await saveMessage(conversationId, req.user._id, 'assistant', response.response.llm || '', {
          queryType: response.queryType,
          processingTime: Date.now() - startTime
        });
        
        await updateUserUsage(req.user._id);
      } catch (dbError) {
        console.error('[DB] Error saving assistant response:', dbError.message);
      }
    }
    
    // ====================================
    // SAVE FILES TO USER (ADD THIS)
    // ====================================
// ====================================
    // SAVE FILES TO USER (ADD THIS)
    // ====================================
    if (req.user && uploadedFilesMetadata.length > 0) {
      try {
        let savedCount = 0;
        for (const fileData of uploadedFilesMetadata) {
          const result = await saveFileToUser(req.user._id, fileData, conversationId);
          if (result) {
            savedCount++;
          }
        }
        if (savedCount > 0) {
          console.log(`[Files] ✅ Saved ${savedCount} of ${uploadedFilesMetadata.length} files to user`);
        }
        if (savedCount < uploadedFilesMetadata.length) {
          console.log(`[Files] ⚠️ Failed to save ${uploadedFilesMetadata.length - savedCount} files due to ${result} `);
        }
      } catch (fileSaveError) {
        console.error('[Files] Error saving to user:', fileSaveError);
      }
    }
    
    console.log(`[Response] Sent ${response.queryType} in ${Date.now() - startTime}ms`);
    console.log(`${'='.repeat(60)}\n`);
    
    res.json(response);
    
  } catch (err) {
    console.error('[Error]', err);
    res.status(500).json({
      error: err?.message ?? 'Unknown error',
      response: {
        metadata: null,
        llm: 'An error occurred. Please try again.',
      },
      raw: null,
    });
  }
});


// ============================================
// VECTOR STORE FILE CONTENT ENDPOINTS
// ============================================

/**
 * Serve file content from OpenAI vector stores
 * This proxies the OpenAI Files API to the frontend
 */
app.get('/api/vector-files/:fileId/content', optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`[Vector Files] Fetching content for: ${fileId}`);
    
    // Get file metadata first
    const file = await openaiClient.files.retrieve(fileId);
    
    // Get file content
    const response = await openaiClient.files.content(fileId);
    
    // Convert to buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Determine content type
    let contentType = 'application/octet-stream';
    const filename = file.filename || '';
    
    if (filename.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (filename.endsWith('.doc') || filename.endsWith('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (filename.endsWith('.txt')) {
      contentType = 'text/plain';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    
    res.send(buffer);
    
  } catch (error) {
    console.error('[Vector Files] Error serving file:', error.message);
    
    if (error.status === 404) {
      return res.status(404).json({ error: 'File not found in OpenAI' });
    }
    
    res.status(500).json({ error: 'Failed to retrieve file content' });
  }
});

/**
 * View file in browser (forces inline display)
 */
app.get('/api/vector-files/:fileId/view', optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await openaiClient.files.retrieve(fileId);
    const response = await openaiClient.files.content(fileId);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Force PDF to display inline
    const contentType = file.filename?.endsWith('.pdf') 
      ? 'application/pdf' 
      : 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('[Vector Files] View error:', error.message);
    res.status(500).json({ error: 'Failed to view file' });
  }
});

/**
 * Get file metadata only (without downloading content)
 */
app.get('/api/vector-files/:fileId/info', optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await openaiClient.files.retrieve(fileId);
    
    res.json({
      id: file.id,
      filename: file.filename,
      bytes: file.bytes,
      createdAt: file.created_at,
      purpose: file.purpose,
      isPdf: file.filename?.toLowerCase().endsWith('.pdf')
    });
    
  } catch (error) {
    console.error('[Vector Files] Info error:', error.message);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});
// ============================================
// FILE MANAGEMENT ROUTES
// ============================================

// Get user's files
app.get('/api/user/files', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // const User = require('./models/User');
        const user = await User.findById(req.user._id).select('files');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Refresh signed URLs for old files
        const now = Date.now();
        for (const file of user.files) {
            const uploadDate = new Date(file.uploadedAt).getTime();
            const daysSinceUpload = (now - uploadDate) / (1000 * 60 * 60 * 24);
            
            if (daysSinceUpload > 7) {
                try {
                    file.viewUrl = await getSignedUrl(file.gcsPath,7 * 24 * 60);

                } catch (urlError) {
                    console.error('[Files] Error refreshing URL:', urlError);
                }
            }
        }

        await user.save();

        res.json({
            files: user.files.sort((a, b) => b.uploadedAt - a.uploadedAt)
        });

    } catch (error) {
        console.error('[Files] Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Get single file
app.get('/api/user/files/:fileId', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // const User = require('./models/User');
        const user = await User.findById(req.user._id);
        const file = user.files.id(req.params.fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Refresh signed URL
        try {
            file.viewUrl = await getSignedUrl(file.gcsPath, 7 * 24 * 60);

            await user.save();
        } catch (urlError) {
            console.error('[Files] Error refreshing URL:', urlError);
        }

        res.json({ file });

    } catch (error) {
        console.error('[Files] Error fetching file:', error);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// Delete a file
app.delete('/api/user/files/:fileId', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // const User = require('./models/User');
        // const { deleteFile } = require('./gcs-upload');
        
        const user = await User.findById(req.user._id);
        const file = user.files.id(req.params.fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from GCS
        try {
            await deleteFile(file.gcsPath);
        } catch (gcsError) {
            console.error('[Files] Error deleting from GCS:', gcsError);
        }

        // Remove from user
        user.files.pull(req.params.fileId);
        await user.save();

        res.json({ success: true, message: 'File deleted' });

    } catch (error) {
        console.error('[Files] Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});
// ============================================
// PROXY OTHER ENDPOINTS TO ORIGINAL
// ============================================



// Auth routes (no auth required)
app.use('/auth', authRouter);

// User conversation routes (auth required)
app.use('/api/user/conversations', conversationRoutes);



app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});


// Conversation management
app.get('/api/conversations/:id', (req, res) => {
  const conv = conversationStore.get(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  // Get counts properly handling array structures
  const ctData = conv.rawData.clinicalTrials;
  const ctCount = Array.isArray(ctData) ? ctData.length : (ctData?.studies?.length || 0);
  
  res.json({
    conversationId: req.params.id,
    messageCount: conv.messages.length,
    lastQueryType: conv.lastQueryType,
    hasData: {
      clinicalTrials: ctCount > 0,
      fda: Array.isArray(conv.rawData.fda) && conv.rawData.fda.length > 0,
      orangeBook: Array.isArray(conv.rawData.orangeBook) && conv.rawData.orangeBook.length > 0,
      pubmed: Array.isArray(conv.rawData.pubmed) && conv.rawData.pubmed.length > 0
    },
    dataCounts: {
      clinicalTrials: ctCount,
      fda: Array.isArray(conv.rawData.fda) ? conv.rawData.fda.length : 0,
      orangeBook: Array.isArray(conv.rawData.orangeBook) ? conv.rawData.orangeBook.length : 0,
      pubmed: Array.isArray(conv.rawData.pubmed) ? conv.rawData.pubmed.length : 0
    },
    createdAt: conv.createdAt,
    lastUpdated: conv.lastUpdated
  });
});

// Debug: List all active conversations
app.get('/api/conversations', (req, res) => {
  const conversations = [];
  for (const [id, conv] of conversationStore.entries()) {
    const ctData = conv.rawData.clinicalTrials;
    const ctCount = Array.isArray(ctData) ? ctData.length : 0;
    
    conversations.push({
      id,
      messageCount: conv.messages.length,
      lastQueryType: conv.lastQueryType,
      dataLoaded: {
        trials: ctCount,
        fda: Array.isArray(conv.rawData.fda) ? conv.rawData.fda.length : 0,
        orangeBook: Array.isArray(conv.rawData.orangeBook) ? conv.rawData.orangeBook.length : 0,
        pubmed: Array.isArray(conv.rawData.pubmed) ? conv.rawData.pubmed.length : 0
      },
      lastUpdated: new Date(conv.lastUpdated).toISOString()
    });
  }
  res.json({ count: conversations.length, conversations });
});

app.delete('/api/conversations/:id', (req, res) => {
  const deleted = conversationStore.delete(req.params.id);
  res.json({ deleted });
});

// // Serve frontend
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });
// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Protect main app - redirect to login if not authenticated
app.get('/', async (req, res) => {
  const token = req.cookies?.auth_token;
  const result = await validateSession(token);
  
  if (!result) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'ai.html'));
});

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// START SERVER
// ============================================
// ============================================
// AUTO-MIGRATION: Add files field to existing users
// ============================================

async function migrateUsersAddFilesField() {
    try {
        // const User = require('./models/User'); // Adjust path to your User model
        
        console.log('\n🔄 Checking users for files field...');
        
        // Find all users without the files field
        const usersWithoutFiles = await User.countDocuments({ 
            files: { $exists: false } 
        });
        
        if (usersWithoutFiles === 0) {
            console.log('✅ All users already have files field\n');
            return;
        }
        
        console.log(`📝 Found ${usersWithoutFiles} users without files field`);
        console.log('🔧 Adding files field...');
        
        // Update all users without files field
        const result = await User.updateMany(
            { files: { $exists: false } },
            { $set: { files: [] } }
        );
        
        console.log(`✅ Migration complete!`);
        console.log(`   Updated: ${result.modifiedCount} users`);
        console.log(`   Matched: ${result.matchedCount} users\n`);
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        console.error('⚠️  Server will continue, but some users may not have files field\n');
    }
}

// ============================================
// Run migration on server startup
// ============================================

// Add this AFTER your MongoDB connection is established
// and BEFORE your routes start handling requests


const PORT = process.env.PORT || 3000;

// Load Orange Book data then start server
loadOrangeBookData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🌿 LEAF INTELLIGENCE - Enhanced Server v2.0                  ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   Server: http://localhost:${PORT}                              ║
║                                                                ║
║   Flow:                                                        ║
║   ─────────────────────────────────────────────────────────    ║
║   Query → Followup Detection                                   ║
║         ├─ NOT FOLLOWUP → Original handoff.js flow             ║
║         └─ IS FOLLOWUP  → Stats Agent / Research Pipeline      ║
║                                                                ║
║   Endpoints:                                                   ║
║   ─────────────────────────────────────────────────────────    ║
║   POST /query              - Main query endpoint               ║
║   GET  /api/conversations/:id - Get conversation info          ║
║   DELETE /api/conversations/:id - Delete conversation          ║
║   GET  /health             - Health check                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);

    //       // Run migration after DB connection
    // migrateUsersAddFilesField().catch(err => {
    //     console.error('Migration failed:', err);
    // });
    });
  })
  .catch(err => {
    console.error('Failed to load Orange Book data:', err);
    app.listen(PORT, () => {
      console.log(`\n🌿 Enhanced Server started (Orange Book data not loaded)`);
      console.log(`   http://localhost:${PORT}\n`);
    });
  });

module.exports = {
  app,
  conversationStore,
  detectFollowup
};
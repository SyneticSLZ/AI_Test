// // ============================================================
// // LEAF INTELLIGENCE - POWERPOINT EXPORT
// // Professional PPTX generation from markdown content
// // ============================================================

// // ============================================================
// // DYNAMIC LIBRARY LOADER
// // ============================================================

// // function loadPptxGenJS() {
// //     return new Promise((resolve, reject) => {
// //         // Check if already loaded
// //         if (window.PptxGenJS || window.pptxgen) {
// //             console.log('✅ PptxGenJS already available');
// //             resolve();
// //             return;
// //         }
        
// //         console.log('📦 Loading PptxGenJS library...');
// //         const script = document.createElement('script');
// //         script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgenjs.bundle.js';
// //         script.onload = () => {
// //             console.log('✅ PptxGenJS loaded successfully');
// //             resolve();
// //         };
// //         script.onerror = () => {
// //             reject(new Error('Failed to load PptxGenJS library from CDN'));
// //         };
// //         document.head.appendChild(script);
// //     });
// // // }
// // function loadPptxGenJS() {
// //     return new Promise((resolve, reject) => {
// //         if (window.PptxGenJS || window.pptxgen) {
// //             resolve();
// //             return;
// //         }
        
// //       const cdnUrls = [
// //   "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
// //   "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
// //   "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
// // ];

        
// //         let currentIndex = 0;
        
// //         function tryLoad() {
// //             if (currentIndex >= cdnUrls.length) {
// //                 reject(new Error('All CDN sources failed. Check network connection.'));
// //                 return;
// //             }
            
// //             const script = document.createElement('script');
// //             script.src = cdnUrls[currentIndex];
// //             script.onload = () => resolve();
// //             script.onerror = () => {
// //                 currentIndex++;
// //                 tryLoad();
// //             };
// //             document.head.appendChild(script);
// //         }
        
// //         tryLoad();
// //     });
// // }


// let _pptxLoadPromise = null;

// function loadPptxGenJS() {
//   // If it’s already available, done.
//   if (window.PptxGenJS || window.pptxgen) return Promise.resolve();

//   // If a load is already in-flight, return the same promise.
//   if (_pptxLoadPromise) return _pptxLoadPromise;

//   const cdnUrls = [
//     "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
//     "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
//     "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
//   ];

//   _pptxLoadPromise = new Promise((resolve, reject) => {
//     let currentIndex = 0;

//     function tryLoad() {
//       if (window.PptxGenJS || window.pptxgen) {
//         resolve();
//         return;
//       }

//       if (currentIndex >= cdnUrls.length) {
//         _pptxLoadPromise = null; // allow retry later
//         reject(new Error("All CDN sources failed."));
//         return;
//       }

//       // Reuse/remove any prior tag so we don’t execute twice.
//       const existing = document.getElementById("pptxgenjs-cdn");
//       if (existing) existing.remove();

//       const script = document.createElement("script");
//       script.id = "pptxgenjs-cdn";
//       script.src = cdnUrls[currentIndex];
//       script.async = true;

//       script.onload = () => {
//         if (window.PptxGenJS || window.pptxgen) resolve();
//         else {
//           // Loaded but didn’t expose expected global (rare, but handle it)
//           currentIndex++;
//           tryLoad();
//         }
//       };

//       script.onerror = () => {
//         currentIndex++;
//         tryLoad();
//       };

//       document.head.appendChild(script);
//     }

//     tryLoad();
//   });

//   return _pptxLoadPromise;
// }

// // ============================================================
// // CONFIGURATION & BRANDING
// // ============================================================

// const PPTX_CONFIG = {
//     layout: 'LAYOUT_16x9',
    
//     colors: {
//         primary: '047857',      // Emerald-700
//         primaryLight: '10B981', // Emerald-500
//         primaryDark: '065F46',  // Emerald-800
//         dark: '111827',         // Gray-900
//         darkAlt: '1F2937',      // Gray-800
//         text: '374151',         // Gray-700
//         textLight: '6B7280',    // Gray-500
//         surface: 'FFFFFF',
//         surfaceAlt: 'F9FAFB',   // Gray-50
//         accent: 'ECFDF5',       // Emerald-50
//         link: '0563C1'          // Blue for links
//     },
    
//     fonts: {
//         title: 'Calibri Light',
//         heading: 'Calibri',
//         body: 'Calibri',
//         code: 'Courier New'
//     },
    
//     sizes: {
//         title: 44,
//         subtitle: 24,
//         sectionTitle: 36,
//         heading: 28,
//         subheading: 22,
//         body: 16,
//         small: 14,
//         footer: 10
//     }
// };

// // ============================================================
// // MARKDOWN PARSER
// // ============================================================

// function parseMarkdownForPPTX(markdown) {
//     const lines = markdown.split('\n');
//     const slides = [];
//     let currentSlide = null;
//     let inCodeBlock = false;
//     let codeContent = [];
//     let inTable = false;
//     let tableLines = [];
    
//     // Extract title from first H1 or H2
//     let mainTitle = 'Research Report';
//     for (let line of lines) {
//         if (line.startsWith('# ')) {
//             mainTitle = line.replace(/^#\s+/, '').trim();
//             break;
//         }
//         if (line.startsWith('## ')) {
//             mainTitle = line.replace(/^##\s+/, '').trim();
//             break;
//         }
//     }
    
//     for (let i = 0; i < lines.length; i++) {
//         const line = lines[i];
//         const trimmed = line.trim();
        
//         // Skip empty lines
//         if (!trimmed && !inCodeBlock && !inTable) continue;
        
//         // Handle code blocks
//         if (trimmed.startsWith('```')) {
//             if (!inCodeBlock) {
//                 inCodeBlock = true;
//                 codeContent = [];
//             } else {
//                 if (currentSlide && codeContent.length > 0) {
//                     currentSlide.content.push({
//                         type: 'code',
//                         text: codeContent.join('\n')
//                     });
//                 }
//                 inCodeBlock = false;
//                 codeContent = [];
//             }
//             continue;
//         }
        
//         if (inCodeBlock) {
//             codeContent.push(line);
//             continue;
//         }
        
//         // Handle tables
//         if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
//             if (!inTable) {
//                 inTable = true;
//                 tableLines = [];
//             }
//             tableLines.push(trimmed);
//             continue;
//         } else if (inTable) {
//             if (currentSlide && tableLines.length > 0) {
//                 currentSlide.content.push({
//                     type: 'table',
//                     rows: parseTableRows(tableLines)
//                 });
//             }
//             inTable = false;
//             tableLines = [];
//         }
        
//         // H1 - Section headers (new slide)
//         if (trimmed.startsWith('# ')) {
//             const title = trimmed.replace(/^#\s+/, '');
//             currentSlide = {
//                 type: 'section',
//                 title: title,
//                 content: []
//             };
//             slides.push(currentSlide);
//         }
//         // H2 - Major sections (new slide)
//         else if (trimmed.startsWith('## ')) {
//             const title = trimmed.replace(/^##\s+/, '');
//             currentSlide = {
//                 type: 'content',
//                 title: title,
//                 content: []
//             };
//             slides.push(currentSlide);
//         }
//         // H3 - Subheadings
//         else if (trimmed.startsWith('### ')) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'subheading',
//                 text: trimmed.replace(/^###\s+/, '')
//             });
//         }
//         // H4 - Minor headings
//         else if (trimmed.startsWith('#### ')) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'minorheading',
//                 text: trimmed.replace(/^####\s+/, '')
//             });
//         }
//         // Blockquotes
//         else if (trimmed.startsWith('> ')) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'quote',
//                 text: trimmed.replace(/^>\s+/, '')
//             });
//         }
//         // Bullet points
//         else if (trimmed.match(/^[-*•]\s/)) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'bullet',
//                 text: trimmed.replace(/^[-*•]\s+/, '')
//             });
//         }
//         // Numbered lists
//         else if (trimmed.match(/^\d+\.\s/)) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'numbered',
//                 text: trimmed.replace(/^\d+\.\s+/, '')
//             });
//         }
//         // Horizontal rules - skip
//         else if (trimmed.match(/^[-_*]{3,}$/)) {
//             continue;
//         }
//         // Regular paragraphs
//         else if (trimmed) {
//             if (!currentSlide) {
//                 currentSlide = { type: 'content', title: '', content: [] };
//                 slides.push(currentSlide);
//             }
//             currentSlide.content.push({
//                 type: 'paragraph',
//                 text: trimmed
//             });
//         }
//     }
    
//     // Handle any remaining table
//     if (inTable && currentSlide && tableLines.length > 0) {
//         currentSlide.content.push({
//             type: 'table',
//             rows: parseTableRows(tableLines)
//         });
//     }
    
//     return {
//         title: mainTitle,
//         slides: slides
//     };
// }

// function parseTableRows(tableLines) {
//     const rows = [];
//     let separatorIndex = -1;
    
//     // Find separator
//     for (let i = 0; i < tableLines.length; i++) {
//         if (tableLines[i].match(/\|[\s\-:]+\|/)) {
//             separatorIndex = i;
//             break;
//         }
//     }
    
//     for (let i = 0; i < tableLines.length; i++) {
//         if (i === separatorIndex) continue;
        
//         const cells = tableLines[i]
//             .split('|')
//             .map(c => c.trim())
//             .filter(c => c.length > 0);
        
//         if (cells.length > 0) {
//             rows.push({
//                 cells: cells,
//                 isHeader: i < separatorIndex
//             });
//         }
//     }
    
//     return rows;
// }

// // ============================================================
// // INLINE FORMATTING PROCESSOR
// // ============================================================

// function processInlineFormattingForPPTX(text) {
//     const parts = [];
//     let remaining = text;
    
//     // Process in order: links, bold, italic, code
//     const patterns = [
//         { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
//         { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },
//         { regex: /\*([^*]+)\*/g, type: 'italic' },
//         { regex: /`([^`]+)`/g, type: 'code' }
//     ];
    
//     // Simple approach: find all matches and their positions
//     const matches = [];
    
//     for (const pattern of patterns) {
//         let match;
//         const regex = new RegExp(pattern.regex.source, 'g');
//         while ((match = regex.exec(text)) !== null) {
//             matches.push({
//                 start: match.index,
//                 end: match.index + match[0].length,
//                 type: pattern.type,
//                 text: match[1],
//                 url: match[2] || null,
//                 full: match[0]
//             });
//         }
//     }
    
//     // Sort by position
//     matches.sort((a, b) => a.start - b.start);
    
//     // Remove overlaps
//     const filtered = [];
//     for (const m of matches) {
//         const overlaps = filtered.some(f => 
//             (m.start >= f.start && m.start < f.end) ||
//             (m.end > f.start && m.end <= f.end)
//         );
//         if (!overlaps) filtered.push(m);
//     }
    
//     // Build parts
//     let pos = 0;
//     for (const m of filtered) {
//         if (m.start > pos) {
//             parts.push({ text: text.substring(pos, m.start) });
//         }
        
//         switch (m.type) {
//             case 'link':
//                 parts.push({
//                     text: m.text,
//                     options: {
//                         hyperlink: { url: m.url },
//                         color: PPTX_CONFIG.colors.link,
//                         underline: true
//                     }
//                 });
//                 break;
//             case 'bold':
//                 parts.push({
//                     text: m.text,
//                     options: { bold: true }
//                 });
//                 break;
//             case 'italic':
//                 parts.push({
//                     text: m.text,
//                     options: { italic: true }
//                 });
//                 break;
//             case 'code':
//                 parts.push({
//                     text: m.text,
//                     options: {
//                         fontFace: PPTX_CONFIG.fonts.code,
//                         color: 'DC2626'
//                     }
//                 });
//                 break;
//         }
//         pos = m.end;
//     }
    
//     if (pos < text.length) {
//         parts.push({ text: text.substring(pos) });
//     }
    
//     return parts.length > 0 ? parts : [{ text }];
// }

// // ============================================================
// // SLIDE CONTENT SPLITTER
// // ============================================================

// function splitContentIntoSlides(parsedData, maxItemsPerSlide = 7) {
//     const result = [];
    
//     for (const slide of parsedData.slides) {
//         if (slide.type === 'section') {
//             result.push(slide);
//             continue;
//         }
        
//         // Count content items
//         const contentItems = slide.content.filter(c => 
//             c.type !== 'subheading' && c.type !== 'minorheading'
//         );
        
//         if (contentItems.length <= maxItemsPerSlide) {
//             result.push(slide);
//         } else {
//             // Split into multiple slides
//             let currentContent = [];
//             let partNum = 1;
            
//             for (const item of slide.content) {
//                 currentContent.push(item);
                
//                 const count = currentContent.filter(c => 
//                     c.type !== 'subheading' && c.type !== 'minorheading'
//                 ).length;
                
//                 if (count >= maxItemsPerSlide) {
//                     result.push({
//                         type: 'content',
//                         title: partNum === 1 ? slide.title : `${slide.title} (cont'd)`,
//                         content: [...currentContent]
//                     });
//                     currentContent = [];
//                     partNum++;
//                 }
//             }
            
//             if (currentContent.length > 0) {
//                 result.push({
//                     type: 'content',
//                     title: partNum === 1 ? slide.title : `${slide.title} (cont'd)`,
//                     content: currentContent
//                 });
//             }
//         }
//     }
    
//     return result;
// }

// // ============================================================
// // SLIDE GENERATORS
// // ============================================================

// function createTitleSlide(pptx, title, subtitle, date) {
//     const slide = pptx.addSlide();
    
//     // Dark background
//     slide.background = { color: PPTX_CONFIG.colors.dark };
    
//     // Accent bar at top
//     slide.addShape('rect', {
//         x: 0, y: 0, w: '100%', h: 0.15,
//         fill: { color: PPTX_CONFIG.colors.primaryLight }
//     });
    
//     // Company branding
//     slide.addText('LEAF INTELLIGENCE', {
//         x: 0.5, y: 0.5, w: 9, h: 0.5,
//         fontSize: 14,
//         fontFace: PPTX_CONFIG.fonts.heading,
//         color: PPTX_CONFIG.colors.primaryLight,
//         bold: true
//     });
    
//     // Main title
//     slide.addText(title, {
//         x: 0.5, y: 2, w: 9, h: 1.5,
//         fontSize: PPTX_CONFIG.sizes.title,
//         fontFace: PPTX_CONFIG.fonts.title,
//         color: PPTX_CONFIG.colors.surface,
//         bold: true,
//         valign: 'middle'
//     });
    
//     // Subtitle if provided
//     if (subtitle) {
//         slide.addText(subtitle, {
//             x: 0.5, y: 3.5, w: 9, h: 0.6,
//             fontSize: PPTX_CONFIG.sizes.subtitle,
//             fontFace: PPTX_CONFIG.fonts.body,
//             color: PPTX_CONFIG.colors.textLight,
//             italic: true
//         });
//     }
    
//     // Date
//     slide.addText(date, {
//         x: 0.5, y: 4.8, w: 9, h: 0.4,
//         fontSize: PPTX_CONFIG.sizes.body,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: PPTX_CONFIG.colors.primaryLight
//     });
    
//     // Decorative element
//     slide.addShape('rect', {
//         x: 0.5, y: 4.5, w: 2, h: 0.05,
//         fill: { color: PPTX_CONFIG.colors.primaryLight }
//     });
// }

// function createSectionSlide(pptx, title) {
//     const slide = pptx.addSlide();
    
//     // Emerald background
//     slide.background = { color: PPTX_CONFIG.colors.primary };
    
//     // Section title
//     slide.addText(title, {
//         x: 0.8, y: 2, w: 8.4, h: 1.5,
//         fontSize: PPTX_CONFIG.sizes.sectionTitle,
//         fontFace: PPTX_CONFIG.fonts.title,
//         color: PPTX_CONFIG.colors.surface,
//         bold: true,
//         valign: 'middle'
//     });
    
//     // Decorative line
//     slide.addShape('rect', {
//         x: 0.8, y: 3.6, w: 3, h: 0.08,
//         fill: { color: PPTX_CONFIG.colors.surface }
//     });
    
//     // Footer
//     slide.addText('Leaf Intelligence', {
//         x: 0.5, y: 5, w: 3, h: 0.3,
//         fontSize: PPTX_CONFIG.sizes.footer,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: 'FFFFFF80'
//     });
// }

// function createContentSlide(pptx, slideData, slideNum) {
//     const slide = pptx.addSlide();
    
//     // White background
//     slide.background = { color: PPTX_CONFIG.colors.surface };
    
//     // Top accent bar
//     slide.addShape('rect', {
//         x: 0, y: 0, w: '100%', h: 0.08,
//         fill: { color: PPTX_CONFIG.colors.primaryLight }
//     });
    
//     // Slide title
//     if (slideData.title) {
//         slide.addText(slideData.title, {
//             x: 0.5, y: 0.3, w: 9, h: 0.7,
//             fontSize: PPTX_CONFIG.sizes.heading,
//             fontFace: PPTX_CONFIG.fonts.heading,
//             color: PPTX_CONFIG.colors.primary,
//             bold: true
//         });
//     }
    
//     // Content area
//     let yPos = slideData.title ? 1.2 : 0.5;
    
//     for (const item of slideData.content) {
//         switch (item.type) {
//             case 'subheading':
//                 slide.addText(item.text, {
//                     x: 0.5, y: yPos, w: 9, h: 0.5,
//                     fontSize: PPTX_CONFIG.sizes.subheading,
//                     fontFace: PPTX_CONFIG.fonts.heading,
//                     color: PPTX_CONFIG.colors.primary,
//                     bold: true
//                 });
//                 yPos += 0.55;
//                 break;
                
//             case 'minorheading':
//                 slide.addText(item.text, {
//                     x: 0.5, y: yPos, w: 9, h: 0.4,
//                     fontSize: PPTX_CONFIG.sizes.body + 2,
//                     fontFace: PPTX_CONFIG.fonts.heading,
//                     color: PPTX_CONFIG.colors.darkAlt,
//                     bold: true
//                 });
//                 yPos += 0.5;
//                 break;
                
//             case 'bullet':
//             case 'numbered':
//                 const bulletText = processInlineFormattingForPPTX(item.text);
//                 slide.addText(bulletText, {
//                     x: 0.5, y: yPos, w: 9, h: 0.45,
//                     fontSize: PPTX_CONFIG.sizes.body,
//                     fontFace: PPTX_CONFIG.fonts.body,
//                     color: PPTX_CONFIG.colors.text,
//                     bullet: item.type === 'bullet' ? { type: 'bullet', color: PPTX_CONFIG.colors.primaryLight } : { type: 'number' },
//                     indentLevel: 0
//                 });
//                 yPos += 0.5;
//                 break;
                
//             case 'quote':
//                 // Quote with accent bar
//                 slide.addShape('rect', {
//                     x: 0.5, y: yPos, w: 0.08, h: 0.6,
//                     fill: { color: PPTX_CONFIG.colors.primaryLight }
//                 });
//                 slide.addText(item.text, {
//                     x: 0.75, y: yPos, w: 8.75, h: 0.6,
//                     fontSize: PPTX_CONFIG.sizes.body,
//                     fontFace: PPTX_CONFIG.fonts.body,
//                     color: PPTX_CONFIG.colors.text,
//                     italic: true,
//                     fill: { color: PPTX_CONFIG.colors.accent }
//                 });
//                 yPos += 0.7;
//                 break;
                
//             case 'code':
//                 slide.addText(item.text, {
//                     x: 0.5, y: yPos, w: 9, h: Math.min(item.text.split('\n').length * 0.25 + 0.3, 2.5),
//                     fontSize: PPTX_CONFIG.sizes.small,
//                     fontFace: PPTX_CONFIG.fonts.code,
//                     color: 'E5E7EB',
//                     fill: { color: PPTX_CONFIG.colors.darkAlt },
//                     valign: 'top'
//                 });
//                 yPos += Math.min(item.text.split('\n').length * 0.25 + 0.4, 2.6);
//                 break;
                
//             case 'table':
//                 const tableData = item.rows.map(row => 
//                     row.cells.map(cell => ({
//                         text: cell,
//                         options: {
//                             fill: row.isHeader ? PPTX_CONFIG.colors.primary : null,
//                             color: row.isHeader ? 'FFFFFF' : PPTX_CONFIG.colors.text,
//                             bold: row.isHeader
//                         }
//                     }))
//                 );
                
//                 if (tableData.length > 0) {
//                     slide.addTable(tableData, {
//                         x: 0.5, y: yPos, w: 9,
//                         fontSize: PPTX_CONFIG.sizes.small,
//                         fontFace: PPTX_CONFIG.fonts.body,
//                         border: { pt: 0.5, color: 'D1D5DB' },
//                         align: 'left',
//                         valign: 'middle'
//                     });
//                     yPos += tableData.length * 0.4 + 0.3;
//                 }
//                 break;
                
//             case 'paragraph':
//             default:
//                 const paraText = processInlineFormattingForPPTX(item.text);
//                 slide.addText(paraText, {
//                     x: 0.5, y: yPos, w: 9, h: 0.5,
//                     fontSize: PPTX_CONFIG.sizes.body,
//                     fontFace: PPTX_CONFIG.fonts.body,
//                     color: PPTX_CONFIG.colors.text
//                 });
//                 yPos += 0.55;
//                 break;
//         }
        
//         // Safety check for overflow
//         if (yPos > 4.8) break;
//     }
    
//     // Footer
//     slide.addText('Leaf Intelligence', {
//         x: 0.5, y: 5, w: 3, h: 0.3,
//         fontSize: PPTX_CONFIG.sizes.footer,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: PPTX_CONFIG.colors.textLight
//     });
    
//     // Slide number
//     slide.addText(slideNum.toString(), {
//         x: 9, y: 5, w: 0.5, h: 0.3,
//         fontSize: PPTX_CONFIG.sizes.footer,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: PPTX_CONFIG.colors.textLight,
//         align: 'right'
//     });
// }

// function createEndSlide(pptx) {
//     const slide = pptx.addSlide();
    
//     // Dark background
//     slide.background = { color: PPTX_CONFIG.colors.dark };
    
//     // Thank you text
//     slide.addText('Thank You', {
//         x: 0, y: 1.8, w: '100%', h: 1,
//         fontSize: 40,
//         fontFace: PPTX_CONFIG.fonts.title,
//         color: PPTX_CONFIG.colors.surface,
//         align: 'center',
//         bold: true
//     });
    
//     // Branding
//     slide.addText('Powered by Leaf Intelligence', {
//         x: 0, y: 3, w: '100%', h: 0.5,
//         fontSize: PPTX_CONFIG.sizes.body,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: PPTX_CONFIG.colors.primaryLight,
//         align: 'center'
//     });
    
//     // Tagline
//     slide.addText('AI-Driven Research & Strategic Analysis', {
//         x: 0, y: 3.5, w: '100%', h: 0.4,
//         fontSize: PPTX_CONFIG.sizes.small,
//         fontFace: PPTX_CONFIG.fonts.body,
//         color: PPTX_CONFIG.colors.textLight,
//         align: 'center',
//         italic: true
//     });
    
//     // Bottom accent
//     slide.addShape('rect', {
//         x: 3.5, y: 4.2, w: 3, h: 0.05,
//         fill: { color: PPTX_CONFIG.colors.primaryLight }
//     });
// }

// // ============================================================
// // MAIN EXPORT FUNCTION
// // ============================================================

// async function exportToPPTX(streamId) {
//     // Close any open menus
//     if (typeof closeExportMenu === 'function') {
//         closeExportMenu();
//     }
    
//     try {
//         // Load library if needed
//         await loadPptxGenJS();
        
//         // Get the constructor
//         const PptxConstructor = window.PptxGenJS || window.pptxgen;
        
//         if (!PptxConstructor) {
//             throw new Error('PptxGenJS library not available');
//         }
        
//         // Get markdown content
//         const markdown = responseMarkdown.get(streamId);
//         if (!markdown) {
//             throw new Error('No content found to export');
//         }
        
//         // Get user prompt if available
//         const userPrompt = window.userPrompts ? window.userPrompts.get(streamId) : null;
        
//         // Parse markdown
//         const parsedData = parseMarkdownForPPTX(markdown);
        
//         // Split content into manageable slides
//         const optimizedSlides = splitContentIntoSlides(parsedData, 7);
        
//         // Create presentation
//         const pptx = new PptxConstructor();
        
//         // Set presentation properties
//         pptx.layout = PPTX_CONFIG.layout;
//         pptx.title = parsedData.title;
//         pptx.author = 'Leaf Intelligence';
//         pptx.company = 'Leaf Intelligence';
//         pptx.subject = 'AI Research Report';
        
//         // Format date
//         const now = new Date();
//         const dateStr = now.toLocaleDateString('en-US', {
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric'
//         });
        
//         // Create title slide
//         createTitleSlide(
//             pptx,
//             parsedData.title,
//             userPrompt ? `Research Query: ${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}` : null,
//             dateStr
//         );
        
//         // Create content slides
//         let slideNum = 2;
//         for (const slideData of optimizedSlides) {
//             if (slideData.type === 'section') {
//                 createSectionSlide(pptx, slideData.title);
//             } else {
//                 createContentSlide(pptx, slideData, slideNum);
//             }
//             slideNum++;
//         }
        
//         // Create end slide
//         createEndSlide(pptx);
        
//         // Generate filename
//         const sanitizedTitle = parsedData.title
//             .replace(/[^a-zA-Z0-9\s-]/g, '')
//             .replace(/\s+/g, '-')
//             .substring(0, 50);
        
//         const filename = `Leaf-Intelligence-${sanitizedTitle}-${now.toISOString().split('T')[0]}.pptx`;
        
//         // Save the file
//         await pptx.writeFile({ fileName: filename });
        
//         // Show success notification
//         if (typeof showExportSuccess === 'function') {
//             showExportSuccess('PowerPoint');
//         } else {
//             console.log('✅ PowerPoint exported successfully!');
//         }
        
//     } catch (error) {
//         console.error('PowerPoint export error:', error);
        
//         if (typeof showExportError === 'function') {
//             showExportError('PowerPoint');
//         } else {
//             alert('Failed to export PowerPoint: ' + error.message);
//         }
//     }
// }

// // ============================================================
// // THEME VARIANTS
// // ============================================================

// async function exportToPPTXWithTheme(streamId, theme = 'professional') {
//     const themes = {
//         professional: {
//             primary: '047857',
//             primaryLight: '10B981',
//             dark: '111827',
//             surface: 'FFFFFF'
//         },
//         corporate: {
//             primary: '1E40AF',
//             primaryLight: '3B82F6',
//             dark: '1E3A8A',
//             surface: 'FFFFFF'
//         },
//         modern: {
//             primary: '7C3AED',
//             primaryLight: 'A78BFA',
//             dark: '4C1D95',
//             surface: 'FFFFFF'
//         },
//         elegant: {
//             primary: '92400E',
//             primaryLight: 'D97706',
//             dark: '78350F',
//             surface: 'FFFBEB'
//         }
//     };
    
//     const selectedTheme = themes[theme] || themes.professional;
//     Object.assign(PPTX_CONFIG.colors, selectedTheme);
    
//     await exportToPPTX(streamId);
// }

// // ============================================================
// // AUTO-PRELOAD (optional)
// // ============================================================

// if (typeof document !== 'undefined') {
//     document.addEventListener('DOMContentLoaded', function() {
//         // Preload library after page loads
//         setTimeout(() => {
//             loadPptxGenJS().catch(err => {
//                 console.warn('PptxGenJS preload skipped:', err.message);
//             });
//         }, 3000);
//     });
// }

// ============================================================
// LEAF INTELLIGENCE - POWERPOINT EXPORT
// Professional PPTX generation from markdown content
// ============================================================

// ============================================================
// DYNAMIC LIBRARY LOADER
// ============================================================

let _pptxLoadPromise = null;

function loadPptxGenJS() {
  // If it’s already available, done.
  if (window.PptxGenJS || window.pptxgen) return Promise.resolve();

  // If a load is already in-flight, return the same promise.
  if (_pptxLoadPromise) return _pptxLoadPromise;

  const cdnUrls = [
    "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
  ];

  _pptxLoadPromise = new Promise((resolve, reject) => {
    let currentIndex = 0;

    function tryLoad() {
      if (window.PptxGenJS || window.pptxgen) {
        resolve();
        return;
      }

      if (currentIndex >= cdnUrls.length) {
        _pptxLoadPromise = null; // allow retry later
        reject(new Error("All CDN sources failed."));
        return;
      }

      // Reuse/remove any prior tag so we don’t execute twice.
      const existing = document.getElementById("pptxgenjs-cdn");
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = "pptxgenjs-cdn";
      script.src = cdnUrls[currentIndex];
      script.async = true;

      script.onload = () => {
        if (window.PptxGenJS || window.pptxgen) resolve();
        else {
          // Loaded but didn’t expose expected global (rare, but handle it)
          currentIndex++;
          tryLoad();
        }
      };

      script.onerror = () => {
        currentIndex++;
        tryLoad();
      };

      document.head.appendChild(script);
    }

    tryLoad();
  });

  return _pptxLoadPromise;
}

// ============================================================
// CONFIGURATION & BRANDING
// ============================================================

const PPTX_CONFIG = {
    layout: 'LAYOUT_16x9',
    
    colors: {
        primary: '047857',      // Emerald-700
        primaryLight: '10B981', // Emerald-500
        primaryDark: '065F46',  // Emerald-800
        dark: '111827',         // Gray-900
        darkAlt: '1F2937',      // Gray-800
        text: '374151',         // Gray-700
        textLight: '6B7280',    // Gray-500
        surface: 'FFFFFF',
        surfaceAlt: 'F9FAFB',   // Gray-50
        accent: 'ECFDF5',       // Emerald-50
        link: '0563C1'          // Blue for links
    },
    
    fonts: {
        title: 'Calibri Light',
        heading: 'Calibri',
        body: 'Calibri',
        code: 'Courier New'
    },
    
 sizes: {
    title: 32,        // was 42 - still prominent but not overwhelming
    subtitle: 18,     // was 22 - clean secondary text
    sectionTitle: 26, // was 34 - clear section headers
    heading: 20,      // was 26 - good for slide headings
    subheading: 16,   // was 20 - supporting headers
    body: 12,         // was 14 - standard readable body text
    small: 10,        // was 12 - captions, notes
    footer: 8         // keep at 8 - fine for footer/legal
}
};

// ============================================================
// TITLE CLEANING UTILITY
// ============================================================

function cleanTitleForPPTX(rawTitle) {
    if (!rawTitle) return 'Research Report';
    
    let title = rawTitle;
    
    // Remove emojis (common Unicode emoji ranges)
    title = title.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    title = title.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc symbols & pictographs
    title = title.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport & map
    title = title.replace(/[\u{1F700}-\u{1F77F}]/gu, ''); // Alchemical
    title = title.replace(/[\u{1F780}-\u{1F7FF}]/gu, ''); // Geometric
    title = title.replace(/[\u{1F800}-\u{1F8FF}]/gu, ''); // Supplemental arrows
    title = title.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental symbols
    title = title.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ''); // Chess symbols
    title = title.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols & pictographs ext
    title = title.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
    title = title.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats
    title = title.replace(/[\u{FE00}-\u{FE0F}]/gu, '');   // Variation selectors
    
    // Remove metadata in parentheses at the end (e.g., "(Leaf Intelligence, Dec 18, 2025)")
    title = title.replace(/\s*\([^)]*(?:Leaf Intelligence|Intelligence|Research|Report|Analysis)[^)]*\)\s*$/i, '');
    title = title.replace(/\s*\([^)]*\d{4}\)\s*$/i, ''); // Remove date-like parentheses
    
    // Remove markdown bold/italic formatting
    title = title.replace(/\*\*\*(.+?)\*\*\*/g, '$1'); // Bold+italic
    title = title.replace(/\*\*(.+?)\*\*/g, '$1');     // Bold
    title = title.replace(/\*(.+?)\*/g, '$1');         // Italic
    title = title.replace(/___(.+?)___/g, '$1');       // Bold+italic alt
    title = title.replace(/__(.+?)__/g, '$1');         // Bold alt
    title = title.replace(/_(.+?)_/g, '$1');           // Italic alt
    
    // Remove markdown links, keep text
    title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove inline code backticks
    title = title.replace(/`([^`]+)`/g, '$1');
    
    // Remove stray quotes and asterisks
    title = title.replace(/^["'*_]+|["'*_]+$/g, '');
    title = title.replace(/^"+|"+$/g, '');
    title = title.replace(/^'+|'+$/g, '');
    
    // Remove "Analysis of" prefix if followed by quoted content
    title = title.replace(/^Analysis of\s+["'""]?(.+?)["'""]?\s*$/i, '$1');
    
    // Clean up multiple spaces and trim
    title = title.replace(/\s+/g, ' ').trim();
    
    // If title is too short or empty, use fallback
    if (title.length < 3) {
        return 'Research Report';
    }
    
    // Truncate if too long (for clean display)
    if (title.length > 80) {
        title = title.substring(0, 77) + '...';
    }
    
    return title;
}

// ============================================================
// MARKDOWN PARSER
// ============================================================

function parseMarkdownForPPTX(markdown) {
    const lines = markdown.split('\n');
    const slides = [];
    let currentSlide = null;
    let inCodeBlock = false;
    let codeContent = [];
    let inTable = false;
    let tableLines = [];
    
    // Extract and clean title from first H1 or H2
    let mainTitle = 'Research Report';
    for (let line of lines) {
        if (line.startsWith('# ')) {
            mainTitle = cleanTitleForPPTX(line.replace(/^#\s+/, '').trim());
            break;
        }
        if (line.startsWith('## ')) {
            mainTitle = cleanTitleForPPTX(line.replace(/^##\s+/, '').trim());
            break;
        }
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed && !inCodeBlock && !inTable) continue;
        
        // Handle code blocks
        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeContent = [];
            } else {
                if (currentSlide && codeContent.length > 0) {
                    currentSlide.content.push({
                        type: 'code',
                        text: codeContent.join('\n')
                    });
                }
                inCodeBlock = false;
                codeContent = [];
            }
            continue;
        }
        
        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }
        
        // Handle tables
        if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
            if (!inTable) {
                inTable = true;
                tableLines = [];
            }
            tableLines.push(trimmed);
            continue;
        } else if (inTable) {
            if (currentSlide && tableLines.length > 0) {
                currentSlide.content.push({
                    type: 'table',
                    rows: parseTableRows(tableLines)
                });
            }
            inTable = false;
            tableLines = [];
        }
        
        // H1 - Section headers (new slide)
        if (trimmed.startsWith('# ')) {
            const title = trimmed.replace(/^#\s+/, '');
            currentSlide = {
                type: 'section',
                title: title,
                content: []
            };
            slides.push(currentSlide);
        }
        // H2 - Major sections (new slide)
        else if (trimmed.startsWith('## ')) {
            const title = trimmed.replace(/^##\s+/, '');
            currentSlide = {
                type: 'content',
                title: title,
                content: []
            };
            slides.push(currentSlide);
        }
        // H3 - Subheadings
        else if (trimmed.startsWith('### ')) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'subheading',
                text: trimmed.replace(/^###\s+/, '')
            });
        }
        // H4 - Minor headings
        else if (trimmed.startsWith('#### ')) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'minorheading',
                text: trimmed.replace(/^####\s+/, '')
            });
        }
        // Blockquotes
        else if (trimmed.startsWith('> ')) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'quote',
                text: trimmed.replace(/^>\s+/, '')
            });
        }
        // Bullet points
        else if (trimmed.match(/^[-*•]\s/)) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'bullet',
                text: trimmed.replace(/^[-*•]\s+/, '')
            });
        }
        // Numbered lists
        else if (trimmed.match(/^\d+\.\s/)) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'numbered',
                text: trimmed.replace(/^\d+\.\s+/, '')
            });
        }
        // Horizontal rules - skip
        else if (trimmed.match(/^[-_*]{3,}$/)) {
            continue;
        }
        // Regular paragraphs
        else if (trimmed) {
            if (!currentSlide) {
                currentSlide = { type: 'content', title: '', content: [] };
                slides.push(currentSlide);
            }
            currentSlide.content.push({
                type: 'paragraph',
                text: trimmed
            });
        }
    }
    
    // Handle any remaining table
    if (inTable && currentSlide && tableLines.length > 0) {
        currentSlide.content.push({
            type: 'table',
            rows: parseTableRows(tableLines)
        });
    }
    
    return {
        title: mainTitle,
        slides: slides
    };
}

function parseTableRows(tableLines) {
    const rows = [];
    let separatorIndex = -1;
    
    // Find separator
    for (let i = 0; i < tableLines.length; i++) {
        if (tableLines[i].match(/\|[\s\-:]+\|/)) {
            separatorIndex = i;
            break;
        }
    }
    
    for (let i = 0; i < tableLines.length; i++) {
        if (i === separatorIndex) continue;
        
        const cells = tableLines[i]
            .split('|')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        
        if (cells.length > 0) {
            rows.push({
                cells: cells,
                isHeader: i < separatorIndex
            });
        }
    }
    
    return rows;
}

// ============================================================
// INLINE FORMATTING PROCESSOR
// ============================================================

function processInlineFormattingForPPTX(text) {
    const parts = [];
    let remaining = text;
    
    // Process in order: links, bold, italic, code
    const patterns = [
        { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
        { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },
        { regex: /\*([^*]+)\*/g, type: 'italic' },
        { regex: /`([^`]+)`/g, type: 'code' }
    ];
    
    // Simple approach: find all matches and their positions
    const matches = [];
    
    for (const pattern of patterns) {
        let match;
        const regex = new RegExp(pattern.regex.source, 'g');
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                type: pattern.type,
                text: match[1],
                url: match[2] || null,
                full: match[0]
            });
        }
    }
    
    // Sort by position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlaps
    const filtered = [];
    for (const m of matches) {
        const overlaps = filtered.some(f => 
            (m.start >= f.start && m.start < f.end) ||
            (m.end > f.start && m.end <= f.end)
        );
        if (!overlaps) filtered.push(m);
    }
    
    // Build parts
    let pos = 0;
    for (const m of filtered) {
        if (m.start > pos) {
            parts.push({ text: text.substring(pos, m.start) });
        }
        
        switch (m.type) {
            case 'link':
                parts.push({
                    text: m.text,
                    options: {
                        hyperlink: { url: m.url },
                        color: PPTX_CONFIG.colors.link,
                        underline: true
                    }
                });
                break;
            case 'bold':
                parts.push({
                    text: m.text,
                    options: { bold: true }
                });
                break;
            case 'italic':
                parts.push({
                    text: m.text,
                    options: { italic: true }
                });
                break;
            case 'code':
                parts.push({
                    text: m.text,
                    options: {
                        fontFace: PPTX_CONFIG.fonts.code,
                        color: 'DC2626'
                    }
                });
                break;
        }
        pos = m.end;
    }
    
    if (pos < text.length) {
        parts.push({ text: text.substring(pos) });
    }
    
    return parts.length > 0 ? parts : [{ text }];
}

// ============================================================
// SLIDE CONTENT SPLITTER
// ============================================================

function splitContentIntoSlides(parsedData, maxItemsPerSlide = 5) {
    const result = [];
    
    for (const slide of parsedData.slides) {
        if (slide.type === 'section') {
            result.push(slide);
            continue;
        }
        
        // Count content items (excluding headings)
        const contentItems = slide.content.filter(c => 
            c.type !== 'subheading' && c.type !== 'minorheading'
        );
        
        // Also check for long text that needs more space
        let weightedCount = 0;
        slide.content.forEach(item => {
            if (item.type === 'subheading' || item.type === 'minorheading') {
                weightedCount += 0.5;
            } else if (item.type === 'quote' || item.type === 'code') {
                weightedCount += 2; // These take more space
            } else if (item.text && item.text.length > 150) {
                weightedCount += 2; // Long text
            } else if (item.text && item.text.length > 80) {
                weightedCount += 1.5;
            } else {
                weightedCount += 1;
            }
        });
        
        if (weightedCount <= maxItemsPerSlide) {
            result.push(slide);
        } else {
            // Split into multiple slides
            let currentContent = [];
            let currentWeight = 0;
            let partNum = 1;
            
            for (const item of slide.content) {
                let itemWeight = 1;
                if (item.type === 'subheading' || item.type === 'minorheading') {
                    itemWeight = 0.5;
                } else if (item.type === 'quote' || item.type === 'code') {
                    itemWeight = 2;
                } else if (item.text && item.text.length > 150) {
                    itemWeight = 2;
                } else if (item.text && item.text.length > 80) {
                    itemWeight = 1.5;
                }
                
                if (currentWeight + itemWeight > maxItemsPerSlide && currentContent.length > 0) {
                    result.push({
                        type: 'content',
                        title: slide.title,
                        isContinuation: partNum > 1,
                        content: [...currentContent]
                    });
                    currentContent = [];
                    currentWeight = 0;
                    partNum++;
                }
                
                currentContent.push(item);
                currentWeight += itemWeight;
            }
            
            if (currentContent.length > 0) {
                result.push({
                    type: 'content',
                    title: slide.title,
                    isContinuation: partNum > 1,
                    content: currentContent
                });
            }
        }
    }
    
    return result;
}

// ============================================================
// SLIDE GENERATORS
// ============================================================

function createTitleSlide(pptx, title, subtitle, date) {
    const slide = pptx.addSlide();
    
    // Dark background
    slide.background = { color: PPTX_CONFIG.colors.dark };
    
    // Accent bar at top
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 0.12,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Company branding - top left
    slide.addText('LEAF INTELLIGENCE', {
        x: 0.6, y: 0.4, w: 4, h: 0.4,
        fontSize: 12,
        fontFace: PPTX_CONFIG.fonts.heading,
        color: PPTX_CONFIG.colors.primaryLight,
        bold: true
    });
    
    // Main title - centered vertically
    slide.addText(title, {
        x: 0.6, y: 1.8, w: 8.8, h: 1.2,
        fontSize: 38,
        fontFace: PPTX_CONFIG.fonts.title,
        color: PPTX_CONFIG.colors.surface,
        bold: true,
        valign: 'middle'
    });
    
    // Decorative line under title
    slide.addShape('rect', {
        x: 0.6, y: 3.1, w: 1.5, h: 0.04,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Subtitle if provided
    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.6, y: 3.35, w: 8.8, h: 0.6,
            fontSize: 16,
            fontFace: PPTX_CONFIG.fonts.body,
            color: PPTX_CONFIG.colors.textLight,
            italic: true,
            valign: 'top'
        });
    }
    
    // Date - bottom area
    slide.addText(date, {
        x: 0.6, y: 4.6, w: 4, h: 0.3,
        fontSize: 13,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.primaryLight
    });
    
    // AI Research Platform tagline
    slide.addText('AI-Powered Research Platform', {
        x: 0.6, y: 4.9, w: 4, h: 0.25,
        fontSize: 10,
        fontFace: PPTX_CONFIG.fonts.body,
        color: '9CA3AF',
        italic: true
    });
}

function createSectionSlide(pptx, title) {
    const slide = pptx.addSlide();
    
    // Emerald background
    slide.background = { color: PPTX_CONFIG.colors.primary };
    
    // Accent bar at top
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Section title - clean and centered
    slide.addText(title, {
        x: 0.6, y: 1.9, w: 8.8, h: 1.4,
        fontSize: 36,
        fontFace: PPTX_CONFIG.fonts.title,
        color: PPTX_CONFIG.colors.surface,
        bold: true,
        valign: 'middle'
    });
    
    // Decorative underline
    slide.addShape('rect', {
        x: 0.6, y: 3.4, w: 1.8, h: 0.05,
        fill: { color: PPTX_CONFIG.colors.surface }
    });
    
    // Footer branding
    slide.addText('Leaf Intelligence', {
        x: 0.6, y: 4.9, w: 3, h: 0.25,
        fontSize: 10,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.accent
    });
}

function createContentSlide(pptx, slideData, slideNum) {
    const slide = pptx.addSlide();
    
    // White background
    slide.background = { color: PPTX_CONFIG.colors.surface };
    
    // Top accent bar
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Slide title with optional continuation indicator
    let yPos = 0.4;
    if (slideData.title) {
        // Build title with mixed formatting if continuation
        const titleParts = [
            {
                text: slideData.title,
                options: {
                    fontSize: 26,
                    fontFace: PPTX_CONFIG.fonts.heading,
                    color: PPTX_CONFIG.colors.primary,
                    bold: true
                }
            }
        ];
        
        // Add smaller "(cont'd)" on same line if continuation
        if (slideData.isContinuation) {
            titleParts.push({
                text: '  (continued)',
                options: {
                    fontSize: 14,
                    fontFace: PPTX_CONFIG.fonts.body,
                    color: PPTX_CONFIG.colors.textLight,
                    bold: false,
                    italic: true
                }
            });
        }
        
        slide.addText(titleParts, {
            x: 0.6, y: yPos, w: 8.8, h: 0.6,
            valign: 'top'
        });
        yPos = 1.1;
    }
    
    // Content area - with better spacing
    const maxY = 4.7; // Leave room for footer
    const lineHeight = 0.32; // Height per line of text
    const itemSpacing = 0.15; // Space between items
    const sectionSpacing = 0.25; // Extra space before headings
    
    for (const item of slideData.content) {
        if (yPos >= maxY) break;
        
        switch (item.type) {
            case 'subheading':
                yPos += sectionSpacing; // Extra space before subheading
                if (yPos >= maxY) break;
                slide.addText(item.text, {
                    x: 0.6, y: yPos, w: 8.8, h: 0.4,
                    fontSize: 20,
                    fontFace: PPTX_CONFIG.fonts.heading,
                    color: PPTX_CONFIG.colors.primary,
                    bold: true,
                    valign: 'top'
                });
                yPos += 0.45;
                break;
                
            case 'minorheading':
                yPos += itemSpacing;
                if (yPos >= maxY) break;
                slide.addText(item.text, {
                    x: 0.6, y: yPos, w: 8.8, h: 0.35,
                    fontSize: 17,
                    fontFace: PPTX_CONFIG.fonts.heading,
                    color: PPTX_CONFIG.colors.darkAlt,
                    bold: true,
                    valign: 'top'
                });
                yPos += 0.4;
                break;
                
            case 'bullet':
            case 'numbered':
                const bulletText = processInlineFormattingForPPTX(item.text);
                const bulletLines = Math.ceil(item.text.length / 90); // Estimate lines needed
                const bulletHeight = Math.max(0.35, bulletLines * lineHeight);
                
                if (yPos + bulletHeight >= maxY) break;
                
                slide.addText(bulletText, {
                    x: 0.6, y: yPos, w: 8.8, h: bulletHeight,
                    fontSize: 15,
                    fontFace: PPTX_CONFIG.fonts.body,
                    color: PPTX_CONFIG.colors.text,
                    bullet: { 
                        type: item.type === 'bullet' ? 'bullet' : 'number',
                        color: PPTX_CONFIG.colors.primaryLight,
                        indent: 0.25
                    },
                    paraSpaceBefore: 2,
                    paraSpaceAfter: 2,
                    valign: 'top'
                });
                yPos += bulletHeight + itemSpacing;
                break;
                
            case 'quote':
                const quoteLines = Math.ceil(item.text.length / 85);
                const quoteHeight = Math.max(0.5, quoteLines * lineHeight + 0.2);
                
                if (yPos + quoteHeight >= maxY) break;
                
                // Quote background with left border
                slide.addShape('rect', {
                    x: 0.6, y: yPos, w: 8.8, h: quoteHeight,
                    fill: { color: PPTX_CONFIG.colors.accent },
                    line: { color: PPTX_CONFIG.colors.primaryLight, width: 0 }
                });
                slide.addShape('rect', {
                    x: 0.6, y: yPos, w: 0.06, h: quoteHeight,
                    fill: { color: PPTX_CONFIG.colors.primaryLight }
                });
                slide.addText(item.text, {
                    x: 0.8, y: yPos + 0.1, w: 8.4, h: quoteHeight - 0.2,
                    fontSize: 14,
                    fontFace: PPTX_CONFIG.fonts.body,
                    color: PPTX_CONFIG.colors.text,
                    italic: true,
                    valign: 'top'
                });
                yPos += quoteHeight + itemSpacing + 0.1;
                break;
                
            case 'code':
                const codeLines = item.text.split('\n').length;
                const codeHeight = Math.min(Math.max(0.6, codeLines * 0.22 + 0.3), 2.2);
                
                if (yPos + codeHeight >= maxY) break;
                
                slide.addText(item.text, {
                    x: 0.6, y: yPos, w: 8.8, h: codeHeight,
                    fontSize: 11,
                    fontFace: PPTX_CONFIG.fonts.code,
                    color: 'E5E7EB',
                    fill: { color: PPTX_CONFIG.colors.darkAlt },
                    valign: 'top',
                    margin: [8, 10, 8, 10]
                });
                yPos += codeHeight + itemSpacing + 0.1;
                break;
                
            case 'table':
                const tableRows = item.rows.length;
                const tableHeight = Math.min(tableRows * 0.35 + 0.2, 2.5);
                
                if (yPos + tableHeight >= maxY) break;
                
                const tableData = item.rows.map(row => 
                    row.cells.map(cell => ({
                        text: cell,
                        options: {
                            fill: row.isHeader ? PPTX_CONFIG.colors.primary : 'FFFFFF',
                            color: row.isHeader ? 'FFFFFF' : PPTX_CONFIG.colors.text,
                            bold: row.isHeader,
                            fontSize: 12,
                            valign: 'middle',
                            margin: [4, 6, 4, 6]
                        }
                    }))
                );
                
                if (tableData.length > 0) {
                    slide.addTable(tableData, {
                        x: 0.6, y: yPos, w: 8.8,
                        fontFace: PPTX_CONFIG.fonts.body,
                        border: { pt: 0.5, color: 'D1D5DB' },
                        align: 'left',
                        valign: 'middle'
                    });
                    yPos += tableHeight + itemSpacing;
                }
                break;
                
            case 'paragraph':
            default:
                const paraText = processInlineFormattingForPPTX(item.text);
                const paraLines = Math.ceil(item.text.length / 95);
                const paraHeight = Math.max(0.35, paraLines * lineHeight);
                
                if (yPos + paraHeight >= maxY) break;
                
                slide.addText(paraText, {
                    x: 0.6, y: yPos, w: 8.8, h: paraHeight,
                    fontSize: 15,
                    fontFace: PPTX_CONFIG.fonts.body,
                    color: PPTX_CONFIG.colors.text,
                    valign: 'top'
                });
                yPos += paraHeight + itemSpacing;
                break;
        }
    }
    
    // Footer - fixed at bottom
    slide.addText('Leaf Intelligence', {
        x: 0.6, y: 4.95, w: 3, h: 0.25,
        fontSize: 9,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.textLight
    });
    
    // Slide number
    slide.addText(slideNum.toString(), {
        x: 8.9, y: 4.95, w: 0.5, h: 0.25,
        fontSize: 9,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.textLight,
        align: 'right'
    });
}

function createEndSlide(pptx) {
    const slide = pptx.addSlide();
    
    // Dark background
    slide.background = { color: PPTX_CONFIG.colors.dark };
    
    // Top accent bar
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Thank you text
    slide.addText('Thank You', {
        x: 0, y: 1.6, w: '100%', h: 0.9,
        fontSize: 44,
        fontFace: PPTX_CONFIG.fonts.title,
        color: PPTX_CONFIG.colors.surface,
        align: 'center',
        bold: true
    });
    
    // Decorative line
    slide.addShape('rect', {
        x: 4, y: 2.6, w: 2, h: 0.04,
        fill: { color: PPTX_CONFIG.colors.primaryLight }
    });
    
    // Branding
    slide.addText('Powered by Leaf Intelligence', {
        x: 0, y: 2.9, w: '100%', h: 0.45,
        fontSize: 16,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.primaryLight,
        align: 'center',
        bold: true
    });
    
    // Tagline
    slide.addText('AI-Driven Research & Strategic Analysis', {
        x: 0, y: 3.35, w: '100%', h: 0.35,
        fontSize: 12,
        fontFace: PPTX_CONFIG.fonts.body,
        color: PPTX_CONFIG.colors.textLight,
        align: 'center',
        italic: true
    });
    
    // Contact/Website placeholder
    slide.addText('www.leafintelligence.ai', {
        x: 0, y: 4.6, w: '100%', h: 0.3,
        fontSize: 11,
        fontFace: PPTX_CONFIG.fonts.body,
        color: '9CA3AF',
        align: 'center'
    });
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

async function exportToPPTX(streamId) {
    // Close any open menus
    if (typeof closeExportMenu === 'function') {
        closeExportMenu();
    }
    
    try {
        // Load library if needed
        await loadPptxGenJS();
        
        // Get the constructor
        const PptxConstructor = window.PptxGenJS || window.pptxgen;
        
        if (!PptxConstructor) {
            throw new Error('PptxGenJS library not available');
        }
        
        // Get markdown content
        const markdown = responseMarkdown.get(streamId);
        if (!markdown) {
            throw new Error('No content found to export');
        }
        
        // Get user prompt if available
        const userPrompt = window.userPrompts ? window.userPrompts.get(streamId) : null;
        
        // Parse markdown
        const parsedData = parseMarkdownForPPTX(markdown);
        
        // Split content into manageable slides
        const optimizedSlides = splitContentIntoSlides(parsedData, 7);
        
        // Create presentation
        const pptx = new PptxConstructor();
        
        // Set presentation properties
        pptx.layout = PPTX_CONFIG.layout;
        pptx.title = parsedData.title;
        pptx.author = 'Leaf Intelligence';
        pptx.company = 'Leaf Intelligence';
        pptx.subject = 'AI Research Report';
        
        // Format date
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Create title slide
        createTitleSlide(
            pptx,
            parsedData.title,
            userPrompt ? `Research Query: ${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}` : null,
            dateStr
        );
        
        // Create content slides
        let slideNum = 2;
        for (const slideData of optimizedSlides) {
            if (slideData.type === 'section') {
                createSectionSlide(pptx, slideData.title);
            } else {
                createContentSlide(pptx, slideData, slideNum);
            }
            slideNum++;
        }
        
        // Create end slide
        createEndSlide(pptx);
        
        // Generate filename
        const sanitizedTitle = parsedData.title
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        
        const filename = `Leaf-Intelligence-${sanitizedTitle}-${now.toISOString().split('T')[0]}.pptx`;
        
        // Save the file
        await pptx.writeFile({ fileName: filename });
        
        // Show success notification
        if (typeof showExportSuccess === 'function') {
            showExportSuccess('PowerPoint');
        } else {
            console.log('✅ PowerPoint exported successfully!');
        }
        
    } catch (error) {
        console.error('PowerPoint export error:', error);
        
        if (typeof showExportError === 'function') {
            showExportError('PowerPoint');
        } else {
            alert('Failed to export PowerPoint: ' + error.message);
        }
    }
}

// ============================================================
// THEME VARIANTS
// ============================================================

async function exportToPPTXWithTheme(streamId, theme = 'professional') {
    const themes = {
        professional: {
            primary: '047857',
            primaryLight: '10B981',
            dark: '111827',
            surface: 'FFFFFF'
        },
        corporate: {
            primary: '1E40AF',
            primaryLight: '3B82F6',
            dark: '1E3A8A',
            surface: 'FFFFFF'
        },
        modern: {
            primary: '7C3AED',
            primaryLight: 'A78BFA',
            dark: '4C1D95',
            surface: 'FFFFFF'
        },
        elegant: {
            primary: '92400E',
            primaryLight: 'D97706',
            dark: '78350F',
            surface: 'FFFBEB'
        }
    };
    
    const selectedTheme = themes[theme] || themes.professional;
    Object.assign(PPTX_CONFIG.colors, selectedTheme);
    
    await exportToPPTX(streamId);
}

// ============================================================
// AUTO-PRELOAD (optional)
// ============================================================

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Preload library after page loads
        setTimeout(() => {
            loadPptxGenJS().catch(err => {
                console.warn('PptxGenJS preload skipped:', err.message);
            });
        }, 3000);
    });
}



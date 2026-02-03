/**
 * Vector Store Setup Script
 * Creates and populates OpenAI Vector Store with medical code databases
 * 
 * Run this once to set up the vector store:
 *   node setupVectorStore.js
 * 
 * Or with custom data directory:
 *   node setupVectorStore.js --data-dir ./my-codes
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Medical code database content
// These will be uploaded as text files to the vector store

const ICD10_CODES_CONTENT = `# ICD-10-CM Diagnosis Codes - Medical Billing Reference
# Source: CMS ICD-10-CM Official Guidelines 2024
# Last Updated: 2026-01-29

## Nephrology / Kidney Disease Codes

### IgA Nephropathy (Berger's Disease)
N02.8 | Recurrent and persistent hematuria with other morphologic changes | PRIMARY CODE for IgA nephropathy. PPV ~99% per Sim et al. 2023 (Clin Kidney J)
N02.B1 | Recurrent and persistent hematuria with focal segmental hyalinosis/sclerosis | Added October 2023
N02.B2 | Recurrent and persistent hematuria with membranous glomerulonephritis | Added October 2023
N02.B3 | Recurrent and persistent hematuria with diffuse mesangial proliferative glomerulonephritis | HIGH confidence for IgAN
N02.B4 | Recurrent and persistent hematuria with diffuse endocapillary proliferative glomerulonephritis | Added October 2023
N02.B5 | Recurrent and persistent hematuria with diffuse mesangiocapillary glomerulonephritis | Added October 2023
N02.B6 | Recurrent and persistent hematuria with dense deposit disease | Added October 2023

### Primary Membranous Nephropathy (PMN)
N04.2 | Nephrotic syndrome with diffuse membranous glomerulonephritis | Primary PMN code
N04.20 | Nephrotic syndrome with diffuse membranous glomerulonephritis, unspecified
N04.21 | Nephrotic syndrome with primary membranous nephropathy | Specific PMN code - Added October 2023
N04.22 | Nephrotic syndrome with secondary membranous nephropathy | Secondary causes
N04.29 | Other nephrotic syndrome with diffuse membranous glomerulonephritis
N06.2 | Isolated proteinuria with diffuse membranous glomerulonephritis
N06.20 | Isolated proteinuria with diffuse membranous glomerulonephritis, unspecified
N06.21 | Isolated proteinuria with primary membranous nephropathy | Added October 2023
N06.22 | Isolated proteinuria with secondary membranous nephropathy | Added October 2023
N06.29 | Other isolated proteinuria with diffuse membranous glomerulonephritis

### Chronic Kidney Disease (CKD)
N18.1 | Chronic kidney disease, stage 1 | GFR ≥90
N18.2 | Chronic kidney disease, stage 2 | GFR 60-89
N18.3 | Chronic kidney disease, stage 3 (moderate) | GFR 30-59
N18.30 | Chronic kidney disease, stage 3 unspecified
N18.31 | Chronic kidney disease, stage 3a | GFR 45-59
N18.32 | Chronic kidney disease, stage 3b | GFR 30-44
N18.4 | Chronic kidney disease, stage 4 | GFR 15-29
N18.5 | Chronic kidney disease, stage 5 | GFR <15
N18.6 | End stage renal disease | ESRD - dialysis/transplant
N18.9 | Chronic kidney disease, unspecified

### Lupus Nephritis
M32.14 | Glomerular disease in systemic lupus erythematosus | PRIMARY lupus nephritis code
M32.15 | Tubulo-interstitial nephropathy in systemic lupus erythematosus
N08 | Glomerular disorders in diseases classified elsewhere | Secondary code - use with M32.x
M32.10 | Systemic lupus erythematosus, organ involvement unspecified
M32.11 | Endocarditis in systemic lupus erythematosus
M32.12 | Pericarditis in systemic lupus erythematosus
M32.19 | Other organ involvement in systemic lupus erythematosus

### Focal Segmental Glomerulosclerosis (FSGS)
N04.1 | Nephrotic syndrome with focal and segmental glomerular lesions | Primary FSGS code
N06.1 | Isolated proteinuria with focal and segmental glomerular lesions | FSGS with proteinuria
N07.1 | Hereditary nephropathy with focal and segmental glomerulosclerosis | Hereditary FSGS
N04.10 | Nephrotic syndrome with focal/segmental, unspecified
N04.11 | Nephrotic syndrome with focal/segmental hyalinosis
N04.19 | Nephrotic syndrome with other focal/segmental

### Diabetic Nephropathy / Diabetic Kidney Disease
E11.21 | Type 2 diabetes mellitus with diabetic nephropathy | T2DM with nephropathy
E11.22 | Type 2 diabetes mellitus with diabetic chronic kidney disease | T2DM with CKD
E11.29 | Type 2 diabetes mellitus with other diabetic kidney complication
E10.21 | Type 1 diabetes mellitus with diabetic nephropathy | T1DM with nephropathy
E10.22 | Type 1 diabetes mellitus with diabetic chronic kidney disease | T1DM with CKD
E10.29 | Type 1 diabetes mellitus with other diabetic kidney complication
E13.21 | Other specified diabetes mellitus with diabetic nephropathy
E13.22 | Other specified diabetes mellitus with diabetic chronic kidney disease

### Minimal Change Disease
N04.0 | Nephrotic syndrome with minor glomerular abnormality | Minimal change disease
N06.0 | Isolated proteinuria with minor glomerular abnormality

### ANCA-Associated Vasculitis
M31.31 | Granulomatosis with polyangiitis (GPA/Wegener's)
M31.30 | Wegener's granulomatosis without renal involvement
M35.81 | Multisystem inflammatory syndrome
I77.6 | Arteritis, unspecified

### Polycystic Kidney Disease
Q61.2 | Polycystic kidney, adult type (ADPKD)
Q61.3 | Polycystic kidney, unspecified
Q61.11 | Cystic dilatation of collecting ducts

### Glomerulonephritis - General
N00 | Acute nephritic syndrome
N01 | Rapidly progressive nephritic syndrome
N03 | Chronic nephritic syndrome
N05 | Unspecified nephritic syndrome

### Acute Kidney Injury
N17.0 | Acute kidney failure with tubular necrosis
N17.1 | Acute kidney failure with acute cortical necrosis
N17.2 | Acute kidney failure with medullary necrosis
N17.8 | Other acute kidney failure
N17.9 | Acute kidney failure, unspecified

## Cardiology Codes

### Heart Failure
I50.1 | Left ventricular failure, unspecified
I50.20 | Unspecified systolic (congestive) heart failure
I50.21 | Acute systolic (congestive) heart failure
I50.22 | Chronic systolic (congestive) heart failure
I50.23 | Acute on chronic systolic (congestive) heart failure
I50.30 | Unspecified diastolic (congestive) heart failure
I50.31 | Acute diastolic (congestive) heart failure
I50.32 | Chronic diastolic (congestive) heart failure
I50.33 | Acute on chronic diastolic (congestive) heart failure
I50.40 | Unspecified combined systolic and diastolic heart failure
I50.41 | Acute combined systolic and diastolic heart failure
I50.42 | Chronic combined systolic and diastolic heart failure
I50.43 | Acute on chronic combined systolic and diastolic heart failure
I50.810 | Right heart failure, unspecified
I50.811 | Acute right heart failure
I50.812 | Chronic right heart failure
I50.813 | Acute on chronic right heart failure
I50.814 | Right heart failure due to left heart failure
I50.82 | Biventricular heart failure
I50.83 | High output heart failure
I50.84 | End stage heart failure
I50.89 | Other heart failure
I50.9 | Heart failure, unspecified

### Atrial Fibrillation
I48.0 | Paroxysmal atrial fibrillation
I48.1 | Persistent atrial fibrillation
I48.2 | Chronic atrial fibrillation
I48.11 | Longstanding persistent atrial fibrillation
I48.19 | Other persistent atrial fibrillation
I48.20 | Chronic atrial fibrillation, unspecified
I48.21 | Permanent atrial fibrillation
I48.91 | Unspecified atrial fibrillation

### Coronary Artery Disease / Ischemic Heart Disease
I25.10 | Atherosclerotic heart disease of native coronary artery without angina pectoris
I25.110 | Atherosclerotic heart disease of native coronary artery with unstable angina pectoris
I25.111 | Atherosclerotic heart disease of native coronary artery with angina pectoris with documented spasm
I25.118 | Atherosclerotic heart disease of native coronary artery with other forms of angina pectoris
I25.119 | Atherosclerotic heart disease of native coronary artery with unspecified angina pectoris
I25.5 | Ischemic cardiomyopathy
I25.6 | Silent myocardial ischemia
I25.700 | Atherosclerosis of coronary artery bypass graft(s), unspecified
I25.810 | Atherosclerosis of coronary artery bypass graft(s) without angina pectoris

### Hypertension
I10 | Essential (primary) hypertension
I11.0 | Hypertensive heart disease with heart failure
I11.9 | Hypertensive heart disease without heart failure
I12.0 | Hypertensive chronic kidney disease with stage 5 CKD or ESRD
I12.9 | Hypertensive chronic kidney disease with stage 1-4 CKD
I13.0 | Hypertensive heart and CKD with heart failure and stage 1-4 CKD
I13.10 | Hypertensive heart and CKD without heart failure, with stage 1-4 CKD
I13.11 | Hypertensive heart and CKD without heart failure, with stage 5 CKD or ESRD
I13.2 | Hypertensive heart and CKD with heart failure and stage 5 CKD or ESRD
I15.0 | Renovascular hypertension
I15.1 | Hypertension secondary to other renal disorders
I15.2 | Hypertension secondary to endocrine disorders
I15.8 | Other secondary hypertension
I15.9 | Secondary hypertension, unspecified

## Endocrinology Codes

### Diabetes Mellitus
E10.9 | Type 1 diabetes mellitus without complications
E11.9 | Type 2 diabetes mellitus without complications
E10.65 | Type 1 diabetes mellitus with hyperglycemia
E11.65 | Type 2 diabetes mellitus with hyperglycemia
E10.10 | Type 1 diabetes mellitus with ketoacidosis without coma
E10.11 | Type 1 diabetes mellitus with ketoacidosis with coma
E11.00 | Type 2 diabetes mellitus with hyperosmolarity without NKHHC
E11.01 | Type 2 diabetes mellitus with hyperosmolarity with coma

### Thyroid Disorders
E05.00 | Thyrotoxicosis with diffuse goiter without thyrotoxic crisis
E05.01 | Thyrotoxicosis with diffuse goiter with thyrotoxic crisis
E05.10 | Thyrotoxicosis with toxic single thyroid nodule without thyrotoxic crisis
E05.20 | Thyrotoxicosis with toxic multinodular goiter without thyrotoxic crisis
E03.9 | Hypothyroidism, unspecified
E06.3 | Autoimmune thyroiditis (Hashimoto's)

## Pulmonology Codes

### COPD
J44.0 | Chronic obstructive pulmonary disease with acute lower respiratory infection
J44.1 | Chronic obstructive pulmonary disease with acute exacerbation
J44.9 | Chronic obstructive pulmonary disease, unspecified

### Asthma
J45.20 | Mild intermittent asthma, uncomplicated
J45.30 | Mild persistent asthma, uncomplicated
J45.40 | Moderate persistent asthma, uncomplicated
J45.50 | Severe persistent asthma, uncomplicated
J45.901 | Unspecified asthma with acute exacerbation
J45.902 | Unspecified asthma with status asthmaticus

## Rheumatology Codes

### Rheumatoid Arthritis
M05.79 | Rheumatoid arthritis with rheumatoid factor of multiple sites without organ involvement
M06.09 | Rheumatoid arthritis without rheumatoid factor, multiple sites
M05.00 | Felty's syndrome, unspecified site

### Systemic Lupus Erythematosus
M32.0 | Drug-induced systemic lupus erythematosus
M32.10 | Systemic lupus erythematosus, organ involvement unspecified
M32.11 | Endocarditis in systemic lupus erythematosus
M32.12 | Pericarditis in systemic lupus erythematosus
M32.13 | Lung involvement in systemic lupus erythematosus
M32.14 | Glomerular disease in systemic lupus erythematosus (Lupus Nephritis)
M32.15 | Tubulo-interstitial nephropathy in systemic lupus erythematosus
M32.19 | Other organ or system involvement in systemic lupus erythematosus
M32.8 | Other forms of systemic lupus erythematosus
M32.9 | Systemic lupus erythematosus, unspecified

## Oncology / Hematology Codes

### Multiple Myeloma
C90.00 | Multiple myeloma not having achieved remission
C90.01 | Multiple myeloma in remission
C90.02 | Multiple myeloma in relapse

### Lymphoma
C81 | Hodgkin lymphoma
C82 | Follicular lymphoma
C83 | Non-follicular lymphoma
C84 | Mature T/NK-cell lymphomas
C85 | Other and unspecified types of non-Hodgkin lymphoma

### Leukemia
C91.00 | Acute lymphoblastic leukemia not having achieved remission
C91.10 | Chronic lymphocytic leukemia of B-cell type not having achieved remission
C92.00 | Acute myeloblastic leukemia not having achieved remission
C92.10 | Chronic myeloid leukemia, BCR/ABL-positive, not having achieved remission

## Neurology Codes

### Dementia
F03.90 | Unspecified dementia without behavioral disturbance
G30.0 | Alzheimer's disease with early onset
G30.1 | Alzheimer's disease with late onset
G30.8 | Other Alzheimer's disease
G30.9 | Alzheimer's disease, unspecified

### Parkinson's Disease
G20 | Parkinson's disease

### Multiple Sclerosis
G35 | Multiple sclerosis

### Stroke
I63 | Cerebral infarction
I61 | Intracerebral hemorrhage
I60 | Subarachnoid hemorrhage

## Psychiatry Codes

### Depression
F32.0 | Major depressive disorder, single episode, mild
F32.1 | Major depressive disorder, single episode, moderate
F32.2 | Major depressive disorder, single episode, severe without psychotic features
F32.3 | Major depressive disorder, single episode, severe with psychotic features
F32.4 | Major depressive disorder, single episode, in partial remission
F32.5 | Major depressive disorder, single episode, in full remission
F32.9 | Major depressive disorder, single episode, unspecified
F33.0 | Major depressive disorder, recurrent, mild
F33.1 | Major depressive disorder, recurrent, moderate
F33.2 | Major depressive disorder, recurrent severe without psychotic features
F33.3 | Major depressive disorder, recurrent, severe with psychotic symptoms
F33.40 | Major depressive disorder, recurrent, in remission, unspecified
F33.41 | Major depressive disorder, recurrent, in partial remission
F33.42 | Major depressive disorder, recurrent, in full remission
F33.9 | Major depressive disorder, recurrent, unspecified

### Anxiety Disorders
F41.0 | Panic disorder without agoraphobia
F41.1 | Generalized anxiety disorder
F41.8 | Other specified anxiety disorders
F41.9 | Anxiety disorder, unspecified

## Gastroenterology Codes

### Inflammatory Bowel Disease
K50.00 | Crohn's disease of small intestine without complications
K50.10 | Crohn's disease of large intestine without complications
K50.80 | Crohn's disease of both small and large intestine without complications
K50.90 | Crohn's disease, unspecified, without complications
K51.00 | Ulcerative pancolitis without complications
K51.20 | Ulcerative proctitis without complications
K51.30 | Ulcerative rectosigmoiditis without complications
K51.50 | Left sided colitis without complications
K51.80 | Other ulcerative colitis without complications
K51.90 | Ulcerative colitis, unspecified, without complications

### Liver Disease
K70.30 | Alcoholic cirrhosis of liver without ascites
K70.31 | Alcoholic cirrhosis of liver with ascites
K74.60 | Unspecified cirrhosis of liver
K74.69 | Other cirrhosis of liver
K76.0 | Fatty liver, not elsewhere classified
K75.81 | Nonalcoholic steatohepatitis (NASH)
`;

const CPT_CODES_CONTENT = `# CPT Procedure Codes - Medical Billing Reference
# Source: AMA CPT Code Set 2024 / Medicare Physician Fee Schedule
# Last Updated: 2026-01-29

## Renal / Nephrology Procedures

### Kidney Biopsy
50200 | Renal biopsy; percutaneous, by trocar or needle | Standard percutaneous kidney biopsy - gold standard for diagnosing glomerular diseases
50205 | Renal biopsy; by surgical exposure of kidney | Open surgical kidney biopsy
50555 | Renal endoscopy through nephrotomy or pyelotomy, with biopsy | Endoscopic kidney biopsy
50557 | Renal endoscopy through nephrotomy or pyelotomy, with fulguration and/or incision | Endoscopic procedure with tissue destruction

### Dialysis Procedures
90935 | Hemodialysis procedure with single evaluation by a physician or other qualified health care professional | Standard hemodialysis session
90937 | Hemodialysis procedure requiring repeated evaluation(s) with or without substantial revision of dialysis prescription | Complex hemodialysis
90945 | Dialysis procedure other than hemodialysis, with single evaluation | Peritoneal dialysis, single evaluation
90947 | Dialysis procedure other than hemodialysis, requiring repeated evaluations | Peritoneal dialysis, complex
90951 | End-stage renal disease (ESRD) related services monthly, for patients younger than 2 years of age
90952 | End-stage renal disease (ESRD) related services monthly, for patients 2-11 years of age
90953 | End-stage renal disease (ESRD) related services monthly, for patients 12-19 years of age
90954 | End-stage renal disease (ESRD) related services monthly, for patients 20 years of age and older
90955 | ESRD related services monthly, for patients younger than 2 years of age with 4 or more face-to-face visits
90956 | ESRD related services monthly, for patients 2-11 years of age with 4 or more face-to-face visits
90957 | ESRD related services monthly, for patients 12-19 years of age with 4 or more face-to-face visits
90958 | ESRD related services monthly, for patients 20 years of age and older with 4 or more face-to-face visits
90959 | ESRD related services monthly, for patients younger than 2 years of age with 2-3 face-to-face visits
90960 | ESRD related services monthly, for patients 2-11 years of age with 2-3 face-to-face visits
90961 | ESRD related services monthly, for patients 12-19 years of age with 2-3 face-to-face visits
90962 | ESRD related services monthly, for patients 20 years of age and older with 2-3 face-to-face visits
90963 | ESRD related services monthly, for patients younger than 2 years of age with 1 face-to-face visit
90964 | ESRD related services monthly, for patients 2-11 years of age with 1 face-to-face visit
90965 | ESRD related services monthly, for patients 12-19 years of age with 1 face-to-face visit
90966 | ESRD related services monthly, for patients 20 years of age and older with 1 face-to-face visit

### Dialysis Access Procedures
36147 | Introduction of needle and/or catheter, arteriovenous shunt created for dialysis (cannula, fistula or graft); initial access with complete radiological evaluation | Dialysis access - diagnostic study
36148 | Introduction of needle and/or catheter, arteriovenous shunt created for dialysis (cannula, fistula or graft); additional access for therapeutic intervention | Dialysis access - therapeutic
36800 | Insertion of cannula for hemodialysis, other purpose (separate procedure); vein to vein | Hemodialysis cannula insertion
36810 | Insertion of cannula for hemodialysis, other purpose (separate procedure); arteriovenous, external (Scribner type) | AV cannula - external
36815 | Insertion of cannula for hemodialysis, other purpose (separate procedure); arteriovenous, external revision, or closure | AV cannula revision/closure
36818 | Arteriovenous anastomosis, open; by upper arm cephalic vein transposition | AV fistula creation - upper arm
36819 | Arteriovenous anastomosis, open; by upper arm basilic vein transposition | AV fistula creation - basilic vein
36820 | Arteriovenous anastomosis, open; by forearm vein transposition | AV fistula creation - forearm
36821 | Arteriovenous anastomosis, open; direct, any site | Direct AV fistula
36825 | Creation of arteriovenous fistula by other than direct arteriovenous anastomosis | Prosthetic AV fistula
36830 | Creation of arteriovenous fistula by other than direct arteriovenous anastomosis; nonautogenous graft | AV graft placement

### Kidney Transplant
50300 | Donor nephrectomy (including cold preservation); from cadaver donor, unilateral or bilateral | Cadaver kidney harvest
50320 | Donor nephrectomy (including cold preservation); open, from living donor | Living donor nephrectomy - open
50323 | Backbench standard preparation of cadaver donor renal allograft prior to transplantation | Kidney preparation
50325 | Backbench standard preparation of living donor renal allograft prior to transplantation | Living donor kidney preparation
50340 | Recipient nephrectomy (separate procedure) | Removal of recipient kidney
50360 | Renal allotransplantation, implantation of graft; without recipient nephrectomy | Kidney transplant without removal
50365 | Renal allotransplantation, implantation of graft; with recipient nephrectomy | Kidney transplant with removal

## Laboratory Tests - Kidney Function

### Urinalysis
81000 | Urinalysis, by dip stick or tablet reagent; non-automated, with microscopy | Urinalysis with microscopy
81001 | Urinalysis, by dip stick or tablet reagent; automated, with microscopy | Automated urinalysis with microscopy
81002 | Urinalysis, by dip stick or tablet reagent; non-automated, without microscopy | Urinalysis without microscopy
81003 | Urinalysis, by dip stick or tablet reagent; automated, without microscopy | Automated urinalysis
81005 | Urinalysis; qualitative or semi-quantitative, except immunoassays | Qualitative urinalysis

### Kidney Function Labs
82040 | Albumin; serum, plasma or whole blood | Serum albumin
82043 | Urine albumin, quantitative | Quantitative urine albumin - important for CKD/proteinuria
82044 | Urine albumin, semiquantitative | Semiquantitative urine albumin
82565 | Creatinine; blood | Serum creatinine
82570 | Creatinine; other source | Creatinine - urine or other
82575 | Creatinine; clearance | Creatinine clearance - GFR calculation
83036 | Hemoglobin; glycated (A1c) | HbA1c - diabetes monitoring
84075 | Phosphatase, alkaline | Alkaline phosphatase
84132 | Potassium; serum, plasma or whole blood | Serum potassium
84155 | Protein, total, except by refractometry; serum, plasma or whole blood | Total protein
84156 | Protein, total, except by refractometry; urine | Total urine protein
84295 | Sodium; serum, plasma or whole blood | Serum sodium
84520 | Urea nitrogen; quantitative | BUN - blood urea nitrogen
84540 | Urea nitrogen; urine | Urine urea nitrogen
84545 | Urea nitrogen, clearance | Urea clearance
84550 | Uric acid; blood | Serum uric acid

### Specialized Kidney Tests
82784 | Gammaglobulin (immunoglobulin); IgA, IgD, IgG, IgM, each | Immunoglobulin levels - IgA for IgAN
86141 | C-reactive protein; high sensitivity (hsCRP) | High-sensitivity CRP
86200 | Cyclic citrullinated peptide (CCP), antibody | Anti-CCP antibody
86225 | Deoxyribonucleic acid (DNA) antibody; native or double stranded | Anti-dsDNA - lupus
86235 | Extractable nuclear antigen, antibody to, any method | ENA panel - lupus
86038 | Antinuclear antibodies (ANA) | ANA - autoimmune screen
86039 | Antinuclear antibodies (ANA); titer | ANA titer
86060 | Antistreptolysin O; titer | ASO titer - post-strep GN
83883 | Nephelometry, each analyte not elsewhere specified | Nephelometry testing
82785 | Gammaglobulin (immunoglobulin); IgE | IgE levels

## Office Visits / Evaluation & Management

### Outpatient E&M Codes
99202 | Office or other outpatient visit for the evaluation and management of a new patient; straightforward MDM | New patient, straightforward
99203 | Office or other outpatient visit for the evaluation and management of a new patient; low MDM | New patient, low complexity
99204 | Office or other outpatient visit for the evaluation and management of a new patient; moderate MDM | New patient, moderate complexity
99205 | Office or other outpatient visit for the evaluation and management of a new patient; high MDM | New patient, high complexity
99211 | Office or other outpatient visit for the evaluation and management of an established patient; minimal | Established patient, minimal
99212 | Office or other outpatient visit for the evaluation and management of an established patient; straightforward MDM | Established patient, straightforward
99213 | Office or other outpatient visit for the evaluation and management of an established patient; low MDM | Established patient, low complexity (15-29 min)
99214 | Office or other outpatient visit for the evaluation and management of an established patient; moderate MDM | Established patient, moderate complexity (30-39 min)
99215 | Office or other outpatient visit for the evaluation and management of an established patient; high MDM | Established patient, high complexity (40-54 min)

### Hospital E&M Codes
99221 | Initial hospital care, per day, for the evaluation and management of a patient; straightforward or low MDM | Initial hospital, low
99222 | Initial hospital care, per day, for the evaluation and management of a patient; moderate MDM | Initial hospital, moderate
99223 | Initial hospital care, per day, for the evaluation and management of a patient; high MDM | Initial hospital, high
99231 | Subsequent hospital care, per day; straightforward or low MDM | Subsequent hospital, low
99232 | Subsequent hospital care, per day; moderate MDM | Subsequent hospital, moderate
99233 | Subsequent hospital care, per day; high MDM | Subsequent hospital, high

## Cardiology Procedures

### Echocardiography
93306 | Echocardiography, transthoracic, real-time with image documentation (2D), with or without M-mode; complete | Complete TTE
93307 | Echocardiography, transthoracic, real-time with image documentation (2D), with or without M-mode; limited | Limited TTE
93308 | Echocardiography, transthoracic, real-time with image documentation (2D), with or without M-mode; follow-up or limited | Follow-up TTE
93312 | Echocardiography, transesophageal, real-time with image documentation (2D); including probe placement | TEE

### Cardiac Catheterization
93451 | Right heart catheterization | Right heart cath
93452 | Left heart catheterization including intraprocedural injection(s) for left ventriculography | Left heart cath
93453 | Combined right and left heart catheterization | Combined heart cath
93454 | Catheter placement in coronary artery(s) for coronary angiography | Coronary angiography
93458 | Catheter placement in coronary artery(s) for coronary angiography; with left heart catheterization | Coronary angio with left cath

### Pacemaker/ICD Procedures
33206 | Insertion of new or replacement of permanent pacemaker with transvenous electrode(s); atrial | Atrial pacemaker
33207 | Insertion of new or replacement of permanent pacemaker with transvenous electrode(s); ventricular | Ventricular pacemaker
33208 | Insertion of new or replacement of permanent pacemaker with transvenous electrode(s); atrial and ventricular | Dual-chamber pacemaker
33249 | Insertion or replacement of permanent implantable defibrillator system, with transvenous lead(s) | ICD implant

## Infusion Procedures

### Drug Infusions
96365 | Intravenous infusion, for therapy, prophylaxis, or diagnosis; initial, up to 1 hour | IV infusion, initial hour
96366 | Intravenous infusion, for therapy, prophylaxis, or diagnosis; each additional hour | IV infusion, additional hour
96367 | Intravenous infusion, for therapy, prophylaxis, or diagnosis; additional sequential infusion | Sequential infusion
96368 | Intravenous infusion, for therapy, prophylaxis, or diagnosis; concurrent infusion | Concurrent infusion
96369 | Subcutaneous infusion for therapy or prophylaxis; initial, up to 1 hour | SubQ infusion, initial
96370 | Subcutaneous infusion for therapy or prophylaxis; each additional hour | SubQ infusion, additional
96371 | Subcutaneous infusion for therapy or prophylaxis; additional pump setup | Additional pump setup
96372 | Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular | IM/SubQ injection
96374 | Therapeutic, prophylactic, or diagnostic injection; intravenous push, single or initial substance/drug | IV push, initial
96375 | Therapeutic, prophylactic, or diagnostic injection; each additional sequential intravenous push | IV push, additional
96376 | Therapeutic, prophylactic, or diagnostic injection; each additional sequential intravenous push | IV push, concurrent

### Chemotherapy Administration
96401 | Chemotherapy administration, subcutaneous or intramuscular; non-hormonal anti-neoplastic | Chemo SubQ/IM
96402 | Chemotherapy administration, subcutaneous or intramuscular; hormonal anti-neoplastic | Hormone chemo SubQ/IM
96409 | Chemotherapy administration; intravenous, push technique, single or initial substance/drug | Chemo IV push, initial
96411 | Chemotherapy administration; intravenous, push technique, each additional substance/drug | Chemo IV push, additional
96413 | Chemotherapy administration, intravenous infusion technique; up to 1 hour, single or initial | Chemo IV infusion, initial
96415 | Chemotherapy administration, intravenous infusion technique; each additional hour | Chemo IV infusion, additional
96416 | Chemotherapy administration, intravenous infusion technique; initiation of prolonged chemotherapy infusion | Prolonged chemo infusion
96417 | Chemotherapy administration, intravenous infusion technique; each additional sequential infusion | Sequential chemo infusion
`;

const HCPCS_CODES_CONTENT = `# HCPCS Level II Drug and Supply Codes - Medical Billing Reference
# Source: CMS HCPCS Level II Code Set 2024
# Last Updated: 2026-01-29

## Immunosuppressant Drugs

### Rituximab and Biosimilars
J9312 | Injection, rituximab, 10 mg | Rituximab (Rituxan) - CD20 monoclonal antibody, used for IgAN, PMN, lupus nephritis, vasculitis
J9311 | Injection, rituximab-abbs (Truxima), 10 mg | Rituximab biosimilar
J9316 | Injection, rituximab-arrx, 10 mg | Rituximab biosimilar (Riabni)
J9318 | Injection, rituximab-pvvr, 10 mg | Rituximab biosimilar (Ruxience)

### Calcineurin Inhibitors
J7502 | Cyclosporine, oral, 100 mg | Cyclosporine (Neoral, Sandimmune) - calcineurin inhibitor, used for PMN, FSGS, lupus nephritis
J7515 | Cyclosporine, oral, 25 mg | Cyclosporine 25mg
J7516 | Tacrolimus, oral, 1 mg | Tacrolimus (Prograf) - calcineurin inhibitor, used for PMN, FSGS, transplant
J7520 | Tacrolimus, injection, per 5 mg | Tacrolimus IV
J7525 | Tacrolimus, extended release, oral, 0.25 mg | Tacrolimus XR (Envarsus, Astagraf)
J7527 | Tacrolimus, extended release, oral, 1 mg | Tacrolimus XR 1mg

### Other Immunosuppressants
J7500 | Azathioprine, oral, 50 mg | Azathioprine (Imuran) - immunosuppressant, used for lupus nephritis, IgAN
J7501 | Azathioprine, parenteral, 100 mg | Azathioprine IV
J7517 | Mycophenolate mofetil, oral, 250 mg | Mycophenolate (CellCept) - used for lupus nephritis, PMN, IgAN
J7518 | Mycophenolic acid, oral, 180 mg | Mycophenolic acid (Myfortic)
J8610 | Methotrexate; oral, 2.5 mg | Methotrexate - used for lupus, RA
J9250 | Methotrexate sodium, 5 mg | Methotrexate injection
J9260 | Methotrexate sodium, 50 mg | Methotrexate injection 50mg

### Corticosteroids
J1020 | Injection, methylprednisolone acetate, 20 mg | Methylprednisolone (Depo-Medrol) 20mg - IV steroid
J1030 | Injection, methylprednisolone acetate, 40 mg | Methylprednisolone 40mg
J1040 | Injection, methylprednisolone acetate, 80 mg | Methylprednisolone 80mg
J2920 | Injection, methylprednisolone sodium succinate, up to 40 mg | Methylprednisolone (Solu-Medrol) up to 40mg
J2930 | Injection, methylprednisolone sodium succinate, up to 125 mg | Methylprednisolone up to 125mg
J0702 | Injection, betamethasone acetate and betamethasone sodium phosphate, per 3 mg | Betamethasone injection
J1094 | Injection, dexamethasone acetate, 1 mg | Dexamethasone acetate
J1100 | Injection, dexamethasone sodium phosphate, 1 mg | Dexamethasone sodium phosphate
J2650 | Injection, prednisolone acetate, up to 1 ml | Prednisolone acetate
J2680 | Injection, fluphenazine decanoate, up to 25 mg | Fluphenazine

## Biologic Agents

### TNF Inhibitors
J0135 | Injection, adalimumab, 20 mg | Adalimumab (Humira) - used off-label in some kidney diseases
J1438 | Injection, etanercept, 25 mg | Etanercept (Enbrel)
J1745 | Injection, infliximab, excludes biosimilar, 10 mg | Infliximab (Remicade)
Q5103 | Injection, infliximab-dyyb, biosimilar, 10 mg | Infliximab biosimilar (Inflectra)
Q5104 | Injection, infliximab-abda, biosimilar, 10 mg | Infliximab biosimilar (Renflexis)
Q5109 | Injection, infliximab-axxq, biosimilar, 10 mg | Infliximab biosimilar (Avsola)

### Lupus-Specific Biologics
J0490 | Injection, belimumab, 10 mg | Belimumab (Benlysta) - B-lymphocyte stimulator inhibitor, approved for lupus nephritis
C9399 | Unclassified drugs or biologicals | Voclosporin (Lupkynis) - calcineurin inhibitor approved for lupus nephritis 2021

### IL-6 Inhibitors
J3262 | Injection, tocilizumab, 1 mg | Tocilizumab (Actemra) - IL-6 inhibitor

### Complement Inhibitors
J1303 | Injection, ravulizumab-cwvz, 10 mg | Ravulizumab (Ultomiris) - complement C5 inhibitor, for aHUS, PNH
J1300 | Injection, eculizumab, 10 mg | Eculizumab (Soliris) - complement C5 inhibitor, for aHUS, PNH

## Erythropoiesis-Stimulating Agents (ESAs)

J0881 | Injection, darbepoetin alfa, 1 mcg (non-ESRD use) | Darbepoetin (Aranesp) for anemia of CKD (non-dialysis)
J0882 | Injection, darbepoetin alfa, 1 mcg (for ESRD on dialysis) | Darbepoetin for ESRD
J0885 | Injection, epoetin alfa, (for non-ESRD use), 1000 units | Epoetin alfa (Epogen, Procrit) non-ESRD
Q4081 | Injection, epoetin alfa, 100 units (for ESRD on dialysis) | Epoetin alfa for ESRD

## Iron Products

J1439 | Injection, ferric carboxymaltose, 1 mg | Ferric carboxymaltose (Injectafer)
J1750 | Injection, iron dextran, 50 mg | Iron dextran
J1756 | Injection, iron sucrose, 1 mg | Iron sucrose (Venofer)
J2916 | Injection, sodium ferric gluconate complex in sucrose injection, 12.5 mg | Ferric gluconate (Ferrlecit)

## Phosphate Binders and CKD-MBD Drugs

J0630 | Injection, calcitonin salmon, up to 400 units | Calcitonin
J0636 | Injection, calcitriol, 0.1 mcg | Calcitriol (Calcijex) - vitamin D
J1270 | Injection, doxercalciferol, 1 mcg | Doxercalciferol (Hectorol) - vitamin D analog
J2501 | Injection, paricalcitol, 1 mcg | Paricalcitol (Zemplar) - vitamin D analog
J0895 | Injection, deferoxamine mesylate, 500 mg | Deferoxamine - iron chelator
J3490 | Unclassified drugs | Used for drugs without specific HCPCS codes

## Cardiovascular Drugs

### Heart Failure Medications
J2260 | Injection, milrinone lactate, 5 mg | Milrinone (Primacor) - inotrope for heart failure
J1250 | Injection, dobutamine hydrochloride, per 250 mg | Dobutamine - inotrope
J3010 | Injection, fentanyl citrate, 0.1 mg | Fentanyl
J2405 | Injection, ondansetron hydrochloride, per 1 mg | Ondansetron (Zofran)

### Diuretics
J1940 | Injection, furosemide, up to 20 mg | Furosemide (Lasix) - loop diuretic
J0171 | Injection, adrenalin, epinephrine, 0.1 mg | Epinephrine
J0280 | Injection, aminophylline, up to 250 mg | Aminophylline

### Anticoagulants
J1644 | Injection, heparin sodium, per 1000 units | Heparin
J1652 | Injection, fondaparinux sodium, 0.5 mg | Fondaparinux (Arixtra)
J1650 | Injection, enoxaparin sodium, 10 mg | Enoxaparin (Lovenox)

## Oncology / Chemotherapy Drugs

### Alkylating Agents
J9070 | Cyclophosphamide, 100 mg | Cyclophosphamide (Cytoxan) - used for lupus nephritis, vasculitis, some glomerular diseases
J9080 | Cyclophosphamide, 200 mg | Cyclophosphamide 200mg
J9090 | Cyclophosphamide, 500 mg | Cyclophosphamide 500mg
J9065 | Injection, cladribine, per 1 mg | Cladribine

### Antimetabolites
J9190 | Injection, fluorouracil, 500 mg | Fluorouracil (5-FU)
J9263 | Injection, oxaliplatin, 0.5 mg | Oxaliplatin

### Targeted Therapies
J9035 | Injection, bevacizumab, 10 mg | Bevacizumab (Avastin)
J9305 | Injection, pemetrexed, 10 mg | Pemetrexed (Alimta)
J9355 | Injection, trastuzumab, 10 mg | Trastuzumab (Herceptin)
J9306 | Injection, pertuzumab, 1 mg | Pertuzumab (Perjeta)

## Dialysis Supplies and Equipment

A4653 | Peritoneal dialysis catheter anchoring device, belt, each | PD catheter belt
A4657 | Syringe, with or without needle, each | Syringe
A4660 | Sphygmomanometer/blood pressure apparatus with cuff and stethoscope | Blood pressure cuff
A4670 | Automatic blood pressure monitor | Auto BP monitor
A4913 | Miscellaneous dialysis supplies, not otherwise specified | Misc dialysis supplies
E1575 | Transducer, external, ambulatory blood pressure monitor | External BP transducer
E1632 | Wearable artificial kidney, each | Wearable artificial kidney
E1634 | Peritoneal dialysis clamps, each | PD clamp

## Infusion Supplies

A4221 | Supplies for maintenance of drug infusion catheter, per week | Infusion catheter supplies
A4222 | Supplies for external drug infusion pump, per cassette or bag | External pump supplies
A4223 | Infusion supplies for external drug infusion pump, per cassette or bag, sterile | Sterile infusion supplies
A4224 | Supplies for maintenance of insulin infusion catheter, per week | Insulin pump supplies
A4230 | Infusion set for external insulin pump, non-needle cannula type | Insulin infusion set
A4231 | Infusion set for external insulin pump, needle type | Needle insulin infusion set

## Vaccines and Immunizations

90632 | Hepatitis A vaccine, adult dosage | Hep A vaccine
90636 | Hepatitis A and hepatitis B vaccine, adult dosage | Hep A+B combo
90740 | Hepatitis B vaccine, dialysis or immunosuppressed patient dosage | Hep B for dialysis/immunocomp
90743 | Hepatitis B vaccine, adolescent, 2-dose schedule | Hep B adolescent
90744 | Hepatitis B vaccine, pediatric/adolescent dosage, 3-dose schedule | Hep B pediatric
90746 | Hepatitis B vaccine, adult dosage | Hep B adult
90732 | Pneumococcal polysaccharide vaccine, 23-valent (PPSV23) | Pneumococcal vaccine
90670 | Pneumococcal conjugate vaccine, 13-valent (PCV13) | Prevnar 13
90471 | Immunization administration | Vaccine administration
`;

const MEDICAL_GUIDELINES_CONTENT = `# Clinical Practice Guidelines Reference
# Compiled from major medical societies
# Last Updated: 2026-01-29

## Nephrology Guidelines

### KDIGO Guidelines (Kidney Disease: Improving Global Outcomes)

#### IgA Nephropathy (KDIGO 2021)
- **Diagnosis**: Kidney biopsy showing mesangial IgA deposits is required for definitive diagnosis
- **ICD-10 Coding**: N02.8 is the primary code with ~99% PPV per validation studies
- **First-line Treatment**: 
  - Optimized supportive care: ACE inhibitors or ARBs for all patients
  - BP target <130/80 mmHg
  - Proteinuria target <0.5-1 g/day
- **Immunosuppression Considerations**:
  - Consider corticosteroids if persistent proteinuria >0.75-1 g/day after 3-6 months of supportive care
  - Rituximab may be considered in refractory cases (off-label)
- **New Treatments (2023-2024)**:
  - Sparsentan (Filspari) - FDA approved Feb 2023 for IgAN
  - Targeted-release budesonide (Tarpeyo) - approved Dec 2021 for IgAN
- **Relevant CPT/HCPCS**:
  - 50200 - Renal biopsy (diagnostic gold standard)
  - J9312 - Rituximab (off-label use)
  - J1020/J1030 - Methylprednisolone

#### Primary Membranous Nephropathy (KDIGO 2021)
- **Diagnosis**: Kidney biopsy with subepithelial immune deposits; PLA2R antibody positive in ~70%
- **ICD-10 Coding**: N04.2, N04.21 (primary), N06.2, N06.21
- **Treatment Algorithm**:
  - Low risk: ACE/ARB, monitor for 6 months
  - Moderate risk: Consider immunosuppression
  - High risk: Rituximab or cyclophosphamide-based regimen
- **Preferred First-line**: Rituximab (J9312) - 2 doses 1g, 2 weeks apart
- **Alternative**: Cyclophosphamide + corticosteroids (Ponticelli regimen)
- **Relevant HCPCS**:
  - J9312 - Rituximab
  - J7502 - Cyclosporine
  - J9070 - Cyclophosphamide

#### Lupus Nephritis (KDIGO 2024, ACR/EULAR 2023)
- **Classification**: ISN/RPS Class I-VI based on biopsy
- **ICD-10 Coding**: M32.14 (glomerular disease in SLE), M32.15 (tubulointerstitial)
- **Induction Therapy**:
  - Class III/IV: Mycophenolate OR cyclophosphamide + glucocorticoids
  - Add belimumab (J0490) or voclosporin for additional benefit
- **Maintenance**: Mycophenolate (J7517) or azathioprine (J7500)
- **New Approvals**:
  - Belimumab (2020) - J0490
  - Voclosporin (Lupkynis, 2021) - oral, use J3490
- **Monitoring**: Anti-dsDNA, complement levels, proteinuria

#### Chronic Kidney Disease (KDIGO 2024)
- **Staging by GFR and Albuminuria**:
  - G1: GFR ≥90 (N18.1)
  - G2: GFR 60-89 (N18.2)
  - G3a: GFR 45-59 (N18.31)
  - G3b: GFR 30-44 (N18.32)
  - G4: GFR 15-29 (N18.4)
  - G5: GFR <15 (N18.5)
  - ESRD: Dialysis/transplant (N18.6)
- **Key Treatments**:
  - ACE/ARB for all with albuminuria
  - SGLT2 inhibitors (empagliflozin, dapagliflozin) - proven renal protection
  - Finerenone (Kerendia) for diabetic CKD
- **Anemia Management**:
  - ESAs: Epoetin (J0885), Darbepoetin (J0881/J0882)
  - Iron: Ferric carboxymaltose (J1439), Iron sucrose (J1756)

#### FSGS (Focal Segmental Glomerulosclerosis)
- **ICD-10 Coding**: N04.1, N06.1
- **Primary FSGS Treatment**:
  - First-line: High-dose corticosteroids
  - Second-line: Calcineurin inhibitors (cyclosporine J7502, tacrolimus J7516)
  - Rituximab for steroid-dependent/resistant
- **Genetic Testing**: Consider for hereditary forms (N07.1)

### Cardiology Guidelines (ACC/AHA)

#### Heart Failure (2022 AHA/ACC/HFSA Guidelines)
- **Classification by LVEF**:
  - HFrEF: LVEF ≤40%
  - HFmrEF: LVEF 41-49%
  - HFpEF: LVEF ≥50%
- **Guideline-Directed Medical Therapy (GDMT)**:
  - ACE/ARB or ARNI (sacubitril/valsartan)
  - Beta-blocker
  - MRA (spironolactone, eplerenone)
  - SGLT2 inhibitor (now recommended for all HF)
- **ICD-10 Codes**: I50.20-I50.43, I50.810-I50.84
- **Relevant Procedures**:
  - 93306 - Complete echocardiogram
  - 93452 - Left heart catheterization
  - 33249 - ICD implantation

#### Atrial Fibrillation (2023 ACC/AHA/ACCP/HRS)
- **ICD-10 Codes**: I48.0 (paroxysmal), I48.1 (persistent), I48.2 (chronic), I48.21 (permanent)
- **Stroke Prevention**: CHA₂DS₂-VASc score for anticoagulation decisions
- **Rate vs Rhythm Control**: Individualized approach

### Rheumatology Guidelines (ACR)

#### Systemic Lupus Erythematosus (2020 ACR Guidelines)
- **Disease Activity Monitoring**: SLEDAI, BILAG scores
- **Treatment Principles**:
  - Hydroxychloroquine for all patients
  - Glucocorticoids for flares
  - Immunosuppressants for organ involvement
- **Lupus Nephritis-Specific**: See KDIGO guidelines above

### Diabetes Guidelines (ADA Standards of Care 2024)

#### Diabetic Kidney Disease
- **Screening**: Annual urine albumin and eGFR starting at diagnosis (T2DM) or 5 years (T1DM)
- **ICD-10 Codes**: E11.21/E11.22 (T2DM), E10.21/E10.22 (T1DM)
- **Treatment**:
  - ACE/ARB for albuminuria
  - SGLT2 inhibitor (cardiorenal protection)
  - Finerenone (MRA) for T2DM with CKD
- **BP Target**: <130/80 mmHg

## Code Validation Studies

### IgA Nephropathy
- **Sim et al. 2023 (Clin Kidney J)**:
  - N02.8 has ~99% PPV for biopsy-proven IgAN
  - Study validated in >10,000 Medicare patients
  - Recommended as primary code for population-based studies

### Membranous Nephropathy
- **AHA Coding Clinic Q4 2023**:
  - New codes N04.21, N06.21 specifically for PRIMARY membranous nephropathy
  - Codes N04.22, N06.22 for SECONDARY membranous nephropathy
  - Effective October 1, 2023

### Lupus Nephritis
- **Engel et al. 2022**:
  - M32.14 has 85-90% PPV for lupus nephritis
  - Recommend combining with renal biopsy codes for higher specificity

## Specialty-Condition Mapping

### Nephrology
- Treats: CKD (all stages), glomerulonephritis (IgAN, PMN, FSGS), lupus nephritis, diabetic nephropathy, ADPKD, ESRD
- Procedures: Kidney biopsy (50200), dialysis management, transplant evaluation

### Rheumatology
- Treats: SLE, lupus nephritis (co-management), vasculitis, RA
- Often co-manages lupus nephritis with nephrology

### Endocrinology
- Treats: Diabetic kidney disease, metabolic bone disease in CKD
- Co-manages diabetic nephropathy

### Cardiology
- Treats: Heart failure (cardiorenal syndrome), hypertension, atrial fibrillation
- Important for CKD patients (high CV risk)

### Internal Medicine
- Treats: General CKD management, diabetes, hypertension
- Often primary physician managing early-stage CKD

## Data Sources and Citations

1. **KDIGO Clinical Practice Guidelines**: https://kdigo.org/guidelines/
2. **ACC/AHA Guidelines**: https://www.acc.org/guidelines
3. **ACR Guidelines**: https://www.rheumatology.org/Practice-Quality/Clinical-Support/Clinical-Practice-Guidelines
4. **ADA Standards of Care**: https://diabetesjournals.org/care/issue/47/Supplement_1
5. **CMS ICD-10-CM Official Guidelines**: https://www.cms.gov/medicare/coding-billing/icd-10-codes
6. **AHA Coding Clinic**: https://www.ahacentraloffice.org/
7. **Sim et al. 2023**: "Validation of ICD-10 codes for IgA nephropathy" - Clin Kidney J
`;

/**
 * Create the medical code database files
 */
function createCodeFiles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const files = [
    { name: 'icd10_codes_2024.txt', content: ICD10_CODES_CONTENT },
    { name: 'cpt_codes_2024.txt', content: CPT_CODES_CONTENT },
    { name: 'hcpcs_codes_2024.txt', content: HCPCS_CODES_CONTENT },
    { name: 'clinical_guidelines.txt', content: MEDICAL_GUIDELINES_CONTENT },
  ];
  
  const createdFiles = [];
  
  for (const file of files) {
    const filePath = path.join(outputDir, file.name);
    fs.writeFileSync(filePath, file.content, 'utf8');
    console.log(`Created: ${filePath}`);
    createdFiles.push(filePath);
  }
  
  return createdFiles;
}

/**
 * Upload files to OpenAI and create vector store
 */
async function setupVectorStore(dataDir) {
  console.log('\n=== Medical Code Vector Store Setup ===\n');
  
  // Step 1: Create code files
  console.log('Step 1: Creating medical code database files...');
  const codeFiles = createCodeFiles(dataDir);
  
  // Step 2: Create vector store
  console.log('\nStep 2: Creating OpenAI vector store...');
  const vectorStore = await openai.beta.vectorStores.create({
    name: 'Medical Billing Codes Database v1.0',
    expires_after: { anchor: 'last_active_at', days: 60 },
  });
  console.log(`Vector store created: ${vectorStore.id}`);
  
  // Step 3: Upload files
  console.log('\nStep 3: Uploading files to OpenAI...');
  const fileIds = [];
  
  for (const filePath of codeFiles) {
    const fileStream = fs.createReadStream(filePath);
    const uploadedFile = await openai.files.create({
      file: fileStream,
      purpose: 'assistants',
    });
    fileIds.push(uploadedFile.id);
    console.log(`Uploaded: ${path.basename(filePath)} → ${uploadedFile.id}`);
  }
  
  // Step 4: Add files to vector store
  console.log('\nStep 4: Adding files to vector store...');
  const batch = await openai.beta.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
    file_ids: fileIds,
  });
  console.log(`Batch status: ${batch.status}`);
  console.log(`Files processed: ${batch.file_counts.completed}/${batch.file_counts.total}`);
  
  // Step 5: Create assistant (optional)
  console.log('\nStep 5: Creating AI Code Mapper assistant...');
  const assistant = await openai.beta.assistants.create({
    name: 'Medical Code Mapper v1.0',
    instructions: `You are an expert medical coding specialist. Use the uploaded medical code databases to map conditions to ICD-10, CPT, and HCPCS codes. Always search the files first, then validate with web search.`,
    model: 'gpt-4o',
    tools: [
      { type: 'file_search' },
    ],
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStore.id],
      },
    },
  });
  console.log(`Assistant created: ${assistant.id}`);
  
  // Step 6: Save configuration
  const config = {
    vectorStoreId: vectorStore.id,
    assistantId: assistant.id,
    fileIds,
    createdAt: new Date().toISOString(),
    version: '1.0.0',
  };
  
  const configPath = path.join(dataDir, 'ai_config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\nConfiguration saved to: ${configPath}`);
  
  // Print environment variables to set
  console.log('\n=== Setup Complete ===\n');
  console.log('Add these to your .env file:\n');
  console.log(`OPENAI_VECTOR_STORE_ID=${vectorStore.id}`);
  console.log(`OPENAI_ASSISTANT_ID=${assistant.id}`);
  
  return config;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let dataDir = './data/medical-codes';
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-dir' && args[i + 1]) {
      dataDir = args[i + 1];
    }
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it with: export OPENAI_API_KEY=your-api-key');
    process.exit(1);
  }
  
  try {
    const config = await setupVectorStore(dataDir);
    console.log('\n✅ Vector store setup complete!');
    return config;
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  setupVectorStore,
  createCodeFiles,
  ICD10_CODES_CONTENT,
  CPT_CODES_CONTENT,
  HCPCS_CODES_CONTENT,
  MEDICAL_GUIDELINES_CONTENT,
};

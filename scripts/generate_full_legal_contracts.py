import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib import colors

os.makedirs('test_documents', exist_ok=True)
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#0F172A'),
    alignment=1, # Center
    spaceAfter=14
)

h1_style = ParagraphStyle(
    'SectionHeading',
    parent=styles['Heading2'],
    fontSize=13,
    leading=16,
    textColor=colors.HexColor('#1E293B'),
    spaceBefore=12,
    spaceAfter=6,
    keepWithNext=True
)

body_style = ParagraphStyle(
    'DocBody',
    parent=styles['Normal'],
    fontSize=9.5,
    leading=13.5,
    textColor=colors.HexColor('#334155'),
    spaceAfter=8
)

def build_pdf(filename, title, sections):
    filepath = os.path.join('test_documents', filename)
    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    story = [
        Paragraph(title, title_style),
        Spacer(1, 10),
        Paragraph("<b>CONFIDENTIAL & PROPRIETARY LEGAL INSTRUMENT</b>", ParagraphStyle('Sub', parent=body_style, alignment=1, textColor=colors.HexColor('#64748B'))),
        Spacer(1, 16)
    ]

    for sec_num, sec_title, sec_paragraphs in sections:
        story.append(Paragraph(f"<b>{sec_num}. {sec_title}</b>", h1_style))
        for p in sec_paragraphs:
            story.append(Paragraph(p, body_style))
        story.append(Spacer(1, 6))

    doc.build(story)
    print(f"Generated {filepath} successfully.")

# 1. Master Services Agreement (Cloud Services 2026)
msa_sections = [
    ("RECITALS & PREAMBLE", "PARTIES AND EFFECTIVE DATE", [
        "This Master Services Agreement (\"Agreement\") is entered into and made effective as of January 1, 2026 (\"Effective Date\"), by and between Enterprise Cloud Solutions Inc., a Delaware corporation with principal offices at 100 Technology Plaza, Wilmington, DE (\"Provider\"), and Global Logistics Partners LLC, a California limited liability company with principal offices at 500 Port Avenue, Oakland, CA (\"Customer\"). Provider and Customer are each individually referred to herein as a \"Party\" and collectively as the \"Parties\".",
        "WHEREAS, Provider owns and operates proprietary distributed enterprise cloud computing and automation services; and WHEREAS, Customer desires to procure access to Provider's cloud infrastructure services pursuant to specific Statements of Work (\"SOW\") or Service Orders issued hereunder."
    ]),
    ("SECTION 1", "DEFINITIONS", [
        "<b>1.1 \"Authorized Users\"</b> means Customer's employees, agents, and independent contractors authorized by Customer to access the Cloud Services in accordance with this Agreement and any applicable SOW.",
        "<b>1.2 \"Customer Data\"</b> means any business records, personal information, data streams, documents, and technical traces uploaded, submitted, or processed by Customer or Authorized Users within the Service environment.",
        "<b>1.3 \"Service Level Commitment\"</b> means the uptime and latency performance criteria set forth in Exhibit A (Service Level Agreement).",
        "<b>1.4 \"Confidential Information\"</b> has the meaning ascribed to it in Section 4.1 hereof."
    ]),
    ("SECTION 2", "SCOPE OF SERVICES AND ORDERING", [
        "<b>2.1 Provision of Services:</b> Provider shall make the Cloud Services available to Customer during the Term subject to the operational terms of this Agreement and applicable Service Orders. Provider hereby grants Customer a non-exclusive, non-transferable, revocable license during the Term to access and utilize the Cloud Services solely for Customer's internal enterprise operations.",
        "<b>2.2 Usage Caps and Restrictions:</b> Customer shall not (i) decompile, disassemble, reverse engineer or attempt to derive the source code of the Cloud Services; (ii) copy, distribute, sublicense or resell access to any third party; or (iii) exceed the concurrent token bandwidth or API query quotas set forth in the applicable Service Order."
    ]),
    ("SECTION 3", "FEES, INVOICING, AND AUDIT RIGHTS", [
        "<b>3.1 Invoicing and Payment Terms:</b> Customer shall pay all fees specified in the applicable Service Orders. Unless otherwise stated in an SOW, all subscription and consumption fees shall be billed monthly in advance and usage-based compute charges shall be billed monthly in arrears. Customer shall remit payment within thirty (30) days following receipt of an electronic invoice (\"Payment Period\").",
        "<b>3.2 Late Charges and Taxes:</b> Delinquent balances shall accrue interest at the lesser of one and one-half percent (1.5%) per month or the highest statutory rate permitted by applicable law. All amounts payable hereunder exclude applicable sales, use, excise, or value-added taxes (VAT), which shall be the sole responsibility of Customer.",
        "<b>3.3 Audit Rights:</b> Once per calendar year upon thirty (30) business days prior written notice, Provider may audit Customer's usage records and user credentials solely to verify compliance with license limits. Any such audit shall be conducted during normal business hours without unreasonably disrupting Customer's ongoing business."
    ]),
    ("SECTION 4", "CONFIDENTIALITY AND INTELLECTUAL PROPERTY", [
        "<b>4.1 Protection of Confidential Information:</b> Each Party (\"Receiving Party\") agrees that all code, trade secrets, architecture diagrams, pricing terms, and business plans disclosed by the other Party (\"Disclosing Party\") constitute Confidential Information. The Receiving Party shall hold such information in strict confidence, exercising at least a reasonable standard of care, and shall not disclose it to any third party other than affiliates, legal advisors, and auditors bound by confidentiality obligations at least as protective as those herein.",
        "<b>4.2 Intellectual Property Ownership:</b> As between Provider and Customer, Provider retains all right, title, and interest, including all patent, copyright, trademark, and trade secret rights, in and to the Cloud Services, core models, algorithms, and documentation. Customer retains sole and exclusive ownership of all Customer Data.",
        "<b>4.3 Survival of Confidentiality:</b> Obligations concerning Confidential Information shall survive termination or expiration of this Agreement for a period of five (5) years, provided that trade secrets and core technical specifications shall remain protected indefinitely."
    ]),
    ("SECTION 5", "DATA PRIVACY AND SECURITY CONTROLS", [
        "<b>5.1 Security Safeguards:</b> Provider shall maintain comprehensive administrative, physical, and technical safeguards designed to protect the security, confidentiality, and integrity of Customer Data, including compliance with SOC 2 Type II and ISO/IEC 27001 standards.",
        "<b>5.2 Data Breach Notification:</b> In the event Provider confirms an unauthorized acquisition, destruction, or disclosure of Customer Data (\"Security Incident\"), Provider shall notify Customer in writing without undue delay, and in any event within forty-eight (48) hours of confirmation, and shall take all commercially reasonable actions to remediate the incident."
    ]),
    ("SECTION 6", "REPRESENTATIONS AND WARRANTIES", [
        "<b>6.1 Mutual Representations:</b> Each Party represents and warrants that it is duly organized, validly existing, and has the requisite legal authority to enter into and perform its obligations under this Agreement.",
        "<b>6.2 Service Performance Warranty:</b> Provider warrants that during the subscription term, the Cloud Services will operate in substantial accordance with the applicable technical documentation. For any breach of this warranty, Customer's exclusive remedy shall be the service credit schedule described in Exhibit A."
    ]),
    ("SECTION 7", "INDEMNIFICATION", [
        "<b>7.1 Provider Indemnification:</b> Provider shall defend, indemnify, and hold harmless Customer and its officers, directors, and employees against any third-party claims, suits, or proceedings alleging that Customer's authorized use of the Cloud Services infringes or misappropriates a valid United States patent, copyright, or trademark.",
        "<b>7.2 Customer Indemnification:</b> Customer shall defend, indemnify, and hold harmless Provider against any claims arising from (i) Customer Data violating third-party privacy or intellectual property rights; or (ii) unauthorized use of the Services by Customer's Authorized Users in violation of law."
    ]),
    ("SECTION 8", "LIMITATION OF LIABILITY", [
        "<b>8.1 Consequential Damages Waiver:</b> TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA LOSS, REPUTATIONAL INJURY, OR BUSINESS INTERRUPTION, REGARDLESS OF THE THEORY OF LIABILITY.",
        "<b>8.2 Aggregate Liability Cap:</b> EXCEPT FOR WILLFUL MISCONDUCT, GROSS NEGLIGENCE, OR INDEMNIFICATION OBLIGATIONS UNDER SECTION 7, EACH PARTY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE TOTAL AMOUNTS ACTUALLY PAID BY CUSTOMER TO PROVIDER UNDER THE APPLICABLE SOW DURING THE TWELVE (12) MONTHS PRECEDING THE OCCURRENCE GIVING RISE TO LIABILITY."
    ]),
    ("SECTION 9", "SERVICE LEVEL COMMITMENT (SLA)", [
        "<b>9.1 Uptime Commitment:</b> Provider guarantees a Monthly Uptime Percentage of at least 99.9% across each calendar month, excluding scheduled maintenance windows announced at least seventy-two (72) hours in advance.",
        "<b>9.2 SLA Credits:</b> If the Monthly Uptime falls below 99.9%, Customer is eligible for a credit calculated as follows: (i) 99.0% to 99.89%: 10% monthly service credit; (ii) 95.0% to 98.99%: 25% monthly service credit; (iii) Below 95.0%: 50% monthly service credit. Service credits shall be applied against the next invoice."
    ]),
    ("SECTION 10", "FORCE MAJEURE", [
        "<b>10.1 Excused Delays:</b> Neither Party shall be held in breach or default for failure or delay in performance caused by circumstances beyond its reasonable control, including acts of God, flood, earthquake, armed conflict, severe regional power grid collapse, or nationwide telecommunication fiber cuts.",
        "<b>10.2 Exclusions:</b> Economic downturns, price fluctuations in server silicon, market changes, and inability to pay debts shall specifically NOT constitute force majeure events."
    ]),
    ("SECTION 11", "DISPUTE RESOLUTION AND ARBITRATION", [
        "<b>11.1 Informal Negotiation:</b> Prior to commencing any formal litigation, executive representatives of both Parties shall meet in good faith within fifteen (15) business days of written notice to attempt informal resolution.",
        "<b>11.2 Binding Arbitration:</b> If informal negotiations fail, all disputes arising hereunder shall be submitted to final and binding arbitration administered by JAMS in Wilmington, Delaware, under its Comprehensive Arbitration Rules."
    ]),
    ("SECTION 12", "TERM AND TERMINATION (CRITICAL OPERATIONAL CLAUSES)", [
        "<b>12.1 Term of Agreement:</b> This Agreement commences on the Effective Date and shall continue in effect for an initial period of thirty-six (36) months (\"Initial Term\"), unless terminated earlier in accordance with this Section 12. Thereafter, this Agreement shall automatically renew for successive twelve (12) month periods unless either Party provides notice of non-renewal.",
        "<b>12.2 Termination for Cause / Material Breach:</b> Either Party may terminate this Agreement or any specific SOW immediately upon written notice if the other Party commits a material breach of any provision hereof and fails to cure such material breach within thirty (30) calendar days after receipt of written notice specifying the breach with reasonable detail. Furthermore, either Party may terminate immediately without cure opportunity if the other Party becomes insolvent, enters receivership, or files for bankruptcy protection under Chapter 7 or Chapter 11.",
        "<b>12.3 Termination for Convenience:</b> Customer may terminate this Agreement or any active Service Order for convenience without cause at any time upon providing at least sixty (60) days prior written notice to Provider. In the event Customer exercises termination for convenience, Customer shall pay all earned fees for Services performed through the effective termination date and any documented non-cancelable third-party commitments incurred by Provider.",
        "<b>12.4 Effect of Termination:</b> Upon termination or expiration of this Agreement, (i) all licenses granted herein immediately cease; (ii) Provider shall retain Customer Data for thirty (30) days to enable retrieval, after which it shall be permanently scrubbed; and (iii) Sections 1, 3, 4, 7, 8, 11, 12.4, and 15 shall survive."
    ]),
    ("SECTION 13", "NON-SOLICITATION", [
        "<b>13.1 Restrictions:</b> During the Term and for a period of twelve (12) months following termination, neither Party shall directly solicit for employment or hire any key technical employee of the other Party without prior written consent. General public job advertisements shall not constitute a violation."
    ]),
    ("SECTION 14", "ASSIGNMENT AND SUBLICENSING", [
        "<b>14.1 Assignment:</b> Neither Party may assign or transfer this Agreement, whether by merger, reorganization, or operation of law, without the prior written consent of the other Party, except that either Party may assign this Agreement without consent to a successor entity acquiring all or substantially all of its assets or voting securities."
    ]),
    ("SECTION 15", "GOVERNING LAW AND VENUE", [
        "<b>15.1 Delaware Law:</b> This Agreement, and all claims or causes of action (whether in contract, tort or statute) that may be based upon, arise out of or relate to this Agreement, shall be governed by, and enforced in accordance with, the internal laws of the State of Delaware, without giving effect to any choice of law rule that would result in the application of the laws of any other jurisdiction.",
        "<b>15.2 Exclusive Jurisdiction:</b> Each Party irrevocably submits to the exclusive personal jurisdiction of the state and federal courts sitting in New Castle County, Delaware."
    ]),
    ("SECTION 16", "GENERAL AND MISCELLANEOUS", [
        "<b>16.1 Entire Agreement (Merger Clause):</b> This Agreement, together with all Exhibits, Schedules, and executed Service Orders, constitutes the final and entire agreement between the Parties concerning the subject matter hereof and supersedes all prior drafts, oral understandings, representations, and negotiations. No modification shall be valid unless in writing and signed by authorized signatories of both Parties."
    ])
]

# 2. Cloud SaaS License and Service Level Agreement
saas_sections = [
    ("PREAMBLE", "PARTIES AND RECITAL CLAUSES", [
        "This Cloud Software-as-a-Service and Service Level Agreement (\"SaaS Agreement\") is entered into on February 15, 2026, by and between CloudMetrics Enterprise Inc., a Delaware corporation with offices in Boston, MA (\"Licensor\"), and Apex Global Financial Corp., a New York corporation (\"Licensee\").",
        "WHEREAS, Licensor has engineered a proprietary multi-tenant cloud telemetry and security monitoring SaaS platform; and WHEREAS, Licensee desires to subscribe to the SaaS platform subject to the performance commitments herein."
    ]),
    ("ARTICLE 1", "DEFINITIONS AND INTERPRETATION", [
        "<b>1.1 \"Production Instance\"</b> means the high-availability cloud cluster hosted across multi-region availability zones dedicated to serving Customer traffic.",
        "<b>1.2 \"Service Credits\"</b> means monetary credits calculated in accordance with Article 4 and redeemable exclusively against subsequent recurring subscription invoices.",
        "<b>1.3 \"Scheduled Downtime\"</b> means maintenance intervals occurring between 01:00 AM and 04:00 AM Eastern Time on Sundays, announced at least five (5) business days prior."
    ]),
    ("ARTICLE 2", "GRANT OF RIGHTS AND USAGE LIMITATIONS", [
        "<b>2.1 Software Subscription:</b> Subject to timely payment of fees, Licensor grants Licensee a worldwide, non-exclusive, non-sublicensable right to access and use the CloudMetrics Production Instance for up to 500 Authorized Enterprise Users during the Subscription Term.",
        "<b>2.2 Data Ingestion Quotas:</b> Licensee is entitled to ingest up to 2.5 Terabytes of log traces and metrics per calendar month. Excess ingestion beyond 2.5 TB shall be billed at $0.08 per additional Gigabyte, tabulated monthly in arrears."
    ]),
    ("ARTICLE 3", "COMMERCIAL FEES AND PAYMENT TERMS", [
        "<b>3.1 Annual Subscription Fee:</b> Licensee shall pay an annual base platform fee of $180,000, payable in advance within thirty (30) days from the receipt of Licensor's annual invoice.",
        "<b>3.2 Currency and Late Payment:</b> All monetary figures are stated in United States Dollars (USD). Payments overdue by more than fifteen (15) calendar days following written reminder shall accrue interest at 1.0% per month.",
        "<b>3.3 Invoicing Disputes:</b> In the event Licensee disputes any invoice in good faith, Licensee shall notify Licensor in writing within fifteen (15) days of receipt, detailing the disputed item. Undisputed amounts must be remitted on time."
    ]),
    ("ARTICLE 4", "SERVICE LEVEL AGREEMENT & CREDIT REMEDIES", [
        "<b>4.1 99.95% Availability Guarantee:</b> Licensor guarantees that the Production Instance shall achieve a Monthly Availability Rate of at least 99.95% during each calendar month.",
        "<b>4.2 Credit Schedule:</b> If availability drops below 99.95%, Licensee is entitled to credits as follows: (a) 99.50% to 99.94%: 10% credit; (b) 99.00% to 99.49%: 25% credit; (c) Less than 99.00%: 50% credit. Claims must be submitted within thirty (30) days following month-end.",
        "<b>4.3 Chronic Outage Termination:</b> In the event Monthly Availability falls below 98.0% in any two (2) consecutive calendar months, or below 95.0% in any single calendar month, Licensee shall have the right to terminate this SaaS Agreement immediately upon written notice without penalty and receive a pro-rata refund of prepaid fees."
    ]),
    ("ARTICLE 5", "DATA PROTECTION, BACKUPS AND RECOVERY", [
        "<b>5.1 Encryption:</b> All Customer telemetry in transit shall be encrypted using TLS 1.3, and all stationary data volumes shall be encrypted using AES-256.",
        "<b>5.2 Recovery Metrics:</b> Licensor commits to a Recovery Point Objective (RPO) of not more than four (4) hours and a Recovery Time Objective (RTO) of not more than two (2) hours in the event of catastrophic datacenter failure."
    ]),
    ("ARTICLE 6", "TERM, RENEWAL, AND TERMINATION CLAUSES", [
        "<b>6.1 Initial Term:</b> The initial subscription term shall be twenty-four (24) months starting on the Effective Date. The agreement shall renew automatically for successive 12-month periods unless either party delivers written notice of non-renewal at least sixty (60) days prior to expiration.",
        "<b>6.2 Termination for Cause:</b> Either party may terminate immediately if the other party breaches a material covenant and fails to remedy the breach within thirty (30) days following receipt of written notification.",
        "<b>6.3 Termination for Convenience:</b> Licensee may terminate this SaaS Agreement for convenience without cause at any time upon providing ninety (90) days advance written notice to Licensor. Prepaid platform fees for the current 12-month period shall be non-refundable, but future unbilled periods shall be canceled.",
        "<b>6.4 Post-Termination Data Portability:</b> Upon expiration or termination, Licensor shall furnish Licensee with an export archive of all Customer telemetry in JSON/CSV format within ten (10) business days."
    ]),
    ("ARTICLE 7", "LIMITATION OF REMEDIES AND LIABILITY", [
        "<b>7.1 Cap on Direct Damages:</b> Except for intentional breach of confidentiality or infringement indemnification, each party's maximum cumulative liability under this SaaS Agreement is capped at the fees paid or payable by Licensee in the twelve (12) months preceding the claim.",
        "<b>7.2 Consequential Damages Exclusion:</b> Neither party shall be liable for loss of business opportunity, indirect loss, or punitive damages."
    ]),
    ("ARTICLE 8", "GOVERNING LAW AND VENUE", [
        "<b>8.1 Massachusetts Law:</b> This SaaS Agreement is construed and enforced under the laws of the Commonwealth of Massachusetts, without regard to conflict of laws principles. The parties submit to the courts in Boston, Massachusetts."
    ])
]

# 3. Data Processing Addendum (GDPR & Standard Contractual Clauses)
dpa_sections = [
    ("PREAMBLE", "SCOPE, NATURE, AND PURPOSE OF PROCESSING", [
        "This Data Processing Addendum (\"DPA\") supplements and is incorporated into the Master Services Agreement between Customer (acting as \"Data Controller\") and Cloud Solutions Inc. (acting as \"Data Processor\"), governing the processing of European Economic Area (EEA), UK, and Swiss personal data in accordance with Regulation (EU) 2016/679 (\"GDPR\").",
        "The categories of data subjects include Customer's employees, consumers, and vendors. Processing operations encompass cloud indexing, automated categorization, and enterprise retrieval."
    ]),
    ("ARTICLE 1", "CONTROLLER INSTRUCTIONS AND COMPLIANCE", [
        "<b>1.1 Documented Instructions:</b> Processor shall process Personal Data solely on documented instructions from Controller, including with respect to international data transfers. Processor shall promptly inform Controller if, in its opinion, an instruction infringes the GDPR or national data protection laws.",
        "<b>1.2 Confidentiality of Personnel:</b> Processor shall ensure that all employees, contractors, and agents authorized to process Personal Data have committed themselves to confidentiality under statutory or contractual obligations."
    ]),
    ("ARTICLE 2", "TECHNICAL AND ORGANIZATIONAL SECURITY MEASURES", [
        "<b>2.1 Security Controls:</b> Processor shall implement and maintain technical and organizational measures (TOMs) specified in Annex II, including: (a) pseudonymization and automated tokenization; (b) continuous resilience testing of processing systems; and (c) rapid data restoration protocols.",
        "<b>2.2 Security Audits:</b> Processor shall maintain independent third-party SOC 2 Type II and ISO 27001 certifications. Controller may inspect auditor verification reports once annually upon reasonable notice."
    ]),
    ("ARTICLE 3", "SUBPROCESSOR APPOINTMENT AND NOTIFICATION", [
        "<b>3.1 Authorized Subprocessors:</b> Controller grants general authorization for Processor's engagement of hosting and telemetry subprocessors listed on Processor's subprocessor portal.",
        "<b>3.2 Prior Notification of Changes:</b> Processor shall notify Controller at least thirty (30) calendar days prior to onboarding any new or replacement subprocessor. Controller may object on reasonable data protection grounds within fourteen (14) days. If the parties cannot resolve the objection, Controller may terminate the affected service without penalty."
    ]),
    ("ARTICLE 4", "DATA SUBJECT RIGHTS AND ASSISTANCE", [
        "<b>4.1 Fulfilling Data Subject Requests:</b> Processor shall provide all necessary technical assistance to enable Controller to respond to requests exercising data subject rights (access, rectification, erasure, restriction, and portability) within ten (10) calendar days of notification."
    ]),
    ("ARTICLE 5", "DATA BREACH NOTIFICATION OBLIGATIONS", [
        "<b>5.1 48-Hour Notification:</b> In the event of a confirmed Personal Data Breach, Processor shall notify Controller without undue delay, and in any case within forty-eight (48) hours of becoming aware of the breach.",
        "<b>5.2 Information Provided:</b> The notification shall detail the nature of the incident, estimated categories and numbers of data subjects affected, likely consequences, and remediation measures undertaken."
    ]),
    ("ARTICLE 6", "CROSS-BORDER TRANSFERS AND STANDARD CLAUSES", [
        "<b>6.1 EU Standard Contractual Clauses:</b> To the extent transfers of Personal Data occur outside the EEA to third countries lacking an adequacy decision, the EU Standard Contractual Clauses (Module 2: Controller-to-Processor) are hereby incorporated by reference."
    ]),
    ("ARTICLE 7", "TERMINATION OF DATA PROCESSING", [
        "<b>7.1 Deletion or Return:</b> Within thirty (30) days following the termination or expiration of the Master Services Agreement, Processor shall, at Controller's election, return all Personal Data or securely delete and overwrite all copies from active production clusters and disaster recovery archives.",
        "<b>7.2 Certification:</b> Processor's Chief Information Security Officer shall certify in writing to Controller that all Personal Data has been permanently destroyed in accordance with DoD 5220.22-M wiping standards."
    ])
]

# 4. Commercial Vendor and Subcontractor Agreement
vendor_sections = [
    ("RECITALS", "CONTRACTOR-SUBCONTRACTOR ENGAGEMENT", [
        "This Commercial Vendor and Subcontractor Master Agreement (\"Vendor Agreement\") is executed on March 1, 2026, by Prime Engineering Solutions LLC (\"Prime\") and Delta Systems Integration Inc. (\"Subcontractor\").",
        "Prime provides mission-critical enterprise integration services to federal and commercial clients. Prime desires to subcontract specific engineering work packages to Subcontractor pursuant to issued Task Orders."
    ]),
    ("SECTION 1", "SERVICES AND DELIVERABLE ACCEPTANCE", [
        "<b>1.1 Performance Standards:</b> Subcontractor warrants that all deliverables and custom code shall be executed in accordance with highest professional industry standards and shall satisfy the technical milestones in each Task Order.",
        "<b>1.2 Acceptance Period:</b> Prime shall have twenty (20) business days following receipt of deliverables to test and provide written notice of acceptance or rejection specifying non-conformities."
    ]),
    ("SECTION 2", "COMPENSATION AND INVOICING", [
        "<b>2.1 Payment Schedule:</b> Subcontractor shall submit monthly time-and-materials invoices detailing engineer hours, approved expenses, and deliverable milestones. Prime shall pay approved invoices net forty-five (45) days from receipt."
    ]),
    ("SECTION 3", "WORK PRODUCT AND INTELLECTUAL PROPERTY", [
        "<b>3.1 Work Made for Hire:</b> All inventions, algorithms, software routines, and documentation developed by Subcontractor under this Vendor Agreement shall constitute \"work made for hire\" and shall belong solely and exclusively to Prime."
    ]),
    ("SECTION 4", "CONFIDENTIALITY AND NON-DISCLOSURE", [
        "<b>4.1 Non-Disclosure:</b> Subcontractor shall protect all Prime proprietary technical architectures and client information with strict confidentiality for a minimum of five (5) years post-termination."
    ]),
    ("SECTION 5", "TERMINATION PROVISIONS", [
        "<b>5.1 Termination for Cause:</b> Prime may terminate this Vendor Agreement immediately without prior notice upon: (a) Subcontractor's material breach of confidentiality; (b) fraud or willful misconduct; or (c) assignment or subcontracting of duties without Prime's written consent.",
        "<b>5.2 Termination for Convenience:</b> Prime may terminate any Task Order or this entire Vendor Agreement for convenience at any time upon providing fourteen (14) days prior written notice to Subcontractor.",
        "<b>5.3 Payment on Termination for Convenience:</b> If Prime terminates for convenience, Prime shall pay Subcontractor for all verified billable hours completed up to the effective termination date."
    ]),
    ("SECTION 6", "INDEMNITY AND PROFESSIONAL INSURANCE", [
        "<b>6.1 Insurance Minimums:</b> Subcontractor shall maintain Commercial General Liability insurance of not less than $2,000,000 per occurrence, and Cyber/Errors & Omissions insurance of not less than $3,000,000.",
        "<b>6.2 Subcontractor Indemnity:</b> Subcontractor shall defend and indemnify Prime against any claims arising out of Subcontractor's gross negligence, intellectual property infringement, or tax non-compliance."
    ]),
    ("SECTION 7", "GOVERNING LAW AND ARBITRATION", [
        "<b>7.1 Texas Law:</b> This Vendor Agreement is governed by the laws of the State of Texas. Any unresolved disputes shall be submitted to binding arbitration in Dallas, Texas under AAA Commercial Arbitration Rules."
    ])
]

build_pdf('Master_Services_Agreement_Enterprise_Cloud.pdf', 'MASTER SERVICES AGREEMENT (CLOUD INFRASTRUCTURE)', msa_sections)
build_pdf('Cloud_SaaS_License_and_Service_Level_Agreement.pdf', 'ENTERPRISE SAAS SUBSCRIPTION & SLA AGREEMENT', saas_sections)
build_pdf('Data_Processing_Addendum_GDPR_Standard_Clauses.pdf', 'DATA PROCESSING ADDENDUM (GDPR & CCPA COMPLIANCE)', dpa_sections)
build_pdf('Commercial_Vendor_and_Subcontractor_Agreement.pdf', 'COMMERCIAL SUBCONTRACTOR & VENDOR MASTER AGREEMENT', vendor_sections)
print("All 4 comprehensive legal contract PDFs generated successfully.")

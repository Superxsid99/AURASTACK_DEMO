import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleOff,
  Clock3,
  Database,
  FileScan,
  FileText,
  ShieldCheck,
  Timer,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { Case } from '../types/case';
import { AgentDefinition } from '../types/agent';

interface AIAnalysisViewProps {
  caseData: Case;
  agents: AgentDefinition[];
}

export const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({ caseData, agents }) => {
  const metadata = ((caseData.metadata || {}) as Record<string, unknown>);
  const extractedFields = (metadata.extractedFields && typeof metadata.extractedFields === 'object')
    ? (metadata.extractedFields as Record<string, unknown>)
    : {};
  const routingDecision = (metadata.routingDecision && typeof metadata.routingDecision === 'object')
    ? (metadata.routingDecision as Record<string, unknown>)
    : null;
  const preProcessor = (metadata.preProcessor && typeof metadata.preProcessor === 'object')
    ? (metadata.preProcessor as Record<string, unknown>)
    : null;
  const cascadePlan = (metadata.cascadePlan && typeof metadata.cascadePlan === 'object')
    ? (metadata.cascadePlan as Record<string, unknown>)
    : null;
  const policyEvidence = Array.isArray(metadata.policyEvidence)
    ? (metadata.policyEvidence as Array<Record<string, unknown>>)
    : [];
  const policyKnowledgeSummary =
    typeof metadata.policyKnowledgeSummary === 'string'
      ? metadata.policyKnowledgeSummary
      : '';
  const routingAlternatives = Array.isArray(routingDecision?.alternatives)
    ? (routingDecision?.alternatives as Array<Record<string, unknown>>)
    : [];
  const routingContext = (routingDecision?.context && typeof routingDecision.context === 'object')
    ? (routingDecision.context as Record<string, unknown>)
    : null;
  const documentGroups = (preProcessor?.documentGroups && typeof preProcessor.documentGroups === 'object')
    ? (preProcessor.documentGroups as Record<string, unknown>)
    : {};
  const groupAgentRouting = (preProcessor?.groupAgentRouting && typeof preProcessor.groupAgentRouting === 'object')
    ? (preProcessor.groupAgentRouting as Record<string, unknown>)
    : {};
  const recommendedWorkflowKeys = Array.isArray(preProcessor?.recommendedWorkflowKeys)
    ? (preProcessor.recommendedWorkflowKeys as unknown[]).map((value) => String(value)).filter(Boolean)
    : [];
  const totalPdfPages = Number(preProcessor?.totalPdfPages || 0);
  const containsLargePdf = Boolean(preProcessor?.containsLargePdf);
  const cascadeWorkflowNames = Array.isArray(cascadePlan?.cascadeWorkflowNames)
    ? (cascadePlan.cascadeWorkflowNames as unknown[]).map((value) => String(value)).filter(Boolean)
    : [];

  const insightConfidences = (caseData.ai_insights || []).map((i) => i.confidence).filter((v) => typeof v === 'number');
  const maxConfidence = insightConfidences.length ? Math.max(...insightConfidences) : 0.75;
  const modelConfidencePct = Math.max(1, Math.min(99, Math.round(maxConfidence * 100)));
  const riskIndex = Math.max(1, Math.min(100, Math.round((caseData.risk_score || 0) * 10)));
  const riskLabel = riskIndex >= 70 ? 'High Risk' : riskIndex >= 40 ? 'Medium Risk' : 'Low Risk';
  const riskLabelColor = riskIndex >= 70 ? 'text-error' : riskIndex >= 40 ? 'text-amber-500' : 'text-emerald-500';
  const processingMs = Number(metadata.processingMs || 0);
  const processingText = processingMs > 0 ? `${(processingMs / 1000).toFixed(1)}s` : `${Math.max(0.8, ((caseData.timeline?.length || 1) * 0.8)).toFixed(1)}s`;
  const ocrText = String(metadata.ocrText || '').trim();
  const sourceTextLength = Number(metadata.sourceTextLength || 0);
  const ocrProcessedDocuments = Number(
    metadata.ocrProcessedDocuments ||
    ((ocrText.length > 0 || sourceTextLength > 0) ? Math.max(1, caseData.documents?.length || 0) : 0)
  );
  const ocrFailedDocuments = Number(metadata.ocrFailedDocuments || 0);
  const ocrFailedDocumentNames = Array.isArray(metadata.ocrFailedDocumentNames)
    ? (metadata.ocrFailedDocumentNames as unknown[]).map((v) => String(v)).filter(Boolean)
    : [];
  const validationInsight = caseData.ai_insights?.find(i => i.title.toLowerCase().includes('validation'));
  const extractionInsight = caseData.ai_insights?.find(i => i.title.toLowerCase().includes('extraction'));
  const extractedEntries = Object.entries(extractedFields).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
  const docStats = (metadata.docStats && typeof metadata.docStats === 'object')
    ? (metadata.docStats as { total?: number; complete?: number; missing?: number })
    : {};
  const totalDocs = typeof docStats.total === 'number' ? docStats.total : (caseData.documents?.length || 0);
  const completeDocs = typeof docStats.complete === 'number'
    ? docStats.complete
    : (caseData.documents?.filter((doc) => doc.status === 'VERIFIED').length || 0);
  const missingDocs = typeof docStats.missing === 'number' ? docStats.missing : Math.max(0, totalDocs - completeDocs);
  const verificationPct = totalDocs > 0 ? Math.round((completeDocs / totalDocs) * 100) : 0;

  const timeline = (caseData.audit_trail || [])
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const hasValidationRun = timeline.some((entry) =>
    `${entry.action} ${entry.node_id || ''}`.toLowerCase().includes('validation')
  );
  const hasDecisionRun = timeline.some((entry) =>
    `${entry.action} ${entry.node_id || ''}`.toLowerCase().includes('decision')
  );
  const hasOcrRun = timeline.some((entry) =>
    `${entry.action} ${entry.node_id || ''}`.toLowerCase().includes('ocr')
  );

  const lowerOcr = ocrText.toLowerCase();
  const pickField = (...keys: string[]) => {
    for (const key of keys) {
      const value = extractedFields[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };

  const collectMatches = (pattern: RegExp, max: number = 3) => {
    const values: string[] = [];
    let match: RegExpExecArray | null = null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(ocrText)) && values.length < max) {
      const value = String(match[1] || '').trim();
      if (value) values.push(value);
    }
    return values;
  };

  const diagnosisCandidates = [
    pickField('primaryDiagnosis', 'diagnosis', 'diagnosisCodes', 'diagnosisCode'),
    ...collectMatches(/(?:diagnosis|impression|condition)\s*[:\-]\s*([^\n.]+)/ig, 4)
  ].filter(Boolean);

  const symptomCandidates = [
    pickField('symptoms', 'chiefComplaint', 'complaint'),
    ...collectMatches(/(?:symptoms?|chief complaint)\s*[:\-]\s*([^\n.]+)/ig, 4)
  ].filter(Boolean);

  const treatmentCandidates = [
    pickField('treatmentDescription', 'treatment', 'procedure', 'therapy', 'plan'),
    ...collectMatches(/(?:treatment|procedure|therapy|plan)\s*[:\-]\s*([^\n.]+)/ig, 4)
  ].filter(Boolean);

  const providerName = pickField('providerName', 'hospitalName', 'facilityName', 'doctorName');
  const admissionDate = pickField('admissionDate', 'dateOfAdmission', 'serviceDate', 'dateOfIncident');
  const dischargeDate = pickField('dischargeDate');

  const criticalSignalTerms = [
    'icu',
    'sepsis',
    'stroke',
    'myocardial infarction',
    'heart attack',
    'ventilator',
    'internal bleeding',
    'hemorrhage',
    'cancer',
    'renal failure'
  ];
  const criticalSignals = criticalSignalTerms.filter((term) => lowerOcr.includes(term));

  const medicationSignalTerms = ['mg', 'tablet', 'capsule', 'dose', 'prescribed', 'medication', 'rx'];
  const medicationSignals = medicationSignalTerms.filter((term) => lowerOcr.includes(term));

  const medicalSummary =
    diagnosisCandidates.length > 0 || symptomCandidates.length > 0 || treatmentCandidates.length > 0
      ? `Clinical indicators extracted from reports show ${diagnosisCandidates.length > 0 ? 'diagnosis evidence' : 'no explicit diagnosis'}, ${symptomCandidates.length > 0 ? 'symptom capture' : 'limited symptom capture'}, and ${treatmentCandidates.length > 0 ? 'treatment/procedure references' : 'minimal treatment detail'}.`
      : 'Clinical extraction is still in progress. OCR did not yet produce strong diagnosis/symptom/treatment markers.';

  const firstMatch = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match?.[1]) return String(match[1]).trim();
    }
    return '';
  };

  const dischargeDiagnosis = firstMatch([
    /(?:final diagnosis|diagnosis)\s*[:\-]\s*([^\n]+)/i,
    /disease name\s*([^\n]+)/i
  ]);
  const admissionInfo = firstMatch([
    /date of admission\s*[:\-]\s*([^\n]+)/i
  ]);
  const dischargeInfo = firstMatch([
    /date of discharge\s*[:\-]\s*([^\n]+)/i
  ]);
  const dischargeCondition = firstMatch([
    /condition on discharge\s*[:\-]?\s*([^\n]+)/i
  ]);
  const followUpPlan = firstMatch([
    /follow-up instructions?\s*[:\-]?\s*([^\n]+)/i,
    /review with\s*([^\n]+)/i
  ]);

  const analysis = {
    truth_summary: caseData.ai_insights?.find(i => i.type === 'RISK')?.description || caseData.summary || "Summary is still being assembled from OCR and workflow outputs.",
    person_policy: caseData.ai_insights?.find(i => i.type === 'COMPLIANCE')?.description || validationInsight?.description || "Policy and identity checks are in progress.",
    fraud_validation: caseData.ai_insights?.find(i => i.type === 'ANOMALY')?.description || "Fraud signals are being evaluated from extracted document data.",
    compliance_score: caseData.compliance_score || 98,
    risk_score: riskIndex
  };

  // Circular Progress Component
  const CircularProgress = ({ value, label, color }: { value: number, label: string, color: string }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-on-surface/5"
            />
            <motion.circle
              cx="48"
              cy="48"
              r={radius}
              stroke={color}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-on-surface">{value}%</span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{label}</span>
      </div>
    );
  };

  const toTitle = (key: string) =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const groupRows = Object.entries(documentGroups)
    .map(([groupName, payload]) => {
      const entries = Array.isArray(payload) ? payload : [];
      return {
        groupName,
        count: entries.length,
        routedAgent: String(groupAgentRouting[groupName] || 'not_assigned')
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const complianceChecklist = [
    { label: 'Documents Uploaded', ok: totalDocs > 0, detail: `${totalDocs} received` },
    { label: 'OCR Completed', ok: hasOcrRun || ocrText.length > 0, detail: ocrText.length > 0 ? `${ocrText.length} chars extracted` : 'No OCR text yet' },
    { label: 'Field Extraction', ok: extractedEntries.length > 0, detail: `${extractedEntries.length} structured fields` },
    { label: 'Validation Completed', ok: hasValidationRun, detail: hasValidationRun ? 'Validation agent executed' : 'Validation pending' },
    { label: 'Decision Generated', ok: hasDecisionRun, detail: hasDecisionRun ? 'Decision agent executed' : 'Decision pending' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-7xl mx-auto pb-20"
    >
      <div className="grid grid-cols-5 gap-6">
        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-sm">
              <BarChart3 size={18} className="text-primary" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Model confidence</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{modelConfidencePct}%</span>
            <span className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-tighter">{modelConfidencePct >= 90 ? 'High' : modelConfidencePct >= 75 ? 'Medium' : 'Low'}</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-sm">
              <ShieldCheck size={18} className="text-emerald-500" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Compliance</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{analysis.compliance_score}%</span>
            <span className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-tighter">Verified</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-sm">
              <Activity size={18} className="text-amber-500" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Risk Index</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{analysis.risk_score}/100</span>
            <span className={`text-[10px] font-bold mb-1 uppercase tracking-tighter ${riskLabelColor}`}>{riskLabel}</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-sm">
              <Timer size={18} className="text-primary" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Processing time</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{processingText}</span>
            <span className="text-[10px] font-bold text-primary mb-1 uppercase tracking-tighter">Real-time</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-500/10 rounded-sm">
              <FileScan size={18} className="text-cyan-400" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Extracted Fields</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{extractedEntries.length}</span>
            <span className="text-[10px] font-bold text-cyan-400 mb-1 uppercase tracking-tighter">Structured</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8 space-y-8">
          {routingDecision && (
            <section className="card-elevated p-6 border border-primary/20">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Workflow Routing Decision</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  {Math.round(Number(routingDecision.confidence || 0) * 100)}% confidence
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Selected Workflow</p>
                  <p className="font-bold text-on-surface">{String(routingDecision.selectedWorkflowName || 'Unknown')}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest">
                    Source: {String(routingDecision.source || 'unknown').replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Decision Drivers</p>
                  <ul className="space-y-1 text-on-surface-variant">
                    {Array.isArray(routingDecision.reasons) && routingDecision.reasons.length > 0 ? (
                      (routingDecision.reasons as unknown[]).slice(0, 3).map((reason, idx) => (
                        <li key={idx}>• {String(reason)}</li>
                      ))
                    ) : (
                      <li>• Default workflow fallback applied.</li>
                    )}
                  </ul>
                </div>
              </div>
              {routingAlternatives.length > 1 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Alternative Candidates</p>
                  <div className="space-y-2">
                    {routingAlternatives.slice(1, 3).map((alt, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-sm border border-outline-variant/10 px-3 py-2 text-xs">
                        <span className="text-on-surface">{String(alt.workflowName || alt.workflowKey || 'Unknown')}</span>
                        <span className="text-on-surface-variant">{Math.round(Number(alt.score || 0) * 100)} score</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Resolved Workflow Key</p>
                  <p className="font-semibold text-on-surface break-all">
                    {String(routingDecision.selectedWorkflowKey || 'not_available')}
                  </p>
                </div>
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Cascade Workflow Keys</p>
                  <p className="font-semibold text-on-surface break-all">
                    {Array.isArray(routingContext?.cascadeWorkflowKeys) && (routingContext?.cascadeWorkflowKeys as unknown[]).length > 0
                      ? (routingContext?.cascadeWorkflowKeys as unknown[]).map((item) => String(item)).join(', ')
                      : 'none'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {preProcessor && (
            <section className="card-elevated p-6 border border-cyan-500/20">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <FileScan size={18} className="text-cyan-400" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Document Split Map</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {containsLargePdf ? 'Large PDF cascade' : 'Standard split'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">PDF Pages</p>
                  <p className="font-bold text-on-surface">{totalPdfPages}</p>
                </div>
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Cascade Required</p>
                  <p className="font-bold text-on-surface">{Boolean(preProcessor.cascadeRequired) ? 'Yes' : 'No'}</p>
                </div>
                <div className="p-3 rounded-sm border border-outline-variant/20 bg-surface-container-low">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Claim Type</p>
                  <p className="font-bold text-on-surface">{String((preProcessor.triage as Record<string, unknown> | undefined)?.claimType || 'unknown')}</p>
                </div>
              </div>

              {groupRows.length > 0 && (
                <div className="space-y-2 mb-4">
                  {groupRows.map((row) => (
                    <div key={row.groupName} className="flex items-center justify-between rounded-sm border border-outline-variant/10 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-on-surface font-semibold">{toTitle(row.groupName)}</p>
                        <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">Routed: {toTitle(row.routedAgent)}</p>
                      </div>
                      <span className="text-cyan-400 font-bold">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {(recommendedWorkflowKeys.length > 0 || cascadeWorkflowNames.length > 0) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Cascade Workflow Plan</p>
                  <div className="flex flex-wrap gap-2">
                    {(cascadeWorkflowNames.length > 0 ? cascadeWorkflowNames : recommendedWorkflowKeys).map((label) => (
                      <span key={label} className="text-[10px] px-2 py-1 rounded-sm bg-primary/15 text-primary uppercase tracking-widest font-bold">
                        {String(label).replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {(policyKnowledgeSummary || policyEvidence.length > 0) && (
            <section className="card-elevated p-6 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Database size={16} className="text-cyan-400" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Policy Knowledge Evidence</h2>
              </div>
              {policyKnowledgeSummary && (
                <p className="text-xs text-on-surface-variant mb-4">{policyKnowledgeSummary}</p>
              )}
              {policyEvidence.length > 0 && (
                <div className="space-y-2">
                  {policyEvidence.slice(0, 5).map((hit, idx) => (
                    <div key={idx} className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3">
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                        {String(hit.doc || 'Policy Document')} {hit.page ? `• Page ${String(hit.page)}` : ''}
                      </p>
                      <p className="text-xs text-on-surface leading-relaxed">{String(hit.text || 'Matched policy clause')}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="card-elevated p-8 relative">
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em]">Live review</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <FileText size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">The Truth of the Case</h2>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-sm text-on-surface-variant leading-relaxed font-sans">
                {analysis.truth_summary}
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Identity & Policy Alignment</h4>
                <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                  {analysis.person_policy}
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Fraud & Coverage Validation</h4>
                <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                  {analysis.fraud_validation}
                </p>
              </div>
            </div>
            {ocrText.length > 0 && (
              <div className="mt-6 pt-6 border-t border-outline-variant/10">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">OCR Evidence Snippet</h4>
                <p className="text-xs text-on-surface-variant/80 leading-relaxed line-clamp-6">
                  {ocrText.slice(0, 1200)}
                </p>
              </div>
            )}
          </section>

          <section className="card-elevated p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Medical Data Extraction Status</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Processing</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-8">
              <CircularProgress value={caseData.document_extraction_status?.[0]?.progress ?? 100} label={caseData.document_extraction_status?.[0]?.type ?? 'Identity Verified'} color="#10b981" />
              <CircularProgress value={caseData.document_extraction_status?.[1]?.progress ?? 100} label={caseData.document_extraction_status?.[1]?.type ?? 'Policy Matched'} color="#10b981" />
              <CircularProgress value={caseData.document_extraction_status?.[2]?.progress ?? 85} label={caseData.document_extraction_status?.[2]?.type ?? 'Medical Records'} color="#0066FF" />
              <CircularProgress value={caseData.document_extraction_status?.[3]?.progress ?? 40} label={caseData.document_extraction_status?.[3]?.type ?? 'Lab Analysis'} color="#0066FF" />
            </div>
          </section>

          <section className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <Activity size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Medical Report Analysis</h2>
            </div>

            {ocrFailedDocuments > 0 && (
              <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
                <p className="text-xs font-semibold text-amber-300 mb-1">
                  OCR could not parse {ocrFailedDocuments} document(s) in this run.
                </p>
                {ocrFailedDocumentNames.length > 0 && (
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Failed files: {ocrFailedDocumentNames.slice(0, 8).join(', ')}
                    {ocrFailedDocumentNames.length > 8 ? ` +${ocrFailedDocumentNames.length - 8} more` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-4 mb-6">
              <p className="text-xs text-on-surface-variant leading-relaxed">{medicalSummary}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Primary Diagnosis</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {diagnosisCandidates[0] || 'Not clearly detected from current documents'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Symptoms / Chief Complaint</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {symptomCandidates[0] || 'Not clearly detected from current documents'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Treatment / Procedure</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {treatmentCandidates[0] || 'Not clearly detected from current documents'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Provider Context</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {providerName || 'Provider not detected'}
                  {(admissionDate || dischargeDate) && (
                    <span className="block mt-2 text-on-surface-variant">
                      Admission: {admissionDate || 'N/A'} | Discharge: {dischargeDate || 'N/A'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">OCR Processed</p>
                <p className="text-xl font-black text-emerald-400">{ocrProcessedDocuments}</p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">OCR Failed</p>
                <p className="text-xl font-black text-amber-400">{ocrFailedDocuments}</p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Text Length</p>
                <p className="text-xl font-black text-primary">{Math.max(ocrText.length, sourceTextLength)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Critical Clinical Flags</p>
                {criticalSignals.length === 0 ? (
                  <p className="text-xs text-emerald-400">No high-severity keywords detected in current OCR text.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {criticalSignals.map((flag) => (
                      <span key={flag} className="text-[10px] px-2 py-1 rounded-sm bg-error/15 text-error uppercase tracking-widest font-bold">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Medication Indicators</p>
                {medicationSignals.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No clear medication/dose markers detected yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {medicationSignals.map((flag) => (
                      <span key={flag} className="text-[10px] px-2 py-1 rounded-sm bg-primary/15 text-primary uppercase tracking-widest font-bold">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Full Report Highlights</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Diagnosis</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {dischargeDiagnosis || 'Not clearly parsed from report text'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Condition On Discharge</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {dischargeCondition || 'Not clearly parsed from report text'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Admission Date</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {admissionInfo || 'Not found'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Discharge Date</p>
                <p className="text-xs text-on-surface leading-relaxed">
                  {dischargeInfo || 'Not found'}
                </p>
              </div>
            </div>
            <div className="card-elevated p-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Follow-up / Plan</p>
              <p className="text-xs text-on-surface leading-relaxed">
                {followUpPlan || 'Follow-up plan not clearly parsed from report text'}
              </p>
            </div>
          </section>

          <section className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <Database size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Structured Extraction Matrix</h2>
            </div>
            {extractedEntries.length === 0 ? (
              <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-4 text-xs text-on-surface-variant">
                No extracted fields yet. The extraction agent output will appear here as soon as OCR + parsing completes.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {extractedEntries.map(([key, value]) => (
                  <div key={key} className="card-elevated p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{toTitle(key)}</p>
                    <p className="text-sm font-semibold text-on-surface break-words">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Document Intelligence</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Received</p>
                <p className="text-2xl font-black text-on-surface">{totalDocs}</p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Verified</p>
                <p className="text-2xl font-black text-emerald-500">{completeDocs}</p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Missing</p>
                <p className="text-2xl font-black text-amber-500">{missingDocs}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-surface-container-low overflow-hidden mb-2">
              <div className="h-full bg-primary transition-all duration-700" style={{ width: `${verificationPct}%` }} />
            </div>
            <p className="text-[11px] text-on-surface-variant mb-4">{verificationPct}% documents currently verified</p>

            <div className="space-y-3">
              {(caseData.documents || []).map((doc) => (
                <div key={doc.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface truncate">{doc.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">{doc.type}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-sm font-bold uppercase tracking-widest ${
                      doc.status === 'VERIFIED'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : doc.status === 'REJECTED'
                          ? 'bg-error/15 text-error'
                          : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-4 space-y-8">
          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Risk Markers</h2>
            </div>
            <div className="space-y-4">
              {caseData.risk_markers?.map((marker) => (
                <div key={marker.id} className="card-elevated p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">{marker.type}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">{marker.status}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">{marker.description}</p>
                </div>
              ))}
              {(!caseData.risk_markers || caseData.risk_markers.length === 0) && (
                <div className="card-elevated p-4">
                  <p className="text-[11px] text-on-surface-variant leading-tight">No significant risk markers identified.</p>
                </div>
              )}
            </div>
          </section>

          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={18} className="text-primary" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Compliance Checklist</h2>
            </div>
            <div className="space-y-3">
              {complianceChecklist.map((item) => (
                <div key={item.label} className="card-elevated p-3">
                  <div className="flex items-start gap-3">
                    {item.ok ? (
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <CircleOff size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-[11px] font-bold text-on-surface">{item.label}</p>
                      <p className="text-[10px] text-on-surface-variant">{item.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock3 size={18} className="text-primary" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Agent Execution Evidence</h2>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {timeline.length === 0 && (
                <div className="card-elevated p-4 text-[11px] text-on-surface-variant">
                  Agent execution trail will appear here when workflow runs are available.
                </div>
              )}
              {timeline.slice(0, 10).map((entry) => (
                <div key={entry.id} className="card-elevated p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[11px] font-bold text-on-surface">{entry.actor.name}</p>
                    <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-primary mb-1">{entry.node_id || 'workflow_step'}</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{entry.action}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={18} className="text-primary" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Next Recommended Actions</h2>
            </div>
            <div className="space-y-3">
              <div className="card-elevated p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Automated Action</span>
                </div>
                <p className="text-[11px] font-bold text-on-surface uppercase tracking-tight">
                  {riskIndex >= 70 ? 'Escalate To Fraud Review' : riskIndex >= 40 ? 'Route To Human Review' : 'Approve & Continue'}
                </p>
              </div>
              <div className="card-elevated p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Manual Review</span>
                </div>
                <p className="text-[11px] font-bold text-on-surface uppercase tracking-tight">
                  {extractionInsight?.description || 'Verify OCR extraction against source documents'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, Play, SearchCheck, Filter, FileText, Activity } from 'lucide-react';

type FraudSector = 'insurance' | 'banking';

type FraudRule = {
  key: string;
  sector: FraudSector;
  fraudType: string;
  description: string;
  severity: 'medium' | 'high' | 'critical';
  weight: number;
  signals: string[];
};

type FraudDemoDocument = {
  id: string;
  name: string;
  type: string;
  summary: string;
  content: string;
};

type FraudDemoCase = {
  id: string;
  caseCode: string;
  sector: FraudSector;
  product: string;
  title: string;
  claimOrTxnAmount: number;
  customerName: string;
  customerId: string;
  policyOrAccountNumber: string;
  channel: string;
  geo: string;
  expectedLabel: 'fraud' | 'genuine';
  expectedFraudType?: string;
  signals: Record<string, string | number | boolean>;
  documents: FraudDemoDocument[];
  source?: 'library' | 'upload';
};

type FraudFinding = {
  ruleKey: string;
  fraudType: string;
  severity: 'medium' | 'high' | 'critical';
  scoreContribution: number;
  evidence: string[];
};

type FraudDetectionResult = {
  caseId: string;
  caseCode: string;
  sector: FraudSector;
  riskScore: number;
  riskBand: 'low' | 'medium' | 'high' | 'critical';
  verdict: 'allow' | 'review' | 'block';
  triggeredFindings: FraudFinding[];
  summary: string;
};

type FraudSweepResponse = {
  metrics: {
    total: number;
    flagged: number;
    blocked: number;
    review: number;
  };
  results: Array<FraudDetectionResult & { expectedLabel: 'fraud' | 'genuine'; expectedFraudType?: string }>;
};

const severityClass = (severity: FraudFinding['severity']) => {
  if (severity === 'critical') return 'text-red-300 border-red-500/30 bg-red-500/10';
  if (severity === 'high') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
};

const FRAUD_UPLOADED_STORAGE_KEY = 'aurastack_fraud_uploaded_cases_v1';

export const FraudDetectionView: React.FC = () => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [sector, setSector] = useState<FraudSector>('insurance');
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [cases, setCases] = useState<FraudDemoCase[]>([]);
  const [uploadedCases, setUploadedCases] = useState<FraudDemoCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<FraudDemoCase | null>(null);
  const [detectionResult, setDetectionResult] = useState<FraudDetectionResult | null>(null);
  const [sweep, setSweep] = useState<FraudSweepResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRules = useMemo(
    () => rules.filter((rule) => rule.sector === sector),
    [rules, sector]
  );

  const visibleCases = useMemo(() => {
    const uploaded = uploadedCases.filter((item) => item.sector === sector);
    return [...uploaded, ...cases];
  }, [cases, uploadedCases, sector]);

  const loadTaxonomy = async () => {
    const response = await fetch('/api/fraud/system/taxonomy');
    if (!response.ok) throw new Error(`Failed to load taxonomy (${response.status})`);
    const payload = await response.json();
    setRules(Array.isArray(payload?.data?.rules) ? payload.data.rules : []);
  };

  const loadCases = async (targetSector: FraudSector) => {
    const response = await fetch(`/api/fraud/system/demo-cases?sector=${targetSector}`);
    if (!response.ok) throw new Error(`Failed to load demo cases (${response.status})`);
    const payload = await response.json();
    const list = Array.isArray(payload?.data) ? payload.data : [];
    setCases(list);
    const uploadedForSector = uploadedCases.filter((item) => item.sector === targetSector);
    const currentStillValid =
      selectedCaseId.length > 0 &&
      (selectedCaseId.startsWith('upload-')
        ? uploadedForSector.some((item) => item.id === selectedCaseId)
        : list.some((item) => item.id === selectedCaseId));
    if (currentStillValid) {
      return;
    }
    if (uploadedForSector.length > 0) {
      setSelectedCaseId(uploadedForSector[0].id);
      setSelectedCase(uploadedForSector[0]);
    } else if (list.length > 0) {
      setSelectedCaseId(list[0].id);
      setSelectedCase(list[0]);
    } else {
      setSelectedCaseId('');
      setSelectedCase(null);
    }
  };

  const loadCaseById = async (caseId: string) => {
    if (!caseId) {
      setSelectedCase(null);
      return;
    }
    if (caseId.startsWith('upload-')) {
      const uploaded = uploadedCases.find((item) => item.id === caseId) ?? null;
      setSelectedCase(uploaded);
      return;
    }
    const response = await fetch(`/api/fraud/system/demo-cases/${caseId}`);
    if (!response.ok) throw new Error(`Failed to load case details (${response.status})`);
    const payload = await response.json();
    setSelectedCase(payload?.data ?? null);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadTaxonomy(), loadCases(sector)]);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load fraud demo');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [sector]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!selectedCaseId) return;
      try {
        await loadCaseById(selectedCaseId);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load selected case');
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [selectedCaseId, uploadedCases]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FRAUD_UPLOADED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setUploadedCases(parsed as FraudDemoCase[]);
      }
    } catch {
      // ignore corrupted local state
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FRAUD_UPLOADED_STORAGE_KEY, JSON.stringify(uploadedCases));
    } catch {
      // storage quota/privacy mode errors can be ignored for demo
    }
  }, [uploadedCases]);

  const handleDetectSelected = async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    setError(null);
    try {
      const isUploadedCase = selectedCaseId.startsWith('upload-');
      const body = isUploadedCase
        ? {
            sector,
            title: selectedCase?.title ?? 'Uploaded evidence case',
            amount: selectedCase?.claimOrTxnAmount ?? 0,
            signals: selectedCase?.signals ?? {}
          }
        : {
            caseId: selectedCaseId,
            sector
          };
      const response = await fetch('/api/fraud/system/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`Detection failed (${response.status})`);
      const payload = await response.json();
      setDetectionResult(payload?.data?.result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSweep = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/fraud/system/demo-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector })
      });
      if (!response.ok) throw new Error(`Sweep failed (${response.status})`);
      const payload = await response.json();
      setSweep(payload?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setLoading(false);
    }
  };

  const inferSignalsFromText = (text: string): Record<string, string | number | boolean> => {
    const normalized = text.toLowerCase();
    const has = (pattern: RegExp) => pattern.test(normalized);
    return {
      duplicateClaimCount: has(/duplicate|same claim|resubmitted/) ? 2 : 0,
      sameInvoiceHashSeen: has(/same invoice|repeated invoice|invoice copy/) ? 1 : 0,
      procedureDiagnosisMismatch: has(/mismatch|unrelated diagnosis|not indicated/) ? 1 : 0,
      providerAnomalyScore: has(/anomaly|suspicious provider|blacklist/) ? 0.8 : 0.2,
      billingInflationPercent: has(/inflated|overbilled|upcoding|unbundling/) ? 38 : 5,
      waitingPeriodBreach: has(/waiting period|policy not active|cooling period/) ? 1 : 0,
      excludedConditionFlag: has(/excluded condition|non payable|pre-existing/) ? 1 : 0,
      metadataMismatch: has(/tampered|edited|photoshop|forged/) ? 1 : 0,
      ocrInconsistency: has(/inconsistent|conflicting values|date mismatch/) ? 1 : 0,
      signatureIrregularity: has(/missing signature|signature mismatch/) ? 1 : 0
    };
  };

  const toUploadCase = (file: File, text: string): FraudDemoCase => {
    const now = Date.now();
    const code = `FRD-UPL-${String(now).slice(-6)}`;
    const signals = inferSignalsFromText(`${file.name}\n${text}`);
    const amountMatch = text.match(/(?:inr|rs\.?|₹)\s*([0-9,]{4,})/i);
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;
    return {
      id: `upload-${now}-${Math.random().toString(36).slice(2, 7)}`,
      caseCode: code,
      sector,
      product: sector === 'insurance' ? 'Uploaded Insurance Claim' : 'Uploaded Banking Event',
      title: `Uploaded evidence: ${file.name}`,
      claimOrTxnAmount: Number.isFinite(amount) ? amount : 0,
      customerName: 'Uploaded Customer',
      customerId: 'UPL-CUST',
      policyOrAccountNumber: 'UPL-REF-001',
      channel: 'upload',
      geo: 'Unknown',
      expectedLabel: 'genuine',
      signals,
      source: 'upload',
      documents: [
        {
          id: `doc-${now}`,
          name: file.name,
          type: file.type || 'application/octet-stream',
          summary: `Uploaded from Fraud Lab (${Math.max(1, Math.round(file.size / 1024))} KB).`,
          content: (text || '').slice(0, 2000) || 'Binary file uploaded for fraud evaluation.'
        }
      ]
    };
  };

  const readFileText = async (file: File): Promise<string> => {
    const lower = file.name.toLowerCase();
    const canReadAsText =
      file.type.startsWith('text/') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.json') ||
      lower.endsWith('.html') ||
      lower.endsWith('.xml');
    if (!canReadAsText) return '';
    return await file.text();
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const files = Array.from(fileList).slice(0, 5);
      const builtCases: FraudDemoCase[] = [];
      for (const file of files) {
        const text = await readFileText(file);
        builtCases.push(toUploadCase(file, text));
      }
      if (builtCases.length > 0) {
        setUploadedCases((prev) => [...builtCases, ...prev]);
        setSelectedCaseId(builtCases[0].id);
        setSelectedCase(builtCases[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process uploaded evidence');
    } finally {
      setLoading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  return (
    <div className="page-shell max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-kicker">Risk Intelligence</p>
          <h1 className="page-title">Fraud Detection Lab</h1>
          <p className="page-description">Dedicated fraud demo system for Insurance and Banking with rule-level evidence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSector('insurance')}
            className={`btn ${sector === 'insurance' ? 'btn-primary' : 'btn-muted'}`}
          >
            <Filter size={14} /> Insurance
          </button>
          <button
            type="button"
            onClick={() => setSector('banking')}
            className={`btn ${sector === 'banking' ? 'btn-primary' : 'btn-muted'}`}
          >
            <Filter size={14} /> Banking
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDetectSelected} disabled={!selectedCaseId || loading}>
            <SearchCheck size={14} /> Detect Selected
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => uploadInputRef.current?.click()}
            disabled={loading}
          >
            <FileText size={14} /> Upload Evidence
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDemoSweep} disabled={loading}>
            <Play size={14} /> Run Sweep
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt,.csv,.json,.html,.xml,.png,.jpg,.jpeg"
            onChange={(e) => void handleUploadFiles(e.target.files)}
          />
        </div>
      </header>

      {error && (
        <div className="rounded-sm border border-red-500/35 bg-red-500/10 px-4 py-3 text-[11px] uppercase tracking-wide text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-widest">Rule Taxonomy</h2>
          </div>
          <div className="space-y-2 max-h-[56vh] overflow-y-auto custom-scrollbar pr-1">
            {filteredRules.map((rule) => (
              <div key={rule.key} className="rounded-sm border border-outline-variant/20 bg-surface-container-low px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-on-surface">{rule.fraudType}</p>
                  <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest rounded border ${rule.severity === 'critical' ? 'text-red-300 border-red-500/30' : rule.severity === 'high' ? 'text-amber-300 border-amber-500/30' : 'text-cyan-300 border-cyan-500/30'}`}>
                    {rule.severity}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-on-surface-variant">{rule.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rule.signals.map((signal) => (
                    <span key={signal} className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Activity size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-widest">Demo Cases</h2>
          </div>
          <div className="space-y-2 max-h-[56vh] overflow-y-auto custom-scrollbar pr-1">
            {visibleCases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedCaseId(item.id)}
                className={`w-full text-left rounded-sm border px-3 py-2 transition-colors ${
                  selectedCaseId === item.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-outline-variant/20 bg-surface-container-low hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-on-surface truncate">{item.caseCode}</p>
                  <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border ${item.expectedLabel === 'fraud' ? 'text-red-300 border-red-500/30' : 'text-emerald-300 border-emerald-500/30'}`}>
                    {item.expectedLabel}
                  </span>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1 line-clamp-2">{item.title}</p>
                {item.source === 'upload' && (
                  <p className="text-[9px] uppercase tracking-widest text-primary mt-1">Uploaded</p>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <AlertTriangle size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-widest">Detection Output</h2>
          </div>
          {!detectionResult ? (
            <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3 text-[11px] text-on-surface-variant">
              Run detection for selected case to view score, verdict, and triggered fraud findings.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Verdict</p>
                <p className="text-sm font-semibold text-on-surface mt-1">{detectionResult.verdict.toUpperCase()} ({detectionResult.riskBand.toUpperCase()})</p>
                <p className="text-[11px] text-on-surface-variant mt-1">Risk Score: {detectionResult.riskScore}/100</p>
                <p className="text-[11px] text-on-surface-variant mt-2">{detectionResult.summary}</p>
              </div>
              <div className="space-y-2 max-h-[34vh] overflow-y-auto custom-scrollbar pr-1">
                {detectionResult.triggeredFindings.map((finding) => (
                  <div key={finding.ruleKey} className={`rounded-sm border px-3 py-2 ${severityClass(finding.severity)}`}>
                    <p className="text-[11px] font-semibold">{finding.fraudType}</p>
                    <p className="text-[10px] mt-1">{finding.ruleKey} • +{finding.scoreContribution}</p>
                    <ul className="mt-2 space-y-1">
                      {finding.evidence.map((ev) => (
                        <li key={ev} className="text-[10px] opacity-90">• {ev}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <FileText size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-widest">Selected Case Evidence Docs</h3>
          </div>
          {!selectedCase ? (
            <p className="text-[11px] text-on-surface-variant">No case selected.</p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {selectedCase.documents.map((doc) => (
                <div key={doc.id} className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-on-surface">{doc.name}</p>
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{doc.type}</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">{doc.summary}</p>
                  <p className="text-[10px] text-on-surface-variant mt-2 line-clamp-3">{doc.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-widest">Sector Sweep Metrics</h3>
          </div>
          {!sweep ? (
            <p className="text-[11px] text-on-surface-variant">Run sweep to view aggregate detection performance for this sector.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Total" value={sweep.metrics.total} />
                <MetricCard label="Flagged" value={sweep.metrics.flagged} />
                <MetricCard label="Review" value={sweep.metrics.review} />
                <MetricCard label="Blocked" value={sweep.metrics.blocked} />
              </div>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
                {sweep.results.map((result) => (
                  <div key={result.caseId} className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-on-surface">{result.caseCode}</p>
                      <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border border-outline-variant/30 text-on-surface-variant">
                        {result.verdict}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1">Score {result.riskScore}/100 • {result.riskBand}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-sm border border-primary/40 bg-surface-container-high px-3 py-2 text-[10px] uppercase tracking-wider text-primary">
          Fraud engine processing...
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low p-3">
    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</p>
    <p className="text-lg font-semibold text-on-surface mt-1">{value}</p>
  </div>
);

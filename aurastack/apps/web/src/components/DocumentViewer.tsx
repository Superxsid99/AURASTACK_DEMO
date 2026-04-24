import React, { useEffect, useMemo, useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileSearch, 
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DocumentViewerProps {
  document: {
    id: string;
    name: string;
    type: string;
    status: string;
    pages?: number;
    url?: string;
    extraction_data?: Record<string, any>;
  };
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  const [page, setPage] = useState(1);
  const isImage = document.type.toLowerCase().startsWith('image/');
  const isPdf = document.type.toLowerCase().includes('pdf');
  const hasBinaryUrl = Boolean(document.url);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [document.id]);

  useEffect(() => {
    let localBlobUrl: string | null = null;
    setPreviewError(null);
    setBlobUrl(null);

    if (isPdf && document.url?.startsWith('data:application/pdf;base64,')) {
      try {
        const base64 = document.url.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        localBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(localBlobUrl);
      } catch {
        setPreviewError('Unable to decode PDF binary for preview.');
      }
    }

    return () => {
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [document.url, isPdf]);

  const inferredPageCount = useMemo(() => {
    const extraction = document.extraction_data || {};
    const candidates = [
      document.pages,
      extraction.pages,
      extraction.pageCount,
      extraction.totalPages,
      extraction.pdf_pages,
      extraction.documentPages
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.max(1, Math.trunc(numeric));
      }
    }
    return isPdf ? 1 : 3;
  }, [document.pages, document.extraction_data, isPdf]);

  const totalPages = hasBinaryUrl ? inferredPageCount : 3;
  const basePreviewUrl = blobUrl || document.url || '';
  const pdfPageUrl = isPdf && basePreviewUrl
    ? `${basePreviewUrl}${basePreviewUrl.includes('#') ? '&' : '#'}page=${page}&zoom=page-width`
    : basePreviewUrl;
  const [activeTab, setActiveTab] = useState<'content' | 'insights'>('content');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const mockContent = [
    "PATIENT ADMISSION RECORD\n\nPatient Name: John Doe\nDate of Birth: 1985-05-12\nPolicy Number: POL-99283-X\nAdmission Date: 2026-03-28\n\nSymptoms: Severe abdominal pain, nausea, fever.\nPreliminary Diagnosis: Acute Appendicitis.\n\nAttending Physician: Dr. Sarah Miller",
    "CLINICAL OBSERVATIONS\n\nVital Signs:\n- BP: 130/85\n- HR: 92 bpm\n- Temp: 101.2 F\n\nLaboratory Tests Ordered:\n- CBC with differential\n- Urinalysis\n- Abdominal CT Scan\n\nNotes: Patient is stable but in significant discomfort. Pain management initiated.",
    "INSURANCE VERIFICATION\n\nProvider: Aura Health Insurance\nCoverage Status: Active\nPre-authorization: Required for surgical procedures.\n\nCo-pay: $250\nDeductible: $1,500 (Met: $1,200)\n\nVerification Agent: AI-System-42"
  ];
  const extractedTextFallback = document.extraction_data
    ? Object.entries(document.extraction_data)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join('\n')
    : '';
  const copySourceText = hasBinaryUrl ? extractedTextFallback : mockContent[page - 1];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/80 backdrop-blur-sm p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-2xl w-full max-w-6xl h-full flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-sm text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-tighter">{document.name}</h2>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                {document.type} • {document.id} • 
                <span className={`px-1.5 py-0.5 rounded-sm ${document.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {document.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-container p-1 rounded-sm border border-outline-variant/10 mr-4">
              <button 
                type="button"
                onClick={() => setActiveTab('content')}
                className={`btn px-3 transition-all ${activeTab === 'content' ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-high/50 hover:text-on-surface'}`}
              >
                Document
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`btn px-3 transition-all ${activeTab === 'insights' ? 'bg-secondary text-on-secondary' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-high/50 hover:text-on-surface'}`}
              >
                AI insights
              </button>
            </div>
            <button type="button" className="btn-icon-sm rounded-full">
              <Download size={16} />
            </button>
            <button type="button" onClick={onClose} className="btn-icon-sm rounded-full">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Document Content */}
          <div className={`flex-1 flex flex-col bg-surface overflow-hidden transition-all ${activeTab === 'insights' ? 'opacity-50' : ''}`}>
            {/* Toolbar */}
            <div className="px-6 py-2 border-b border-outline-variant/5 flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn-icon-sm disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Page {page} of {totalPages}</span>
                  <button 
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="btn-icon-sm disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="h-4 w-px bg-outline-variant/20"></div>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
                  <input 
                    type="text" 
                    placeholder="Search in document..." 
                    className="bg-surface-container border border-outline-variant/10 pl-7 pr-3 py-1 rounded-sm text-[10px] focus:outline-none focus:border-primary/40 w-48"
                  />
                </div>
              </div>
              <button 
                type="button"
                onClick={() => handleCopy(copySourceText || 'No extracted text available for this document.')}
                className="btn btn-ghost text-primary hover:bg-surface-container-high"
              >
                <Copy size={12} className="shrink-0" />
                Copy text
              </button>
            </div>

            {/* Document Render */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar flex justify-center">
              {hasBinaryUrl ? (
                <div className="w-full max-w-5xl min-h-[720px]">
                  {isImage && (
                    <img
                      src={basePreviewUrl}
                      alt={document.name}
                      className="max-w-full max-h-[78vh] mx-auto rounded-md shadow-lg border border-outline-variant/20 object-contain bg-black/20"
                    />
                  )}
                  {isPdf && (
                    <>
                      {previewError ? (
                        <div className="bg-error/10 border border-error/20 text-error p-4 rounded-md text-sm">
                          {previewError}
                        </div>
                      ) : (
                        <iframe
                          title={document.name}
                          src={pdfPageUrl}
                          className="w-full h-[78vh] rounded-md border border-outline-variant/20 bg-surface"
                        />
                      )}
                    </>
                  )}
                  {!isImage && !isPdf && (
                    <div className="bg-surface-container p-6 rounded-md border border-outline-variant/20 text-sm text-on-surface-variant">
                      Binary preview is not supported for this file type. Use download to open it.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white text-black w-full max-w-3xl min-h-[1000px] shadow-lg p-16 font-sans leading-relaxed whitespace-pre-wrap relative">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-45 select-none">
                    <div className="text-9xl font-black uppercase tracking-tighter">AURA SECURE</div>
                  </div>
                  {mockContent[page-1]}
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Insights Panel */}
          <div className={`w-96 border-l border-outline-variant/10 bg-surface-container-low flex flex-col transition-all ${activeTab === 'insights' ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}`}>
            <div className="p-6 border-b border-outline-variant/10 flex items-center gap-2">
              <FileSearch size={18} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">Extraction Insights</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {document.extraction_data ? (
                Object.entries(document.extraction_data).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{key.replace(/_/g, ' ')}</div>
                    <div className="bg-surface-container p-3 rounded-sm border border-outline-variant/5 flex items-center justify-between group">
                      <span className="text-xs font-bold text-on-surface">{String(value)}</span>
                      <button 
                        onClick={() => handleCopy(String(value))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-container-high rounded-sm text-primary"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">Entity Verification</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant leading-tight">AI has cross-referenced patient data with policy POL-99283-X. 100% match found.</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40">Extracted Fields</h4>
                    {[
                      { label: 'Patient Name', value: 'John Doe', confidence: 0.99 },
                      { label: 'Policy Number', value: 'POL-99283-X', confidence: 0.98 },
                      { label: 'Diagnosis', value: 'Acute Appendicitis', confidence: 0.94 },
                      { label: 'Physician', value: 'Dr. Sarah Miller', confidence: 0.97 },
                      { label: 'Admission Date', value: '2026-03-28', confidence: 0.99 }
                    ].map((field, i) => (
                      <div key={i} className="flex items-center justify-between p-2 hover:bg-surface-container-high rounded-sm transition-colors cursor-pointer">
                        <div>
                          <div className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{field.label}</div>
                          <div className="text-xs font-bold text-on-surface">{field.value}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">{(field.confidence * 100).toFixed(0)}% Conf.</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={14} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">Action Required</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant leading-tight">Signature detected but requires human verification to confirm identity match.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-surface-container border-t border-outline-variant/10">
              <button type="button" className="btn btn-primary btn-block">
                Verify all fields
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

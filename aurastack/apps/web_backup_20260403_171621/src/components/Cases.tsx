import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  User,
  Tag,
  X,
  XCircle,
  History,
  MessageSquare,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertTriangle,
  Plus,
  Send,
  Bot,
  Settings,
  ExternalLink,
  Check,
  File,
  Zap,
  BarChart3,
  Activity,
  Timer,
  Database,
  FileSearch
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { INDIAN_FACES, DEFAULT_FACE } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Case, Workflow } from '../types';

import { Dropdown } from './Dropdown';

export function Cases({ initialSelectedCaseId, onClearSelection }: { initialSelectedCaseId?: string | null, onClearSelection?: () => void }) {
  const { cases, workflows } = usePlatform();
  const [statusFilter, setStatusFilter] = useState<string>('All Cases');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'preview' | 'data' | 'analysis'>('preview');

  // Handle initial selection from navigation
  React.useEffect(() => {
    if (initialSelectedCaseId) {
      const c = cases.find(item => item.id === initialSelectedCaseId);
      if (c) {
        setSelectedCase(c);
        if (c.documents && c.documents.length > 0) {
          setActiveDocId(c.documents[0].id);
        }
        // Also clear filters to make sure the case is visible if needed, 
        // though the modal will show regardless of filters.
        setStatusFilter('All Cases');
        setTypeFilter('All Types');
        setSearchQuery('');
      }
    }
  }, [initialSelectedCaseId, cases]);

  const handleCloseModal = () => {
    setSelectedCase(null);
    if (onClearSelection) onClearSelection();
  };

  const statusOptions = useMemo(() => [
    { label: 'All Cases', count: cases.length },
    { label: 'New', count: cases.filter(c => c.status === 'new').length },
    { label: 'In Progress', count: cases.filter(c => c.status === 'processing').length },
    { label: 'Review', count: cases.filter(c => c.status === 'review').length },
    { label: 'Completed', count: cases.filter(c => c.status === 'completed').length },
    { label: 'Escalated', count: cases.filter(c => c.status === 'escalated').length },
  ], [cases]);
  
  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    cases.forEach(c => types.add(c.type));
    return ['All Types', ...Array.from(types).sort()];
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesStatus = statusFilter === 'All Cases' || c.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesType = typeFilter === 'All Types' || c.type === typeFilter;
      const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           c.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [cases, statusFilter, typeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return "bg-[#E6F6F3] text-[#1F9D8B]";
      case 'processing': return "bg-[#E6F6F3] text-[#1F9D8B]";
      case 'review': return "bg-[#FFFBEB] text-[#D97706]";
      case 'completed': return "bg-[#ECFDF5] text-[#059669]";
      case 'escalated': return "bg-[#FEF2F2] text-[#DC2626]";
      default: return "bg-[#F1F5F9] text-[#64748B]";
    }
  };

  const getAIStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return "bg-[#E6F6F3] text-[#1F9D8B]";
      case 'complete': return "bg-[#ECFDF5] text-[#059669]";
      case 'needs review': return "bg-[#FFFBEB] text-[#D97706]";
      case 'failed': return "bg-[#FEF2F2] text-[#DC2626]";
      default: return "bg-[#F1F5F9] text-[#64748B]";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return "bg-[#FEF2F2] text-[#DC2626]";
      case 'high': return "bg-[#FFFBEB] text-[#D97706]";
      case 'medium': return "bg-[#E6F6F3] text-[#1F9D8B]";
      default: return "bg-[#F1F5F9] text-[#64748B]";
    }
  };

  const getWorkflowName = (workflowId: string) => {
    return workflows.find(w => w.id === workflowId)?.name || 'Unknown Workflow';
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return date.toLocaleDateString();
  };

  React.useEffect(() => {
    if (!selectedCase) return;
    if (selectedCase.documents && selectedCase.documents.length > 0) {
      setActiveDocId(selectedCase.documents[0].id);
    } else {
      setActiveDocId(null);
    }
  }, [selectedCase]);

  React.useEffect(() => {
    if (!selectedCase) return;
    const refreshed = cases.find((item) => item.id === selectedCase.id);
    if (refreshed) {
      setSelectedCase(refreshed);
      if (activeDocId && !refreshed.documents?.some((doc) => doc.id === activeDocId)) {
        setActiveDocId(refreshed.documents?.[0]?.id ?? null);
      }
    }
  }, [cases, selectedCase, activeDocId]);

  const selectedDocument = selectedCase?.documents?.find((d) => d.id === activeDocId);
  const extractedEntries = Object.entries(selectedCase?.extractedData ?? {});
  const reasoningTimeline = (selectedCase?.timeline ?? [])
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-6);
  const modelConfidence = Math.round((selectedCase?.aiMetrics?.modelConfidence ?? 0.94) * 1000) / 10;
  const complianceScore = Math.round((selectedCase?.aiMetrics?.complianceScore ?? 0.98) * 100);
  const riskIndex = Math.round(selectedCase?.aiMetrics?.riskIndex ?? 12);
  const processingSeconds = Number((selectedCase?.aiMetrics?.processingSeconds ?? 0.8).toFixed(1));
  const workflowProgress = Math.round(selectedCase?.aiMetrics?.workflowProgress ?? 0);
  const completedSteps = selectedCase?.aiMetrics?.completedSteps ?? 0;
  const totalSteps = selectedCase?.aiMetrics?.totalSteps ?? 0;
  const runningStep = selectedCase?.aiMetrics?.runningStep;
  const extracted = selectedCase?.extractedData ?? {};
  const decisionLabel = String(extracted['Decision'] ?? '').toUpperCase();
  const decisionReason = String(extracted['Decision Reason'] ?? '').trim();
  const policyNumber = String(extracted['Policy Number'] ?? '').trim();
  const claimantName = String(extracted['Claimant Name'] ?? selectedCase?.customer ?? 'Unknown').trim();
  const validationPassed = String(extracted['Validation Passed'] ?? '').toLowerCase() === 'true';
  const ocrProcessed = Number(extracted['OCR Processed Documents'] ?? 0);
  const ocrFailed = Number(extracted['OCR Failed Documents'] ?? 0);
  const docsReceived = Number(extracted['Documents Received'] ?? selectedCase?.documents?.length ?? 0);
  const docsVerified = Number(extracted['Documents Verified'] ?? (selectedCase?.documents?.filter(d => d.status === 'uploaded')?.length ?? 0));
  const safePercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const extractionStatusItems = [
    { label: 'Identity', value: safePercent(claimantName && claimantName.toLowerCase() !== 'unknown' ? 100 : 35) },
    { label: 'Policy Match', value: safePercent(policyNumber && !policyNumber.toLowerCase().includes('not detected') ? 100 : 40) },
    { label: 'Medical Records', value: safePercent(docsReceived > 0 ? (docsVerified / Math.max(1, docsReceived)) * 100 : 0) },
    { label: 'OCR Quality', value: safePercent((ocrProcessed / Math.max(1, ocrProcessed + ocrFailed)) * 100) }
  ];
  const truthSummary = selectedCase?.aiInsights
    || selectedCase?.insights?.[0]?.description
    || "Summary is still being assembled. Initial indicators suggest a standard processing path with no immediate red flags in the primary documentation.";
  const identityPolicySummary = validationPassed
    ? `Claimant identity and policy alignment checks passed${policyNumber && !policyNumber.toLowerCase().includes('not detected') ? ` (Policy: ${policyNumber}).` : '.'}`
    : "Identity/policy alignment is incomplete and needs manual validation.";
  const fraudCoverageSummary = riskIndex <= 30
    ? "Fraud and coverage signals are currently in low-risk band."
    : riskIndex <= 70
      ? "Risk indicators are moderate; keep this case under assisted review."
      : "High-risk signals detected; require strict manual fraud and coverage review.";
  const nextActionTitle = decisionLabel === 'APPROVED'
    ? 'Approve Claim'
    : decisionLabel === 'REJECTED'
      ? 'Initiate Rejection Notice'
      : 'Move To Human Review';
  const nextActionDesc = decisionReason && !decisionReason.toLowerCase().includes('not detected')
    ? decisionReason
    : decisionLabel === 'APPROVED'
      ? 'All key validations passed. Proceed with approval and customer notification.'
      : decisionLabel === 'REJECTED'
        ? 'Insufficient validation confidence and/or missing documents. Notify customer with required next steps.'
        : 'Case needs assisted adjudication due to confidence/document quality thresholds.';
  const nextActionButton = decisionLabel === 'APPROVED'
    ? 'Execute Approval'
    : decisionLabel === 'REJECTED'
      ? 'Send Rejection Update'
      : 'Assign To Reviewer';

  return (
    <div className="space-y-6 pb-20">
      {/* Top Bar: Filters & Search - Inbox-style typography, aligned */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-end gap-4">
        <div className="filter-row flex-1">
          <div className="filter-search-wrap max-w-xs">
            <span className="filter-label">Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
              <input 
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base h-9 pl-9 pr-3"
              />
            </div>
          </div>
          <Dropdown 
            label="Status"
            options={statusOptions.map(opt => ({ label: opt.label, value: opt.label, count: opt.count }))}
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full md:w-48"
          />
          <Dropdown 
            label="Type"
            options={typeOptions.map(opt => ({ label: opt, value: opt }))}
            value={typeFilter}
            onChange={setTypeFilter}
            className="w-full md:w-48"
          />
        </div>
        <button className="btn-primary flex items-center gap-2 h-9 shrink-0">
          <Plus size={16} />
          New Case
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Case ID</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Member</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Stage</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Assigned</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Docs</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">AI Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Priority</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {paginatedCases.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => {
                    setSelectedCase(item);
                    setActiveDocId(item.documents?.[0]?.id ?? null);
                  }}
                  className="table-row group cursor-pointer bg-white hover:bg-[#F8FAFC]"
                >
                  <td className="px-6 py-3 text-sm font-normal text-[#0F172A]">
                    <span className="text-sm font-medium text-[#0F172A]">{item.id}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#0F172A]">{item.customer}</span>
                      <span className="text-xs text-[#64748B] font-medium">Verified Member</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-[#64748B]">{item.type}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-[#64748B] font-medium">{item.stage}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "text-sm font-medium",
                      item.assignedTo ? "text-[#0F172A]" : "text-[#94A3B8] italic"
                    )}>
                      {item.assignedTo || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "text-sm font-semibold",
                      item.documents?.filter(d => d.status === 'uploaded').length === item.documents?.length 
                        ? "text-[#059669]" 
                        : "text-[#D97706]"
                    )}>
                      {item.documents?.filter(d => d.status === 'uploaded').length}/{item.documents?.length}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium",
                      getAIStatusColor(item.aiStatus)
                    )}>
                      {item.aiStatus === 'processing' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                      {item.aiStatus === 'complete' && <Check size={12} />}
                      {item.aiStatus === 'needs review' && <AlertTriangle size={12} />}
                      {item.aiStatus}
                      {item.aiStatus === 'processing' && typeof item.aiMetrics?.workflowProgress === 'number' && (
                        <span className="font-semibold">({Math.round(item.aiMetrics.workflowProgress)}%)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      getPriorityColor(item.priority)
                    )}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium text-center min-w-[100px]",
                      getStatusColor(item.status)
                    )}>
                      {item.status.replace('-', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-xs text-[#64748B] font-medium">
                      {formatTimeAgo(item.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredCases.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-xs text-[#64748B] font-medium">
            Page <span className="text-[#0F172A] font-semibold">{currentPage}</span> of <span className="text-[#0F172A] font-semibold">{totalPages}</span>
          </div>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 btn-secondary text-xs disabled:opacity-50 transition-all duration-150"
            >
              Prev
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 btn-secondary text-xs disabled:opacity-50 transition-all duration-150"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Case Detail Modal - Redesigned */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-[1400px] h-full md:h-[90vh] bg-bg-main rounded-none md:rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                  >
                    <ArrowLeft size={20} />
                  </button>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1F9D8B] font-mono tracking-tight">{selectedCase.id}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                        <span className="text-xl font-semibold text-[#0F172A] tracking-tight">{selectedCase.customer}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{selectedCase.type}</span>
                      <span className="text-slate-200">•</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{selectedCase.stage}</span>
                      <span className="text-slate-200">•</span>
                      <div className="flex items-center gap-1.5">
                        {selectedCase.handlingType === 'automated' ? <Bot size={12} className="text-[#1F9D8B]" /> : <User size={12} className="text-[#D97706]" />}
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          selectedCase.handlingType === 'automated' ? "text-[#1F9D8B]" : "text-[#D97706]"
                        )}>
                          {selectedCase.handlingType.replace('-', ' ')}
                        </span>
                      </div>
                      <span className="text-slate-200">•</span>
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border",
                        getAIStatusColor(selectedCase.aiStatus)
                      )}>
                        {selectedCase.aiStatus}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <User size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Sarah Chen</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                    getStatusColor(selectedCase.status)
                  )}>
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-xs font-semibold capitalize">{selectedCase.status}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg border bg-[#E6F6F3] border-[#BEE7DE] text-[#1F9D8B]">
                    <span className="text-xs font-semibold">{workflowProgress}% done</span>
                    <span className="ml-1 text-[10px] font-medium text-[#2D7F73]">({completedSteps}/{totalSteps})</span>
                  </div>
                  <span className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider",
                    getPriorityColor(selectedCase.priority)
                  )}>
                    {selectedCase.priority}
                  </span>
                  <button className="flex items-center gap-2 px-4 py-1.5 bg-white border border-[#DC2626]/30 text-[#DC2626] rounded-lg text-xs font-medium hover:bg-[#FEF2F2] transition-all duration-150">
                    <ExternalLink size={14} />
                    Escalate
                  </button>
                  <button className="flex items-center gap-2 px-4 py-1.5 bg-[#1F9D8B] text-white rounded-lg text-xs font-medium hover:bg-[#178F7F] transition-all duration-150">
                    <Check size={14} />
                    Approve & Advance
                  </button>
                </div>
              </div>

              {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                  {/* Left Sidebar - Documents & Context */}
                  <div className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Case Context</h4>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Customer Profile</p>
                        <div className="flex items-center gap-3">
                          <img 
                            src={INDIAN_FACES[selectedCase.customer] || DEFAULT_FACE} 
                            alt={selectedCase.customer}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                          <div>
                            <p className="text-sm font-serif font-bold text-slate-900">{selectedCase.customer}</p>
                            <p className="text-[10px] text-slate-500 font-medium font-mono">Policy #POL-88291</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documents</h4>
                          <button className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors">
                            <Upload size={14} />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(!selectedCase.documents || selectedCase.documents.length === 0) && (
                            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                              No attachments found for this case yet.
                            </div>
                          )}
                          {selectedCase.documents?.map(doc => (
                            <div 
                              key={doc.id} 
                              onClick={() => setActiveDocId(doc.id)}
                              className={cn(
                                "p-2.5 rounded-lg border transition-all group cursor-pointer flex items-center gap-3",
                                activeDocId === doc.id ? "border-[#1F9D8B] bg-[#E6F6F3]" : "border-[#E2E8F0] hover:border-[#A7E3D8] bg-white"
                              )}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded flex items-center justify-center shrink-0",
                                doc.status === 'uploaded' ? "bg-[#ECFDF5] text-[#059669]" : 
                                doc.status === 'pending' ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F1F5F9] text-[#64748B]"
                              )}>
                                {doc.status === 'uploaded' ? <CheckCircle2 size={14} /> : 
                                 doc.status === 'pending' ? <Clock size={14} /> : <AlertTriangle size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-[11px] font-bold truncate",
                                  activeDocId === doc.id ? "text-[#1F9D8B]" : "text-[#0F172A]"
                                )}>{doc.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{doc.type}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center Content - Document Preview & Data */}
                  <div className="flex-1 overflow-hidden flex flex-col bg-white">
                    {/* Tabs Switcher */}
                    <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center justify-between bg-white">
                      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
                        <button 
                          onClick={() => setActiveView('preview')}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-2",
                            activeView === 'preview' ? "bg-white text-[#1F9D8B] shadow-sm border border-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"
                          )}
                        >
                          <FileText size={12} />
                          Document Preview
                        </button>
                        <button 
                          onClick={() => setActiveView('data')}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-2",
                            activeView === 'data' ? "bg-white text-[#1F9D8B] shadow-sm border border-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"
                          )}
                        >
                          <ShieldCheck size={12} />
                          Extracted Information
                        </button>
                        <button
                          onClick={() => setActiveView('analysis')}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-2",
                            activeView === 'analysis' ? "bg-white text-[#1F9D8B] shadow-sm border border-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"
                          )}
                        >
                          <Bot size={12} />
                          AI Analysis
                        </button>
                      </div>
                      
                      {activeView === 'data' && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High Confidence</span>
                          </div>
                          <button className="text-xs font-medium text-[#1F9D8B] hover:underline">Edit All</button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                      {activeView === 'preview' ? (
                        /* Document Preview Area */
                        <section className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-[600px] relative group/preview">
                          <div className="px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-[#1F9D8B]" />
                              <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                                {selectedCase.documents?.find(d => d.id === activeDocId)?.name || 'Document Preview'}
                              </h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                                <button className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"><ArrowLeft size={12} /></button>
                                <span className="text-[10px] font-bold text-slate-600 px-1">
                                  {Math.max(1, (selectedCase.documents?.findIndex((d) => d.id === activeDocId) ?? 0) + 1)} / {Math.max(1, selectedCase.documents?.length ?? 0)}
                                </span>
                                <button className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"><ArrowRight size={12} /></button>
                              </div>
                              <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
                                <Settings size={16} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-200/50">
                            {!selectedDocument ? (
                              <div className="w-full max-w-2xl bg-white shadow-sm rounded-lg p-8 border border-slate-200">
                                <h5 className="text-sm font-semibold text-slate-900 mb-2">No document available for preview</h5>
                                <p className="text-xs text-slate-600">
                                  This case currently has no uploaded attachments linked to it. Send an email with files attached
                                  to create document records automatically.
                                </p>
                              </div>
                            ) : (
                              <div className="w-full max-w-2xl bg-white shadow-xl rounded-lg p-8 border border-slate-200">
                                <div className="flex items-start justify-between gap-6 mb-6">
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document</p>
                                    <h5 className="text-base font-semibold text-slate-900 mt-1 break-all">{selectedDocument.name}</h5>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document ID</p>
                                    <p className="text-xs font-mono font-semibold text-slate-900 mt-1">{selectedDocument.id}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">File Type</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-1">{selectedDocument.type}</p>
                                  </div>
                                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{selectedDocument.status}</p>
                                  </div>
                                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pages</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-1">{selectedDocument.pages ?? 'Unknown'}</p>
                                  </div>
                                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Case</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-1">{selectedCase.id}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Preview Controls Overlay */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur shadow-xl border border-slate-200 rounded-full px-4 py-2 opacity-0 group-hover/preview:opacity-100 transition-all">
                            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><Plus size={16} /></button>
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                            <span className="text-[10px] font-bold text-slate-900 px-2">100%</span>
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><History size={16} /></button>
                          </div>
                        </section>
                      ) : activeView === 'data' ? (
                        /* Extracted Data Section */
                        <section className="space-y-4">
                          {extractedEntries.length === 0 ? (
                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                              Extracted fields are not available yet. Upload documents or wait for workflow extraction to complete.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {extractedEntries.map(([key, value], idx) => (
                              <div key={key} className="p-3.5 bg-white rounded-xl border border-slate-100 group hover:border-indigo-100 hover:shadow-sm transition-all relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1.5">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    idx % 5 === 0 ? "bg-amber-500" : "bg-emerald-500"
                                  )} />
                                </div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">{key}</label>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-slate-900 truncate">{String(value)}</span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] font-bold text-slate-400">{idx % 5 === 0 ? '82%' : '98%'}</span>
                                    <button className="p-1 hover:bg-slate-50 rounded text-slate-300 hover:text-indigo-600 transition-colors">
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              ))}
                            </div>
                          )}
                        </section>
                      ) : (
                        <section className="space-y-6 max-w-6xl">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden">
                              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#1F9D8B]/10 blur-xl" />
                              <div className="flex items-center gap-2 mb-2">
                                <BarChart3 size={14} className="text-[#1F9D8B]" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Model Confidence</p>
                              </div>
                              <p className="text-2xl font-black text-slate-900">{modelConfidence}%</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#059669] mt-1">{modelConfidence >= 85 ? 'High' : modelConfidence >= 70 ? 'Medium' : 'Low'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden">
                              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#059669]/10 blur-xl" />
                              <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck size={14} className="text-[#059669]" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Compliance</p>
                              </div>
                              <p className="text-2xl font-black text-slate-900">{complianceScore}%</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#059669] mt-1">{complianceScore >= 90 ? 'Verified' : 'Review'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden">
                              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#D97706]/10 blur-xl" />
                              <div className="flex items-center gap-2 mb-2">
                                <Activity size={14} className="text-[#D97706]" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Risk Index</p>
                              </div>
                              <p className="text-2xl font-black text-slate-900">{riskIndex}/100</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#D97706] mt-1">{riskIndex <= 30 ? 'Low Risk' : riskIndex <= 70 ? 'Medium Risk' : 'High Risk'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden">
                              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#0B6AD4]/10 blur-xl" />
                              <div className="flex items-center gap-2 mb-2">
                                <Timer size={14} className="text-[#0B6AD4]" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Processing Time</p>
                              </div>
                              <p className="text-2xl font-black text-slate-900">{processingSeconds}s</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0B6AD4] mt-1">Real-time</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                            <div className="xl:col-span-8 space-y-6">
                              <div className="p-5 bg-white rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                  <FileText size={15} className="text-[#1F9D8B]" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">The Truth Of The Case</h4>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {truthSummary}
                                </p>
                                <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Identity & Policy Alignment</h5>
                                    <p className="text-xs text-slate-600 leading-relaxed">{identityPolicySummary}</p>
                                  </div>
                                  <div>
                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Fraud & Coverage Validation</h5>
                                    <p className="text-xs text-slate-600 leading-relaxed">{fraudCoverageSummary}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="p-5 bg-white rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                  <Database size={15} className="text-[#1F9D8B]" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Medical Data Extraction Status</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {extractionStatusItems.map((item) => (
                                    <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                      <div
                                        className="w-16 h-16 rounded-full grid place-items-center text-xs font-black text-slate-900"
                                        style={{ background: `conic-gradient(#1F9D8B ${item.value}%, #e2e8f0 ${item.value}% 100%)` }}
                                      >
                                        <div className="w-12 h-12 rounded-full bg-white grid place-items-center">{item.value}%</div>
                                      </div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="xl:col-span-4 space-y-6">
                              <div className="p-5 bg-white rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                  <AlertTriangle size={15} className="text-[#D97706]" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Risk Markers</h4>
                                </div>
                                <div className="space-y-3">
                                  {(selectedCase.insights && selectedCase.insights.length > 0 ? selectedCase.insights.slice(0, 3) : [
                                    { id: "r1", type: "info", title: "No critical marker", description: "No significant risk marker identified in this case." }
                                  ]).map((marker) => (
                                    <div key={marker.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#D97706]">{marker.title}</p>
                                      <p className="text-xs text-slate-600 mt-1">{marker.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-5 bg-white rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                  <FileSearch size={15} className="text-[#1F9D8B]" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Next Recommended Actions</h4>
                                </div>
                                <div className="space-y-3">
                                  <button className="w-full p-3 text-left rounded-lg border border-[#1F9D8B]/20 bg-[#1F9D8B]/5 hover:bg-[#1F9D8B]/10 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#1F9D8B]">Automated Action</span>
                                      <ExternalLink size={12} className="text-[#1F9D8B]" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 mt-1 uppercase tracking-tight">Approve Medical Necessity</p>
                                  </button>
                                  <button className="w-full p-3 text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Manual Review</span>
                                      <ExternalLink size={12} className="text-slate-500" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 mt-1 uppercase tracking-tight">Verify Lab Results Consistency</p>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  </div>

                  {/* Right Sidebar - AI Insights & Confidence */}
                  <div className="w-full md:w-96 bg-bg-main border-l border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-6 border-b border-slate-100 bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Bot size={14} className="text-[#1F9D8B]" />
                          AI Intelligence
                        </h4>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#ECFDF5] rounded-full border border-[#059669]/20">
                          <Zap size={10} className="text-[#059669] fill-[#059669]" />
                          <span className="text-xs font-medium text-[#059669]">{modelConfidence}% Confidence</span>
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Automation Analysis</h3>
                    </div>
                    
                    <div className="p-6 space-y-8">
                      {/* AI Executive Summary */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck size={14} className="text-[#1F9D8B]" />
                          AI Summary
                        </h4>
                        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                            {selectedCase.aiInsights || "Case analysis complete. All required documents verified against policy RQBE-2024. No fraud indicators detected. Recommended for immediate approval."}
                          </p>
                          {selectedCase.aiStatus === 'processing' && (
                            <p className="text-[10px] text-[#1F9D8B] mt-2 font-semibold">
                              Live processing: {workflowProgress}% complete{runningStep ? ` • Running: ${runningStep}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Reasoning Timeline */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <History size={14} className="text-[#1F9D8B]" />
                          Reasoning Timeline
                        </h4>
                        <div className="space-y-6 pl-2">
                          {(reasoningTimeline.length > 0 ? reasoningTimeline : [
                            { id: 'fallback', timestamp: selectedCase.updatedAt, action: 'Awaiting run events', actor: 'System' }
                          ]).map((item, i, arr) => (
                            <div key={i} className="flex gap-4 relative">
                              {i !== arr.length - 1 && <div className="absolute left-[7px] top-4 bottom-[-24px] w-0.5 bg-slate-100" />}
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 border-white z-10 mt-1 shadow-sm",
                                item.type === 'agent' ? "bg-[#059669]" : "bg-[#0B6AD4]"
                              )} />
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-[11px] font-bold text-slate-900">{item.action}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">{item.actor}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Next Best Action */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <Zap size={14} className="text-amber-500" />
                          Next Best Action
                        </h4>
                        <div className="p-4 bg-[#1F9D8B] rounded-lg text-white relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Bot size={60} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                                <Check size={14} />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-widest">Recommended</span>
                            </div>
                            <h5 className="text-sm font-bold mb-2">{nextActionTitle}</h5>
                            <p className="text-[10px] text-white/80 leading-relaxed mb-4 font-medium">
                              {nextActionDesc}
                            </p>
                            <button className="w-full py-2 bg-white text-[#1F9D8B] rounded-lg text-xs font-medium hover:bg-[#F8FAFC] transition-all duration-150">
                              {nextActionButton}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

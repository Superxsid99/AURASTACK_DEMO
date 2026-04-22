import React, { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { 
  Clock, 
  Database, 
  FileText, 
  ChevronRight,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Play,
  Eye,
  Filter,
  Plus,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Activity,
  User,
  Calendar,
  FileCheck,
  History,
  BarChart3,
  DollarSign,
  User2,
  Building2,
  CalendarDays,
  Target,
  Lock,
  FileSearch,
  Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, CaseStatus } from '../types/case';
import { TaskInstance, ExecutionLog, Department } from '../types/execution';
import { WorkflowDefinition } from '../types/workflow';
import { AgentDefinition } from '../types/agent';
import { ExecutionEngine } from '../services/executionEngine';
import { PermissionContext } from '../App';
import { Permission } from '../types/auth';

interface CasesViewProps {
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  tasks: TaskInstance[];
  logs: ExecutionLog[];
  workflows: WorkflowDefinition[];
  agents: AgentDefinition[];
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export const CasesView: React.FC<CasesViewProps> = ({ cases, setCases, tasks, logs, workflows, agents, selectedCaseId: propSelectedCaseId, setSelectedCaseId, setActiveTab }) => {
  const { id: urlId } = useParams();
  const navigate = useNavigate();
  const selectedCaseId = urlId || propSelectedCaseId;
  const [filter, setFilter] = useState<CaseStatus | 'ALL'>('ALL');
  const [deptFilter, setDeptFilter] = useState<Department | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const selectedCase = cases.find(c => c.id === selectedCaseId) || null;

  const filteredCases = cases.filter(c => {
    const matchesFilter = filter === 'ALL' || c.status === filter;
    const matchesDept = deptFilter === 'ALL' || c.department === deptFilter;
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesDept && matchesSearch;
  });

  const handleUpdateCase = (updatedCase: Case) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
  };

  if (selectedCase) {
    return (
      <CaseDetailView 
        caseData={selectedCase} 
        onBack={() => setSelectedCaseId(null)} 
        onUpdate={handleUpdateCase}
        tasks={tasks.filter(t => t.case_id === selectedCase.id)}
        allTasks={tasks}
        cases={cases}
        logs={logs.filter(l => l.case_id === selectedCase.id)}
        workflows={workflows}
        agents={agents}
      />
    );
  }

  const departments: (Department | 'ALL')[] = [
    'ALL',
    'CLAIMS',
    'POLICY_ISSUANCE',
    'KYC_ONBOARDING',
    'UNDERWRITING',
    'POLICY_SERVICING',
    'RENEWALS',
    'COMPLIANCE',
    'SALES'
  ];

  return (
    <div className="page-shell space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <p className="page-kicker">Cases</p>
          <h1 className="page-title">All cases</h1>
          <p className="page-description">Claims, underwriting, and compliance cases across your organization.</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 justify-end">
            <button 
              type="button"
              onClick={() => setActiveTab('datalab')}
              className="btn btn-surface"
            >
              <Database size={12} className="shrink-0" />
              Import Data
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input 
                type="text" 
                placeholder="Search cases..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-surface-container-low border border-outline-variant/10 pl-9 pr-4 py-2 rounded-sm text-xs focus:outline-none focus:border-primary/40 w-64 transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {['ALL', 'CRITICAL', 'ELEVATED', 'STABLE'].map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`toggle-chip !min-h-7 px-2.5 text-[10px] uppercase tracking-widest ${filter === f ? 'toggle-chip--active' : ''}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1 self-end">
            {departments.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDeptFilter(d as any)}
                className={`toggle-chip !min-h-7 px-2.5 !text-[9px] ${deptFilter === d ? 'toggle-chip--active' : ''}`}
              >
                {d.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {filteredCases.map((c) => (
          <CaseRow key={c.id} caseData={c} onClick={() => setSelectedCaseId(c.id)} />
        ))}
      </div>
    </div>
  );
};

const CaseRow = ({ caseData, onClick }: { caseData: Case; onClick: () => void }) => {
  const statusDot: Record<CaseStatus, string> = {
    CRITICAL: 'bg-error',
    ELEVATED: 'bg-amber-500',
    STABLE: 'bg-emerald-500',
    IN_REVIEW: 'bg-blue-500',
    RESOLVED: 'bg-on-surface-variant/50'
  };

  return (
    <div 
      onClick={onClick}
      className="group card-elevated--interactive p-4 flex items-center gap-6"
    >
      <div className="w-24 shrink-0">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">ID</div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[caseData.status]}`} title={caseData.status} aria-hidden />
          <div className="text-xs font-sans font-bold text-primary">{caseData.id}</div>
        </div>
      </div>

      <div className="w-32">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Department</div>
        <div className="text-[10px] font-bold text-on-surface uppercase tracking-tighter">{caseData.department.replace('_', ' ')}</div>
      </div>

      <div className="flex-1">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">{caseData.type}</div>
        <div className="text-sm font-bold text-on-surface">{caseData.title}</div>
      </div>

      <div className="w-48">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Assigned To</div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[8px] font-bold">
            {caseData.assigned_to?.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-xs text-on-surface">{caseData.assigned_to}</span>
        </div>
      </div>

      <div className="w-32">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Risk Score</div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-surface-container rounded-full overflow-hidden">
            <div 
              className={`h-full ${caseData.risk_score && caseData.risk_score > 7 ? 'bg-error' : 'bg-primary'}`} 
              style={{ width: `${(caseData.risk_score || 0) * 10}%` }}
            ></div>
          </div>
          <span className="text-xs font-sans font-bold">{caseData.risk_score}</span>
        </div>
      </div>

      <div className="w-32 text-right">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Last Updated</div>
        <div className="text-xs text-on-surface-variant">{new Date(caseData.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      <ChevronRight size={16} className="text-on-surface-variant group-hover:translate-x-1 transition-all" />
    </div>
  );
};

import { DocumentViewer } from './DocumentViewer';
import { AIAnalysisView } from './AIAnalysisView';
import { ComplianceAuditTrail } from './ComplianceAuditTrail';

const getRequiredDocuments = (type: Case['type']): string[] => {
  switch (type) {
    case 'CLAIM': return ['Medical Records', 'Proof of Loss', 'Identity Proof', 'Policy Document'];
    case 'UNDERWRITING': return ['Medical History', 'Financial Statements', 'Identity Proof'];
    case 'KYC': return ['Identity Proof', 'Address Proof', 'Photograph'];
    case 'COMPLIANCE': return ['Audit Report', 'Risk Assessment', 'Regulatory Filing'];
    case 'ADMISSION': return ['Patient ID', 'Insurance Card', 'Referral Letter'];
    case 'DIAGNOSTIC': return ['Lab Report', "Doctor's Note"];
    case 'DISCHARGE': return ['Discharge Summary', 'Billing Statement'];
    case 'SALES': return ['Demographics', 'Salary Proof', 'Identity Proof'];
    default: return [];
  }
};

const CaseDetailView = ({ 
  caseData, 
  onBack, 
  onUpdate,
  tasks,
  allTasks,
  cases,
  logs,
  workflows,
  agents
}: { 
  caseData: Case; 
  onBack: () => void; 
  onUpdate: (c: Case) => void;
  tasks: TaskInstance[];
  allTasks: TaskInstance[];
  cases: Case[];
  logs: ExecutionLog[];
  workflows: WorkflowDefinition[];
  agents: AgentDefinition[];
}) => {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const requiredDocs = getRequiredDocuments(caseData.type);
  const uploadedDocs = caseData.documents?.map(d => d.type) || [];
  const missingDocs = requiredDocs.filter(d => !uploadedDocs.includes(d));

  const statusColors: Record<CaseStatus, string> = {
    CRITICAL: 'bg-error text-on-error',
    ELEVATED: 'bg-amber-500 text-on-primary',
    STABLE: 'bg-emerald-500 text-on-primary',
    IN_REVIEW: 'bg-blue-500 text-on-primary',
    RESOLVED: 'bg-outline-variant text-on-surface'
  };

  const handleStatusChange = (newStatus: CaseStatus) => {
    setIsUpdating(true);
    // Simulate API delay
    setTimeout(() => {
      const updatedCase: Case = {
        ...caseData,
        status: newStatus,
        last_updated: new Date().toISOString(),
        timeline: [
          {
            title: 'Status Updated',
            description: `Case status changed to ${newStatus}`,
            timestamp: new Date().toISOString(),
            type: 'human'
          },
          ...caseData.timeline
        ]
      };
      onUpdate(updatedCase);
      setIsUpdating(false);
    }, 600);
  };

  const handleTakeAction = async () => {
    if (!caseData.workflow_id) return;
    
    const workflow = workflows.find(w => w.workflow_id === caseData.workflow_id);
    if (!workflow) return;

    const startNode = workflow.nodes.find(n => n.type === 'input');
    if (!startNode) return;

    setIsUpdating(true);
    toast.promise(
      ExecutionEngine.getInstance().executeNode(caseData, workflow, startNode, agents, workflows, tasks, cases),
      {
        loading: 'Executing workflow...',
        success: 'Workflow execution started',
        error: 'Workflow execution failed'
      }
    );
    setIsUpdating(false);
  };

  const handleGenerateReport = () => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 2000)),
      {
        loading: 'Generating comprehensive case report...',
        success: 'Report generated successfully. Check your downloads.',
        error: 'Failed to generate report'
      }
    );
  };

  const handleRequestDocs = () => {
    setActiveTab('Documents');
    toast.info('Please select the missing documents to request from the patient.');
  };

  const handleAssignMember = () => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1000)),
      {
        loading: 'Finding available team members...',
        success: 'Case assigned to Sarah Jenkins (Senior Adjuster)',
        error: 'Failed to assign member'
      }
    );
    onUpdate({
      ...caseData,
      assigned_to: 'Sarah Jenkins',
      timeline: [
        {
          title: 'Member Assigned',
          description: 'Case reassigned to Sarah Jenkins',
          timestamp: new Date().toISOString(),
          type: 'human'
        },
        ...caseData.timeline
      ]
    });
  };

  const handleContact = () => {
    toast.info(`Initiating contact with ${caseData.claimant?.name}...`, {
      description: 'Opening secure communication channel.'
    });
  };

  const handleFullProfile = () => {
    toast.info(`Loading full profile for ${caseData.claimant?.name}...`, {
      description: 'Redirecting to claimant directory.'
    });
  };

  const workflow = workflows.find(w => w.workflow_id === caseData.workflow_id);

  const { hasPermission } = useContext(PermissionContext);

  const renderTabButton = (tab: string, permission?: Permission) => {
    if (permission && !hasPermission(permission)) return null;
    return (
      <button 
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`pb-3 text-xs uppercase tracking-widest font-bold transition-colors ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
      >
        {tab}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Entity Header */}
      <div className="px-8 py-5 bg-surface-container-low border-b border-outline-variant/10">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <button type="button" onClick={onBack} className="btn-icon mt-0.5 rounded-full hover:bg-surface-container-high">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="page-title">Case {caseData.id}</h1>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-tighter ${caseData.priority === 'HIGH' ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                  {caseData.priority} PRIORITY
                </span>
                <div className="relative group/status">
                  <button className={`px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-tighter flex items-center gap-1 ${statusColors[caseData.status]}`}>
                    {caseData.status}
                    <ChevronRight size={10} className="rotate-90" />
                  </button>
                  <div className="absolute top-full left-0 mt-1 bg-surface-container-high border border-outline-variant/10 rounded-sm shadow-xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-50 min-w-[120px]">
                    {(['CRITICAL', 'ELEVATED', 'STABLE', 'IN_REVIEW', 'RESOLVED'] as CaseStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors border-b border-outline-variant/5 last:border-0"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-tighter bg-surface-container-high border border-outline-variant/20 text-on-surface-variant`}>
                  {caseData.execution_status || 'IDLE'}
                </div>
                {isUpdating && <RefreshCw size={12} className="animate-spin text-primary" />}
              </div>
              <p className="text-on-surface-variant font-sans text-sm max-w-2xl">{caseData.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasPermission('EDIT_CASES') && (
              <button 
                type="button"
                onClick={handleTakeAction}
                disabled={isUpdating}
                className="btn btn-primary"
              >
                <Play size={14} className="shrink-0" />
                Run workflow
              </button>
            )}
            <button 
              type="button"
              onClick={handleAssignMember}
              className="btn btn-outline"
            >
              Assign member
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 sm:gap-8 ml-0 sm:ml-14">
          {renderTabButton('Overview')}
          {renderTabButton('Documents')}
          {renderTabButton('Analysis', 'VIEW_MEDICAL_RECORDS')}
          {renderTabButton('Tasks')}
          {renderTabButton('Audit & Compliance', 'VIEW_AUDIT_TRAIL')}
        </div>
      </div>

      {/* Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-surface">
        <AnimatePresence mode="wait">
          {activeTab === 'Overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-7xl mx-auto"
            >
              <div className="grid grid-cols-12 gap-6">
                {/* Main Content Column */}
                <div className="col-span-8 space-y-6">
                  {/* Summary Card */}
                  <div className="card-elevated p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">Executive Summary</h3>
                        <h2 className="text-2xl font-black tracking-tighter text-on-surface uppercase leading-none">
                          Case Analysis Report
                        </h2>
                      </div>
                      <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-sm uppercase tracking-widest border border-primary/20">
                        {caseData.status}
                      </div>
                    </div>
                    <p className="text-sm font-sans leading-relaxed text-on-surface-variant mb-8 max-w-2xl">
                      {caseData.summary}
                    </p>
                    <div className="grid grid-cols-3 gap-8 pt-6 border-t border-outline-variant/10">
                      <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Integrity Score</div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-black tracking-tighter text-primary">{(10 - (caseData.risk_score || 0)) * 10}%</span>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase mb-1 opacity-60">Confidence</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Risk Level</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${caseData.risk_score && caseData.risk_score > 7 ? 'bg-error animate-pulse' : 'bg-primary'}`}></div>
                          <span className="text-lg font-black tracking-tighter uppercase">
                            {caseData.risk_score && caseData.risk_score > 7 ? 'Critical' : 'Standard'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Processing Time</div>
                        <div className="text-lg font-black tracking-tighter uppercase">
                          {caseData.audit_trail && caseData.audit_trail.length > 0 
                            ? `${(caseData.audit_trail.reduce((acc, e) => acc + (e.duration_ms || 0), 0) / 1000).toFixed(1)}s` 
                            : '14.2 Hours'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Productivity Analytics */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-primary" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Productivity Analytics</h3>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Efficiency: +12% vs Baseline</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      {caseData.audit_trail?.slice(-4).map((entry, i) => (
                        <div key={i} className="p-3 bg-surface-container rounded-sm border border-outline-variant/5">
                          <div className="text-[9px] font-bold text-on-surface-variant uppercase mb-1 truncate">{entry.node_id}</div>
                          <div className="text-sm font-black text-primary">{(entry.duration_ms || 0 / 1000).toFixed(2)}s</div>
                          <div className="text-[8px] text-on-surface-variant uppercase mt-1">Execution Time</div>
                        </div>
                      ))}
                      {(!caseData.audit_trail || caseData.audit_trail.length === 0) && (
                        <div className="col-span-4 text-center py-4 text-[10px] text-on-surface-variant opacity-50 uppercase font-bold tracking-widest">
                          No execution data available for analytics
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Business Context Grid */}
                  {caseData.claimant && caseData.financials && caseData.policy && caseData.dates && caseData.sla && (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Claimant Info */}
                      <div className="card-elevated p-6 group">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <User2 size={16} className="text-primary" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Claimant Information</h3>
                          </div>
                          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
                            <ShieldCheck size={10} /> Verified
                          </span>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Name</span>
                            <span className="text-xs font-black text-on-surface uppercase">{caseData.claimant.name}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">DOB / Gender</span>
                            <span className="text-xs font-black text-on-surface uppercase">{caseData.claimant.dob} • {caseData.claimant.gender}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Claimant ID</span>
                            <span className="text-xs font-sans text-primary">{caseData.claimant.id}</span>
                          </div>
                          {caseData.claimant.email && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase">Email</span>
                              <span className="text-xs font-bold text-on-surface lowercase">{caseData.claimant.email}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Phone</span>
                            <span className="text-xs font-bold text-on-surface">+1 (555) 012-3456</span>
                          </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-outline-variant/10 flex gap-2 transition-opacity">
                          <button 
                            type="button"
                            onClick={handleContact}
                            className="btn btn-outline flex-1 !text-[9px]"
                          >
                            Contact
                          </button>
                          <button 
                            type="button"
                            onClick={handleFullProfile}
                            className="btn btn-outline flex-1 !text-[9px]"
                          >
                            Full Profile
                          </button>
                        </div>
                      </div>

                    {/* Financial Summary */}
                    <div className="card-elevated p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <DollarSign size={16} className="text-emerald-500" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Financial Summary</h3>
                      </div>
                      {hasPermission('VIEW_FINANCIALS') ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Total Billed</span>
                            <span className="text-sm font-black text-on-surface">{new Intl.NumberFormat('en-US', { style: 'currency', currency: caseData.financials.currency }).format(caseData.financials.total_billed)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Total Paid</span>
                            <span className="text-sm font-black text-emerald-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: caseData.financials.currency }).format(caseData.financials.total_paid)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Reserve</span>
                            <span className="text-sm font-black text-amber-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: caseData.financials.currency }).format(caseData.financials.reserve_amount)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 opacity-40">
                          <Lock size={24} className="mb-2" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Financial Data Restricted</span>
                        </div>
                      )}
                    </div>

                      {/* Policy Details */}
                      <div className="card-elevated p-6">
                        <div className="flex items-center gap-2 mb-6">
                          <ShieldCheck size={16} className="text-primary" />
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Policy Details</h3>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Policy #</span>
                            <span className="text-xs font-sans text-on-surface">{caseData.policy.policy_number}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Type</span>
                            <span className="text-xs font-black text-on-surface uppercase">{caseData.policy.policy_type}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Carrier</span>
                            <span className="text-xs font-black text-primary uppercase">{caseData.policy.carrier}</span>
                          </div>
                        </div>
                      </div>

                      {/* Key Dates */}
                      <div className="card-elevated p-6">
                        <div className="flex items-center gap-2 mb-6">
                          <CalendarDays size={16} className="text-secondary" />
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Key Dates</h3>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Incident</span>
                            <span className="text-xs font-black text-on-surface uppercase">{new Date(caseData.dates.incident_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Service</span>
                            <span className="text-xs font-black text-on-surface uppercase">{new Date(caseData.dates.service_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Due (SLA)</span>
                            <span className={`text-xs font-black uppercase ${caseData.sla.status === 'BREACHED' ? 'text-error' : caseData.sla.status === 'AT_RISK' ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {new Date(caseData.sla.due_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Markers & Extraction */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="card-elevated p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <Target size={16} className="text-secondary" />
                        <h3 className="section-label">Risk markers</h3>
                      </div>
                      {hasPermission('VIEW_MEDICAL_RECORDS') ? (
                        <div className="space-y-4">
                          {[
                            { label: 'Pattern Anomaly', status: 'Detected', color: 'text-error' },
                            { label: 'Policy Alignment', status: 'Verified', color: 'text-primary' },
                            { label: 'Clinical Consistency', status: 'High', color: 'text-primary' },
                            { label: 'Provider History', status: 'Clean', color: 'text-primary' }
                          ].map((marker, i) => (
                            <div key={i} className="flex justify-between items-center pb-3 border-b border-outline-variant/5 last:border-0 last:pb-0">
                              <span className="text-xs font-bold text-on-surface uppercase tracking-tighter">{marker.label}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${marker.color}`}>{marker.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 opacity-40">
                          <Lock size={24} className="mb-2" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Clinical Data Restricted</span>
                        </div>
                      )}
                    </div>

                    <div className="card-elevated p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <FileCheck size={16} className="text-primary" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Document Extraction</h3>
                      </div>
                      {hasPermission('VIEW_MEDICAL_RECORDS') ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-tighter">Medical Records</span>
                            <div className="w-24 h-1 bg-surface-container rounded-full overflow-hidden">
                              <div className="w-full h-full bg-primary"></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-tighter">Policy Docs</span>
                            <div className="w-24 h-1 bg-surface-container rounded-full overflow-hidden">
                              <div className="w-3/4 h-full bg-primary"></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-tighter">Billing Logs</span>
                            <div className="w-24 h-1 bg-surface-container rounded-full overflow-hidden">
                              <div className="w-1/2 h-full bg-primary animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 opacity-40">
                          <Lock size={24} className="mb-2" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Extraction Data Restricted</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2">
                        <History size={16} className="text-on-surface-variant" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Execution Timeline</h3>
                      </div>
                      <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View Full Audit</button>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      {caseData.timeline.map((item, i) => (
                        <TimelineItem 
                          key={i}
                          title={item.title} 
                          desc={item.description} 
                          color={item.type === 'ai' ? 'bg-secondary' : item.type === 'human' ? 'bg-primary' : 'bg-outline-variant'} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar Column */}
                <div className="col-span-4 space-y-6">
                  {/* Case Metadata */}
                  <div className="card-elevated p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-6">Case Metadata</h3>
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-surface-container flex items-center justify-center rounded-sm text-on-surface-variant">
                          <Workflow size={16} />
                        </div>
                        <div 
                          className="cursor-pointer group/wf"
                          onClick={() => caseData.workflow_id && navigate(`/workflows/${caseData.workflow_id}`)}
                        >
                          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Active Workflow</div>
                          <div className="text-xs font-bold text-primary uppercase tracking-tighter group-hover/wf:underline flex items-center gap-1">
                            {caseData.workflow_id || 'N/A'}
                            <ArrowUpRight size={10} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-surface-container flex items-center justify-center rounded-sm text-on-surface-variant">
                          <User size={16} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Assigned Adjuster</div>
                          <div className="text-xs font-bold text-on-surface uppercase tracking-tighter">{caseData.assigned_to}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-surface-container flex items-center justify-center rounded-sm text-on-surface-variant">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Detection Date</div>
                          <div className="text-xs font-bold text-on-surface uppercase tracking-tighter">
                            {new Date(caseData.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-surface-container flex items-center justify-center rounded-sm text-on-surface-variant">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Compliance Status</div>
                          <div className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Fully Compliant</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clinical highlight */}
                  <div className="bg-primary-container/20 border border-primary/20 backdrop-blur-xl p-6 rounded-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.07]">
                      <Activity size={80} />
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={16} className="text-primary" />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">Clinical marker</h3>
                    </div>
                    <p className="text-xs text-on-primary-container/80 font-sans leading-relaxed mb-6">
                      Analysis indicates elevated readmission risk based on historical patient data and current clinical markers.
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-primary/10">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Confidence</span>
                      <span className="text-sm font-black text-primary">94.2%</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="card-elevated p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <button 
                        type="button"
                        onClick={handleGenerateReport}
                        className="btn btn-primary btn-block"
                      >
                        Generate Report
                      </button>
                      <button 
                        type="button"
                        onClick={handleRequestDocs}
                        className="btn btn-outline btn-block"
                      >
                        Request More Docs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'Documents' && (
            <motion.div 
              key="documents"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-7xl mx-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Case Documents</h3>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
                    {caseData.documents?.length || 0} Uploaded • {missingDocs.length} Missing
                  </p>
                </div>
                <button type="button" className="btn btn-surface">
                  <ArrowUpRight size={12} className="shrink-0" />
                  Upload Document
                </button>
              </div>

              {/* Missing Documents Insight */}
              {missingDocs.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <div>
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Missing Required Documentation</div>
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-widest opacity-80">
                        The following documents are required for {caseData.type} cases: {missingDocs.join(', ')}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      toast.promise(
                        new Promise(resolve => setTimeout(resolve, 1500)),
                        {
                          loading: 'Sending request to patient...',
                          success: `Request for ${missingDocs.length} documents sent to patient.`,
                          error: 'Failed to send request'
                        }
                      );
                    }}
                    className="btn btn-warning shrink-0"
                  >
                    Request from Patient
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {caseData.documents?.map((doc) => (
                  <div key={doc.id} className="card-elevated--interactive p-4 flex items-center justify-between group transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-container flex items-center justify-center rounded-sm text-primary">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-on-surface">{doc.name}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {doc.type} • {doc.size} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {doc.extraction_data && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-sm uppercase">
                            <FileSearch size={10} />
                            Parsed
                          </div>
                        )}
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm tracking-tighter ${doc.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-500' : doc.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-error/10 text-error'}`}>
                          {doc.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 transition-opacity">
                        <button 
                          type="button"
                          onClick={() => setSelectedDoc(doc)}
                          className="btn btn-muted"
                        >
                          <Eye size={14} className="shrink-0" />
                          View & Verify
                        </button>
                        <button type="button" className="btn-icon border border-transparent hover:border-outline-variant/20">
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!caseData.documents || caseData.documents.length === 0) && (
                  <div className="py-12 text-center text-xs text-on-surface-variant opacity-50 uppercase font-bold tracking-widest border-2 border-dashed border-outline-variant/10 rounded-sm">
                    No documents attached to this case
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'AI Analysis' && (
            <AIAnalysisView caseData={caseData} agents={agents} />
          )}

          {activeTab === 'Tasks' && (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-7xl mx-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Workflow Tasks</h3>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
                    {tasks.length} Total • {tasks.filter(t => t.status === 'IN_PROGRESS').length} Pending
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {tasks.map((task) => (
                  <div key={task.id} className="card-elevated--interactive p-6 flex items-center justify-between group transition-all">
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 flex items-center justify-center rounded-sm ${task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : task.status === 'FAILED' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                        {task.status === 'COMPLETED' ? <CheckCircle2 size={24} /> : task.status === 'FAILED' ? <AlertTriangle size={24} /> : <Clock size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-bold text-on-surface">{task.node_id.toUpperCase()}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm tracking-tighter ${task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : task.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500' : 'bg-error/10 text-error'}`}>
                            {task.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest flex items-center gap-4">
                          <span>ID: {task.id}</span>
                          <span>Started: {new Date(task.started_at).toLocaleString()}</span>
                          {task.completed_at && <span>Completed: {new Date(task.completed_at).toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                    
                    {task.status === 'IN_PROGRESS' && (
                      <button 
                        type="button"
                        onClick={async () => {
                          setIsUpdating(true);
                          await ExecutionEngine.getInstance().completeHumanTask(task.id, { approved: true }, cases, workflows, agents, allTasks);
                          setIsUpdating(false);
                        }}
                        className="btn btn-primary shrink-0"
                      >
                        <CheckCircle2 size={14} className="shrink-0" />
                        Complete Task
                      </button>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="py-12 text-center text-xs text-on-surface-variant opacity-50 uppercase font-bold tracking-widest border-2 border-dashed border-outline-variant/10 rounded-sm">
                    No tasks recorded for this case
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'Audit & Compliance' && (
            <ComplianceAuditTrail caseData={caseData} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedDoc && (
          <DocumentViewer 
            document={selectedDoc} 
            onClose={() => setSelectedDoc(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TimelineItem = ({ title, desc, color }: any) => (
  <div className="p-3 bg-surface-container rounded-sm border border-outline-variant/10">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-2 h-2 rounded-full ${color}`}></div>
      <div className="text-[10px] font-bold text-on-surface uppercase tracking-tighter">{title}</div>
    </div>
    <div className="text-[10px] text-on-surface-variant leading-tight">{desc}</div>
  </div>
);

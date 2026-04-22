import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Activity, 
  Terminal, 
  Plus, 
  MoreVertical,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { INITIAL_WORKFLOWS } from '../constants/workflows';
import { WorkflowDefinition } from '../types/workflow';
import { WorkflowBuilder } from './WorkflowBuilder';

import { AgentDefinition } from '../types/agent';
import { Case } from '../types/case';

interface WorkflowsViewProps {
  workflows: WorkflowDefinition[];
  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowDefinition[]>>;
  selectedWorkflowId: string | null;
  setSelectedWorkflowId: (id: string | null) => void;
  agents: AgentDefinition[];
  cases: Case[];
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({ workflows, setWorkflows, selectedWorkflowId: propSelectedWorkflowId, setSelectedWorkflowId, agents, cases }) => {
  const { id: urlId } = useParams();
  const selectedWorkflowId = urlId || propSelectedWorkflowId;
  const [isBuilding, setIsBuilding] = useState(!!selectedWorkflowId);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'HISTORICAL'>('ACTIVE');
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | undefined>(
    selectedWorkflowId ? workflows.find(w => w.workflow_id === selectedWorkflowId) : undefined
  );

  React.useEffect(() => {
    if (selectedWorkflowId) {
      const wf = workflows.find(w => w.workflow_id === selectedWorkflowId);
      if (wf) {
        setEditingWorkflow(wf);
        setIsBuilding(true);
      }
    }
  }, [selectedWorkflowId, workflows]);

  const handleSaveWorkflow = (workflow: WorkflowDefinition) => {
    setWorkflows(prev => {
      const exists = prev.find(w => w.workflow_id === workflow.workflow_id);
      if (exists) {
        return prev.map(w => w.workflow_id === workflow.workflow_id ? workflow : w);
      }
      return [workflow, ...prev];
    });
    setIsBuilding(false);
    setEditingWorkflow(undefined);
    setSelectedWorkflowId(null);
  };

  const handleEditWorkflow = (workflow: WorkflowDefinition) => {
    setEditingWorkflow(workflow);
    setIsBuilding(true);
    setSelectedWorkflowId(workflow.workflow_id);
  };

  const handleDeleteWorkflow = (id: string) => {
    if (window.confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      setWorkflows(prev => prev.filter(w => w.workflow_id !== id));
      if (isBuilding && editingWorkflow?.workflow_id === id) {
        setIsBuilding(false);
        setEditingWorkflow(undefined);
        setSelectedWorkflowId(null);
      }
    }
  };

  const filteredWorkflows = workflows.filter(wf => {
    if (viewMode === 'ACTIVE') {
      return wf.status === 'Active' || wf.status === 'Running';
    }
    return wf.status === 'Idle' || wf.status === 'Draft';
  });

  if (isBuilding) {
    return (
      <WorkflowBuilder 
        initialWorkflow={editingWorkflow}
        onSave={handleSaveWorkflow} 
        onDelete={handleDeleteWorkflow}
        onBack={() => {
          setIsBuilding(false);
          setEditingWorkflow(undefined);
          setSelectedWorkflowId(null);
        }} 
        agents={agents}
        cases={cases}
        allWorkflows={workflows}
      />
    );
  }

  return (
    <div className="page-shell space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="page-kicker">Workflows</p>
          <h2 className="page-title">Workflows</h2>
          <p className="page-description max-w-lg">Design and run case automation flows across teams and systems.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-wrap gap-1">
            <button 
              type="button"
              onClick={() => setViewMode('ACTIVE')}
              className={`toggle-chip px-4 py-2 text-[10px] ${viewMode === 'ACTIVE' ? 'toggle-chip--active' : ''}`}
            >
              Active
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('HISTORICAL')}
              className={`toggle-chip px-4 py-2 text-[10px] ${viewMode === 'HISTORICAL' ? 'toggle-chip--active' : ''}`}
            >
              Historical
            </button>
          </div>
          <button 
            type="button"
            onClick={() => {
              setEditingWorkflow(undefined);
              setIsBuilding(true);
            }}
            className="btn btn-primary shadow-[0_0_20px_rgba(186,195,255,0.15)] hover:shadow-[0_0_25px_rgba(186,195,255,0.25)] transition-shadow group"
          >
            New workflow
            <ArrowRight size={14} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredWorkflows.map(wf => (
          <WorkflowCard 
            key={wf.workflow_id}
            workflow={wf}
            onEdit={() => handleEditWorkflow(wf)}
            onDelete={() => handleDeleteWorkflow(wf.workflow_id)}
          />
        ))}
        {viewMode === 'ACTIVE' && (
          <button 
            onClick={() => {
              setEditingWorkflow(undefined);
              setIsBuilding(true);
            }}
            className="group relative rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-lowest p-5 transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] text-on-surface-variant/40 hover:text-primary hover:shadow-md hover:shadow-black/5"
          >
            <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase">Initialize New Workflow</span>
          </button>
        )}
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Fleet Health" value="99.98%" subValue="+0.02%" />
        <StatCard label="Active Agents" value="1,242" subValue="/ 2000 Peak" />
        <StatCard label="Cluster Utilization" value="64%" progress={64} />
      </div>
    </div>
  );
};

const WorkflowCard = ({ workflow, onEdit, onDelete }: { workflow: WorkflowDefinition; onEdit: () => void; onDelete: () => void }) => {
  const { status, version, name, description, stats, last_updated } = workflow;
  
  const getStatusColor = () => {
    switch (status) {
      case 'Active': return 'bg-primary';
      case 'Running': return 'bg-secondary';
      case 'Idle': return 'bg-on-surface-variant/30';
      case 'Draft': return 'bg-amber-500';
      default: return 'bg-on-surface-variant/30';
    }
  };

  const running = status === 'Running';
  const draft = status === 'Draft';
  const ready = status === 'Active';

  return (
    <div 
      onClick={onEdit}
      className="group card-elevated--interactive relative p-5 flex flex-col justify-between min-h-[220px]"
    >
      {running && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
          </span>
        </div>
      )}
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${running ? 'animate-pulse shadow-[0_0_8px_rgba(186,195,255,0.8)]' : ''}`}></div>
              <span className={`text-[10px] font-bold tracking-widest uppercase ${running ? 'text-secondary' : 'text-on-surface-variant/60'}`}>{status}</span>
            </div>
            {workflow.department && (
              <span className="text-[8px] font-bold text-primary uppercase tracking-widest opacity-60">
                {workflow.department.replace('_', ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-on-surface-variant/50 px-1.5 py-0.5 bg-surface-container-lowest rounded-sm">{version}</span>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="btn-icon bg-surface-container-high text-on-surface-variant/80 hover:text-error"
              title="Delete workflow"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <h3 className={`text-lg font-bold font-headline tracking-tight text-on-surface ${draft ? 'opacity-50' : ''}`}>{name}</h3>
        <p className={`text-xs text-on-surface-variant mt-1 line-clamp-2 ${draft ? 'opacity-40' : ''}`}>{description}</p>
      </div>

      <div className="mt-6">
        {stats && (
          <div className="flex items-center gap-4 py-2 border-y border-outline-variant/10 mb-2">
            {Object.entries(stats).map(([key, val]: any, i) => (
              <React.Fragment key={key}>
                <div>
                  <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{key}</p>
                  <p className={`text-xs font-mono ${key === 'success' ? 'text-secondary' : 'text-on-surface'}`}>{val}</p>
                </div>
                {i < Object.entries(stats).length - 1 && <div className="w-px h-6 bg-outline-variant/20"></div>}
              </React.Fragment>
            ))}
          </div>
        )}

        {draft && (
          <div className="flex items-center gap-2 text-on-surface-variant/40 mb-4">
            <AlertTriangle size={14} />
            <span className="text-[10px] font-medium italic">Pending schema validation</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {ready && <CheckCircle2 size={14} className="text-secondary" />}
            {running && <Terminal size={14} className="text-primary-container" />}
            {draft ? (
              <button type="button" className="btn btn-surface border-outline-variant/10 text-on-surface-variant hover:text-on-surface">Resume build</button>
            ) : (
              <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/40">{ready ? 'Ready' : running ? 'View Shell' : ''}</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant/40 italic">
            {new Date(last_updated).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subValue, progress }: any) => (
  <div className="card-elevated p-4">
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">{label}</h4>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-black font-headline tracking-tighter text-on-surface">{value}</span>
      {subValue && <span className={`text-[10px] font-mono ${subValue.startsWith('+') ? 'text-secondary' : 'text-on-surface-variant/40'}`}>{subValue}</span>}
      {progress !== undefined && (
        <div className="flex-1 h-1.5 bg-surface-variant rounded-full ml-4 overflow-hidden">
          <div className="h-full bg-primary-container" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  </div>
);

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Boxes, 
  Plus, 
  Activity, 
  TrendingUp, 
  Play,
  ShieldCheck,
  MoreVertical,
  ArrowUpRight,
  Shield,
  FileText,
  Scale,
  GitBranch,
  ExternalLink,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { AgentDefinition, AGENT_TYPES } from '../types/agent';
import { AgentBuilder } from './AgentBuilder';
import { AgentPlayground } from './AgentPlayground';

interface AgentsViewProps {
  agents: AgentDefinition[];
  setAgents: React.Dispatch<React.SetStateAction<AgentDefinition[]>>;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({ agents, setAgents, selectedAgentId: propSelectedAgentId, setSelectedAgentId }) => {
  const { id: urlId } = useParams();
  const selectedAgentId = urlId || propSelectedAgentId;
  const [isBuilding, setIsBuilding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | undefined>(undefined);

  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.agent_id === selectedAgentId);
      if (agent) {
        setEditingAgent(agent);
        setIsBuilding(true);
      }
    } else {
      setIsBuilding(false);
      setIsTesting(false);
      setEditingAgent(undefined);
    }
  }, [selectedAgentId, agents]);

  const handleSaveAgent = (agent: AgentDefinition) => {
    if (editingAgent) {
      setAgents(agents.map(a => a.agent_id === agent.agent_id ? agent : a));
    } else {
      setAgents([...agents, { ...agent, status: 'active', last_updated: new Date().toISOString() }]);
    }
    setIsBuilding(false);
    setEditingAgent(undefined);
    setSelectedAgentId(null);
  };

  if (isBuilding) {
    return (
      <AgentBuilder 
        onBack={() => {
          setIsBuilding(false);
          setEditingAgent(undefined);
          setSelectedAgentId(null);
        }} 
        onSave={handleSaveAgent}
        initialAgent={editingAgent}
      />
    );
  }

  if (isTesting && editingAgent) {
    return (
      <AgentPlayground 
        agent={editingAgent}
        onBack={() => {
          setIsTesting(false);
          setEditingAgent(undefined);
          setSelectedAgentId(null);
        }}
      />
    );
  }

  return (
    <div className="page-shell space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <p className="page-kicker">Agents</p>
          <h2 className="page-title">Agents</h2>
          <p className="page-description">Configure automation workers for claims, underwriting, and compliance.</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsBuilding(true)}
          className="btn btn-primary shadow-lg shadow-primary/20"
        >
          <Plus size={14} className="shrink-0" />
          Create new agent
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <AgentStat label="Total agents" value={agents.length} icon={Boxes} />
        <AgentStat label="Active" value={agents.filter(a => a.status === 'active').length} icon={Activity} />
        <AgentStat label="Avg. confidence" value="96.2%" icon={TrendingUp} />
        <AgentStat label="Compliance" value="A+" icon={ShieldCheck} />
      </div>

      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 -mt-2">Use the top bar search to filter this list.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <AgentCard 
            key={agent.agent_id}
            agent={agent}
            onEdit={() => {
              setEditingAgent(agent);
              setIsBuilding(true);
              setSelectedAgentId(agent.agent_id);
            }}
            onTest={() => {
              setEditingAgent(agent);
              setIsTesting(true);
              setSelectedAgentId(agent.agent_id);
            }}
          />
        ))}
      </div>
    </div>
  );
};

const AgentStat = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }) => (
  <div className="card-elevated p-4">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</span>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
        <Icon size={16} strokeWidth={1.75} />
      </div>
    </div>
    <div className="text-2xl font-black font-headline tracking-tighter text-on-surface">{value}</div>
  </div>
);

const AgentCard = ({ agent, onEdit, onTest }: { agent: AgentDefinition, onEdit: () => void, onTest: () => void }) => {
  const typeInfo = AGENT_TYPES.find(t => t.value === agent.type);

  const getIcon = () => {
    switch (agent.type) {
      case 'doc_intelligence': return FileText;
      case 'validation': return Shield;
      case 'fraud_risk': return AlertCircle;
      case 'compliance': return Scale;
      case 'decision': return GitBranch;
      case 'human_interface': return User;
      case 'integration': return ExternalLink;
      case 'workflow_control': return Clock;
      default: return Boxes;
    }
  };

  const Icon = getIcon();

  return (
    <div className="card-elevated--interactive p-6 group relative overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold font-headline tracking-tight text-on-surface">{agent.name}</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{typeInfo?.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onTest(); }} 
            className="btn-icon bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            title="Open playground"
          >
            <Play size={14} strokeWidth={1.75} />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
            className="btn-icon bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          >
            <MoreVertical size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1.5">
            <span>Purpose</span>
            <span className="font-mono text-on-surface-variant/70 uppercase">v{agent.version}</span>
          </div>
          <p className="text-xs font-medium text-on-surface line-clamp-2 leading-relaxed">{agent.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Inputs</div>
            <div className="flex flex-wrap gap-1">
              {agent.input_schema.slice(0, 2).map((f, i) => (
                <span key={i} className="rounded-sm bg-surface-container px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">{f.name}</span>
              ))}
              {agent.input_schema.length > 2 && <span className="text-[8px] font-bold opacity-40">+{agent.input_schema.length - 2}</span>}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Outputs</div>
            <div className="flex flex-wrap gap-1">
              {agent.output_schema.slice(0, 2).map((f, i) => (
                <span key={i} className="rounded-sm bg-surface-container px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">{f.name}</span>
              ))}
              {agent.output_schema.length > 2 && <span className="text-[8px] font-bold opacity-40">+{agent.output_schema.length - 2}</span>}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
          <div className="text-[10px] text-on-surface-variant/60">Updated: <span className="text-on-surface font-sans">{new Date(agent.last_updated).toLocaleDateString()}</span></div>
          <button type="button" onClick={onEdit} className="btn btn-ghost px-2 text-on-surface-variant hover:gap-2 hover:text-on-surface">
            Configure
            <ArrowUpRight size={12} className="shrink-0" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
};

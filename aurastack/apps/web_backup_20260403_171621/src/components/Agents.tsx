import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Bot, 
  MessageSquare, 
  FileSearch, 
  Zap, 
  ShieldAlert, 
  Eye,
  Trash2,
  ChevronRight,
  Sparkles,
  Copy,
  Search,
  X,
  Save,
  Activity,
  Settings,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Agent } from '../types';
import { INDUSTRIES } from '../constants';
import { Dropdown } from './Dropdown';

export function Agents({ onSelectAgent }: { onSelectAgent: (id: string) => void }) {
  const { agents, addAgent, deleteAgent } = usePlatform();
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'communication' as Agent['type'],
    description: '',
    rules: '',
    checklist: '',
    goals: '',
    role: '',
    category: INDUSTRIES[0]
  });

  const typeIcons: any = {
    communication: <MessageSquare size={16} strokeWidth={1.5} />,
    processing: <FileSearch size={16} strokeWidth={1.5} />,
    decision: <Zap size={16} strokeWidth={1.5} />,
    action: <ChevronRight size={16} strokeWidth={1.5} />,
    monitoring: <ShieldAlert size={16} strokeWidth={1.5} />
  };

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.role?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'All' || agent.type === selectedType;
      const matchesIndustry = selectedIndustry === 'All' || agent.category === selectedIndustry;
      return matchesSearch && matchesType && matchesIndustry;
    });
  }, [agents, searchQuery, selectedType, selectedIndustry]);

  const handleCreate = () => {
    if (!newAgent.name) return;
    addAgent({
      name: newAgent.name,
      type: newAgent.type,
      description: newAgent.description,
      role: newAgent.role,
      category: newAgent.category,
      rules: newAgent.rules.split('\n').filter(r => r.trim()),
      checklist: newAgent.checklist.split('\n').filter(c => c.trim()),
      goals: newAgent.goals.split('\n').filter(g => g.trim()),
      status: 'active'
    });
    setIsCreating(false);
    resetForm();
  };

  const handleClone = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    addAgent({
      name: `${agent.name} (Copy)`,
      type: agent.type,
      description: agent.description,
      role: agent.role,
      category: agent.category,
      rules: [...agent.rules],
      checklist: [...agent.checklist],
      goals: [...agent.goals],
      status: 'draft'
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteAgent(id);
  };

  const resetForm = () => {
    setNewAgent({
      name: '',
      type: 'communication',
      description: '',
      rules: '',
      checklist: '',
      goals: '',
      role: '',
      category: INDUSTRIES[0]
    });
  };

  const types = ['All', 'communication', 'processing', 'decision', 'action', 'monitoring'];
  const activeAgents = filteredAgents.filter((agent) => agent.status === 'active').length;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="page-kicker">Agent Library</p>
          <h3 className="page-title">AI Agents</h3>
          <p className="text-sm text-[#64748B] mt-0.5">Manage your autonomous insurance workforce</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} strokeWidth={1.5} />
          Create Agent
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-elevated p-3">
          <p className="mono-label">Total Agents</p>
          <p className="text-xl font-semibold text-[#0F172A] mt-1">{agents.length}</p>
        </div>
        <div className="card-elevated p-3">
          <p className="mono-label">Active</p>
          <p className="text-xl font-semibold text-[#0F172A] mt-1">{activeAgents}</p>
        </div>
        <div className="card-elevated p-3">
          <p className="mono-label">Showing</p>
          <p className="text-xl font-semibold text-[#0F172A] mt-1">{filteredAgents.length}</p>
        </div>
        <div className="card-elevated p-3">
          <p className="mono-label">Industries</p>
          <p className="text-xl font-semibold text-[#0F172A] mt-1">{INDUSTRIES.length}</p>
        </div>
      </div>

      {/* Filters - aligned search + dropdowns */}
      <div className="filter-row">
        <div className="filter-search-wrap flex-1 min-w-0">
          <span className="filter-label">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search specialized agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base h-9 pl-9 pr-3"
            />
          </div>
        </div>
        <Dropdown 
          label="Type"
          options={types.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))}
          value={selectedType}
          onChange={setSelectedType}
          className="w-full md:w-40"
        />
        <Dropdown 
          label="Industry"
          options={['All', ...INDUSTRIES].map(ind => ({ label: ind, value: ind }))}
          value={selectedIndustry}
          onChange={setSelectedIndustry}
          className="w-full md:w-48"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAgents.map((agent) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className="card card-hover p-5 group relative overflow-hidden cursor-pointer flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "p-2.5 rounded-lg text-slate-900 bg-slate-50 border border-slate-200",
                )}>
                  {typeIcons[agent.type] || <Bot size={16} strokeWidth={1.5} />}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleClone(e, agent)}
                    title="Clone Agent"
                    className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-all"
                  >
                    <Copy size={16} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, agent.id)}
                    title="Delete Agent"
                    className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="mb-3">
                <h4 className="card-title mb-0.5">{agent.name}</h4>
                <p className="meta-label">{agent.role || 'Specialized Agent'}</p>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="badge bg-[#F1F5F9] text-[#0F172A]">
                  {agent.type}
                </span>
                <span className={cn(
                  "badge",
                  agent.status === 'active' ? "badge-processing" : "bg-[#F1F5F9] text-[#64748B]"
                )}>
                  {agent.status}
                </span>
              </div>
              
              <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-6 leading-relaxed flex-1">
                {agent.description}
              </p>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[#64748B]" strokeWidth={1.5} />
                    <span className="meta-label">Efficiency</span>
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">98.4%</span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '98.4%' }}
                    className="h-full bg-slate-900 rounded-full"
                  ></motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1F9D8B] text-white rounded-lg">
                    <Sparkles size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Create New Agent</h3>
                </div>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="stat-label">Agent Name</label>
                    <input 
                      type="text" 
                      value={newAgent.name}
                      onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                      placeholder="e.g. Claim Intake Agent" 
                      className="input-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="stat-label">Functional Role</label>
                    <input 
                      type="text" 
                      value={newAgent.role}
                      onChange={e => setNewAgent({...newAgent, role: e.target.value})}
                      placeholder="e.g. Intake Orchestrator" 
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="stat-label">Industry Category</label>
                    <select 
                      value={newAgent.category}
                      onChange={e => setNewAgent({...newAgent, category: e.target.value})}
                      className="input-base"
                    >
                      {INDUSTRIES.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="stat-label">Agent Type</label>
                    <select 
                      value={newAgent.type}
                      onChange={e => setNewAgent({...newAgent, type: e.target.value as any})}
                      className="input-base"
                    >
                      {Object.keys(typeIcons).map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="stat-label">Mission Description</label>
                  <textarea 
                    value={newAgent.description}
                    onChange={e => setNewAgent({...newAgent, description: e.target.value})}
                    rows={3}
                    placeholder="Define the core mission..." 
                    className="input-base resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="stat-label">Operational Rules (One per line)</label>
                  <textarea 
                    value={newAgent.rules}
                    onChange={e => setNewAgent({...newAgent, rules: e.target.value})}
                    rows={2}
                    placeholder="e.g. Always verify credentials" 
                    className="input-base resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={!newAgent.name}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save size={16} strokeWidth={1.5} />
                  Deploy Agent
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bot, 
  X,
  Save,
  Activity,
  Settings,
  Terminal,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Agent } from '../types';
import { usePlatform } from '../context/PlatformContext';

interface AgentDetailModalProps {
  agent: Agent;
  onClose: () => void;
  onUpdate: (updates: Partial<Agent>) => void;
  onSelectCase?: (caseId: string) => void;
}

export function AgentDetailModal({ agent, onClose, onUpdate, onSelectCase }: AgentDetailModalProps) {
  const { cases } = usePlatform();
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'logs' | 'cases'>('monitor');
  const [isEditing, setIsEditing] = useState(false);
  const [editedAgent, setEditedAgent] = useState(agent);
  const [simulatedLogs, setSimulatedLogs] = useState<any[]>(agent.recentActivity || []);
  const [isSimulating, setIsSimulating] = useState(agent.status === 'active');

  const handledCases = useMemo(() => {
    return cases.filter(c => c.agentId === agent.id);
  }, [cases, agent.id]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const actions = [
        'Analyzing document structure',
        'Verifying policy credentials',
        'Cross-referencing medical codes',
        'Calculating liability score',
        'Updating case status',
        'Generating response draft',
        'Scanning for fraud patterns'
      ];
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: actions[Math.floor(Math.random() * actions.length)],
        status: Math.random() > 0.1 ? 'success' : 'warning',
        details: 'Automated process execution completed.'
      };
      setSimulatedLogs(prev => [newLog, ...prev].slice(0, 20));
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleSave = () => {
    onUpdate(editedAgent);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, x: 10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.98, x: 10 }}
        className="relative bg-white w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl shadow-sm text-slate-900 bg-slate-50 border border-slate-200",
            )}>
              <Bot size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{agent.name}</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded">
                  {agent.id}
                </span>
              </div>
              <p className="text-slate-500 text-xs font-medium">{agent.role} • {agent.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSimulating(!isSimulating)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border",
                isSimulating ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
              )}
            >
              {isSimulating ? <Pause size={14} /> : <Play size={14} />}
              {isSimulating ? 'Pause Agent' : 'Resume Agent'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-100 bg-white">
          {[
            { id: 'monitor', label: 'Live Monitor', icon: Terminal },
            { id: 'cases', label: 'Handled Cases', icon: Briefcase },
            { id: 'config', label: 'Configuration', icon: Settings },
            { id: 'logs', label: 'Activity Logs', icon: Clock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 font-bold text-xs transition-all relative",
                activeTab === tab.id ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <AnimatePresence mode="wait">
            {activeTab === 'monitor' && (
              <motion.div 
                key="monitor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900 rounded-xl p-5 text-emerald-400 font-mono text-xs h-[450px] overflow-y-auto shadow-xl relative border border-slate-800">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isSimulating ? "bg-emerald-500" : "bg-amber-500")} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {isSimulating ? 'Live Stream' : 'Paused'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {simulatedLogs.map((log, i) => (
                        <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-1 duration-200">
                          <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className={cn(
                            log.status === 'success' ? "text-emerald-400" : "text-amber-400"
                          )}>
                            {log.status === 'success' ? '✔' : '⚠'} {log.action}: {log.details}
                          </span>
                        </div>
                      ))}
                      {isSimulating && (
                        <div className="flex gap-3 animate-pulse">
                          <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                          <span className="text-emerald-400">_</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="card p-5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Real-time Metrics</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'CPU Usage', value: isSimulating ? '12%' : '0%', icon: Activity },
                        { label: 'Memory', value: isSimulating ? '244MB' : '42MB', icon: RefreshCw },
                        { label: 'Latency', value: isSimulating ? '42ms' : '-', icon: Clock },
                        { label: 'Success Rate', value: '99.2%', icon: CheckCircle2 },
                      ].map(metric => (
                        <div key={metric.label} className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-slate-500">
                            <metric.icon size={14} />
                            <span className="text-[11px] font-bold">{metric.label}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-900">{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-indigo-600 p-5 rounded-xl text-white shadow-lg shadow-indigo-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3 opacity-80">Current Task</h4>
                    <p className="text-sm font-bold mb-3">
                      {isSimulating ? 'Processing batch #8821-A for Healthcare Claims' : 'Idle - Waiting for trigger'}
                    </p>
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      {isSimulating && (
                        <motion.div 
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-1/2 h-full bg-white rounded-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'cases' && (
              <motion.div 
                key="cases"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold text-slate-900 tracking-tight">Cases Handled by {agent.name}</h4>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Resolved</span>
                    <span className="text-xs font-bold text-slate-900">{handledCases.filter(c => c.status === 'completed').length}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Case ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handledCases.slice(0, 10).map(c => (
                        <tr 
                          key={c.id} 
                          onClick={() => onSelectCase?.(c.id)}
                          className="hover:bg-slate-50/50 transition-colors group/row border-b border-slate-50 last:border-0 cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{c.id}</span>
                              <ExternalLink size={12} className="text-slate-300 opacity-0 group-hover/row:opacity-100 transition-all" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">{c.customer}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500 capitalize">{c.type}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                              c.status === 'completed' ? "bg-slate-50 text-slate-900 border-slate-200" :
                              c.status === 'in progress' ? "bg-slate-50 text-slate-900 border-slate-200" :
                              c.status === 'review' ? "bg-slate-50 text-slate-900 border-slate-200" :
                              c.status === 'escalated' ? "bg-slate-50 text-slate-900 border-slate-200" : "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wider",
                              c.priority === 'critical' ? "text-slate-900" :
                              c.priority === 'high' ? "text-slate-800" :
                              c.priority === 'medium' ? "text-slate-600" : "text-slate-400"
                            )}>
                              {c.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[11px] font-bold text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {handledCases.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center">
                            <Briefcase size={40} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-slate-400 text-xs font-bold">No cases handled by this agent yet.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div 
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold text-slate-900 tracking-tight">Agent Configuration</h4>
                  <button 
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    {isEditing ? <Save size={16} /> : <Settings size={16} />}
                    {isEditing ? 'Save Changes' : 'Edit Configuration'}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="card p-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">Agent Name</label>
                        {isEditing ? (
                          <input 
                            value={editedAgent.name}
                            onChange={e => setEditedAgent({...editedAgent, name: e.target.value})}
                            className="input-base px-4 py-2.5 text-sm font-bold"
                          />
                        ) : (
                          <p className="text-base font-bold text-slate-900 px-0.5">{agent.name}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">Mission Description</label>
                        {isEditing ? (
                          <textarea 
                            value={editedAgent.description}
                            onChange={e => setEditedAgent({...editedAgent, description: e.target.value})}
                            rows={4}
                            className="input-base px-4 py-2.5 text-xs font-medium resize-none"
                          />
                        ) : (
                          <p className="text-slate-500 text-xs font-medium leading-relaxed px-0.5">{agent.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="card p-6 space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational Rules</h5>
                      {isEditing ? (
                        <textarea 
                          value={editedAgent.rules.join('\n')}
                          onChange={e => setEditedAgent({...editedAgent, rules: e.target.value.split('\n')})}
                          rows={6}
                          className="input-base px-4 py-2.5 text-xs font-medium resize-none"
                        />
                      ) : (
                        <ul className="space-y-3">
                          {agent.rules.map((rule, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <div className="mt-1.5 w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                              <span className="text-xs font-medium text-slate-600">{rule}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="card p-6 space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validation Checklist</h5>
                      {isEditing ? (
                        <textarea 
                          value={editedAgent.checklist.join('\n')}
                          onChange={e => setEditedAgent({...editedAgent, checklist: e.target.value.split('\n')})}
                          rows={6}
                          className="input-base px-4 py-2.5 text-xs font-medium resize-none"
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {agent.checklist.map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              <span className="text-xs font-bold text-slate-700">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card p-6 space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Performance Goals</h5>
                      {isEditing ? (
                        <textarea 
                          value={editedAgent.goals.join('\n')}
                          onChange={e => setEditedAgent({...editedAgent, goals: e.target.value.split('\n')})}
                          rows={6}
                          className="input-base px-4 py-2.5 text-xs font-medium resize-none"
                        />
                      ) : (
                        <div className="space-y-4">
                          {agent.goals.map((goal, i) => (
                            <div key={i} className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-500">{goal}</span>
                                <span className="text-slate-900">85%</span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-900 w-[85%]" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulatedLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                        <td className="px-6 py-4 text-[11px] font-bold text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-900">
                          {log.action}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                            log.status === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

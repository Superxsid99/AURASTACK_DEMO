import React, { useState } from 'react';
import { 
  Play, 
  Code, 
  Terminal, 
  Boxes, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Database,
  Shield,
  FileText,
  BarChart3
} from 'lucide-react';
import { AgentDefinition } from '../types/agent';
import { Case } from '../types/case';
import { aiService } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface AgentPlaygroundProps {
  agent: AgentDefinition;
  onBack: () => void;
}

export const AgentPlayground: React.FC<AgentPlaygroundProps> = ({ agent, onBack }) => {
  const [input, setInput] = useState<string>(
    JSON.stringify(
      agent.input_schema.reduce((acc, field) => ({ ...acc, [field.name]: field.type === 'number' ? 0 : 'sample_value' }), {}),
      null,
      2
    )
  );
  const [output, setOutput] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ timestamp: string, message: string, type: 'info' | 'success' | 'error' }[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: new Date().toLocaleTimeString(), message, type }, ...prev]);
  };

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    setOutput(null);
    setLogs([]);
    
    addLog(`Initializing ${agent.name}...`, 'info');
    addLog(`Validating input schema...`, 'info');
    
    try {
      const parsedInput = JSON.parse(input);
      addLog(`Input validated. Sending to model...`, 'info');
      
      // Mock case for playground
      const mockCase: Case = {
        id: 'playground-case',
        title: 'Playground Test Case',
        description: 'Temporary case for agent testing',
        workflow_id: 'playground',
        type: 'CLAIM',
        status: 'STABLE',
        priority: 'MEDIUM',
        department: 'CLAIMS',
        execution_status: 'IN_PROGRESS',
        current_node_id: 'test',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        metadata: {},
        timeline: [],
        documents: []
      };

      const result = await aiService.executeAgent(agent, mockCase, parsedInput);
      
      addLog(`Execution completed successfully.`, 'success');
      setOutput(result);
    } catch (err: any) {
      const msg = err.message || 'Failed to execute agent';
      setError(msg);
      addLog(`Execution failed: ${msg}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="btn-icon-sm">
            <ChevronRight className="rotate-180" size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Boxes size={18} className="text-primary" />
              <h2 className="text-xl font-bold font-headline tracking-tight">{agent.name} <span className="text-primary">Test run</span></h2>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Validate inputs and outputs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-sm border border-outline-variant/10">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Runtime ready</span>
          </div>
          <button 
            type="button"
            onClick={handleRun}
            disabled={isLoading}
            className="btn btn-primary disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Play size={14} className="shrink-0" />}
            Run test
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Input */}
        <div className="w-1/2 border-r border-outline-variant/10 flex flex-col">
          <div className="p-4 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Code size={14} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Input Payload (JSON)</span>
            </div>
            <button 
              onClick={() => setInput(JSON.stringify(agent.input_schema.reduce((acc, field) => ({ ...acc, [field.name]: field.type === 'number' ? 0 : 'sample_value' }), {}), null, 2))}
              className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Reset to Schema
            </button>
          </div>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-6 bg-surface-container-low font-mono text-xs text-on-surface focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Right Panel: Output & Logs */}
        <div className="w-1/2 flex flex-col bg-surface-container-lowest">
          {/* Output Section */}
          <div className="flex-1 flex flex-col border-b border-outline-variant/10">
            <div className="p-4 border-b border-outline-variant/10 bg-surface-container-lowest flex items-center gap-2">
              <Database size={14} className="text-secondary" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Output Response</span>
            </div>
            <div className="flex-1 p-6 overflow-auto font-mono text-xs">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center space-y-4 opacity-40"
                  >
                    <RefreshCw size={32} className="animate-spin text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Running…</p>
                  </motion.div>
                ) : output ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-sm border border-green-500/20 flex items-center gap-2">
                        <CheckCircle2 size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Success</span>
                      </div>
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-sm border border-primary/20 flex items-center gap-2">
                        <BarChart3 size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Confidence: {(output.confidence * 100).toFixed(1)}%</span>
                      </div>
                      {output.tools_used && output.tools_used.length > 0 && (
                        <div className="bg-secondary/10 text-secondary px-3 py-1 rounded-sm border border-secondary/20 flex items-center gap-2">
                          <Database size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Tools: {output.tools_used.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <pre className="text-on-surface leading-relaxed">{JSON.stringify(output.data, null, 2)}</pre>
                  </motion.div>
                ) : error ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center space-y-4 text-red-500"
                  >
                    <AlertCircle size={32} />
                    <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center space-y-2 opacity-20">
                    <Terminal size={48} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Ready for execution</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Logs Section */}
          <div className="h-48 flex flex-col bg-surface-container-low">
            <div className="p-3 border-b border-outline-variant/10 bg-surface-container-low flex items-center gap-2">
              <Terminal size={12} className="opacity-40" />
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Execution Logs</span>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-[10px] space-y-1">
              {logs.length === 0 && <div className="opacity-20 italic">No logs yet...</div>}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-on-surface-variant'}`}>
                  <span className="opacity-30">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

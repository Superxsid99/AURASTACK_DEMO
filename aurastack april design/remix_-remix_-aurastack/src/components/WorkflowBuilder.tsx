import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Stage, 
  Layer, 
  Rect, 
  Text, 
  Group, 
  Line, 
  Circle,
  Arrow
} from 'react-konva';
import { 
  Plus, 
  Play, 
  Save, 
  X, 
  Settings, 
  CircleDot, 
  Activity, 
  ListTodo, 
  Database, 
  Shield, 
  ArrowLeft,
  Trash2,
  ChevronRight,
  Search,
  Clock,
  User,
  GitBranch,
  GitFork,
  GitMerge,
  Table,
  Shuffle,
  ExternalLink,
  History,
  PlayCircle,
  PauseCircle,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Split,
  Flag,
  AlertCircle,
  Terminal,
  Code
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_AGENTS } from '../constants/agents';
import { AgentDefinition } from '../types/agent';
import { Node, NodeType, NodeConfig, WorkflowDefinition } from '../types/workflow';
import { useWorkflowTemplates } from './WorkflowBuilder_Templates';
import { ExecutionType } from '../types/node';
import { Department } from '../types/execution';

import { Case } from '../types/case';
import { ExecutionEngine } from '../services/executionEngine';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

interface WorkflowBuilderProps {
  initialWorkflow?: WorkflowDefinition;
  onSave: (workflow: WorkflowDefinition) => void;
  onDelete?: (id: string) => void;
  onBack: () => void;
  agents: AgentDefinition[];
  cases: Case[];
  allWorkflows?: WorkflowDefinition[];
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ 
  initialWorkflow, 
  onSave, 
  onDelete,
  onBack, 
  agents, 
  cases,
  allWorkflows = []
}) => {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(initialWorkflow || {
    workflow_id: `wf_${uuidv4().slice(0, 8)}`,
    name: 'New Workflow',
    description: 'Describe your workflow logic here.',
    version: '1.0.0',
    status: 'Draft',
    department: 'CLAIMS',
    last_updated: new Date().toISOString(),
    nodes: [
      { 
        id: 'start', 
        type: 'input', 
        label: 'Start Node', 
        x: 100, 
        y: 100, 
        config: {}, 
        execution: {
          execution_type: 'system_action',
          department: 'CLAIMS',
          consumes_event: 'workflow.start',
          produces_event: 'start.complete',
          writes: []
        },
        next: [] 
      },
    ]
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { applyTemplate } = useWorkflowTemplates(setWorkflow, setSelectedNodeId);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [layoutPrompt, setLayoutPrompt] = useState('');
  const [isLayoutGenerating, setIsLayoutGenerating] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showAbTest, setShowAbTest] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ id: string; message: string }[]>([]);
  const [showWorkflowSettings, setShowWorkflowSettings] = useState(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Register node execution callback for simulation visualization
    ExecutionEngine.getInstance().init(
      () => {}, // setCases (not needed here)
      () => {}, // setTasks (not needed here)
      () => {}, // setLogs (not needed here)
      (nodeId) => setActiveNodeId(nodeId)
    );

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
      updateDimensions();
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const handleAddNode = (type: NodeType, label: string, config: Partial<NodeConfig> = {}) => {
    const newNode: Node = {
      id: uuidv4().slice(0, 8),
      type,
      label,
      x: 200,
      y: 200,
      config: {
        ...( (type === 'ai_task' || type === 'api_call') ? { retry: { max_attempts: 3, on_fail: 'escalate' } } : {} ),
        ...config
      },
      execution: {
        execution_type: type === 'ai_task' ? 'agent_processing' : type === 'human_task' ? 'human_task' : 'system_action',
        department: workflow.department,
        consumes_event: '',
        produces_event: `${workflow.workflow_id}.${label.toLowerCase().replace(/\s+/g, '_')}.complete`,
        writes: [],
      },
      next: []
    };
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  };

  const handleLayoutFromPrompt = async () => {
    if (!layoutPrompt || isLayoutGenerating) return;
    setIsLayoutGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Given the current workflow nodes: ${JSON.stringify(workflow.nodes)}, 
        apply the following natural language instruction: "${layoutPrompt}". 
        Return the updated list of nodes. 
        Ensure new nodes have unique IDs and are correctly connected. 
        Maintain the existing structure as much as possible.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                label: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                config: { type: Type.OBJECT },
                execution: { type: Type.OBJECT },
                next: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "type", "label", "x", "y", "config", "execution", "next"]
            }
          }
        }
      });

      const updatedNodes = JSON.parse(response.text);
      setWorkflow(prev => ({ ...prev, nodes: updatedNodes }));
      setLayoutPrompt('');
    } catch (error) {
      console.error('Workflow layout prompt error:', error);
      alert('Could not update the workflow from your description. Try again or edit nodes manually.');
    } finally {
      setIsLayoutGenerating(false);
    }
  };

  const handleNodeDrag = (id: string, e: any) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === id ? { ...node, x: e.target.x(), y: e.target.y() } : node
      )
    }));
  };

  const handleConnect = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === fromId 
          ? { ...node, next: Array.from(new Set([...node.next, toId])) } 
          : node
      )
    }));
    setConnectingFrom(null);
  };

  const handleDeleteNode = (id: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes
        .filter(n => n.id !== id)
        .map(n => ({ ...n, next: n.next.filter(nextId => nextId !== id) }))
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNodeExecution = (id: string, updates: any) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === id ? { ...node, execution: { ...node.execution, ...updates } } : node
      )
    }));
  };

  const selectedNode = workflow.nodes.find(n => n.id === selectedNodeId);
  const showRightPanel = !!selectedNode || showWorkflowSettings;

  const updateNodeConfig = (id: string, updates: Partial<NodeConfig>) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === id ? { ...node, config: { ...node.config, ...updates } } : node
      )
    }));
  };

  const validateWorkflow = () => {
    const errors: { id: string; message: string }[] = [];
    
    // 1. Check for orphaned nodes (except start)
    workflow.nodes.forEach(node => {
      if (node.type === 'input') return;
      const isReachable = workflow.nodes.some(n => n.next.includes(node.id)) || node.execution.consumes_event;
      if (!isReachable) {
        errors.push({ id: node.id, message: `Node "${node.label}" is unreachable (no next pointer and no consumes_event).` });
      }
    });

    // 2. Check for missing configurations
    workflow.nodes.forEach(node => {
      if (node.type === 'ai_task' && !node.config.agent_id) {
        errors.push({ id: node.id, message: `AI Task "${node.label}" has no agent assigned.` });
      }
      if (node.type === 'decision' && (!node.config.conditions || node.config.conditions.length === 0)) {
        errors.push({ id: node.id, message: `Decision "${node.label}" has no branching conditions.` });
      }
      if (node.type === 'api_call' && !node.config.endpoint) {
        errors.push({ id: node.id, message: `API Call "${node.label}" has no endpoint defined.` });
      }
      if (node.type === 'sub_workflow' && !node.config.workflow_ref) {
        errors.push({ id: node.id, message: `Sub-workflow "${node.label}" has no workflow reference.` });
      }
      if (node.type === 'fork' && node.next.length < 2) {
        errors.push({ id: node.id, message: `Fork node "${node.label}" should have at least 2 outgoing paths.` });
      }
      if (node.type === 'join' && !node.config.join_type) {
        errors.push({ id: node.id, message: `Join node "${node.label}" has no join strategy defined.` });
      }

      // Execution Layer Validation
      if (!node.execution.produces_event) {
        errors.push({ id: node.id, message: `Node "${node.label}" must produce an event.` });
      }
      if (node.execution.writes.length === 0 && node.type !== 'end') {
        errors.push({ id: node.id, message: `Node "${node.label}" must define at least one write operation.` });
      }
      if (!node.execution.execution_type) {
        errors.push({ id: node.id, message: `Node "${node.label}" must have an execution type.` });
      }
    });

    // 3. Check for dead ends (except end nodes)
    workflow.nodes.forEach(node => {
      if (node.type === 'end') return;
      if (node.next.length === 0 && !node.execution.produces_event) {
        errors.push({ id: node.id, message: `Node "${node.label}" is a dead end (no next step and no produces_event).` });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (validateWorkflow()) {
      onSave(workflow);
    } else {
      // Still allow save but warn? For now, let's just show errors
      alert('Workflow has validation errors. Please fix them before deploying.');
    }
  };

  const handleDeleteWorkflow = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this entire workflow?')) {
      onDelete(workflow.workflow_id);
    }
  };

  const handleSimulate = async () => {
    if (isSimulating) return;
    
    const startNode = workflow.nodes.find(n => n.type === 'input');
    if (!startNode) {
      alert('Workflow must have an input node to simulate.');
      return;
    }

    if (!validateWorkflow()) {
      alert('Please fix validation errors before simulating.');
      return;
    }

    setIsSimulating(true);
    
    // Create a mock case for simulation
    const mockCase: Case = {
      id: `SIM-${uuidv4().slice(0, 4)}`,
      title: `Simulation: ${workflow.name}`,
      description: 'System-generated simulation case.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      type: workflow.department === 'CLAIMS' ? 'CLAIM' : 'UNDERWRITING',
      department: workflow.department,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      workflow_id: workflow.workflow_id,
      current_node_id: startNode.id,
      risk_score: 0,
      summary: 'Simulation run.',
      timeline: []
    };

    try {
      // We use the real execution engine but with a mock case
      // The engine will emit events and trigger nodes
      await ExecutionEngine.getInstance().executeNode(mockCase, workflow, startNode, agents, [workflow], [], [mockCase]);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
      setActiveNodeId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* Header */}
      <header className="min-h-14 border-b border-outline-variant/10 flex items-stretch bg-surface-container-low z-20 min-w-0">
        <div className="flex items-center gap-3 pl-3 pr-3 shrink-0 border-r border-outline-variant/10 py-2">
          <button 
            type="button"
            onClick={onBack}
            className="btn-icon-sm shrink-0 rounded-full"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface truncate max-w-[200px] sm:max-w-xs">{workflow.workflow_id}</h2>
              <span className="text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded-sm text-primary font-mono shrink-0">v{workflow.version}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-tighter hidden sm:block">Directed execution graph</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedNodeId(null);
              setShowWorkflowSettings(s => !s);
            }}
            className={`btn-icon-sm shrink-0 ${showWorkflowSettings ? 'bg-primary/15 text-primary' : ''}`}
            title={showWorkflowSettings ? 'Close workflow settings' : 'Workflow settings'}
          >
            <Settings size={18} />
          </button>
        </div>
        <div className="flex-1 min-w-0 flex items-center py-1.5 pr-3 pl-2">
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden w-full min-h-10 [scrollbar-width:thin] [scrollbar-color:var(--outline-variant)_transparent]">
          <button 
            type="button"
            onClick={handleSimulate}
            disabled={isSimulating && !isPaused}
            className={`btn shrink-0 bg-secondary/10 text-secondary hover:bg-secondary/20 sm:px-4 ${isSimulating && !isPaused ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <Play size={14} className={`shrink-0 ${isSimulating && !isPaused ? 'animate-pulse' : ''}`} />
            {isSimulating ? 'Simulating' : 'Simulate'}
          </button>
          {isSimulating && (
            <>
              <button 
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="btn btn-muted shrink-0 sm:px-4"
              >
                {isPaused ? <PlayCircle size={14} className="shrink-0" /> : <PauseCircle size={14} className="shrink-0" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              {isPaused && (
                <button 
                  type="button"
                  onClick={() => {
                    const currentNode = workflow.nodes.find(n => n.id === activeNodeId);
                    if (currentNode && currentNode.next.length > 0) {
                      setActiveNodeId(currentNode.next[0]);
                    }
                  }}
                  className="btn btn-muted shrink-0 sm:px-4"
                >
                  <ChevronRight size={14} className="shrink-0" />
                  Step
                </button>
              )}
            </>
          )}
          <button 
            type="button"
            onClick={() => setShowJson(true)}
            className="btn btn-muted shrink-0 sm:px-4"
          >
            <Code size={14} className="shrink-0" />
            JSON
          </button>
          <button 
            type="button"
            onClick={validateWorkflow}
            className="btn btn-muted shrink-0 sm:px-4"
          >
            <Shield size={14} className={`shrink-0 ${validationErrors.length > 0 ? 'text-error' : 'text-primary'}`} />
            Validate
          </button>
          <button 
            type="button"
            onClick={() => setHeatmapMode(!heatmapMode)}
            className={`btn shrink-0 sm:px-4 ${heatmapMode ? 'bg-primary/20 text-primary hover:bg-primary/25' : 'btn-muted'}`}
          >
            <Activity size={14} className="shrink-0" />
            Heatmap
          </button>
          <button 
            type="button"
            onClick={() => {
              const newVersion = {
                version: `v${(parseFloat(workflow.version) + 0.1).toFixed(1)}`,
                created_at: new Date().toISOString(),
                created_by: 'akashgupta99968@gmail.com',
                nodes: [...workflow.nodes]
              };
              setWorkflow(prev => ({
                ...prev,
                version: newVersion.version,
                versions: [...(prev.versions || []), newVersion]
              }));
              alert(`Workflow published as ${newVersion.version}`);
            }}
            className="btn btn-muted shrink-0 sm:px-4"
          >
            <RefreshCw size={14} className="shrink-0" />
            Publish
          </button>
          <button 
            type="button"
            onClick={() => setShowAbTest(!showAbTest)}
            className={`btn shrink-0 sm:px-4 ${showAbTest ? 'bg-primary/20 text-primary hover:bg-primary/25' : 'btn-muted'}`}
          >
            <Split size={14} className="shrink-0" />
            A/B test
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="btn btn-primary shrink-0 sm:px-4"
          >
            <Save size={14} className="shrink-0" />
            Deploy graph
          </button>
          {onDelete && (
            <button 
              type="button"
              onClick={handleDeleteWorkflow}
              className="btn-icon shrink-0 text-error/60 hover:bg-error/10 hover:text-error"
              title="Delete workflow"
            >
              <Trash2 size={18} />
            </button>
          )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Node Palette */}
        <aside className="w-64 border-r border-outline-variant/10 bg-surface-container-low p-4 flex flex-col gap-6 z-10 overflow-y-auto custom-scrollbar">
          <div>
            <div className="mb-6 p-3 bg-primary/5 rounded-sm border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <PencilLine size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Describe changes</span>
              </div>
              <p className="text-[9px] text-on-surface-variant/60 mb-3 leading-relaxed">
                Describe edits in plain language; the graph updates when the model returns valid nodes.
              </p>
              <div className="relative">
                <textarea 
                  value={layoutPrompt}
                  onChange={(e) => setLayoutPrompt(e.target.value)}
                  placeholder="e.g. Add a fraud check after the input node..."
                  className="w-full bg-surface-container border border-outline-variant/20 rounded-sm p-2 text-[10px] text-on-surface focus:outline-none focus:border-primary/40 min-h-[60px] resize-none"
                />
                <button 
                  onClick={handleLayoutFromPrompt}
                  disabled={!layoutPrompt || isLayoutGenerating}
                  className="absolute bottom-2 right-2 p-1.5 bg-primary text-on-primary rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {isLayoutGenerating ? <RefreshCw size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                </button>
              </div>
            </div>

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">Insurance Templates</h3>
            <div className="grid grid-cols-1 gap-1.5 mb-6">
              {[
                'Healthcare Claims Management', 
                'Healthcare Policy Issuance', 
                'KYC & Patient Onboarding', 
                'Medical Underwriting', 
                'Policy Servicing', 
                'Policy Renewals', 
                'Compliance Audit',
                'Omnichannel Intake & Routing'
              ].map(t => (
                <button 
                  key={t}
                  onClick={() => applyTemplate(t)}
                  className="text-left p-2 bg-surface-container rounded-sm border border-outline-variant/10 hover:border-primary/40 transition-all flex items-center justify-between group"
                >
                  <span className="text-[10px] font-bold text-on-surface group-hover:text-primary transition-colors">{t}</span>
                  <ChevronRight size={10} className="text-on-surface-variant/40 group-hover:text-primary" />
                </button>
              ))}
            </div>

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">Insurance Primitives</h3>
            <div className="grid grid-cols-1 gap-1.5 mb-6">
              <PrimitiveItem 
                icon={Search} 
                label="Doc Extraction" 
                onClick={() => handleAddNode('ai_task', 'AI Extraction', { agent_id: 'doc_extractor' })} 
              />
              <PrimitiveItem 
                icon={Shield} 
                label="Fraud Check" 
                onClick={() => handleAddNode('ai_task', 'Fraud Detection', { agent_id: 'fraud_detector' })} 
              />
              <PrimitiveItem 
                icon={Activity} 
                label="Risk Scoring" 
                onClick={() => handleAddNode('ai_task', 'Risk Assessment', { agent_id: 'risk_model' })} 
              />
              <PrimitiveItem 
                icon={ExternalLink} 
                label="Sanctions Check" 
                onClick={() => handleAddNode('api_call', 'Sanctions API', { endpoint: 'https://api.sanctions.io' })} 
              />
              <PrimitiveItem 
                icon={GitBranch} 
                label="KYC Sub-flow" 
                onClick={() => handleAddNode('sub_workflow', 'KYC Verification', { workflow_ref: 'kyc_onboarding_v1' })} 
              />
            </div>

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">Core Nodes</h3>
            <div className="space-y-2">
              <PaletteItem icon={CircleDot} label="Input trigger" type="input" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={ListTodo} label="Automation task" type="ai_task" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={Shield} label="Validation" type="validation" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={GitBranch} label="Decision" type="decision" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={User} label="Human Task" type="human_task" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={ExternalLink} label="API Call" type="api_call" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={Clock} label="Delay" type="delay" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={GitBranch} label="Sub-workflow" type="sub_workflow" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={Flag} label="End" type="end" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
            </div>

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mt-6 mb-4">Orchestration</h3>
            <div className="space-y-2">
              <PaletteItem icon={GitFork} label="Fork (Parallel)" type="fork" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={GitMerge} label="Join (Merge)" type="join" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={Table} label="DMN (Rules Table)" type="dmn" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
              <PaletteItem icon={Shuffle} label="Data Transform" type="transform" onAdd={(t: NodeType, l: string) => handleAddNode(t, l)} />
            </div>
          </div>

          <div className="mt-auto p-4 bg-surface-container rounded-sm border border-outline-variant/5">
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Activity size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Graph Integrity</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
              Shared context model active. Each node reads from and writes to the global state object.
            </p>
          </div>
        </aside>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 min-w-0 relative bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]">
          {showAbTest && (
            <div className="absolute top-4 left-4 right-4 bg-surface-container border border-primary/40 rounded-sm p-4 z-30 shadow-xl animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Split size={16} className="text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">A/B Test (Champion vs Challenger)</h3>
                </div>
                <button onClick={() => setShowAbTest(false)} className="text-on-surface-variant hover:text-on-surface">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Challenger Workflow</label>
                  <PropertySelect 
                    options={['', ...allWorkflows.filter(w => w.workflow_id !== workflow.workflow_id).map(w => w.workflow_id)]}
                    value={workflow.ab_test?.challenger_workflow_id || ''}
                    onChange={(val) => setWorkflow(prev => ({ 
                      ...prev, 
                      ab_test: { 
                        enabled: true, 
                        challenger_workflow_id: val, 
                        traffic_split: prev.ab_test?.traffic_split || 0.1 
                      } 
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Traffic Split (Challenger %)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={workflow.ab_test?.traffic_split || 0.1}
                      onChange={(e) => setWorkflow(prev => ({ 
                        ...prev, 
                        ab_test: { 
                          ...prev.ab_test!, 
                          traffic_split: parseFloat(e.target.value) 
                        } 
                      }))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-xs font-mono text-primary w-12 text-right">
                      {Math.round((workflow.ab_test?.traffic_split || 0.1) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-end">
                  <button 
                    type="button"
                    onClick={() => {
                      setWorkflow(prev => ({ ...prev, ab_test: { ...prev.ab_test!, enabled: !prev.ab_test?.enabled } }));
                    }}
                    className={`btn btn-block transition-colors ${workflow.ab_test?.enabled ? 'btn-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    {workflow.ab_test?.enabled ? 'Test active' : 'Start test'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <Stage 
            width={dimensions.width} 
            height={dimensions.height}
            ref={stageRef}
            draggable
            onDragStart={(e) => {
              if (e.target === e.target.getStage()) {
                document.body.style.cursor = 'grabbing';
              }
            }}
            onDragEnd={() => {
              document.body.style.cursor = 'default';
            }}
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = stageRef.current;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              const scaleBy = 1.1;
              const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

              stage.scale({ x: newScale, y: newScale });

              const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              };
              stage.position(newPos);
            }}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedNodeId(null);
                setShowWorkflowSettings(false);
                setConnectingFrom(null);
              }
            }}
          >
            <Layer>
              {/* Connections */}
              {workflow.nodes.flatMap(node => 
                node.next.map(nextId => {
                  const toNode = workflow.nodes.find(n => n.id === nextId);
                  if (!toNode) return null;
                  
                  const startX = node.x + NODE_WIDTH;
                  const startY = node.y + NODE_HEIGHT / 2;
                  const endX = toNode.x;
                  const endY = toNode.y + NODE_HEIGHT / 2;

                  return (
                    <Arrow
                      key={`${node.id}-${nextId}`}
                      points={[startX, startY, endX, endY]}
                      stroke="#ffffff15"
                      fill="#ffffff15"
                      strokeWidth={2}
                      pointerLength={6}
                      pointerWidth={6}
                      tension={0.4}
                    />
                  );
                })
              )}

              {/* Nodes */}
              {workflow.nodes.map(node => (
                <Group
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  draggable
                  onDragMove={(e) => handleNodeDrag(node.id, e)}
                  onClick={() => {
                    setShowWorkflowSettings(false);
                    setSelectedNodeId(node.id);
                  }}
                  onTap={() => {
                    setShowWorkflowSettings(false);
                    setSelectedNodeId(node.id);
                  }}
                >
                  <Rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    fill={activeNodeId === node.id ? "rgba(52,211,153,0.12)" : "#16181a"}
                    stroke={
                      selectedNodeId === node.id
                        ? "#66D9CC"
                        : activeNodeId === node.id
                          ? "#34d399"
                          : connectingFrom === node.id
                            ? "#34d399"
                            : "#ffffff10"
                    }
                    strokeWidth={selectedNodeId === node.id ? 3 : activeNodeId === node.id ? 2 : 1}
                    cornerRadius={4}
                    shadowBlur={0}
                  />
                  
                  {/* Heatmap Overlay */}
                  {heatmapMode && (
                    <Rect
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      fill={Math.random() > 0.7 ? "#ef444440" : Math.random() > 0.4 ? "#fbbf2440" : "#34d39920"}
                      cornerRadius={4}
                    />
                  )}
                  
                  {/* Type Indicator */}
                  <Rect
                    width={4}
                    height={NODE_HEIGHT}
                    fill={getNodeColor(node.type)}
                    cornerRadius={[4, 0, 0, 4]}
                  />

                  <Text
                    text={node.label}
                    x={15}
                    y={20}
                    fill="#ffffff"
                    fontSize={13}
                    fontStyle="bold"
                    fontFamily="Manrope"
                  />
                  
                  <Text
                    text={node.type.toUpperCase()}
                    x={15}
                    y={48}
                    fill={getNodeColor(node.type)}
                    fontSize={9}
                    letterSpacing={1.5}
                    fontFamily="Inter"
                    fontStyle="bold"
                    opacity={0.7}
                  />

                  <Text
                    text={`ID: ${node.id}`}
                    x={15}
                    y={65}
                    fill="#ffffff20"
                    fontSize={8}
                    fontFamily="JetBrains Mono"
                  />
                  
                  {/* Output Connection Point */}
                  <Circle
                    x={NODE_WIDTH}
                    y={NODE_HEIGHT / 2}
                    radius={5}
                    fill={connectingFrom === node.id ? "#34d399" : "#ffffff15"}
                    stroke="#ffffff20"
                    strokeWidth={1}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setConnectingFrom(node.id);
                    }}
                    onMouseEnter={(e: any) => {
                      e.target.scale({ x: 1.5, y: 1.5 });
                      document.body.style.cursor = 'crosshair';
                    }}
                    onMouseLeave={(e: any) => {
                      e.target.scale({ x: 1, y: 1 });
                      document.body.style.cursor = 'default';
                    }}
                  />

                  {/* Input Connection Point */}
                  <Circle
                    x={0}
                    y={NODE_HEIGHT / 2}
                    radius={5}
                    fill="#ffffff15"
                    stroke="#ffffff20"
                    strokeWidth={1}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (connectingFrom) {
                        handleConnect(connectingFrom, node.id);
                      }
                    }}
                    onMouseEnter={(e: any) => {
                      if (connectingFrom) {
                        e.target.scale({ x: 1.5, y: 1.5 });
                        e.target.fill('#34d39940');
                      }
                    }}
                    onMouseLeave={(e: any) => {
                      e.target.scale({ x: 1, y: 1 });
                      e.target.fill('#ffffff15');
                    }}
                  />
                </Group>
              ))}
            </Layer>
          </Stage>

          {/* Connection Mode Overlay */}
          {connectingFrom && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-secondary text-on-secondary text-[10px] font-bold uppercase tracking-widest rounded-sm shadow-lg animate-pulse">
              Connection Mode: Select target node input
            </div>
          )}
        </div>

        {/* Validation Overlay */}
        {validationErrors.length > 0 && (
          <div className="absolute bottom-6 left-6 max-w-sm bg-surface-container/95 backdrop-blur-md border border-error/20 rounded-sm shadow-xl z-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-error">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Validation Errors ({validationErrors.length})</span>
              </div>
              <button onClick={() => setValidationErrors([])} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {validationErrors.map((err, idx) => (
                <div 
                  key={idx} 
                  className="p-2 rounded-lg bg-error/5 text-[10px] text-on-surface-variant cursor-pointer hover:bg-error/10 transition-colors"
                  onClick={() => {
                    setShowWorkflowSettings(false);
                    setSelectedNodeId(err.id);
                  }}
                >
                  {err.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Properties panel: node inspector or workflow settings (never both); hidden until a node is selected or settings opened */}
        {showRightPanel && (
        <aside 
          className="bg-surface-container-low/95 backdrop-blur-md transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden custom-scrollbar z-10 flex-shrink-0 shadow-[-12px_0_40px_rgba(0,0,0,0.2)] w-80 min-w-80 border-l border-outline-variant/20"
        >
          <div className="w-80">
            {selectedNode ? (
            <div className="p-6 space-y-8">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Node</h3>
                  <h4 className="text-lg font-bold font-headline text-on-surface truncate">{selectedNode.label}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-sm transition-all"
                    title="Close panel"
                  >
                    <X size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="p-2 text-error/60 hover:text-error hover:bg-error/10 rounded-sm transition-all"
                    title="Delete node"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <PropertyField label="Display Label" value={selectedNode.label} onChange={(val) => {
                  setWorkflow(prev => ({
                    ...prev,
                    nodes: prev.nodes.map(n => n.id === selectedNode.id ? { ...n, label: val } : n)
                  }));
                }} />

                {/* Type Specific Configs */}
                {selectedNode.type === 'ai_task' && (
                  <div className="space-y-4">
                    <PropertySelect 
                      label="Agent Selection" 
                      options={['', ...INITIAL_AGENTS.map(a => a.agent_id)]} 
                      value={selectedNode.config.agent_id || ''}
                      onChange={(val) => updateNodeConfig(selectedNode.id, { agent_id: val })}
                    />
                    
                    {selectedNode.config.agent_id && (
                      <div className="p-3 bg-surface-container-low rounded-sm border border-outline-variant/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-primary">Agent Schema</span>
                          <span className="text-[8px] font-mono opacity-40">{selectedNode.config.agent_id}</span>
                        </div>
                        
                        {(() => {
                          const agent = INITIAL_AGENTS.find(a => a.agent_id === selectedNode.config.agent_id);
                          if (!agent) return null;
                          return (
                            <div className="space-y-4">
                              <div>
                                <label className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1 block">Inputs Required</label>
                                <div className="space-y-1">
                                  {agent.input_schema.map(f => (
                                    <div key={f.name} className="flex items-center justify-between text-[9px] bg-surface-container-highest/30 px-2 py-1 rounded-sm">
                                      <span className="font-mono text-on-surface">{f.name}</span>
                                      <span className="text-on-surface-variant/60 italic">{f.type}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1 block">Outputs Produced</label>
                                <div className="space-y-1">
                                  {agent.output_schema.map(f => (
                                    <div key={f.name} className="flex items-center justify-between text-[9px] bg-surface-container-highest/30 px-2 py-1 rounded-sm">
                                      <span className="font-mono text-on-surface">{f.name}</span>
                                      <span className="text-on-surface-variant/60 italic">{f.type}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {selectedNode.type === 'validation' && (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Validation Rules</label>
                    <div className="space-y-2">
                      {(selectedNode.config.rules || []).map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input 
                            value={rule}
                            onChange={(e) => {
                              const newRules = [...(selectedNode.config.rules || [])];
                              newRules[idx] = e.target.value;
                              updateNodeConfig(selectedNode.id, { rules: newRules });
                            }}
                            className="flex-1 bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-1.5 text-[11px] text-on-surface focus:outline-none"
                          />
                          <button 
                            onClick={() => {
                              const newRules = (selectedNode.config.rules || []).filter((_, i) => i !== idx);
                              updateNodeConfig(selectedNode.id, { rules: newRules });
                            }}
                            className="p-1.5 text-error/60 hover:text-error"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => updateNodeConfig(selectedNode.id, { rules: [...(selectedNode.config.rules || []), '']} )}
                        className="w-full py-1.5 border border-dashed border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'decision' && (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Branching Logic</label>
                    <div className="space-y-4">
                      {(selectedNode.config.conditions || []).map((condition, idx) => (
                        <div key={idx} className="p-3 bg-surface-container rounded-sm border border-outline-variant/10 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold uppercase text-primary">Condition {idx + 1}</span>
                            <button 
                              onClick={() => {
                                const newConds = (selectedNode.config.conditions || []).filter((_, i) => i !== idx);
                                updateNodeConfig(selectedNode.id, { conditions: newConds });
                              }}
                              className="text-error/60 hover:text-error"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <PropertyField 
                            label="If Expression" 
                            value={condition.if} 
                            onChange={(val) => {
                              const newConds = [...(selectedNode.config.conditions || [])];
                              newConds[idx] = { ...newConds[idx], if: val };
                              updateNodeConfig(selectedNode.id, { conditions: newConds });
                            }} 
                          />
                          <PropertySelect 
                            label="Go To Node" 
                            options={['', ...workflow.nodes.filter(n => n.id !== selectedNode.id).map(n => n.id)]} 
                            value={condition.go_to}
                            onChange={(val) => {
                              const newConds = [...(selectedNode.config.conditions || [])];
                              newConds[idx] = { ...newConds[idx], go_to: val };
                              updateNodeConfig(selectedNode.id, { conditions: newConds });
                            }}
                          />
                        </div>
                      ))}
                      <button 
                        onClick={() => updateNodeConfig(selectedNode.id, { conditions: [...(selectedNode.config.conditions || []), { if: '', go_to: '' }]} )}
                        className="w-full py-1.5 border border-dashed border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                      >
                        Add Condition
                      </button>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'human_task' && (
                  <>
                    <PropertyField label="Assigned Role" value={selectedNode.config.role || ''} onChange={(val) => updateNodeConfig(selectedNode.id, { role: val })} />
                    <PropertyField label="Required Action" value={selectedNode.config.action || ''} onChange={(val) => updateNodeConfig(selectedNode.id, { action: val })} />
                  </>
                )}

                {selectedNode.type === 'api_call' && (
                  <PropertyField label="Endpoint URL" value={selectedNode.config.endpoint || ''} onChange={(val) => updateNodeConfig(selectedNode.id, { endpoint: val })} />
                )}

                {selectedNode.type === 'delay' && (
                  <PropertyField label="Duration (ms/SLA)" value={selectedNode.config.duration || ''} onChange={(val) => updateNodeConfig(selectedNode.id, { duration: val })} />
                )}

                {selectedNode.type === 'sub_workflow' && (
                  <div className="space-y-4">
                    <PropertySelect 
                      label="Workflow Reference" 
                      options={['', ...allWorkflows.map(w => w.workflow_id)]} 
                      value={selectedNode.config.workflow_ref || ''}
                      onChange={(val) => updateNodeConfig(selectedNode.id, { workflow_ref: val })}
                    />
                    
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Input Mapping</label>
                      <div className="space-y-2">
                        {Object.entries(selectedNode.config.input_mapping || {}).map(([target, source], idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text" 
                              placeholder="Target Key"
                              value={target}
                              readOnly
                              className="flex-1 bg-surface-container-highest border border-outline-variant/10 rounded-sm px-2 py-1 text-[10px] font-mono"
                            />
                            <span className="text-on-surface-variant/40">←</span>
                            <input 
                              type="text" 
                              placeholder="Source Key"
                              value={source}
                              onChange={(e) => {
                                const newMapping = { ...(selectedNode.config.input_mapping || {}) };
                                newMapping[target] = e.target.value;
                                updateNodeConfig(selectedNode.id, { input_mapping: newMapping });
                              }}
                              className="flex-1 bg-surface-container-highest border border-outline-variant/10 rounded-sm px-2 py-1 text-[10px] font-mono focus:border-primary/40 outline-none"
                            />
                            <button 
                              onClick={() => {
                                const newMapping = { ...(selectedNode.config.input_mapping || {}) };
                                delete newMapping[target];
                                updateNodeConfig(selectedNode.id, { input_mapping: newMapping });
                              }}
                              className="text-error/60 hover:text-error"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const key = prompt('Enter target input key:');
                            if (key) {
                              const newMapping = { ...(selectedNode.config.input_mapping || {}) };
                              newMapping[key] = '';
                              updateNodeConfig(selectedNode.id, { input_mapping: newMapping });
                            }
                          }}
                          className="w-full py-1 border border-dashed border-outline-variant/20 text-[9px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                        >
                          Add Input Mapping
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'join' && (
                  <div className="space-y-4">
                    <PropertySelect 
                      label="Join Strategy" 
                      options={['wait_all', 'wait_any']} 
                      value={selectedNode.config.join_type || 'wait_all'}
                      onChange={(val) => updateNodeConfig(selectedNode.id, { join_type: val })}
                    />
                    <p className="text-[9px] text-on-surface-variant/40 italic leading-tight">
                      Wait for all incoming paths or just the first one to complete.
                    </p>
                  </div>
                )}

                {selectedNode.type === 'dmn' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Decision Table</label>
                      <button 
                        onClick={() => {
                          const newTable = {
                            inputs: [...(selectedNode.config.dmn_table?.inputs || []), 'New Input'],
                            outputs: [...(selectedNode.config.dmn_table?.outputs || []), 'New Output'],
                            rules: (selectedNode.config.dmn_table?.rules || []).map(r => ({
                              inputs: [...r.inputs, ''],
                              outputs: [...r.outputs, '']
                            }))
                          };
                          updateNodeConfig(selectedNode.id, { dmn_table: newTable });
                        }}
                        className="text-[9px] text-primary font-bold uppercase"
                      >
                        + Add Column
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-outline-variant/10 rounded-sm">
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-surface-container-highest/30">
                            {(selectedNode.config.dmn_table?.inputs || []).map((input, i) => (
                              <th key={`in-${i}`} className="p-2 border-r border-outline-variant/10 font-mono text-primary">{input}</th>
                            ))}
                            {(selectedNode.config.dmn_table?.outputs || []).map((output, i) => (
                              <th key={`out-${i}`} className="p-2 border-r border-outline-variant/10 font-mono text-secondary">{output}</th>
                            ))}
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedNode.config.dmn_table?.rules || []).map((rule, ri) => (
                            <tr key={ri} className="border-t border-outline-variant/10">
                              {rule.inputs.map((val, ii) => (
                                <td key={ii} className="p-1 border-r border-outline-variant/10">
                                  <input 
                                    value={val}
                                    onChange={(e) => {
                                      const newRules = [...(selectedNode.config.dmn_table?.rules || [])];
                                      newRules[ri].inputs[ii] = e.target.value;
                                      updateNodeConfig(selectedNode.id, { dmn_table: { ...selectedNode.config.dmn_table!, rules: newRules } });
                                    }}
                                    className="w-full bg-transparent outline-none px-1"
                                  />
                                </td>
                              ))}
                              {rule.outputs.map((val, oi) => (
                                <td key={oi} className="p-1 border-r border-outline-variant/10">
                                  <input 
                                    value={val}
                                    onChange={(e) => {
                                      const newRules = [...(selectedNode.config.dmn_table?.rules || [])];
                                      newRules[ri].outputs[oi] = e.target.value;
                                      updateNodeConfig(selectedNode.id, { dmn_table: { ...selectedNode.config.dmn_table!, rules: newRules } });
                                    }}
                                    className="w-full bg-transparent outline-none px-1"
                                  />
                                </td>
                              ))}
                              <td className="p-1 text-center">
                                <button 
                                  onClick={() => {
                                    const newRules = (selectedNode.config.dmn_table?.rules || []).filter((_, i) => i !== ri);
                                    updateNodeConfig(selectedNode.id, { dmn_table: { ...selectedNode.config.dmn_table!, rules: newRules } });
                                  }}
                                  className="text-error/40 hover:text-error"
                                >
                                  <X size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button 
                      onClick={() => {
                        const newRule = {
                          inputs: new Array(selectedNode.config.dmn_table?.inputs.length || 0).fill(''),
                          outputs: new Array(selectedNode.config.dmn_table?.outputs.length || 0).fill('')
                        };
                        updateNodeConfig(selectedNode.id, { dmn_table: { ...selectedNode.config.dmn_table!, rules: [...(selectedNode.config.dmn_table?.rules || []), newRule] } });
                      }}
                      className="w-full py-1.5 border border-dashed border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                    >
                      + Add Rule Row
                    </button>
                  </div>
                )}

                {selectedNode.type === 'transform' && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Data Transformation Mapping</label>
                    <div className="space-y-2">
                      {(selectedNode.config.transform_mapping || []).map((m, i) => (
                        <div key={i} className="p-2 bg-surface-container rounded-sm border border-outline-variant/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <input 
                              placeholder="Source Path"
                              value={m.source}
                              onChange={(e) => {
                                const newMap = [...(selectedNode.config.transform_mapping || [])];
                                newMap[i] = { ...newMap[i], source: e.target.value };
                                updateNodeConfig(selectedNode.id, { transform_mapping: newMap });
                              }}
                              className="flex-1 bg-surface-container-highest border border-outline-variant/10 rounded-sm px-2 py-1 text-[10px] font-mono"
                            />
                            <ChevronRight size={12} className="text-on-surface-variant/40" />
                            <input 
                              placeholder="Target Path"
                              value={m.target}
                              onChange={(e) => {
                                const newMap = [...(selectedNode.config.transform_mapping || [])];
                                newMap[i] = { ...newMap[i], target: e.target.value };
                                updateNodeConfig(selectedNode.id, { transform_mapping: newMap });
                              }}
                              className="flex-1 bg-surface-container-highest border border-outline-variant/10 rounded-sm px-2 py-1 text-[10px] font-mono"
                            />
                            <button 
                              onClick={() => {
                                const newMap = (selectedNode.config.transform_mapping || []).filter((_, idx) => idx !== i);
                                updateNodeConfig(selectedNode.id, { transform_mapping: newMap });
                              }}
                              className="text-error/40 hover:text-error"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <input 
                            placeholder="Optional Expression (e.g. val.toUpperCase())"
                            value={m.expression || ''}
                            onChange={(e) => {
                              const newMap = [...(selectedNode.config.transform_mapping || [])];
                              newMap[i] = { ...newMap[i], expression: e.target.value };
                              updateNodeConfig(selectedNode.id, { transform_mapping: newMap });
                            }}
                            className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-sm px-2 py-1 text-[9px] font-mono italic"
                          />
                        </div>
                      ))}
                      <button 
                        onClick={() => updateNodeConfig(selectedNode.id, { transform_mapping: [...(selectedNode.config.transform_mapping || []), { source: '', target: '' }] })}
                        className="w-full py-1.5 border border-dashed border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                      >
                        + Add Mapping
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 flex items-center gap-2">
                      <History size={12} className="text-primary" />
                      Audit Trail
                    </h3>
                    <button 
                      onClick={() => setShowAuditTrail(!showAuditTrail)}
                      className="text-[9px] text-primary font-bold uppercase"
                    >
                      {showAuditTrail ? 'Hide' : 'View'}
                    </button>
                  </div>
                  {showAuditTrail && (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {[
                        { time: '2026-03-31 02:00:01', event: 'Node Created', user: 'akashgupta99968@gmail.com' },
                        { time: '2026-03-31 02:05:12', event: 'Config Updated', user: 'akashgupta99968@gmail.com' },
                        { time: '2026-03-31 02:08:45', event: 'SLA Configured', user: 'akashgupta99968@gmail.com' }
                      ].map((log, i) => (
                        <div key={i} className="p-2 bg-surface-container-low rounded-sm border border-outline-variant/5 text-[9px] space-y-1">
                          <div className="flex justify-between text-on-surface-variant/40">
                            <span>{log.time}</span>
                            <span>{log.user.split('@')[0]}</span>
                          </div>
                          <div className="text-on-surface font-bold">{log.event}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 flex items-center gap-2">
                    <Shield size={12} className="text-primary" />
                    Resilience & SLA
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <PropertyField 
                        label="SLA Timeout (ms)" 
                        type="number" 
                        value={selectedNode.execution.sla_timeout_ms || 0} 
                        onChange={(val) => updateNodeExecution(selectedNode.id, { sla_timeout_ms: parseInt(val) || 0 })} 
                      />
                      <PropertySelect 
                        label="Escalation Node" 
                        options={['', ...workflow.nodes.filter(n => n.id !== selectedNode.id).map(n => n.id)]} 
                        value={selectedNode.execution.escalation_node_id || ''}
                        onChange={(val) => updateNodeExecution(selectedNode.id, { escalation_node_id: val })}
                      />
                    </div>
                    <PropertySelect 
                      label="Compensation Node (Saga)" 
                      options={['', ...workflow.nodes.filter(n => n.id !== selectedNode.id).map(n => n.id)]} 
                      value={selectedNode.execution.compensation_node_id || ''}
                      onChange={(val) => updateNodeExecution(selectedNode.id, { compensation_node_id: val })}
                    />
                    <p className="text-[9px] text-on-surface-variant/40 italic leading-tight">
                      Compensation node is triggered if a subsequent step fails, enabling the Saga pattern for rollbacks.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 flex items-center gap-2">
                    <RotateCcw size={12} className="text-primary" />
                    Step recovery
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-on-surface-variant">Enable Self-Healing</span>
                      <button 
                        onClick={() => updateNodeExecution(selectedNode.id, { 
                          self_healing: { 
                            enabled: !selectedNode.execution.self_healing?.enabled,
                            supervisor_agent_id: 'supervisor_v1',
                            healing_strategy: 'retry_with_new_params'
                          } 
                        })}
                        className={`w-8 h-4 rounded-full transition-colors relative ${selectedNode.execution.self_healing?.enabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${selectedNode.execution.self_healing?.enabled ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {selectedNode.execution.self_healing?.enabled && (
                      <>
                        <PropertySelect 
                          label="Supervisor Agent" 
                          options={['supervisor_v1', 'risk_supervisor', 'compliance_monitor']} 
                          value={selectedNode.execution.self_healing?.supervisor_agent_id || ''}
                          onChange={(val) => updateNodeExecution(selectedNode.id, { 
                            self_healing: { ...selectedNode.execution.self_healing!, supervisor_agent_id: val } 
                          })}
                        />
                        <PropertySelect 
                          label="Healing Strategy" 
                          options={['retry_with_new_params', 'reroute_to_human', 'fallback_to_previous_version']} 
                          value={selectedNode.execution.self_healing?.healing_strategy || ''}
                          onChange={(val) => updateNodeExecution(selectedNode.id, { 
                            self_healing: { ...selectedNode.execution.self_healing!, healing_strategy: val as any } 
                          })}
                        />
                      </>
                    )}
                  </div>
                </div>

                {(selectedNode.type === 'ai_task' || selectedNode.type === 'api_call') && (
                  <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Retry Policy</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <PropertyField 
                        label="Max Attempts" 
                        type="number" 
                        value={selectedNode.config.retry?.max_attempts || 3} 
                        onChange={(val) => updateNodeConfig(selectedNode.id, { 
                          retry: { 
                            on_fail: 'escalate',
                            ...selectedNode.config.retry, 
                            max_attempts: parseInt(val) || 1 
                          } 
                        })}
                      />
                      <PropertySelect 
                        label="On Failure" 
                        options={['escalate', 'fallback', 'terminate']} 
                        value={selectedNode.config.retry?.on_fail || 'escalate'}
                        onChange={(val) => updateNodeConfig(selectedNode.id, { 
                          retry: { 
                            max_attempts: 3,
                            ...selectedNode.config.retry, 
                            on_fail: val 
                          } 
                        })}
                      />
                    </div>
                    {selectedNode.config.retry?.on_fail === 'fallback' && (
                      <PropertySelect 
                        label="Fallback Node" 
                        options={['', ...workflow.nodes.filter(n => n.id !== selectedNode.id).map(n => n.id)]} 
                        value={selectedNode.config.retry?.fallback_node_id || ''}
                        onChange={(val) => updateNodeConfig(selectedNode.id, { 
                          retry: { 
                            ...selectedNode.config.retry, 
                            fallback_node_id: val 
                          } 
                        })}
                      />
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Execution Layer</h3>
                  <div className="space-y-4">
                    <PropertySelect 
                      label="Execution Type" 
                      options={['agent_processing', 'system_action', 'human_task']} 
                      value={selectedNode.execution.execution_type} 
                      onChange={(val) => updateNodeExecution(selectedNode.id, { execution_type: val as any })} 
                    />
                    <PropertySelect 
                      label="Department Context" 
                      options={['CLAIMS', 'POLICY_ISSUANCE', 'KYC_ONBOARDING', 'UNDERWRITING', 'SYSTEM', 'FINANCE']} 
                      value={selectedNode.execution.department} 
                      onChange={(val) => updateNodeExecution(selectedNode.id, { department: val as any })} 
                    />
                    <PropertyField 
                      label="Consumes Event" 
                      value={selectedNode.execution.consumes_event || ''} 
                      onChange={(val) => updateNodeExecution(selectedNode.id, { consumes_event: val })} 
                    />
                    <PropertyField 
                      label="Produces Event" 
                      value={selectedNode.execution.produces_event} 
                      onChange={(val) => updateNodeExecution(selectedNode.id, { produces_event: val })} 
                    />
                    <div className="pt-2">
                      <PropertySelect 
                        label="Trigger Workflow (Optional)" 
                        options={['', ...allWorkflows.filter(w => w.workflow_id !== workflow.workflow_id).map(w => w.workflow_id)]} 
                        value={selectedNode.config.workflow_ref || ''}
                        onChange={(val) => updateNodeConfig(selectedNode.id, { workflow_ref: val })}
                      />
                      <p className="text-[9px] text-on-surface-variant/40 mt-1 italic leading-tight">
                        Automatically triggers the selected workflow upon completion of this node.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Writes (Metadata Keys)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.execution.writes.map((field, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-surface-container-highest px-2 py-1 rounded-sm text-[9px] font-mono">
                            <span>{field}</span>
                            <button onClick={() => {
                              const newWrites = selectedNode.execution.writes.filter((_, i) => i !== idx);
                              updateNodeExecution(selectedNode.id, { writes: newWrites });
                            }} className="text-on-surface-variant hover:text-error">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const field = prompt('Enter metadata field to write:');
                            if (field) {
                              updateNodeExecution(selectedNode.id, { writes: [...selectedNode.execution.writes, field] });
                            }
                          }}
                          className="px-2 py-1 border border-dashed border-outline-variant/20 rounded-sm text-[9px] text-primary hover:bg-primary/5"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant/10">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">Data Flow (Context)</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-on-surface-variant">Input Mapping</span>
                      <button className="text-primary hover:underline">Edit Map</button>
                    </div>
                    <div className="p-3 bg-surface-container rounded-sm font-mono text-[9px] text-on-surface-variant/80">
                      {`context.data.documents -> input.docs`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Workflow</h3>
                  <h4 className="text-lg font-bold font-headline text-on-surface">General settings</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkflowSettings(false)}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-sm transition-all shrink-0"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6">
                <PropertyField 
                  label="Workflow Name" 
                  value={workflow.name} 
                  onChange={(val) => setWorkflow(prev => ({ ...prev, name: val }))} 
                />
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Description</label>
                  <textarea 
                    value={workflow.description}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-surface-container border border-outline-variant/10 rounded-sm p-3 text-[11px] text-on-surface focus:outline-none focus:border-primary/40 min-h-[80px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <PropertySelect 
                    label="Department" 
                    options={['CLAIMS', 'POLICY_ISSUANCE', 'KYC_ONBOARDING', 'UNDERWRITING', 'SYSTEM', 'FINANCE']} 
                    value={workflow.department} 
                    onChange={(val) => setWorkflow(prev => ({ ...prev, department: val as any }))} 
                  />
                  <PropertySelect 
                    label="Status" 
                    options={['Draft', 'Active', 'Idle', 'Running']} 
                    value={workflow.status} 
                    onChange={(val) => setWorkflow(prev => ({ ...prev, status: val as any }))} 
                  />
                </div>

                <PropertyField 
                  label="Version" 
                  value={workflow.version} 
                  onChange={(val) => setWorkflow(prev => ({ ...prev, version: val }))} 
                />

                <div className="pt-6 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-primary mb-4">
                    <Activity size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Workflow Stats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-surface-container rounded-sm border border-outline-variant/5">
                      <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Nodes</p>
                      <p className="text-xl font-black font-headline text-on-surface">{workflow.nodes.length}</p>
                    </div>
                    <div className="p-3 bg-surface-container rounded-sm border border-outline-variant/5">
                      <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Connections</p>
                      <p className="text-xl font-black font-headline text-on-surface">
                        {workflow.nodes.reduce((acc, node) => acc + node.next.length, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </aside>
        )}
      </div>

      {/* JSON View Modal */}
      {showJson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-full bg-surface-container-lowest border border-outline-variant/20 rounded-sm flex flex-col shadow-2xl">
            <div className="h-14 border-b border-outline-variant/10 flex items-center justify-between px-6 bg-surface-container-low">
              <div className="flex items-center gap-2">
                <Code size={18} className="text-primary" />
                <h3 className="text-sm font-black font-headline tracking-widest uppercase">Workflow Definition JSON</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowJson(false)}
                className="btn-icon-sm rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-surface-container-lowest custom-scrollbar">
              <pre className="text-[11px] font-mono text-primary leading-relaxed">
                {JSON.stringify(workflow, null, 2)}
              </pre>
            </div>
            <div className="h-14 border-t border-outline-variant/10 flex items-center justify-end px-6 bg-surface-container-low gap-3">
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(workflow, null, 2));
                }}
                className="btn btn-muted"
              >
                Copy to clipboard
              </button>
              <button 
                type="button"
                onClick={() => setShowJson(false)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getNodeColor = (type: NodeType) => {
  switch (type) {
    case 'input': return '#ba87ff';
    case 'ai_task': return '#34d399';
    case 'validation': return '#fbbf24';
    case 'decision': return '#60a5fa';
    case 'human_task': return '#f472b6';
    case 'api_call': return '#a78bfa';
    case 'delay': return '#94a3b8';
    case 'sub_workflow': return '#38bdf8';
    case 'fork': return '#fb923c';
    case 'join': return '#818cf8';
    case 'dmn': return '#2dd4bf';
    case 'transform': return '#f43f5e';
    case 'end': return '#ef4444';
    default: return '#ffffff';
  }
};

const PrimitiveItem = ({ icon: Icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-3 p-2 bg-surface-container rounded-sm border border-outline-variant/10 hover:border-primary/40 hover:bg-surface-container-highest transition-all group"
  >
    <div className="p-1.5 rounded-sm bg-surface-container-lowest text-on-surface-variant group-hover:text-primary transition-colors">
      <Icon size={12} />
    </div>
    <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
    <Plus size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

const PaletteItem = ({ icon: Icon, label, type, onAdd }: any) => (
  <button 
    onClick={() => onAdd(type, label)}
    className="w-full flex items-center gap-3 p-3 bg-surface-container rounded-sm border border-outline-variant/5 hover:border-primary/40 hover:bg-surface-container-highest transition-all group"
  >
    <div className="p-2 rounded-sm bg-surface-container-lowest text-on-surface-variant group-hover:text-primary transition-colors" style={{ color: getNodeColor(type) }}>
      <Icon size={14} />
    </div>
    <span className="text-[11px] font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
    <Plus size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

const PropertyField = ({ label, value, onChange, type = "text", readOnly }: any) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1.5">{label}</label>
    <input 
      type={type} 
      value={value || ''}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/40 ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  </div>
);

const PropertySelect = ({ label, options, value, onChange }: any) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1.5">{label}</label>
    <select 
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/40 appearance-none"
    >
      {options.map((opt: string) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

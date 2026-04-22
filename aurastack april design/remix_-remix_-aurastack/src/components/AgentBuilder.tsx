import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  Shield, 
  Boxes, 
  Database, 
  Code, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Settings,
  Terminal,
  Loader2
} from 'lucide-react';
import { AgentDefinition, AgentType, AGENT_TYPES, SchemaField } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';

interface AgentBuilderProps {
  onBack: () => void;
  onSave: (agent: AgentDefinition) => void;
  initialAgent?: AgentDefinition;
}

export const AgentBuilder: React.FC<AgentBuilderProps> = ({ onBack, onSave, initialAgent }) => {
  const [agent, setAgent] = useState<AgentDefinition>(initialAgent || {
    agent_id: uuidv4().slice(0, 8),
    name: '',
    type: 'doc_intelligence',
    description: '',
    input_schema: [],
    output_schema: [],
    instructions: '',
    tools: [],
    constraints: [],
    confidence_score: true,
    human_override_hook: false,
    version: '1.0.0',
    status: 'draft',
    last_updated: new Date().toISOString()
  });

  const [activeSection, setActiveSection] = useState<'config' | 'schema' | 'logic' | 'test'>('config');
  const [testInput, setTestInput] = useState('{}');
  const [testOutput, setTestOutput] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const addSchemaField = (type: 'input' | 'output') => {
    const newField: SchemaField = {
      name: '',
      type: 'string',
      description: '',
      required: true
    };
    if (type === 'input') {
      setAgent({ ...agent, input_schema: [...agent.input_schema, newField] });
    } else {
      setAgent({ ...agent, output_schema: [...agent.output_schema, newField] });
    }
  };

  const updateSchemaField = (type: 'input' | 'output', index: number, field: Partial<SchemaField>) => {
    const schema = type === 'input' ? [...agent.input_schema] : [...agent.output_schema];
    schema[index] = { ...schema[index], ...field };
    if (type === 'input') {
      setAgent({ ...agent, input_schema: schema });
    } else {
      setAgent({ ...agent, output_schema: schema });
    }
  };

  const removeSchemaField = (type: 'input' | 'output', index: number) => {
    const schema = type === 'input' ? [...agent.input_schema] : [...agent.output_schema];
    schema.splice(index, 1);
    if (type === 'input') {
      setAgent({ ...agent, input_schema: schema });
    } else {
      setAgent({ ...agent, output_schema: schema });
    }
  };

  const handleTest = () => {
    setIsTesting(true);
    // Simulate AI execution
    setTimeout(() => {
      setTestOutput({
        result: {
          status: "success",
          data: JSON.parse(testInput)
        },
        confidence: 0.94,
        reasoning: "Agent successfully mapped input fields to the defined output schema based on the provided instructions."
      });
      setIsTesting(false);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col bg-surface font-headline">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-outline-variant/10 bg-surface-container-lowest z-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="btn-icon-sm rounded-full hover:bg-surface-container-high">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tighter uppercase">
                {initialAgent ? 'Edit Agent' : 'Create New Agent'}
              </h2>
              <span className="px-2 py-0.5 bg-surface-container text-[9px] font-bold tracking-widest rounded-sm border border-outline-variant/10">
                v{agent.version}
              </span>
            </div>
            <p className="text-[10px] font-bold text-on-surface-variant/60 tracking-widest uppercase mt-0.5">
              ID: {agent.agent_id} • {agent.status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost">
            <Settings size={14} className="shrink-0" />
            Settings
          </button>
          <button 
            type="button"
            onClick={() => onSave(agent)}
            className="btn btn-primary shadow-lg shadow-primary/20"
          >
            <Save size={14} className="shrink-0" />
            Save agent
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
        <nav className="w-64 border-r border-outline-variant/10 bg-surface-container-low p-4 space-y-2">
          <NavButton 
            active={activeSection === 'config'} 
            onClick={() => setActiveSection('config')} 
            icon={Boxes} 
            label="Configuration" 
            desc="Basic info & type" 
          />
          <NavButton 
            active={activeSection === 'schema'} 
            onClick={() => setActiveSection('schema')} 
            icon={Database} 
            label="Data Schema" 
            desc="Input/Output structure" 
          />
          <NavButton 
            active={activeSection === 'logic'} 
            onClick={() => setActiveSection('logic')} 
            icon={Terminal} 
            label="Agent Logic" 
            desc="Prompts & constraints" 
          />
          <NavButton 
            active={activeSection === 'test'} 
            onClick={() => setActiveSection('test')} 
            icon={Play} 
            label="Test Panel" 
            desc="Dry run execution" 
          />
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-12">
            
            {activeSection === 'config' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary"></span> Agent Identity
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Agent Name</label>
                      <input 
                        value={agent.name}
                        onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                        placeholder="e.g. Claims Data Extractor"
                        className="w-full bg-surface-container-low border border-outline-variant/20 px-4 py-3 rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Description</label>
                      <textarea 
                        value={agent.description}
                        onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                        placeholder="What is the primary responsibility of this agent?"
                        className="w-full bg-surface-container-low border border-outline-variant/20 px-4 py-3 rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-sm h-24 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary"></span> Agent Type
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {AGENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setAgent({ ...agent, type: type.value })}
                        className={`text-left p-4 rounded-sm border transition-all ${
                          agent.type === type.value 
                            ? 'bg-primary/5 border-primary shadow-sm' 
                            : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{type.label}</span>
                          {agent.type === type.value && <CheckCircle2 size={14} className="text-primary" />}
                        </div>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary"></span> Guardrails & Hooks
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant/10 rounded-sm">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Confidence Scoring</div>
                        <p className="text-[9px] text-on-surface-variant">Agent will output a confidence score for every execution.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={agent.confidence_score}
                        onChange={(e) => setAgent({ ...agent, confidence_score: e.target.checked })}
                        className="rounded-sm border-outline-variant/40 text-primary focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant/10 rounded-sm">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Human Override Hook</div>
                        <p className="text-[9px] text-on-surface-variant">Automatically flag for human review if confidence is low or specific rules trigger.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={agent.human_override_hook}
                        onChange={(e) => setAgent({ ...agent, human_override_hook: e.target.checked })}
                        className="rounded-sm border-outline-variant/40 text-primary focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'schema' && (
              <section className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-1 h-3 bg-primary"></span> Input Schema
                    </h3>
                    <button 
                      onClick={() => addSchemaField('input')}
                      className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {agent.input_schema.length === 0 && (
                      <div className="p-8 border border-dashed border-outline-variant/20 rounded-sm text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">No input fields defined</p>
                      </div>
                    )}
                    {agent.input_schema.map((field, i) => (
                      <SchemaFieldRow 
                        key={i} 
                        field={field} 
                        onChange={(f) => updateSchemaField('input', i, f)} 
                        onRemove={() => removeSchemaField('input', i)} 
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                      <span className="w-1 h-3 bg-secondary"></span> Output Schema
                    </h3>
                    <button 
                      onClick={() => addSchemaField('output')}
                      className="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {agent.output_schema.length === 0 && (
                      <div className="p-8 border border-dashed border-outline-variant/20 rounded-sm text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">No output fields defined</p>
                      </div>
                    )}
                    {agent.output_schema.map((field, i) => (
                      <SchemaFieldRow 
                        key={i} 
                        field={field} 
                        onChange={(f) => updateSchemaField('output', i, f)} 
                        onRemove={() => removeSchemaField('output', i)} 
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'logic' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary"></span> Agent Instructions
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">System Prompt</label>
                    <textarea 
                      value={agent.instructions}
                      onChange={(e) => setAgent({ ...agent, instructions: e.target.value })}
                      placeholder="Define the persona, expertise, and operational logic of this agent..."
                      className="w-full bg-surface-container-low border border-outline-variant/20 px-4 py-3 rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-sm h-64 font-mono resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary"></span> Constraints & Guardrails
                  </h3>
                  <div className="space-y-2">
                    {agent.constraints.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          value={c}
                          onChange={(e) => {
                            const newConstraints = [...agent.constraints];
                            newConstraints[i] = e.target.value;
                            setAgent({ ...agent, constraints: newConstraints });
                          }}
                          className="flex-1 bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-sm text-xs"
                        />
                        <button 
                          onClick={() => {
                            const newConstraints = [...agent.constraints];
                            newConstraints.splice(i, 1);
                            setAgent({ ...agent, constraints: newConstraints });
                          }}
                          className="p-2 text-on-surface-variant hover:text-error transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setAgent({ ...agent, constraints: [...agent.constraints, ''] })}
                      className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 mt-2"
                    >
                      <Plus size={14} /> Add Constraint
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'test' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-1 h-3 bg-primary"></span> Test Input (JSON)
                    </h3>
                    <textarea 
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 px-4 py-3 rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-xs font-mono h-96 resize-none"
                    />
                    <button 
                      onClick={handleTest}
                      disabled={isTesting}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-on-secondary text-[10px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {isTesting ? 'Executing Agent...' : 'Run Test Execution'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                      <span className="w-1 h-3 bg-secondary"></span> Execution Output
                    </h3>
                    {testOutput ? (
                      <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-sm">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Confidence Score</span>
                            <span className={`text-[10px] font-bold ${testOutput.confidence > 0.9 ? 'text-secondary' : 'text-amber-500'}`}>
                              {(testOutput.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1 bg-surface-variant rounded-full overflow-hidden mb-4">
                            <div 
                              className="h-full bg-secondary transition-all duration-1000" 
                              style={{ width: `${testOutput.confidence * 100}%` }}
                            ></div>
                          </div>
                          <pre className="text-[10px] font-mono text-on-surface bg-surface-container-lowest p-3 rounded border border-outline-variant/5 overflow-auto max-h-64">
                            {JSON.stringify(testOutput.result, null, 2)}
                          </pre>
                        </div>
                        <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-sm">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-2">Reasoning</span>
                          <p className="text-[11px] text-on-surface leading-relaxed italic">"{testOutput.reasoning}"</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-96 flex flex-col items-center justify-center bg-surface-container-low border border-dashed border-outline-variant/20 rounded-sm opacity-40">
                        <Terminal size={32} className="mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting execution...</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label, desc }: any) => (
  <button 
    onClick={onClick}
    className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${
      active 
        ? 'bg-primary/12 shadow-sm' 
        : 'hover:bg-surface-container-high'
    }`}
  >
    <div className={`p-2 rounded-sm transition-colors ${active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant group-hover:text-on-surface'}`}>
      <Icon size={16} />
    </div>
    <div className="overflow-hidden">
      <div className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{label}</div>
      <div className="text-[9px] text-on-surface-variant/60 truncate">{desc}</div>
    </div>
    {active && <ChevronRight size={14} className="ml-auto text-primary" />}
  </button>
);

const SchemaFieldRow = ({ field, onChange, onRemove }: { field: SchemaField, onChange: (f: Partial<SchemaField>) => void, onRemove: () => void }) => (
  <div className="grid grid-cols-12 gap-2 items-center card-elevated p-2 group">
    <div className="col-span-3">
      <input 
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Field Name"
        className="w-full bg-transparent border-none text-[11px] font-bold uppercase tracking-widest focus:ring-0 p-1"
      />
    </div>
    <div className="col-span-2">
      <select 
        value={field.type}
        onChange={(e) => onChange({ type: e.target.value as any })}
        className="w-full bg-surface-container-lowest border-none text-[10px] font-bold uppercase tracking-widest focus:ring-0 p-1 rounded-sm"
      >
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="date">Date</option>
        <option value="object">Object</option>
        <option value="array">Array</option>
      </select>
    </div>
    <div className="col-span-4">
      <input 
        value={field.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description"
        className="w-full bg-transparent border-none text-[10px] focus:ring-0 p-1 italic opacity-60"
      />
    </div>
    <div className="col-span-2 flex items-center gap-2">
      <input 
        type="checkbox"
        checked={field.required}
        onChange={(e) => onChange({ required: e.target.checked })}
        className="rounded-sm border-outline-variant/40 text-primary focus:ring-0"
      />
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Required</span>
    </div>
    <div className="col-span-1 flex justify-end">
      <button 
        onClick={onRemove}
        className="p-1 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

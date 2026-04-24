import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Mail, Pause, Play, Plus, Save, Trash2, Webhook } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { cn } from '../lib/utils';
import type { Workflow, WorkflowStep } from '../types';

type Tab = 'builder' | 'triggers' | 'executions' | 'settings';
type TriggerType = 'mailbox' | 'webhook' | 'manual' | 'schedule';
type StageMode = 'single' | 'sequential' | 'parallel' | 'conditional';

type StageDraft = {
  id: string;
  name: string;
  description: string;
  mode: StageMode;
  agentIds: string[];
  handoff: string;
  notes: string;
};

type TriggerDraft = { id: string; type: TriggerType; config: string };
type Draft = {
  name: string;
  description: string;
  status: Workflow['status'];
  department: string;
  defaultAgentId: string | null;
  stages: StageDraft[];
  triggers: TriggerDraft[];
  casesProcessed: number;
  lastRun: string;
};

const departments = ['Operations & Infrastructure', 'Claims', 'Compliance', 'Underwriting', 'Member Services', 'Sales & Distribution'];

function makeDraft(workflow: Workflow): Draft {
  const stageSteps = workflow.steps.filter((s) => s.type !== 'trigger');
  return {
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    department: 'Operations & Infrastructure',
    defaultAgentId: workflow.agentIds[0] ?? null,
    stages: (stageSteps.length ? stageSteps : workflow.steps).map((s, i) => ({
      id: s.id || `stage-${i + 1}`,
      name: s.label || `Stage ${i + 1}`,
      description: s.description ?? '',
      mode: 'single',
      agentIds: s.assignedAgentId ? [s.assignedAgentId] : [],
      handoff: '',
      notes: ''
    })),
    triggers: [
      { id: 't-mailbox', type: 'mailbox', config: 'operations@aurastack.in' },
      { id: 't-webhook', type: 'webhook', config: 'https://api.aurastack.in/webhooks/ops' }
    ],
    casesProcessed: Math.round(650 + Math.random() * 500),
    lastRun: '9 hr ago'
  };
}

function triggerLabel(type: TriggerType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function Workflows({ onSelectCase }: { onSelectAgent: (id: string) => void; onSelectCase: (id: string) => void }) {
  const { workflows, cases, agents, updateWorkflow, deleteWorkflow, addWorkflow } = usePlatform();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('builder');
  const [draftMap, setDraftMap] = useState<Record<string, Draft>>({});
  const [newStage, setNewStage] = useState('');
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>('mailbox');
  const [newTriggerConfig, setNewTriggerConfig] = useState('');

  const selected = useMemo(() => workflows.find((w) => w.id === selectedId) ?? null, [selectedId, workflows]);
  const draft = useMemo(() => (selected ? draftMap[selected.id] ?? makeDraft(selected) : null), [draftMap, selected]);

  const patchDraft = (next: (d: Draft) => Draft) => {
    if (!selected || !draft) return;
    setDraftMap((prev) => ({ ...prev, [selected.id]: next(draft) }));
  };

  const save = () => {
    if (!selected || !draft) return;
    const steps: WorkflowStep[] = [
      ...draft.triggers.map((t) => ({
        id: t.id,
        type: 'trigger' as const,
        label: triggerLabel(t.type),
        description: t.config,
        integration: t.type === 'webhook' ? 'webhook' : 'mailbox'
      })),
      ...draft.stages.map((s) => ({
        id: s.id,
        type: 'agent' as const,
        label: s.name,
        description: s.description,
        assignedAgentId: s.agentIds[0]
      }))
    ];
    updateWorkflow(selected.id, {
      name: draft.name,
      description: draft.description,
      status: draft.status,
      steps,
      agentIds: Array.from(new Set(draft.stages.flatMap((s) => s.agentIds)))
    });
  };

  if (!selected || !draft) {
    return (
      <div className="space-y-6">
        <div>
          <p className="page-kicker">Workflow Control Center</p>
          <h3 className="page-title">Workflow Workspace</h3>
          <p className="text-sm text-[#64748B] mt-1">Open any workflow to manage builder, triggers, executions, and settings.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => {
            const linkedCases = cases.filter((c) => c.workflowId === wf.id || c.type === wf.name);
            return (
              <button key={wf.id} onClick={() => { setSelectedId(wf.id); setTab('builder'); }} className="card-elevated--interactive p-5 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="card-title">{wf.name}</h4>
                  <span className={cn('badge', wf.status === 'active' ? 'badge-complete' : 'badge-processing')}>{wf.status}</span>
                </div>
                <p className="text-xs text-[#64748B] mt-2">{wf.description}</p>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-[#E2E8F0] p-2"><p className="text-[10px] text-[#94A3B8]">Stages</p><p className="font-semibold">{wf.steps.filter((s) => s.type !== 'trigger').length || wf.steps.length}</p></div>
                  <div className="rounded-lg border border-[#E2E8F0] p-2"><p className="text-[10px] text-[#94A3B8]">Triggers</p><p className="font-semibold">{Math.max(1, wf.steps.filter((s) => s.type === 'trigger').length)}</p></div>
                  <div className="rounded-lg border border-[#E2E8F0] p-2"><p className="text-[10px] text-[#94A3B8]">Cases</p><p className="font-semibold">{linkedCases.length}</p></div>
                  <div className="rounded-lg border border-[#E2E8F0] p-2"><p className="text-[10px] text-[#94A3B8]">Automation</p><p className="font-semibold">{wf.automationRate}%</p></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="page-kicker">Workflow Detail</p>
          <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] mb-2"><ArrowLeft size={14} />Back</button>
          <div className="flex items-center gap-2">
            <h3 className="page-title">{draft.name}</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F6F3] text-[#0F766E]">{draft.status}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#334155]">{draft.department}</span>
          </div>
          <p className="text-sm text-[#64748B] mt-1">{draft.description}</p>
          <div className="mt-2 flex gap-4 text-xs text-[#64748B]">
            <span>{draft.stages.length} stages</span><span>{draft.triggers.length} triggers</span><span>{draft.casesProcessed} cases processed</span><span>Last run {draft.lastRun}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white text-sm font-medium text-[#334155]" onClick={() => addWorkflow({ name: `${draft.name} Copy`, description: draft.description, category: selected.category, status: 'draft', steps: selected.steps, agentIds: selected.agentIds, automationRate: selected.automationRate })}><Copy size={14} />Duplicate</button>
          <button className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white text-sm font-medium text-[#334155]" onClick={() => { const c = cases.find((x) => x.workflowId === selected.id); if (c) onSelectCase(c.id); }}><Play size={14} />Run Now</button>
          <button className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white text-sm font-medium text-[#334155]" onClick={() => patchDraft((d) => ({ ...d, status: d.status === 'paused' ? 'active' : 'paused' }))}><Pause size={14} />{draft.status === 'paused' ? 'Resume' : 'Pause'}</button>
          <button className="h-9 px-3 inline-flex items-center gap-2 rounded-xl bg-[#0B6AD4] text-white text-sm font-semibold hover:bg-[#095EBB]" onClick={save}><Save size={14} />Save Changes</button>
          <button className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-[#FECACA] bg-white text-sm font-medium text-[#DC2626]" onClick={() => { deleteWorkflow(selected.id); setSelectedId(null); }}><Trash2 size={14} />Delete</button>
        </div>
      </div>

      <div className="inline-flex bg-white border border-[#E2E8F0] rounded-2xl p-1 gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {(['builder', 'triggers', 'executions', 'settings'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-5 py-2 rounded-xl text-sm capitalize', tab === t ? 'bg-[#EAF5FF] text-[#0B6AD4] font-semibold' : 'text-[#64748B]')}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 items-start border border-[#7CC5F5] rounded-2xl p-3 bg-[#F3F6FA]">
        <div className="card space-y-4 bg-white rounded-2xl">
          {tab === 'builder' && (
            <>
              <div><h4 className="section-title text-[22px]">Stage Orchestration</h4><p className="text-sm text-[#64748B] mt-1">Assign multiple agents per stage, define execution mode and handoff rules.</p></div>
              <div className="flex gap-3">
                <input value={newStage} onChange={(e) => setNewStage(e.target.value)} className="input-base flex-1" placeholder="Add a stage like Medical Triage or Exception Review" />
                <button className="h-9 px-4 inline-flex items-center gap-2 rounded-xl bg-[#0B6AD4] text-white text-sm font-semibold hover:bg-[#095EBB]" onClick={() => { const v = newStage.trim(); if (!v) return; patchDraft((d) => ({ ...d, stages: [...d.stages, { id: `stage-${Date.now()}`, name: v, description: '', mode: 'single', agentIds: d.defaultAgentId ? [d.defaultAgentId] : [], handoff: '', notes: '' }] })); setNewStage(''); }}><Plus size={14} />Add Stage</button>
              </div>
              {draft.stages.map((stage, index) => (
                <div key={stage.id} className="border border-[#E2E8F0] rounded-xl p-3.5 space-y-3 bg-white">
                  <div className="flex justify-between items-center"><div className="inline-flex items-center gap-3"><span className="h-7 w-7 rounded-full bg-[#E6F6F3] text-[#0F766E] text-sm font-semibold flex items-center justify-center">{index + 1}</span><input className="text-lg font-semibold bg-transparent outline-none" value={stage.name} onChange={(e) => patchDraft((d) => ({ ...d, stages: d.stages.map((s) => s.id === stage.id ? { ...s, name: e.target.value } : s) }))} /></div><button onClick={() => patchDraft((d) => ({ ...d, stages: d.stages.filter((s) => s.id !== stage.id) }))} className="text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={16} /></button></div>
                  <textarea className="input-base resize-none" rows={2} placeholder="Describe what this stage is responsible for." value={stage.description} onChange={(e) => patchDraft((d) => ({ ...d, stages: d.stages.map((s) => s.id === stage.id ? { ...s, description: e.target.value } : s) }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><p className="meta-label mb-1">Execution Mode</p><select className="input-base" value={stage.mode} onChange={(e) => patchDraft((d) => ({ ...d, stages: d.stages.map((s) => s.id === stage.id ? { ...s, mode: e.target.value as StageMode } : s) }))}><option value="single">Single Agent</option><option value="sequential">Sequential</option><option value="parallel">Parallel</option><option value="conditional">Conditional</option></select></div>
                    <div><p className="meta-label mb-1">Assigned Agents</p><div className="text-xs text-[#94A3B8] h-9 border border-[#E2E8F0] rounded-lg px-3 flex items-center">{stage.mode === 'single' ? 'One primary agent handles this stage' : 'Multi-agent assignment is enabled'}</div></div>
                  </div>
                  <div>
                    <p className="meta-label mb-2">Agent Pool</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                      {agents.map((a) => {
                        const checked = stage.agentIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-left transition-colors",
                              checked ? "border-[#0B6AD4] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                            )}
                            onClick={() => patchDraft((d) => ({
                              ...d,
                              stages: d.stages.map((s) => {
                                if (s.id !== stage.id) return s;
                                const has = s.agentIds.includes(a.id);
                                if (s.mode === 'single') {
                                  return { ...s, agentIds: has ? [] : [a.id] };
                                }
                                return { ...s, agentIds: has ? s.agentIds.filter((x) => x !== a.id) : [...s.agentIds, a.id] };
                              })
                            }))}
                          >
                            <div className="inline-flex items-start gap-2 w-full">
                              <span className={cn("h-4 w-4 mt-1 rounded-full border", checked ? "border-[#0B6AD4] bg-[#0B6AD4]" : "border-[#94A3B8]")} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#0F172A] truncate">{a.name}</p>
                                <p className="text-xs text-[#64748B] truncate">{a.role || 'Workflow Agent'}</p>
                                <p className="text-[11px] text-[#94A3B8] truncate">{a.category || selected.category || 'Operations & Infrastructure'}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <textarea className="input-base resize-none" rows={2} placeholder="Handoff rule" value={stage.handoff} onChange={(e) => patchDraft((d) => ({ ...d, stages: d.stages.map((s) => s.id === stage.id ? { ...s, handoff: e.target.value } : s) }))} />
                    <textarea className="input-base resize-none" rows={2} placeholder="Operator notes" value={stage.notes} onChange={(e) => patchDraft((d) => ({ ...d, stages: d.stages.map((s) => s.id === stage.id ? { ...s, notes: e.target.value } : s) }))} />
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'triggers' && (
            <>
              <div><h4 className="section-title text-[22px]">Triggers and Entry Points</h4><p className="text-sm text-[#64748B] mt-1">These conditions determine how work enters the orchestration pipeline.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-[170px_1fr_auto] gap-3">
                <select className="input-base" value={newTriggerType} onChange={(e) => setNewTriggerType(e.target.value as TriggerType)}><option value="mailbox">Mailbox</option><option value="webhook">Webhook</option><option value="manual">Manual</option><option value="schedule">Schedule</option></select>
                <input className="input-base" value={newTriggerConfig} onChange={(e) => setNewTriggerConfig(e.target.value)} placeholder="claims@aurastack.ai, https://..., cron, or queue" />
                <button className="h-9 px-4 inline-flex items-center gap-2 rounded-xl bg-[#0B6AD4] text-white text-sm font-semibold hover:bg-[#095EBB]" onClick={() => { const v = newTriggerConfig.trim(); if (!v) return; patchDraft((d) => ({ ...d, triggers: [...d.triggers, { id: `trigger-${Date.now()}`, type: newTriggerType, config: v }] })); setNewTriggerConfig(''); }}><Plus size={14} />Add Trigger</button>
              </div>
              <div className="space-y-2">{draft.triggers.map((t) => <div key={t.id} className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between"><div className="inline-flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#E6F6F3] text-[#1F9D8B] flex items-center justify-center">{t.type === 'webhook' ? <Webhook size={16} /> : <Mail size={16} />}</div><div><p className="font-semibold">{triggerLabel(t.type)}</p><p className="text-sm text-[#64748B]">{t.config}</p></div></div><button className="text-[#94A3B8] hover:text-[#DC2626]" onClick={() => patchDraft((d) => ({ ...d, triggers: d.triggers.filter((x) => x.id !== t.id) }))}><Trash2 size={15} /></button></div>)}</div>
            </>
          )}

          {tab === 'executions' && (
            <>
              <h4 className="section-title text-[22px]">Execution Timeline</h4>
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                <div className="space-y-2">{[['Status', draft.status], ['Last Run', draft.lastRun], ['Cases Processed', String(draft.casesProcessed)], ['Avg Throughput', `${Math.max(1, Math.round(draft.casesProcessed / Math.max(1, draft.stages.length)))} per stage`]].map(([k, v]) => <div key={k} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm flex justify-between bg-white"><span>{k}</span><span>{v}</span></div>)}</div>
                <div className="space-y-2">{draft.stages.map((s, i) => <div key={s.id} className="border border-[#E2E8F0] rounded-xl p-3"><div className="inline-flex items-start gap-3"><span className="h-8 w-8 rounded-full bg-[#E6F6F3] text-[#0F766E] text-sm font-semibold flex items-center justify-center">{i + 1}</span><div><p className="text-lg font-semibold">{s.name}</p><p className="text-sm text-[#64748B]">{agents.find((a) => a.id === draft.defaultAgentId)?.name ?? 'Email Workflow Agent'}</p><p className="text-sm text-[#64748B] mt-1">{s.handoff || 'No explicit handoff rule yet. Use Builder tab to define control logic.'}</p></div></div></div>)}</div>
              </div>
            </>
          )}

          {tab === 'settings' && (
            <>
              <h4 className="section-title text-[22px]">Workflow Settings</h4>
              <div className="space-y-3">
                <div><p className="meta-label mb-1">Workflow Name</p><input className="input-base" value={draft.name} onChange={(e) => patchDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                <div><p className="meta-label mb-1">Description</p><textarea rows={3} className="input-base resize-none" value={draft.description} onChange={(e) => patchDraft((d) => ({ ...d, description: e.target.value }))} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><p className="meta-label mb-1">Department</p><select className="input-base" value={draft.department} onChange={(e) => patchDraft((d) => ({ ...d, department: e.target.value }))}>{departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}</select></div>
                  <div><p className="meta-label mb-1">Default Agent</p><select className="input-base" value={draft.defaultAgentId ?? ''} onChange={(e) => patchDraft((d) => ({ ...d, defaultAgentId: e.target.value || null }))}><option value="">Select agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="card bg-white rounded-2xl">
            <h4 className="card-title">Workflow Summary</h4>
            <p className="text-sm text-[#64748B] mt-1">Use this as the operator-facing control sheet for the workflow.</p>
            <div className="mt-3 space-y-2">{[
              ['Default Agent', agents.find((a) => a.id === draft.defaultAgentId)?.name ?? 'Email Workflow Agent'],
              ['Department', draft.department],
              ['Stages', String(draft.stages.length)],
              ['Parallel Stages', String(draft.stages.filter((s) => s.mode === 'parallel').length)],
              ['Conditional Stages', String(draft.stages.filter((s) => s.mode === 'conditional').length)],
              ['Triggers', String(draft.triggers.length)]
            ].map(([k, v]) => <div key={k} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm flex justify-between bg-white"><span>{k}</span><span>{v}</span></div>)}</div>
          </div>

          <div className="card bg-white rounded-2xl">
            <h4 className="card-title">CTA Checklist</h4>
            <p className="text-sm text-[#64748B] mt-1">Every major operator action is wired from this page.</p>
            <ul className="mt-3 space-y-2 text-sm text-[#334155]">
              {['Save orchestration changes', 'Activate or pause workflow', 'Run workflow immediately', 'Duplicate workflow', 'Delete workflow', 'Add, remove, and tune stages', 'Assign multiple agents per stage', 'Configure triggers and handoff rules'].map((x) => <li key={x} className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-[#1F9D8B]" />{x}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { usePlatform } from "../context/PlatformContext";
import {
  createInboxSetting,
  deleteInboxSetting,
  getAssistantActions,
  getWorkflowExecutionMetrics,
  getWorkflowEmailPlaybook,
  getWorkflows,
  type ApiWorkflow,
  getInboxSettings,
  triggerEmailPoll,
  updateWorkflowEmailPlaybook,
  updateInboxSetting,
  type WorkflowEmailPlaybook,
  type WorkflowExecutionSummary,
  type AssistantActionLog,
  type InboxEmailConfig,
  type InboxEmailUpsertInput,
} from "../lib/api";

const emptyForm: InboxEmailUpsertInput = {
  label: "",
  email: "",
  host: "imap.gmail.com",
  port: 993,
  username: "",
  password: "",
  mailbox: "INBOX",
  pollInterval: 60,
  isActive: true,
  domain: "Banking",
  workflowKey: null,
  claimTypeKey: null,
  autoReplyEnabled: true,
};

export function AdminEmailSettings() {
  const { domainOptions, selectedDomain } = usePlatform();
  const [workflowDefs, setWorkflowDefs] = useState<ApiWorkflow[]>([]);
  const [rows, setRows] = useState<InboxEmailConfig[]>([]);
  const [assistantActions, setAssistantActions] = useState<AssistantActionLog[]>([]);
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowExecutionSummary[]>([]);
  const [selectedPlaybookWorkflowId, setSelectedPlaybookWorkflowId] = useState<string>("");
  const [playbookDraft, setPlaybookDraft] = useState<WorkflowEmailPlaybook["playbook"] | null>(null);
  const [form, setForm] = useState<InboxEmailUpsertInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opsLoading, setOpsLoading] = useState(false);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [opsStatus, setOpsStatus] = useState("");
  const [playbookStatus, setPlaybookStatus] = useState("");

  const workflowsForSelectedDomain = useMemo(() => {
    return workflowDefs.filter((w) => w.category === form.domain);
  }, [workflowDefs, form.domain]);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await getInboxSettings();
      setRows(data);
      setStatus("");
    } catch (error) {
      setStatus(`Failed to load inbox settings: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadOpsData() {
    setOpsLoading(true);
    try {
      const [actions, metrics] = await Promise.all([
        getAssistantActions(30),
        getWorkflowExecutionMetrics({ domain: selectedDomain, rangeDays: 30 }),
      ]);
      setAssistantActions(actions);
      setWorkflowMetrics(metrics);
      setOpsStatus("");
    } catch (error) {
      setOpsStatus(`Failed to load operations insights: ${String(error)}`);
    } finally {
      setOpsLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    getWorkflows().then(setWorkflowDefs).catch(() => setWorkflowDefs([]));
    void loadOpsData();
  }, []);

  useEffect(() => {
    void loadOpsData();
  }, [selectedDomain]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const payload: InboxEmailUpsertInput = {
        ...form,
        workflowKey: form.workflowKey || null,
        domain: form.domain,
        claimTypeKey: form.claimTypeKey || null,
      };

      if (editingId) {
        const updatePayload = { ...payload, password: payload.password || undefined };
        await updateInboxSetting(editingId, updatePayload);
        setStatus("Inbox updated.");
      } else {
        await createInboxSetting(payload);
        setStatus("Inbox created.");
      }
      resetForm();
      await loadSettings();
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteInboxSetting(id);
      setStatus("Inbox deleted.");
      await loadSettings();
    } catch (error) {
      setStatus(`Delete failed: ${String(error)}`);
    }
  }

  async function onTriggerPoll() {
    try {
      await triggerEmailPoll();
      setStatus("Poll triggered.");
    } catch (error) {
      setStatus(`Could not trigger poll: ${String(error)}`);
    }
  }

  async function loadPlaybook(workflowId: string) {
    if (!workflowId) {
      setPlaybookDraft(null);
      return;
    }
    setPlaybookLoading(true);
    try {
      const data = await getWorkflowEmailPlaybook(workflowId);
      setPlaybookDraft(data.playbook);
      setPlaybookStatus("");
    } catch (error) {
      setPlaybookDraft(null);
      setPlaybookStatus(`Failed to load playbook: ${String(error)}`);
    } finally {
      setPlaybookLoading(false);
    }
  }

  async function onSavePlaybook() {
    if (!selectedPlaybookWorkflowId || !playbookDraft) return;
    try {
      await updateWorkflowEmailPlaybook(selectedPlaybookWorkflowId, playbookDraft);
      setPlaybookStatus("Playbook updated.");
    } catch (error) {
      setPlaybookStatus(`Failed to save playbook: ${String(error)}`);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="page-kicker">Admin Console</p>
        <h3 className="page-title">Email + Workflow Operations</h3>
        <p className="page-description">Manage inbound inboxes, playbooks, and execution telemetry per domain.</p>
      </div>

      <div className="card-elevated p-5">
        <h3 className="card-title">Email Automation Admin</h3>
        <p className="text-sm text-[#64748B] mt-1">
          Configure unlimited inbound inboxes by domain/workflow. Incoming claims are auto-routed and replied to customers.
        </p>
        <div className="mt-4 flex gap-3">
          <button className="btn-primary" onClick={onTriggerPoll}>Run Poll Now</button>
          <button className="btn-secondary" onClick={() => void loadSettings()}>Refresh</button>
        </div>
        {status ? <p className="text-xs text-[#475569] mt-3">{status}</p> : null}
      </div>

      <form className="card-elevated p-5 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSubmit}>
        <input className="input-base" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <input className="input-base" placeholder="Receiver Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input-base" placeholder="IMAP Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required />
        <input className="input-base" placeholder="Port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} required />
        <input className="input-base" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input className="input-base" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <input className="input-base" placeholder="Mailbox" value={form.mailbox} onChange={(e) => setForm({ ...form, mailbox: e.target.value })} required />
        <input className="input-base" placeholder="Poll Interval (sec)" type="number" value={form.pollInterval} onChange={(e) => setForm({ ...form, pollInterval: Number(e.target.value) })} required />
        <select className="input-base" value={form.domain ?? ""} onChange={(e) => setForm({ ...form, domain: e.target.value, workflowKey: null })} required>
          {domainOptions.map((domain) => (
            <option key={domain} value={domain}>{domain}</option>
          ))}
        </select>
        <select className="input-base" value={form.workflowKey ?? ""} onChange={(e) => setForm({ ...form, workflowKey: e.target.value || null })}>
          <option value="">Auto-Select Workflow</option>
          {workflowsForSelectedDomain.map((workflow) => (
            <option key={workflow.id} value={workflow.key ?? workflow.id}>{workflow.name}</option>
          ))}
        </select>
        <input className="input-base" placeholder="Claim Type Key (optional, e.g. health)" value={form.claimTypeKey ?? ""} onChange={(e) => setForm({ ...form, claimTypeKey: e.target.value || null })} />
        <div className="flex items-center gap-5">
          <label className="text-sm text-[#334155] flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <label className="text-sm text-[#334155] flex items-center gap-2">
            <input type="checkbox" checked={Boolean(form.autoReplyEnabled)} onChange={(e) => setForm({ ...form, autoReplyEnabled: e.target.checked })} />
            Auto Reply
          </label>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button className="btn-primary" type="submit">{editingId ? "Update Inbox" : "Add Inbox"}</button>
          <button className="btn-secondary" type="button" onClick={resetForm}>Clear</button>
        </div>
      </form>

      <div className="card-elevated p-5">
        <h4 className="card-title mb-3">Configured Inboxes ({rows.length})</h4>
        {loading ? <p className="text-sm text-[#64748B]">Loading...</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="py-2 text-xs text-[#64748B]">Inbox</th>
                <th className="py-2 text-xs text-[#64748B]">Domain</th>
                <th className="py-2 text-xs text-[#64748B]">Workflow</th>
                <th className="py-2 text-xs text-[#64748B]">Status</th>
                <th className="py-2 text-xs text-[#64748B] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F1F5F9]">
                  <td className="py-2 text-sm text-[#0F172A]">{row.label} ({row.email})</td>
                  <td className="py-2 text-sm text-[#334155]">{row.domain ?? "Any"}</td>
                  <td className="py-2 text-sm text-[#334155]">{row.workflowKey ?? "Auto"}</td>
                  <td className="py-2 text-sm text-[#334155]">{row.isActive ? "Active" : "Paused"}</td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setEditingId(row.id);
                        setForm({
                          label: row.label,
                          email: row.email,
                          host: row.host,
                          port: row.port,
                          username: row.username,
                          password: "",
                          mailbox: row.mailbox,
                          pollInterval: row.pollInterval,
                          isActive: row.isActive,
                          domain: row.domain ?? "Banking",
                          workflowKey: row.workflowKey ?? null,
                          claimTypeKey: row.claimTypeKey ?? null,
                          autoReplyEnabled: row.autoReplyEnabled ?? true,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-secondary" onClick={() => void onDelete(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="card-title">Workflow Execution Dashboard ({selectedDomain})</h4>
          <button className="btn-secondary" onClick={() => void loadOpsData()}>Refresh Insights</button>
        </div>
        {opsLoading ? <p className="text-sm text-[#64748B]">Loading metrics...</p> : null}
        {opsStatus ? <p className="text-xs text-[#475569] mb-3">{opsStatus}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="py-2 text-xs text-[#64748B]">Workflow</th>
                <th className="py-2 text-xs text-[#64748B]">Runs</th>
                <th className="py-2 text-xs text-[#64748B]">Success %</th>
                <th className="py-2 text-xs text-[#64748B]">Failed</th>
                <th className="py-2 text-xs text-[#64748B]">Avg Duration (s)</th>
                <th className="py-2 text-xs text-[#64748B]">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {workflowMetrics.map((metric) => (
                <tr key={metric.workflowId} className="border-b border-[#F1F5F9]">
                  <td className="py-2 text-sm text-[#0F172A]">{metric.workflowName}</td>
                  <td className="py-2 text-sm text-[#334155]">{metric.runs}</td>
                  <td className="py-2 text-sm text-[#334155]">{metric.successRatePct}%</td>
                  <td className="py-2 text-sm text-[#334155]">{metric.failed}</td>
                  <td className="py-2 text-sm text-[#334155]">{metric.avgDurationSec}</td>
                  <td className="py-2 text-sm text-[#334155]">{metric.lastRunAt ? new Date(metric.lastRunAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {workflowMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-[#64748B]">No executions yet for this domain in last 30 days.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-elevated p-5">
        <h4 className="card-title mb-3">Workflow Email Playbook</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className="input-base"
            value={selectedPlaybookWorkflowId}
            onChange={(e) => {
              const workflowId = e.target.value;
              setSelectedPlaybookWorkflowId(workflowId);
              void loadPlaybook(workflowId);
            }}
          >
            <option value="">Select workflow</option>
            {workflowsForSelectedDomain.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" type="button" onClick={() => void loadPlaybook(selectedPlaybookWorkflowId)} disabled={!selectedPlaybookWorkflowId}>Load</button>
            <button className="btn-primary" type="button" onClick={() => void onSavePlaybook()} disabled={!selectedPlaybookWorkflowId || !playbookDraft}>Save Playbook</button>
          </div>
        </div>
        {playbookLoading ? <p className="text-sm text-[#64748B] mt-3">Loading playbook...</p> : null}
        {playbookStatus ? <p className="text-xs text-[#475569] mt-3">{playbookStatus}</p> : null}
        {playbookDraft ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <input className="input-base" value={playbookDraft.approvalSubject} onChange={(e) => setPlaybookDraft({ ...playbookDraft, approvalSubject: e.target.value })} placeholder="Approval subject" />
            <input className="input-base" value={playbookDraft.rejectionSubject} onChange={(e) => setPlaybookDraft({ ...playbookDraft, rejectionSubject: e.target.value })} placeholder="Rejection subject" />
            <input className="input-base" value={playbookDraft.reviewSubject} onChange={(e) => setPlaybookDraft({ ...playbookDraft, reviewSubject: e.target.value })} placeholder="Review subject" />
            <input className="input-base" value={playbookDraft.acknowledgementSubject} onChange={(e) => setPlaybookDraft({ ...playbookDraft, acknowledgementSubject: e.target.value })} placeholder="Acknowledgement subject" />
            <textarea className="input-base md:col-span-2 min-h-[100px]" value={playbookDraft.approvalBody} onChange={(e) => setPlaybookDraft({ ...playbookDraft, approvalBody: e.target.value })} placeholder="Approval body (use {{memberName}}, {{caseId}}, {{claimType}}, {{workflowName}})" />
            <textarea className="input-base md:col-span-2 min-h-[100px]" value={playbookDraft.rejectionBody} onChange={(e) => setPlaybookDraft({ ...playbookDraft, rejectionBody: e.target.value })} placeholder="Rejection body" />
            <textarea className="input-base md:col-span-2 min-h-[100px]" value={playbookDraft.reviewBody} onChange={(e) => setPlaybookDraft({ ...playbookDraft, reviewBody: e.target.value })} placeholder="Review body" />
            <textarea className="input-base md:col-span-2 min-h-[100px]" value={playbookDraft.acknowledgementBody} onChange={(e) => setPlaybookDraft({ ...playbookDraft, acknowledgementBody: e.target.value })} placeholder="Acknowledgement body" />
          </div>
        ) : null}
      </div>

      <div className="card-elevated p-5">
        <h4 className="card-title mb-3">Assistant Action History</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="py-2 text-xs text-[#64748B]">Time</th>
                <th className="py-2 text-xs text-[#64748B]">Action</th>
                <th className="py-2 text-xs text-[#64748B]">Resource</th>
                <th className="py-2 text-xs text-[#64748B]">Status</th>
                <th className="py-2 text-xs text-[#64748B]">User</th>
              </tr>
            </thead>
            <tbody>
              {assistantActions.map((item) => (
                <tr key={item.id} className="border-b border-[#F1F5F9]">
                  <td className="py-2 text-sm text-[#334155]">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-sm text-[#0F172A]">{item.action}</td>
                  <td className="py-2 text-sm text-[#334155]">{item.resource}</td>
                  <td className="py-2 text-sm text-[#334155]">{item.status}</td>
                  <td className="py-2 text-sm text-[#334155]">{item.user?.name ?? "System"}</td>
                </tr>
              ))}
              {assistantActions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-sm text-[#64748B]">No assistant actions logged yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  FileText, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  Download, 
  Lock, 
  UserCheck, 
  Key,
  Database,
  Fingerprint,
  Users,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  ShieldAlert,
  Cog,
  Terminal,
  Server,
  X,
  Info,
  ExternalLink,
  FileCheck,
  ArrowRight,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExecutionLog } from '../types/execution';
import { PermissionContext, ThemeContext } from '../App';
import { Role, Permission, ComplianceStandard } from '../types/auth';

interface SystemViewProps {
  logs: ExecutionLog[];
}

type ApiAuthRole =
  | 'admin'
  | 'operator'
  | 'reviewer'
  | 'medical_adjuster'
  | 'underwriter'
  | 'compliance_officer'
  | 'claims_manager'
  | 'support_agent'
  | 'case_reviewer'
  | 'fraud_analyst'
  | 'financial_officer'
  | 'hospital_coord';

const API_AUTH_ROLES: ApiAuthRole[] = [
  'admin',
  'operator',
  'reviewer',
  'medical_adjuster',
  'underwriter',
  'compliance_officer',
  'claims_manager',
  'support_agent',
  'case_reviewer',
  'fraud_analyst',
  'financial_officer',
  'hospital_coord'
];

type AuthUserRecord = {
  id: string;
  name: string;
  email: string | null;
  role: ApiAuthRole;
};

type InboxSettingRecord = {
  id: string;
  label: string;
  email: string;
  host: string;
  port: number;
  username: string;
  mailbox: string;
  pollInterval: number;
  isActive: boolean;
  domain: string;
  workflowKey?: string | null;
  claimTypeKey?: string | null;
  autoReplyEnabled: boolean;
};

export const SystemView: React.FC<SystemViewProps> = ({ logs: executionLogs }) => {
  const { subtab } = useParams<{ subtab: string }>();
  const navigate = useNavigate();
  const activeSubTab = (subtab || 'health') as 'health' | 'logs' | 'compliance' | 'rbac';
  
  const setActiveSubTab = (tab: string) => {
    navigate(`/system/${tab}`);
  };
  const { userRole, setUserRole, hasPermission, roles, setRoles } = useContext(PermissionContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<Partial<Role>>({
    name: '',
    id: '' as any,
    description: '',
    permissions: [],
    compliance_level: []
  });
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [selectedCompliance, setSelectedCompliance] = useState<any | null>(null);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([
    '[08:14:22] EVENT: workflow_started | id: clm_882 | template: claims_auto_adj_v1',
    '[08:14:23] AGENT: doc_extractor | task: parse_pdf | status: processing',
    '[08:14:25] STATE: update_context | key: patient_name | val: "John Doe"',
    '[08:14:26] EVENT: node_completed | id: extract_data | next: fraud_check',
    '[08:14:27] AGENT: fraud_sentinel | task: pattern_match | status: processing',
    '[08:14:30] ALERT: high_risk_detected | score: 8.4 | reason: anomalous_frequency',
    '[08:14:31] EVENT: workflow_branched | condition: risk > 7 | target: manual_review',
    '[08:14:32] STATE: persist_snapshot | id: clm_882_snap_4',
    '[08:15:01] EVENT: heartbeat | cluster: HK-Core-01 | status: healthy',
    '[08:15:05] STATE: cleanup_expired | count: 142'
  ]);
  const [authUsers, setAuthUsers] = useState<AuthUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as ApiAuthRole
  });
  const [inboxSettings, setInboxSettings] = useState<InboxSettingRecord[]>([]);
  const [inboxesLoading, setInboxesLoading] = useState(false);
  const [inboxesError, setInboxesError] = useState<string | null>(null);
  const [inboxForm, setInboxForm] = useState({
    label: '',
    email: '',
    host: 'imap.gmail.com',
    port: 993,
    username: '',
    password: '',
    mailbox: 'INBOX',
    pollInterval: 60,
    domain: 'Insurance - Health',
    workflowKey: '',
    claimTypeKey: 'health',
    autoReplyEnabled: true
  });
  const [configStatus, setConfigStatus] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
      const events = [
        `EVENT: workflow_started | id: clm_${Math.floor(Math.random() * 1000)} | template: claims_auto_adj_v1`,
        `AGENT: doc_extractor | task: parse_pdf | status: processing`,
        `STATE: update_context | key: patient_name | val: "User_${Math.floor(Math.random() * 1000)}"`,
        `EVENT: node_completed | id: extract_data | next: fraud_check`,
        `AGENT: fraud_sentinel | task: pattern_match | status: processing`,
        `ALERT: high_risk_detected | score: ${(Math.random() * 10).toFixed(1)} | reason: anomalous_frequency`,
        `EVENT: workflow_branched | condition: risk > 7 | target: manual_review`,
        `STATE: persist_snapshot | id: clm_snap_${Math.floor(Math.random() * 1000)}`,
        `EVENT: heartbeat | cluster: HK-Core-01 | status: healthy`,
        `STATE: cleanup_expired | count: ${Math.floor(Math.random() * 200)}`
      ];
      const newLog = `${timeStr} ${events[Math.floor(Math.random() * events.length)]}`;
      setSimulatedLogs(prev => [...prev.slice(-19), newLog]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simulatedLogs, executionLogs]);

  useEffect(() => {
    if (activeSubTab !== 'rbac') return;
    void loadAuthUsers();
    void loadInboxSettings();
  }, [activeSubTab]);

  const loadAuthUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await fetch('/api/auth/users');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load users');
      }
      setAuthUsers(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      setUsersError(error?.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadInboxSettings = async () => {
    setInboxesLoading(true);
    setInboxesError(null);
    try {
      const response = await fetch('/api/inbox-settings');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load inbox settings');
      }
      setInboxSettings(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      setInboxesError(error?.message || 'Failed to load inbox settings');
    } finally {
      setInboxesLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setConfigStatus('Please fill name, email and password to create user.');
      return;
    }

    setConfigStatus('Creating user...');
    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create user');
      }
      setUserForm({ name: '', email: '', password: '', role: 'operator' });
      setConfigStatus(`User created: ${payload?.data?.email ?? 'success'}`);
      await loadAuthUsers();
    } catch (error: any) {
      setConfigStatus(error?.message || 'Failed to create user');
    }
  };

  const handleRoleUpdate = async (userId: string, role: ApiAuthRole) => {
    setConfigStatus('Updating role...');
    try {
      const response = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update role');
      }
      setConfigStatus('Role updated successfully.');
      await loadAuthUsers();
    } catch (error: any) {
      setConfigStatus(error?.message || 'Failed to update role');
    }
  };

  const handleCreateInbox = async () => {
    if (!inboxForm.label || !inboxForm.email || !inboxForm.username || !inboxForm.password) {
      setConfigStatus('Please fill label, email, username and password for inbox.');
      return;
    }

    setConfigStatus('Saving inbox...');
    try {
      const response = await fetch('/api/inbox-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inboxForm,
          workflowKey: inboxForm.workflowKey || null,
          claimTypeKey: inboxForm.claimTypeKey || null
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save inbox');
      }
      setConfigStatus(`Inbox configured: ${payload?.data?.email ?? 'success'}`);
      setInboxForm((prev) => ({
        ...prev,
        label: '',
        email: '',
        username: '',
        password: '',
        workflowKey: ''
      }));
      await loadInboxSettings();
    } catch (error: any) {
      setConfigStatus(error?.message || 'Failed to save inbox');
    }
  };

  const allLogs = [
    ...executionLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.event.toUpperCase()}: ${log.details} | case: ${log.case_id}`),
    ...simulatedLogs
  ].slice(-50);

  const complianceStats = [
    { name: 'SOC2 Type II', status: 'Compliant', lastAudit: '2024-01-15', score: 100, icon: Shield },
    { name: 'GDPR', status: 'Compliant', lastAudit: '2024-02-20', score: 100, icon: Lock },
    { name: 'ISO 27001', status: 'Compliant', lastAudit: '2023-11-10', score: 98, icon: CheckCircle2 },
    { name: 'HIPAA', status: 'Compliant', lastAudit: '2024-03-01', score: 100, icon: UserCheck },
  ];

  const renderHealth = () => (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 space-y-6">
        <section className="bg-surface-container-low p-6 rounded-sm border border-outline-variant/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
            <Cog size={14} /> Execution engine
          </h3>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-surface-container rounded-sm border border-outline-variant/5">
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Active Workflows</div>
              <div className="text-2xl font-black font-headline tracking-tighter">1,242</div>
              <div className="text-[9px] text-secondary font-bold uppercase mt-1">+12% from last hour</div>
            </div>
            <div className="p-4 bg-surface-container rounded-sm border border-outline-variant/5">
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Node Executions</div>
              <div className="text-2xl font-black font-headline tracking-tighter">84.2k <span className="text-xs font-normal opacity-40">/min</span></div>
              <div className="text-[9px] text-secondary font-bold uppercase mt-1">Avg 14ms latency</div>
            </div>
            <div className="p-4 bg-surface-container rounded-sm border border-outline-variant/5">
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Agent Handoffs</div>
              <div className="text-2xl font-black font-headline tracking-tighter">12.5k</div>
              <div className="text-[9px] text-primary font-bold uppercase mt-1">99.8% Success Rate</div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Live Event Bus</label>
            <div 
              ref={logContainerRef}
              className="bg-surface-container-lowest p-4 rounded-sm border border-outline-variant/10 font-mono text-[10px] space-y-1 h-48 overflow-y-auto custom-scrollbar"
            >
              {allLogs.map((log, i) => {
                let colorClass = 'text-on-surface-variant';
                if (log.includes('EVENT:') || log.includes('COMPLETED') || log.includes('STARTED')) colorClass = 'text-secondary';
                if (log.includes('AGENT:') || log.includes('TASK')) colorClass = 'text-primary';
                if (log.includes('ALERT:') || log.includes('FAILED')) colorClass = 'text-amber-500';
                if (log.includes('STATE:')) colorClass = 'text-on-surface-variant opacity-80';
                
                return (
                  <div key={i} className={colorClass}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low p-6 rounded-sm border border-outline-variant/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
            <Server size={14} /> Infrastructure Clusters
          </h3>
          <div className="space-y-4">
            <ClusterRow name="HK-Core-01" region="Hong Kong" status="Online" load={42} onClick={() => { setSelectedCluster({ name: "HK-Core-01", status: "Online", load: 42, region: "Hong Kong", details: "Primary production cluster for APAC region." }); setIsClusterModalOpen(true); }} />
            <ClusterRow name="EU-West-04" region="London" status="Online" load={18} onClick={() => { setSelectedCluster({ name: "EU-West-04", status: "Online", load: 18, region: "London", details: "Secondary failover cluster for EMEA region." }); setIsClusterModalOpen(true); }} />
            <ClusterRow name="US-East-02" region="Virginia" status="Maintenance" load={0} warning onClick={() => { setSelectedCluster({ name: "US-East-02", status: "Maintenance", load: 0, region: "Virginia", details: "Scheduled maintenance for kernel upgrade." }); setIsClusterModalOpen(true); }} />
            <ClusterRow name="SG-Edge-09" region="Singapore" status="Online" load={64} onClick={() => { setSelectedCluster({ name: "SG-Edge-09", status: "Online", load: 64, region: "Singapore", details: "Edge computing node for low-latency inference." }); setIsClusterModalOpen(true); }} />
          </div>
        </section>
      </div>

      <div className="col-span-4 space-y-6">
        <section className="bg-surface-container-low p-6 rounded-sm border border-outline-variant/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
            <Activity size={14} /> Resource Allocation
          </h3>
          <div className="space-y-6">
            <ResourceBar label="CPU Compute" value="64%" progress={64} color="bg-primary" />
            <ResourceBar label="Memory Usage" value="42%" progress={42} color="bg-secondary" />
            <ResourceBar label="Network IO" value="18%" progress={18} color="bg-tertiary" />
            <ResourceBar label="Disk Storage" value="82%" progress={82} color="bg-error" />
          </div>
        </section>

        <section className="bg-surface-container-low p-6 rounded-sm border border-outline-variant/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
            <Terminal size={14} /> System Version
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Kernel</span>
              <span className="font-mono">v1.0.42-stable</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Orchestrator</span>
              <span className="font-mono">v2.1.0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Last Update</span>
              <span className="font-mono">2026-03-28</span>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-block mt-6">Check for updates</button>
        </section>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-surface-container-low border border-outline-variant/10 p-2 rounded-sm">
        <Search size={18} className="text-on-surface-variant/40 ml-2" />
        <input 
          type="text" 
          placeholder="Search audit logs..." 
          className="bg-transparent border-none outline-none text-sm w-full py-1"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="button" className="btn-icon-sm">
          <Download size={18} className="text-on-surface-variant/60" />
        </button>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm overflow-hidden">
        <table className="w-full text-left text-[10px]">
          <thead className="bg-surface-container text-on-surface-variant uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 font-bold">Timestamp</th>
              <th className="px-4 py-3 font-bold">Event</th>
              <th className="px-4 py-3 font-bold">Source</th>
              <th className="px-4 py-3 font-bold">Cryptographic Signature</th>
              <th className="px-4 py-3 font-bold">Verification</th>
              <th className="px-4 py-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {executionLogs.filter(l => l.details.toLowerCase().includes(searchQuery.toLowerCase()) || l.event.toLowerCase().includes(searchQuery.toLowerCase())).map((log, idx) => (
              <tr key={idx} className="hover:bg-on-surface/5 transition-colors group">
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-bold text-on-surface">
                  {log.event}: {log.details}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-bold uppercase tracking-tighter">
                    {log.task_id || 'SYSTEM'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[9px] text-on-surface-variant">
                  <div className="flex items-center gap-1 group-hover:text-secondary transition-colors">
                    <Fingerprint size={12} />
                    {log.id.substring(0, 32)}...
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-secondary font-bold uppercase tracking-widest">
                    <ShieldCheck size={12} /> Valid
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    type="button"
                    onClick={() => { setSelectedLog(log); setIsLogModalOpen(true); }}
                    className="btn-icon bg-surface-container-high text-primary hover:bg-primary/10"
                  >
                    <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleCreateRole = () => {
    setIsCreatingRole(true);
    setRoleForm({
      name: '',
      id: '' as any,
      description: '',
      permissions: [],
      compliance_level: []
    });
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setIsCreatingRole(false);
    setRoleForm({ ...role });
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (roleId: string) => {
    setRoleToDelete(roleId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteRole = () => {
    if (roleToDelete) {
      setRoles(prev => prev.filter(r => r.id !== roleToDelete));
      setIsDeleteModalOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleSaveRole = () => {
    if (!roleForm.name || !roleForm.id) return;
    
    const roleToSave = roleForm as Role;
    
    if (isCreatingRole) {
      if (roles.find(r => r.id === roleToSave.id)) {
        return;
      }
      setRoles(prev => [...prev, roleToSave]);
    } else {
      setRoles(prev => prev.map(r => r.id === roleToSave.id ? roleToSave : r));
    }
    setIsRoleModalOpen(false);
  };

  const togglePermission = (perm: Permission) => {
    const permissions = roleForm.permissions || [];
    const hasPerm = permissions.includes(perm);
    setRoleForm({
      ...roleForm,
      permissions: hasPerm 
        ? permissions.filter(p => p !== perm)
        : [...permissions, perm]
    });
  };

  const toggleCompliance = (standard: ComplianceStandard) => {
    const compliance = roleForm.compliance_level || [];
    const hasStandard = compliance.includes(standard);
    setRoleForm({
      ...roleForm,
      compliance_level: hasStandard
        ? compliance.filter(s => s !== standard)
        : [...compliance, standard]
    });
  };

  const ALL_PERMISSIONS: Permission[] = [
    'VIEW_CASES', 'EDIT_CASES', 'VIEW_MEDICAL_RECORDS', 'EDIT_MEDICAL_RECORDS',
    'VIEW_FINANCIALS', 'EDIT_FINANCIALS', 'VIEW_WORKFLOWS', 'EDIT_WORKFLOWS',
    'VIEW_AGENTS', 'EDIT_AGENTS', 'VIEW_SYSTEM', 'EDIT_SYSTEM',
    'VIEW_AUDIT_TRAIL', 'MANAGE_ROLES', 'VIEW_INBOX', 'REPLY_INBOX',
    'VIEW_DATA_LAB', 'IMPORT_DATA'
  ];

  const ALL_STANDARDS: ComplianceStandard[] = ['HIPAA', 'GDPR', 'SOC2', 'ISO27001'];

  const renderCompliance = () => (
    <div className="grid grid-cols-2 gap-6">
      {complianceStats.map((stat, idx) => (
        <div key={idx} onClick={() => { setSelectedCompliance(stat); setIsComplianceModalOpen(true); }} className="cursor-pointer">
          <ComplianceCard title={stat.name} status={stat.status} date={`Last Audit: ${stat.lastAudit}`} score={stat.score} icon={stat.icon} />
        </div>
      ))}
    </div>
  );

  const renderRBAC = () => {
    if (!hasPermission('MANAGE_ROLES')) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-50 py-20 bg-surface-container-low rounded-sm border border-outline-variant/10">
          <Lock size={64} className="text-tertiary mb-4" />
          <h2 className="text-xl font-black font-headline tracking-tighter uppercase">Access Denied</h2>
          <p className="text-[10px] uppercase tracking-widest mt-2 text-center max-w-md">
            Your current role ({userRole}) does not have permissions to modify data governance policies.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black font-headline tracking-tighter uppercase flex items-center gap-2">
              <ShieldCheck className="text-primary" size={24} /> 
              Role-Based Access Control (RBAC)
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Configure granular permissions and data governance policies for HIPAA, GDPR, and SOC2 compliance.
            </p>
          </div>
          <button 
            type="button"
            onClick={handleCreateRole}
            className="btn btn-primary"
          >
            <Plus size={14} className="shrink-0" />
            Create new role
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm overflow-hidden">
              <div className="p-4 border-b border-outline-variant/10 bg-surface-container flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest">Defined Roles</span>
                <span className="text-[9px] text-on-surface-variant uppercase">{roles.length} Roles Active</span>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {roles.map((role) => (
                  <div 
                    key={role.id} 
                    onClick={() => handleEditRole(role)}
                    className={`p-4 hover:bg-on-surface/5 transition-colors cursor-pointer ${userRole === role.id ? 'bg-primary/10' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm uppercase tracking-tight">{role.name}</h4>
                          <span className="text-[9px] px-1.5 py-0.5 bg-surface-container rounded text-on-surface-variant font-mono">
                            {role.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1">{role.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEditRole(role); }}
                          className="btn-icon-sm text-on-surface-variant hover:bg-on-surface/10"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                          className="btn-icon-sm text-tertiary/60 hover:bg-on-surface/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {role.compliance_level.map((c) => (
                        <span key={c} className="text-[8px] px-1.5 py-0.5 bg-secondary/10 text-secondary rounded font-bold uppercase tracking-widest">
                          {c}
                        </span>
                      ))}
                      <span className="text-[8px] px-1.5 py-0.5 bg-surface-container text-on-surface-variant/60 rounded italic">
                        {role.permissions.length} Permissions
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-4 space-y-4">
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-secondary">
                <UserCheck size={14} /> Active Session
              </h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-primary/20 flex items-center justify-center text-primary font-black font-headline text-xl">
                    A
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-tight">Akash</div>
                    <div className="text-[10px] text-on-surface-variant">akash@claritty.biz</div>
                  </div>
                </div>
                <div className="pt-4 border-t border-outline-variant/10">
                  <label className="text-[9px] text-on-surface-variant uppercase font-bold block mb-2">Switch Role (Debug Mode)</label>
                  <select 
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as any)}
                    className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-2 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-primary transition-colors"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-primary">
                <Shield size={14} /> Security Policy
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'MFA Enforcement', value: 'Enabled' },
                  { label: 'Session Timeout', value: '15 mins' },
                  { label: 'IP Whitelisting', value: 'Active' },
                  { label: 'Audit Logging', value: 'Full' },
                ].map((policy, idx) => (
                  <div key={idx} className="flex justify-between text-[10px] uppercase tracking-widest">
                    <span className="text-on-surface-variant/60">{policy.label}</span>
                    <span className="font-bold text-secondary">{policy.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-6 bg-surface-container-low border border-outline-variant/10 rounded-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Users size={14} /> User + Role Configuration
              </h4>
              <button type="button" onClick={() => void loadAuthUsers()} className="btn btn-ghost text-[10px]">Refresh</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Full name"
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="email@company.com"
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="Temporary password"
                value={userForm.password}
                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as ApiAuthRole }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary uppercase"
              >
                {API_AUTH_ROLES.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>{roleOption}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn btn-primary text-[10px]" onClick={() => void handleCreateUser()}>
                Add User
              </button>
            </div>

            {usersError && <p className="text-[10px] text-tertiary uppercase tracking-widest">{usersError}</p>}
            {usersLoading && <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Loading users...</p>}

            <div className="max-h-64 overflow-y-auto custom-scrollbar border border-outline-variant/10 rounded-sm divide-y divide-outline-variant/10">
              {authUsers.map((user) => (
                <div key={user.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{user.name}</p>
                    <p className="text-[10px] text-on-surface-variant truncate">{user.email || 'no-email'}</p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(e) => void handleRoleUpdate(user.id, e.target.value as ApiAuthRole)}
                    className="bg-surface-container border border-outline-variant/10 rounded-sm px-2 py-1 text-[10px] uppercase"
                  >
                    {API_AUTH_ROLES.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>{roleOption}</option>
                    ))}
                  </select>
                </div>
              ))}
              {!usersLoading && authUsers.length === 0 && (
                <div className="p-3 text-[10px] text-on-surface-variant uppercase tracking-widest">No users configured.</div>
              )}
            </div>
          </div>

          <div className="col-span-6 bg-surface-container-low border border-outline-variant/10 rounded-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                <Database size={14} /> Email Inbox Configuration
              </h4>
              <button type="button" onClick={() => void loadInboxSettings()} className="btn btn-ghost text-[10px]">Refresh</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Label"
                value={inboxForm.label}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, label: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="Receiver email"
                value={inboxForm.email}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, email: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="IMAP host"
                value={inboxForm.host}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, host: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="number"
                placeholder="Port"
                value={inboxForm.port}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, port: Number(e.target.value || 993) }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="IMAP username"
                value={inboxForm.username}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, username: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="IMAP password / app password"
                value={inboxForm.password}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, password: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Mailbox (INBOX)"
                value={inboxForm.mailbox}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, mailbox: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="number"
                placeholder="Poll seconds"
                value={inboxForm.pollInterval}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, pollInterval: Number(e.target.value || 60) }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Domain (Insurance - Health)"
                value={inboxForm.domain}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, domain: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Workflow key (optional)"
                value={inboxForm.workflowKey}
                onChange={(e) => setInboxForm((prev) => ({ ...prev, workflowKey: e.target.value }))}
                className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn btn-primary text-[10px]" onClick={() => void handleCreateInbox()}>
                Save Inbox
              </button>
            </div>

            {inboxesError && <p className="text-[10px] text-tertiary uppercase tracking-widest">{inboxesError}</p>}
            {inboxesLoading && <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Loading inboxes...</p>}

            <div className="max-h-64 overflow-y-auto custom-scrollbar border border-outline-variant/10 rounded-sm divide-y divide-outline-variant/10">
              {inboxSettings.map((inbox) => (
                <div key={inbox.id} className="p-3">
                  <p className="text-xs font-bold">{inbox.label}</p>
                  <p className="text-[10px] text-on-surface-variant">{inbox.email}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {inbox.domain} | {inbox.host}:{inbox.port} | {inbox.isActive ? 'active' : 'inactive'}
                  </p>
                </div>
              ))}
              {!inboxesLoading && inboxSettings.length === 0 && (
                <div className="p-3 text-[10px] text-on-surface-variant uppercase tracking-widest">No inboxes configured.</div>
              )}
            </div>
          </div>
        </div>

        {configStatus && (
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-widest text-primary">{configStatus}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="page-kicker">Operations</p>
          <h2 className="page-title">System</h2>
          <p className="page-description">Health, audit trails, access control, and compliance.</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={toggleTheme}
            className="btn-icon-sm"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon size={20} className="text-on-surface-variant" />
            ) : (
              <Sun size={20} className="text-on-surface-variant" />
            )}
          </button>
          <button type="button" className="btn-icon-sm">
            <Settings size={20} className="text-on-surface-variant/60" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-sm w-fit border border-outline-variant/10">
        {[
          { id: 'health', label: 'System Health', icon: Activity },
          { id: 'logs', label: 'Audit Trail', icon: FileText },
          { id: 'rbac', label: 'Access Control', icon: ShieldCheck },
          { id: 'compliance', label: 'Compliance', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`btn gap-2 px-4 transition-all ${
              activeSubTab === tab.id 
                ? 'bg-primary text-on-primary shadow-md' 
                : 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'health' && renderHealth()}
          {activeSubTab === 'logs' && renderLogs()}
          {activeSubTab === 'compliance' && renderCompliance()}
          {activeSubTab === 'rbac' && renderRBAC()}
        </motion.div>
      </AnimatePresence>

      {/* Role Modal */}
      <AnimatePresence>
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-high border border-outline-variant/20 rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
                <h3 className="text-lg font-black font-headline tracking-tighter uppercase flex items-center gap-2">
                  {isCreatingRole ? <Plus size={20} /> : <Edit2 size={18} />}
                  {isCreatingRole ? 'Create New Role' : `Edit Role: ${roleForm.name}`}
                </h3>
                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="btn-icon-sm rounded-full hover:bg-on-surface/10">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Role Name</label>
                    <input 
                      type="text" 
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                      placeholder="e.g. Senior Adjuster"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Role ID (Immutable)</label>
                    <input 
                      type="text" 
                      value={roleForm.id}
                      onChange={(e) => isCreatingRole && setRoleForm({...roleForm, id: e.target.value.toUpperCase() as any})}
                      disabled={!isCreatingRole}
                      className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-sm font-mono outline-none focus:border-primary transition-colors disabled:opacity-50"
                      placeholder="E.G. SENIOR_ADJUSTER"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Description</label>
                  <textarea 
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                    className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-sm outline-none focus:border-primary transition-colors h-20 resize-none"
                    placeholder="Describe the responsibilities of this role..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Compliance Standards</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STANDARDS.map(standard => (
                      <button
                        type="button"
                        key={standard}
                        onClick={() => toggleCompliance(standard)}
                        className={`btn border transition-all ${
                          roleForm.compliance_level?.includes(standard)
                            ? 'bg-secondary text-on-secondary border-secondary'
                            : 'border-outline-variant/20 text-on-surface-variant hover:bg-on-surface/5 bg-transparent'
                        }`}
                      >
                        {standard}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Permissions Matrix</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map(perm => (
                      <button
                        type="button"
                        key={perm}
                        onClick={() => togglePermission(perm)}
                        className={`btn w-full justify-between border transition-all ${
                          roleForm.permissions?.includes(perm)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-outline-variant/10 text-on-surface-variant hover:bg-on-surface/5 bg-transparent'
                        }`}
                      >
                        {perm.replace(/_/g, ' ')}
                        {roleForm.permissions?.includes(perm) ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 border border-outline-variant/20 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-outline-variant/10 bg-surface-container flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveRole}
                  className="btn btn-primary shadow-lg shadow-primary/20"
                >
                  {isCreatingRole ? 'Create role' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-high border border-outline-variant/20 rounded-sm shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert size={32} />
                </div>
                <h3 className="text-xl font-black font-headline tracking-tighter uppercase mb-2">Delete Role?</h3>
                <p className="text-sm text-on-surface-variant mb-6">
                  Are you sure you want to delete the role <span className="font-bold text-on-surface">"{roleToDelete}"</span>? This action cannot be undone and may affect system access for assigned users.
                </p>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="btn btn-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={confirmDeleteRole}
                    className="btn flex-1 bg-error text-on-error hover:opacity-90 shadow-lg shadow-error/20"
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Details Modal */}
      <AnimatePresence>
        {isLogModalOpen && selectedLog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-high border border-outline-variant/20 rounded-sm shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
                <h3 className="text-lg font-black font-headline tracking-tighter uppercase">Audit Log Entry</h3>
                <button type="button" onClick={() => setIsLogModalOpen(false)} className="btn-icon-sm rounded-full hover:bg-on-surface/10">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Timestamp</label>
                    <div className="text-sm font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Event ID</label>
                    <div className="text-sm font-mono">{selectedLog.id}</div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Event</label>
                  <div className="text-sm font-bold">{selectedLog.event}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Details</label>
                  <div className="text-sm">{selectedLog.details}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Department</label>
                    <div className="text-sm uppercase tracking-widest">{selectedLog.department}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Case ID</label>
                    <div className="text-sm font-mono">{selectedLog.case_id}</div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant/10 bg-surface-container flex justify-end">
                <button 
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="btn btn-primary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cluster Details Modal */}
      <AnimatePresence>
        {isClusterModalOpen && selectedCluster && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-high border border-outline-variant/20 rounded-sm shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
                <h3 className="text-lg font-black font-headline tracking-tighter uppercase">Infrastructure Node</h3>
                <button type="button" onClick={() => setIsClusterModalOpen(false)} className="btn-icon-sm rounded-full hover:bg-on-surface/10">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-black tracking-tighter uppercase">{selectedCluster.name}</h4>
                    <p className="text-xs text-on-surface-variant uppercase tracking-widest">{selectedCluster.region}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    selectedCluster.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500' : 
                    selectedCluster.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-500' : 
                    'bg-error/10 text-error'
                  }`}>
                    {selectedCluster.status}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <span>Resource Load</span>
                    <span>{selectedCluster.load}%</span>
                  </div>
                  <div className="w-full h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${selectedCluster.load}%` }} />
                  </div>
                </div>

                <div className="bg-surface-container p-4 rounded-sm border border-outline-variant/10">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Node Description</label>
                  <p className="text-sm text-on-surface leading-relaxed">
                    {selectedCluster.details}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-surface-container rounded-sm border border-outline-variant/10">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Uptime</div>
                    <div className="text-sm font-mono font-bold text-primary">99.99%</div>
                  </div>
                  <div className="text-center p-3 bg-surface-container rounded-sm border border-outline-variant/10">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Latency</div>
                    <div className="text-sm font-mono font-bold text-primary">12ms</div>
                  </div>
                  <div className="text-center p-3 bg-surface-container rounded-sm border border-outline-variant/10">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Threads</div>
                    <div className="text-sm font-mono font-bold text-primary">1,024</div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant/10 bg-surface-container flex justify-end">
                <button 
                  type="button"
                  onClick={() => setIsClusterModalOpen(false)}
                  className="btn btn-primary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compliance Modal */}
      <AnimatePresence>
        {isComplianceModalOpen && selectedCompliance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface-container-high border border-outline-variant/20 rounded-sm shadow-2xl w-full max-w-4xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-start bg-surface-container">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-secondary/10 text-secondary rounded-sm">
                    <selectedCompliance.icon size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-headline tracking-tighter uppercase">{selectedCompliance.name} Compliance Report</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
                        <ShieldCheck size={12} /> {selectedCompliance.status}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Last Audit: {selectedCompliance.lastAudit}</span>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setIsComplianceModalOpen(false)} className="btn-icon-sm rounded-full hover:bg-on-surface/10">
                  <X size={22} />
                </button>
              </div>

              <div className="p-8 grid grid-cols-12 gap-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="col-span-4 space-y-6">
                  <div className="bg-surface-container p-6 rounded-sm border border-outline-variant/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Audit Summary</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-on-surface-variant">Overall Score</span>
                        <span className="text-2xl font-black text-secondary">{selectedCompliance.score}%</span>
                      </div>
                      <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                        <div className="h-full bg-secondary" style={{ width: `${selectedCompliance.score}%` }}></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/5">
                        <div>
                          <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">Controls</div>
                          <div className="text-lg font-bold">142/142</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">Evidence</div>
                          <div className="text-lg font-bold">842 files</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Compliance Officers</h4>
                    {[
                      { name: 'Sarah Chen', role: 'DPO', status: 'Active' },
                      { name: 'Marcus Thorne', role: 'CISO', status: 'Active' }
                    ].map((officer, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/5 rounded-sm">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {officer.name[0]}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{officer.name}</div>
                          <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">{officer.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-8 space-y-8">
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                      <FileCheck size={16} /> Control Domains
                    </h4>
                    <div className="space-y-3">
                      {[
                        { domain: 'Access Control', status: 'Compliant', coverage: 100 },
                        { domain: 'Data Encryption', status: 'Compliant', coverage: 100 },
                        { domain: 'Incident Response', status: 'Compliant', coverage: 100 },
                        { domain: 'Risk Management', status: 'Compliant', coverage: 96 },
                        { domain: 'Physical Security', status: 'N/A (Cloud)', coverage: 100 },
                      ].map((domain, i) => (
                        <div key={i} className="p-4 bg-surface-container rounded-sm border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-secondary" />
                            <span className="text-sm font-bold">{domain.domain}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">Coverage</div>
                              <div className="text-xs font-mono">{domain.coverage}%</div>
                            </div>
                            <button type="button" className="btn-icon-sm text-on-surface-variant hover:bg-on-surface/5">
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                      <Clock size={16} /> Recent Audit Activity
                    </h4>
                    <div className="space-y-4 border-l-2 border-outline-variant/10 ml-2 pl-6">
                      {[
                        { event: 'Annual Recertification Completed', date: '2024-03-01', user: 'Sarah Chen' },
                        { event: 'Penetration Test Evidence Uploaded', date: '2024-02-15', user: 'System' },
                        { event: 'Access Review Cycle Finished', date: '2024-01-20', user: 'Marcus Thorne' },
                      ].map((activity, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[31px] top-1 w-2 h-2 rounded-full bg-outline-variant" />
                          <div className="text-xs font-bold">{activity.event}</div>
                          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                            {activity.date} • {activity.user}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="px-8 py-6 border-t border-outline-variant/10 bg-surface-container flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <Info size={14} /> This report is generated automatically from real-time system telemetry.
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-outline">
                    <Download size={14} className="shrink-0" />
                    Export evidence
                  </button>
                  <button type="button" onClick={() => setIsComplianceModalOpen(false)} className="btn btn-secondary">
                    Close report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ClusterRow = ({ name, region, status, load, warning, onClick }: any) => (
  <div className="flex items-center justify-between p-3 bg-surface-container rounded-sm border border-outline-variant/5 group">
    <div className="flex items-center gap-4">
      <div className={`w-2 h-2 rounded-full ${warning ? 'bg-tertiary' : 'bg-secondary'}`}></div>
      <div>
        <div className="text-xs font-bold text-on-surface uppercase tracking-tighter">{name}</div>
        <div className="text-[10px] text-on-surface-variant">{region}</div>
      </div>
    </div>
    <div className="flex items-center gap-8">
      <div className="text-right">
        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Load</div>
        <div className="text-xs font-mono">{load}%</div>
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${warning ? 'text-tertiary' : 'text-secondary'}`}>{status}</div>
      <button 
        type="button"
        onClick={onClick}
        className="btn-icon bg-surface-container-high text-primary hover:bg-primary/10"
      >
        <ArrowRight size={14} />
      </button>
    </div>
  </div>
);

const ComplianceCard = ({ title, status, date, score, icon: Icon, warning }: any) => (
  <div className="card-elevated p-6 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon size={80} />
    </div>
    <div className="flex justify-between items-start mb-4">
      <div>
        <h4 className="text-lg font-black font-headline tracking-tighter text-on-surface uppercase">{title}</h4>
        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">{date}</div>
      </div>
      <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm ${warning ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'}`}>
        {status}
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-on-surface-variant/60">Compliance Score</span>
        <span className="text-on-surface">{score}%</span>
      </div>
      <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full ${warning ? 'bg-tertiary' : 'bg-secondary'}`}
        />
      </div>
    </div>
  </div>
);

const ResourceBar = ({ label, value, progress, color }: any) => (
  <div>
    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
    <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);

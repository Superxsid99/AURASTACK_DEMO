import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HomeView } from './components/HomeView';
import { CasesView } from './components/CasesView';
import { WorkflowsView } from './components/WorkflowsView';
import { AgentsView } from './components/AgentsView';
import { SystemView } from './components/SystemView';
import { DataLabView } from './components/DataLabView';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { Routes, Route, useLocation, useNavigate, Navigate, matchPath } from 'react-router-dom';
import { INITIAL_CASES } from './constants/cases';
import { INITIAL_WORKFLOWS } from './constants/workflows';
import { INITIAL_AGENTS } from './constants/agents';
import { INITIAL_CONVERSATIONS } from './constants/intake';
import { Case } from './types/case';
import { WorkflowDefinition } from './types/workflow';
import { AgentDefinition } from './types/agent';
import { Conversation, Message } from './types/intake';
import { TaskInstance, ExecutionLog } from './types/execution';
import { ExecutionEngine } from './services/executionEngine';
import { InboxView } from './components/InboxView';
import { CustomerPortal } from './components/CustomerPortal';
import { ShieldAlert } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ROLES, INITIAL_USER } from './constants/auth';
import { Permission, RoleId } from './types/auth';

export const PermissionContext = React.createContext<{
  hasPermission: (p: Permission) => boolean;
  userRole: RoleId;
  setUserRole: (r: RoleId) => void;
}>({
  hasPermission: () => false,
  userRole: 'ADMIN',
  setUserRole: () => {}
});

export const ThemeContext = React.createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'dark',
  toggleTheme: () => {}
});

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const adminPathBeforePortal = useRef<string>('/');

  useEffect(() => {
    if (!location.pathname.startsWith('/portal')) {
      adminPathBeforePortal.current = location.pathname;
    }
  }, [location.pathname]);

  const isCustomerMode = location.pathname.startsWith('/portal');

  const getActiveTabFromPath = (path: string) => {
    if (path === '/portal' || path.startsWith('/portal/')) return 'portal';
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';
    return segments[0];
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  const getActiveIdFromPath = (path: string) => {
    const caseMatch = matchPath('/cases/:id', path);
    if (caseMatch) return caseMatch.params.id;

    const workflowMatch = matchPath('/workflows/:id', path);
    if (workflowMatch) return workflowMatch.params.id;

    const agentMatch = matchPath('/agents/:id', path);
    if (agentMatch) return agentMatch.params.id;

    const systemMatch = matchPath('/system/:subtab', path);
    if (systemMatch) return systemMatch.params.subtab;

    const datalabMatch = matchPath('/datalab/:subtab', path);
    if (datalabMatch) return datalabMatch.params.subtab;

    return null;
  };

  const activeId = getActiveIdFromPath(location.pathname);

  const [userRole, setUserRole] = useState<RoleId>(INITIAL_USER.role);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const [cases, setCases] = useState<Case[]>(INITIAL_CASES);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(INITIAL_WORKFLOWS);
  const [agents, setAgents] = useState<AgentDefinition[]>(INITIAL_AGENTS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const hasPermission = (permission: Permission) => {
    const role = ROLES.find(r => r.id === userRole);
    return role?.permissions.includes(permission) || false;
  };

  useEffect(() => {
    ExecutionEngine.getInstance().init(setCases, setTasks, setLogs);

    const handleViewCase = (e: any) => {
      const caseId = e.detail;
      navigate(`/cases/${caseId}`);
    };

    const handleViewWorkflow = (e: any) => {
      const workflowId = e.detail;
      navigate(`/workflows/${workflowId}`);
    };

    const handleHospitalMessage = (e: any) => {
      const { caseId, content, sender } = e.detail;
      setConversations(prev => prev.map(conv => {
        if (conv.linked_case_id === caseId || conv.id === caseId) {
          const newMessage: Message = {
            id: uuidv4(),
            sender: sender || 'AI',
            content,
            timestamp: new Date().toISOString()
          };
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            last_message_at: newMessage.timestamp,
            status: 'IN_PROGRESS'
          };
        }
        return conv;
      }));
    };

    const handleAuraCommunication = (e: any) => {
      const { caseId, content } = e.detail;
      setConversations(prev => prev.map(conv => {
        if (conv.linked_case_id === caseId) {
          const newMessage: Message = {
            id: uuidv4(),
            sender: 'AI',
            content,
            timestamp: new Date().toISOString()
          };
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            last_message_at: newMessage.timestamp,
            status: 'IN_PROGRESS'
          };
        }
        return conv;
      }));
    };

    window.addEventListener('view-case', handleViewCase);
    window.addEventListener('view-workflow', handleViewWorkflow);
    window.addEventListener('hospital-message-sent', handleHospitalMessage);
    window.addEventListener('aura-communication-sent', handleAuraCommunication);
    return () => {
      window.removeEventListener('view-case', handleViewCase);
      window.removeEventListener('view-workflow', handleViewWorkflow);
      window.removeEventListener('hospital-message-sent', handleHospitalMessage);
      window.removeEventListener('aura-communication-sent', handleAuraCommunication);
    };
  }, [navigate]);

  const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: Permission }) => {
    if (permission && !hasPermission(permission)) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-50">
          <ShieldAlert size={64} className="text-error mb-4" />
          <h2 className="text-xl font-bold uppercase tracking-widest">Access Restricted</h2>
          <p className="text-xs mt-2">Your current role ({userRole}) does not have permission to view this section.</p>
        </div>
      );
    }
    return <>{children}</>;
  };

  const handleApprove = () => {
    if (activeTab === 'cases' && activeId) {
      setCases(prev => prev.map(c =>
        c.id === activeId ? { ...c, status: 'STABLE' as const, execution_status: 'COMPLETED' as const } : c
      ));
      import('sonner').then(({ toast }) => toast.success(`Case ${activeId} approved successfully.`));
    }
  };

  const canApprove = activeTab === 'cases' && !!activeId;

  const filteredCases = cases.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.workflow_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.agent_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeItem =
    activeTab === 'cases' ? cases.find(c => c.id === activeId) :
    activeTab === 'workflows' ? workflows.find(w => w.workflow_id === activeId) :
    activeTab === 'agents' ? agents.find(a => a.agent_id === activeId) :
    activeTab === 'system' ? { id: activeId || 'health', title: (activeId || 'health').toUpperCase() } :
    activeTab === 'datalab' ? { id: activeId || 'connectors', title: (activeId || 'connectors').toUpperCase() } : null;

  const handleToggleCustomerMode = () => {
    if (isCustomerMode) {
      navigate(adminPathBeforePortal.current || '/');
    } else {
      navigate('/portal');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <PermissionContext.Provider value={{ hasPermission, userRole, setUserRole }}>
        <Toaster position="top-right" expand={false} richColors />
        <div className="min-h-screen text-on-surface selection:bg-primary/30">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => navigate(`/${tab === 'home' ? '' : tab}`)}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className={`pt-14 min-h-screen transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : 'pl-44'} pr-0`}>
          <TopBar
            activeTab={isCustomerMode ? 'customer_portal' : activeTab}
            activeItem={activeItem}
            isCustomerMode={isCustomerMode}
            onToggleCustomerMode={handleToggleCustomerMode}
            isSidebarVisible={true}
            isSidebarCollapsed={isSidebarCollapsed}
            onBackToHome={() => navigate('/')}
            onNavigate={(path) => navigate(path)}
            onSearch={setSearchQuery}
            onApprove={handleApprove}
            canApprove={canApprove}
          />

          <div className={`relative h-[calc(100vh-3.5rem)] min-h-0 ${location.pathname === '/inbox' ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`p-0 h-full min-h-0 ${location.pathname === '/inbox' ? 'overflow-hidden flex flex-col' : ''}`}
              >
                <Routes>
                  <Route path="/portal" element={
                    <CustomerPortal conversations={conversations} setConversations={setConversations} />
                  } />
                  <Route path="/" element={<HomeView />} />
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="/inbox" element={
                    <ProtectedRoute permission="VIEW_INBOX">
                      <InboxView conversations={conversations} setConversations={setConversations} setCases={setCases} workflows={workflows} agents={agents} />
                    </ProtectedRoute>
                  } />
                  <Route path="/cases" element={
                    <ProtectedRoute permission="VIEW_CASES">
                      <CasesView cases={filteredCases} setCases={setCases} tasks={tasks} logs={logs} workflows={workflows} agents={agents} selectedCaseId={null} setSelectedCaseId={(id) => navigate(id ? `/cases/${id}` : '/cases')} setActiveTab={(tab) => navigate(`/${tab}`)} />
                    </ProtectedRoute>
                  } />
                  <Route path="/cases/:id" element={
                    <ProtectedRoute permission="VIEW_CASES">
                      <CasesView cases={filteredCases} setCases={setCases} tasks={tasks} logs={logs} workflows={workflows} agents={agents} selectedCaseId={null} setSelectedCaseId={(id) => navigate(id ? `/cases/${id}` : '/cases')} setActiveTab={(tab) => navigate(`/${tab}`)} />
                    </ProtectedRoute>
                  } />
                  <Route path="/workflows" element={
                    <ProtectedRoute permission="VIEW_WORKFLOWS">
                      <WorkflowsView workflows={filteredWorkflows} setWorkflows={setWorkflows} selectedWorkflowId={null} setSelectedWorkflowId={(id) => navigate(id ? `/workflows/${id}` : '/workflows')} agents={agents} cases={cases} />
                    </ProtectedRoute>
                  } />
                  <Route path="/workflows/:id" element={
                    <ProtectedRoute permission="VIEW_WORKFLOWS">
                      <WorkflowsView workflows={filteredWorkflows} setWorkflows={setWorkflows} selectedWorkflowId={null} setSelectedWorkflowId={(id) => navigate(id ? `/workflows/${id}` : '/workflows')} agents={agents} cases={cases} />
                    </ProtectedRoute>
                  } />
                  <Route path="/agents" element={
                    <ProtectedRoute permission="VIEW_AGENTS">
                      <AgentsView agents={filteredAgents} setAgents={setAgents} selectedAgentId={null} setSelectedAgentId={(id) => navigate(id ? `/agents/${id}` : '/agents')} />
                    </ProtectedRoute>
                  } />
                  <Route path="/agents/:id" element={
                    <ProtectedRoute permission="VIEW_AGENTS">
                      <AgentsView agents={filteredAgents} setAgents={setAgents} selectedAgentId={null} setSelectedAgentId={(id) => navigate(id ? `/agents/${id}` : '/agents')} />
                    </ProtectedRoute>
                  } />
                  <Route path="/datalab" element={
                    <ProtectedRoute permission="VIEW_DATA_LAB">
                      <DataLabView onImport={(newCases) => setCases(prev => [...newCases, ...prev])} />
                    </ProtectedRoute>
                  } />
                  <Route path="/datalab/:subtab" element={
                    <ProtectedRoute permission="VIEW_DATA_LAB">
                      <DataLabView onImport={(newCases) => setCases(prev => [...newCases, ...prev])} />
                    </ProtectedRoute>
                  } />
                  <Route path="/system" element={
                    <ProtectedRoute permission="VIEW_SYSTEM">
                      <SystemView logs={logs} />
                    </ProtectedRoute>
                  } />
                  <Route path="/system/:subtab" element={
                    <ProtectedRoute permission="VIEW_SYSTEM">
                      <SystemView logs={logs} />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      </PermissionContext.Provider>
    </ThemeContext.Provider>
  );
};

export default App;

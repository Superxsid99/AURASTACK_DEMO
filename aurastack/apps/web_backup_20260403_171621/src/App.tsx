import React, { useState, useMemo } from 'react';
import { Sidebar, Header } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inbox } from './components/Inbox';
import { Agents } from './components/Agents';
import { Workflows } from './components/Workflows';
import { Cases } from './components/Cases';
import { Users } from './components/Users';
import { ReviewQueue } from './components/ReviewQueue';
import { Security } from './components/Security';
import { Documents } from './components/Documents';
import { Analytics } from './components/Analytics';
import { AIAssistant } from './components/AIAssistant';
import { AgentDetailModal } from './components/AgentDetailModal';
import { AdminEmailSettings } from './components/AdminEmailSettings';
import { motion, AnimatePresence } from 'motion/react';

import { PlatformProvider, usePlatform } from './context/PlatformContext';
const ALL_TABS = ['dashboard', 'inbox', 'cases', 'review', 'documents', 'analytics', 'workflows', 'agents', 'users', 'security', 'admin', 'settings'];

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { agents, updateAgent, selectedDomain, domainOptions, setSelectedDomain } = usePlatform();
  const allowedTabs = useMemo(() => new Set(ALL_TABS), []);

  const selectedAgent = useMemo(() => 
    agents.find(a => a.id === selectedAgentId), 
    [agents, selectedAgentId]
  );

  React.useEffect(() => {
    if (!allowedTabs.has(activeTab)) {
      const fallback = Array.from(allowedTabs)[0] ?? 'dashboard';
      setActiveTab(fallback);
    }
  }, [activeTab, allowedTabs]);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveTab('cases');
    setSelectedAgentId(null); // Close agent modal if open
  };

  const renderContent = () => {
    if (!allowedTabs.has(activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-[#64748B]">
          <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Access Restricted</h3>
          <p className="text-sm">Your role does not have access to this module.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} onSelectAgent={setSelectedAgentId} onSelectCase={handleSelectCase} />;
      case 'inbox':
        return <Inbox />;
      case 'assistant':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#64748B]">
            <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">AI Assistant</h3>
            <p className="text-sm">Natural language control center for your operations.</p>
          </div>
        );
      case 'cases':
        return <Cases initialSelectedCaseId={selectedCaseId} onClearSelection={() => setSelectedCaseId(null)} />;
      case 'workflows':
        return <Workflows onSelectAgent={setSelectedAgentId} onSelectCase={handleSelectCase} />;
      case 'agents':
        return <Agents onSelectAgent={setSelectedAgentId} />;
      case 'users':
        return <Users />;
      case 'review':
        return <ReviewQueue />;
      case 'security':
        return <Security />;
      case 'documents':
        return <Documents onSelectCase={handleSelectCase} />;
      case 'analytics':
        return <Analytics />;
      case 'admin':
        return <AdminEmailSettings />;
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#64748B]">
            <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Platform Settings</h3>
            <p className="text-sm">Configure your Clarity instance and API integrations.</p>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#64748B]">
            <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Module Under Construction</h3>
            <p className="text-sm">We are working hard to bring this feature to Clarity.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-main">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        allowedTabs={allowedTabs}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          title={activeTab}
          onCreateCase={() => setActiveTab('cases')}
          selectedDomain={selectedDomain}
          domainOptions={domainOptions}
          onDomainChange={(domain) => setSelectedDomain(domain as typeof selectedDomain)}
        />
        
        <div className="page-shell flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
 
      <AIAssistant />

      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailModal 
            agent={selectedAgent} 
            onClose={() => setSelectedAgentId(null)} 
            onUpdate={(updates) => updateAgent(selectedAgent.id, updates)}
            onSelectCase={handleSelectCase}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <AppContent />
    </PlatformProvider>
  );
}

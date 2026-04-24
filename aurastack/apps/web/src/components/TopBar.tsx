import React from 'react';
import { Search, UserCircle, ShieldCheck, ArrowLeft, Shield } from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  activeItem?: any;
  isCustomerMode: boolean;
  onToggleCustomerMode: () => void;
  isSidebarVisible?: boolean;
  isSidebarCollapsed?: boolean;
  onBackToHome?: () => void;
  onNavigate: (path: string) => void;
  onSearch: (query: string) => void;
  onApprove?: () => void;
  canApprove?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  activeTab, 
  activeItem,
  isCustomerMode, 
  onToggleCustomerMode,
  isSidebarVisible = true,
  isSidebarCollapsed = false,
  onBackToHome,
  onNavigate,
  onSearch,
  onApprove,
  canApprove = false
}) => {
  const getBreadcrumbs = () => {
    if (isCustomerMode) return [{ label: 'Home', path: '/' }, { label: 'Customer portal', path: '/portal' }];
    switch (activeTab) {
      case 'home': return [{ label: 'Home', path: '/' }, { label: 'Overview', path: '/' }];
      case 'inbox': return [{ label: 'Home', path: '/' }, { label: 'Inbox', path: '/inbox' }];
      case 'cases':
        const caseBreadcrumbs = [{ label: 'Home', path: '/' }, { label: 'Cases', path: '/cases' }];
        if (activeItem) {
          caseBreadcrumbs.push({ label: activeItem.id || activeItem.title, path: `/cases/${activeItem.id}` });
        }
        return caseBreadcrumbs;
      case 'workflows':
        const workflowBreadcrumbs = [{ label: 'Home', path: '/' }, { label: 'Workflows', path: '/workflows' }];
        if (activeItem) {
          workflowBreadcrumbs.push({ label: activeItem.name, path: `/workflows/${activeItem.workflow_id}` });
        }
        return workflowBreadcrumbs;
      case 'agents':
        const agentBreadcrumbs = [{ label: 'Home', path: '/' }, { label: 'Agents', path: '/agents' }];
        if (activeItem) {
          agentBreadcrumbs.push({ label: activeItem.name, path: `/agents/${activeItem.agent_id}` });
        }
        return agentBreadcrumbs;
      case 'datalab':
        const datalabBreadcrumbs = [{ label: 'Home', path: '/' }, { label: 'Data Lab', path: '/datalab' }];
        if (activeItem) {
          datalabBreadcrumbs.push({ label: activeItem.title, path: `/datalab/${activeItem.id}` });
        } else {
          datalabBreadcrumbs.push({ label: 'Connectors', path: '/datalab' });
        }
        return datalabBreadcrumbs;
      case 'fraud':
        return [{ label: 'Home', path: '/' }, { label: 'Fraud Detection', path: '/fraud' }];
      case 'system':
        const systemBreadcrumbs = [{ label: 'Home', path: '/' }, { label: 'System', path: '/system' }];
        if (activeItem) {
          systemBreadcrumbs.push({ label: activeItem.title, path: `/system/${activeItem.id}` });
        } else {
          systemBreadcrumbs.push({ label: 'Health', path: '/system' });
        }
        return systemBreadcrumbs;
      default: return [{ label: 'Home', path: '/' }];
    }
  };

  return (
    <header className={`fixed ${isSidebarVisible ? (isSidebarCollapsed ? 'left-16 w-[calc(100%-4rem)]' : 'left-44 w-[calc(100%-11rem)]') : 'left-0 w-full'} top-0 h-14 flex items-center justify-between px-6 bg-surface z-40 border-b border-[#e5e7eb] font-headline transition-all duration-300`}>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-semibold">
        {!isSidebarVisible && (
          <button 
            type="button"
            onClick={onBackToHome}
            className="btn btn-muted mr-4 group"
          >
            <ArrowLeft size={14} className="shrink-0 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </button>
        )}
        
        {!isSidebarVisible && (
          <div className="flex items-center gap-2 mr-4 pr-4 border-r border-outline-variant/20">
            <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
              <Shield size={14} className="text-on-primary" />
            </div>
            <span className="text-xs font-black tracking-tighter">AURASTACK</span>
          </div>
        )}

        {getBreadcrumbs().map((crumb, i) => (
          <React.Fragment key={crumb.label + i}>
            <span 
              onClick={() => onNavigate(crumb.path)}
              className={i === getBreadcrumbs().length - 1 ? 'text-on-surface' : 'text-on-surface-variant cursor-pointer hover:text-primary transition-colors'}
            >
              {crumb.label}
            </span>
            {i < getBreadcrumbs().length - 1 && <span className="text-outline-variant">/</span>}
          </React.Fragment>
        ))}
        <div className="ml-4 flex items-center gap-2 px-2 py-0.5 bg-surface-container-low rounded-sm border border-[#e5e7eb]">
          <div className="h-1 w-1 rounded-full bg-primary/70" aria-hidden />
          <span className="text-[9px] font-semibold text-on-surface-variant">Claims engine: Active</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input 
            className="min-h-8 w-64 rounded-sm border-none bg-surface-container-lowest py-0 pl-10 pr-4 text-[10px] leading-none tracking-widest placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/20" 
            placeholder="Search cases, workflows, agents…" 
            type="text"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 text-on-surface-variant">
          <button 
            type="button"
            onClick={onToggleCustomerMode}
            className={`btn border ${
              isCustomerMode 
                ? 'btn-secondary shadow-[0_0_12px_rgba(255,179,146,0.35)]' 
                : 'border-outline-variant/20 bg-surface-container-low text-on-surface hover:border-primary/40'
            }`}
          >
            {isCustomerMode ? <ShieldCheck size={14} className="shrink-0" /> : <UserCircle size={14} className="shrink-0" />}
            {isCustomerMode ? 'Admin' : 'Customer portal'}
          </button>
          {canApprove && (
            <button 
              type="button"
              onClick={onApprove}
              className="btn btn-primary shadow-[0_0_12px_rgba(102,217,204,0.2)]"
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

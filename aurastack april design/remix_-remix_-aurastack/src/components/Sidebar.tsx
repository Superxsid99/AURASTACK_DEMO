import React, { useContext } from 'react';
import { 
  ArrowUpLeft, 
  Inbox, 
  Briefcase, 
  Workflow, 
  Users, 
  Database, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AurastackLogo } from './Logo';
import { PermissionContext } from '../App';
import { Permission } from '../types/auth';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  onToggle 
}) => {
  const { hasPermission } = useContext(PermissionContext);

  const menuItems = [
    { id: 'home', label: 'Home', icon: ArrowUpLeft, permission: null },
    { id: 'inbox', label: 'Inbox', icon: Inbox, permission: 'VIEW_INBOX' as Permission },
    { id: 'cases', label: 'Cases', icon: Briefcase, permission: 'VIEW_CASES' as Permission },
    { id: 'workflows', label: 'Workflows', icon: Workflow, permission: 'VIEW_WORKFLOWS' as Permission },
    { id: 'agents', label: 'Agents', icon: Users, permission: 'VIEW_AGENTS' as Permission },
    { id: 'datalab', label: 'Data Lab', icon: Database, permission: 'VIEW_DATA_LAB' as Permission },
    { id: 'system', label: 'System', icon: Settings, permission: 'VIEW_SYSTEM' as Permission },
  ];

  const filteredItems = menuItems.filter(item => !item.permission || hasPermission(item.permission));

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-surface border-r border-[#e5e7eb] transition-all duration-500 ease-in-out z-50 flex flex-col ${
        isCollapsed ? 'w-16' : 'w-44'
      }`}
    >
      {/* Brand Section */}
      <div 
        onClick={() => setActiveTab('home')}
        className={`border-b border-[#e5e7eb] flex overflow-hidden bg-surface-container-low relative cursor-pointer hover:bg-surface-container-high transition-colors group/brand ${
          isCollapsed ? 'flex-col items-center py-4 px-2 gap-0' : 'px-3 py-4 items-center justify-between'
        }`}
      >
        <div className={`flex items-center gap-3 transition-all duration-500 ${isCollapsed ? 'flex-col' : ''}`}>
          <div className="w-8 h-8 shrink-0 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center group">
            <AurastackLogo className="w-5 h-5 text-primary transition-transform group-hover:scale-110 group-hover/brand:scale-110" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-sans font-bold text-base leading-none text-on-surface group-hover/brand:text-primary transition-colors">Aurastack</span>
              <span className="text-[8px] font-sans uppercase tracking-[0.12em] text-on-surface-variant mt-0.5">Operations</span>
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="shrink-0 p-1 rounded-sm text-on-surface-variant/70 hover:text-primary hover:bg-surface-container-high/80 transition-colors z-10"
            title="Collapse sidebar"
            type="button"
          >
            <ChevronLeft size={18} strokeWidth={1.25} aria-hidden />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-px overflow-y-auto custom-scrollbar">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all group relative border-y border-transparent ${
              activeTab === item.id 
                ? 'bg-surface-container-high text-primary' 
                : 'text-on-surface-variant hover:bg-surface-container-high/45 hover:text-on-surface'
            }`}
            title={isCollapsed ? item.label : undefined}
          >
            {activeTab === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r-sm" />
            )}
            
            <item.icon size={17} strokeWidth={1.25} className={`shrink-0 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'} ${isCollapsed ? 'mx-auto' : ''}`} />

            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-[9px] font-sans uppercase tracking-[0.14em] font-bold">{item.label}</span>
              </div>
            )}
          </button>
        ))}
      </nav>

      {isCollapsed && (
        <div className="shrink-0 border-t border-[#e5e7eb] p-2 flex justify-center bg-surface-container-low">
          <button
            type="button"
            onClick={onToggle}
            className="w-9 h-9 flex items-center justify-center rounded-sm text-on-surface-variant/70 hover:bg-surface-container-high hover:text-primary transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={18} strokeWidth={1.25} aria-hidden />
          </button>
        </div>
      )}
    </aside>
  );
};

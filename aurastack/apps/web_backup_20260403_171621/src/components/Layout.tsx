import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Inbox, 
  Bot, 
  Briefcase, 
  ShieldCheck, 
  BarChart3, 
  Settings, 
  Menu,
  Bell,
  User,
  Layers,
  FileSpreadsheet,
  Shield,
  UserCog,
  LogOut,
  ChevronDown,
  Search,
  Plus,
  PanelLeft
} from 'lucide-react';
import { AuroraStackLogo } from './AurastackLogo';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthUser } from '../lib/api';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  allowedTabs: Set<string>;
}

const navGroups = [
  {
    label: 'OPERATIONS',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'cases', label: 'Cases', icon: Briefcase },
      { id: 'review', label: 'Critical Exceptions', icon: ShieldCheck },
      { id: 'documents', label: 'Documents', icon: FileSpreadsheet },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'AUTOMATION',
    items: [
      { id: 'workflows', label: 'Workflows', icon: Layers },
      { id: 'agents', label: 'AI Agents', icon: Bot },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'users', label: 'Users', icon: User },
      { id: 'security', label: 'Security', icon: Shield },
      { id: 'admin', label: 'Admin', icon: UserCog },
    ],
  },
];

export function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, allowedTabs }: SidebarProps) {
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedTabs.has(item.id))
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={cn(
      "h-screen bg-white border-r border-[#E2E8F0] flex flex-col sticky top-0 transition-all duration-300 ease-in-out z-50",
      isCollapsed ? "w-[58px]" : "w-[218px]"
    )}>
      <div className={cn(
        "p-3 flex items-center gap-2 shrink-0",
        isCollapsed ? "justify-center" : "justify-start"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#64748B] hover:text-[#0F172A] transition-colors duration-150 shrink-0"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <AuroraStackLogo collapsed={false} />
          </div>
        )}
      </div>

      <nav className={cn("flex-1 space-y-4 overflow-y-auto scrollbar-hide", isCollapsed ? "px-2" : "px-3")}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "sidebar-item w-full text-left",
                    activeTab === item.id ? "sidebar-item-active" : "sidebar-item-inactive",
                    isCollapsed && "justify-center px-0"
                  )}
                  title={item.label}
                >
                  <item.icon size={16} strokeWidth={1.5} className={cn("shrink-0", activeTab === item.id ? "text-[#1F9D8B]" : "text-[#64748B]")} />
                  {!isCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("py-4 border-t border-[#E2E8F0]", isCollapsed ? "px-2" : "px-3")}>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "sidebar-item w-full text-left",
            activeTab === 'settings' ? "sidebar-item-active" : "sidebar-item-inactive",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings size={16} strokeWidth={1.5} className={cn("shrink-0", activeTab === 'settings' ? "text-[#1F9D8B]" : "text-[#64748B]")} />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}

export function Header({
  title,
  user,
  onLogout,
  onCreateCase,
  selectedDomain,
  domainOptions,
  onDomainChange
}: {
  title: string;
  user?: AuthUser;
  onLogout?: () => void;
  onCreateCase?: () => void;
  selectedDomain?: string;
  domainOptions?: string[];
  onDomainChange?: (domain: string) => void;
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = [
    { id: 1, title: 'New Claim Assigned', time: '2 mins ago', unread: true },
    { id: 2, title: 'Agent Nidhi completed OCR', time: '15 mins ago', unread: true },
    { id: 3, title: 'Security Alert: Failed Login', time: '1 hour ago', unread: false },
  ];

  return (
    <header className="h-[64px] bg-white border-b border-[#E2E8F0] px-4 md:px-5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg border border-[#E2E8F0] text-[#64748B] flex items-center justify-center">
          <PanelLeft size={13} />
        </div>
        <div className="flex flex-col">
          <p className="text-[14px] font-semibold text-[#334155]">AuraStack workspace</p>
          <p className="text-[9px] uppercase tracking-[0.16em] text-[#94A3B8] font-bold">{title}</p>
        </div>
        {selectedDomain && domainOptions && domainOptions.length > 0 && onDomainChange && (
          <select
            className="h-9 min-w-[220px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] outline-none focus:border-[#1F9D8B]"
            value={selectedDomain}
            onChange={(event) => onDomainChange(event.target.value)}
          >
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        )}
        <div className="hidden xl:flex items-center gap-2 px-2 py-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1F9D8B]" />
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-[0.14em]">Automation Active</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 h-10 w-[292px] rounded-2xl border border-[#E2E8F0] bg-white px-3 text-[#94A3B8]">
          <Search size={14} />
          <input
            className="w-full bg-transparent outline-none text-[15px] placeholder:text-[#94A3B8]"
            placeholder="Search cases, documents..."
          />
        </div>
        <button
          onClick={() => onCreateCase?.()}
          className="h-10 px-5 rounded-2xl bg-[#0B6AD4] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#095EBB] shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
        >
          <Plus size={14} />
          Create Case
        </button>
        <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 relative",
                showNotifications ? "bg-[#E6F6F3] text-[#1F9D8B]" : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              )}
            >
              <Bell size={16} strokeWidth={1.5} />
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[#E11D48] text-white text-[10px] leading-4 font-semibold">3</span>
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-[#0F172A]">Notifications</h3>
                    <button className="text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">Mark all as read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-4 hover:bg-[#F8FAFC] cursor-pointer border-b border-[#E2E8F0] last:border-0 transition-colors duration-150">
                        <div className="flex justify-between items-start mb-1">
                          <p className={cn("text-xs font-medium", n.unread ? "text-[#0F172A]" : "text-[#64748B]")}>{n.title}</p>
                          {n.unread && <div className="w-1.5 h-1.5 bg-[#1F9D8B] rounded-full shrink-0"></div>}
                        </div>
                        <p className="text-xs text-[#94A3B8]">{n.time}</p>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-3 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC] border-t border-[#E2E8F0] transition-colors duration-150">View All Notifications</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#E2E8F0] group-hover:border-[#A7E3D8] transition-colors duration-150">
                <img 
                  src="https://images.unsplash.com/photo-1507152832244-10d45c7eda57?auto=format&fit=crop&q=80&w=150&h=150" 
                  alt="Rahul Sharma" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <ChevronDown size={14} className={cn("text-[#64748B] transition-transform duration-150", showUserMenu && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="p-4 border-b border-[#E2E8F0]">
                    <p className="text-sm font-semibold text-[#0F172A]">{user?.name ?? "Rahul Sharma"}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{user?.role ?? "Platform Admin"}</p>
                  </div>
                  <div className="p-2">
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#64748B] hover:bg-[#F8FAFC] rounded-lg transition-colors duration-150">
                      <User size={16} className="text-[#64748B]" />
                      Profile
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#64748B] hover:bg-[#F8FAFC] rounded-lg transition-colors duration-150">
                      <Settings size={16} className="text-[#64748B]" />
                      Settings
                    </button>
                  </div>
                  <div className="p-2 border-t border-[#E2E8F0]">
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors duration-150"
                      onClick={() => onLogout?.()}
                    >
                      <LogOut size={16} className="text-[#DC2626]" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
    </header>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronDown,
  LayoutGrid,
  Users2,
  ArrowRightLeft,
  Landmark,
  Zap,
  ShieldCheck,
  Briefcase,
  Layers,
  Bot,
  Activity,
  Terminal,
  Cpu,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePlatform } from '../context/PlatformContext';
import { motion, AnimatePresence } from 'motion/react';

const lineData = [
  { name: 'Sat 26', value: 4000 },
  { name: 'Sun 27', value: 5000 },
  { name: 'Mon 28', value: 9000 },
  { name: 'Tue 29', value: 8500 },
  { name: 'Wed 30', value: 11000 },
  { name: 'Thu 31', value: 10000 },
  { name: 'Fri 01', value: 16000 },
];

const barData = [
  { name: 'Sat 26', value: 6000 },
  { name: 'Sun 27', value: 4000 },
  { name: 'Mon 28', value: 15000 },
  { name: 'Tue 29', value: 7000 },
  { name: 'Wed 30', value: 11000 },
  { name: 'Thu 31', value: 8000 },
  { name: 'Fri 01', value: 14000 },
];

import { INDIAN_FACES, DEFAULT_FACE, INDUSTRIES } from '../constants';

const StatCard = ({ title, value, growth, trend, icon: Icon }: any) => (
  <div className="card-primary flex flex-col gap-3">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} strokeWidth={1.5} className="text-[#64748B]" />}
        <span className="text-xs font-medium text-[#64748B] tracking-wide">{title}</span>
      </div>
      <div className={cn(
        "growth-tag",
        trend === 'up' ? "growth-up" : "growth-down"
      )}>
        {growth}
      </div>
    </div>
    <span className="text-xl font-semibold text-[#0F172A]">{value}</span>
  </div>
);

const LiveAutomationFeed = ({ onSelectCase }: { onSelectCase: (id: string) => void }) => {
  const { liveEvents } = usePlatform();
  const [visibleEvents, setVisibleEvents] = useState(liveEvents.slice(0, 6));

  useEffect(() => {
    setVisibleEvents(liveEvents.slice(0, 6));
    if (liveEvents.length === 0) return;

    const interval = setInterval(() => {
      setVisibleEvents(prev => {
        const nextEvent = liveEvents[Math.floor(Math.random() * liveEvents.length)];
        if (!nextEvent) return prev;
        return [nextEvent, ...prev.slice(0, 5)];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [liveEvents]);

  return (
    <div className="card p-5 flex flex-col gap-4 h-full flex-1 min-h-0">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={16} strokeWidth={1.5} className="text-[#64748B]" />
          <span className="text-sm font-semibold text-[#0F172A]">Live Automation Feed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
          <span className="text-xs font-medium text-[#059669] uppercase tracking-wide">Live</span>
        </div>
      </div>
      <div className="space-y-4 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {visibleEvents.map((event, i) => (
            <motion.div
              key={`${event.id}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex gap-3 p-3 bg-white rounded-md border border-[#F1F5F9] hover:border-[#E2E8F0] hover:bg-[#F8FAFC] transition-all duration-150 cursor-pointer group"
              onClick={() => onSelectCase(event.caseId)}
            >
              <div className={cn(
                "p-2 rounded-lg h-fit border",
                event.type === 'automation' ? "bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]" :
                event.type === 'escalation' ? "bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]" :
                event.type === 'completion' ? "bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]" : "bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]"
              )}>
                {event.type === 'automation' ? <Cpu size={14} strokeWidth={1.5} /> : 
                 event.type === 'escalation' ? <AlertCircle size={14} strokeWidth={1.5} /> :
                 event.type === 'completion' ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <History size={14} strokeWidth={1.5} />}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-semibold text-[#0F172A] truncate">{event.title}</span>
                  <span className="text-xs font-medium text-[#64748B] whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] font-medium line-clamp-1">{event.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-medium text-[#0F172A] uppercase tracking-wide group-hover:text-[#1F9D8B] transition-colors duration-150">{event.caseId}</span>
                  <span className="text-[#E2E8F0]">•</span>
                  <span className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Agent: {event.agentId?.split('-').pop()}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button className="w-full py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors duration-150 border-t border-[#E2E8F0] mt-auto">
        View Full Audit Log
      </button>
    </div>
  );
};

export function Dashboard({ setActiveTab, onSelectAgent, onSelectCase }: { setActiveTab: (tab: string) => void, onSelectAgent: (id: string) => void, onSelectCase: (id: string) => void }) {
  const { cases, agents, workflows, reviewQueue } = usePlatform();

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const pendingReviews = reviewQueue.filter(r => r.status === 'pending').length;
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setActiveTab('analytics')} className="cursor-pointer">
          <StatCard 
            title="Automation Rate" 
            value="87.6%" 
            growth="+3.2%" 
            trend="up" 
            icon={Zap}
          />
        </div>
        <div onClick={() => setActiveTab('review')} className="cursor-pointer">
          <StatCard 
            title="Human Escalation" 
            value="12.4%" 
            growth="-1.5%" 
            trend="up" 
            icon={Users2}
          />
        </div>
        <div onClick={() => setActiveTab('cases')} className="cursor-pointer">
          <StatCard 
            title="Avg. Processing Time" 
            value="4.2m" 
            growth="-12s" 
            trend="up" 
            icon={Clock}
          />
        </div>
        <div onClick={() => setActiveTab('agents')} className="cursor-pointer">
          <StatCard 
            title="Active Agents" 
            value={activeAgents} 
            growth="+2" 
            trend="up" 
            icon={Bot}
          />
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div 
          onClick={() => setActiveTab('analytics')} 
          className="card card-hover p-5 cursor-pointer"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="stat-label mb-1">Automated vs Manual Handling</p>
              <h3 className="stat-value">87.6% Auto</h3>
            </div>
            <div className="bg-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
              <span className="text-xs font-medium text-[#64748B]">Last 7 Days</span>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F9D8B" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1F9D8B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickFormatter={(val) => `${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1F9D8B" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('analytics')}
          className="card card-hover p-5 cursor-pointer"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="stat-label mb-1">Case Volume by Workflow</p>
              <h3 className="stat-value">{cases.length} Total</h3>
            </div>
            <div className="bg-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
              <span className="text-xs font-medium text-[#64748B]">Distribution</span>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickFormatter={(val) => `${val/1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#1F9D8B" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Widgets - Equal height cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Live Automation Feed */}
        <LiveAutomationFeed onSelectCase={onSelectCase} />

        {/* Workflow Health */}
        <div className="card p-5 flex flex-col gap-4 h-full flex-1 min-h-0">
          <div className="flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <Layers size={16} strokeWidth={1.5} className="text-[#64748B]" />
              <span className="text-sm font-semibold text-[#0F172A]">Workflow Performance</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Activity size={12} />
              Live
            </div>
          </div>
          <div className="space-y-4">
            {workflows.slice(0, 4).map((wf, i) => {
              const wfCases = cases.filter(c => c.workflowId === wf.id);
              return (
                <div key={i} className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-[#E2E8F0] hover:border-[#A7E3D8] hover:bg-[#F8FAFC] transition-all duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#0F172A]">{wf.name}</span>
                    <span className="text-xs font-medium text-[#1F9D8B] bg-[#E6F6F3] px-2 py-0.5 rounded-full">
                      {wf.automationRate.toFixed(1)}% Auto
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1F9D8B] animate-pulse" />
                      <span className="text-xs font-medium text-[#64748B]">{wfCases.length} Active Cases</span>
                    </div>
                    <span className="text-xs font-medium text-[#94A3B8]">v{1.2 + (i * 0.1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => setActiveTab('workflows')}
            className="w-full py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors duration-150 border-t border-[#E2E8F0] mt-auto"
          >
            View All Workflows
          </button>
        </div>

        {/* Agent Efficiency */}
        <div className="card p-5 flex flex-col gap-4 h-full flex-1 min-h-0">
          <div className="flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={16} strokeWidth={1.5} className="text-[#64748B]" />
              <span className="text-sm font-semibold text-[#0F172A]">Agent Efficiency</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Zap size={12} />
              Top Performers
            </div>
          </div>
          <div className="space-y-3">
            {agents.slice(0, 4).map((agent, i) => {
              const efficiency = 98 - (i * 1.5);
              return (
                <div 
                  key={i} 
                  onClick={() => onSelectAgent(agent.id)}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-all duration-150 cursor-pointer group border border-transparent hover:border-[#E2E8F0]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#1F9D8B] group-hover:bg-[#E6F6F3] transition-colors duration-150">
                      <span className="text-xs font-bold">{agent.name.charAt(0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#0F172A]">{agent.name}</span>
                      <span className="text-xs font-medium text-[#64748B]">{agent.type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#0F172A]">{efficiency}%</span>
                    <p className="text-xs font-medium text-[#64748B]">Accuracy</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => setActiveTab('agents')}
            className="w-full py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors duration-150 border-t border-[#E2E8F0] mt-auto"
          >
            Manage Agents
          </button>
        </div>
      </div>
    </div>
  );
}

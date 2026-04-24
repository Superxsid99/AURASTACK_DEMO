import React, { useEffect, useState } from 'react';
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
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Activity,
  ShieldCheck,
  Zap,
  Layers,
  Briefcase,
  Lock,
  History,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { usePlatform } from '../context/PlatformContext';
import { INDUSTRIES, BFSI_ANALYTICS as DEFAULT_BFSI_ANALYTICS } from '../constants';
import { getBfsiAnalytics } from '../lib/api';

// Mock Data based on PDF ranges
const operationsData = {
  processed: [
    { name: 'Jul', automated: 850, manual: 250 },
    { name: 'Aug', automated: 920, manual: 280 },
    { name: 'Sep', automated: 980, manual: 220 },
    { name: 'Oct', automated: 1050, manual: 250 },
    { name: 'Nov', automated: 1100, manual: 200 },
    { name: 'Dec', automated: 1080, manual: 220 },
    { name: 'Jan', automated: 1150, manual: 150 },
  ],
  latency: [
    { name: 'Jul', avg: 22.5, p95: 55 },
    { name: 'Aug', avg: 20.8, p95: 48 },
    { name: 'Sep', avg: 18.5, p95: 42 },
    { name: 'Oct', avg: 16.3, p95: 38 },
    { name: 'Nov', avg: 15.2, p95: 35 },
    { name: 'Dec', avg: 14.8, p95: 32 },
    { name: 'Jan', avg: 14.2, p95: 30 },
  ],
  stages: [
    { name: 'Intake', value: 95 },
    { name: 'KYC/Docs', value: 72 }, // 28% drop-off as per PDF
    { name: 'Extraction', value: 68 },
    { name: 'Validation', value: 62 },
    { name: 'Underwriting', value: 45 },
    { name: 'Disbursal', value: 38 },
  ],
  types: [
    { name: 'Loan Origination', value: 42 },
    { name: 'Cashless Claims', value: 28 },
    { name: 'Motor Claims', value: 18 },
    { name: 'P&C Claims', value: 12 },
  ]
};

const casesData = {
  volume: [
    { name: 'Jul', banking: 800, health: 2400, motor: 640 },
    { name: 'Aug', banking: 900, health: 2500, motor: 680 },
    { name: 'Sep', banking: 1000, health: 2600, motor: 720 },
    { name: 'Oct', banking: 1100, health: 2700, motor: 750 },
    { name: 'Nov', banking: 1200, health: 2800, motor: 780 },
    { name: 'Dec', banking: 1150, health: 2750, motor: 760 },
    { name: 'Jan', banking: 1200, health: 2800, motor: 780 },
  ],
  resolution: [
    { name: 'Loan Origination', actual: 4.2, target: 120 }, // 4.2h vs 5 days (120h)
    { name: 'Cashless Claims', actual: 0.78, target: 6 }, // 47m (0.78h) vs 6h
    { name: 'Motor Claims', actual: 6.2, target: 14 }, // 6.2d vs 14d
    { name: 'KYC Onboarding', actual: 0.3, target: 72 }, // 18m (0.3h) vs 3d (72h)
  ],
  priority: [
    { name: 'Critical', value: 12 },
    { name: 'High', value: 28 },
    { name: 'Medium', value: 40 },
    { name: 'Low', value: 20 },
  ],
  assignees: [
    { name: 'Rajesh Kumar', value: 47 }, // 47 cases per agent as per PDF
    { name: 'Priya Sharma', value: 42 },
    { name: 'Rahul Sharma', value: 45 },
    { name: 'Amit Patel', value: 38 },
    { name: 'Unassigned', value: 12 },
  ]
};

const workflowsData = {
  throughput: [
    { name: 'Jul', completed: 780, failed: 220 }, // 78% STP rate
    { name: 'Aug', completed: 800, failed: 200 },
    { name: 'Sep', completed: 820, failed: 180 },
    { name: 'Oct', completed: 810, failed: 190 },
    { name: 'Nov', completed: 830, failed: 170 },
    { name: 'Dec', completed: 820, failed: 180 },
    { name: 'Jan', completed: 840, failed: 160 },
  ],
  successRates: [
    { name: 'Loan Origination', rate: 82 },
    { name: 'Cashless Claims', rate: 71 },
    { name: 'Motor Claims', rate: 88 },
    { name: 'Doc Processing', rate: 82 },
    { name: 'AML Monitoring', rate: 92 },
  ],
  departments: [
    { dept: 'Banking', workflows: 9, cases: 1200, time: '4.2h', throughput: 78 },
    { dept: 'Health', workflows: 9, cases: 2800, time: '0.8h', throughput: 71 },
    { dept: 'Motor', workflows: 5, cases: 780, time: '6.2d', throughput: 88 },
    { dept: 'P&C', workflows: 5, cases: 450, time: '2.5d', throughput: 85 },
    { dept: 'Cross-Industry', workflows: 3, cases: 18000, time: '1.2m', throughput: 82 },
  ]
};

const agentsData = [
  { name: 'Loan Intake', avgTime: '4.2m', processed: 1200, success: 82.0 },
  { name: 'KYC Identity', avgTime: '18m', processed: 950, success: 81.0 },
  { name: 'Doc Processing', avgTime: '1.2m', processed: 18000, success: 99.1 },
  { name: 'Fraud Detection', avgTime: '0.5m', processed: 220000, success: 96.8 },
];

const complianceData = {
  stats: [
    { label: 'PHI Access Violations', value: '0', status: 'secure' },
    { label: 'Audit Log Coverage', value: '100%', status: 'secure' },
    { label: 'Data Retention Compliance', value: '98.7%', status: 'warning' },
    { label: 'Pending Access Reviews', value: '3', status: 'action' },
  ],
  events: [
    { event: 'Case CAS-2024-001 accessed by Sarah Chen', time: '2 min ago' },
    { event: 'Medical records exported — audit logged', time: '15 min ago' },
    { event: 'Role \'Claims Processor\' assigned to Mike Torres', time: '1 hr ago' },
    { event: 'PHI data masked for external report', time: '2 hrs ago' },
    { event: 'Access review completed for Q1 2024', time: '1 day ago' },
  ]
};

const COLORS = ['#1F9D8B', '#059669', '#D97706', '#DC2626', '#64748B'];

export function Analytics() {
  const { cases, agents, workflows } = usePlatform();
  const [activeCategory, setActiveCategory] = useState('Operations');
  const [rangeDays, setRangeDays] = useState(30);
  type BfsiAnalyticsShape = typeof DEFAULT_BFSI_ANALYTICS;
  const [bfsiAnalytics, setBfsiAnalytics] = useState<BfsiAnalyticsShape>(DEFAULT_BFSI_ANALYTICS);
  const BFSI_ANALYTICS = bfsiAnalytics;

  useEffect(() => {
    getBfsiAnalytics(rangeDays)
      .then((data) => setBfsiAnalytics(data as BfsiAnalyticsShape))
      .catch(() => setBfsiAnalytics(DEFAULT_BFSI_ANALYTICS));
  }, [rangeDays]);

  // Calculate dynamic data based on industries
  const industryDistribution = INDUSTRIES.map(industry => ({
    name: industry,
    value: cases.filter(c => c.category === industry).length
  })).filter(item => item.value > 0);

  const workflowDistribution = INDUSTRIES.map(industry => ({
    name: industry,
    value: workflows.filter(w => w.category === industry).length
  })).filter(item => item.value > 0);

  const [bfsiTab, setBfsiTab] = useState('Banking');

  const categories = [
    { id: 'Operations', icon: <Activity size={18} /> },
    { id: 'Cases', icon: <Briefcase size={18} /> },
    { id: 'Workflows', icon: <Layers size={18} /> },
    { id: 'BFSI Insights', icon: <TrendingUp size={18} /> },
    { id: 'AI Agents', icon: <Zap size={18} /> },
    { id: 'Compliance & Governance', icon: <ShieldCheck size={18} /> },
  ];

  const renderOperations = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="card-title mb-4">Claims Processed</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operationsData.processed}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="automated" name="Automated" fill="#1F9D8B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="manual" name="Manual" fill="#E2E8F0" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h4 className="card-title mb-4">Processing Time (hours)</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={operationsData.latency}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="avg" name="Avg" stroke="#1F9D8B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p95" name="P95" stroke="#DC2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="card-title mb-4">Cases by Stage</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={operationsData.stages}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#1F9D8B" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h4 className="card-title mb-4">Cases by Industry</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={industryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {industryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCases = () => (
    <div className="space-y-4">
      <div className="card p-5">
        <h4 className="card-title mb-4">Case Volume by Industry</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={industryDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="value" name="Total Cases" fill="#1F9D8B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="card-title mb-4">Resolution Time vs Target (hrs)</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={casesData.resolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="actual" name="Actual" fill="#1F9D8B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target" fill="#E2E8F0" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h4 className="card-title mb-4">Cases by Priority</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={casesData.priority}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {casesData.priority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h4 className="card-title mb-4">Cases by Assignee</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {casesData.assignees.map((a, i) => (
            <div key={i} className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              <p className="text-xs font-medium text-[#64748B] mb-1">{a.name}</p>
              <h5 className="text-xl font-semibold text-[#0F172A]">{a.value}</h5>
              <p className="text-xs text-[#64748B]">Active Cases</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderWorkflows = () => (
    <div className="space-y-4">
      <div className="card p-5">
        <h4 className="card-title mb-4">Workflows by Industry</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workflowDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="value" name="Active Workflows" fill="#1F9D8B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="card-title mb-4">Success Rate by Workflow</h4>
          <div className="space-y-4">
            {workflowsData.successRates.map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-[#64748B]">{w.name}</span>
                  <span className="text-xs font-semibold text-[#0F172A]">{w.rate}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${w.rate}%` }}
                    className={cn(
                      "h-full rounded-full",
                      w.rate > 95 ? "bg-[#059669]" : "bg-[#D97706]"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 overflow-hidden">
          <h4 className="card-title mb-4">Performance by Department</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="pb-2 text-xs font-medium text-[#64748B] uppercase tracking-wide">Dept</th>
                  <th className="pb-2 text-xs font-medium text-[#64748B] uppercase tracking-wide text-right">WF</th>
                  <th className="pb-2 text-xs font-medium text-[#64748B] uppercase tracking-wide text-right">Cases</th>
                  <th className="pb-2 text-xs font-medium text-[#64748B] uppercase tracking-wide text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {workflowsData.departments.map((d, i) => (
                  <tr key={i} className="table-row hover:bg-[#F8FAFC]">
                    <td className="py-3 text-xs font-medium text-[#0F172A]">{d.dept}</td>
                    <td className="py-3 text-xs font-medium text-[#64748B] text-right">{d.workflows}</td>
                    <td className="py-3 text-xs font-medium text-[#64748B] text-right">{d.cases.toLocaleString()}</td>
                    <td className="py-3 text-xs font-semibold text-[#0F172A] text-right">{d.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {agentsData.map((agent, i) => (
        <div key={i} className="card p-6 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-[#1F9D8B] text-white rounded-lg">
              <Zap size={18} />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-[#64748B]">{agent.avgTime} avg</p>
              <p className="text-xs font-medium text-[#059669]">Optimal</p>
            </div>
          </div>
          <h4 className="card-title mb-4">{agent.name}</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-[#64748B] mb-0.5">Tasks Processed</p>
              <h5 className="text-xl font-semibold text-[#0F172A]">{agent.processed.toLocaleString()}</h5>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-medium text-[#64748B]">Success Rate</p>
                <span className="text-xs font-semibold text-[#0F172A]">{agent.success}%</span>
              </div>
              <div className="w-full h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full bg-[#1F9D8B]" style={{ width: `${agent.success}%` }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompliance = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="card p-6">
          <h4 className="card-title mb-6 flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#059669]" />
            Data Governance Status
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceData.stats.map((stat, i) => (
              <div key={i} className="p-5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <p className="text-xs font-medium text-[#64748B] mb-2">{stat.label}</p>
                <div className="flex items-center justify-between">
                  <h5 className="text-2xl font-semibold text-[#0F172A]">{stat.value}</h5>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    stat.status === 'secure' ? "bg-[#ECFDF5] text-[#059669]" :
                    stat.status === 'warning' ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#FEF2F2] text-[#DC2626]"
                  )}>
                    {stat.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h4 className="card-title mb-6 flex items-center gap-2">
            <History size={20} className="text-[#1F9D8B]" />
            Recent Audit Events
          </h4>
          <div className="space-y-4">
            {complianceData.events.map((event, i) => (
              <div key={i} className="flex items-start gap-3 p-3 hover:bg-[#F8FAFC] rounded-lg transition-colors duration-150 group">
                <div className="w-8 h-8 bg-[#F1F5F9] rounded-lg flex items-center justify-center text-[#64748B] group-hover:bg-[#1F9D8B] group-hover:text-white transition-all duration-150">
                  <Lock size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-[#0F172A]">{event.event}</p>
                  <p className="text-xs font-medium text-[#64748B]">{event.time}</p>
                </div>
                <button className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] transition-colors duration-150">
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#1F9D8B] p-6 rounded-lg text-white">
          <h4 className="text-sm font-bold mb-4">Compliance Score</h4>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.42}
                  strokeDashoffset={364.42 * (1 - 0.98)}
                  strokeLinecap="round"
                  className="text-[#34D399]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">98%</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Excellent</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/60 text-center leading-relaxed mt-2">
            Your platform is currently meeting 98% of the required insurance data governance protocols.
          </p>
        </div>

        <div className="card p-6">
          <h4 className="card-title mb-4">Security Actions</h4>
          <div className="space-y-2">
            <button className="w-full py-3 bg-[#F8FAFC] text-[#0F172A] rounded-lg font-medium text-xs hover:bg-[#F1F5F9] transition-all duration-150 text-left px-4 flex items-center justify-between border border-[#E2E8F0]">
              Rotate API Keys
              <ArrowUpRight size={14} className="text-[#64748B]" />
            </button>
            <button className="w-full py-3 bg-[#F8FAFC] text-[#0F172A] rounded-lg font-medium text-xs hover:bg-[#F1F5F9] transition-all duration-150 text-left px-4 flex items-center justify-between border border-[#E2E8F0]">
              Download Audit PDF
              <ArrowUpRight size={14} className="text-[#64748B]" />
            </button>
            <button className="w-full py-3 bg-[#FEF2F2] text-[#DC2626] rounded-lg font-medium text-xs hover:bg-[#FEE2E2] transition-all duration-150 text-left px-4 flex items-center justify-between border border-[#DC2626]/20">
              Revoke All Access
              <AlertCircle size={14} className="text-[#DC2626]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBFSIInsights = () => {
    const BFSI_TABS = ['Banking', 'Insurance - Health', 'Insurance - Motor', 'Insurance - P&C', 'Cross-Industry'];
    const renderBankingInsights = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Loan Applications / Day', value: '1,047', sub: '38.2% conversion' },
            { label: 'Auto-Approval Rate', value: '58.7%', sub: '4.2h avg TAT (was 5d)' },
            { label: 'Txns Monitored / Day', value: '2,03,400', sub: 'AML — 1.04% alert rate' },
            { label: 'KYC Completion', value: '81%', sub: '18 min avg (was 3 days)' },
          ].map((s, i) => <div key={i} className="card p-4"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-xl font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="card-title mb-4">Loan Applications Trend</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BFSI_ANALYTICS.loanOrigination.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="apps" name="Applications" fill="#E2E8F0" radius={[2,2,0,0]} />
                  <Bar dataKey="approved" name="Approved" fill="#1F9D8B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-4">Collections — Channel Effectiveness</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BFSI_ANALYTICS.collections.channelEffectiveness}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="channel" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="rate" name="Conversion %" fill="#1F9D8B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="card-title mb-4">AML — Transaction Monitoring Trend</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={BFSI_ANALYTICS.aml.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="monitored" name="Monitored" stroke="#E2E8F0" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#DC2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-4">AML — Risk Distribution</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={BFSI_ANALYTICS.aml.riskDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {BFSI_ANALYTICS.aml.riskDist.map((_, index) => <Cell key={index} fill={['#059669','#D97706','#DC2626'][index % 3]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h4 className="card-title mb-3">Collections — DPD Bucket Distribution</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BFSI_ANALYTICS.collections.dpd.map((d, i) => (
              <div key={i} className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <p className="text-xs font-medium text-[#64748B] mb-1">{d.bucket}</p>
                <h5 className="text-xl font-semibold text-[#0F172A]">{d.pct}%</h5>
                <p className="text-xs text-[#94A3B8]">{d.accounts.toLocaleString('en-IN')} accounts</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    const renderHealthInsights = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pre-Auth Requests / Day', value: '2,612', sub: '71.3% approval rate' },
            { label: 'Cashless TAT', value: '47 min', sub: 'vs 6h baseline (7.7x)' },
            { label: 'Reimbursement TAT', value: '4.8 days', sub: '₹340/claim cost' },
            { label: 'Doc Deficiency Rate', value: '31%', sub: 'Reimbursement claims' },
          ].map((s, i) => <div key={i} className="card p-4"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-xl font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="card-title mb-4">Cashless Claims — Monthly Trend</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BFSI_ANALYTICS.cashlessClaims.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="preAuth" name="Pre-Auth" fill="#E2E8F0" radius={[2,2,0,0]} />
                  <Bar dataKey="approved" name="Approved" fill="#1F9D8B" radius={[4,4,0,0]} />
                  <Bar dataKey="flagged" name="Fraud Flagged" fill="#DC2626" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-4">Top Hospitals by Claims</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={BFSI_ANALYTICS.cashlessClaims.hospitalDist}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="claims" name="Claims" fill="#1F9D8B" radius={[0,4,4,0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h4 className="card-title mb-4">Reimbursement — Rejection Reasons</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={BFSI_ANALYTICS.reimbursement.rejectionReasons}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis dataKey="reason" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                <Bar dataKey="pct" name="%" fill="#D97706" radius={[0,4,4,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
    const renderMotorInsights = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'FNOL Received / Day', value: '712', sub: '82.4% approval rate' },
            { label: 'Avg Settlement', value: '6.2 days', sub: 'vs 14d baseline (2.3x)' },
            { label: 'Avg Repair Cost', value: '₹38,400', sub: '4.1% fraud detection' },
            { label: 'Salvage Recovery', value: '73.1%', sub: '81.4% auction success' },
          ].map((s, i) => <div key={i} className="card p-4"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-xl font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="card-title mb-4">Motor Claims — FNOL Monthly Trend</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BFSI_ANALYTICS.motorClaims.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="fnol" name="FNOL" fill="#E2E8F0" radius={[2,2,0,0]} />
                  <Bar dataKey="approved" name="Approved" fill="#1F9D8B" radius={[4,4,0,0]} />
                  <Bar dataKey="fraud" name="Fraud" fill="#DC2626" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-3">Surveyor & Salvage KPIs</h4>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[
                { label: 'Survey Assignment', value: '23 min', sub: 'avg from FNOL' },
                { label: 'Survey Completion', value: '1.4 days', sub: 'avg TAT' },
                { label: 'Pending Surveys', value: '7.2%', sub: `${BFSI_ANALYTICS.surveyor.pendingCount} open` },
                { label: 'Salvage Recovery', value: '73.1%', sub: '11.2 day recovery time' },
              ].map((s, i) => <div key={i} className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-lg font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
            </div>
          </div>
        </div>
      </div>
    );
    const renderCrossIndustry = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Docs Processed / Day', value: '16,200', sub: '82.3% STP rate' },
            { label: 'Extraction Accuracy', value: '99.1%', sub: 'All document types' },
            { label: 'Cost per Document', value: '₹12', sub: 'vs ₹68 manual (5.7x)' },
            { label: 'SLA Breach Rate', value: '6.2%', sub: '2.8% queue backlog' },
          ].map((s, i) => <div key={i} className="card p-4"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-xl font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="card-title mb-4">Document Processing — Daily STP</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BFSI_ANALYTICS.docProcessing.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="processed" name="Total" fill="#E2E8F0" radius={[2,2,0,0]} />
                  <Bar dataKey="stp" name="STP" fill="#1F9D8B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-4">Agent Productivity (cases/agent/day)</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={BFSI_ANALYTICS.agentPerformance.productivity}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="cases" name="Cases" fill="#1F9D8B" radius={[0,4,4,0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
    const contentMap: Record<string, JSX.Element> = {
      'Banking': renderBankingInsights(),
      'Insurance - Health': renderHealthInsights(),
      'Insurance - Motor': renderMotorInsights(),
      'Insurance - P&C': (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Property Claims / Month', value: '284', sub: '74% automation rate' },
              { label: 'Avg Claim Size', value: '₹8.4L', sub: 'Commercial property' },
              { label: 'Commercial UW TAT', value: '2.8 days', sub: 'was 9 days (3.2x)' },
              { label: 'Fraud Detection Rate', value: '6.3%', sub: 'P&C portfolios' },
            ].map((s, i) => <div key={i} className="card p-4"><p className="text-xs text-[#64748B] mb-1">{s.label}</p><h5 className="text-xl font-bold text-[#0F172A]">{s.value}</h5><p className="text-xs text-[#94A3B8]">{s.sub}</p></div>)}
          </div>
          <div className="card p-5">
            <h4 className="card-title mb-3">P&C Workflow Automation Rates</h4>
            <div className="space-y-3">
              {[
                { name: 'Property Claims', rate: 74 }, { name: 'Commercial Liability Claims', rate: 68 },
                { name: 'Commercial Underwriting', rate: 68 }, { name: 'Policy Issuance (Commercial)', rate: 89 },
                { name: 'Renewals & Endorsements', rate: 84 },
              ].map((w, i) => <div key={i} className="space-y-1"><div className="flex justify-between"><span className="text-xs text-[#64748B]">{w.name}</span><span className="text-xs font-bold text-[#0F172A]">{w.rate}%</span></div><div className="h-1.5 bg-[#E2E8F0] rounded-full"><div className="h-full bg-[#1F9D8B] rounded-full" style={{ width: `${w.rate}%` }} /></div></div>)}
            </div>
          </div>
        </div>
      ),
      'Cross-Industry': renderCrossIndustry(),
    };
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {BFSI_TABS.map(tab => (
            <button key={tab} onClick={() => setBfsiTab(tab)} className={cn('filter-pill transition-all', bfsiTab === tab && 'filter-pill-active')}>{tab}</button>
          ))}
        </div>
        {contentMap[bfsiTab] ?? null}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeCategory) {
      case 'Operations': return renderOperations();
      case 'Cases': return renderCases();
      case 'Workflows': return renderWorkflows();
      case 'BFSI Insights': return renderBFSIInsights();
      case 'AI Agents': return renderAgents();
      case 'Compliance & Governance': return renderCompliance();
      default: return renderOperations();
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="section-title">Advanced Analytics</h3>
          <p className="text-sm text-[#64748B] mt-0.5">Deep insights into your insurance operations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRangeDays(7)} className={cn('filter-pill', rangeDays === 7 && 'filter-pill-active')}>Last 7 Days</button>
          <button onClick={() => setRangeDays(30)} className={cn('filter-pill', rangeDays === 30 && 'filter-pill-active')}>Last 30 Days</button>
          <button onClick={() => setRangeDays(90)} className={cn('filter-pill', rangeDays === 90 && 'filter-pill-active')}>Last 90 Days</button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pre-Auth / Day (Health)', value: '2,612', growth: '+8.1%', trend: 'up', icon: <CheckCircle2 size={18} /> },
          { label: 'Cross-Workflow Automation', value: '87.6%', growth: '+3.2%', trend: 'up', icon: <Zap size={18} /> },
          { label: 'Cashless TAT', value: '47 min', growth: '-87%', trend: 'up', icon: <Clock size={18} /> },
          { label: 'Manual Interventions', value: '12.4%', growth: '-1.8%', trend: 'up', icon: <AlertCircle size={18} /> }
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-[#F1F5F9] text-[#64748B] rounded-lg border border-[#E2E8F0]">
                {stat.icon}
              </div>
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold",
                stat.trend === 'up' ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"
              )}>
                {stat.trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {stat.growth}
              </div>
            </div>
            <p className="stat-label">{stat.label}</p>
            <h4 className="stat-value">{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "filter-pill flex items-center gap-2 transition-all duration-150",
              activeCategory === cat.id && "filter-pill-active"
            )}
          >
            <span className={cn(
              "flex items-center",
              activeCategory === cat.id ? "text-[#1F9D8B]" : "text-[#64748B]"
            )}>
              {cat.icon}
            </span>
            {cat.id}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

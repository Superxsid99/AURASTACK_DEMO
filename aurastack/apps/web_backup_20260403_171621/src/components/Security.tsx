import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Globe, 
  User, 
  Clock, 
  AlertTriangle, 
  Activity,
  MoreVertical,
  ChevronRight,
  Shield,
  Zap,
  Filter
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SecurityLog } from '../types';
import { Dropdown } from './Dropdown';

export function Security() {
  const { securityLogs } = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const filteredLogs = useMemo(() => {
    return securityLogs.filter(log => {
      const matchesSearch = log.event.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.ipAddress.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = selectedSeverity === 'All' || log.severity === selectedSeverity;
      const matchesStatus = selectedStatus === 'All' || log.status === selectedStatus;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [securityLogs, searchQuery, selectedSeverity, selectedStatus]);

  const severityColors = {
    low: "text-[#64748B]",
    medium: "text-[#D97706]",
    high: "text-[#EA580C]",
    critical: "text-[#DC2626]"
  };

  const statusColors = {
    success: "bg-[#ECFDF5] text-[#059669]",
    failed: "bg-[#FEF2F2] text-[#DC2626]",
    blocked: "bg-[#0F172A] text-white"
  };

  const statItems = [
    { label: 'Active Sessions', value: '42', icon: User },
    { label: 'Threats Blocked', value: '1,284', icon: ShieldAlert },
    { label: 'System Health', value: '99.9%', icon: Activity },
    { label: 'API Requests', value: '842k', icon: Zap },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="page-title">Security Center</h3>
          <p className="text-sm text-[#64748B] mt-0.5">Real-time audit logs and threat monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-error">{securityLogs.filter(l => l.severity === 'critical').length} Critical</span>
          <span className="badge bg-[#F1F5F9] text-[#64748B]">{securityLogs.length} Total</span>
        </div>
      </div>

      {/* Security Stats - Dashboard style cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card-primary flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Icon size={16} strokeWidth={1.5} className="text-[#64748B]" />
                  <span className="text-xs font-medium text-[#64748B] tracking-wide">{stat.label}</span>
                </div>
              </div>
              <span className="text-xl font-semibold text-[#0F172A]">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Filters - aligned search + dropdowns */}
      <div className="filter-row">
        <div className="filter-search-wrap flex-1 min-w-0">
          <span className="filter-label">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by User, IP or Event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base h-9 pl-9 pr-3"
            />
          </div>
        </div>
        <Dropdown 
          label="Severity"
          options={['All', 'low', 'medium', 'high', 'critical'].map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
          value={selectedSeverity}
          onChange={setSelectedSeverity}
          className="w-full md:w-40"
        />
        <Dropdown 
          label="Status"
          options={['All', 'success', 'failed', 'blocked'].map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
          value={selectedStatus}
          onChange={setSelectedStatus}
          className="w-full md:w-40"
        />
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Timestamp</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Event</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">User / IP</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Severity</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <motion.tr 
                  layout
                  key={log.id}
                  className="table-row group border-b border-[#E2E8F0] last:border-0 min-h-[56px]"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#94A3B8]" strokeWidth={1.5} />
                      <span className="text-sm font-normal text-[#0F172A]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-normal text-[#0F172A]">{log.event}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-normal text-[#0F172A]">{log.user}</span>
                      <span className="text-xs font-normal text-[#64748B] font-mono">{log.ipAddress}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className={severityColors[log.severity]} strokeWidth={1.5} />
                      <span className={cn("text-xs font-medium uppercase", severityColors[log.severity])}>
                        {log.severity}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn("badge", statusColors[log.status])}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <Globe size={14} className="text-[#64748B]" strokeWidth={1.5} />
                      <span className="text-sm font-normal text-[#0F172A]">{log.location}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

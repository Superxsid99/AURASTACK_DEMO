import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  ArrowUpRight,
  ShieldCheck,
  MoreVertical,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewQueueItem } from '../types';
import { Dropdown } from './Dropdown';

export function ReviewQueue() {
  const { reviewQueue, updateReviewItem } = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);

  const filteredQueue = useMemo(() => {
    return reviewQueue.filter(item => {
      const matchesSearch = item.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.caseId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
      const matchesPriority = selectedPriority === 'All' || item.priority === selectedPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [reviewQueue, searchQuery, selectedStatus, selectedPriority]);

  const handleAction = (id: string, status: ReviewQueueItem['status']) => {
    updateReviewItem(id, { status });
    setSelectedItem(null);
  };

  const statusColors = {
    pending: "badge badge-review",
    'in-review': "badge badge-processing",
    approved: "badge badge-complete",
    rejected: "badge badge-error",
    escalated: "badge bg-[#F1F5F9] text-[#0F172A]"
  };

  const priorityColors = {
    low: "text-[#64748B]",
    medium: "text-[#64748B]",
    high: "text-[#0F172A]",
    critical: "text-[#DC2626]"
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="page-title-inbox">Critical Exceptions</h3>
          <p className="text-xs text-[#64748B] font-medium mt-0.5 tracking-wide">Human intervention required for high-risk or complex automation failures</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-review">{reviewQueue.filter(i => i.status === 'pending').length} Pending</span>
          <span className="badge badge-complete">{reviewQueue.filter(i => i.status === 'approved').length} Resolved</span>
        </div>
      </div>

      {/* Filters - aligned search + dropdowns */}
      <div className="filter-row">
        <div className="filter-search-wrap flex-1 min-w-0">
          <span className="filter-label">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by ID, Case or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base h-9 pl-9 pr-3"
            />
          </div>
        </div>
        <Dropdown 
          label="Status"
          options={['All', 'pending', 'in-review', 'approved', 'rejected'].map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
          value={selectedStatus}
          onChange={setSelectedStatus}
          className="w-full md:w-40"
        />
        <Dropdown 
          label="Priority"
          options={['All', 'low', 'medium', 'high', 'critical'].map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))}
          value={selectedPriority}
          onChange={setSelectedPriority}
          className="w-full md:w-40"
        />
      </div>

      {/* Queue Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Item / Case</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Confidence</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Priority</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((item) => (
                <motion.tr 
                  layout
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="table-row group cursor-pointer border-b border-[#E2E8F0] last:border-0 min-h-[56px]"
                >
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-normal text-[#0F172A]">{item.id}</span>
                      <span className="text-xs font-normal text-[#64748B]">{item.caseId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-normal text-[#0F172A]">{item.type}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            item.confidenceScore > 85 ? "bg-[#059669]" : 
                            item.confidenceScore > 70 ? "bg-[#D97706]" : "bg-[#DC2626]"
                          )}
                          style={{ width: `${item.confidenceScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-normal text-[#0F172A]">{item.confidenceScore.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className={priorityColors[item.priority]} strokeWidth={1.5} />
                      <span className={cn("text-xs font-medium uppercase", priorityColors[item.priority])}>
                        {item.priority}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(statusColors[item.status])}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAction(item.id, 'approved'); }}
                        className="p-1.5 text-[#059669] hover:bg-[#ECFDF5] rounded-md transition-all"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAction(item.id, 'rejected'); }}
                        className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-all"
                      >
                        <XCircle size={16} />
                      </button>
                      <button className="p-1.5 text-[#64748B] hover:bg-[#F8FAFC] rounded-md transition-all">
                        <ChevronRight size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1F9D8B] text-white rounded-lg">
                    <ShieldCheck size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Review Item: {selectedItem.id}</h3>
                    <p className="text-slate-500 text-xs font-medium">Case Reference: {selectedItem.caseId}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400">
                  <XCircle size={20} />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Reason for Review</label>
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <p className="text-rose-700 text-xs font-bold leading-relaxed">{selectedItem.reasonForReview}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">AI Confidence</label>
                      <span className="text-xl font-bold text-slate-900">{selectedItem.confidenceScore.toFixed(1)}%</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assigned Agent</label>
                      <span className="text-xs font-bold text-slate-900">{selectedItem.agentId}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="p-6 bg-slate-900 rounded-xl text-white">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      Timeline
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-px bg-white/10 relative">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-0.5">
                            {new Date(selectedItem.submittedAt).toLocaleString()}
                          </p>
                          <p className="text-xs font-bold">Submitted for Review</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-px bg-white/10 relative">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-0.5">
                            {new Date().toLocaleString()}
                          </p>
                          <p className="text-xs font-bold">Awaiting Human Decision</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction(selectedItem.id, 'approved')}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction(selectedItem.id, 'rejected')}
                      className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

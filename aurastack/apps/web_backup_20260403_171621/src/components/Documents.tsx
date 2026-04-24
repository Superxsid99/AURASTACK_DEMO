import React, { useState, useMemo } from 'react';
import { 
  Search, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  XCircle,
  Upload,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  File as FileIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePlatform } from '../context/PlatformContext';
import { Dropdown } from './Dropdown';

interface DocumentsProps {
  onSelectCase?: (caseId: string) => void;
}

const CASES_PER_PAGE = 12;

export function Documents({ onSelectCase }: DocumentsProps) {
  const { cases } = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const stats = useMemo(() => {
    const allDocs = cases.flatMap(c => c.documents || []);
    return [
      { label: 'Total Documents', value: allDocs.length, icon: FileIcon, color: 'text-[#0F172A]' },
      { label: 'Uploaded', value: allDocs.filter(d => d.status === 'uploaded').length, icon: CheckCircle2, color: 'text-[#059669]' },
      { label: 'Pending', value: allDocs.filter(d => d.status === 'pending').length, icon: Clock, color: 'text-[#64748B]' },
      { label: 'Failed', value: allDocs.filter(d => d.status === 'failed').length, icon: XCircle, color: 'text-[#DC2626]' },
    ];
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.customer.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedStatus === 'all') return matchesSearch;
      
      const hasStatus = c.documents?.some(doc => doc.status === selectedStatus);
      return matchesSearch && hasStatus;
    });
  }, [cases, searchQuery, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / CASES_PER_PAGE));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * CASES_PER_PAGE;
    return filteredCases.slice(start, start + CASES_PER_PAGE);
  }, [filteredCases, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded': return <CheckCircle2 size={14} className="text-[#059669]" strokeWidth={1.5} />;
      case 'pending': return <Clock size={14} className="text-[#64748B]" strokeWidth={1.5} />;
      case 'failed': return <XCircle size={14} className="text-[#DC2626]" strokeWidth={1.5} />;
      default: return <AlertCircle size={14} className="text-[#D97706]" strokeWidth={1.5} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded': return "badge badge-complete";
      case 'pending': return "badge bg-[#FFFBEB] text-[#D97706]";
      case 'failed': return "badge badge-error";
      default: return "badge badge-review";
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="page-title">Documents</h3>
          <p className="text-sm text-[#64748B] mt-0.5">Manage and track document processing across cases</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Upload size={16} />
          <span>Upload Batch</span>
        </button>
      </div>

      {/* Stats Grid - Dashboard style cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
          <div key={i} className="card-primary flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Icon size={16} strokeWidth={1.5} className={stat.color} />
                <span className="text-xs font-medium text-[#64748B] tracking-wide">{stat.label}</span>
              </div>
            </div>
            <span className="text-xl font-semibold text-[#0F172A]">{stat.value}</span>
          </div>
          );
        })}
      </div>

      {/* Filters - aligned search + dropdown */}
      <div className="filter-row">
        <div className="filter-search-wrap flex-1 min-w-0">
          <span className="filter-label">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search documents or cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base h-9 pl-9 pr-3"
            />
          </div>
        </div>
        <Dropdown 
          label="Status"
          options={[
            { label: 'All', value: 'all' },
            { label: 'Uploaded', value: 'uploaded' },
            { label: 'Pending', value: 'pending' },
            { label: 'Failed', value: 'failed' },
          ]}
          value={selectedStatus}
          onChange={setSelectedStatus}
          className="w-full md:w-48"
        />
      </div>

      {/* Case Groups - Paginated for performance */}
      <div className="space-y-6">
        {paginatedCases.map((c) => (
          <div key={c.id} className="card overflow-hidden p-0">
            {/* Group Header */}
            <div className="px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg border border-[#E2E8F0] text-[#1F9D8B]">
                  <FileIcon size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span 
                      onClick={() => onSelectCase?.(c.id)}
                      className="text-sm font-semibold text-[#1F9D8B] hover:text-[#178F7F] cursor-pointer transition-colors font-mono"
                    >
                      {c.id}
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                    <span className="text-sm font-medium text-[#0F172A]">{c.customer}</span>
                  </div>
                  <p className="meta-label mt-0.5">
                    {c.type} • {c.stage}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-900">
                      {c.documents?.filter(d => d.status === 'uploaded').length}/{c.documents?.length}
                    </span>
                    <span className="meta-label">Processed</span>
                  </div>
                  <div className="flex-1 h-1.5 w-24 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#1F9D8B] transition-all duration-500" 
                      style={{ width: `${((c.documents?.filter(d => d.status === 'uploaded').length || 0) / (c.documents?.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-all">
                  <RefreshCw size={12} />
                  Validate
                </button>
              </div>
            </div>

            {/* Document List Header */}
            <div className="px-6 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-8" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Document Name</span>
                </div>
                <div className="w-24 shrink-0 text-center">
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Type</span>
                </div>
                <div className="w-24 shrink-0 text-center">
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Pages</span>
                </div>
                <div className="w-32 shrink-0 text-center">
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Status</span>
                </div>
              </div>
              <div className="w-48 ml-8" />
            </div>

            {/* Document List */}
            <div className="divide-y divide-[#E2E8F0]">
              {c.documents?.map((doc) => (
                <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors group/row min-h-[56px]">
                  <div className="flex items-center gap-6 flex-1">
                    <div className="w-8 flex justify-center">
                      {getStatusIcon(doc.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-normal text-[#0F172A] truncate">{doc.name}</h5>
                    </div>
                    <div className="w-24 shrink-0 text-center">
                      <span className="text-xs font-normal text-[#64748B]">{doc.type}</span>
                    </div>
                    <div className="w-24 shrink-0 text-center">
                      <span className="text-xs font-normal text-[#64748B]">
                        {doc.pages ? `${doc.pages} pages` : '—'}
                      </span>
                    </div>
                    <div className="w-32 shrink-0 flex justify-center">
                      <span className={getStatusBadge(doc.status)}>{doc.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-8">
                    <button 
                      onClick={() => onSelectCase?.(c.id)}
                      className="text-xs font-medium text-[#1F9D8B] flex items-center gap-1.5 hover:underline"
                    >
                      <FileText size={12} />
                      View Case
                    </button>
                    {doc.status === 'pending' && (
                      <button className="text-xs font-medium text-[#059669] flex items-center gap-1.5 hover:underline">
                        <Upload size={12} />
                        Upload
                      </button>
                    )}
                    <button className="p-2 text-slate-300 hover:text-slate-900 opacity-0 group-hover/row:opacity-100 transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filteredCases.length > CASES_PER_PAGE && (
        <div className="flex items-center justify-between px-2">
          <div className="text-xs text-[#64748B] font-medium">
            Page <span className="text-[#0F172A] font-semibold">{currentPage}</span> of <span className="text-[#0F172A] font-semibold">{totalPages}</span>
            <span className="ml-2">({filteredCases.length} cases)</span>
          </div>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 btn-secondary text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 btn-secondary text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

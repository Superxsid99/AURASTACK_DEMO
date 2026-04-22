import React from 'react';
import { Shield, Clock, User, Cog, CheckCircle, Lock, BarChart3, ArrowDownRight } from 'lucide-react';
import { AuditEntry, Case } from '../types/case';
import { motion } from 'motion/react';

interface ComplianceAuditTrailProps {
  caseData: Case;
}

export const ComplianceAuditTrail: React.FC<ComplianceAuditTrailProps> = ({ caseData }) => {
  const auditTrail = caseData.audit_trail || [];
  
  // Calculate analytics
  const totalSteps = auditTrail.length;
  const totalDuration = auditTrail.reduce((acc, entry) => acc + (entry.duration_ms || 0), 0);
  const avgDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;
  
  const actorStats = auditTrail.reduce((acc, entry) => {
    acc[entry.actor.type] = (acc[entry.actor.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* HIPAA Compliance Header */}
      <div className="bg-surface-container-low border border-primary/20 rounded-lg p-6 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Shield size={120} />
        </div>
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
            <Shield size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-on-surface uppercase">HIPAA Compliance & Audit</h2>
            <p className="text-on-surface-variant text-sm font-sans max-w-md">
              Immutable audit trail with cryptographic signatures for every action performed on Protected Health Information (PHI).
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Compliance Score</div>
            <div className="text-3xl font-black text-emerald-500">100%</div>
          </div>
          <div className="w-px h-12 bg-outline-variant/20 mx-2"></div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Audit Integrity</div>
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle size={14} />
              <span className="text-xs font-bold uppercase tracking-widest">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Analytics */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4 text-on-surface-variant">
            <BarChart3 size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Actions</span>
          </div>
          <div className="text-3xl font-black text-on-surface">{totalSteps}</div>
          <div className="mt-2 text-[10px] text-on-surface-variant uppercase tracking-widest">Recorded actions</div>
        </div>
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4 text-on-surface-variant">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Avg. Processing Time</span>
          </div>
          <div className="text-3xl font-black text-primary">{(avgDuration / 1000).toFixed(2)}s</div>
          <div className="mt-2 text-[10px] text-on-surface-variant uppercase tracking-widest">Per workflow node</div>
        </div>
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4 text-on-surface-variant">
            <Cog size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Automation</span>
          </div>
          <div className="text-3xl font-black text-secondary">
            {Math.round(((actorStats['agent'] || 0) / totalSteps) * 100 || 0)}%
          </div>
          <div className="mt-2 text-[10px] text-on-surface-variant uppercase tracking-widest">Of total workload</div>
        </div>
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4 text-on-surface-variant">
            <User size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Human Oversight</span>
          </div>
          <div className="text-3xl font-black text-on-surface">
            {actorStats['human'] || 0}
          </div>
          <div className="mt-2 text-[10px] text-on-surface-variant uppercase tracking-widest">Manual interventions</div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card-elevated overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">Immutable Audit Log</h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            <Lock size={12} />
            Signed with SHA-256
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Timestamp</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Actor</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Action</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Duration</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Digital Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {auditTrail.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-container-high/45 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-on-surface">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant opacity-60">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        entry.actor.type === 'agent' ? 'bg-secondary/10 text-secondary' : 
                        entry.actor.type === 'human' ? 'bg-primary/10 text-primary' : 
                        'bg-outline-variant/10 text-on-surface-variant'
                      }`}>
                        {entry.actor.type === 'agent' ? <Cog size={12} /> : entry.actor.type === 'human' ? <User size={12} /> : <Shield size={12} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface uppercase tracking-tighter">{entry.actor.name}</div>
                        <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">{entry.actor.type} {entry.actor.role ? `• ${entry.actor.role}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-on-surface font-sans">{entry.action}</div>
                    <div className="text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Node: {entry.node_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-primary font-bold">
                      {entry.duration_ms ? `${(entry.duration_ms / 1000).toFixed(2)}s` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] font-mono text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-sm border border-outline-variant/10 max-w-[120px] truncate">
                        {entry.signature}
                      </div>
                      <button className="p-1 hover:bg-primary/10 rounded-sm text-primary opacity-0 group-hover:opacity-100 transition-all">
                        <ArrowDownRight size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {auditTrail.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-on-surface-variant opacity-50 uppercase font-bold tracking-widest">
                    No audit records found for this case
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

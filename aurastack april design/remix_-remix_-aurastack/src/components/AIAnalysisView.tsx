import React from 'react';
import { 
  BarChart3, 
  ShieldCheck, 
  AlertCircle, 
  UserCheck, 
  FileSearch, 
  Activity, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  ArrowUpRight,
  Timer,
  FileText,
  Database,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Case } from '../types/case';
import { AgentDefinition } from '../types/agent';

interface AIAnalysisViewProps {
  caseData: Case;
  agents: AgentDefinition[];
}

export const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({ caseData, agents }) => {
  const navigate = useNavigate();
  
  // Mock analysis data based on case type and status
  const analysis = {
    truth_summary: caseData.ai_insights?.find(i => i.type === 'RISK')?.description || caseData.summary || "Summary is still being assembled. Initial indicators suggest a standard processing path with no immediate red flags in the primary documentation.",
    person_policy: caseData.ai_insights?.find(i => i.type === 'COMPLIANCE')?.description || "Automated cross-reference between claimant identity and policy parameters confirms 100% eligibility for the requested services. No coverage gaps detected.",
    fraud_validation: caseData.ai_insights?.find(i => i.type === 'ANOMALY')?.description || "Fraud review completed across behavioral patterns, billing history, and provider reputation—all within the low-risk band.",
    compliance_score: caseData.compliance_score || 98,
    risk_score: caseData.risk_score || 12
  };

  // Circular Progress Component
  const CircularProgress = ({ value, label, color }: { value: number, label: string, color: string }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-on-surface/5"
            />
            <motion.circle
              cx="48"
              cy="48"
              r={radius}
              stroke={color}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-on-surface">{value}%</span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{label}</span>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-7xl mx-auto pb-20"
    >
      {/* Top Stats Bar */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-sm">
              <BarChart3 size={18} className="text-primary" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Model confidence</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">94.2%</span>
            <span className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-tighter">High</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-sm">
              <ShieldCheck size={18} className="text-emerald-500" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Compliance</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{analysis.compliance_score}%</span>
            <span className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-tighter">Verified</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-sm">
              <Activity size={18} className="text-amber-500" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Risk Index</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">{analysis.risk_score}/100</span>
            <span className="text-[10px] font-bold text-amber-500 mb-1 uppercase tracking-tighter">Low Risk</span>
          </div>
        </div>

        <div className="card-elevated p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-sm">
              <Timer size={18} className="text-primary" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Processing time</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-on-surface">0.8s</span>
            <span className="text-[10px] font-bold text-primary mb-1 uppercase tracking-tighter">Real-time</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Deep Analysis */}
        <div className="col-span-8 space-y-8">
          {/* The Truth of the Case */}
          <section className="card-elevated p-8 relative">
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em]">Live review</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <FileText size={20} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">The Truth of the Case</h2>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-sm text-on-surface-variant leading-relaxed font-sans">
                {analysis.truth_summary}
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Identity & Policy Alignment</h4>
                <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                  {analysis.person_policy}
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Fraud & Coverage Validation</h4>
                <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                  {analysis.fraud_validation}
                </p>
              </div>
            </div>
          </section>

          {/* Medical Data Extraction Status */}
          <section className="card-elevated p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Medical Data Extraction Status</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Processing</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-8">
              <CircularProgress value={100} label="Identity Verified" color="#10b981" />
              <CircularProgress value={100} label="Policy Matched" color="#10b981" />
              <CircularProgress value={85} label="Medical Records" color="#0066FF" />
              <CircularProgress value={40} label="Lab Analysis" color="#0066FF" />
            </div>
          </section>
        </div>

        {/* Right Column: Insights & Actions */}
        <div className="col-span-4 space-y-8">
          {/* Risk Markers */}
          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Risk Markers</h2>
            </div>
            <div className="space-y-4">
              {caseData.risk_markers?.map((marker) => (
                <div key={marker.id} className="card-elevated p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">{marker.type}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">{marker.status}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">{marker.description}</p>
                </div>
              ))}
              {(!caseData.risk_markers || caseData.risk_markers.length === 0) && (
                <div className="card-elevated p-4">
                  <p className="text-[11px] text-on-surface-variant leading-tight">No significant risk markers identified.</p>
                </div>
              )}
            </div>
          </section>

          {/* Next Recommended Actions */}
          <section className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 size={18} className="text-primary" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">Next Recommended Actions</h2>
            </div>
            <div className="space-y-3">
              <button type="button" className="card-elevated--interactive w-full p-4 text-left group">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Automated Action</span>
                  <ArrowUpRight size={12} className="text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <p className="text-[11px] font-bold text-on-surface uppercase tracking-tight">Approve Medical Necessity</p>
              </button>
              <button type="button" className="card-elevated--interactive w-full p-4 text-left group transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Manual Review</span>
                  <ArrowUpRight size={12} className="text-on-surface-variant group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <p className="text-[11px] font-bold text-on-surface uppercase tracking-tight">Verify Lab Results Consistency</p>
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

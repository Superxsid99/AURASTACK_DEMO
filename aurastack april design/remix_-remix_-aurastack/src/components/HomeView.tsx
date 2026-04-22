import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Mail,
  MessageSquare,
  ArrowUpRight,
  Play
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const HomeView: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = React.useState([
    { id: 1, title: 'Missing Documentation', desc: 'Case #8829-X requires SOC2 audit trail mapping.', icon: AlertTriangle },
    { id: 2, title: 'Validation Rules', desc: 'All 14 active healthcare workflows passed validation.', icon: CheckCircle2, opacity: 'opacity-60' }
  ]);

  const resolveAlerts = () => {
    setAlerts([]);
  };

  const handleViewCase = (id: string) => {
    navigate(`/cases/${id}`);
  };

  const handleViewWorkflow = (id: string) => {
    navigate(`/workflows/${id}`);
  };

  return (
    <div className="page-shell space-y-6">
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 card-elevated-primary relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl p-6">
          <div>
            <p className="mb-1 text-xs text-on-surface-variant">Overview</p>
            <h2 className="mb-2 text-xl font-semibold tracking-tight text-on-surface">System health</h2>
            <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant">
              Case orchestration is performing at 98.4% efficiency. No critical bottlenecks detected in the last 6 hours.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Metric label="Throughput" value="14.2k" suffix="req/s" />
            <Metric label="Active threads" value="842" />
            <Metric label="Avg latency" value="24ms" />
            <Metric label="Error rate" value="0.02%" muted />
          </div>
        </div>
        <div className="card-elevated col-span-12 flex flex-col p-6 lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-on-surface">Compliance</h3>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-high text-on-surface-variant">
              <ShieldCheck size={15} strokeWidth={1.5} aria-hidden />
            </div>
          </div>
          <div className="flex-1 space-y-4">
            {alerts.length > 0 ? (
              alerts.map(alert => (
                <div key={alert.id} className={`flex items-start gap-3 ${alert.opacity || ''}`}>
                  <alert.icon size={14} className="mt-0.5 shrink-0 text-on-surface-variant" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{alert.desc}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-on-surface-variant">
                <CheckCircle2 size={22} className="mb-2 opacity-50" strokeWidth={1.5} aria-hidden />
                <p className="text-xs font-medium">All clear</p>
              </div>
            )}
          </div>
          <button 
            type="button"
            onClick={resolveAlerts}
            disabled={alerts.length === 0}
            className="btn btn-outline btn-block mt-6"
          >
            Resolve all
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <span className="h-3 w-px rounded-full bg-primary" aria-hidden /> Cases
          </h3>
          <button 
            type="button"
            onClick={() => navigate('/cases')}
            className="text-xs text-on-surface-variant transition-colors hover:text-primary"
          >
            View all cases
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <CaseCard 
            id="#KYC-882"
            status="PENDING"
            statusClass="bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-200"
            title="KYC Verification: Sarah Jenkins"
            desc="Identity documents uploaded. Cross-reference with sanctions lists complete. 85% confidence score."
            avatars={['https://picsum.photos/seed/user1/100/100']}
            onClick={() => handleViewCase('case-kyc-1')}
          />
          <CaseCard 
            id="#UW-442"
            status="IN REVIEW"
            statusClass="bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
            title="Underwriting: Life Policy v2"
            desc="Complex medical history detected. Automated risk assessment suggests 15% premium loading."
            avatars={['https://picsum.photos/seed/doc2/100/100']}
            count="+1"
            onClick={() => handleViewCase('case-uw-1')}
          />
          <CaseCard 
            id="#CLM-901"
            status="CRITICAL"
            statusClass="bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
            title="Auto Claim: Multi-Vehicle"
            desc="Major accident reported. Hospital intake triggered. Fraud review analyzing impact patterns."
            automated
            onClick={() => handleViewCase('case-clm-1')}
          />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-3 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-on-surface">
              <span className="h-3 w-px rounded-full bg-primary" aria-hidden /> Workflows
            </h3>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => navigate('/system')}
                className="btn btn-ghost px-2 text-xs text-on-surface-variant hover:text-primary"
              >
                Live monitor
              </button>
              <span className="text-on-surface-variant/30 text-xs" aria-hidden>|</span>
              <button 
                type="button"
                onClick={() => navigate('/workflows')}
                className="btn btn-ghost px-2 text-xs text-on-surface-variant hover:text-primary"
              >
                View all
              </button>
            </div>
          </div>
          <div className="card-elevated divide-y divide-outline-variant/15 overflow-hidden p-0">
            <WorkflowRow 
              name="KYC-Onboarding" 
              progress={92} 
              status="92% complete" 
              compliance="GDPR"
              role="Onboarding Specialist"
              lastUpdate="2m ago"
              onClick={() => handleViewWorkflow('wf-1')}
            />
            <WorkflowRow 
              name="Medical-Underwriting" 
              progress={65} 
              status="65% complete" 
              compliance="HIPAA"
              role="Underwriter"
              lastUpdate="14m ago"
              onClick={() => handleViewWorkflow('wf-2')}
            />
            <WorkflowRow 
              name="Policy-Renewals" 
              progress={28} 
              status="28% complete" 
              compliance="ISO 27001"
              role="Claims Manager"
              lastUpdate="1h ago"
              onClick={() => handleViewWorkflow('wf-3')}
            />
            <WorkflowRow 
              name="Compliance-Audit" 
              progress={10} 
              status="10% complete" 
              compliance="SOC2"
              role="Compliance Officer"
              lastUpdate="Just now"
              warning
              onClick={() => handleViewWorkflow('wf-4')}
            />
          </div>
        </div>

        <div className="col-span-12 space-y-3 lg:col-span-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <span className="h-3 w-px rounded-full bg-primary" aria-hidden /> Intake
          </h3>
          <div className="space-y-3">
            <IntakeCard 
              name="Website Chat" 
              count={12} 
              trend="+4 new" 
              icon={MessageSquare} 
              iconWrapClass="bg-primary/10 text-primary"
              onClick={() => navigate('/inbox')}
            />
            <IntakeCard 
              name="Support Email" 
              count={45} 
              trend="+8 new" 
              icon={Mail} 
              iconWrapClass="bg-surface-container-high text-on-surface-variant"
              onClick={() => navigate('/inbox')}
            />
          </div>
          <button 
            type="button"
            onClick={() => navigate('/inbox')}
            className="btn btn-muted btn-block border border-[#e5e7eb]"
          >
            Open inbox
            <ArrowUpRight size={14} className="shrink-0" />
          </button>
        </div>
      </section>
    </div>
  );
};

function Metric({ label, value, suffix, muted }: { label: string; value: string; suffix?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className={`mt-1 truncate text-base font-semibold tabular-nums ${muted ? 'text-on-surface-variant' : 'text-on-surface'}`}>
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-on-surface-variant">{suffix}</span>}
      </p>
    </div>
  );
}

const IntakeCard = ({ name, count, trend, icon: Icon, iconWrapClass, onClick }: {
  name: string;
  count: number;
  trend: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number | string }>;
  iconWrapClass: string;
  onClick: () => void;
}) => (
  <div 
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    role="button"
    tabIndex={0}
    className="card-elevated--interactive flex cursor-pointer items-center justify-between rounded-xl p-4"
  >
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconWrapClass}`}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-medium text-on-surface">{name}</p>
        <p className="text-xs text-on-surface-variant">{trend}</p>
      </div>
    </div>
    <div className="text-lg font-semibold tabular-nums text-on-surface">{count}</div>
  </div>
);

const CaseCard = ({ id, status, statusClass, title, desc, avatars, count, automated, onClick }: {
  id: string;
  status: string;
  statusClass: string;
  title: string;
  desc: string;
  avatars?: string[];
  count?: string;
  automated?: boolean;
  onClick: () => void;
}) => (
  <div 
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    role="button"
    tabIndex={0}
    className="card-elevated--interactive flex cursor-pointer flex-col rounded-xl p-4"
  >
    <div className="mb-3 flex items-start justify-between gap-2">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}>{status}</span>
      <span className="shrink-0 text-xs text-on-surface-variant">{id}</span>
    </div>
    <h4 className="mb-1 text-sm font-medium leading-snug text-on-surface">{title}</h4>
    <p className="mb-4 line-clamp-2 text-sm text-on-surface-variant">{desc}</p>
    <div className="mt-auto flex items-center border-t border-[#e5e7eb] pt-3">
      <div className="flex -space-x-2">
        {automated ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-surface-container-high text-[8px] font-semibold text-on-surface-variant" title="Automated queue">
            Auto
          </div>
        ) : (
          avatars?.map((src, i) => (
            <img key={i} className="h-7 w-7 rounded-full border-2 border-white object-cover" src={src} alt="" referrerPolicy="no-referrer" />
          ))
        )}
        {count && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-surface-container-high text-[9px] font-medium text-on-surface-variant">
            {count}
          </div>
        )}
      </div>
    </div>
  </div>
);

const WorkflowRow = ({ name, progress, status, compliance, role, lastUpdate, warning, onClick }: {
  name: string;
  progress: number;
  status: string;
  compliance?: string;
  role: string;
  lastUpdate: string;
  warning?: boolean;
  onClick: () => void;
}) => {
  const fillClass = warning ? 'bg-yellow-500' : 'bg-primary';

  return (
    <div 
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-high/40 sm:gap-4 sm:px-5 sm:py-4"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-on-surface">{name}</span>
              {compliance && (
                <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                  {compliance}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              <span>{role}</span>
              <span className="mx-1.5 text-on-surface-variant/40" aria-hidden>·</span>
              <span>{lastUpdate}</span>
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium ${warning ? 'text-yellow-700' : 'text-on-surface-variant'}`}>
            {status}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${fillClass}`}
          />
        </div>
      </div>
      <div className="hidden shrink-0 gap-1 sm:flex" onClick={e => e.stopPropagation()}>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            import('sonner').then(({ toast }) => toast.success(`Workflow ${name} execution triggered.`));
          }}
          className="btn-icon border border-transparent bg-surface-container-high text-on-surface-variant"
          title="Run workflow"
        >
          <Play size={12} strokeWidth={1.5} />
        </button>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="btn-icon border border-transparent bg-surface-container-high text-on-surface-variant"
          title="Open workflow"
        >
          <ArrowUpRight size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

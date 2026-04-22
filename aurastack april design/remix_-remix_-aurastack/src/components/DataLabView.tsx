import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Upload, 
  FileJson, 
  Table, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Download,
  Search,
  Filter,
  Plus,
  Play,
  Activity,
  ShieldCheck,
  Table2,
  Cloud,
  Link,
  Settings2,
  RefreshCw,
  History,
  ExternalLink,
  ChevronRight,
  FileSpreadsheet,
  FileCode,
  Globe,
  Lock,
  Server,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { Case } from '../types/case';
import { v4 as uuidv4 } from 'uuid';

interface DataLabViewProps {
  onImport: (newCases: Case[]) => void;
}

type SourceType = 'SALESFORCE' | 'DUCK_CREEK' | 'GUIDEWIRE' | 'CSV' | 'EXCEL' | 'JSON_API' | 'SAP' | 'SERVICENOW' | 'EMAIL';

interface Connector {
  id: SourceType;
  name: string;
  category: 'CRM' | 'CORE_INSURANCE' | 'FILE' | 'API' | 'ERP';
  icon: any;
  description: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING';
  lastSync?: string;
}

const CONNECTORS: Connector[] = [
  { id: 'SALESFORCE', name: 'Salesforce CRM', category: 'CRM', icon: Cloud, description: 'Sync policyholder data and lead information directly from Salesforce.', status: 'CONNECTED', lastSync: '2026-03-30T14:20:00Z' },
  { id: 'DUCK_CREEK', name: 'Duck Creek', category: 'CORE_INSURANCE', icon: ShieldCheck, description: 'Deep integration with Duck Creek Policy and Claims modules.', status: 'CONNECTED', lastSync: '2026-03-30T12:00:00Z' },
  { id: 'GUIDEWIRE', name: 'Guidewire', category: 'CORE_INSURANCE', icon: Database, description: 'Native connector for Guidewire InsuranceSuite (PolicyCenter/ClaimCenter).', status: 'DISCONNECTED' },
  { id: 'CSV', name: 'CSV / Excel', category: 'FILE', icon: FileSpreadsheet, description: 'Bulk upload claims or underwriting data via spreadsheets.', status: 'DISCONNECTED' },
  { id: 'JSON_API', name: 'JSON API', category: 'API', icon: FileCode, description: 'Connect to custom REST/GraphQL endpoints for real-time data.', status: 'DISCONNECTED' },
  { id: 'SAP', name: 'SAP S/4HANA', category: 'ERP', icon: Server, description: 'Financial reconciliation and enterprise resource planning sync.', status: 'DISCONNECTED' },
  { id: 'SERVICENOW', name: 'ServiceNow', category: 'ERP', icon: Activity, description: 'Sync IT and operational risk data for commercial underwriting.', status: 'DISCONNECTED' },
  { id: 'EMAIL', name: 'Email Intake', category: 'API', icon: Mail, description: 'Ingest claims and inquiries directly from shared mailboxes (Outlook/Gmail).', status: 'CONNECTED', lastSync: '2026-03-31T06:00:00Z' },
];

export const DataLabView: React.FC<DataLabViewProps> = ({ onImport }) => {
  const { subtab } = useParams<{ subtab: string }>();
  const navigate = useNavigate();
  const activeTab = (subtab?.toUpperCase() || 'CONNECTORS') as 'CONNECTORS' | 'IMPORT' | 'HISTORY';
  
  const setActiveTab = (tab: string) => {
    navigate(`/datalab/${tab.toLowerCase()}`);
  };
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [step, setStep] = useState<'SELECT' | 'CONNECT' | 'PREVIEW' | 'MAPPING' | 'QUALITY' | 'SUCCESS'>('SELECT');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const handleConnect = (connector: Connector) => {
    setSelectedConnector(connector);
    setStep('CONNECT');
  };

  const handleVerifyConnection = () => {
    setIsProcessing(true);
    // Simulate connection and fetching sample data
    setTimeout(() => {
      let mockData: any[] = [];
      if (selectedConnector?.id === 'SALESFORCE') {
        mockData = [
          { sf_id: 'SF-001', contact_name: 'John Smith', policy_type: 'Auto', premium: 1200, status: 'Active', risk_rating: 'Low' },
          { sf_id: 'SF-002', contact_name: 'Sarah Connor', policy_type: 'Home', premium: 2500, status: 'Pending', risk_rating: 'High' },
          { sf_id: 'SF-003', contact_name: 'Bruce Wayne', policy_type: 'Life', premium: 15000, status: 'Active', risk_rating: 'Medium' },
        ];
      } else if (selectedConnector?.id === 'EMAIL') {
        mockData = [
          { email_id: 'MSG-102', sender: 'hospital_admin@cityhealth.org', subject: 'New Patient Intake: Case #8821', received: '2026-03-31 05:45', priority: 'High' },
          { email_id: 'MSG-103', sender: 'claims_dept@auto-insure.com', subject: 'Evidence Submission: Claim DC-9921', received: '2026-03-31 06:12', priority: 'Medium' },
          { email_id: 'MSG-104', sender: 'customer_support@aurastack.one', subject: 'General Inquiry: Policy #SF-001', received: '2026-03-31 06:25', priority: 'Low' },
        ];
      } else if (selectedConnector?.id === 'DUCK_CREEK') {
        mockData = [
          { dc_claim_id: 'DC-9921', claimant: 'Alice Thompson', loss_date: '2026-03-15', reserve: 45000, coverage: 'Comprehensive', status: 'Open' },
          { dc_claim_id: 'DC-8812', claimant: 'Bob Richards', loss_date: '2026-03-20', reserve: 12000, coverage: 'Collision', status: 'In Review' },
        ];
      } else {
        mockData = [
          { id: '1', title: 'Sample 1', value: 100 },
          { id: '2', title: 'Sample 2', value: 200 },
        ];
      }
      setPreviewData(mockData);
      setIsProcessing(false);
      setStep('PREVIEW');
    }, 1500);
  };

  const handleExecuteImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const newCases: Case[] = previewData.map(row => {
        const id = row.sf_id || row.dc_claim_id || row.email_id || row.id || uuidv4();
        const title = row.contact_name ? `Policy Sync: ${row.contact_name}` : 
                     row.claimant ? `Claim Sync: ${row.claimant}` : 
                     row.subject ? `Email Intake: ${row.subject}` : 
                     `Data Import: ${id}`;
        
        return {
          id: `EXT-${id}`,
          title,
          description: `Imported from ${selectedConnector?.name}. Original ID: ${id}.`,
          status: 'STABLE',
          execution_status: 'PENDING',
          priority: 'MEDIUM',
          type: row.dc_claim_id ? 'CLAIM' : 'UNDERWRITING',
          department: 'CLAIMS',
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          summary: `Data synchronized from ${selectedConnector?.name} enterprise connector.`,
          timeline: [
            {
              title: 'Enterprise Sync Initiated',
              description: `Data pulled from ${selectedConnector?.name} production environment.`,
              timestamp: new Date().toISOString(),
              type: 'system'
            }
          ]
        };
      });
      onImport(newCases);
      setIsProcessing(false);
      setStep('SUCCESS');
    }, 2000);
  };

  return (
    <div className="page-shell max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <p className="page-kicker">Data</p>
          <h1 className="page-title">Data Lab</h1>
          <p className="page-description max-w-2xl">
            Connectors and imports from core systems, files, and APIs.
          </p>
        </div>
        <div className="flex bg-surface-container rounded-sm p-1 border border-outline-variant/10">
          <TabButton active={activeTab === 'CONNECTORS'} onClick={() => setActiveTab('CONNECTORS')} icon={Link} label="Connectors" />
          <TabButton active={activeTab === 'IMPORT'} onClick={() => setActiveTab('IMPORT')} icon={Upload} label="File Import" />
          <TabButton active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} icon={History} label="Sync History" />
        </div>
      </header>

      {activeTab === 'CONNECTORS' && (
        <div className="space-y-6">
          {step === 'SELECT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CONNECTORS.map((connector) => (
                <ConnectorCard 
                  key={connector.id} 
                  connector={connector} 
                  onClick={() => handleConnect(connector)}
                  isProcessing={isProcessing && selectedConnector?.id === connector.id}
                />
              ))}
            </div>
          )}

          {step !== 'SELECT' && selectedConnector && (
            <div className="card-elevated overflow-hidden min-h-[600px] flex flex-col">
              {/* Stepper */}
              <div className="flex border-b border-outline-variant/10 bg-surface-container">
                {[
                  { id: 'CONNECT', label: 'Authentication' },
                  { id: 'PREVIEW', label: 'Data Preview' },
                  { id: 'MAPPING', label: 'Field Mapping' },
                  { id: 'QUALITY', label: 'Data Quality' },
                  { id: 'SUCCESS', label: 'Sync Complete' }
                ].map((s, i) => (
                  <div 
                    key={s.id}
                    className={`flex-1 px-6 py-4 flex items-center gap-3 border-r border-outline-variant/10 last:border-0 transition-colors ${step === s.id ? 'bg-surface-container-highest text-primary' : 'opacity-40'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.id ? 'bg-primary text-on-primary' : 'bg-outline-variant/20 text-on-surface'}`}>
                      {i + 1}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 p-8">
                <AnimatePresence mode="wait">
                  {step === 'CONNECT' && (
                    <motion.div 
                      key="connect"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="max-w-2xl mx-auto space-y-8"
                    >
                      <div className="text-center">
                        <div className="inline-flex p-4 bg-primary/10 rounded-full text-primary mb-4">
                          <selectedConnector.icon size={32} />
                        </div>
                        <h3 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
                          Authenticate {selectedConnector.name}
                        </h3>
                        <p className="text-sm text-on-surface-variant mt-2">
                          Configure your enterprise credentials to establish a secure data bridge.
                        </p>
                      </div>

                      <div className="bg-surface-container p-8 rounded-sm border border-outline-variant/10 space-y-6">
                        {selectedConnector.id === 'SALESFORCE' && (
                          <>
                            <AuthField label="Instance URL" placeholder="https://login.salesforce.com" />
                            <AuthField label="Client ID" placeholder="00D50000000I..." />
                            <AuthField label="Client Secret" placeholder="••••••••••••••••" type="password" />
                            <div className="p-4 bg-surface-container-highest/50 rounded-sm border border-outline-variant/10">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Callback URL</p>
                              <code className="text-[10px] text-primary break-all">https://api.aurastack.one/auth/callback/salesforce</code>
                            </div>
                          </>
                        )}

                        {selectedConnector.id === 'DUCK_CREEK' && (
                          <>
                            <AuthField label="Environment URL" placeholder="https://duckcreek.example.com" />
                            <AuthField label="API Key" placeholder="dc_live_..." type="password" />
                            <AuthField label="Tenant ID" placeholder="tenant-123" />
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-sm">
                              <AlertCircle size={14} className="text-amber-500" />
                              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Requires PolicyCenter API Access</p>
                            </div>
                          </>
                        )}

                        {selectedConnector.id === 'GUIDEWIRE' && (
                          <>
                            <AuthField label="Server URL" placeholder="https://guidewire.example.com" />
                            <AuthField label="API Key" placeholder="gw_auth_..." type="password" />
                            <AuthField label="Username" placeholder="api_service_user" />
                            <AuthField label="Password" placeholder="••••••••••••••••" type="password" />
                          </>
                        )}

                        {selectedConnector.id === 'EMAIL' && (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <button className="p-4 bg-surface-container-highest border border-primary/40 rounded-sm flex flex-col items-center gap-2">
                                <Cloud size={20} className="text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Outlook</span>
                              </button>
                              <button className="p-4 bg-surface-container-low border border-outline-variant/10 rounded-sm flex flex-col items-center gap-2 opacity-50">
                                <Globe size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Gmail</span>
                              </button>
                              <button className="p-4 bg-surface-container-low border border-outline-variant/10 rounded-sm flex flex-col items-center gap-2 opacity-50">
                                <Server size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Custom</span>
                              </button>
                            </div>
                            <AuthField label="Shared Mailbox Address" placeholder="claims-intake@company.com" />
                            <AuthField label="App Password" placeholder="•••• •••• •••• ••••" type="password" />
                          </>
                        )}

                        {selectedConnector.id === 'SAP' && (
                          <>
                            <AuthField label="S/4HANA Instance URL" placeholder="https://sap-instance.company.com" />
                            <AuthField label="Client Number" placeholder="100" />
                            <AuthField label="API Key" placeholder="sap_api_..." type="password" />
                          </>
                        )}

                        {selectedConnector.id === 'SERVICENOW' && (
                          <>
                            <AuthField label="Instance Name" placeholder="dev12345" />
                            <AuthField label="Username" placeholder="admin" />
                            <AuthField label="Password" placeholder="••••••••••••••••" type="password" />
                          </>
                        )}

                        {selectedConnector.id === 'JSON_API' && (
                          <>
                            <AuthField label="Base URL" placeholder="https://api.example.com/v1" />
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Authentication Type</label>
                              <select className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-sm p-3 text-xs text-on-surface focus:outline-none focus:border-primary/40">
                                <option>Bearer Token</option>
                                <option>API Key (Header)</option>
                                <option>Basic Auth</option>
                                <option>None</option>
                              </select>
                            </div>
                            <AuthField label="Token / Key" placeholder="eyJh..." type="password" />
                          </>
                        )}

                        {selectedConnector.id === 'CSV' && (
                          <div className="text-center py-8 space-y-4">
                            <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto">
                              <Lock size={24} className="text-on-surface-variant" />
                            </div>
                            <p className="text-xs text-on-surface-variant">No authentication required for local file imports.</p>
                          </div>
                        )}

                        <div className="pt-4 flex gap-4">
                          <button 
                            onClick={() => setStep('SELECT')}
                            className="flex-1 px-6 py-3 border border-outline-variant/20 text-on-surface text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-surface-container-high transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleVerifyConnection}
                            disabled={isProcessing}
                            className="flex-1 px-6 py-3 bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                          >
                            {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                            Verify & Connect
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-8 opacity-40">
                        <div className="flex items-center gap-2">
                          <Lock size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">AES-256 Encrypted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">SOC2 Compliant</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'PREVIEW' && (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold font-headline text-on-surface uppercase tracking-tight">
                            {selectedConnector.name} Data Stream
                          </h3>
                          <p className="text-xs text-on-surface-variant">Detected {previewData.length} records ready for synchronization.</p>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setStep('SELECT')}
                            className="btn btn-outline"
                          >
                            Cancel
                          </button>
                          <button 
                            type="button"
                            onClick={() => setStep('MAPPING')}
                            className="btn btn-primary"
                          >
                            Configure mapping
                            <ArrowRight size={14} className="shrink-0" />
                          </button>
                        </div>
                      </div>

                      <div className="border border-outline-variant/10 rounded-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-container text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                              {Object.keys(previewData[0]).map(key => (
                                <th key={key} className="px-4 py-3 border-r border-outline-variant/5 last:border-0">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/5">
                            {previewData.map((row, i) => (
                              <tr key={i} className="hover:bg-surface-container-high/35 transition-colors">
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="px-4 py-3 text-[11px] text-on-surface-variant font-mono">{val}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {step === 'MAPPING' && (
                    <motion.div 
                      key="mapping"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold font-headline text-on-surface uppercase tracking-tight">Enterprise Schema Mapping</h3>
                          <p className="text-xs text-on-surface-variant">Map {selectedConnector.name} fields to Aurastack Intelligence schema.</p>
                        </div>
                        <button 
                          onClick={() => setStep('QUALITY')}
                          className="px-8 py-3 bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                        >
                          Validate Quality
                          <ArrowRight size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Core Identity</h4>
                          <MappingRow label="External ID" source={Object.keys(previewData[0])[0]} />
                          <MappingRow label="Entity Title" source={Object.keys(previewData[0])[1]} />
                          <MappingRow label="Category" source="Auto-Detected" />
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Financial Context</h4>
                          <MappingRow label="Total Value" source={Object.keys(previewData[0]).find(k => k.includes('premium') || k.includes('reserve')) || 'N/A'} />
                          <MappingRow label="Risk Score" source="Calculated" />
                          <MappingRow label="SLA Status" source="Dynamic" />
                        </div>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-sm border border-primary/20 flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                          <Table2 size={18} />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">AI Mapping Engine Active</h4>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            Aurastack AI has analyzed the {selectedConnector.name} metadata and automatically mapped 85% of the fields. Manual verification is recommended for financial fields.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'QUALITY' && (
                    <motion.div 
                      key="quality"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold font-headline text-on-surface uppercase tracking-tight">Data Quality Assurance</h3>
                          <p className="text-xs text-on-surface-variant">Running validation rules against the incoming data stream.</p>
                        </div>
                        <button 
                          onClick={handleExecuteImport}
                          disabled={isProcessing}
                          className="px-8 py-3 bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                          Execute Sync
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        <QualityCheck title="Schema Validation" status="PASS" desc="All fields match the required data types." />
                        <QualityCheck title="PII Redaction" status="PASS" desc="Sensitive identifiers have been flagged for masking." />
                        <QualityCheck title="Duplicate Check" status="PASS" desc="No existing records match the incoming IDs." />
                        <QualityCheck title="Completeness" status="WARNING" desc="3 records are missing optional 'email' fields." />
                        <QualityCheck title="Integrity" status="PASS" desc="Foreign key relationships are valid." />
                        <QualityCheck title="Compliance" status="PASS" desc="Data meets SOC2 and HIPAA requirements." />
                      </div>
                    </motion.div>
                  )}

                  {step === 'SUCCESS' && (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center space-y-6"
                    >
                      <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={40} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">Enterprise Sync Successful</h3>
                        <p className="text-on-surface-variant max-w-md mx-auto mt-2">
                          {previewData.length} records from {selectedConnector?.name} have been successfully synchronized and ingested into the claims engine.
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => { setStep('SELECT'); setSelectedConnector(null); }}
                          className="px-8 py-3 border border-outline-variant/20 text-on-surface text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-surface-container-high transition-colors"
                        >
                          Back to Connectors
                        </button>
                        <button 
                          onClick={() => setActiveTab('HISTORY')}
                          className="px-8 py-3 bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
                        >
                          View Sync History
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'IMPORT' && (
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <div className="rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-lowest p-12 flex flex-col items-center justify-center text-center transition-all hover:shadow-md hover:shadow-black/5 group cursor-pointer">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="text-on-surface-variant group-hover:text-primary transition-colors" size={32} />
              </div>
              <h3 className="text-xl font-bold font-headline text-on-surface uppercase tracking-tight mb-2">Drop Files to Ingest</h3>
              <p className="text-on-surface-variant text-sm max-w-xs mb-8">
                Support for CSV, Excel (.xlsx), and JSON. Maximum file size 500MB for batch processing.
              </p>
              <button className="px-8 py-3 bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity">
                Select Files
              </button>
            </div>

            <div className="card-elevated p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
                <Settings2 size={14} />
                Ingestion Settings
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <SettingToggle label="Auto-Triage" desc="Automatically assign cases to agents based on content." active />
                  <SettingToggle label="PII Masking" desc="Redact sensitive information during ingestion." active />
                </div>
                <div className="space-y-4">
                  <SettingToggle label="Duplicate Detection" desc="Check for existing records before creating new cases." active />
                  <SettingToggle label="AI Summarization" desc="Generate initial case summaries using LLM." />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-elevated p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Recent Uploads</h3>
              <div className="space-y-4">
                <RecentUpload name="claims_batch_march.csv" size="4.2 MB" date="2 hours ago" status="COMPLETED" />
                <RecentUpload name="underwriting_data.xlsx" size="12.8 MB" date="5 hours ago" status="COMPLETED" />
                <RecentUpload name="api_dump_v2.json" size="1.1 MB" date="Yesterday" status="FAILED" />
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Play size={16} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Pro Tip</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Use the **JSON API** connector for real-time streaming data. It supports webhook callbacks for instant case creation.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="px-6 py-4">Sync ID</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Records</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              <HistoryRow id="SYNC-8821" source="Salesforce" type="CRM" records={124} status="SUCCESS" time="2026-03-30 14:20" />
              <HistoryRow id="SYNC-8820" source="Duck Creek" type="CORE" records={45} status="SUCCESS" time="2026-03-30 12:00" />
              <HistoryRow id="SYNC-8819" source="Manual Upload" type="FILE" records={12} status="FAILED" time="2026-03-29 18:45" />
              <HistoryRow id="SYNC-8818" source="Salesforce" type="CRM" records={89} status="SUCCESS" time="2026-03-29 14:20" />
              <HistoryRow id="SYNC-8817" source="JSON API" type="API" records={230} status="SUCCESS" time="2026-03-29 09:00" />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    type="button"
    onClick={onClick}
    className={`btn gap-2 px-4 transition-all ${active ? 'bg-surface-container-highest text-primary shadow-sm' : 'bg-transparent text-on-surface-variant hover:text-on-surface'}`}
  >
    <Icon size={14} className="shrink-0" />
    {label}
  </button>
);

const ConnectorCard = ({ connector, onClick, isProcessing }: any) => (
  <button 
    onClick={onClick}
    disabled={isProcessing}
    className="card-elevated--interactive p-6 text-left transition-all group relative overflow-hidden"
  >
    <div className="flex justify-between items-start mb-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
        <connector.icon size={24} />
      </div>
      <div className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${connector.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-surface-container text-on-surface-variant'}`}>
        {connector.status}
      </div>
    </div>
    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-2">{connector.name}</h3>
    <p className="text-[11px] text-on-surface-variant/60 leading-relaxed mb-6 line-clamp-2">{connector.description}</p>
    
    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/5">
      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">
        {connector.lastSync ? `Last Sync: ${new Date(connector.lastSync).toLocaleDateString()}` : 'Never Synced'}
      </span>
      <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={16} />}
      </div>
    </div>
  </button>
);

const MappingRow = ({ label, source }: any) => (
  <div className="flex items-center justify-between p-3 bg-surface-container rounded-sm border border-outline-variant/5">
    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-tight">{label}</span>
    <div className="flex items-center gap-2">
      <div className="px-2 py-1 bg-surface-container-highest rounded-sm font-mono text-[9px] text-primary">
        {source}
      </div>
      <Plus size={10} className="text-on-surface-variant/40" />
    </div>
  </div>
);

const QualityCheck = ({ title, status, desc }: any) => (
  <div className="p-4 bg-surface-container rounded-sm border border-outline-variant/10">
    <div className="flex justify-between items-center mb-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{title}</h4>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${status === 'PASS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
        {status}
      </span>
    </div>
    <p className="text-[10px] text-on-surface-variant leading-tight">{desc}</p>
  </div>
);

const SettingToggle = ({ label, desc, active = false }: any) => (
  <div className="flex items-start gap-3">
    <div className={`mt-1 w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-primary' : 'bg-surface-container-highest'}`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${active ? 'left-4.5' : 'left-0.5'}`} />
    </div>
    <div>
      <h4 className="text-[11px] font-bold text-on-surface uppercase tracking-tight">{label}</h4>
      <p className="text-[10px] text-on-surface-variant leading-tight">{desc}</p>
    </div>
  </div>
);

const RecentUpload = ({ name, size, date, status }: any) => (
  <div className="flex items-center justify-between p-3 bg-surface-container rounded-sm border border-outline-variant/5">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-surface-container-highest rounded-sm text-on-surface-variant">
        <Table size={14} />
      </div>
      <div>
        <h4 className="text-[11px] font-bold text-on-surface truncate w-32">{name}</h4>
        <p className="text-[9px] text-on-surface-variant uppercase">{size} • {date}</p>
      </div>
    </div>
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm ${status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
      {status}
    </span>
  </div>
);

const HistoryRow = ({ id, source, type, records, status, time }: any) => (
  <tr className="hover:bg-surface-container-high/35 transition-colors">
    <td className="px-6 py-4 text-[11px] font-mono text-primary">{id}</td>
    <td className="px-6 py-4 text-[11px] font-bold text-on-surface uppercase tracking-tight">{source}</td>
    <td className="px-6 py-4">
      <span className="text-[9px] font-bold px-2 py-1 bg-surface-container-highest rounded-sm text-on-surface-variant uppercase tracking-widest">
        {type}
      </span>
    </td>
    <td className="px-6 py-4 text-[11px] text-on-surface-variant">{records}</td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {status}
        </span>
      </div>
    </td>
    <td className="px-6 py-4 text-[11px] text-on-surface-variant font-mono">{time}</td>
    <td className="px-6 py-4">
      <button className="p-2 hover:bg-surface-container-highest rounded-sm text-on-surface-variant transition-colors">
        <ExternalLink size={14} />
      </button>
    </td>
  </tr>
);

const AuthField = ({ label, placeholder, type = "text" }: any) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</label>
    <input 
      type={type}
      placeholder={placeholder}
      className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-sm p-3 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 transition-colors"
    />
  </div>
);

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Send, 
  User, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  ArrowRight,
  Clock,
  Tag,
  Paperclip,
  ExternalLink,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, IntakeType } from '../types/intake';
import { Case } from '../types/case';
import { WorkflowDefinition } from '../types/workflow';
import { AgentDefinition } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';

interface InboxViewProps {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  workflows: WorkflowDefinition[];
  agents: AgentDefinition[];
}

export const InboxView: React.FC<InboxViewProps> = ({ 
  conversations, 
  setConversations, 
  setCases,
}) => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id || null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState<string | null>(null);

  const selectedConversation = conversations.find(c => c.id === selectedId);

  const generateAISuggestion = () => {
    if (!selectedConversation) return;
    setIsAIProcessing(true);
    setTimeout(() => {
      const type = selectedConversation.type;
      let suggestion = "";
      if (type === 'CLAIM') {
        suggestion = "I've reviewed your claim request. Could you please provide the incident date and a few photos of the damage? This will help us process it faster.";
      } else if (type === 'QUOTE') {
        suggestion = "Thank you for your interest! I've started preparing a quote for you. Could you confirm your current coverage limits?";
      } else if (type === 'HOSPITAL_INTAKE') {
        suggestion = "We have received the intake for Robert Wilson. We are currently verifying insurance eligibility and will reach out if further records are required.";
      } else if (type === 'KYC') {
        suggestion = "Thank you for submitting your documents. I'm initiating the identity verification process. We'll notify you once the check is complete.";
      } else if (type === 'RENEWAL') {
        suggestion = "I see your policy is up for renewal. I'm analyzing your claims history to provide you with the best possible rate. You'll receive a formal offer shortly.";
      } else if (type === 'COMPLIANCE') {
        suggestion = "I've logged your request for the compliance certificate. Our compliance engine is generating the latest report for your review.";
      } else if (type === 'NOMINEE_CHANGE') {
        suggestion = "To process the nominee change, we require a signed declaration form. I can send that over to you right now.";
      } else if (type === 'SALES_APPLICATION') {
        suggestion = "I've received your sales application. I'm currently processing your demographic and salary information to generate your unique sales code. You'll receive it shortly.";
      } else {
        suggestion = "Thank you for reaching out. I'm looking into your request and will get back to you shortly with more details.";
      }
      setSuggestedReply(suggestion);
      setIsAIProcessing(false);
    }, 1500);
  };

  const simulateHospitalResponse = () => {
    if (!selectedConversation || selectedConversation.type !== 'HOSPITAL_INTAKE') return;
    
    const newMessage: Message = {
      id: uuidv4(),
      sender: 'CUSTOMER',
      content: `[HOSPITAL RESPONSE] Additional medical records for Robert Wilson are attached. Please proceed with admission approval.`,
      timestamp: new Date().toISOString(),
      attachments: [
        { name: 'medical_records_v2.pdf', type: 'application/pdf', url: '#' }
      ]
    };

    setConversations(prev => prev.map(c => 
      c.id === selectedId 
        ? { ...c, messages: [...c.messages, newMessage], last_message_at: newMessage.timestamp }
        : c
    ));
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedId) return;

    const newMessage: Message = {
      id: uuidv4(),
      sender: 'AGENT',
      content: replyText,
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => 
      c.id === selectedId 
        ? { ...c, messages: [...c.messages, newMessage], last_message_at: newMessage.timestamp, status: 'IN_PROGRESS' }
        : c
    ));
    setReplyText('');
  };

  const handleResolveAndTrigger = (type: IntakeType) => {
    if (!selectedConversation) return;

    let caseType: Case['type'] = 'UNDERWRITING';
    let targetWorkflowId = 'policy_issuance_v1';
    let department: Case['department'] = 'UNDERWRITING';
    let title = `New Policy: ${selectedConversation.customer_name}`;

    if (type === 'CLAIM') {
      caseType = 'CLAIM';
      targetWorkflowId = 'claims_mgmt_v1';
      department = 'CLAIMS';
      title = `Claim Request: ${selectedConversation.customer_name}`;
    } else if (type === 'HOSPITAL_INTAKE') {
      caseType = 'ADMISSION';
      targetWorkflowId = 'hospital_intake_v1';
      department = 'CLAIMS';
      title = `Hospital Intake: ${selectedConversation.extracted_entities?.claimant_name || selectedConversation.customer_name}`;
    } else if (type === 'KYC') {
      caseType = 'KYC';
      targetWorkflowId = 'kyc_onboarding_v1';
      department = 'KYC_ONBOARDING';
      title = `KYC Verification: ${selectedConversation.customer_name}`;
    } else if (type === 'RENEWAL') {
      caseType = 'RENEWAL';
      targetWorkflowId = 'policy_renewals_v1';
      department = 'RENEWALS';
      title = `Policy Renewal: ${selectedConversation.customer_name}`;
    } else if (type === 'COMPLIANCE') {
      caseType = 'COMPLIANCE';
      targetWorkflowId = 'compliance_audit_v1';
      department = 'COMPLIANCE';
      title = `Compliance Audit: ${selectedConversation.customer_name}`;
    } else if (type === 'NOMINEE_CHANGE' || type === 'POLICY_INFO') {
      caseType = 'POLICY_SERVICING';
      targetWorkflowId = 'policy_servicing_v1';
      department = 'POLICY_SERVICING';
      title = `${type === 'NOMINEE_CHANGE' ? 'Nominee Change' : 'Policy Inquiry'}: ${selectedConversation.customer_name}`;
    } else if (type === 'SALES_APPLICATION') {
      caseType = 'SALES';
      targetWorkflowId = 'sales_intake_v1';
      department = 'SALES';
      title = `Sales Application: ${selectedConversation.customer_name}`;
    }

    const newCase: Case = {
      id: `${caseType.substring(0, 3)}-${Math.floor(Math.random() * 1000)}`,
      title: title,
      description: selectedConversation.messages.map(m => `${m.sender}: ${m.content}`).join('\n'),
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      type: caseType,
      department: department,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      workflow_id: 'omnichannel_routing_v1',
      current_node_id: 'start',
      risk_score: 45,
      compliance_score: 98,
      summary: `Converted from ${selectedConversation.channel} intake via Omnichannel Intake & Routing (omnichannel_routing_v1). Target Workflow: ${targetWorkflowId}. Subject: ${selectedConversation.subject}`,
      metadata: selectedConversation.metadata,
      claimant: {
        name: selectedConversation.customer_name,
        email: selectedConversation.customer_email,
        id: `CLM-${Math.floor(Math.random() * 10000)}`,
        dob: '1990-01-01',
        gender: 'OTHER'
      },
      policy: selectedConversation.policy_id ? {
        policy_number: selectedConversation.policy_id,
        carrier: 'Aurastack Health',
        policy_type: 'Medical'
      } : undefined,
      timeline: [
        {
          title: 'Intake Classified & Routed',
          description: `Aura Intake AI classified as ${type} and routed to Omnichannel Engine. Target: ${targetWorkflowId}.`,
          timestamp: new Date().toISOString(),
          type: 'system'
        }
      ],
      ai_insights: [
        {
          id: uuidv4(),
          type: 'RISK',
          title: 'Identity Verification',
          description: `Automated KYC check for ${selectedConversation.customer_name} shows 98% match with policy records.`,
          confidence: 0.98,
          agent_id: 'aura_intake_ai',
          timestamp: new Date().toISOString()
        },
        {
          id: uuidv4(),
          type: 'OPPORTUNITY',
          title: 'Policy Alignment',
          description: 'Intake data suggests eligibility for premium coverage enhancement based on historical markers.',
          confidence: 0.85,
          agent_id: 'aura_intake_ai',
          timestamp: new Date().toISOString()
        }
      ],
      risk_markers: [
        {
          id: uuidv4(),
          type: 'IDENTITY',
          status: 'INFO',
          description: 'Identity verified via multi-factor authentication and document cross-reference.'
        },
        {
          id: uuidv4(),
          type: 'COMPLIANCE',
          status: 'INFO',
          description: 'All mandatory intake fields captured. Compliance score: 98%.'
        }
      ],
      document_extraction_status: [
        {
          id: uuidv4(),
          type: 'Identity Documents',
          progress: 100,
          status: 'COMPLETED'
        },
        {
          id: uuidv4(),
          type: 'Policy Documents',
          progress: 100,
          status: 'COMPLETED'
        }
      ]
    };

    setCases(prev => [newCase, ...prev]);
    setConversations(prev => prev.map(c => 
      c.id === selectedId 
        ? { ...c, status: 'CONVERTED_TO_CASE', linked_case_id: newCase.id }
        : c
    ));
  };

  const filteredConversations = conversations.filter(c => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return c.status === 'OPEN' || c.status === 'IN_PROGRESS';
    if (filter === 'RESOLVED') return c.status === 'RESOLVED' || c.status === 'CONVERTED_TO_CASE';
    return true;
  });

  const hairlineBox = 'border border-solid border-[#e5e7eb]';
  const hairlineDashed = 'border border-dashed border-[#e5e7eb]';
  const hairlineB = 'border-b border-b-solid border-b-[#e5e7eb]';
  const hairlineT = 'border-t border-t-solid border-t-[#e5e7eb]';

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-1 min-w-0 gap-2 overflow-hidden bg-background p-2">
      {/* Conversation list */}
      <div className="card-elevated flex w-[min(100%,18rem)] sm:w-72 shrink-0 flex-col min-h-0 min-w-0 overflow-hidden rounded-xl">
        <div className={`shrink-0 p-3 sm:p-4 ${hairlineB}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest sm:text-sm">Inbox</h2>
            <button type="button" className="btn-icon-sm shrink-0">
              <Filter size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input 
              className={`w-full rounded-sm bg-white py-2 pl-9 pr-3 text-[10px] tracking-wide focus:outline-none focus:ring-1 focus:ring-primary/20 ${hairlineBox}`}
              placeholder="Search…" 
              type="text"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`toggle-chip px-2 py-1 text-[9px] uppercase tracking-widest ${
                  filter === f ? 'toggle-chip--active' : ''
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className={`mt-3 rounded-sm bg-white p-2 ${hairlineBox}`}>
            <div className="mb-0.5 flex items-center gap-2">
              <MessageSquare size={10} className="shrink-0 text-on-surface-variant" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">Intake active</span>
            </div>
            <p className="text-[8px] leading-tight text-on-surface-variant">Classifying intents across active threads.</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 custom-scrollbar">
          {filteredConversations.map(conv => (
            <button
              key={conv.id}
              type="button"
              onClick={() => setSelectedId(conv.id)}
              className={`card-elevated--interactive relative w-full rounded-lg p-3 text-left sm:p-4 ${
                selectedId === conv.id ? '!border-primary' : ''
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[9px] font-bold uppercase tracking-tighter text-primary sm:text-[10px]">
                  {conv.channel} · {conv.type}
                </span>
                <span className="shrink-0 text-[9px] opacity-40">
                  {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h3 className="mb-1 truncate text-xs font-bold">{conv.subject}</h3>
              <p className="line-clamp-1 text-[10px] text-on-surface-variant opacity-70">
                {conv.messages[conv.messages.length - 1]?.content}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
                  <User size={10} className="text-on-surface-variant" />
                </div>
                <span className="truncate text-[9px] font-medium opacity-60">{conv.customer_name}</span>
              </div>
              {conv.status === 'CONVERTED_TO_CASE' && (
                <div className="absolute right-3 top-3 text-secondary sm:right-4 sm:top-4">
                  <CheckCircle2 size={12} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Thread + composer */}
      <div className={`card-elevated flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl`}>
        {selectedConversation ? (
          <>
            <div className={`shrink-0 bg-white p-3 sm:p-4 ${hairlineB}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-primary/10">
                    {selectedConversation.channel === 'EMAIL' ? <Mail size={20} className="text-primary" /> : <MessageSquare size={20} className="text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold leading-snug tracking-tight">
                        {selectedConversation.type === 'CLAIM' ? 'Claim Inquiry' : selectedConversation.subject}
                      </h2>
                      {selectedConversation.linked_case_id && (
                        <span className="shrink-0 rounded-sm bg-secondary/10 px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                          {selectedConversation.linked_case_id}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-on-surface-variant">
                      <span className="font-bold text-on-surface">{selectedConversation.customer_name}</span>
                      <span className="opacity-30">·</span>
                      <span className="min-w-0 break-all">{selectedConversation.customer_email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:max-w-[min(100%,28rem)] lg:justify-end">
                  {selectedConversation.linked_case_id && (
                    <button 
                      type="button"
                      onClick={() => navigate(`/cases/${selectedConversation.linked_case_id}`)}
                      className="btn btn-outline shrink-0"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      <span className="hidden sm:inline">View case</span>
                      <span className="sm:hidden">Case</span>
                    </button>
                  )}
                  {selectedConversation.type === 'HOSPITAL_INTAKE' && selectedConversation.status === 'CONVERTED_TO_CASE' && (
                    <button 
                      type="button"
                      onClick={simulateHospitalResponse}
                      className="btn btn-outline shrink-0"
                    >
                      <span className="hidden md:inline">Simulate hospital response</span>
                      <span className="md:hidden">Simulate</span>
                    </button>
                  )}
                  {selectedConversation.status !== 'CONVERTED_TO_CASE' ? (
                    <button 
                      type="button"
                      onClick={() => handleResolveAndTrigger(selectedConversation.type)}
                      className="btn btn-secondary shrink-0 shadow-md shadow-secondary/15"
                    >
                      <span className="hidden xl:inline">Resolve & trigger workflow</span>
                      <span className="hidden sm:inline xl:hidden">Resolve & trigger</span>
                      <span className="sm:hidden">Resolve</span>
                      <ArrowRight size={12} className="shrink-0" />
                    </button>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 rounded-sm border border-secondary/20 bg-surface-container-highest px-3 py-2 text-[9px] font-bold tracking-wide text-secondary sm:text-[10px]">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span className="truncate">Routed to engine</span>
                    </div>
                  )}
                  <button type="button" className="btn-icon-sm shrink-0">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6 custom-scrollbar">
              <div className="space-y-4 sm:space-y-6">
                {selectedConversation.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender === 'CUSTOMER' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[min(100%,36rem)] space-y-1 ${msg.sender === 'CUSTOMER' ? 'items-start' : 'flex flex-col items-end'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">
                        {msg.sender} · {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <div className={`rounded-sm bg-white p-3 text-xs leading-relaxed sm:p-4 ${hairlineBox} ${
                        msg.sender === 'CUSTOMER' 
                          ? 'text-on-surface' 
                          : msg.sender === 'AI'
                            ? 'text-on-surface italic'
                            : 'text-on-surface'
                      }`}>
                        {msg.content}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`mt-3 flex flex-wrap gap-2 pt-3 ${hairlineT}`}>
                            {msg.attachments.map((file, fIdx) => (
                              <div key={fIdx} className={`flex max-w-full items-center gap-2 rounded-sm bg-white p-1.5 text-[9px] ${hairlineBox}`}>
                                <Paperclip size={10} className="shrink-0 text-primary" />
                                <span className="truncate">{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`shrink-0 bg-white p-3 sm:p-4 ${hairlineT}`}>
              <AnimatePresence>
                {suggestedReply && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`relative mb-3 rounded-sm bg-white p-3 sm:p-4 ${hairlineBox}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <MessageSquare size={14} className="text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Suggested reply</span>
                    </div>
                    <p className="mb-3 text-xs italic text-on-surface/70">{suggestedReply}</p>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => { setReplyText(suggestedReply); setSuggestedReply(null); }}
                        className="btn btn-primary"
                      >
                        Use
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSuggestedReply(null)}
                        className="btn btn-ghost opacity-60 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response…"
                  rows={3}
                  className={`w-full resize-none rounded-sm bg-white p-3 pb-12 pr-20 text-xs placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:pr-24 ${hairlineBox}`}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1 sm:bottom-3 sm:right-3 sm:gap-2">
                  <button 
                    type="button"
                    onClick={generateAISuggestion}
                    disabled={isAIProcessing}
                    className={`btn-icon ${isAIProcessing ? 'animate-pulse' : ''}`}
                    title="Suggest reply"
                  >
                    <MessageSquare size={16} />
                  </button>
                  <button type="button" className="btn-icon">
                    <Paperclip size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                    <Send size={12} className="shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center opacity-20">
            <Mail className="mb-3 h-12 w-12 shrink-0 opacity-80 sm:mb-4 sm:h-14 sm:w-14" strokeWidth={1.25} />
            <p className="px-4 text-center text-xs font-bold uppercase tracking-widest sm:text-sm">Select a conversation</p>
          </div>
        )}
      </div>

      {/* Context rail — single scroll, compact sections */}
      <aside className="card-elevated hidden min-h-0 w-[min(100%,15rem)] shrink-0 flex-col overflow-hidden rounded-xl sm:flex sm:w-64 lg:w-72">
        {selectedConversation ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={`shrink-0 space-y-3 p-3 lg:p-4 ${hairlineB}`}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">Customer</h3>
              <div className="flex items-center gap-2">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ${hairlineBox}`}>
                  <User size={20} className="text-on-surface-variant opacity-50" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{selectedConversation.customer_name}</p>
                  <p className="text-[9px] opacity-50">Policyholder</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 opacity-50">Email</span>
                  <span className="min-w-0 break-all text-right font-medium">{selectedConversation.customer_email}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="opacity-50">Phone</span>
                  <span className="font-medium">+1 (555) 0123</span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-4 p-3 lg:p-4 lg:space-y-5">
                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Extraction</h3>
                  {selectedConversation.extracted_entities ? (
                    <div className="space-y-2">
                      <div className={`rounded-sm bg-white p-2 ${hairlineBox}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase opacity-40">Confidence</span>
                          <span className="text-[10px] font-bold text-primary">{selectedConversation.extracted_entities.confidence_score}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${selectedConversation.extracted_entities.confidence_score}%` }}
                          />
                        </div>
                      </div>
                      {selectedConversation.extracted_entities.policy_number && (
                        <div className={`rounded-sm bg-white p-2 ${hairlineBox}`}>
                          <p className="mb-0.5 text-[9px] font-bold uppercase opacity-40">Policy</p>
                          <p className="text-xs font-bold">{selectedConversation.extracted_entities.policy_number}</p>
                        </div>
                      )}
                      {selectedConversation.extracted_entities.claim_amount && (
                        <div className={`rounded-sm bg-white p-2 ${hairlineBox}`}>
                          <p className="mb-0.5 text-[9px] font-bold uppercase opacity-40">Amount</p>
                          <p className="text-xs font-bold">${selectedConversation.extracted_entities.claim_amount.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedConversation.extracted_entities.incident_date && (
                        <div className={`rounded-sm bg-white p-2 ${hairlineBox}`}>
                          <p className="mb-0.5 text-[9px] font-bold uppercase opacity-40">Incident</p>
                          <p className="text-xs font-bold">{new Date(selectedConversation.extracted_entities.incident_date).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`rounded-sm p-3 text-center ${hairlineDashed}`}>
                      <p className="text-[9px] italic opacity-50">No extracted fields yet.</p>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Intake & SLA</h3>
                  <div className="grid gap-2">
                    <div className={`flex items-center justify-between gap-2 rounded-sm bg-white p-2 ${hairlineBox}`}>
                      <span className="text-[9px] font-bold uppercase opacity-40">Channel</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold">
                        {selectedConversation.channel === 'CHAT' ? <MessageSquare size={12} /> : <Mail size={12} />}
                        {selectedConversation.channel}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between gap-2 rounded-sm bg-white p-2 ${hairlineBox}`}>
                      <span className="text-[9px] font-bold uppercase opacity-40">Type</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold">
                        <Tag size={12} />
                        {selectedConversation.type}
                      </span>
                    </div>
                    <div className={`flex items-center gap-2 rounded-sm bg-white p-2 text-on-surface ${hairlineBox}`}>
                      <Clock size={12} className="shrink-0" />
                      <span className="text-[10px] font-bold leading-tight">SLA OK · 2h left</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Documents</h3>
                  {selectedConversation.messages.flatMap(m => m.attachments || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedConversation.messages.flatMap(m => m.attachments || []).map((file, idx) => (
                        <div key={idx} className="group flex cursor-pointer items-center justify-between gap-2 card-elevated p-2 transition-all">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                              <FileText size={14} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-bold">{file.name}</p>
                              <p className="text-[8px] uppercase opacity-40">{file.type.split('/')[1] || 'file'}</p>
                            </div>
                          </div>
                          <ExternalLink size={12} className="shrink-0 text-primary opacity-60 group-hover:opacity-100" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`rounded-sm p-2 text-center text-[9px] italic text-on-surface-variant ${hairlineDashed}`}>None yet</p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Quick actions</h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {selectedConversation.type === 'KYC' && (
                      <button type="button" className="btn btn-outline w-full justify-start gap-2 !h-auto !min-h-0 py-2 !normal-case !tracking-normal text-[9px]">
                        <CheckCircle2 size={12} className="shrink-0" />
                        Identity check
                      </button>
                    )}
                    {selectedConversation.type === 'CLAIM' && (
                      <button type="button" className="btn btn-outline w-full justify-start gap-2 !h-auto !min-h-0 py-2 !normal-case !tracking-normal text-[9px]">
                        <FileText size={12} className="shrink-0" />
                        Request photos
                      </button>
                    )}
                    {selectedConversation.type === 'RENEWAL' && (
                      <button type="button" className="btn btn-outline w-full justify-start gap-2 !h-auto !min-h-0 py-2 !normal-case !tracking-normal text-[9px]">
                        <MessageSquare size={12} className="shrink-0" />
                        Renewal model
                      </button>
                    )}
                    <button type="button" className="btn btn-outline w-full justify-start gap-2 !h-auto !min-h-0 py-2 !normal-case !tracking-normal text-[9px] opacity-80 hover:opacity-100">
                      <Mail size={12} className="shrink-0" />
                      Status update
                    </button>
                    <button type="button" className="btn btn-outline w-full justify-start gap-2 !h-auto !min-h-0 py-2 !normal-case !tracking-normal text-[9px] opacity-80 hover:opacity-100">
                      <User size={12} className="shrink-0" />
                      Request info
                    </button>
                  </div>
                </section>

                {selectedConversation.linked_case_id && (
                  <section className="pb-2">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary">Linked case</h3>
                    <button 
                      type="button"
                      onClick={() => navigate(`/cases/${selectedConversation.linked_case_id}`)}
                      className="btn btn-secondary w-full !h-auto !min-h-0 flex-col items-stretch gap-1 py-3 text-left !normal-case !tracking-normal"
                    >
                      <div className="mb-0.5 flex w-full items-center justify-between">
                        <span className="text-[10px] font-bold">{selectedConversation.linked_case_id}</span>
                        <ExternalLink size={12} className="shrink-0 opacity-70" />
                      </div>
                      <p className="text-xs font-bold">Open in Cases</p>
                    </button>
                  </section>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-[10px] opacity-40">Select a thread</div>
        )}
      </aside>
    </div>
  );
};

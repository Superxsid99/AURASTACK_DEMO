import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  MessageSquare, 
  Phone, 
  PhoneCall,
  Smartphone,
  Inbox as InboxIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Reply,
  Bot,
  ShieldCheck,
  AlertCircle,
  Zap,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { MOCK_MESSAGES, INDIAN_FACES, DEFAULT_FACE } from '../constants';
import { cn } from '../lib/utils';
import { Dropdown } from './Dropdown';

export function Inbox() {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [selectedMsgId, setSelectedMsgId] = useState(MOCK_MESSAGES[0].id);
  const [activeView, setActiveView] = useState<'chat' | 'docs'>('chat');
  const [replyText, setReplyText] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'flagged' | 'review'>('all');
  const [chatHistories, setChatHistories] = useState<Record<string, { sender: string, content: string, timestamp: string, isAi?: boolean }[]>>({
    'msg-1': [
      {
        sender: 'Clarity AI',
        content: 'Hi Rahul, I am sorry to hear about the accident. Are you safe? Please ensure you are in a secure location before we proceed.',
        timestamp: '2024-03-17T08:46:00Z',
        isAi: true
      },
      {
        sender: 'Rahul Sharma',
        content: 'Yes, I am safe. Just a bit shaken. The other driver has also stopped.',
        timestamp: '2024-03-17T08:47:00Z',
        isAi: false
      }
    ]
  });

  const filteredMessages = useMemo(() => {
    let result = messages;
    if (filterChannel !== 'all') {
      result = result.filter(m => m.channel === filterChannel);
    }
    if (filterStatus === 'flagged') {
      result = result.filter(m => m.isFlagged);
    } else if (filterStatus === 'review') {
      result = result.filter(m => m.needsReview);
    }
    return result;
  }, [messages, filterChannel, filterStatus]);

  const selectedMsg = useMemo(() => 
    filteredMessages.find(m => m.id === selectedMsgId) || filteredMessages[0] || messages[0], 
  [filteredMessages, selectedMsgId, messages]);

  const currentHistory = useMemo(() => {
    if (!selectedMsg) return [];
    const history = chatHistories[selectedMsg.id] || [];
    return [
      { sender: selectedMsg.sender, content: selectedMsg.content, timestamp: selectedMsg.timestamp, isAi: false },
      ...history
    ];
  }, [selectedMsg, chatHistories]);

  const handleSendReply = (text: string) => {
    if (!text.trim() || !selectedMsg) return;
    
    const newReply = {
      sender: 'Clarity AI',
      content: text,
      timestamp: new Date().toISOString(),
      isAi: true
    };

    setChatHistories(prev => ({
      ...prev,
      [selectedMsg.id]: [...(prev[selectedMsg.id] || []), newReply]
    }));
    setReplyText('');
  };

  const aiAnalysis = useMemo(() => {
    if (!selectedMsg) return null;
    
    const content = selectedMsg.content.toLowerCase();
    if (content.includes('accident') || content.includes('damaged') || content.includes('bumper')) {
      return {
        intent: 'Motor Claim Intake',
        confidence: 0.98,
        entities: ['Front Bumper', 'Bandra Kurla Complex', 'RQBE-MOT-2024-8832'],
        suggestedAction: 'Approve Inspection',
        riskLevel: 'Low',
        summary: 'Customer reporting minor vehicle damage. Policy is active and covers accidental damage.',
        workflow: 'Motor Claims Automation',
        step: 'FNOL Intake',
        docs: [
          { name: 'Accident_Photo_1.jpg', size: '2.4 MB', type: 'image' },
          { name: 'Accident_Photo_2.jpg', size: '1.8 MB', type: 'image' },
          { name: 'Driving_License.pdf', size: '0.5 MB', type: 'pdf' }
        ]
      };
    } else if (content.includes('surgery') || content.includes('hospital') || content.includes('cashless')) {
      return {
        intent: 'Health Claim Submission',
        confidence: 0.95,
        entities: ['Apollo Hospital', '₹45,000', 'CLM-7721'],
        suggestedAction: 'Verify Bills',
        riskLevel: 'Medium',
        summary: 'Reimbursement request for surgical procedure. Requires verification of discharge summary.',
        workflow: 'Health Reimbursement',
        step: 'Document Verification',
        docs: [
          { name: 'Discharge_Summary.pdf', size: '1.2 MB', type: 'pdf' },
          { name: 'Hospital_Bill_Final.pdf', size: '3.1 MB', type: 'pdf' },
          { name: 'Pharmacy_Receipts.zip', size: '5.4 MB', type: 'zip' }
        ]
      };
    } else if (content.includes('kyc') || content.includes('aadhaar') || content.includes('pan card')) {
      return {
        intent: 'KYC Verification',
        confidence: 0.97,
        entities: ['Aadhaar Card', 'PAN Card', 'Rahul Sharma'],
        suggestedAction: 'Approve Identity',
        riskLevel: 'Low',
        summary: 'Customer submitted KYC documents for account opening. AI verified identity against government records.',
        workflow: 'Banking Onboarding',
        step: 'Identity Verification',
        docs: [
          { name: 'Aadhaar_Front.jpg', size: '1.1 MB', type: 'image' },
          { name: 'PAN_Card.pdf', size: '0.8 MB', type: 'pdf' }
        ]
      };
    } else if (content.includes('loan') || content.includes('mortgage') || content.includes('interest rate')) {
      return {
        intent: 'Loan Origination',
        confidence: 0.92,
        entities: ['Home Loan', '₹50,00,000', 'Credit Score: 780'],
        suggestedAction: 'Pre-Approve',
        riskLevel: 'Medium',
        summary: 'Customer inquiring about home loan eligibility. Credit profile looks strong.',
        workflow: 'Loan Processing',
        step: 'Eligibility Check',
        docs: [
          { name: 'Salary_Slips_3Months.pdf', size: '4.2 MB', type: 'pdf' },
          { name: 'Bank_Statement.pdf', size: '2.5 MB', type: 'pdf' }
        ]
      };
    } else if (content.includes('stuck') || content.includes('roadside')) {
      return {
        intent: 'Roadside Assistance',
        confidence: 0.99,
        entities: ['Mumbai-Pune Expressway', 'Lonavala'],
        suggestedAction: 'Dispatch RSA',
        riskLevel: 'High (Safety)',
        summary: 'Customer stranded on highway. Immediate RSA dispatch recommended.',
        workflow: 'Emergency RSA',
        step: 'Dispatch Coordination',
        docs: [
          { name: 'Live_Location_Share.link', size: '0.1 KB', type: 'link' }
        ]
      };
    }
    return {
      intent: 'General Inquiry',
      confidence: 0.85,
      entities: [],
      suggestedAction: 'Draft Response',
      riskLevel: 'Low',
      summary: 'Standard inquiry regarding policy or services.',
      workflow: 'Customer Support',
      step: 'Initial Triage',
      docs: []
    };
  }, [selectedMsg]);

  const suggestedResponse = useMemo(() => {
    if (!aiAnalysis || !selectedMsg) return "";
    if (aiAnalysis.intent === 'Motor Claim Intake') 
      return `Hello ${selectedMsg.sender.split(' ')[0]}, I'm sorry to hear about the accident at BKC. I've located your policy RQBE-MOT-2024-8832. I've initiated a digital survey. Could you please upload 3 photos of the front bumper damage?`;
    if (aiAnalysis.intent === 'Health Claim Submission')
      return `Greetings ${selectedMsg.sender.split(' ')[0]}, I've received your bills for ₹45,000 from Apollo Hospital. I'm verifying the discharge summary against CLM-7721. You'll receive an update within 2 hours.`;
    if (aiAnalysis.intent === 'KYC Verification')
      return `Hello ${selectedMsg.sender.split(' ')[0]}, thank you for submitting your KYC documents. I've successfully verified your Aadhaar and PAN details. Your account activation is now in the final stage.`;
    if (aiAnalysis.intent === 'Loan Origination')
      return `Hello ${selectedMsg.sender.split(' ')[0]}, based on your credit score of 780 and the documents provided, you are eligible for a Home Loan of up to ₹50,00,000. Would you like to proceed with the formal application?`;
    if (aiAnalysis.intent === 'Roadside Assistance')
      return `Hello ${selectedMsg.sender.split(' ')[0]}, I've detected you are near Lonavala. Yes, your policy includes 24/7 Roadside Assistance. I am dispatching a tow truck to your GPS location now. ETA: 35 mins.`;
    return `Hello ${selectedMsg.sender.split(' ')[0]}, thank you for reaching out. I am looking into your request regarding ${selectedMsg.content.slice(0, 30)}... and will get back to you shortly.`;
  }, [aiAnalysis, selectedMsg]);

  const inboxStats = useMemo(() => {
    const unread = messages.filter((m) => m.status === 'unread').length;
    const review = messages.filter((m) => m.needsReview).length;
    const flagged = messages.filter((m) => m.isFlagged).length;
    return {
      total: messages.length,
      visible: filteredMessages.length,
      unread,
      review,
      flagged
    };
  }, [messages, filteredMessages]);

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4">
        <p className="page-kicker">Operations Inbox</p>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="page-title-inbox">Unified Case Intake</h3>
          <span className="badge bg-[#F1F5F9] text-[#334155]">{inboxStats.visible} visible</span>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <p className="mono-label">Total</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-1">{inboxStats.total}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <p className="mono-label">Unread</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-1">{inboxStats.unread}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <p className="mono-label">Needs Review</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-1">{inboxStats.review}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <p className="mono-label">Flagged</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-1">{inboxStats.flagged}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <p className="mono-label">Auto Action</p>
            <p className="text-sm font-semibold text-[#0F172A] mt-1">
              {Math.round(((messages.length - inboxStats.review) / Math.max(1, messages.length)) * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div className="h-[calc(100vh-18rem)] flex bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] overflow-hidden">
      {/* Sidebar List - Filter panel width: 220-260px */}
      <div className="w-[240px] min-w-[220px] max-w-[240px] border-r border-[#E2E8F0] flex flex-col bg-white">
        <div className="p-4 border-b border-[#E2E8F0] bg-white">
          <h3 className="text-[15px] font-semibold text-[#0F172A] tracking-tight mb-3">Inbox</h3>
          
          <div className="flex flex-col gap-3 mb-3">
            <Dropdown 
              label="Status"
              options={[
                { label: 'All Status', value: 'all' },
                { label: 'Needs Review', value: 'review' },
                { label: 'Flagged', value: 'flagged' }
              ]}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as any)}
              className="w-full"
            />
            <Dropdown 
              label="Channel"
              options={[
                { label: 'All Channels', value: 'all' },
                { label: 'Emails', value: 'email' },
                { label: 'Apps', value: 'app' },
                { label: 'Whatsapp', value: 'whatsapp' },
                { label: 'Voice', value: 'voice' },
                { label: 'Call', value: 'call' },
                { label: 'Chat', value: 'chat' },
                { label: 'Other', value: 'other' }
              ]}
              value={filterChannel}
              onChange={setFilterChannel}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => {
                  setSelectedMsgId(msg.id);
                  setActiveView('chat');
                }}
                className={cn(
                  "w-full py-3 px-3.5 text-left border-b border-[#F1F5F9] transition-all duration-150 group",
                  selectedMsg?.id === msg.id 
                    ? "bg-[#E6F6F3] border-l-2 border-l-[#1F9D8B] font-medium" 
                    : "bg-white hover:bg-[#F8FAFC]"
                )}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      msg.status === 'unread' ? "bg-orange-500" : "bg-transparent"
                    )} />
                    <span className={cn("text-xs truncate max-w-[140px]", selectedMsg?.id === msg.id ? "font-medium text-[#0F172A]" : "font-medium text-[#0F172A]")}>{msg.sender}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded">
                    {msg.channel === 'whatsapp' && <MessageSquare size={8} className="text-[#059669]" />}
                    {msg.channel === 'email' && <Mail size={8} className="text-[#1F9D8B]" />}
                    {msg.channel === 'app' && <Smartphone size={8} className="text-purple-600" />}
                    {msg.channel === 'call' && <PhoneCall size={8} className="text-rose-600" />}
                    {msg.channel === 'chat' && <MessageSquare size={8} className="text-[#1F9D8B]" />}
                    {msg.channel === 'voice' && <Phone size={8} className="text-amber-600" />}
                    {msg.channel === 'other' && <MoreHorizontal size={8} className="text-slate-600" />}
                    <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{msg.channel}</span>
                  </div>
                  {msg.isFlagged && (
                    <span className="text-[8px] font-semibold text-white bg-rose-500 px-1.5 py-0.5 rounded">FLAGGED</span>
                  )}
                  {msg.needsReview && !msg.isFlagged && (
                    <span className="text-[8px] font-semibold text-white bg-orange-500 px-1.5 py-0.5 rounded">REVIEW</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed group-hover:text-slate-700 transition-colors">
                  {msg.content}
                </p>
              </button>
            ))
          ) : (
            <div className="p-10 text-center">
              <InboxIcon className="mx-auto text-slate-200 mb-3" size={32} />
              <p className="text-slate-400 text-xs font-bold">No {filterChannel} messages found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedMsg ? (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <img 
                  src={INDIAN_FACES[selectedMsg.sender] || DEFAULT_FACE} 
                  alt={selectedMsg.sender}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{selectedMsg.sender}</h3>
                    {selectedMsg.isFlagged && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 border border-slate-200">Flagged</span>}
                    {selectedMsg.needsReview && !selectedMsg.isFlagged && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 border border-slate-200">Review Required</span>}
                    {!selectedMsg.isFlagged && !selectedMsg.needsReview && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 border border-slate-200">Automated</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{new Date(selectedMsg.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span className="font-semibold text-slate-500">{aiAnalysis?.workflow} • {aiAnalysis?.step}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setActiveView('chat')}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-semibold transition-all",
                    activeView === 'chat' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Conversation
                </button>
                <button 
                  onClick={() => setActiveView('docs')}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-semibold transition-all",
                    activeView === 'docs' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Documents ({aiAnalysis?.docs.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50">
              <div className="max-w-4xl mx-auto p-6">
                {activeView === 'chat' ? (
                  <div className="space-y-6">
                    {/* Clarity AI Analysis (Now First) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-4">
                        <div className="card p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-[#1F9D8B] rounded-lg flex items-center justify-center">
                                <Bot size={16} className="text-white" />
                              </div>
                              <h4 className="text-xs font-semibold text-slate-900">Clarity AI Analysis</h4>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">
                              <Zap size={10} className="text-orange-500 fill-orange-500" />
                              <span className="text-[9px] font-semibold text-slate-700">{(aiAnalysis?.confidence! * 100).toFixed(0)}% Confidence</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Detected Intent</span>
                              <p className="text-xs font-semibold text-slate-900 mt-0.5">{aiAnalysis?.intent}</p>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Risk Level</span>
                              <p className={cn(
                                "text-xs font-semibold mt-0.5",
                                aiAnalysis?.riskLevel.includes('Low') ? "text-emerald-600" :
                                aiAnalysis?.riskLevel.includes('Medium') ? "text-orange-600" : "text-rose-600"
                              )}>{aiAnalysis?.riskLevel}</p>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Extracted Entities</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {aiAnalysis?.entities.map((entity, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-semibold rounded border border-slate-100">
                                  {entity}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AI Summary</span>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{aiAnalysis?.summary}</p>
                          </div>
                        </div>

                        {/* AI Suggested Response - Only for flagged/review cases */}
                        {(selectedMsg?.isFlagged || selectedMsg?.needsReview) && (
                          <div className="bg-[#1F9D8B] text-white p-6 rounded-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Bot size={80} />
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                                <Reply size={12} className="text-white" />
                              </div>
                              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">Suggested Response</span>
                            </div>
                            <p className="text-sm leading-relaxed mb-6 font-medium">
                              {suggestedResponse}
                            </p>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => handleSendReply(suggestedResponse)}
                                className="flex-1 bg-white text-slate-900 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                              >
                                Approve & Send
                                <ArrowRight size={14} />
                              </button>
                              <button 
                                onClick={() => setReplyText(suggestedResponse)}
                                className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 transition-all border border-white/10"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="card p-5">
                          <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-4">Risk Assessment</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500 font-semibold">Fraud Score</span>
                              <span className="font-bold text-slate-900">12/100</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full w-[12%]" />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Identity verified against government records. No suspicious patterns detected.
                            </p>
                          </div>
                        </div>

                        <div className="card p-5">
                          <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-4">Quick Actions</h4>
                          <div className="space-y-2">
                            <button className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                              <CheckCircle2 size={12} />
                              {aiAnalysis?.suggestedAction}
                            </button>
                            <button className="w-full py-2 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                              Transfer to Expert
                            </button>
                            <button className="w-full py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition-all border border-rose-100">
                              Flag for Fraud
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat History (Now Second) */}
                    <div className="space-y-4 pt-6 border-t border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Conversation History</span>
                      </div>
                      {currentHistory.map((chat, idx) => (
                        <div key={idx} className={cn(
                          "flex flex-col space-y-1",
                          chat.isAi ? "items-end" : "items-start"
                        )}>
                          <span className={cn(
                            "text-[9px] font-bold text-slate-400 uppercase tracking-wider",
                            chat.isAi ? "mr-3" : "ml-3"
                          )}>
                            {chat.isAi ? "Clarity AI Agent" : "Customer"}
                          </span>
                          <div className={cn(
                            "p-4 rounded-xl shadow-sm max-w-[85%] border",
                            chat.isAi 
                              ? "bg-slate-900 text-white rounded-tr-none border-slate-800" 
                              : "bg-white text-slate-700 rounded-tl-none border-slate-200"
                          )}>
                            <p className="text-xs leading-relaxed font-medium">{chat.content}</p>
                            <div className={cn(
                              "mt-1.5 text-[8px] font-bold opacity-40",
                              chat.isAi ? "text-right" : "text-left"
                            )}>
                              {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiAnalysis?.docs.map((doc, i) => (
                      <div key={i} className="card p-4 group hover:border-slate-900 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            {doc.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                          </div>
                          <button className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors">
                            <Download size={14} />
                          </button>
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-900 truncate mb-1">{doc.name}</h5>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-semibold">{doc.size}</span>
                          <button className="text-[9px] font-bold text-slate-900 flex items-center gap-1 hover:underline">
                            View
                            <ExternalLink size={8} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {aiAnalysis?.docs.length === 0 && (
                      <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                        <FileText size={32} className="opacity-10 mb-3" />
                        <p className="text-xs font-bold">No documents attached</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply(replyText);
                }}
                className="max-w-4xl mx-auto flex gap-3"
              >
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a custom response..." 
                    className="input-base pr-12 py-3"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 transition-all"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <InboxIcon size={32} className="opacity-20" />
            </div>
            <p className="text-sm font-bold text-slate-900">No message selected</p>
            <p className="text-xs mt-1 font-medium">Select a conversation from the list to start processing</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

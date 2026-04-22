import React, { useState } from 'react';
import { 
  Send, 
  User, 
  Mail, 
  MessageSquare, 
  ArrowLeft,
  Shield,
  FileText,
  HelpCircle,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, IntakeType, Channel } from '../types/intake';
import { v4 as uuidv4 } from 'uuid';

interface CustomerPortalProps {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ 
  conversations, 
  setConversations 
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewRequest, setIsNewRequest] = useState(false);
  const [newRequestType, setNewRequestType] = useState<IntakeType | null>(null);
  const [newRequestChannel, setNewRequestChannel] = useState<Channel>('CHAT');
  const [messageText, setMessageText] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; type: string; url: string }[]>([]);
  const [demographics, setDemographics] = useState({ age: '', zip: '', city: '' });
  const [salary, setSalary] = useState('');

  const mockPolicies = [
    { id: 'POL-88291', type: 'Health - Gold Plan', status: 'ACTIVE' },
    { id: 'POL-11023', type: 'Auto - Comprehensive', status: 'ACTIVE' },
    { id: 'POL-55432', type: 'Home - Standard', status: 'EXPIRED' },
  ];

  const selectedConversation = conversations.find(c => c.id === selectedId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachments(prev => [...prev, {
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      }]);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() && attachments.length === 0) return;

    if (isNewRequest && newRequestType) {
      const newConv: Conversation = {
        id: `CONV-${Math.floor(Math.random() * 10000)}`,
        customer_name: 'Akash', // Simulated current user
        customer_email: 'akash@claritty.info',
        subject: subject || `${newRequestType} Request`,
        channel: newRequestChannel,
        type: newRequestType,
        status: 'OPEN',
        last_message_at: new Date().toISOString(),
        policy_id: selectedPolicy || undefined,
        metadata: newRequestType === 'SALES_APPLICATION' ? {
          demographics,
          salary,
          channel: newRequestChannel
        } : undefined,
        messages: [
          {
            id: uuidv4(),
            sender: 'CUSTOMER',
            content: messageText,
            timestamp: new Date().toISOString(),
            attachments: attachments.length > 0 ? attachments : undefined
          }
        ]
      };
      setConversations(prev => [newConv, ...prev]);
      setSelectedId(newConv.id);
      setIsNewRequest(false);
      setNewRequestType(null);
      setMessageText('');
      setSubject('');
      setAttachments([]);
      setSelectedPolicy(null);
    } else if (selectedId) {
      const newMessage: Message = {
        id: uuidv4(),
        sender: 'CUSTOMER',
        content: messageText,
        timestamp: new Date().toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined
      };
      setConversations(prev => prev.map(c => 
        c.id === selectedId 
          ? { ...c, messages: [...c.messages, newMessage], last_message_at: newMessage.timestamp, status: 'OPEN' }
          : c
      ));
      setMessageText('');
      setAttachments([]);
    }
  };

  const requestTypes: { type: IntakeType; label: string; icon: any; description: string }[] = [
    { type: 'QUOTE', label: 'Get a Quote', icon: FileText, description: 'Get a personalized insurance quote in minutes.' },
    { type: 'SALES_APPLICATION', label: 'Sales Application', icon: Plus, description: 'Apply for our sales program and receive your unique code.' },
    { type: 'CLAIM', label: 'File a Claim', icon: AlertCircle, description: 'Report an incident or track an existing claim.' },
    { type: 'POLICY_INFO', label: 'Policy Details', icon: HelpCircle, description: 'Ask questions about your current coverage.' },
    { type: 'NOMINEE_CHANGE', label: 'Update Nominee', icon: User, description: 'Change or add beneficiaries to your policy.' },
    { type: 'GENERAL', label: 'General Inquiry', icon: MessageSquare, description: 'Anything else you need help with.' },
  ];

  return (
    <div className="h-full bg-surface-container-lowest flex items-center justify-center p-8 font-headline">
      <div className="w-full max-w-4xl h-full bg-surface rounded-2xl shadow-2xl border border-outline-variant/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-primary p-6 text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-on-primary/20 rounded-full flex items-center justify-center">
              <Shield size={24} className="text-on-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter leading-none">Aurastack Support</h1>
              <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-1">Healthcare Insurance Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-on-primary/10 rounded-full border border-on-primary/20">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase">Live Support Online</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - My Conversations */}
          <div className="w-72 border-r border-outline-variant/10 bg-surface-container-low/30 flex flex-col">
            <div className="p-4 border-b border-outline-variant/10">
              <button 
                type="button"
                onClick={() => { setIsNewRequest(true); setSelectedId(null); }}
                className="btn btn-primary btn-block shadow-lg shadow-primary/20"
              >
                <Plus size={14} className="shrink-0" />
                New request
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 text-[9px] font-bold opacity-40 uppercase tracking-widest">My Policies</div>
              <div className="px-4 space-y-2 mb-6">
                {mockPolicies.map(p => (
                  <div key={p.id} className="p-3 bg-surface-container-highest/50 rounded-lg border border-outline-variant/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold">{p.type}</span>
                      <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>{p.status}</span>
                    </div>
                    <p className="text-[9px] opacity-40">{p.id}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 text-[9px] font-bold opacity-40 uppercase tracking-widest">Help & Support</div>
              <div className="px-4 space-y-2 mb-6">
                <button className="w-full flex items-center gap-3 p-2 text-left hover:bg-surface-container-high rounded-lg transition-all">
                  <HelpCircle size={14} className="opacity-40" />
                  <span className="text-[10px] font-bold">FAQs</span>
                </button>
                <button className="w-full flex items-center gap-3 p-2 text-left hover:bg-surface-container-high rounded-lg transition-all">
                  <Shield size={14} className="opacity-40" />
                  <span className="text-[10px] font-bold">Privacy Policy</span>
                </button>
              </div>

              <div className="p-4 text-[9px] font-bold opacity-40 uppercase tracking-widest">My Conversations</div>
              {conversations.filter(c => c.customer_email === 'akash@claritty.info' || c.customer_name === 'Akash').map(conv => (
                <button
                  key={conv.id}
                  onClick={() => { setSelectedId(conv.id); setIsNewRequest(false); }}
                  className={`w-full p-4 text-left border-b border-outline-variant/5 transition-all hover:bg-surface-container-high ${
                    selectedId === conv.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-primary uppercase tracking-tighter">
                      {conv.type}
                    </span>
                    <span className="text-[8px] opacity-40">
                      {new Date(conv.last_message_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold truncate mb-1">{conv.subject}</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      conv.status === 'OPEN' ? 'bg-secondary' : 
                      conv.status === 'IN_PROGRESS' ? 'bg-primary' : 
                      'bg-green-500'
                    }`}></div>
                    <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest">{conv.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-surface">
            {isNewRequest ? (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {!newRequestType ? (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-xl font-black tracking-tighter mb-2">How can we help you today?</h2>
                      <p className="text-xs text-on-surface-variant opacity-60">Select a request type to start a conversation with our team.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {requestTypes.map(rt => (
                        <button
                          key={rt.type}
                          onClick={() => setNewRequestType(rt.type)}
                          className="card-elevated--interactive flex items-center gap-4 p-4 rounded-xl text-left group"
                        >
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all">
                            <rt.icon size={24} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold tracking-tight">{rt.label}</h3>
                            <p className="text-[10px] opacity-50">{rt.description}</p>
                          </div>
                          <ChevronRight size={16} className="opacity-20 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-lg mx-auto">
                    <button 
                      type="button"
                      onClick={() => setNewRequestType(null)}
                      className="btn btn-ghost -ml-1 px-2 text-primary"
                    >
                      <ArrowLeft size={12} className="shrink-0" />
                      Back to types
                    </button>
                    <div className="space-y-4">
                      <h2 className="text-xl font-black tracking-tighter">Start your {newRequestType} request</h2>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Select Policy</label>
                        <div className="grid grid-cols-1 gap-2">
                          {mockPolicies.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPolicy(p.id)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                selectedPolicy === p.id 
                                  ? 'bg-primary/10 border border-transparent' 
                                  : 'card-elevated--interactive'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold">{p.type}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                  p.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                }`}>{p.status}</span>
                              </div>
                              <p className="text-[9px] opacity-50">{p.id}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Channel</label>
                        <div className="flex gap-2">
                          {(['CHAT', 'EMAIL'] as const).map(c => (
                            <button
                              key={c}
                              onClick={() => setNewRequestChannel(c)}
                              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                                newRequestChannel === c 
                                  ? 'card-elevated font-bold ring-1 ring-primary/50 text-on-surface' 
                                  : 'card-elevated--interactive'
                              }`}
                            >
                              {c === 'CHAT' ? <MessageSquare size={16} /> : <Mail size={16} />}
                              <span className="text-[10px] uppercase tracking-widest">{c}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Subject</label>
                        <input 
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="E.G. NEW POLICY QUOTE FOR FAMILY"
                          className="w-full bg-surface-container-low border border-outline-variant/10 rounded-lg p-4 text-xs focus:ring-1 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Message</label>
                        <textarea 
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="DESCRIBE YOUR REQUEST IN DETAIL..."
                          className="w-full bg-surface-container-low border border-outline-variant/10 rounded-lg p-4 text-xs min-h-[150px] focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                        />
                      </div>

                      {newRequestType === 'SALES_APPLICATION' && (
                        <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">Sales Application Details</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Age</label>
                              <input 
                                type="number"
                                value={demographics.age}
                                onChange={(e) => setDemographics(prev => ({ ...prev, age: e.target.value }))}
                                className="w-full bg-surface border border-outline-variant/10 rounded-lg p-3 text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Zip Code</label>
                              <input 
                                value={demographics.zip}
                                onChange={(e) => setDemographics(prev => ({ ...prev, zip: e.target.value }))}
                                className="w-full bg-surface border border-outline-variant/10 rounded-lg p-3 text-xs"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Annual Salary ($)</label>
                            <input 
                              type="number"
                              value={salary}
                              onChange={(e) => setSalary(e.target.value)}
                              className="w-full bg-surface border border-outline-variant/10 rounded-lg p-3 text-xs"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Attachments</label>
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-surface-container-highest rounded-lg border border-outline-variant/10">
                              <FileText size={14} className="text-primary" />
                              <span className="text-[10px] font-medium max-w-[100px] truncate">{file.name}</span>
                              <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="btn-icon-sm text-error hover:bg-error/10">
                                <Plus size={12} className="rotate-45" />
                              </button>
                            </div>
                          ))}
                          <label className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-outline-variant/20 rounded-lg hover:border-primary/50 transition-all cursor-pointer">
                            <Plus size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Add File</span>
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                          </label>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={handleSendMessage}
                        disabled={!messageText.trim()}
                        className="btn btn-primary btn-block shadow-xl shadow-primary/20 disabled:opacity-50"
                      >
                        Submit request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-outline-variant/10 bg-surface-container-low/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                      <User size={16} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold tracking-tight">{selectedConversation.subject}</h2>
                      <p className="text-[9px] opacity-50 uppercase tracking-widest">Conversation ID: {selectedConversation.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${
                      selectedConversation.status === 'CONVERTED_TO_CASE' 
                        ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                        : 'bg-secondary/10 border-secondary/20 text-secondary'
                    }`}>
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-surface-container-lowest/20">
                  {selectedConversation.messages.map((msg, idx) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.sender === 'CUSTOMER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] space-y-1 ${msg.sender === 'CUSTOMER' ? 'items-end flex flex-col' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">
                            {msg.sender === 'CUSTOMER' ? 'You' : 'Aurastack Agent'} • {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className={`p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          msg.sender === 'CUSTOMER' 
                            ? 'bg-primary text-on-primary rounded-tr-none' 
                            : 'bg-surface border border-outline-variant/10 text-on-surface rounded-tl-none'
                        }`}>
                          {msg.content}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-on-primary/10 space-y-2">
                              {msg.attachments.map((file, fIdx) => (
                                <div key={fIdx} className="flex items-center gap-2 text-[10px] bg-on-primary/10 p-2 rounded-lg">
                                  <FileText size={12} />
                                  <span className="truncate max-w-[150px]">{file.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedConversation.status === 'CONVERTED_TO_CASE' && (
                    <div className="flex justify-center py-4">
                      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 flex items-center gap-4 max-w-md">
                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                          <CheckCircle2 size={24} className="text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-green-500">Request Converted to Case</p>
                          <p className="text-[10px] opacity-60">Your request has been moved to our processing engine. Case ID: {selectedConversation.linked_case_id}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                {selectedConversation.status !== 'CONVERTED_TO_CASE' && (
                  <div className="p-4 bg-surface border-t border-outline-variant/10">
                    <div className="relative flex items-center gap-2">
                      <input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="TYPE YOUR MESSAGE..."
                        className="flex-1 bg-surface-container-low border border-outline-variant/10 rounded-full px-6 py-3 text-xs focus:ring-1 focus:ring-primary/20 transition-all placeholder:opacity-30"
                      />
                      <button 
                        type="button"
                        onClick={handleSendMessage}
                        disabled={!messageText.trim()}
                        className="btn-icon shrink-0 !rounded-full bg-primary text-on-primary shadow-lg shadow-primary/20 hover:!bg-primary hover:opacity-90 hover:!text-on-primary disabled:opacity-50"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
                <div className="w-24 h-24 bg-surface-container-highest rounded-full flex items-center justify-center mb-6">
                  <MessageSquare size={48} />
                </div>
                <h2 className="text-xl font-black tracking-tighter mb-2">Welcome to Aurastack Support</h2>
                <p className="text-xs max-w-xs">Select an existing conversation or start a new request to get help with your insurance policy.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

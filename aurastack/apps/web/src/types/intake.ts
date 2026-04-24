export type Channel = 'CHAT' | 'EMAIL';
export type IntakeType = 'QUOTE' | 'CLAIM' | 'POLICY_INFO' | 'NOMINEE_CHANGE' | 'GENERAL' | 'HOSPITAL_INTAKE' | 'KYC' | 'RENEWAL' | 'COMPLIANCE' | 'SALES_APPLICATION';
export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CONVERTED_TO_CASE';

export interface Message {
  id: string;
  sender: 'CUSTOMER' | 'AGENT' | 'AI';
  content: string;
  timestamp: string;
  attachments?: {
    name: string;
    type: string;
    url: string;
  }[];
}

export interface Conversation {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  channel: Channel;
  type: IntakeType;
  status: ConversationStatus;
  last_message_at: string;
  messages: Message[];
  assigned_to?: string;
  linked_case_id?: string;
  policy_id?: string;
  metadata?: Record<string, any>;
  extracted_entities?: {
    policy_number?: string;
    claim_amount?: number;
    incident_date?: string;
    location?: string;
    claimant_name?: string;
    confidence_score: number;
  };
}

import { Conversation } from '../types/intake';

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'CONV-1',
    customer_name: 'John Doe',
    customer_email: 'john.doe@example.com',
    subject: 'New Policy Quote Request',
    channel: 'CHAT',
    type: 'QUOTE',
    status: 'OPEN',
    last_message_at: '2026-03-30T08:30:00Z',
    policy_id: 'POL-88291',
    extracted_entities: {
      policy_number: 'POL-88291',
      confidence_score: 94
    },
    messages: [
      {
        id: 'MSG-1',
        sender: 'CUSTOMER',
        content: 'Hi, I would like to get a quote for a new health insurance policy. My current policy is POL-88291.',
        timestamp: '2026-03-30T08:30:00Z'
      }
    ]
  },
  {
    id: 'CONV-2',
    customer_name: 'Jane Smith',
    customer_email: 'jane.smith@example.com',
    subject: 'Claim Inquiry - #PAT-2',
    channel: 'EMAIL',
    type: 'CLAIM',
    status: 'IN_PROGRESS',
    last_message_at: '2026-03-30T08:45:00Z',
    extracted_entities: {
      policy_number: 'POL-11023',
      claim_amount: 12500,
      incident_date: '2026-03-15T10:00:00Z',
      confidence_score: 88
    },
    messages: [
      {
        id: 'MSG-2',
        sender: 'CUSTOMER',
        content: 'I am writing to check the status of my claim #PAT-2. It has been in review for a while.',
        timestamp: '2026-03-30T08:40:00Z'
      },
      {
        id: 'MSG-3',
        sender: 'AGENT',
        content: 'Hello Jane, I am looking into this for you. Our clinical risk modeler is currently reviewing the readmission patterns.',
        timestamp: '2026-03-30T08:45:00Z'
      }
    ],
    assigned_to: 'Medical-Data-Extractor'
  },
  {
    id: 'CONV-3',
    customer_name: 'Alice Brown',
    customer_email: 'alice.brown@example.com',
    subject: 'Change of Nominee',
    channel: 'CHAT',
    type: 'NOMINEE_CHANGE',
    status: 'OPEN',
    last_message_at: '2026-03-30T08:55:00Z',
    extracted_entities: {
      claimant_name: 'Alice Brown',
      confidence_score: 99
    },
    messages: [
      {
        id: 'MSG-4',
        sender: 'CUSTOMER',
        content: 'I need to update the nominee on my policy. How can I do that?',
        timestamp: '2026-03-30T08:55:00Z'
      }
    ]
  },
  {
    id: 'CONV-HOSP-1',
    customer_name: 'St. Jude Medical Center',
    customer_email: 'intake@stjude-medical.org',
    subject: 'New Admission Intake - Patient: Robert Wilson',
    channel: 'EMAIL',
    type: 'HOSPITAL_INTAKE',
    status: 'OPEN',
    last_message_at: '2026-03-30T10:15:00Z',
    extracted_entities: {
      claimant_name: 'Robert Wilson',
      policy_number: 'POL-77210',
      confidence_score: 96
    },
    messages: [
      {
        id: 'MSG-H1',
        sender: 'CUSTOMER',
        content: 'Patient Robert Wilson (POL-77210) has been admitted for emergency surgery. Please find the preliminary intake forms attached.',
        timestamp: '2026-03-30T10:15:00Z',
        attachments: [
          { name: 'intake_form_wilson.pdf', type: 'application/pdf', url: '#' }
        ]
      }
    ]
  },
  {
    id: 'CONV-4',
    customer_name: 'Robert Miller',
    customer_email: 'r.miller@example.com',
    subject: 'Policy Renewal Inquiry',
    channel: 'EMAIL',
    type: 'RENEWAL',
    status: 'OPEN',
    last_message_at: '2026-03-31T01:00:00Z',
    messages: [
      {
        id: 'MSG-5',
        sender: 'CUSTOMER',
        content: 'My policy is up for renewal next month. Will my premium change based on my recent claims?',
        timestamp: '2026-03-31T01:00:00Z'
      }
    ]
  },
  {
    id: 'CONV-5',
    customer_name: 'Sarah Jenkins',
    customer_email: 's.jenkins@example.com',
    subject: 'KYC Document Submission',
    channel: 'CHAT',
    type: 'KYC',
    status: 'IN_PROGRESS',
    last_message_at: '2026-03-31T02:30:00Z',
    messages: [
      {
        id: 'MSG-6',
        sender: 'CUSTOMER',
        content: 'I have uploaded my passport and utility bill for the identity verification. Can you please check if they are okay?',
        timestamp: '2026-03-31T02:30:00Z',
        attachments: [
          { name: 'passport_scan.jpg', type: 'image/jpeg', url: '#' },
          { name: 'utility_bill.pdf', type: 'application/pdf', url: '#' }
        ]
      }
    ]
  },
  {
    id: 'CONV-6',
    customer_name: 'Tech Solutions Ltd',
    customer_email: 'admin@techsolutions.com',
    subject: 'Compliance Certificate Request',
    channel: 'EMAIL',
    type: 'COMPLIANCE',
    status: 'OPEN',
    last_message_at: '2026-03-31T03:15:00Z',
    messages: [
      {
        id: 'MSG-7',
        sender: 'CUSTOMER',
        content: 'We need the latest SOC2 compliance certificate for our annual audit. Could you please provide the most recent one?',
        timestamp: '2026-03-31T03:15:00Z'
      }
    ]
  }
];

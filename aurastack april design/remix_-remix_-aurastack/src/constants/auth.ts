import { Role } from '../types/auth';

export const ROLES: Role[] = [
  {
    id: 'ADMIN',
    name: 'System Administrator',
    description: 'Full access to all system functions, user management, and configuration.',
    permissions: [
      'VIEW_CASES', 'EDIT_CASES', 'VIEW_MEDICAL_RECORDS', 'EDIT_MEDICAL_RECORDS',
      'VIEW_FINANCIALS', 'EDIT_FINANCIALS', 'VIEW_WORKFLOWS', 'EDIT_WORKFLOWS',
      'VIEW_AGENTS', 'EDIT_AGENTS', 'VIEW_SYSTEM', 'EDIT_SYSTEM',
      'VIEW_AUDIT_TRAIL', 'MANAGE_ROLES', 'VIEW_INBOX', 'REPLY_INBOX',
      'VIEW_DATA_LAB', 'IMPORT_DATA'
    ],
    compliance_level: ['SOC2', 'ISO27001', 'GDPR', 'HIPAA'] as any
  },
  {
    id: 'MEDICAL_ADJUSTER',
    name: 'Medical Adjuster',
    description: 'Specialized in clinical review and medical record processing.',
    permissions: [
      'VIEW_CASES', 'EDIT_CASES', 'VIEW_MEDICAL_RECORDS', 'EDIT_MEDICAL_RECORDS',
      'VIEW_AUDIT_TRAIL', 'VIEW_INBOX', 'REPLY_INBOX'
    ],
    compliance_level: ['HIPAA', 'GDPR'] as any
  },
  {
    id: 'UNDERWRITER',
    name: 'Underwriter',
    description: 'Responsible for risk assessment and policy issuance.',
    permissions: [
      'VIEW_CASES', 'EDIT_CASES', 'VIEW_MEDICAL_RECORDS', 'VIEW_FINANCIALS',
      'VIEW_WORKFLOWS', 'VIEW_AUDIT_TRAIL', 'VIEW_INBOX', 'REPLY_INBOX'
    ],
    compliance_level: ['GDPR', 'ISO27001'] as any
  },
  {
    id: 'COMPLIANCE_OFFICER',
    name: 'Compliance Officer',
    description: 'Monitors system integrity and audits all data access.',
    permissions: [
      'VIEW_CASES', 'VIEW_AUDIT_TRAIL', 'VIEW_SYSTEM', 'MANAGE_ROLES'
    ],
    compliance_level: ['SOC2', 'ISO27001', 'GDPR', 'HIPAA'] as any
  },
  {
    id: 'CLAIMS_MANAGER',
    name: 'Claims Manager',
    description: 'Oversees claim processing and financial settlements.',
    permissions: [
      'VIEW_CASES', 'EDIT_CASES', 'VIEW_FINANCIALS', 'EDIT_FINANCIALS',
      'VIEW_AUDIT_TRAIL', 'VIEW_INBOX', 'REPLY_INBOX'
    ],
    compliance_level: ['SOC2', 'GDPR'] as any
  },
  {
    id: 'SUPPORT_AGENT',
    name: 'Support Agent',
    description: 'Handles customer inquiries and initial intake.',
    permissions: [
      'VIEW_INBOX', 'REPLY_INBOX', 'VIEW_CASES'
    ],
    compliance_level: ['GDPR'] as any
  }
];

export const INITIAL_USER = {
  id: 'USR-001',
  name: 'Akash',
  email: 'akash@claritty.biz',
  role: 'ADMIN' as const,
  department: 'SYSTEM'
};

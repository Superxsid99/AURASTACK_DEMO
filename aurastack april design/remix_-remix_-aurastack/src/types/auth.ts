export type Permission = 
  | 'VIEW_CASES'
  | 'EDIT_CASES'
  | 'VIEW_MEDICAL_RECORDS'
  | 'EDIT_MEDICAL_RECORDS'
  | 'VIEW_FINANCIALS'
  | 'EDIT_FINANCIALS'
  | 'VIEW_WORKFLOWS'
  | 'EDIT_WORKFLOWS'
  | 'VIEW_AGENTS'
  | 'EDIT_AGENTS'
  | 'VIEW_SYSTEM'
  | 'EDIT_SYSTEM'
  | 'VIEW_AUDIT_TRAIL'
  | 'MANAGE_ROLES'
  | 'VIEW_INBOX'
  | 'REPLY_INBOX'
  | 'VIEW_DATA_LAB'
  | 'IMPORT_DATA';

export type RoleId = 
  | 'ADMIN' 
  | 'CASE_REVIEWER' 
  | 'FRAUD_ANALYST' 
  | 'FINANCIAL_OFFICER' 
  | 'HOSPITAL_COORD' 
  | 'MEDICAL_ADJUSTER' 
  | 'UNDERWRITER' 
  | 'COMPLIANCE_OFFICER' 
  | 'CLAIMS_MANAGER' 
  | 'SUPPORT_AGENT';

export type ComplianceStandard = 'HIPAA' | 'GDPR' | 'SOC2' | 'ISO27001';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
  compliance_level: ComplianceStandard[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  department: string;
}

export const ROLE_PERMISSIONS: Record<string, { resource: string; action: string }[]> = {
  ADMIN: [
    { resource: 'FINANCIALS', action: 'READ' },
    { resource: 'FINANCIALS', action: 'WRITE' },
    { resource: 'FRAUD_DATA', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'WRITE' },
  ],
  CASE_REVIEWER: [
    { resource: 'MEDICAL_DATA', action: 'READ' },
  ],
  FRAUD_ANALYST: [
    { resource: 'FRAUD_DATA', action: 'READ' },
  ],
  FINANCIAL_OFFICER: [
    { resource: 'FINANCIALS', action: 'READ' },
    { resource: 'FINANCIALS', action: 'WRITE' },
  ],
  HOSPITAL_COORD: [
    { resource: 'MEDICAL_DATA', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'WRITE' },
  ],
  MEDICAL_ADJUSTER: [
    { resource: 'MEDICAL_DATA', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'WRITE' },
  ],
  UNDERWRITER: [
    { resource: 'FINANCIALS', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'READ' },
  ],
  COMPLIANCE_OFFICER: [
    { resource: 'FINANCIALS', action: 'READ' },
    { resource: 'FRAUD_DATA', action: 'READ' },
    { resource: 'MEDICAL_DATA', action: 'READ' },
  ],
  CLAIMS_MANAGER: [
    { resource: 'FINANCIALS', action: 'READ' },
    { resource: 'FINANCIALS', action: 'WRITE' },
  ],
  SUPPORT_AGENT: [],
};

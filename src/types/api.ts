// API types aligned with openapi.yaml / QUICK_REFERENCE.md

export type UserRole =
  | 'staff'
  | 'safety-officer'
  | 'fire-warden'
  | 'slt'
  | 'contractor'
  | 'student'
  | 'visitor';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  organization: string;
  organizationCode: string;
  orgId?: string; // Firebase org id (same as organizationCode when using dashboard backend)
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface LoginResponse {
  message: string;
  expiresAt: string;
  maskedIdentifier?: string;
}

export interface VerifyOtpResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface Incident {
  id: string;
  type: 'lockdown' | 'evacuation' | 'fire' | 'medical';
  title: string;
  timestamp: string;
  createdAt?: string;       // API may return createdAt instead of timestamp
  triggeredBy?: string;
  triggeredByName?: string;
  activatedBy?: string;     // API alternate field name
  activatedByName?: string; // API alternate field name
  instructions?: string[];
  isDrill: boolean;
  status: 'active' | 'resolved';
  zone?: string;
  assemblyPointId?: string;
}

export interface IncidentStats {
  totalExpected: number;
  acknowledged: number;
  helpRequested: number;
  noResponse: number;
}

export interface Acknowledgment {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  status: 'safe' | 'help_requested';
  zone?: string;
  acknowledgedAt: string;
  helpReason?: string;
  helpNotes?: string;
}

export interface HelpRequest {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  notes?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  requestedAt: string;
  acknowledged?: boolean;
}

export interface Zone {
  id: string;
  name: string;
  buildingId?: string;
  floor?: string;
}

export interface AssemblyPoint {
  id: string;
  name: string;
  zoneId?: string;
  instructions?: string;
}

export interface OnSitePerson {
  id: string;
  name: string;
  role: string;
  checkInTime: string;
  checkInMethod: 'badge' | 'app' | 'manual';
  acknowledged: boolean;
  acknowledgedAt?: string;
  zone?: string;
  markedSafeBy?: string;
  markedSafeReason?: string;
  /** Checkpoint name when acknowledged at an assembly point (e.g. "Checkpoint A") */
  checkpointName?: string;
}

export const ADMIN_ROLES: UserRole[] = ['safety-officer', 'fire-warden', 'slt'];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canTriggerLockdown(role: UserRole): boolean {
  return role === 'safety-officer' || role === 'slt';
}

export function canTriggerEvacuationOrFire(role: UserRole): boolean {
  return ['safety-officer', 'fire-warden', 'slt'].includes(role);
}

export function canTriggerMedical(role: UserRole): boolean {
  return role === 'safety-officer' || role === 'slt';
}

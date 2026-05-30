export type CoverageTier = 'EMPLOYEE_ONLY' | 'EMPLOYEE_SPOUSE' | 'EMPLOYEE_FAMILY';

export interface Dependent {
  name: string;
  relationship: 'SPOUSE' | 'CHILD';
  dob: string;
}

export interface MemberDetails {
  id?: string;
  name: string;
  email: string;
  dob: string;
  dateOfJoining: string;
  eligibilityDate: string;
  coverageTier: CoverageTier;
  targetEffectiveDate: string;
  dependents: Dependent[];
}

export type EndorsementType = 'ADD' | 'TERMINATE' | 'UPDATE';
export type EndorsementStatus = 'PENDING' | 'PENDING_CONFIRMATION' | 'PROCESSING' | 'EFFECTIVE' | 'REJECTED' | 'FAILED';

export interface ErrorDetails {
  errorMessage: string;
  failedStep: string;
  retryCount: number;
}

export interface EndorsementRequest {
  id: string;
  employerId: string;
  memberId?: string;
  type: EndorsementType;
  status: EndorsementStatus;
  submissionType: 'MANUAL' | 'BATCH';
  proratedPremiumImpact: number;
  monthlyPremiumImpact: number;
  anomalies: string[];
  anomalyRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  comments?: string;
  processedAt?: string;
  confirmedBy?: string;
  errorDetails?: ErrorDetails;
  memberDetails: MemberDetails | null;
  idempotencyKey?: string;
  batchId?: string;
}

export type BatchStatus = 'QUEUED' | 'PROCESSING' | 'AWAITING_INSURER' | 'COMPLETED' | 'FAILED';

export interface BatchJob {
  id: string;
  employerId: string;
  status: BatchStatus;
  submittedAt: string;
  completedAt?: string;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failureCount: number;
  totalPremiumImpact: number;
  errorLog: string[];
  endorsementIds: string[];
  slaType?: 'NORMAL' | 'EXPRESS';
  slaDurationHours?: number;
}

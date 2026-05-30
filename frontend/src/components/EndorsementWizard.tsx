import React, { useState, useEffect } from 'react';
import { AlertCircle, UserPlus, FileText, BadgeAlert, ArrowRight, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { Dependent, CoverageTier } from '../types/insurance';

interface MemberDetails {
  id?: string;
  name: string;
  email: string;
  dob: string;
  dateOfJoining: string;
  eligibilityDate: string;
  coverageTier: CoverageTier;
  dependents: Dependent[];
  targetEffectiveDate: string;
}

interface EndorsementWizardProps {
  type: 'ADD' | 'TERMINATE' | 'UPDATE';
  member?: {
    id: string;
    name: string;
    email: string;
    dob: string;
    dateOfJoining: string;
    eligibilityDate: string;
    coverageTier: string;
    monthlyPremium: number;
    dependents: Dependent[];
  };
  eaBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

// Client-side UUID generator for Idempotency-Key
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const EndorsementWizard: React.FC<EndorsementWizardProps> = ({
  type,
  member,
  eaBalance,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<MemberDetails>({
    name: member?.name || '',
    email: member?.email || '',
    dob: member?.dob || '',
    dateOfJoining: member?.dateOfJoining || '',
    eligibilityDate: member?.eligibilityDate || '',
    coverageTier: (member?.coverageTier as CoverageTier) || 'EMPLOYEE_ONLY',
    dependents: member?.dependents ? [...member.dependents] : [],
    targetEffectiveDate: ''
  });

  // Dependent adder temp state
  const [depName, setDepName] = useState('');
  const [depRel, setDepRel] = useState<'SPOUSE' | 'CHILD'>('CHILD');
  const [depDob, setDepDob] = useState('');

  // Financial preview states calculated on-the-fly or via dry-run simulation
  const [monthlyImpact, setMonthlyImpact] = useState(0);
  const [proratedImpact, setProratedImpact] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [idempotencyKey] = useState(generateUUID()); // Locked for this form lifetime

  // Recalculate billing values in Wizard step 3
  const calculatePreview = () => {
    // 1. Estimate Age & Base Premium Rate
    const calculateAge = (dobString: string) => {
      const dob = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
        age--;
      }
      return age;
    };

    const getBaseRate = (age: number) => {
      if (age < 30) return 100;
      if (age <= 45) return 150;
      if (age <= 60) return 220;
      return 350;
    };

    const getMultiplier = (tier: CoverageTier) => {
      if (tier === 'EMPLOYEE_ONLY') return 1.0;
      if (tier === 'EMPLOYEE_SPOUSE') return 1.8;
      return 2.5;
    };

    const empAge = calculateAge(formData.dob);
    const empBase = getBaseRate(empAge);
    const multiplier = getMultiplier(formData.coverageTier);

    let depSum = 0;
    if (formData.coverageTier !== 'EMPLOYEE_ONLY') {
      formData.dependents.forEach(d => {
        const dAge = calculateAge(d.dob);
        depSum += getBaseRate(dAge) * 0.7; // Discounted dependent rate
      });
    }

    const calculatedNewMonthly = (empBase + depSum) * multiplier;
    
    let calculatedMonthlyDelta = calculatedNewMonthly;
    if (type === 'TERMINATE' && member) {
      calculatedMonthlyDelta = -member.monthlyPremium;
    } else if (type === 'UPDATE' && member) {
      calculatedMonthlyDelta = calculatedNewMonthly - member.monthlyPremium;
    }

    // 2. Proration Math
    const effective = new Date(formData.targetEffectiveDate || new Date().toISOString().split('T')[0]);
    const endOfYear = new Date(`${effective.getFullYear()}-12-31T23:59:59Z`);
    const isLeap = effective.getFullYear() % 4 === 0;
    const daysInYear = isLeap ? 366 : 365;

    const timeDiff = endOfYear.getTime() - effective.getTime();
    const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const prorationFraction = Math.max(0, Math.min(days, daysInYear)) / daysInYear;
    
    const calculatedProrated = calculatedMonthlyDelta * 12 * prorationFraction;

    setMonthlyImpact(Math.round(calculatedMonthlyDelta * 100) / 100);
    setProratedImpact(Math.round(calculatedProrated * 100) / 100);
    setDaysRemaining(days);

    // 3. Anomaly warnings simulator
    const tempAnomalies: string[] = [];
    if (empAge < 18 || empAge > 70) {
      tempAnomalies.push(`Employee age (${empAge}) is outside the normal standard band.`);
    }

    const backdatedDiff = Date.now() - effective.getTime();
    const daysBackdated = Math.floor(backdatedDiff / (1000 * 60 * 60 * 24));
    if (daysBackdated > 60) {
      tempAnomalies.push(`Extreme backdating: Request dates back ${daysBackdated} days (limit 60).`);
    }

    if (formData.coverageTier === 'EMPLOYEE_ONLY' && formData.dependents.length > 0) {
      tempAnomalies.push(`Tier is EMPLOYEE_ONLY but dependents were listed.`);
    }

    setAnomalies(tempAnomalies);
  };

  useEffect(() => {
    if (step === 3) {
      calculatePreview();
    }
  }, [step]);

  // Set default target effective dates based on eligibility
  useEffect(() => {
    if (formData.eligibilityDate) {
      setFormData(prev => ({ ...prev, targetEffectiveDate: prev.eligibilityDate }));
    }
  }, [formData.eligibilityDate]);

  const handleAddDependent = () => {
    if (!depName || !depDob) return;
    setFormData(prev => ({
      ...prev,
      dependents: [...prev.dependents, { name: depName, relationship: depRel, dob: depDob }]
    }));
    setDepName('');
    setDepDob('');
  };

  const handleRemoveDependent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      dependents: prev.dependents.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/endorsements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey
        },
        body: JSON.stringify({
          type,
          memberId: member?.id,
          memberDetails: formData
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setErrorMessage(data.error || 'Server error occurred during execution.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network connectivity error.');
    } finally {
      setLoading(false);
    }
  };

  const isFundInsufficient = type !== 'TERMINATE' && proratedImpact > 0 && proratedImpact > eaBalance;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--color-bg-overlay)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
      backdropFilter: 'var(--backdrop-blur)',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        borderRadius: 'var(--border-radius-lg)',
        position: 'relative'
      }}>
        
        {/* Header indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <UserPlus size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '22px', color: '#fff' }}>
              {type === 'ADD' ? 'Initiate Roster Addition' : type === 'TERMINATE' ? 'Initiate Member Termination' : 'Modify Policy Coverage'}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Idempotency-Key locked: <code style={{ color: 'var(--color-primary)' }}>{idempotencyKey.slice(0, 8)}...</code>
            </span>
          </div>
        </div>

        {errorMessage && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: '6px',
            color: 'var(--color-error)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Wizard Steps indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flexGrow: 1,
              height: '4px',
              backgroundColor: step >= i ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
              borderRadius: '2px',
              transition: 'background-color 0.3s'
            }} />
          ))}
        </div>

        {/* STEP 1: Personal Details */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  disabled={type === 'TERMINATE'}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.smith@acme.com"
                  disabled={type === 'TERMINATE'}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  disabled={type === 'TERMINATE'}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.dateOfJoining}
                  onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                  disabled={type === 'TERMINATE'}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Eligibility Date (Retroactive Target - Continuous Medical Coverage)
              </label>
              <input
                type="date"
                className="form-control"
                value={formData.eligibilityDate}
                onChange={(e) => setFormData({ ...formData, eligibilityDate: e.target.value })}
                disabled={type === 'TERMINATE'}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--color-accent)', display: 'block', marginTop: '4px' }}>
                * Backdating eligibility avoids coverage gaps. Premiums are prorated from this day.
              </span>
            </div>

            {type === 'TERMINATE' && (
              <div className="form-group">
                <label className="form-label">Termination Date (Effective Refund Date)</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.targetEffectiveDate}
                  onChange={(e) => setFormData({ ...formData, targetEffectiveDate: e.target.value })}
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => setStep(2)} className="btn btn-primary" disabled={!formData.name || !formData.dob || (type === 'TERMINATE' && !formData.targetEffectiveDate)}>
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Coverage Tier & Dependents */}
        {step === 2 && (
          <div>
            <div className="form-group">
              <label className="form-label">Insurance Coverage Tier</label>
              <select
                className="form-control"
                value={formData.coverageTier}
                onChange={(e) => setFormData({ ...formData, coverageTier: e.target.value as CoverageTier })}
                disabled={type === 'TERMINATE'}
              >
                <option value="EMPLOYEE_ONLY">Employee Only (1.0x multiplier)</option>
                <option value="EMPLOYEE_SPOUSE">Employee + Spouse (1.8x multiplier)</option>
                <option value="EMPLOYEE_FAMILY">Employee + Family (2.5x multiplier)</option>
              </select>
            </div>

            {formData.coverageTier !== 'EMPLOYEE_ONLY' && type !== 'TERMINATE' && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--color-border)',
                marginBottom: '20px'
              }}>
                <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: '12px' }}>Add Dependent</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={depName}
                      onChange={(e) => setDepName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Relation</label>
                    <select
                      className="form-control"
                      value={depRel}
                      onChange={(e) => setDepRel(e.target.value as 'SPOUSE' | 'CHILD')}
                    >
                      <option value="SPOUSE">Spouse</option>
                      <option value="CHILD">Child</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, display: 'flex', gap: '8px' }}>
                    <div style={{ flexGrow: 1 }}>
                      <label className="form-label">DOB</label>
                      <input
                        type="date"
                        className="form-control"
                        value={depDob}
                        onChange={(e) => setDepDob(e.target.value)}
                      />
                    </div>
                    <button type="button" onClick={handleAddDependent} className="btn btn-outline-primary" style={{ padding: '10px 12px' }}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Dependents list */}
                {formData.dependents.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {formData.dependents.map((d, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(10,13,20,0.5)',
                        fontSize: '13px'
                      }}>
                        <span>
                          <strong>{d.name}</strong> ({d.relationship}) — DOB: {d.dob}
                        </span>
                        <button type="button" onClick={() => handleRemoveDependent(index)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn btn-primary">
                Preview Costs <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Financial Preview & Submit */}
        {step === 3 && (
          <div>
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', backgroundColor: 'rgba(10, 13, 20, 0.4)' }}>
              <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                Endorsement Calculation Breakdown
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Coverage Period:</span>
                  <span>{formData.targetEffectiveDate} to Dec 31 (<strong>{daysRemaining} days remaining</strong>)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Monthly Billing Delta:</span>
                  <span style={{ color: monthlyImpact >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {monthlyImpact >= 0 ? '+' : ''}${monthlyImpact.toLocaleString()}/mo
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderTop: '1px dashed var(--color-border)',
                  borderBottom: '1px dashed var(--color-border)',
                  fontSize: '16px',
                  fontWeight: 700
                }}>
                  <span style={{ color: '#fff' }}>Prorated Account Impact:</span>
                  <span style={{ color: proratedImpact >= 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>
                    {proratedImpact >= 0 ? 'Debit: ' : 'Credit Refund: '} 
                    ${Math.abs(proratedImpact).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Current Wallet Balance:</span>
                  <strong>${eaBalance.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* AI Warning Alerts / Insufficient funds block */}
            {isFundInsufficient && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-border)',
                color: 'var(--color-warning)',
                fontSize: '13px',
                marginBottom: '24px',
                display: 'flex',
                gap: '12px'
              }}>
                <BadgeAlert size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Insufficient Account Funds Alert</strong>
                  Your current Endorsement Account balance (${eaBalance.toLocaleString()}) cannot cover this debit of ${proratedImpact.toLocaleString()}. 
                  Submitting will flag this request for pending underwriting confirmation until funds are deposited.
                </div>
              </div>
            )}

            {anomalies.length > 0 && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                color: 'var(--color-error)',
                fontSize: '13px',
                marginBottom: '24px',
                display: 'flex',
                gap: '12px',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={16} />
                  <strong>AI Scan: Warnings Detected ({anomalies.length})</strong>
                </div>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {anomalies.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {!isFundInsufficient && anomalies.length === 0 && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
                fontSize: '13px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldCheck size={18} />
                <span>AI Risk Assessment: <strong>Low-risk profile</strong>. Eligible for instant auto-reconciliation.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep(2)} className="btn btn-secondary">
                Back
              </button>
              <button type="button" onClick={handleSubmit} disabled={loading} className="btn btn-primary" style={{ width: '200px' }}>
                {loading ? 'Submitting...' : 'Commit Transaction'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EndorsementWizard;

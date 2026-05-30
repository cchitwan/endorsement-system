import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertOctagon, Terminal, RefreshCw, X, ShieldAlert, Award, Layers } from 'lucide-react';
import { PolicySummary } from '../App';
import { EndorsementRequest } from '../types/insurance';

interface UnderwriterDashboardProps {
  policy: PolicySummary | null;
  triggerRefresh: () => void;
}

const UnderwriterDashboard: React.FC<UnderwriterDashboardProps> = ({ policy, triggerRefresh }) => {
  const [requests, setRequests] = useState<EndorsementRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<EndorsementRequest | null>(null);
  const [showCert, setShowCert] = useState<EndorsementRequest | null>(null);
  
  // Underwriter rejection comment
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    try {
      const res = await fetch('/api/endorsements');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRequests();
    // Poll queue updates
    const interval = setInterval(loadRequests, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/endorsements/${id}/confirm`, { method: 'POST' });
      if (res.ok) {
        setSelectedReq(null);
        triggerRefresh();
        loadRequests();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve endorsement.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/endorsements/${selectedReq.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: rejectComment })
      });
      if (res.ok) {
        setSelectedReq(null);
        setShowRejectForm(false);
        setRejectComment('');
        triggerRefresh();
        loadRequests();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`/api/endorsements/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        // Find in local array to temporarily set state to spinner for UX
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'PENDING_CONFIRMATION' } : r));
        loadRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingList = requests.filter(r => r.status === 'PENDING_CONFIRMATION');
  const failedList = requests.filter(r => r.status === 'FAILED');
  const effectiveList = requests.filter(r => r.status === 'EFFECTIVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Description bar */}
      <div>
        <h1 style={{ fontSize: '28px', color: '#fff', fontFamily: 'var(--font-family-header)', fontWeight: 800 }}>
          Insurer Underwriting & API Logs
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Evaluate anomalous requests, process manual confirmations, trace API transaction logs, and retry failed entries.
        </p>
      </div>

      <div className="dashboard-split" style={{ gridTemplateColumns: '2.2fr 1.2fr' }}>
        
        {/* Left Hand: Queue Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Pending Underwriting Review Queue */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="var(--color-primary)" /> Underwriting Review Queue
            </h3>

            <div className="table-wrapper">
              <table className="table-premium">
                <thead>
                  <tr>
                    <th>Endorsement ID</th>
                    <th>Employee Name</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Premium Delta</th>
                    <th>Issues</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px 0' }}>
                        No pending endorsements in the underwriting queue.
                      </td>
                    </tr>
                  ) : (
                    pendingList.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedReq(r); setShowRejectForm(false); }}>
                        <td style={{ fontWeight: 600 }}>{r.id}</td>
                        <td>
                          <div>
                            <strong style={{ color: '#fff' }}>{r.memberDetails?.name || 'N/A'}</strong>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              Eligible: {r.memberDetails?.eligibilityDate || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: r.type === 'ADD' ? 'var(--color-accent)' : 'var(--color-warning)' }}>
                            {r.type}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                            {r.submissionType}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: r.proratedPremiumImpact >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            ${r.proratedPremiumImpact.toLocaleString()}
                          </strong>
                        </td>
                        <td>
                          {(r.anomalies || []).length > 0 ? (
                            <span className="badge badge-failed" style={{ fontSize: '10px', padding: '2px 8px' }}>
                              {(r.anomalies || []).length} Flagged
                            </span>
                          ) : (
                            <span className="badge badge-active" style={{ fontSize: '10px', padding: '2px 8px' }}>
                              Low-Risk
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedReq(r); setShowRejectForm(false); }} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time API Errors Log & Retry console */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={18} color="var(--color-error)" /> API Log Console (Simulated Fault Log)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {failedList.length === 0 ? (
                <div style={{
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-muted)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  Zero API integration connection drop faults logged.
                </div>
              ) : (
                failedList.map(r => (
                  <div key={r.id} style={{
                    padding: '16px',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'rgba(239, 68, 68, 0.02)',
                    border: '1px solid var(--color-error-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px'
                  }}>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '2px 6px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: '4px' }}>
                          FAULT
                        </span>
                        <strong style={{ fontSize: '13px', color: '#fff' }}>
                          Endorsement {r.id} ({r.type}) — {r.memberDetails?.name || 'N/A'}
                        </strong>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px', fontFamily: 'monospace' }}>
                        Error: {r.errorDetails?.errorMessage}
                      </p>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                        Failed at: <code style={{ color: 'var(--color-secondary)' }}>{r.errorDetails?.failedStep}</code> | Retries executed: <strong>{r.errorDetails?.retryCount}</strong>
                      </span>
                    </div>
                    <div>
                      <button onClick={() => handleRetry(r.id)} className="btn btn-outline-primary" style={{ padding: '8px 16px', fontSize: '12px', gap: '6px' }}>
                        <RefreshCw size={12} /> Retry Pipeline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Processed/Completed Audited list */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-success)" /> Issued Endorsement Schedule History
            </h3>

            <div className="table-wrapper">
              <table className="table-premium">
                <thead>
                  <tr>
                    <th>Endorsement</th>
                    <th>Roster Subject</th>
                    <th>Confirmation Date</th>
                    <th>Premium Mod</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>
                        No completed endorsements logged in history ledger.
                      </td>
                    </tr>
                  ) : (
                    effectiveList.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.id}</td>
                        <td>
                          <div>
                            <strong style={{ color: '#fff' }}>{r.memberDetails?.name || 'N/A'}</strong>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{r.memberDetails?.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {r.processedAt ? new Date(r.processedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <strong style={{ color: r.proratedPremiumImpact >= 0 ? 'var(--color-success)' : 'var(--color-success)' }}>
                            ${r.proratedPremiumImpact.toLocaleString()}
                          </strong>
                        </td>
                        <td>
                          <button onClick={() => setShowCert(r)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', gap: '4px' }}>
                            <Award size={12} /> View cert
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Hand: Inspection drawer / decision console */}
        <div>
          {selectedReq ? (
            <div className="glass-panel" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', color: '#fff' }}>Underwriting Inspection</h3>
                <button onClick={() => setSelectedReq(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
                
                <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Proposed Member</span>
                  <strong style={{ display: 'block', color: '#fff', fontSize: '14px', marginTop: '4px' }}>{selectedReq.memberDetails?.name || 'N/A'}</strong>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{selectedReq.memberDetails?.email || 'N/A'}</span>
                </div>

                <div>
                  <span className="form-label" style={{ fontSize: '10px' }}>Request Details</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Type:</span>
                      <strong>{selectedReq.type}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Coverage Tier:</span>
                      <strong>{selectedReq.memberDetails?.coverageTier || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Eligibility Date:</span>
                      <strong>{selectedReq.memberDetails?.eligibilityDate || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Effective Date:</span>
                      <strong>{selectedReq.memberDetails?.targetEffectiveDate || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="form-label" style={{ fontSize: '10px' }}>Financial Ledger Impact</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Monthly Delta:</span>
                      <strong>${selectedReq.monthlyPremiumImpact.toLocaleString()}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-primary)' }}>
                      <span>Prorated Due:</span>
                      <strong>${selectedReq.proratedPremiumImpact.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* Anomalies listed */}
                {(selectedReq.anomalies || []).length > 0 && (
                  <div>
                    <span className="form-label" style={{ fontSize: '10px', color: 'var(--color-error)' }}>Flagged Anomalies</span>
                    <ul style={{ color: 'var(--color-error)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '11px' }}>
                      {(selectedReq.anomalies || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {selectedReq.comments && (
                  <div>
                    <span className="form-label" style={{ fontSize: '10px' }}>Routing Note</span>
                    <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>{selectedReq.comments}</p>
                  </div>
                )}

                {/* Actions Panel */}
                {!showRejectForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    <button onClick={() => handleConfirm(selectedReq.id)} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                      {submitting ? 'Confirming...' : 'Approve & Issue Certificate'}
                    </button>
                    <button onClick={() => setShowRejectForm(true)} className="btn btn-secondary" style={{ width: '100%', color: 'var(--color-error)' }}>
                      Reject Endorsement
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReject} style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Underwriter Comment (Reason for Rejection)</label>
                      <textarea
                        className="form-control"
                        required
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder="State reason: e.g. Dependent document confirmation mismatch..."
                        style={{ height: '80px', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowRejectForm(false)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={submitting} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }}>
                        Confirm Reject
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', borderStyle: 'dashed' }}>
              <Layers size={24} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px auto' }} />
              Select an endorsement request from the list to inspect details.
            </div>
          )}
        </div>

      </div>

      {/* OVERLAY MODAL: Premium Endorsement Certificate Viewer */}
      {showCert && (
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
          backdropFilter: 'var(--backdrop-blur)'
        }}>
          <div className="glass-panel" style={{ width: '560px', padding: '40px', borderRadius: 'var(--border-radius-lg)', position: 'relative' }}>
            <button onClick={() => setShowCert(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            {/* Certificate frame layout */}
            <div style={{
              border: '2px solid rgba(99, 102, 241, 0.3)',
              padding: '32px',
              borderRadius: 'var(--border-radius-sm)',
              backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(99,102,241,0.03) 0%, transparent 80%)',
              textAlign: 'center'
            }}>
              <Award size={48} color="var(--color-primary)" style={{ margin: '0 auto 16px auto' }} />
              
              <h3 style={{ fontSize: '20px', color: '#fff', fontFamily: 'var(--font-family-header)', letterSpacing: '0.02em' }}>
                Endorsement Certificate
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Aegis Shield Assurance Group
              </span>

              <div style={{
                margin: '24px 0',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
                padding: '20px 0',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Certificate Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>CERT-{showCert.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Policy ID Reference:</span>
                  <strong>{policy?.policyId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Employer Admin:</span>
                  <strong>{policy?.employerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}> Roster Subject:</span>
                  <strong style={{ color: '#fff' }}>{showCert.memberDetails?.name || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Coverage Commences:</span>
                  <strong style={{ color: 'var(--color-accent)' }}>{showCert.memberDetails?.eligibilityDate || 'N/A'} (Zero-Gap Guarantee)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Confirmed By:</span>
                  <span>{showCert.confirmedBy}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed var(--color-border)', fontSize: '14px', fontWeight: 700 }}>
                  <span>Prorated Account Fee:</span>
                  <span style={{ color: showCert.proratedPremiumImpact >= 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>
                    {showCert.proratedPremiumImpact >= 0 ? 'Charged ' : 'Refunded '}
                    ${Math.abs(showCert.proratedPremiumImpact).toLocaleString()}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                This document confirms the insurance contract modification has been successfully reconciled and processed. Subject to premium validation schedules.
              </p>

              <button onClick={() => setShowCert(null)} className="btn btn-primary" style={{ marginTop: '24px' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UnderwriterDashboard;

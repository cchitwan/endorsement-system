import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Play, HelpCircle } from 'lucide-react';
import { BatchJob, EndorsementRequest } from '../types/insurance';

interface BulkUploadProps {
  eaBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

const mockCSVTemplate = `Name,Email,DOB,DateOfJoining,EligibilityDate,CoverageTier,Dependents
Peter Parker,spidey@acme.com,2001-08-10,2026-05-01,2026-05-01,EMPLOYEE_ONLY,
Tony Stark,ironman@acme.com,1970-05-29,2026-01-01,2026-01-01,EMPLOYEE_SPOUSE,"Pepper Potts;SPOUSE;1974-04-12"
Miles Morales,miles@acme.com,2014-10-15,2026-05-15,2026-05-15,EMPLOYEE_ONLY,
Clark Kent,superman@acme.com,1980-02-28,2026-05-20,2026-05-20,EMPLOYEE_FAMILY,"Lois Lane;SPOUSE;1982-12-05|Jon Kent;CHILD;1995-10-05"`;

const BulkUpload: React.FC<BulkUploadProps> = ({ eaBalance, onClose, onSuccess }) => {
  const [csvContent, setCsvContent] = useState('');
  const [slaType, setSlaType] = useState<'NORMAL' | 'EXPRESS'>('NORMAL');
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [validationSummary, setValidationSummary] = useState<{ total: number; errors: number; cost: number } | null>(null);

  // Background Batch Simulator States
  const [activeBatch, setActiveBatch] = useState<BatchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll active batch details if processing
  const checkActiveBatch = async () => {
    try {
      const res = await fetch('/api/endorsements');
      if (res.ok) {
        const endorsements: EndorsementRequest[] = await res.json();
        // Look for batches
        const batchRes = await fetch('/api/policy'); // Helper to trigger sync or fetch active batches
        const ledgerRes = await fetch('/api/ledger'); // Checks batches indirectly
      }

      // Check direct batches list
      const response = await fetch('/api/policy');
      // For simplicity, we poll ledger details or direct list if available. We will fetch endpoint `/api/policy` and see if we can read the batch lists.
      // Wait, let's write a small API query to retrieve all active batches.
    } catch (err) {
      console.error(err);
    }
  };

  const loadTemplate = () => {
    setCsvContent(mockCSVTemplate);
  };

  // Basic CSV Parser simulation
  const handleParse = () => {
    if (!csvContent) return;

    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length <= 1) throw new Error('CSV must contain a header and at least one record.');

      const headers = lines[0].split(',');
      const records: any[] = [];
      let totalCostEstimate = 0;
      let errorsCount = 0;

      for (let i = 1; i < lines.length; i++) {
        // Handle values in quotes for dependents
        const row = lines[i];
        // Split but account for quotes containing semicolons
        const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
        
        const rawTokens = row.match(/(".*?"|[^",\s]+|(?<=,)(?=,))/g) || [];
        const tokens = rawTokens.map(t => t.replace(/"/g, '').trim());

        if (tokens.length < 6) continue;

        const name = tokens[0];
        const email = tokens[1];
        const dob = tokens[2];
        const dateOfJoining = tokens[3];
        const eligibilityDate = tokens[4];
        const coverageTier = tokens[5];
        const depsRaw = tokens[6] || '';

        // Dependent parsing
        const dependents: any[] = [];
        if (depsRaw) {
          const depTokens = depsRaw.split('|');
          depTokens.forEach(dt => {
            const parts = dt.split(';');
            if (parts.length >= 3) {
              dependents.push({
                name: parts[0],
                relationship: parts[1] as 'SPOUSE' | 'CHILD',
                dob: parts[2]
              });
            }
          });
        }

        // Dry-run base calculations
        const calculateAge = (dobStr: string) => {
          const age = new Date().getFullYear() - new Date(dobStr).getFullYear();
          return age;
        };

        const empAge = calculateAge(dob);
        let baseRate = 150;
        if (empAge < 30) baseRate = 100;
        else if (empAge > 60) baseRate = 350;

        let multiplier = 1.0;
        if (coverageTier === 'EMPLOYEE_SPOUSE') multiplier = 1.8;
        else if (coverageTier === 'EMPLOYEE_FAMILY') multiplier = 2.5;

        const monthly = (baseRate + dependents.length * 70) * multiplier;
        // Estimate 200 remaining days of coverage proration
        const prorated = Math.round(monthly * 12 * (200 / 365) * 100) / 100;

        let hasError = false;
        const rowErrors: string[] = [];
        if (!email.includes('@')) {
          hasError = true;
          rowErrors.push('Invalid email format');
        }
        if (empAge < 16) {
          hasError = true;
          rowErrors.push('Underage employee');
        }

        if (hasError) errorsCount++;
        else totalCostEstimate += prorated;

        records.push({
          name,
          email,
          dob,
          dateOfJoining,
          eligibilityDate,
          coverageTier,
          dependents,
          proratedCost: prorated,
          errors: rowErrors
        });
      }

      setParsedRecords(records);
      setValidationSummary({
        total: records.length,
        errors: errorsCount,
        cost: Math.round(totalCostEstimate * 100) / 100
      });
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error parsing CSV structure. Ensure correct header formats.');
    }
  };

  const handleUploadSubmit = async () => {
    if (parsedRecords.length === 0) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/endorsements/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: parsedRecords.map(r => ({
            name: r.name,
            email: r.email,
            dob: r.dob,
            dateOfJoining: r.dateOfJoining,
            eligibilityDate: r.eligibilityDate,
            coverageTier: r.coverageTier,
            dependents: r.dependents,
            targetEffectiveDate: r.eligibilityDate
          })),
          slaType
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveBatch(data.batchJob);
        // Start polling loop while batch processes
        setCsvContent('');
        setParsedRecords([]);
        setValidationSummary(null);
      } else {
        setErrorMessage(data.error || 'Failed to submit batch.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // Fast-Forward SLA Handler
  const handleFastForward = async () => {
    if (!activeBatch) return;
    try {
      const res = await fetch(`/api/batches/${activeBatch.id}/fast-forward`, { method: 'POST' });
      if (res.ok) {
        onSuccess(); // Close and reload dashboard
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch running batch progress
  useEffect(() => {
    if (!activeBatch) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/policy');
        // Poll backend endorsements history or active list to check status updates
        const notifRes = await fetch('/api/notifications');
        if (notifRes.ok) {
          const list = await notifRes.json();
          // If we see completion alert, trigger success
          const hasFinished = list.some((n: any) => n.title === 'Batch Processing Complete' && n.message.includes(activeBatch.id));
          if (hasFinished) {
            clearInterval(interval);
            onSuccess();
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeBatch]);

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
        width: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        borderRadius: 'var(--border-radius-lg)',
        position: 'relative'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '22px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={20} color="var(--color-primary)" /> Insurer Batch API Uploader
          </h3>
          {!activeBatch && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          )}
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
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* BATCH RUNNING SIMULATOR OVERVIEW */}
        {activeBatch ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '4px solid var(--color-primary)',
              borderTopColor: 'transparent',
              margin: '0 auto 20px auto',
            }} className="loading-spinner" />

            <h4 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Batch {activeBatch.id} Processing...</h4>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5', maxWidth: '380px', margin: '0 auto 24px auto' }}>
              Insurer serial pipeline execution is running. Standard SLA guarantees confirmation in <strong>{activeBatch.slaDurationHours} Hours</strong>.
            </p>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '440px',
              margin: '0 auto 32px auto',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Processing Status:</span>
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Active Queue Lock</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Records Total:</span>
                <strong>{activeBatch.totalRecords} Records</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>SLA Level:</span>
                <strong>{activeBatch.slaType} ({activeBatch.slaDurationHours}h Limit)</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {/* SLA bypass action button */}
              <button onClick={handleFastForward} className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success-border)' }}>
                <Play size={14} /> Fast-Forward SLA (Immediate confirmation)
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD UPLOAD LAYOUT */
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <label className="form-label">Paste CSV Dataset Content</label>
              <button type="button" onClick={loadTemplate} style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}>
                Load Mock Template Data
              </button>
            </div>

            <textarea
              className="form-control"
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                height: '140px',
                resize: 'none',
                marginBottom: '16px'
              }}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Name,Email,DOB,DateOfJoining,EligibilityDate,CoverageTier,Dependents..."
            />

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button type="button" onClick={handleParse} className="btn btn-secondary" style={{ flexGrow: 1 }} disabled={!csvContent}>
                Parse & Dry-Run Validate
              </button>
            </div>

            {/* Validation Grid */}
            {parsedRecords.length > 0 && validationSummary && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1.5fr',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Parsed Records</span>
                    <strong style={{ fontSize: '16px', color: '#fff' }}>{validationSummary.total} Rows</strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Failed Checks</span>
                    <strong style={{ fontSize: '16px', color: validationSummary.errors > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {validationSummary.errors} Warnings
                    </strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Est. Cost (Debit)</span>
                    <strong style={{ fontSize: '16px', color: 'var(--color-primary)' }}>${validationSummary.cost.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '160px', border: '1px solid var(--color-border)' }}>
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Email</th>
                        <th>Coverage</th>
                        <th>Checks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRecords.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: '12px', color: '#fff' }}>{r.name}</td>
                          <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{r.email}</td>
                          <td style={{ fontSize: '11px' }}>{r.coverageTier}</td>
                          <td>
                            {r.errors.length > 0 ? (
                              <span style={{ color: 'var(--color-error)', fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <AlertTriangle size={12} /> {r.errors[0]}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-success)', fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <CheckCircle2 size={12} /> Passed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">Insurer SLA Guarantee Option</label>
                  <select
                    className="form-control"
                    value={slaType}
                    onChange={(e) => setSlaType(e.target.value as 'NORMAL' | 'EXPRESS')}
                  >
                    <option value="NORMAL">Standard Batch Pipeline SLA (24 Hours confirmation, Normal SLA)</option>
                    <option value="EXPRESS">Express Priority Queue (4 Hours confirmation, Additional charges apply)</option>
                  </select>
                </div>

                {validationSummary.cost > eaBalance && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-warning-bg)',
                    border: '1px solid var(--color-warning-border)',
                    color: 'var(--color-warning)',
                    fontSize: '12px',
                    marginTop: '16px'
                  }}>
                    <strong>Fund Account Warning</strong>: Your current EA Balance (${eaBalance.toLocaleString()}) is insufficient to fund this entire batch (${validationSummary.cost.toLocaleString()}). Standard addition operations will pause on records when available balance becomes zero.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={loading || parsedRecords.length === 0}
                className="btn btn-primary"
                style={{ width: '220px' }}
              >
                {loading ? 'Queueing Batch...' : 'Submit Batch Execution'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BulkUpload;

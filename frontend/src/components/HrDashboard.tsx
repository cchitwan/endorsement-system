import React, { useState, useEffect } from 'react';
import { Plus, Upload, CreditCard, Users, Clock, Compass, Activity, Calendar, ArrowRightLeft } from 'lucide-react';
import { PolicySummary } from '../App';
import EndorsementWizard from './EndorsementWizard';
import BulkUpload from './BulkUpload';

interface HrDashboardProps {
  policy: PolicySummary | null;
  triggerRefresh: () => void;
}

interface LedgerTx {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  endorsementId?: string;
  balanceAfter: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  dob: string;
  dateOfJoining: string;
  eligibilityDate: string;
  coverageTier: string;
  monthlyPremium: number;
  status: string;
  dependents: any[];
}

interface ForecastDetails {
  currentBalance: number;
  forecastedAdditions30Days: number;
  forecastedTerminations30Days: number;
  predictedNetPremiumImpact: number;
  recommendedBuffer: number;
  minimumRequiredBalance: number;
  historicalHiresTrend: number[];
  historicalTermsTrend: number[];
}

const HrDashboard: React.FC<HrDashboardProps> = ({ policy, triggerRefresh }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<LedgerTx[]>([]);
  const [forecast, setForecast] = useState<ForecastDetails | null>(null);

  // Modal controls
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState<'ADD' | 'TERMINATE' | 'UPDATE'>('ADD');
  const [selectedMember, setSelectedMember] = useState<Member | undefined>(undefined);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  // Form states for quick Top Up
  const [topUpAmount, setTopUpAmount] = useState('2000');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

  // Fetch local roster, ledger, optimization projections
  const loadDashboardData = async () => {
    try {
      const rosterRes = await fetch('/api/members');
      if (rosterRes.ok) {
        const data = await rosterRes.json();
        setMembers(data);
      }

      const ledgerRes = await fetch('/api/ledger');
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data.ledger.reverse()); // Show newest transactions first
      }

      const optimizeRes = await fetch('/api/ledger/optimize');
      if (optimizeRes.ok) {
        const data = await optimizeRes.json();
        setForecast(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [policy]);

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(topUpAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setSubmittingTopUp(true);
    try {
      const res = await fetch('/api/ledger/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum })
      });
      if (res.ok) {
        setTopUpAmount('2000');
        setShowTopUp(false);
        triggerRefresh();
        loadDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingTopUp(false);
    }
  };

  // Helper to open Wizard in UPDATE mode
  const triggerUpdate = (member: Member) => {
    setWizardType('UPDATE');
    setSelectedMember(member);
    setShowWizard(true);
  };

  // Helper to open Wizard in TERMINATE mode
  const triggerTerminate = (member: Member) => {
    setWizardType('TERMINATE');
    setSelectedMember(member);
    setShowWizard(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Upper Dashboard Action Ribbon & Metrics */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#fff', fontFamily: 'var(--font-family-header)', fontWeight: 800 }}>
            Employer HR Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Manage group insurance rosters, calculate prorated premiums, and monitor your Endorsement Account balance.
          </p>
        </div>

        {/* Global Action Triggers */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => { setWizardType('ADD'); setSelectedMember(undefined); setShowWizard(true); }} className="btn btn-primary">
            <Plus size={16} /> Add Employee
          </button>
          <button onClick={() => setShowBulkUpload(true)} className="btn btn-secondary">
            <Upload size={16} /> Upload Batch (Batch API)
          </button>
          <button onClick={() => setShowTopUp(true)} className="btn btn-outline-primary">
            <CreditCard size={16} /> Top-Up Account
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Covered Members
            </span>
            <h2 style={{ fontSize: '28px', color: '#fff', marginTop: '4px', fontFamily: 'var(--font-family-header)' }}>
              {policy ? policy.totalActiveMembers : 0}
            </h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-secondary)'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Monthly Premium
            </span>
            <h2 style={{ fontSize: '28px', color: '#fff', marginTop: '4px', fontFamily: 'var(--font-family-header)' }}>
              ${policy ? policy.totalMonthlyPremium.toLocaleString() : '0.00'}
            </h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-accent)'
          }}>
            <Compass size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Optimized Min Balance
            </span>
            <h2 style={{ fontSize: '28px', color: 'var(--color-accent)', marginTop: '4px', fontFamily: 'var(--font-family-header)' }}>
              ${policy ? policy.optimizedMinimumBalance.toLocaleString() : '0.00'}
            </h2>
          </div>
        </div>
      </div>

      {/* Main Roster & AI Optimizer Section */}
      <div className="dashboard-split">
        {/* Roster Listing */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff' }}>Active Employee Directory</h3>
            <span className="badge badge-active">{members.filter(m => m.status === 'ACTIVE').length} Active</span>
          </div>

          <div className="table-wrapper">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Employee / Email</th>
                  <th>Tier</th>
                  <th>Monthly Premium</th>
                  <th>Eligibility Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.filter(m => m.status === 'ACTIVE').map(m => (
                  <tr key={m.id}>
                    <td>
                      <div>
                        <strong style={{ color: '#fff' }}>{m.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{m.email}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px'
                      }}>
                        {m.coverageTier.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--color-primary)' }}>${m.monthlyPremium.toLocaleString()}</strong>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} />
                        {m.eligibilityDate}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => triggerUpdate(m)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                          Modify
                        </button>
                        <button onClick={() => triggerTerminate(m)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }}>
                          Terminate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Balance Optimization Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            {/* Glowing neon top stripe */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))'
            }} />
            
            <h3 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={18} color="var(--color-accent)" /> AI Capital Optimizer
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
              Optimizes cash utilization by projecting staffing additions, terminations, and premium impacts for the next 30 days.
            </p>

            {forecast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border)' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hiring Forecast</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>+{forecast.forecastedAdditions30Days} Hires</span>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border)' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Turnover Forecast</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>-{forecast.forecastedTerminations30Days} terms</span>
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid var(--color-accent-glow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Recommended EA Min Balance:</span>
                    <strong style={{ fontSize: '16px', color: 'var(--color-accent)' }}>
                      ${forecast.minimumRequiredBalance.toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Current Wallet Balance:</span>
                    <strong style={{ fontSize: '16px', color: policy && policy.eaBalance < forecast.minimumRequiredBalance ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      ${policy ? policy.eaBalance.toLocaleString() : '0'}
                    </strong>
                  </div>
                </div>

                {/* Simulated SVG Chart Line for hires/terms trends */}
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    EA Projections Trend (Dec 31 Horizon)
                  </span>
                  
                  {/* Inline React SVG graph */}
                  <svg width="100%" height="80" viewBox="0 0 300 80" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="gradient-line" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Gridlines */}
                    <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    
                    {/* Shadow Area below line */}
                    <path d="M0,80 L0,50 L50,55 L100,30 L150,45 L200,15 L250,25 L300,10 L300,80 Z" fill="url(#gradient-line)" />
                    
                    {/* Graph Line */}
                    <path d="M0,50 L50,55 L100,30 L150,45 L200,15 L250,25 L300,10" fill="none" stroke="var(--color-primary)" strokeWidth="3" />
                    
                    {/* Dots */}
                    <circle cx="100" cy="30" r="4" fill="var(--color-accent)" />
                    <circle cx="200" cy="15" r="4" fill="var(--color-secondary)" />
                    <circle cx="300" cy="10" r="4" fill="var(--color-primary)" />
                  </svg>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    <span>Jul</span>
                    <span>Aug</span>
                    <span>Sep</span>
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                  </div>
                </div>

                {policy && policy.eaBalance < forecast.minimumRequiredBalance && (
                  <button onClick={() => setShowTopUp(true)} className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                    Top-Up to Recommended Level
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRightLeft size={16} /> Endorsement Account Transaction History
        </h3>

        <div className="table-wrapper">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Tx Code</th>
                <th>Execution Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Memo / Description</th>
                <th>Final Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>
                    No ledger transactions logged.
                  </td>
                </tr>
              ) : (
                ledger.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: 'var(--font-family-header)', fontWeight: 600 }}>{tx.id}</td>
                    <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${
                        tx.type === 'DEPOSIT' ? 'badge-active' :
                        tx.type === 'ENDORSEMENT_CREDIT' ? 'badge-active' : 'badge-failed'
                      }`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <strong style={{
                        color: tx.type === 'DEPOSIT' || tx.type === 'ENDORSEMENT_CREDIT' 
                          ? 'var(--color-success)' 
                          : 'var(--color-error)'
                      }}>
                        {tx.type === 'DEPOSIT' || tx.type === 'ENDORSEMENT_CREDIT' ? '+' : '-'}
                        ${tx.amount.toLocaleString()}
                      </strong>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description}
                      {tx.endorsementId && (
                        <span style={{ display: 'block', fontSize: '9px', color: 'var(--color-primary)', marginTop: '2px' }}>
                          Ref: {tx.endorsementId}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>${tx.balanceAfter.toLocaleString()}</strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY MODAL: Endorsement Wizard */}
      {showWizard && (
        <EndorsementWizard
          type={wizardType}
          member={selectedMember}
          eaBalance={policy ? policy.eaBalance : 0}
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            triggerRefresh();
            loadDashboardData();
          }}
        />
      )}

      {/* OVERLAY MODAL: Bulk Upload Simulator */}
      {showBulkUpload && (
        <BulkUpload
          eaBalance={policy ? policy.eaBalance : 0}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            setShowBulkUpload(false);
            triggerRefresh();
            loadDashboardData();
          }}
        />
      )}

      {/* OVERLAY MODAL: Top Up Modal */}
      {showTopUp && (
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
          <div className="glass-panel" style={{ width: '420px', padding: '32px' }}>
            <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} color="var(--color-primary)" /> Fund Endorsement Account
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
              Submit a deposit check simulator to immediately load capital into the insurer endorsement wallet.
            </p>

            <form onSubmit={handleTopUpSubmit}>
              <div className="form-group">
                <label className="form-label">Deposit Capital Amount ($ USD)</label>
                <input
                  type="number"
                  className="form-control"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="2000"
                  required
                  min="1"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowTopUp(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingTopUp} className="btn btn-primary">
                  {submittingTopUp ? 'Depositing...' : 'Authorize Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;

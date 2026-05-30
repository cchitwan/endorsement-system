import React, { useState } from 'react';
import { Bell, ShieldAlert, Layers, User, Settings, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PolicySummary, NotificationLog } from '../App';

interface HeaderProps {
  activeTab: 'hr' | 'underwriter' | 'architecture';
  setActiveTab: (tab: 'hr' | 'underwriter' | 'architecture') => void;
  persona: 'EMPLOYER_HR' | 'INSURER_UNDERWRITER';
  setPersona: (p: 'EMPLOYER_HR' | 'INSURER_UNDERWRITER') => void;
  policy: PolicySummary | null;
  notifications: NotificationLog[];
  unreadCount: number;
  triggerRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  persona,
  setPersona,
  policy,
  notifications,
  unreadCount,
  triggerRefresh
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const handleMarkAsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const isBalanceLow = policy ? policy.eaBalance < policy.optimizedMinimumBalance : false;

  return (
    <header className="glass-panel" style={{
      margin: '16px 24px 0 24px',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      borderRadius: 'var(--border-radius-lg)',
      zIndex: 100
    }}>
      {/* Brand & Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px',
            color: '#fff',
            boxShadow: 'var(--box-shadow-neon)'
          }}>
            E
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-family-header)' }}>Aegis Shield</h2>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Group Insurance</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setActiveTab('hr'); setPersona('EMPLOYER_HR'); }}
            className={`btn ${activeTab === 'hr' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Employer Portal
          </button>
          <button
            onClick={() => { setActiveTab('underwriter'); setPersona('INSURER_UNDERWRITER'); }}
            className={`btn ${activeTab === 'underwriter' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Insurer Dashboard
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`btn ${activeTab === 'architecture' ? 'btn-outline-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <Layers size={14} /> System Scale
          </button>
        </nav>
      </div>

      {/* Metrics & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        
        {/* Endorsement Account (EA) Balance Widget */}
        {policy && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(10, 13, 20, 0.4)',
            border: `1px solid ${isBalanceLow ? 'var(--color-warning-border)' : 'var(--color-success-border)'}`,
            boxShadow: isBalanceLow ? 'none' : '0 0 10px rgba(16, 185, 129, 0.05)',
            transition: 'all 0.3s'
          }}>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Endorsement Account (EA)
              </span>
              <span style={{
                fontSize: '16px',
                fontWeight: 700,
                color: isBalanceLow ? 'var(--color-warning)' : 'var(--color-success)',
                fontFamily: 'var(--font-family-header)'
              }}>
                ${policy.eaBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {isBalanceLow && (
              <div title="Balance is below optimized recommendation! Please top up." style={{
                color: 'var(--color-warning)',
                animation: 'pulse-glow 2s infinite'
              }}>
                <ShieldAlert size={18} />
              </div>
            )}
          </div>
        )}

        {/* Persona Switcher (Visual feedback for testing) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--color-border)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)'
        }}>
          <User size={12} />
          <span>Role: <strong style={{ color: '#fff', textTransform: 'uppercase', fontSize: '10px' }}>{persona.replace('_', ' ')}</strong></span>
        </div>

        {/* Alerts Bell Button */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          style={{
            background: 'none',
            border: 'none',
            color: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            position: 'relative',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s'
          }}
          className={unreadCount > 0 ? 'glow-animation' : ''}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 700,
              width: '15px',
              height: '15px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-bg-base)'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Drawer Overlay */}
      {showNotifications && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '24px',
          width: '380px',
          maxHeight: '480px',
          overflowY: 'auto',
          zIndex: 200,
          padding: '20px'
        }} className="glass-panel">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '12px'
          }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} /> Notification Log
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.length === 0 ? (
              <p style={{
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: '12px',
                padding: '20px 0'
              }}>
                No notifications logged.
              </p>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '12px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: n.read ? 'rgba(255, 255, 255, 0.01)' : 'rgba(99, 102, 241, 0.05)',
                  borderLeft: `3px solid ${
                    n.type === 'success' ? 'var(--color-success)' :
                    n.type === 'warning' ? 'var(--color-warning)' :
                    n.type === 'error' ? 'var(--color-error)' : 'var(--color-info)'
                  }`,
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{
                      color: n.type === 'success' ? 'var(--color-success)' :
                             n.type === 'warning' ? 'var(--color-warning)' :
                             n.type === 'error' ? 'var(--color-error)' : 'var(--color-info)'
                    }}>
                      {n.type === 'success' && <CheckCircle2 size={14} />}
                      {n.type === 'warning' && <AlertTriangle size={14} />}
                      {n.type === 'error' && <ShieldAlert size={14} />}
                      {n.type === 'info' && <Settings size={14} />}
                    </div>
                    <div>
                      <h5 style={{ fontSize: '13px', fontWeight: 600, color: n.read ? 'var(--color-text-primary)' : '#fff' }}>{n.title}</h5>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>{n.message}</p>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

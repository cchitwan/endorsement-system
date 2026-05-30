import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HrDashboard from './components/HrDashboard';
import UnderwriterDashboard from './components/UnderwriterDashboard';
import ArchitectureView from './components/ArchitectureView';

export interface PolicySummary {
  policyId: string;
  employerName: string;
  totalActiveMembers: number;
  totalMonthlyPremium: number;
  policyStartDate: string;
  policyEndDate: string;
  eaBalance: number;
  optimizedMinimumBalance: number;
  version: number;
}

export interface NotificationLog {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

const App: React.FC = () => {
  // Navigation Routes: 'hr' | 'underwriter' | 'architecture'
  const [activeTab, setActiveTab] = useState<'hr' | 'underwriter' | 'architecture'>('hr');
  
  // Simulation Persona: 'EMPLOYER_HR' | 'INSURER_UNDERWRITER'
  const [persona, setPersona] = useState<'EMPLOYER_HR' | 'INSURER_UNDERWRITER'>('EMPLOYER_HR');
  
  // Real-time Policy Stats
  const [policy, setPolicy] = useState<PolicySummary | null>(null);
  
  // Alert logs
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch Policy and Alerts
  const fetchGlobalData = async () => {
    try {
      const policyRes = await fetch('/api/policy');
      if (policyRes.ok) {
        const data = await policyRes.json();
        setPolicy(data);
      }

      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: NotificationLog) => !n.read).length);
      }
    } catch (err) {
      console.error('Error fetching global policy data:', err);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    // Poll notifications and balance details every 4 seconds to simulate active background workers
    const pollInterval = setInterval(fetchGlobalData, 4000);
    return () => clearInterval(pollInterval);
  }, []);

  // Helper to force-refresh state after actions
  const triggerRefresh = () => {
    fetchGlobalData();
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        persona={persona}
        setPersona={setPersona}
        policy={policy}
        notifications={notifications}
        unreadCount={unreadCount}
        triggerRefresh={triggerRefresh}
      />

      <main className="main-content" style={{ marginTop: '24px' }}>
        {activeTab === 'hr' && (
          <HrDashboard 
            policy={policy} 
            triggerRefresh={triggerRefresh} 
          />
        )}
        {activeTab === 'underwriter' && (
          <UnderwriterDashboard 
            policy={policy} 
            triggerRefresh={triggerRefresh} 
          />
        )}
        {activeTab === 'architecture' && (
          <ArchitectureView />
        )}
      </main>
    </div>
  );
};

export default App;

import React from 'react';
import { Layers, Network, Database, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';

const ArchitectureView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* View Header */}
      <div>
        <h1 style={{ fontSize: '28px', color: '#fff', fontFamily: 'var(--font-family-header)', fontWeight: 800 }}>
          System Architecture & Scalability Blueprint
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Production design specs for handling high throughput: 100K employers, 10 insurers, and 1M change events per day.
        </p>
      </div>

      {/* Pipeline Grid Visual */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={20} color="var(--color-primary)" /> Distributed Event-Driven Execution Flow
        </h3>

        {/* Visual blocks */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          position: 'relative',
          padding: '10px 0'
        }}>
          
          <div style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--color-border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Step 1: Ingestion</span>
            <h4 style={{ fontSize: '14px', color: '#fff', marginTop: '8px', marginBottom: '4px' }}>API Gateway</h4>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              Validates schema, inspects Idempotency Keys in Redis, rates traffic.
            </p>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--color-border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--color-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Step 2: Stream</span>
            <h4 style={{ fontSize: '14px', color: '#fff', marginTop: '8px', marginBottom: '4px' }}>Kafka Message Bus</h4>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              Decouples requests. Partitioned by <code style={{ color: 'var(--color-secondary)' }}>EmployerID</code> to guarantee write sequence.
            </p>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--color-border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase' }}>Step 3: Engine</span>
            <h4 style={{ fontSize: '14px', color: '#fff', marginTop: '8px', marginBottom: '4px' }}>Validation & Rules</h4>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              Prorates calculations, scans AI anomalies, executes auto-reconciles.
            </p>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--color-border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700, textTransform: 'uppercase' }}>Step 4: Storage</span>
            <h4 style={{ fontSize: '14px', color: '#fff', marginTop: '8px', marginBottom: '4px' }}>Partitioned DB</h4>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              Commits changes transactionally. Updates ledger logs and active rosters.
            </p>
          </div>

        </div>
      </div>

      {/* Scaling Pillars */}
      <div className="dashboard-split">
        
        {/* Horizontal scale */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="var(--color-accent)" /> Scaling to 100K Employers & 1M Events
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '13px', lineHeight: '1.6' }}>
            <div>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>1. Database Partitioning & Isolation</strong>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Because employers operate independently (a member add for ACME Corp has no relevance to Gotham Inc), the transactional database (Amazon DynamoDB or sharded PostgreSQL) is partitioned strictly by <code>EmployerID</code>. This avoids global locking contention, enabling linear throughput scaling.
              </p>
            </div>
            
            <div>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>2. Decoupled Processing with Kafka Streams</strong>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                API requests append directly to Kafka topics. This absorbs peak transaction spikes (e.g. bulk renewals on Jan 1st). Kafka consumers pull messages at optimal paces. Sequence guarantees are maintained per employer by hashing the partition key.
              </p>
            </div>

            <div>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>3. CQRS Pattern (Command Query Responsibility Segregation)</strong>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Writes bypass read locks by writing directly to logs. Active dashboard metrics (rosters, balance audits) read from read-optimized Redis cache layers, guaranteeing responsive UX under high request loads.
              </p>
            </div>
          </div>
        </div>

        {/* Concurrency and Idempotency scale */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--color-secondary)" /> Concurrency & Once-Only Controls
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: '1.6' }}>
            <div style={{
              padding: '16px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--color-border)'
            }}>
              <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <CheckCircle size={14} color="var(--color-success)" /> Idempotency Keys
              </strong>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Prevents double debits from client network timeouts. Handled in Redis with a status mapping: <code>IN_PROGRESS</code> &rarr; <code>COMPLETED</code>. Cached responses are returned instantly for repeat requests.
              </p>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--color-border)'
            }}>
              <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <CheckCircle size={14} color="var(--color-success)" /> Redis Distributed Locks
              </strong>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Enforces the "one-active-batch-at-a-time" insurer rule. Acquires temporary lease locks on <code>lock:policy:$id</code>, preventing race conditions on Endorsement Account balances during concurrent writes.
              </p>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--color-border)'
            }}>
              <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <CheckCircle size={14} color="var(--color-success)" /> Optimistic Concurrency
              </strong>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Database rows leverage version tracking (OCC). Row writes verify that the version matches the read state. If a collision is detected, the write is aborted and retried.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ArchitectureView;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/client';

function statusBadge(s: string) {
  const lc = (s || '').toLowerCase();
  if (lc === 'closed won' || lc === 'closed' || lc === 'resolved' || lc === 'converted') return 'badge-success';
  if (lc === 'closed lost' || lc === 'cancelled' || lc === 'escalated') return 'badge-danger';
  if (lc === 'new' || lc === 'open') return 'badge-purple';
  if (lc === 'working' || lc === 'in progress' || lc === 'proposal' || lc === 'negotiation') return 'badge-warning';
  if (lc === 'qualified' || lc === 'prospecting') return 'badge-info';
  return 'badge-muted';
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3>Failed to load dashboard</h3>
      </div>
    );
  }

  const leads = data.leads || [];
  const opportunities = data.opportunities || [];
  const cases = data.cases || [];

  // Summary counts
  const openLeads = leads.filter((l: any) => !['Converted', 'Unqualified', 'Dead'].includes(l.Status)).length;
  const convertedLeads = leads.filter((l: any) => l.Status === 'Converted').length;
  const openOpps = opportunities.filter((o: any) => !['Closed Won', 'Closed Lost'].includes(o.StageName)).length;
  const wonOpps = opportunities.filter((o: any) => o.StageName === 'Closed Won').length;
  const openCases = cases.filter((c: any) => !['Closed', 'Resolved'].includes(c.Status)).length;
  const resolvedCases = cases.filter((c: any) => ['Closed', 'Resolved'].includes(c.Status)).length;

  const summaryCards = [
    {
      icon: '🎯',
      label: 'Total Leads',
      value: leads.length,
      sub: `${openLeads} open · ${convertedLeads} converted`,
      type: 'accent',
      link: '/sales',
    },
    {
      icon: '💼',
      label: 'Opportunities',
      value: opportunities.length,
      sub: `${openOpps} active · ${wonOpps} won`,
      type: 'success',
      link: '/sales',
    },
    {
      icon: '🎧',
      label: 'Support Cases',
      value: cases.length,
      sub: `${openCases} open · ${resolvedCases} resolved`,
      type: openCases > 0 ? 'warning' : 'success',
      link: '/cases',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📊 Dealer Dashboard</h1>
          <p className="page-desc">Overview of your leads, deals, and support cases synced from Salesforce</p>
        </div>
        {data.account && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              className={`badge ${data.account?.Tier__c === 'Gold' ? 'badge-warning' : data.account?.Tier__c === 'Silver' ? 'badge-muted' : 'badge-info'}`}
              style={{ fontSize: '13px', padding: '6px 16px' }}
            >
              ⭐ {data.account?.Tier__c || 'Standard'} Tier
            </span>
            <span className={`badge ${data.account?.Status__c === 'Active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '6px 16px' }}>
              {data.account?.Status__c || 'Active'}
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '28px' }}>
        {summaryCards.map((c, i) => (
          <Link key={i} to={c.link} style={{ textDecoration: 'none' }}>
            <div className={`metric-card ${c.type}`} style={{ cursor: 'pointer', transition: 'transform 0.15s', borderRadius: '14px' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div className={`metric-icon ${c.type}`}>{c.icon}</div>
              <div className="metric-value" style={{ fontSize: '30px', marginTop: '6px' }}>{c.value}</div>
              <div className="metric-label" style={{ marginTop: '4px', fontSize: '13px', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '4px' }}>{c.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }} className="grid-responsive">
        {/* Recent Leads */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🎯 Recent Leads</span>
            <Link to="/sales" style={{ fontSize: '11px', color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>View All →</Link>
          </div>
          <div style={{ flex: 1 }}>
            {leads.slice(0, 5).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No leads yet</div>
            ) : (
              leads.slice(0, 5).map((l: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{l.contactName || l.FirstName + ' ' + l.LastName || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.company || l.Company || '—'}</div>
                  </div>
                  <span className={statusBadge(l.Status)}>{l.Status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Opportunities */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💼 Recent Opportunities</span>
            <Link to="/sales" style={{ fontSize: '11px', color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>View All →</Link>
          </div>
          <div style={{ flex: 1 }}>
            {opportunities.slice(0, 5).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No opportunities yet</div>
            ) : (
              opportunities.slice(0, 5).map((o: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{o.Name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {o.Amount ? `₹${Number(o.Amount).toLocaleString('en-IN')}` : '—'}
                    </div>
                  </div>
                  <span className={statusBadge(o.StageName)}>{o.StageName}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Cases */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🎧 Recent Cases</span>
            <Link to="/cases" style={{ fontSize: '11px', color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>View All →</Link>
          </div>
          <div style={{ flex: 1 }}>
            {cases.slice(0, 5).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No cases yet</div>
            ) : (
              cases.slice(0, 5).map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{c.CaseNumber}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(c.Subject || '').slice(0, 40)}{(c.Subject || '').length > 40 ? '…' : ''}</div>
                  </div>
                  <span className={statusBadge(c.Status)}>{c.Status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

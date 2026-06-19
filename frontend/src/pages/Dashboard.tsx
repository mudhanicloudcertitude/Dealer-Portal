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
        <h3>Failed to load dashboard</h3>
      </div>
    );
  }

  const leads = data.leads || [];
  const opportunities = data.opportunities || [];
  const cases = data.cases || [];

  const convertedStatuses = ['Converted', 'Closed - Converted'];
  const closedLeadStatuses = ['Converted', 'Closed - Converted', 'Unqualified', 'Closed - Not Converted', 'Disqualified', 'Dead'];
  const openLeads = leads.filter((l: any) => !closedLeadStatuses.includes(l.Status)).length;
  const convertedLeads = leads.filter((l: any) => convertedStatuses.includes(l.Status)).length;
  const openOpps = opportunities.filter((o: any) => !['Closed Won', 'Closed Lost'].includes(o.StageName)).length;
  const wonOpps = opportunities.filter((o: any) => o.StageName === 'Closed Won').length;
  const openCases = cases.filter((c: any) => !['Closed', 'Resolved'].includes(c.Status)).length;
  const resolvedCases = cases.filter((c: any) => ['Closed', 'Resolved'].includes(c.Status)).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">Synced from Salesforce</p>
        </div>
        {data.account && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className={`badge ${data.account?.Tier__c === 'Gold' ? 'badge-warning' : data.account?.Tier__c === 'Silver' ? 'badge-muted' : 'badge-info'}`}>
              {data.account?.Tier__c || 'Standard'}
            </span>
            <span className={`badge ${data.account?.Status__c === 'Active' ? 'badge-success' : 'badge-danger'}`}>
              {data.account?.Status__c || 'Active'}
            </span>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }} className="grid-responsive">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Leads</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{leads.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{openLeads} open, {convertedLeads} converted</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Opportunities</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{opportunities.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{openOpps} active, {wonOpps} won</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Support Cases</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{cases.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{openCases} open, {resolvedCases} resolved</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Win Rate</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            {opportunities.length > 0 ? Math.round((wonOpps / opportunities.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{wonOpps} of {opportunities.length} deals</div>
        </div>
      </div>

      {/* Two-column layout: main content + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }} className="grid-responsive">
        {/* Left: Recent Leads table */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>Recent Leads</span>
              <Link to="/sales" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>View all</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 6).map((l: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{l.contactName || l.FirstName + ' ' + l.LastName || 'Unknown'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{l.company || l.Company || '—'}</td>
                      <td><span className={statusBadge(l.Status)}>{l.Status}</span></td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No leads</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Opportunities table below leads */}
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-title">
              <span>Recent Opportunities</span>
              <Link to="/sales" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>View all</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.slice(0, 5).map((o: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{o.Name}</td>
                      <td>{o.Amount ? `₹${Number(o.Amount).toLocaleString('en-IN')}` : '—'}</td>
                      <td><span className={statusBadge(o.StageName)}>{o.StageName}</span></td>
                    </tr>
                  ))}
                  {opportunities.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No opportunities</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar: Cases list */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-title">
            <span>Open Cases</span>
            <Link to="/cases" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>View all</Link>
          </div>
          {cases.slice(0, 8).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No cases</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {cases.slice(0, 8).map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < Math.min(cases.length, 8) - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.CaseNumber}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{(c.Subject || '').slice(0, 35)}</div>
                  </div>
                  <span className={statusBadge(c.Status)} style={{ flexShrink: 0 }}>{c.Status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

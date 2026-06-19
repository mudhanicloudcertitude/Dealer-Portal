import { useState, useEffect, useCallback } from 'react';
import API from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  _id: string;
  sfId?: string;
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  status: string;
  notes?: string;
  createdAt: string;
}

interface Deal {
  _id: string;
  sfId?: string;
  Name?: string;
  title?: string;
  StageName?: string;
  stage?: string;
  Amount?: number;
  expectedValue?: number;
  CloseDate?: string;
  expectedCloseDate?: string;
  contactName?: string;
  companyName?: string;
  productName?: string;
  quantity?: number;
  probability?: number;
  notes?: string;
  wonAt?: string;
  lostReason?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return `₹${(n || 0).toLocaleString('en-IN')}`; }
function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function leadStatusBadge(status: string) {
  const m: Record<string, string> = {
    'New': 'badge-info',
    'Open - Not Contacted': 'badge-info',
    'Contacted': 'badge-warning',
    'Working - Contacted': 'badge-warning',
    'Qualified': 'badge-success',
    'Closed - Converted': 'badge-success',
    'Disqualified': 'badge-muted',
    'Closed - Not Converted': 'badge-muted',
    'Unqualified': 'badge-muted',
    'Dead': 'badge-muted',
  };
  return <span className={`badge ${m[status] || 'badge-muted'}`}>{status}</span>;
}

function dealStageBadge(stage: string) {
  const m: Record<string, string> = {
    'Prospecting': 'badge-muted',
    'Qualification': 'badge-info',
    'Needs Analysis': 'badge-info',
    'Value Proposition': 'badge-info',
    'Proposal/Price Quote': 'badge-info',
    'Id. Decision Makers': 'badge-warning',
    'Perception Analysis': 'badge-warning',
    'Negotiation/Review': 'badge-warning',
    'Closed Won': 'badge-success',
    'Closed Lost': 'badge-danger',
  };
  return <span className={`badge ${m[stage] || 'badge-muted'}`}>{stage}</span>;
}

type ToastType = 'error' | 'success' | 'info' | 'warning';
interface ToastItem { id: number; type: ToastType; title: string; msg: string; }
export let showToast: (type: ToastType, title: string, msg: string) => void = () => {};

function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onRemove(t.id)} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', minWidth: 280, maxWidth: 360 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Create Lead Modal ────────────────────────────────────────────────────────
function CreateLeadModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    email: '',
    companyName: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.contactName || !form.phone || !form.companyName) {
      setError('Customer name, phone, and company name are required.'); return;
    }
    setSaving(true); setError('');
    try {
      await API.post('/leads', { ...form, source: 'Dealer Portal' });
      showToast('success', 'Lead Submitted', `Lead for "${form.contactName}" created in Salesforce.`);
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create lead.');
    } finally { setSaving(false); }
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Submit New Lead</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Lead will be created in Salesforce with Source: <strong>Dealer Portal</strong>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Customer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="e.g. Ravi Kumar" value={form.contactName} onChange={e => f('contactName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Company / Business <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="e.g. Sunrise Electronics" value={form.companyName} onChange={e => f('companyName', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Phone <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => f('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="customer@email.com" value={form.email} onChange={e => f('email', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Requirements</label>
            <textarea className="form-input" rows={3} placeholder="Any initial details about the customer's interest or requirements..." value={form.notes} onChange={e => f('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Submitting to Salesforce...' : 'Submit Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Panel (read-only, status tracking only) ──────────────────────
function LeadDetailPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const pipelineSteps = ['Submitted', 'Contacted', 'Qualified', 'Resolved'];
  const statusToStep: Record<string, number> = {
    'New': 0, 'Open - Not Contacted': 0,
    'Contacted': 1, 'Working - Contacted': 1,
    'Qualified': 2, 'Closed - Converted': 3,
    'Disqualified': 3, 'Closed - Not Converted': 3,
    'Unqualified': 3, 'Dead': 3,
  };
  const currentStep = statusToStep[lead.status] ?? 0;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 140 }} onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-panel-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{lead.contactName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lead.companyName || '—'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="detail-panel-body">

          {/* Status tracker */}
          <div className="detail-panel-section">
            <div className="detail-panel-section-title">Lead Status</div>
            <div style={{ marginBottom: 14 }}>
              {leadStatusBadge(lead.status)}
            </div>

            {/* Progress Steps */}
            <div className="stage-progress">
              {pipelineSteps.map((s, i) => (
                <div key={s} className={`stage-step ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                  <div className="stage-step-dot">{i < currentStep ? '✓' : i + 1}</div>
                  <div className="stage-step-label">{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div className="detail-panel-section">
            <div className="detail-panel-section-title">Customer Details</div>
            <div className="detail-field">
              <div className="detail-field-label">Name</div>
              <div className="detail-field-value">{lead.contactName}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Phone</div>
              <div className="detail-field-value">
                <span>{lead.phone}</span>
              </div>
            </div>
            {lead.email && (
              <div className="detail-field">
                <div className="detail-field-label">Email</div>
                <div className="detail-field-value">
                  <span>{lead.email}</span>
                </div>
              </div>
            )}
            {lead.companyName && (
              <div className="detail-field">
                <div className="detail-field-label">Company</div>
                <div className="detail-field-value">{lead.companyName}</div>
              </div>
            )}
            {lead.notes && (
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lead.notes}</div>
              </div>
            )}
            <div className="detail-field">
              <div className="detail-field-label">Submitted</div>
              <div className="detail-field-value">
                <span>{fmtDate(lead.createdAt)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Deal Detail Panel (read-only) ────────────────────────────────────────────
function DealDetailPanel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const name = deal.Name || deal.title || 'Unnamed Deal';
  const stage = deal.StageName || deal.stage || 'Prospecting';
  const amount = deal.Amount || deal.expectedValue || 0;
  const closeDate = deal.CloseDate || deal.expectedCloseDate;
  const isClosed = stage === 'Closed Won' || stage === 'Closed Lost';

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 140 }} onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-panel-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{deal.companyName || '—'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="detail-panel-body">

          {/* Stage badge */}
          <div style={{ marginBottom: 20 }}>
            {dealStageBadge(stage)}
            {isClosed && stage === 'Closed Won' && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                Deal Won
              </div>
            )}
            {isClosed && stage === 'Closed Lost' && (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                Deal Lost
              </div>
            )}
          </div>

          {/* Value Summary */}
          {amount > 0 && (
            <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deal Value</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-light)' }}>{fmt(amount)}</div>
              {deal.productName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Product: {deal.productName} {deal.quantity ? `× ${deal.quantity}` : ''}
                </div>
              )}
              {deal.probability !== undefined && deal.probability > 0 && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${deal.probability}%`, height: '100%', background: deal.probability >= 70 ? 'var(--success)' : deal.probability >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36 }}>{deal.probability}%</span>
                </div>
              )}
            </div>
          )}

          {/* Deal Details */}
          <div className="detail-panel-section">
            <div className="detail-panel-section-title">Deal Details</div>
            {deal.contactName && (
              <div className="detail-field">
                <div className="detail-field-label">Contact</div>
                <div className="detail-field-value">{deal.contactName}</div>
              </div>
            )}
            {closeDate && (
              <div className="detail-field">
                <div className="detail-field-label">Expected Close</div>
                <div className="detail-field-value">
                  <span>{fmtDate(closeDate)}</span>
                </div>
              </div>
            )}
            {deal.wonAt && (
              <div className="detail-field">
                <div className="detail-field-label">Won On</div>
                <div className="detail-field-value" style={{ color: 'var(--success)' }}>
                  <span>{fmtDate(deal.wonAt)}</span>
                </div>
              </div>
            )}
            {deal.lostReason && (
              <div className="detail-field">
                <div className="detail-field-label">Lost Reason</div>
                <div className="detail-field-value" style={{ color: 'var(--danger)' }}>{deal.lostReason}</div>
              </div>
            )}
            {deal.notes && (
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{deal.notes}</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Main Sales Page ──────────────────────────────────────────────────────────
export default function Sales() {
  const [activeTab, setActiveTab] = useState<'leads' | 'deals'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [search, setSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('All');
  const [dealStageFilter, setDealStageFilter] = useState('All');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    showToast = (type, title, msg) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, type, title, msg }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };
  }, []);

  const fetchLeads = useCallback(async () => {
    const r = await API.get('/leads');
    setLeads(r.data);
  }, []);

  const fetchDeals = useCallback(async () => {
    const r = await API.get('/opportunities');
    setDeals(r.data);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([fetchLeads(), fetchDeals()]); }
    finally { setLoading(false); }
  }, [fetchLeads, fetchDeals]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filtered lists
  const filteredLeads = leads.filter(l => {
    const matchSearch = l.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      l.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search);
    const matchStatus = leadStatusFilter === 'All' || l.status === leadStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredDeals = deals.filter(d => {
    const name = d.Name || d.title || '';
    const company = d.companyName || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || company.toLowerCase().includes(search.toLowerCase());
    const stage = d.StageName || d.stage || '';
    const matchStage = dealStageFilter === 'All' || stage === dealStageFilter;
    return matchSearch && matchStage;
  });

  // Unique stages from loaded deals
  const uniqueStages = [...new Set(deals.map(d => d.StageName || d.stage || '').filter(Boolean))];

  // Metrics
  const openLeads = leads.filter(l => !['Closed - Converted', 'Closed - Not Converted', 'Disqualified', 'Unqualified', 'Dead'].includes(l.status)).length;
  const openDeals = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.StageName || d.stage || '')).length;
  const wonDeals = deals.filter(d => (d.StageName || d.stage) === 'Closed Won').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sales Pipeline</h1>
          <div className="page-desc">Submit leads to Salesforce and track your deals</div>
        </div>
        {activeTab === 'leads' && (
          <button className="btn btn-primary" onClick={() => setShowCreateLead(true)}>
            Submit New Lead
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="metric-card accent" style={{ padding: '24px' }}>
          <div className="metric-value">{leads.length}</div>
          <div className="metric-label">Total Leads Submitted</div>
          <div className="metric-change">{openLeads} currently active</div>
        </div>
        <div className="metric-card info" style={{ padding: '24px' }}>
          <div className="metric-value">{openDeals}</div>
          <div className="metric-label">Active Deals</div>
          <div className="metric-change">{wonDeals} closed won</div>
        </div>
        <div className="metric-card success" style={{ padding: '24px' }}>
          <div className="metric-value">{fmt(deals.filter(d => (d.StageName || d.stage) === 'Closed Won').reduce((s, d) => s + (d.Amount || d.expectedValue || 0), 0))}</div>
          <div className="metric-label">Total Won Value</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${activeTab === 'leads' ? 'active' : ''}`} onClick={() => { setActiveTab('leads'); setSearch(''); }}>
          Leads ({leads.length})
        </div>
        <div className={`tab ${activeTab === 'deals' ? 'active' : ''}`} onClick={() => { setActiveTab('deals'); setSearch(''); }}>
          Deals ({deals.length})
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── LEADS TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'leads' && (
            <div>
              <div className="filter-bar">
                <div className="search-box" style={{ paddingLeft: '12px' }}>
                  <input placeholder="Search by name, company or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 0 }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(['All', 'New', 'Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'] as const).map(f => (
                    <button key={f} className={`btn btn-sm ${leadStatusFilter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLeadStatusFilter(f)}>
                      {f === 'Open - Not Contacted' ? 'Not Contacted' : f === 'Working - Contacted' ? 'Contacted' : f === 'Closed - Converted' ? 'Converted' : f === 'Closed - Not Converted' ? 'Not Converted' : f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="empty-state">
                  <h3>{leads.length === 0 ? 'No leads submitted yet' : 'No leads match your search'}</h3>
                  <p>{leads.length === 0 ? 'Submit a lead for a prospective customer to Salesforce' : 'Try adjusting your search or filters'}</p>
                  {leads.length === 0 && (
                    <button className="btn btn-primary" onClick={() => setShowCreateLead(true)} style={{ margin: '12px auto 0' }}>
                      Submit First Lead
                    </button>
                  )}
                </div>
              ) : (
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Company</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map(l => (
                          <tr key={l._id} onClick={() => setSelectedLead(l)} style={{ cursor: 'pointer' }}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{l.contactName}</div>
                              {l.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.email}</div>}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.companyName || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.phone}</td>
                            <td>{leadStatusBadge(l.status)}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(l.createdAt)}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(l)}>View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DEALS TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'deals' && (
            <div>

              <div className="filter-bar">
                <div className="search-box" style={{ paddingLeft: '12px' }}>
                  <input placeholder="Search deals by name or company..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 0 }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button className={`btn btn-sm ${dealStageFilter === 'All' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDealStageFilter('All')}>All</button>
                  {uniqueStages.map(s => (
                    <button key={s} className={`btn btn-sm ${dealStageFilter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDealStageFilter(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {filteredDeals.length === 0 ? (
                <div className="empty-state">
                  <h3>{deals.length === 0 ? 'No deals yet' : 'No deals match your search'}</h3>
                  <p>{deals.length === 0 ? 'Deals will appear here once your Dealer Account is linked to Opportunities in Salesforce' : 'Try adjusting your search or stage filter'}</p>
                </div>
              ) : (
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Deal Name</th>
                          <th>Customer / Company</th>
                          <th>Product</th>
                          <th>Value</th>
                          <th>Stage</th>
                          <th>Close Date</th>
                          <th>Probability</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDeals.map(d => {
                          const name = d.Name || d.title || 'Unnamed Deal';
                          const stage = d.StageName || d.stage || '—';
                          const amount = d.Amount || d.expectedValue || 0;
                          const closeDate = d.CloseDate || d.expectedCloseDate;
                          const prob = d.probability ?? 0;
                          return (
                            <tr key={d._id} onClick={() => setSelectedDeal(d)} style={{ cursor: 'pointer' }}>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                                {d.companyName && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.companyName}</div>}
                              </td>
                              <td>
                                <div style={{ fontSize: 13 }}>{d.contactName || '—'}</div>
                              </td>
                              <td>
                                {d.productName ? (
                                  <>
                                    <div style={{ fontSize: 13 }}>{d.productName}</div>
                                    {d.quantity && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: {d.quantity}</div>}
                                  </>
                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                                {amount > 0 ? fmt(amount) : '—'}
                              </td>
                              <td>{dealStageBadge(stage)}</td>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(closeDate)}</td>
                              <td>
                                {prob > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                    <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${prob}%`, height: '100%', background: prob >= 70 ? 'var(--success)' : prob >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700 }}>{prob}%</span>
                                  </div>
                                ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDeal(d)}>View</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modals & Panels ── */}
      {showCreateLead && (
        <CreateLeadModal
          onClose={() => setShowCreateLead(false)}
          onSave={() => { setShowCreateLead(false); fetchLeads(); }}
        />
      )}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}

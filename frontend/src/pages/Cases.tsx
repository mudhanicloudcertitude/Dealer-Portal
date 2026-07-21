import { useEffect, useState } from 'react';
import API from '../api/client';

function statusBadge(s: string) {
  const m: any = {
    New: 'badge-purple',
    Working: 'badge-warning',
    Escalated: 'badge-danger',
    Closed: 'badge-success',
    'In Progress': 'badge-warning',
    Resolved: 'badge-success',
  };
  return `badge ${m[s] || 'badge-muted'}`;
}

function priorityBadge(p: string) {
  const m: any = { High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-info' };
  return `badge ${m[p] || 'badge-muted'}`;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  orderId: '',
  subject: '',
  description: '',
  priority: 'Medium',
};

export default function Cases() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    API.get('/cases')
      .then(r => setCases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Customer first and last name are required.');
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setFormError('Please provide at least one contact detail — Email or Phone.');
      return;
    }
    if (!form.subject.trim()) {
      setFormError('Case subject is required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        orderId: form.orderId || null,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
      };
      await API.post('/cases', payload);
      setSuccessMsg('Case submitted successfully to Salesforce. Our support team will review it shortly.');
      setForm(emptyForm);
      setTimeout(() => {
        setSuccessMsg('');
        setShowModal(false);
        load();
      }, 2500);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to submit case. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = cases.filter(c => {
    const matchStatus = filter === 'All' || c.Status === filter;
    const matchSearch =
      c.Subject?.toLowerCase().includes(search.toLowerCase()) ||
      c.CaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      c.CustomerName?.toLowerCase().includes(search.toLowerCase()) ||
      c.OrderId?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Customer Support Cases</h1>
          <p className="page-desc">Raise support cases on behalf of customers — all cases are managed by the support team</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setSuccessMsg(''); setShowModal(true); }}>
          Raise New Case
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: '360px', paddingLeft: '12px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by case #, subject, customer, order ID..."
            style={{ paddingLeft: 0 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {['All', 'New', 'Working', 'In Progress', 'Escalated', 'Resolved', 'Closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case Number</th>
                <th>Customer</th>
                <th>Subject</th>
                <th>Order ID</th>
                <th>Priority</th>
                <th>Created Date</th>
                <th>Status</th>
                <th>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.Id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'monospace' }}>{c.CaseNumber}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.CustomerName || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.CustomerEmail || c.CustomerPhone || ''}</div>
                  </td>
                  <td style={{ maxWidth: '240px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{c.Subject}</div>
                    {c.Description && (
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                        {c.Description.slice(0, 80)}{c.Description.length > 80 ? '…' : ''}
                      </p>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {c.OrderId || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td><span className={priorityBadge(c.Priority)}>{c.Priority}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.CreatedDate}</td>
                  <td><span className={statusBadge(c.Status)}>{c.Status}</span></td>
                  <td>
                    {c.Resolution__c ? (
                      <div style={{ background: 'rgba(16,185,129,0.06)', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.18)' }}>
                        {c.Resolution__c}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Pending review</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No support cases found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Case Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div className="modal-title">Raise Support Case</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {successMsg && (
                  <div style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
                    <span>{successMsg}</span>
                  </div>
                )}
                {formError && <div className="auth-error" style={{ marginBottom: '16px' }}>{formError}</div>}

                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Cases are submitted directly to Salesforce on behalf of your customer. The support team handles all resolution. Origin is set to Dealer Portal automatically.</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Customer First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Rahul" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Last Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Sharma" required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Customer Email</label>
                    <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="customer@email.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone</label>
                    <input type="tel" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Order ID <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} placeholder="e.g. ORD-2024-0012" />
                </div>

                <div className="form-group">
                  <label className="form-label">Case Subject <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Product not delivered after 2 weeks" required />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="High">High — Urgent / Blocking Issue</option>
                    <option value="Medium">Medium — Delay / Billing Problem</option>
                    <option value="Low">Low — General Query / Documentation</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the customer's issue clearly so the team can resolve it efficiently..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !!successMsg}>
                  {submitting ? 'Submitting to Salesforce...' : 'Submit Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

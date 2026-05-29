import { useState } from 'react';
import API from '../api/client';

function statusBadge(s: string) {
  const m: any = {
    New: 'badge-purple',
    Working: 'badge-warning',
    'In Progress': 'badge-warning',
    Resolved: 'badge-success',
    Closed: 'badge-success',
    Escalated: 'badge-danger',
  };
  return `badge ${m[s] || 'badge-muted'}`;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  orderId: '',
  description: '',
  priority: 'High',
};

export default function Warranty() {
  const [cases, setCases] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadWarrantyCases = async () => {
    setLoading(true);
    try {
      const r = await API.get('/warranty/cases');
      setCases(r.data || []);
      setLoaded(true);
    } catch (e) {
      console.error(e);
      setCases([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Load on first mount
  useState(() => { loadWarrantyCases(); });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Customer first and last name are required.');
      return;
    }
    if (!form.orderId.trim()) {
      setFormError('Order ID is required for warranty claims.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Please describe the warranty issue.');
      return;
    }

    setSubmitting(true);
    try {
      await API.post('/warranty/claim', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        orderId: form.orderId,
        description: form.description,
        priority: form.priority,
      });
      setSuccessMsg('✅ Warranty claim submitted to Salesforce! The SF team will review and reach out to the customer.');
      setForm(emptyForm);
      setTimeout(() => {
        setSuccessMsg('');
        setShowModal(false);
        loadWarrantyCases();
      }, 2800);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to submit warranty claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🛡️ Warranty & Service Claims</h1>
          <p className="page-desc">Submit warranty claims to Salesforce on behalf of customers — all resolution handled by SF team</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setSuccessMsg(''); setShowModal(true); }}>
          🛡️ Submit Warranty Claim
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'rgba(99,102,241,0.07)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>ℹ️</span>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>How Warranty Claims Work:</strong> You submit the claim on behalf of your customer with their details and Order ID. The Salesforce team handles all investigation, service scheduling, and resolution. You can track the status below.
        </div>
      </div>

      {/* Cases Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading warranty cases...
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Customer</th>
                  <th>Order ID</th>
                  <th>Issue Description</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.Id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'monospace' }}>{c.CaseNumber}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.CustomerName || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.CustomerEmail || c.CustomerPhone || ''}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {c.OrderId || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ maxWidth: '220px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        {(c.Description || '').slice(0, 100)}{(c.Description || '').length > 100 ? '…' : ''}
                      </p>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.CreatedDate}</td>
                    <td><span className={statusBadge(c.Status)}>{c.Status}</span></td>
                    <td>
                      {c.Resolution__c ? (
                        <div style={{ background: 'rgba(16,185,129,0.06)', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.18)' }}>
                          {c.Resolution__c}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {cases.length === 0 && loaded && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
                      No warranty claims yet. Submit a claim on behalf of a customer to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Warranty Claim Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div className="modal-title">🛡️ Submit Warranty Claim</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {successMsg && (
                  <div style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
                    {successMsg}
                  </div>
                )}
                {formError && <div className="auth-error" style={{ marginBottom: '16px' }}>{formError}</div>}

                <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  🛡️ Warranty claim is submitted as a <strong>Case (Type: Warranty Claim)</strong> in Salesforce. You can raise claims for any order — the SF team validates and processes it.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Customer First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Ramesh" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Last Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Kumar" required />
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
                  <label className="form-label">Order ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    className="form-input"
                    value={form.orderId}
                    onChange={e => setForm({ ...form, orderId: e.target.value })}
                    placeholder="e.g. ORD-2024-0012 or SF Order record ID"
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    You can raise claims for any order, including orders from other dealers
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="High">🔴 High — Critical defect / Safety issue</option>
                    <option value="Medium">🟡 Medium — Functional problem</option>
                    <option value="Low">🔵 Low — Minor defect / Cosmetic issue</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Describe the Warranty Issue <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the defect, malfunction, or issue clearly. Include when it started and any observed symptoms..."
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !!successMsg}>
                  {submitting ? '⏳ Submitting Claim...' : '🛡️ Submit Warranty Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

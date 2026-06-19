import { useState } from 'react';
import API from '../api/client';

function statusBadge(s: string) {
  const m: any = {
    Completed: 'badge-success',
    Paid: 'badge-success',
    Pending: 'badge-warning',
    'On Hold': 'badge-danger',
    Overdue: 'badge-danger',
    Cancelled: 'badge-muted',
  };
  return `badge ${m[s] || 'badge-muted'}`;
}

function fmt(n: number) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

function InvoiceRow({ inv, onDownload }: { inv: any; onDownload: (inv: any) => void }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {inv.Invoice_Number__c || inv.Name || 'N/A'}
          </div>
          {inv.OrderId__c && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Order Reference: <span style={{ fontFamily: 'monospace', color: 'var(--accent-light)' }}>{inv.OrderId__c}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={statusBadge(inv.Payment_Status__c)}>
            {inv.Payment_Status__c}
          </span>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onDownload(inv)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            Download Invoice
          </button>
        </div>
      </div>

      {/* Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Amount</div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{fmt(inv.Amount__c)}</div>
        </div>
        {inv.Due_Date__c && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Due Date</div>
            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.Due_Date__c}</div>
          </div>
        )}
        {inv.Payment_Date__c && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Payment Date</div>
            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--success)' }}>{inv.Payment_Date__c}</div>
          </div>
        )}
        {inv.CustomerName && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Customer</div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{inv.CustomerName}</div>
          </div>
        )}
      </div>

      {/* Tracking status bar */}
      {inv.Tracking_Status__c && (
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <strong>Tracking:</strong> {inv.Tracking_Status__c}
        </div>
      )}
    </div>
  );
}

export default function Payments() {
  const [searchName, setSearchName] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim() && !searchOrderId.trim()) {
      setSearchError('Please enter a customer name or Order ID to search.');
      return;
    }
    setSearchError('');
    setSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchName.trim()) params.append('name', searchName.trim());
      if (searchOrderId.trim()) params.append('orderId', searchOrderId.trim());
      const r = await API.get(`/payments/search?${params.toString()}`);
      setResults(r.data.invoices || []);
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Search failed. Please try again.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (inv: any) => {
    const id = inv.Id || inv.id;
    try {
      const response = await API.get(`/payments/${id}/download`);
      const invoice = response.data?.invoice || inv;
      const invoiceHtml = generateInvoiceHtml(invoice);
      const blob = new Blob([invoiceHtml], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoice.Invoice_Number__c || id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const invoiceHtml = generateInvoiceHtml(inv);
      const blob = new Blob([invoiceHtml], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${inv.Invoice_Number__c || id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  function generateInvoiceHtml(inv: any) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${inv.Invoice_Number__c || inv.Id}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; padding: 40px; max-width: 720px; margin: auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; margin-bottom: 28px; }
    .logo { font-size: 22px; font-weight: 800; color: #4f46e5; }
    .logo-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .inv-num { font-size: 28px; font-weight: 800; color: #1e293b; }
    .status { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${inv.Payment_Status__c === 'Completed' || inv.Payment_Status__c === 'Paid' ? '#dcfce7' : '#fef3c7'}; color: ${inv.Payment_Status__c === 'Completed' || inv.Payment_Status__c === 'Paid' ? '#16a34a' : '#d97706'}; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .field-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .field-value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .amount-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 28px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #4f46e5; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Dealer Portal</div>
      <div class="logo-sub">Manufacturing CRM</div>
    </div>
    <div style="text-align:right">
      <div class="inv-num">INVOICE</div>
      <div style="font-size:14px;color:#64748b;margin-top:4px;">${inv.Invoice_Number__c || inv.Id}</div>
      <div style="margin-top:6px"><span class="status">${inv.Payment_Status__c || 'Pending'}</span></div>
    </div>
  </div>

  <div class="grid">
    ${inv.CustomerName ? `<div><div class="field-label">Customer</div><div class="field-value">${inv.CustomerName}</div></div>` : ''}
    ${inv.OrderId__c ? `<div><div class="field-label">Order ID</div><div class="field-value" style="font-family:monospace">${inv.OrderId__c}</div></div>` : ''}
    ${inv.Due_Date__c ? `<div><div class="field-label">Due Date</div><div class="field-value">${inv.Due_Date__c}</div></div>` : ''}
    ${inv.Payment_Date__c ? `<div><div class="field-label">Payment Date</div><div class="field-value">${inv.Payment_Date__c}</div></div>` : ''}
  </div>

  <div class="amount-box">
    <div class="field-label">Total Amount</div>
    <div class="amount-value">₹${(inv.Amount__c || 0).toLocaleString('en-IN')}</div>
  </div>

  ${inv.Tracking_Status__c ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;font-size:13px;color:#0369a1;margin-bottom:20px"><strong>Tracking Status:</strong> ${inv.Tracking_Status__c}</div>` : ''}

  <div class="footer">
    Generated from Dealer Portal · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
  </div>
</body>
</html>`;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Invoices & Payments</h1>
          <p className="page-desc">Search customer invoices by name or Order ID and track payment status</p>
        </div>
      </div>

      {/* Search Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            <span>Search Invoices</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>Enter customer name and/or Order ID</span>
          </div>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Customer Name</label>
                <input
                  className="form-input"
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Order ID</label>
                <input
                  className="form-input"
                  value={searchOrderId}
                  onChange={e => setSearchOrderId(e.target.value)}
                  placeholder="e.g. ORD-2024-0012"
                />
              </div>
            </div>
            {searchError && (
              <div className="auth-error" style={{ marginBottom: '12px' }}>{searchError}</div>
            )}
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? 'Searching Salesforce...' : 'Search Invoices'}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      {searching && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Searching Salesforce for matching invoices...</div>
        </div>
      )}

      {!searching && hasSearched && results !== null && (
        <>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {results.length > 0 ? (
              <span>Found <strong>{results.length}</strong> invoice{results.length !== 1 ? 's' : ''}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No invoices found for the given search criteria.</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>No invoices found</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                No Salesforce invoices match this customer name or Order ID. Please verify the details and try again.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.map((inv: any) => (
                <InvoiceRow
                  key={inv.Id || inv.id}
                  inv={inv}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!hasSearched && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Search for Customer Invoices</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto' }}>
            Enter a customer name or Order ID above to look up invoices from Salesforce and download them.
          </div>
        </div>
      )}
    </div>
  );
}

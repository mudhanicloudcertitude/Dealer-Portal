import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../api/client';

function fmt(n: number) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

function statusBadge(s: string) {
  const m: any = { 
    Delivered: 'badge-success', 
    Shipped: 'badge-info', 
    Processing: 'badge-warning', 
    Pending: 'badge-purple', 
    Cancelled: 'badge-danger' 
  };
  return `badge ${m[s] || 'badge-muted'}`;
}

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');
  const prefillProductId = searchParams.get('prefillProductId');
  const prefillQuantity = searchParams.get('prefillQuantity');
  const triggerCreate = searchParams.get('triggerCreate');

  // Placement Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [shippingCity, setShippingCity] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Customer Details Form States
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');

  const load = async () => {
    try {
      const oRes = await API.get('/orders');
      setOrders(oRes.data);
      const pRes = await API.get('/products');
      setProducts(pRes.data);
      const sRes = await API.get('/schemes');
      setSchemes(sRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().then(() => {
      if (orderIdParam) {
        viewOrder(orderIdParam);
      }
      if (prefillProductId) {
        setSelectedProductId(prefillProductId);
        if (prefillQuantity) {
          setQuantity(Number(prefillQuantity));
        }
        if (triggerCreate === 'true') {
          setShowCreateModal(true);
        }
      }
    });
  }, [orderIdParam, prefillProductId, prefillQuantity, triggerCreate]);

  const viewOrder = async (id: string) => {
    try {
      const r = await API.get(`/orders/${id}`);
      setSelected(r.data);
    } catch (e) {
      console.error('Failed to fetch order details:', e);
    }
  };

  // Selected Product details
  const activeProduct = products.find(p => p.Id === selectedProductId || p._id === selectedProductId);
  const finalCartTotal = activeProduct ? activeProduct.UnitPrice * quantity : 0;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    // Validation
    if (!customerFirstName || !customerLastName) {
      setFormError('Customer first and last name are required.');
      return;
    }
    if (!customerPhone) {
      setFormError('Customer phone is required.');
      return;
    }
    if (!selectedProductId || quantity <= 0) {
      setFormError('Please select a valid product and set a quantity greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await API.post('/orders', {
        productId: selectedProductId,
        quantity,
        shippingCity: shippingCity || null,
        appliedSchemeId: selectedSchemeId || null,
        customerFirstName,
        customerLastName,
        customerEmail: customerEmail || null,
        customerPhone
      });
      setShowCreateModal(false);
      // Reset form
      setSelectedProductId('');
      setQuantity(1);
      setShippingCity('');
      setSelectedSchemeId('');
      setCustomerFirstName('');
      setCustomerLastName('');
      setCustomerEmail('');
      setCustomerPhone('');
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'An error occurred while placing your order.');
    } finally {
      setSubmitting(false);
    }
  };

  const statuses = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  
  const filtered = orders.filter(o => {
    const ms = filter === 'All' || o.Status === filter;
    const mq = o.OrderNumber?.toLowerCase().includes(search.toLowerCase()) || 
               o.CustomerName?.toLowerCase().includes(search.toLowerCase()) ||
               o.items?.[0]?.ProductName?.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
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
          <h1 className="page-title">📦 Order Management</h1>
          <p className="page-desc">Submit Salesforce orders for customers and track real-time fulfillment status</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          ➕ Place Customer Order
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 280 }}>
          <span>🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search order, customer or product..." 
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {statuses.map(s => (
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
                <th>Order Reference</th>
                <th>Customer</th>
                <th>Product Spec</th>
                <th>Effective Date</th>
                <th>Order Net Value</th>
                <th>Status</th>
                <th>Tracking Serial</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const mainItem = o.items?.[0] || {};
                return (
                  <tr key={o.Id}>
                    <td>
                      <div 
                        style={{ fontWeight: 700, color: 'var(--accent-light)', cursor: 'pointer' }} 
                        onClick={() => viewOrder(o.Id)}
                      >
                        {o.OrderNumber}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.CustomerName || '—'}</div>
                      {(o.CustomerEmail || o.CustomerPhone) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {[o.CustomerPhone, o.CustomerEmail].filter(Boolean).join(' | ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mainItem.ProductName || 'Procurement Product'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mainItem.Quantity || 0} units @ {fmt(mainItem.UnitPrice)}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{o.EffectiveDate}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(o.TotalAmount)}</td>
                    <td>
                      <span className={statusBadge(o.Status)}>{o.Status}</span>
                    </td>
                    <td style={{ fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {o.Tracking_Number__c || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => viewOrder(o.Id)}>View Details</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No purchase orders found matching this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="modal-title">📦 Customer Order: {selected.OrderNumber}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LOGISTICS STATUS</div>
                  <span className={statusBadge(selected.Status)} style={{ marginTop: '4px', display: 'inline-block' }}>{selected.Status}</span>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NET INVOICE VALUE</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{fmt(selected.TotalAmount)}</div>
                </div>
              </div>

              {selected.AppliedScheme && (
                <div style={{ padding: '14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Promotional Scheme Applied</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏷️ {selected.AppliedScheme}</span>
                    <span>Saved {fmt(selected.DiscountAmount)}!</span>
                  </div>
                </div>
              )}

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>CUSTOMER INFORMATION</h4>
              <div className="grid-2" style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CUSTOMER NAME</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{selected.CustomerName || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONTACT DETAILS</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {selected.CustomerPhone && <span>📞 {selected.CustomerPhone}</span>}
                    {selected.CustomerEmail && <span>✉️ {selected.CustomerEmail}</span>}
                    {!selected.CustomerPhone && !selected.CustomerEmail && <span>—</span>}
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>ORDER SPECIFICATIONS</h4>
              <div className="table-wrap" style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '4px 10px' }}>
                <table style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Product Spec</th>
                      <th>Qty</th>
                      <th>Dealer Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.ProductName}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.ProductCode}</div>
                        </td>
                        <td>{item.Quantity} units</td>
                        <td>{fmt(item.UnitPrice)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.TotalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px' }}>LOGISTICS TRACKING TIMELINE</h4>
              <div className="timeline">
                {selected.timeline?.map((step: any, idx: number) => (
                  <div key={idx} className="timeline-item">
                    <div className={`timeline-icon ${step.done ? 'done' : ''}`}>{step.done ? '✓' : '○'}</div>
                    <div className="timeline-content">
                      <div className="timeline-step" style={{ color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.title}</div>
                      <div className="timeline-date">{step.date}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Place Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div className="modal-title">📝 Place Customer Order</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePlaceOrder}>
              <div className="modal-body">
                {formError && <div className="auth-error" style={{ marginBottom: '16px' }}>{formError}</div>}
                
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>CUSTOMER DETAILS</h4>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">CUSTOMER FIRST NAME <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      className="form-input" 
                      value={customerFirstName} 
                      onChange={e => setCustomerFirstName(e.target.value)} 
                      placeholder="e.g. John" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CUSTOMER LAST NAME <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      className="form-input" 
                      value={customerLastName} 
                      onChange={e => setCustomerLastName(e.target.value)} 
                      placeholder="e.g. Doe" 
                      required 
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">CUSTOMER PHONE <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      value={customerPhone} 
                      onChange={e => setCustomerPhone(e.target.value)} 
                      placeholder="e.g. +91 98765 43210" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CUSTOMER EMAIL (OPTIONAL)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={customerEmail} 
                      onChange={e => setCustomerEmail(e.target.value)} 
                      placeholder="e.g. john.doe@example.com" 
                    />
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '16px' }}>ORDER SPECIFICATIONS</h4>
                <div className="form-group">
                  <label className="form-label">SELECT PRODUCT SPECIFICATION</label>
                  <select 
                    className="form-input" 
                    value={selectedProductId} 
                    onChange={e => setSelectedProductId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => (
                      <option key={p.Id} value={p.Id}>
                        {p.Name} ({fmt(p.UnitPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">ORDER QUANTITY (UNITS)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="1" 
                      value={quantity} 
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="e.g. 5"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DISPATCH SHIPPING CITY</label>
                    <input 
                      className="form-input" 
                      value={shippingCity} 
                      onChange={e => setShippingCity(e.target.value)} 
                      placeholder="e.g. Mumbai, Pune" 
                    />
                  </div>
                </div>

                {/* Scheme Picker */}
                {products.length > 0 && selectedProductId && (
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">APPLY PROMOTIONAL VOLUME SCHEME (OPTIONAL)</label>
                    <select 
                      className="form-input" 
                      value={selectedSchemeId} 
                      onChange={e => setSelectedSchemeId(e.target.value)}
                    >
                      <option value="">-- Apply Volume Discount (Optional) --</option>
                      {schemes.map(s => {
                        const isEligible = finalCartTotal >= s.Min_Order_Value__c && (!s.Max_Order_Value__c || finalCartTotal <= s.Max_Order_Value__c);
                        return (
                          <option key={s.Id} value={s.Id}>
                            {s.Scheme_Name__c} ({s.Discount_Percentage__c}% Rebate) {!isEligible ? ' [Ineligible]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
 
                {(() => {
                  const selectedScheme = schemes.find(s => s.Id === selectedSchemeId);
                  let calculatedDiscount = 0;
                  let netCheckoutTotal = finalCartTotal;
                  let eligibilityError = '';

                  if (selectedScheme) {
                    if (finalCartTotal < selectedScheme.Min_Order_Value__c) {
                      eligibilityError = `Min order of ${fmt(selectedScheme.Min_Order_Value__c)} required for this rebate campaign.`;
                    } else if (selectedScheme.Max_Order_Value__c && finalCartTotal > selectedScheme.Max_Order_Value__c) {
                      eligibilityError = `Order exceeds max value limit of ${fmt(selectedScheme.Max_Order_Value__c)} for this rebate.`;
                    } else {
                      calculatedDiscount = finalCartTotal * (selectedScheme.Discount_Percentage__c / 100);
                      netCheckoutTotal = finalCartTotal - calculatedDiscount;
                    }
                  }

                  return (
                    <>
                      {eligibilityError && (
                        <div style={{ color: 'var(--warning)', fontSize: '12px', marginTop: '10px', fontWeight: 600, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px', borderRadius: '8px' }}>
                          ⚠️ {eligibilityError} Scheme will not be applied at checkout.
                        </div>
                      )}
                      
                      <div 
                        style={{ 
                          marginTop: '20px', 
                          padding: '16px', 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid var(--border)', 
                          borderRadius: '12px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span>Product Unit Rate</span>
                          <span>{fmt(activeProduct?.UnitPrice || 0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          <span>Gross procurement amount</span>
                          <span>{fmt(finalCartTotal)}</span>
                        </div>
                        {calculatedDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--success)', marginTop: '6px', fontWeight: 600 }}>
                            <span>Volume Scheme Rebate ({selectedScheme?.Discount_Percentage__c}%)</span>
                            <span>-{fmt(calculatedDiscount)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          <span>Net checkout price</span>
                          <span style={{ color: calculatedDiscount > 0 ? 'var(--success)' : 'var(--accent-light)' }}>{fmt(netCheckoutTotal)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreateModal(false); setSelectedSchemeId(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '⏳ Transmitting Order...' : '🚀 Place Customer Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

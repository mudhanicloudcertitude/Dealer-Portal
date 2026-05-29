import { useEffect, useState } from 'react';
import API from '../api/client';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    API.get('/products')
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const families = ['All', ...Array.from(new Set(products.map((p: any) => p.Family).filter(Boolean)))];
  
  const filtered = products.filter((p: any) => {
    const matchSearch = p.Name?.toLowerCase().includes(search.toLowerCase()) || 
                        p.ProductCode?.toLowerCase().includes(search.toLowerCase());
    const matchFamily = filter === 'All' || p.Family === filter;
    return matchSearch && matchFamily;
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
          <h1 className="page-title">🏭 Product Catalog</h1>
          <p className="page-desc">{products.length} heavy-industry components with real-time pricing slabs and AI forecasting</p>
        </div>
      </div>

      <div className="filter-bar" style={{ gap: '12px' }}>
        <div className="search-box" style={{ maxWidth: '360px' }}>
          <span>🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by name or serial code..." 
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {families.map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', borderRadius: '8px' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No products match your criteria</h3>
          <p>Try refining your search text or switching the product family filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filtered.map((p: any) => (
            <div key={p.Id} className="card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{p.Name}</h3>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.ProductCode}</span>
                  </div>
                  <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '9px' }}>{p.Family}</span>
                </div>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '18px' }}>
                  {p.Description || 'High-specification precision manufacturing component calibrated for heavy-duty industrial assembly setups.'}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>DEALER RATE</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-light)' }}>
                      ₹{(p.UnitPrice || 0).toLocaleString('en-IN')}
                    </div>
                    {p.ListPrice && p.ListPrice > p.UnitPrice && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        MRP: ₹{p.ListPrice.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Forecasted Demand</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                      📈 {p.Forecasted_Demand__c || 0} units/mo
                    </div>
                  </div>
                </div>

                {p.Restock_Recommendation__c && (
                  <div 
                    style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      background: 'rgba(99,102,241,0.06)', 
                      border: '1px solid rgba(99,102,241,0.15)', 
                      borderRadius: '8px', 
                      fontSize: '11.5px', 
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>✨</span>
                    <span>AI suggests restocking <strong>{p.Restock_Recommendation__c} units</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

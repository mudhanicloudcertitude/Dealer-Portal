import { useEffect, useState } from 'react';
import API from '../api/client';

export default function Inventory() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    API.get('/inventory')
      .then(r => setInventory(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);



  const filtered = inventory.filter((item: any) => 
    item.Product_Name__c?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = inventory.filter((i: any) => i.isLowStock).length;
  const totalValue = inventory.reduce((s: number, i: any) => s + ((i.Stock_On_Hand__c || 0) * (i.UnitPrice || 0)), 0);

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
          <h1 className="page-title">🗃️ Dealership Inventory</h1>
          <p className="page-desc">Track local dealership stock balances, trigger physical audits, and optimize replenishment</p>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <div className="metric-card success">
          <div className="metric-icon success">📦</div>
          <div className="metric-value">{inventory.length}</div>
          <div className="metric-label">Total Active SKUs</div>
        </div>
        <div className={`metric-card ${lowStock > 0 ? 'danger' : 'success'}`}>
          <div className={`metric-icon ${lowStock > 0 ? 'danger' : 'success'}`}>⚠️</div>
          <div className="metric-value">{lowStock}</div>
          <div className="metric-label">Low Stock Alarms</div>
        </div>
        <div className="metric-card info">
          <div className="metric-icon info">💰</div>
          <div className="metric-value">₹{(totalValue / 100000).toFixed(2)}L</div>
          <div className="metric-label">Estimated Asset Value</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: '340px' }}>
          <span>🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search products..." 
          />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product Information</th>
                <th>Stock Level</th>
                <th>Min Safe Level</th>
                <th>Stock Health</th>
                <th>AI Restock recommendation</th>
                <th>Audit History</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const pct = item.stockHealthPercent || 0;
                const cls = pct >= 100 ? 'good' : pct >= 50 ? 'warn' : 'low';

                return (
                  <tr key={item.Id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.Product_Name__c}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: item.isLowStock ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {item.Stock_On_Hand__c}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{item.Min_Stock_Level__c}</td>
                    <td style={{ minWidth: '150px' }}>
                      <div className="stock-bar-wrap">
                        <div className="stock-bar" style={{ flex: 1 }}>
                          <div className={`stock-bar-fill ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                      {item.Restock_Recommendation__c ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ✨ {item.Restock_Recommendation__c} units
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.Last_Audit_Date__c}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Last verification</div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No inventory records match your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

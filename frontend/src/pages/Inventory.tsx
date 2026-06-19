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

  const totalQty = inventory.reduce((s: number, i: any) => s + (i.Quantity__c || 0), 0);
  const totalValue = inventory.reduce((s: number, i: any) => s + (i.Amount__c !== undefined && i.Amount__c !== null ? i.Amount__c : (i.Quantity__c || 0) * (i.UnitPrice || 0)), 0);

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
          <h1 className="page-title">Dealership Inventory</h1>
          <p className="page-desc">Live stock from Salesforce Dealer_Inventory__c — track quantities and recommended restock thresholds</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <div className="metric-card success" style={{ padding: '24px' }}>
          <div className="metric-value">{inventory.length}</div>
          <div className="metric-label">Total SKUs</div>
        </div>
        <div className="metric-card info" style={{ padding: '24px' }}>
          <div className="metric-value">{totalQty.toLocaleString('en-IN')}</div>
          <div className="metric-label">Total Units in Stock</div>
        </div>
        <div className="metric-card info" style={{ padding: '24px' }}>
          <div className="metric-value">₹{(totalValue / 100000).toFixed(2)}L</div>
          <div className="metric-label">Estimated Asset Value</div>
        </div>
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: '340px', paddingLeft: '12px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            style={{ paddingLeft: 0 }}
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Quantity</th>
                <th>Dealer Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const dealerPrice = item.Amount__c !== undefined && item.Amount__c !== null ? item.Amount__c : (item.Quantity__c || 0) * (item.UnitPrice || 0);

                return (
                  <tr key={item.Id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.Product_Name__c}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.Product2Id}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                        {(item.Quantity__c || 0).toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>units</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {dealerPrice > 0 ? `₹${dealerPrice.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No inventory records match your search.
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

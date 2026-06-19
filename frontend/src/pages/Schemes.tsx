import { useEffect, useState } from 'react';
import API from '../api/client';

function fmt(n: number) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

export default function Schemes() {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calculator States
  const [calcAmount, setCalcAmount] = useState<number>(150000);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');
  const [calcResult, setCalcResult] = useState<any>(null);

  useEffect(() => {
    API.get('/schemes')
      .then(r => {
        setSchemes(r.data);
        if (r.data.length > 0) {
          setSelectedSchemeId(r.data[0].Id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSchemeId || calcAmount <= 0) {
      setCalcResult(null);
      return;
    }
    
    API.post('/schemes/calculate', { orderValue: calcAmount, schemeId: selectedSchemeId })
      .then(r => setCalcResult(r.data))
      .catch(e => {
        console.error(e);
        setCalcResult({ error: 'Calculation failed. Please verify credentials.' });
      });
  }, [calcAmount, selectedSchemeId]);

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
          <h1 className="page-title">Schemes & Pricing Slabs</h1>
          <p className="page-desc">Check active sales campaigns, volume incentive rebates, and calculate purchase margins</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }} className="grid-2-mobile">
        {/* Active Schemes Cards */}
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-secondary)' }}>
            ACTIVE PROMOTIONAL TIER CAMPAIGNS ({schemes.length})
          </div>
          
          {schemes.length === 0 ? (
            <div className="empty-state">
              <h3>No active schemes available</h3>
              <p>Check back later or contact your account manager for dealer custom pricing agreements.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {schemes.map((s: any) => (
                <div key={s.Id} className="card" style={{ border: '1px solid var(--border)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.Scheme_Name__c}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)' }}>
                        {s.Discount_Percentage__c}%
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>OFF NET RATE</span>
                    </div>
                  </div>

                  <div className="grid-2" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>ELIGIBILITY MIN VALUE</div>
                      <div style={{ fontWeight: 600 }}>{fmt(s.Min_Order_Value__c)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>ELIGIBILITY MAX VALUE</div>
                      <div style={{ fontWeight: 600 }}>{s.Max_Order_Value__c > 10000000 ? 'Uncapped' : fmt(s.Max_Order_Value__c)}</div>
                    </div>
                  </div>

                  <div className="grid-2" style={{ marginTop: '12px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>VALID FROM</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <span>{s.Start_Date__c}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>VALID UNTIL</div>
                      <div style={{ fontWeight: 600, color: 'var(--warning)' }}>
                        <span>{s.End_Date__c || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing Calculator */}
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-secondary)' }}>
            SCHEME DISCOUNT CALCULATOR
          </div>
          
          <div className="card" style={{ border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(255,255,255,0.01))' }}>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Simulate your purchase volume to see which campaign gives the highest margin yields.
            </p>

            <div className="form-group">
              <label className="form-label">1. Choose Scheme Campaign</label>
              <select 
                className="form-input" 
                value={selectedSchemeId} 
                onChange={e => setSelectedSchemeId(e.target.value)}
              >
                {schemes.map(s => (
                  <option key={s.Id} value={s.Id}>
                    {s.Scheme_Name__c} ({s.Discount_Percentage__c}% Discount)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">2. Target Order Value (₹)</label>
              <input 
                type="number" 
                className="form-input" 
                value={calcAmount} 
                onChange={e => setCalcAmount(Math.max(0, parseInt(e.target.value) || 0))} 
                placeholder="Enter raw order amount..."
              />
            </div>

            {calcResult && (
              <div 
                style={{ 
                  marginTop: '24px', 
                  padding: '16px', 
                  background: calcResult.eligible ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', 
                  border: `1px solid ${calcResult.eligible ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: '12px'
                }}
              >
                {calcResult.eligible ? (
                  <>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gross Procurement Cost</span>
                      <span>{fmt(calcAmount)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontWeight: 600 }}>
                      <span>Rebate Deducted ({calcResult.scheme?.Discount_Percentage__c}%)</span>
                      <span>-{fmt(calcResult.discount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <span>Net Dealer Price</span>
                      <span style={{ color: 'var(--success)' }}>{fmt(calcResult.finalAmount)}</span>
                    </div>
                    <div style={{ color: 'var(--success)', fontSize: '11.5px', marginTop: '12px', textAlign: 'center', fontWeight: 600 }}>
                      Eligible for Scheme Saving
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>
                      Order Ineligible
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {calcResult.message || 'Verification parameters mismatch'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

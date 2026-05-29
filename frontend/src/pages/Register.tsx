import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    dealerName: '', 
    city: '', 
    state: '', 
    phone: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); 
    setError(''); 
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('dp_token', data.token);
      window.location.href = '/';
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🏭</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Dealer Registration</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Onboard your dealership profile</div>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                className="form-input" 
                value={form.name} 
                onChange={set('name')} 
                placeholder="Raj Sharma" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                className="form-input" 
                type="email" 
                value={form.email} 
                onChange={set('email')} 
                placeholder="you@company.com" 
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              className="form-input" 
              type="password" 
              value={form.password} 
              onChange={set('password')} 
              placeholder="Min 8 characters" 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dealership Name</label>
            <input 
              className="form-input" 
              value={form.dealerName} 
              onChange={set('dealerName')} 
              placeholder="Sunrise Industries Pvt Ltd" 
              required 
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">City</label>
              <input 
                className="form-input" 
                value={form.city} 
                onChange={set('city')} 
                placeholder="Mumbai" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input 
                className="form-input" 
                value={form.state} 
                onChange={set('state')} 
                placeholder="Maharashtra" 
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input 
              className="form-input" 
              value={form.phone} 
              onChange={set('phone')} 
              placeholder="9876543210" 
              required 
            />
          </div>
          <button 
            className="btn btn-primary w-full" 
            style={{ justifyContent: 'center', marginTop: '8px' }} 
            disabled={loading}
          >
            {loading ? '⏳ Registering...' : '✅ Register Dealership'}
          </button>
        </form>
        <div className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

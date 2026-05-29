import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('dealer@sunrise.com');
    setPassword('dealer123');
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏭</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Dealer Portal</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manufacturing CRM</div>
          </div>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your dealer account</p>

        <div className="auth-divider" style={{ margin: '20px 0 16px' }} />

        <div className="demo-creds">
          🔑 Demo: <strong>dealer@sunrise.com</strong> / <strong>dealer123</strong>
          &nbsp;&nbsp;
          <button 
            type="button" 
            onClick={fillDemo} 
            className="btn btn-ghost btn-sm" 
            style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}
          >
            Fill
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              className="form-input" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="dealer@company.com" 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              className="form-input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
            />
          </div>
          <button 
            className="btn btn-primary w-full" 
            style={{ marginTop: '8px', justifyContent: 'center' }} 
            disabled={loading}
          >
            {loading ? '⏳ Signing in...' : '🚀 Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          New dealer? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}

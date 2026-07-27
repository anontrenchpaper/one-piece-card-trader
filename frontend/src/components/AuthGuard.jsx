import React, { useState, useEffect } from 'react';
import { Lock, Key, ShieldCheck, ArrowRight } from 'lucide-react';
import { AUTH_CONFIG, hashPasscode } from '../config/auth';

export default function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
    if (savedToken === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passcodeInput.trim()) return;

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const hashedInput = await hashPasscode(passcodeInput);
      
      // Strict cryptographic hash verification
      if (hashedInput === AUTH_CONFIG.PASSCODE_HASH) {
        sessionStorage.setItem(AUTH_CONFIG.SESSION_STORAGE_KEY, 'authenticated');
        setIsAuthenticated(true);
      } else {
        setErrorMessage('Incorrect passcode. Please check and try again.');
      }
    } catch (err) {
      setErrorMessage('Error verifying passcode.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg-primary)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '40px 32px',
        textAlign: 'center',
        border: '1px solid var(--border-accent)',
        boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.25)'
      }}>
        
        <div style={{
          background: 'var(--primary-gradient)',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <Lock size={32} color="#fff" />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px' }}>
          Access Protected
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Enter your secret passcode to unlock the TCG Card Pricing Application.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Key size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="password"
              placeholder="Enter passcode..."
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: '#0f172a',
                border: errorMessage ? '1px solid #ef4444' : '1px solid var(--border-accent)',
                color: '#fff',
                padding: '12px 14px 12px 42px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border 0.2s'
              }}
            />
          </div>

          {errorMessage && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'left' }}>
              {errorMessage}
            </p>
          )}

          <button 
            type="submit" 
            disabled={isVerifying || !passcodeInput}
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {isVerifying ? 'Verifying...' : 'Unlock Workspace'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>SHA-256 Cryptographic Authentication Active</span>
        </div>

      </div>
    </div>
  );
}

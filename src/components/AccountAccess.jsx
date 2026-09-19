import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AccountAccess() {
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? '邮箱或密码不正确' : authError.message);
      return;
    }
    setPassword('');
    setOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={session ? session.user.email : '登录后可编辑回忆'}
        style={{
          position: 'fixed', right: 22, top: 20, zIndex: 120000,
          border: '1px solid rgba(255,255,255,.28)', borderRadius: 999,
          padding: '9px 14px', cursor: 'pointer', color: '#fff',
          background: session ? 'rgba(72,187,120,.72)' : 'rgba(24,20,42,.66)',
          backdropFilter: 'blur(14px)', boxShadow: '0 8px 28px rgba(0,0,0,.2)',
          fontSize: 13, letterSpacing: '.04em'
        }}
      >
        {session ? '✓ 已登录' : '登录编辑'}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 130000, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(2,3,12,.72)', backdropFilter: 'blur(18px)'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(390px, 92vw)', padding: 30, borderRadius: 24,
              color: '#f8f3ff', background: 'linear-gradient(145deg, rgba(34,29,58,.97), rgba(12,13,31,.98))',
              border: '1px solid rgba(255,190,220,.22)', boxShadow: '0 30px 90px rgba(0,0,0,.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#f3a6c2', letterSpacing: '.2em' }}>N & H PRIVATE ACCESS</div>
                <h2 style={{ margin: '9px 0 5px', fontSize: 25 }}>登录后编辑回忆</h2>
                <p style={{ margin: 0, opacity: .62, fontSize: 13 }}>浏览无需登录，保存和上传需要账号。</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {session ? (
              <div style={{ marginTop: 25 }}>
                <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.06)', fontSize: 13 }}>
                  已登录：{session.user.email}
                </div>
                <button onClick={signOut} style={buttonStyle}>退出登录</button>
              </div>
            ) : (
              <form onSubmit={signIn} style={{ marginTop: 25 }}>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" style={inputStyle} />
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" style={{ ...inputStyle, marginTop: 12 }} />
                {error && <div style={{ marginTop: 12, color: '#ff9eaf', fontSize: 13 }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>
                  {loading ? '登录中…' : '登录'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', borderRadius: 13, padding: '13px 14px',
  border: '1px solid rgba(255,255,255,.14)', outline: 'none', color: '#fff',
  background: 'rgba(255,255,255,.075)', fontSize: 15
};

const buttonStyle = {
  width: '100%', marginTop: 16, padding: '13px 16px', border: 0, borderRadius: 13,
  cursor: 'pointer', color: '#201529', fontWeight: 700, fontSize: 14,
  background: 'linear-gradient(135deg, #ffd0df, #c9b7ff)'
};

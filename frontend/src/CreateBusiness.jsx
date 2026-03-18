import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = 'http://localhost:8000';

function Field({ label, id, type = 'text', value, onChange, placeholder, error, required, hint, as, disabled }) {
  const [focused, setFocused] = useState(false);
  const base = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '14px',
    border: `1px solid ${error ? '#EF4444' : focused ? '#EA5E28' : '#D1D5DB'}`,
    borderRadius: '8px', fontFamily: 'inherit', background: disabled ? '#F9FAFB' : '#fff',
    outline: 'none', color: disabled ? '#9CA3AF' : '#111827',
    boxShadow: focused && !disabled ? '0 0 0 3px rgba(234,94,40,0.1)' : 'none',
    transition: 'all 0.15s', resize: as === 'textarea' ? 'vertical' : undefined,
    cursor: disabled ? 'not-allowed' : undefined,
  };
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
        {label}{required && <span style={{ color: '#EA5E28' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea id={id} rows={3} value={value} onChange={onChange} placeholder={placeholder} style={base} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        : <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} style={base} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      }
      {hint && !error && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9CA3AF' }}>{hint}</p>}
      {error && <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#EF4444' }}>{error}</p>}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 14px' }}>
      <span style={{ fontSize: '11px', fontWeight: '700', color: '#EA5E28', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
    </div>
  );
}

export default function CreateBusiness() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: '', code: '', legal_name: '', ntn: '', sales_tax_reg: '',
    phone: '', email: '', address: '',
    business_email: '', business_password: '', confirm_password: '',
    down_payment: '', monthly_charges: false, monthly_subscription_fee: '',
  });

  const set = k => e => {
    let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'code') v = v.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())           errs.name            = 'Required.';
    if (!form.code.trim())           errs.code            = 'Required.';
    else if (form.code.length < 2)   errs.code            = 'At least 2 characters.';
    if (!form.business_email.trim()) errs.business_email  = 'Required.';
    else if (!/\S+@\S+\.\S+/.test(form.business_email)) errs.business_email = 'Invalid email.';
    if (!form.business_password)     errs.business_password = 'Required.';
    else if (form.business_password.length < 6) errs.business_password = 'At least 6 characters.';
    if (form.confirm_password !== form.business_password) errs.confirm_password = 'Passwords do not match.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email.';
    if (form.down_payment && isNaN(Number(form.down_payment))) errs.down_payment = 'Must be a number.';
    if (form.monthly_charges && !form.monthly_subscription_fee) errs.monthly_subscription_fee = 'Required when monthly charges enabled.';
    if (form.monthly_charges && form.monthly_subscription_fee && isNaN(Number(form.monthly_subscription_fee))) errs.monthly_subscription_fee = 'Must be a number.';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { ...form };
      delete payload.confirm_password;
      const res  = await fetch(`${BACKEND_URL}/api/businesses/create/`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) navigate('/');
      else setServerError(data.error || 'Something went wrong.');
    } catch {
      setServerError('Cannot connect to server.');
    } finally { setLoading(false); }
  };

  const Spinner = () => (
    <svg style={{ animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div style={{ padding: '36px 32px', minHeight: '100vh', fontFamily: '"Google Sans", system-ui, sans-serif' }}>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827' }}>New Business</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9CA3AF' }}>Register a business and set up its login credentials</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '32px' }}>
          {serverError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', color: '#DC2626', fontSize: '13px' }}>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* ── Business Info ── */}
            <SectionHeader title="Business Info" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="name" label="Business Name" value={form.name} onChange={set('name')} placeholder="e.g. Fayz General Store" required error={errors.name} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="code" label="Code" value={form.code} onChange={set('code')} placeholder="FAYZ01" required hint="2–20 chars, uppercase" error={errors.code} />
                <Field id="legal_name" label="Legal Name" value={form.legal_name} onChange={set('legal_name')} placeholder="Optional" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="ntn" label="NTN" value={form.ntn} onChange={set('ntn')} placeholder="National Tax No." />
                <Field id="sales_tax_reg" label="Sales Tax Reg. #" value={form.sales_tax_reg} onChange={set('sales_tax_reg')} placeholder="STRN" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="phone" label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+92 300 0000000" />
                <Field id="email" label="Business Email" type="email" value={form.email} onChange={set('email')} placeholder="info@business.com" error={errors.email} />
              </div>
              <Field id="address" label="Address" value={form.address} onChange={set('address')} placeholder="Full address…" as="textarea" />
            </div>

            {/* ── Subscription & Payment ── */}
            <SectionHeader title="Subscription & Payment" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="down_payment" label="Payment Amount (PKR)" type="number" value={form.down_payment} onChange={set('down_payment')} placeholder="0.00" error={errors.down_payment} hint="One-time setup / down payment amount" />

              {/* Monthly Charges toggle */}
              <div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setForm(f => ({ ...f, monthly_charges: !f.monthly_charges }))}
                  onKeyDown={e => e.key === ' ' && setForm(f => ({ ...f, monthly_charges: !f.monthly_charges }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
                  {/* Track */}
                  <div style={{
                    position: 'relative', width: '38px', height: '22px', flexShrink: 0,
                    borderRadius: '11px', background: form.monthly_charges ? '#EA5E28' : '#D1D5DB',
                    transition: 'background 0.2s',
                  }}>
                    {/* Thumb */}
                    <div style={{
                      position: 'absolute', top: '3px',
                      left: form.monthly_charges ? '19px' : '3px',
                      width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#374151' }}>Enable Monthly Charges</span>
                </div>
                <p style={{ margin: '4px 0 0 48px', fontSize: '11.5px', color: '#9CA3AF' }}>
                  If enabled, this business will be charged a recurring monthly fee.
                </p>
              </div>

              {form.monthly_charges && (
                <Field
                  id="monthly_subscription_fee"
                  label="Monthly Charges Amount (PKR)"
                  type="number"
                  value={form.monthly_subscription_fee}
                  onChange={set('monthly_subscription_fee')}
                  placeholder="0.00"
                  required
                  error={errors.monthly_subscription_fee}
                />
              )}
            </div>

            {/* ── Login Credentials ── */}
            <SectionHeader title="Login Credentials" />
            <div style={{ background: '#FFFBF5', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 13px', marginBottom: '14px', fontSize: '12.5px', color: '#92400E' }}>
              These credentials will be used by this business to log in to the POS system.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="business_email" label="Login Email" type="email" value={form.business_email} onChange={set('business_email')} placeholder="login@business.com" required error={errors.business_email} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="business_password" label="Password" type="password" value={form.business_password} onChange={set('business_password')} placeholder="Min. 6 characters" required error={errors.business_password} />
                <Field id="confirm_password" label="Confirm Password" type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="Repeat password" error={errors.confirm_password} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button type="button" onClick={() => navigate('/')}
                style={{ padding: '10px 20px', background: '#F3F4F6', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading}
                style={{ padding: '10px 22px', background: '#EA5E28', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(234,94,40,0.25)' }}>
                {loading ? <><Spinner /> Saving…</> : 'Create Business'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

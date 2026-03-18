import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const BACKEND_URL = 'http://localhost:8000';

const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
    <circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

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

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div>
      <div
        role="button" tabIndex={0}
        onClick={onChange}
        onKeyDown={e => e.key === ' ' && onChange()}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
        <div style={{
          position: 'relative', width: '38px', height: '22px', flexShrink: 0,
          borderRadius: '11px', background: checked ? '#EA5E28' : '#D1D5DB', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
            width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
          }} />
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#374151' }}>{label}</span>
      </div>
      {hint && <p style={{ margin: '4px 0 0 48px', fontSize: '11.5px', color: '#9CA3AF' }}>{hint}</p>}
    </div>
  );
}

function Divider({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 14px' }}>
      <span style={{ fontSize: '11px', fontWeight: '700', color: '#EA5E28', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
    </div>
  );
}

export default function EditBusiness() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const location  = useLocation();
  const prefilled = location.state?.business || null;

  const [saving,    setSaving]    = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [success,   setSuccess]   = useState('');
  const [errors,    setErrors]    = useState({});

  const [info, setInfo] = useState({
    name: '', legal_name: '', ntn: '', sales_tax_reg: '', phone: '', email: '', address: '',
    down_payment: '', monthly_charges: false, monthly_subscription_fee: '',
  });
  const [creds, setCreds] = useState({ business_email: '', business_password: '', confirm_password: '' });

  useEffect(() => {
    if (prefilled) {
      const isMonthly = !prefilled.is_lifetime_subscription;
      setInfo({
        name:                    prefilled.name || '',
        legal_name:              prefilled.legal_name || '',
        ntn:                     prefilled.ntn || '',
        sales_tax_reg:           prefilled.sales_tax_reg || '',
        phone:                   prefilled.phone || '',
        email:                   prefilled.email || '',
        address:                 prefilled.address || '',
        down_payment:            prefilled.down_payment != null ? String(prefilled.down_payment) : '',
        monthly_charges:         isMonthly,
        monthly_subscription_fee: isMonthly && prefilled.monthly_subscription_fee
                                    ? String(prefilled.monthly_subscription_fee) : '',
      });
    }
  }, []);

  const setI = k => e => {
    setInfo(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: '' }));
  };
  const setC = k => e => {
    setCreds(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: '' }));
  };
  const toggleMonthly = () => setInfo(f => ({ ...f, monthly_charges: !f.monthly_charges, monthly_subscription_fee: '' }));

  const validate = () => {
    const errs = {};
    if (!info.name.trim()) errs.name = 'Required.';
    if (info.email && !/\S+@\S+\.\S+/.test(info.email)) errs.email = 'Invalid email.';
    if (info.down_payment && isNaN(Number(info.down_payment))) errs.down_payment = 'Must be a number.';
    if (info.monthly_charges && !info.monthly_subscription_fee) errs.monthly_subscription_fee = 'Required when monthly charges enabled.';
    if (creds.business_email && !/\S+@\S+\.\S+/.test(creds.business_email)) errs.business_email = 'Invalid email.';
    if (creds.business_password && creds.business_password.length < 6) errs.business_password = 'At least 6 chars.';
    if (creds.business_password && creds.confirm_password !== creds.business_password) errs.confirm_password = 'Passwords do not match.';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSave = async e => {
    e.preventDefault();
    setServerErr(''); setSuccess('');
    if (!validate()) return;

    const payload = {
      ...info,
      ...(creds.business_email    ? { business_email: creds.business_email }       : {}),
      ...(creds.business_password ? { business_password: creds.business_password } : {}),
    };

    setSaving(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/businesses/${id}/update/`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Changes saved.');
        setCreds({ business_email: '', business_password: '', confirm_password: '' });
        setTimeout(() => navigate('/'), 900);
      } else { setServerErr(data.error || 'Update failed.'); }
    } catch { setServerErr('Cannot connect to server.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '36px 32px', minHeight: '100vh', fontFamily: '"Google Sans", system-ui, sans-serif' }}>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827' }}>Edit Business</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9CA3AF' }}>Update info, subscription, and login credentials</p>
        </div>

        {serverErr && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '11px 15px', marginBottom: '16px', color: '#DC2626', fontSize: '13.5px' }}>{serverErr}</div>}
        {success   && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '11px 15px', marginBottom: '16px', color: '#16A34A', fontSize: '13.5px' }}>✓ {success}</div>}

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '32px' }}>
          <form onSubmit={handleSave} noValidate>

            <Divider title="Business Info" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="name" label="Business Name" value={info.name} onChange={setI('name')} required error={errors.name} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="legal_name" label="Legal Name" value={info.legal_name} onChange={setI('legal_name')} placeholder="Optional" />
                <Field id="ntn" label="NTN" value={info.ntn} onChange={setI('ntn')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="sales_tax_reg" label="Sales Tax Reg. #" value={info.sales_tax_reg} onChange={setI('sales_tax_reg')} />
                <Field id="phone" label="Phone" type="tel" value={info.phone} onChange={setI('phone')} />
              </div>
              <Field id="email" label="Business Email" type="email" value={info.email} onChange={setI('email')} error={errors.email} />
              <Field id="address" label="Address" value={info.address} onChange={setI('address')} as="textarea" />
            </div>

            <Divider title="Subscription & Payment" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="dp" label="Payment Amount (PKR)" type="number" value={info.down_payment} onChange={setI('down_payment')} placeholder="0.00" error={errors.down_payment} hint="One-time setup / down payment" />
              <Toggle
                checked={info.monthly_charges}
                onChange={toggleMonthly}
                label="Enable Monthly Charges"
                hint="If enabled, this business will be charged a recurring monthly fee."
              />
              {info.monthly_charges && (
                <Field id="msf" label="Monthly Charges Amount (PKR)" type="number" value={info.monthly_subscription_fee} onChange={setI('monthly_subscription_fee')} placeholder="0.00" required error={errors.monthly_subscription_fee} />
              )}
            </div>

            <Divider title="Login Credentials" />
            <div style={{ background: '#FFFBF5', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 13px', marginBottom: '14px', fontSize: '12.5px', color: '#92400E' }}>
              Leave blank to keep the current credentials unchanged.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="c-email" label="New Login Email" type="email" value={creds.business_email} onChange={setC('business_email')} placeholder="new@email.com" error={errors.business_email} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field id="c-pwd" label="New Password" type="password" value={creds.business_password} onChange={setC('business_password')} placeholder="Min. 6 chars" error={errors.business_password} />
                <Field id="c-cpwd" label="Confirm Password" type="password" value={creds.confirm_password} onChange={setC('confirm_password')} error={errors.confirm_password} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button type="button" onClick={() => navigate('/')} style={{ padding: '10px 20px', background: '#F3F4F6', border: 'none', borderRadius: '9px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: '#EA5E28', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(234,94,40,0.25)' }}>
                {saving ? <><Spinner /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import { useLocation } from 'react-router-dom';

export default function PlaceholderPage() {
  const location = useLocation();
  const title = location.pathname
    .split('/')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' > ');

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1D1F', marginBottom: '8px' }}>
        {title || 'Dashboard'}
      </h1>
      <div style={{ 
        padding: '40px', 
        border: '2px dashed #F1F1F1', 
        borderRadius: '20px', 
        textAlign: 'center', 
        color: '#9A9FA5',
        background: '#fff'
      }}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          This is a placeholder for the <b>{title}</b> page.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
          Functional implementation coming soon.
        </p>
      </div>
    </div>
  );
}

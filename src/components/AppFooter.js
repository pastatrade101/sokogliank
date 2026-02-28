import './AppFooter.css';
import { Link } from 'react-router-dom';

const socialLinks = [
  { label: 'X', href: 'https://x.com' },
  { label: 'Telegram', href: 'https://t.me' },
  { label: 'Instagram', href: 'https://instagram.com' },
  { label: 'YouTube', href: 'https://youtube.com' },
  { label: 'TikTok', href: 'https://tiktok.com' },
  { label: 'WhatsApp', href: 'https://wa.me' },
];

const policyLinks = [
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Risk Disclaimer', to: '/risk-disclaimer' },
];

const AppFooter = ({ theme = 'dark' }) => {
  return (
    <footer className={`app-footer ${theme === 'light' ? 'is-light' : 'is-dark'}`}>
      <div className="app-footer-row">
        <p className="app-footer-brand">Soko Gliank</p>
        <a className="app-footer-support" href="mailto:support@mchambuzikai.app">
          support@mchambuzikai.app
        </a>
      </div>

      <div className="app-footer-links">
        <div className="app-footer-group">
          <p className="app-footer-label">Social</p>
          <div className="app-footer-pill-wrap">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                className="app-footer-pill"
                href={item.href}
                target="_blank"
                rel="noreferrer"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="app-footer-group">
          <p className="app-footer-label">Policy</p>
          <div className="app-footer-pill-wrap">
            {policyLinks.map((item) => (
              <Link key={item.label} className="app-footer-pill" to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;

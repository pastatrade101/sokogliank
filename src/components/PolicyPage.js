import { useLocation } from 'react-router-dom';
import { Breadcrumbs, Button, Card } from './ui';

const policyContent = {
  '/terms': {
    title: 'Terms & Conditions',
    updated: 'Last updated: January 16, 2026',
    points: [
      'Soko Gliank provides educational trading signals, insights, and commentary.',
      'This platform does not provide financial, investment, or trading advice.',
      'Trading involves high risk and users are fully responsible for their decisions.',
      'No guarantee of profitability, performance, or signal accuracy is provided.',
      'Premium plans, pricing, and features may change over time.',
      'Support contact: support@mchambuzikai.app',
    ],
  },
  '/privacy': {
    title: 'Privacy Policy',
    updated: 'Last updated: January 16, 2026',
    points: [
      'We store account and profile data required to operate the app experience.',
      'Signals, interactions, and preferences are used to deliver in-app functionality.',
      'Notification tokens may be stored to send relevant session and signal alerts.',
      'Payment and third-party service providers may process data per their policies.',
      'Users can request profile updates and data corrections through support.',
      'Support contact: support@mchambuzikai.app',
    ],
  },
  '/risk-disclaimer': {
    title: 'Risk Disclaimer',
    updated: 'Last updated: January 16, 2026',
    points: [
      'Trading in Forex, Crypto, and derivatives can lead to significant losses.',
      'All published content is informational and educational only.',
      'Always apply independent judgment and personal risk management.',
      'Past performance does not guarantee future outcomes.',
      'Use proper stop-loss discipline, position sizing, and capital protection.',
      'Never trade funds you cannot afford to lose.',
    ],
  },
};

const PolicyPage = () => {
  const { pathname } = useLocation();
  const content = policyContent[pathname] ?? policyContent['/terms'];

  return (
    <main className="policy-wrap">
      <Card className="policy-card" title={content.title} subtitle={content.updated}>
        <Breadcrumbs
          items={[
            { label: 'Policy', to: '/terms' },
            { label: content.title },
          ]}
        />
        <section className="policy-points">
          {content.points.map((point) => (
            <p key={point}>{point}</p>
          ))}
        </section>
        <div className="quick-actions">
          <Button to="/" variant="secondary">Back Home</Button>
          <Button to="/signals" variant="primary">Open Signals</Button>
        </div>
      </Card>
    </main>
  );
};

export default PolicyPage;

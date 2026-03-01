import { Link, useLocation } from 'react-router-dom';
import { Breadcrumbs, Button, Card } from './ui';

const policyContent = {
  '/agreement': {
    title: 'User Agreement',
    updated: 'Last updated: March 1, 2026',
    intro: 'This agreement governs your access to the Soko Gliank platform, premium tools, and member workspace features.',
    sections: [
      {
        heading: 'Account Access',
        points: [
          'You are responsible for keeping your account credentials secure and for all activity under your account.',
          'Providing false identity, payment, or profile information can lead to account restriction or removal.',
          'We may suspend access where fraud, abuse, unauthorized sharing, or misuse is detected.',
        ],
      },
      {
        heading: 'Platform Usage',
        points: [
          'Signals, trader tips, sessions, and analysis are provided for informational and educational use only.',
          'You must not reproduce, resell, scrape, or redistribute protected platform content without permission.',
          'You agree not to use the platform for harassment, spam, manipulation, or unlawful activity.',
        ],
      },
      {
        heading: 'Membership and Billing',
        points: [
          'Premium access is activated according to the purchased plan duration and current billing status.',
          'Failed or reversed payments may cause delayed activation, suspension, or cancellation of premium features.',
          'Feature availability, plan pricing, and entitlement rules may change as the platform evolves.',
        ],
      },
    ],
  },
  '/terms': {
    title: 'Terms & Conditions',
    updated: 'Last updated: March 1, 2026',
    intro: 'These terms define how Soko Gliank services, subscriptions, and content are offered and used.',
    sections: [
      {
        heading: 'Service Scope',
        points: [
          'Soko Gliank provides trading signals, market commentary, testimonials, analytics, and premium workspace tools.',
          'Nothing published in the app constitutes personal financial, investment, or legal advice.',
          'We may update, suspend, or remove features where needed for security, compliance, or product changes.',
        ],
      },
      {
        heading: 'User Responsibilities',
        points: [
          'You remain fully responsible for your trading decisions, execution, and risk management.',
          'You must comply with applicable laws, regulations, and market conduct rules in your jurisdiction.',
          'Abusive, fraudulent, or disruptive behavior may result in account enforcement action.',
        ],
      },
      {
        heading: 'Liability Limits',
        points: [
          'We do not guarantee profitability, signal accuracy, uninterrupted availability, or specific trading outcomes.',
          'Losses arising from market conditions, execution delay, payment issues, or third-party services remain your responsibility.',
          'Support contact: support@mchambuzikai.app',
        ],
      },
    ],
  },
  '/privacy': {
    title: 'Privacy Policy',
    updated: 'Last updated: March 1, 2026',
    intro: 'This policy explains what information we collect, how it is used, and how it supports account, payment, and notification flows.',
    sections: [
      {
        heading: 'Information We Collect',
        points: [
          'We may store your account details, profile attributes, membership state, device session data, and activity logs needed to run the app.',
          'Notification tokens and communication preferences may be stored to deliver platform alerts and account messages.',
          'Payment-related records can include transaction references, plan selections, and order status information.',
        ],
      },
      {
        heading: 'How Data Is Used',
        points: [
          'Your data is used to authenticate access, personalize the workspace, deliver premium entitlements, and improve support operations.',
          'Analytics and operational records may be reviewed to prevent fraud, debug issues, and monitor service quality.',
          'Third-party providers may process limited data according to their own legal and privacy obligations.',
        ],
      },
      {
        heading: 'Your Rights',
        points: [
          'You may request correction of inaccurate profile information through support.',
          'You may contact us regarding account access, retained data, or notification preferences.',
          'Support contact: support@mchambuzikai.app',
        ],
      },
    ],
  },
  '/risk-disclaimer': {
    title: 'Risk Disclaimer',
    updated: 'Last updated: March 1, 2026',
    intro: 'Trading carries material financial risk. This disclaimer sets the risk baseline for all platform use.',
    sections: [
      {
        heading: 'Market Risk',
        points: [
          'Trading in Forex, Crypto, commodities, and derivatives can result in rapid and substantial losses.',
          'Market conditions can change without warning, including slippage, volatility spikes, and liquidity gaps.',
          'Past signal outcomes do not guarantee future performance.',
        ],
      },
      {
        heading: 'Execution Risk',
        points: [
          'Signals may be delayed, missed, or executed at different prices depending on your broker, device, and network conditions.',
          'Always apply your own stop-loss discipline, position sizing, and capital protection strategy.',
          'Never trade with funds you cannot afford to lose.',
        ],
      },
      {
        heading: 'Decision Responsibility',
        points: [
          'All trading decisions remain your sole responsibility.',
          'You should seek independent professional advice where needed before taking financial action.',
        ],
      },
    ],
  },
};

const policyTabs = [
  { label: 'Agreement', to: '/agreement' },
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Risk', to: '/risk-disclaimer' },
];

const PolicyPage = () => {
  const { pathname } = useLocation();
  const content = policyContent[pathname] ?? policyContent['/terms'];

  return (
    <main className="policy-wrap">
      <Card className="policy-card" title={content.title} subtitle={content.updated}>
        <Breadcrumbs
          items={[
            { label: 'Legal', to: '/agreement' },
            { label: content.title },
          ]}
        />
        <div className="policy-tabs" aria-label="Legal policy navigation">
          {policyTabs.map((item) => (
            <Link
              key={item.to}
              className={`policy-tab ${pathname === item.to ? 'active' : ''}`.trim()}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <p className="policy-intro">{content.intro}</p>
        <section className="policy-points">
          {content.sections.map((section) => (
            <article key={section.heading} className="policy-section">
              <h2>{section.heading}</h2>
              <div className="policy-section-points">
                {section.points.map((point) => (
                  <p key={point}>{point}</p>
                ))}
              </div>
            </article>
          ))}
        </section>
        <div className="quick-actions">
          <Button to="/auth" variant="secondary">Back to Login</Button>
          <Button to="/" variant="primary">Open App</Button>
        </div>
      </Card>
    </main>
  );
};

export default PolicyPage;

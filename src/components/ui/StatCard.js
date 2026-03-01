import Card from './Card';
import AppIcon from '../icons/AppIcon';
import { cx } from './utils';

const StatCard = ({ label, value, trend, trendDirection = 'neutral', icon = 'chart' }) => {
  return (
    <Card className="ui-stat-card" hover>
      <div className="ui-stat-card-top">
        <span className="ui-stat-card-label">{label}</span>
        <AppIcon name={icon} size={16} />
      </div>
      <div className="ui-stat-card-meta">
        <p className="ui-stat-card-value">{value}</p>
        {trend ? <span className={cx('ui-stat-trend', trendDirection)}>{trend}</span> : null}
      </div>
    </Card>
  );
};

export default StatCard;

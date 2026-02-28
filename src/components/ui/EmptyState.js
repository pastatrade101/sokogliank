import Button from './Button';
import AppIcon from '../icons/AppIcon';

const EmptyState = ({
  title = 'Nothing to show yet',
  description,
  actionLabel,
  onAction,
  actionTo,
  icon = 'sparkles',
}) => {
  return (
    <section className="ui-state" role="status">
      <AppIcon name={icon} size={20} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actionLabel ? (
        <div>
          {actionTo ? (
            <Button to={actionTo} variant="primary" size="sm">{actionLabel}</Button>
          ) : (
            <Button onClick={onAction} variant="primary" size="sm">{actionLabel}</Button>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default EmptyState;

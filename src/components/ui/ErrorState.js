import Button from './Button';
import AppIcon from '../icons/AppIcon';

const ErrorState = ({
  title = 'Something went wrong',
  description,
  onRetry,
}) => {
  return (
    <section className="ui-state" role="alert">
      <AppIcon name="alert" size={20} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {onRetry ? (
        <div>
          <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>
        </div>
      ) : null}
    </section>
  );
};

export default ErrorState;

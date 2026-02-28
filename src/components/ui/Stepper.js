import { cx } from './utils';

const Stepper = ({ steps = [] }) => {
  return (
    <div className="ui-stepper" role="list" aria-label="Progress">
      {steps.map((step) => (
        <div
          key={step.key}
          className={cx('ui-stepper-item', step.complete ? 'complete' : '', step.active ? 'active' : '')}
          role="listitem"
        >
          <span className="ui-stepper-dot" aria-hidden="true" />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
};

export default Stepper;

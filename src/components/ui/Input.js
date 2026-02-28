import { cx } from './utils';

const Input = ({ label, id, hint, error, className = '', ...props }) => {
  return (
    <label className={cx('ui-field', className)} htmlFor={id}>
      {label ? <span className="ui-field-label">{label}</span> : null}
      <input id={id} className="ui-input" aria-invalid={Boolean(error)} {...props} />
      {hint ? <span className="ui-card-subtitle">{hint}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
};

export default Input;

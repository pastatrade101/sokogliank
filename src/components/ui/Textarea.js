import { cx } from './utils';

const Textarea = ({ label, id, hint, error, className = '', ...props }) => {
  return (
    <label className={cx('ui-field', className)} htmlFor={id}>
      {label ? <span className="ui-field-label">{label}</span> : null}
      <textarea id={id} className="ui-textarea" aria-invalid={Boolean(error)} {...props} />
      {hint ? <span className="ui-card-subtitle">{hint}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
};

export default Textarea;

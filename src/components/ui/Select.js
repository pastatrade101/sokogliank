import { cx } from './utils';

const Select = ({ label, id, options = [], hint, error, className = '', ...props }) => {
  return (
    <label className={cx('ui-field', className)} htmlFor={id}>
      {label ? <span className="ui-field-label">{label}</span> : null}
      <select id={id} className="ui-select" aria-invalid={Boolean(error)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="ui-card-subtitle">{hint}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
};

export default Select;

import { motion } from 'framer-motion';
import { motionInteractions } from '../../design/motion';
import { cx } from './utils';

const Toggle = ({
  checked,
  onChange,
  label,
  id,
  className = '',
  activeText = 'On',
  inactiveText = 'Off',
}) => {
  return (
    <motion.button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cx('ui-toggle', checked ? 'is-on' : '', className)}
      onClick={() => onChange(!checked)}
      whileHover={motionInteractions.buttonHover}
      whileTap={motionInteractions.buttonTap}
    >
      <span className="ui-toggle-content">
        {label ? <span className="ui-toggle-label">{label}</span> : null}
        <span className="ui-toggle-state">{checked ? activeText : inactiveText}</span>
      </span>
      <span className="ui-toggle-track" aria-hidden="true">
        <span className="ui-toggle-thumb" />
      </span>
    </motion.button>
  );
};

export default Toggle;

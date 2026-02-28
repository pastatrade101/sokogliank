import { motion } from 'framer-motion';
import { motionInteractions, motionVariants } from '../../design/motion';
import { cx } from './utils';

const Tabs = ({ tabs = [], activeKey, onChange, ariaLabel = 'Tabs', className = '' }) => {
  return (
    <motion.div
      className={cx('ui-tabs', className)}
      role="tablist"
      aria-label={ariaLabel}
      variants={motionVariants.card}
      initial="initial"
      animate="animate"
    >
      {tabs.map((tab) => (
        <motion.button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeKey === tab.key}
          className={cx('ui-tab', activeKey === tab.key ? 'active' : '')}
          onClick={() => onChange(tab.key)}
          whileHover={motionInteractions.buttonHover}
          whileTap={motionInteractions.buttonTap}
        >
          {tab.label}
        </motion.button>
      ))}
    </motion.div>
  );
};

export default Tabs;

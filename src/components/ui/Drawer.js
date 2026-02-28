import { AnimatePresence, motion } from 'framer-motion';
import { motionVariants } from '../../design/motion';

const Drawer = ({ open, title, children, onClose }) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="ui-modal-backdrop"
          role="presentation"
          onClick={onClose}
          variants={motionVariants.overlay}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.aside
            className="ui-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            variants={motionVariants.drawer}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="ui-modal-head">
              <h2>{title}</h2>
            </div>
            <div className="ui-modal-body">{children}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default Drawer;

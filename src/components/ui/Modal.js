import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { motionVariants } from '../../design/motion';
import Button from './Button';
import AppIcon from '../icons/AppIcon';

const Modal = ({ open, title, children, footer, onClose }) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
          <motion.div
            className="ui-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            variants={motionVariants.modal}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <header className="ui-modal-head">
              <h2>{title}</h2>
              <Button variant="ghost" iconOnly onClick={onClose} aria-label="Close modal">
                <AppIcon name="close" />
              </Button>
            </header>
            <div className="ui-modal-body">{children}</div>
            {footer ? <footer className="ui-modal-foot">{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default Modal;

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { motionVariants } from '../../design/motion';

const ToastContext = createContext({
  pushToast: () => {},
});

let nextToastId = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((toast) => {
    const id = nextToastId;
    nextToastId += 1;
    setToasts((current) => [...current, { id, type: 'info', ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, toast.durationMs ?? 2800);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-stack" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.article
              key={toast.id}
              className={`ui-toast ${toast.type}`.trim()}
              variants={motionVariants.modal}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <p className="ui-toast-title">{toast.title}</p>
              {toast.message ? <p className="ui-toast-copy">{toast.message}</p> : null}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

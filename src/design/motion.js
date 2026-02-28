import { LazyMotion, MotionConfig, domAnimation, motion } from 'framer-motion';

const EASE_SMOOTH = [0.22, 1, 0.36, 1];
const EASE_SNAPPY = [0.16, 1, 0.3, 1];

export const motionDurations = Object.freeze({
  fast: 0.2,
  base: 0.36,
  slow: 0.5,
});

export const motionVariants = Object.freeze({
  page: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.34, ease: EASE_SMOOTH },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.2, ease: EASE_SNAPPY },
    },
  },
  shell: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: motionDurations.base, ease: EASE_SMOOTH },
    },
  },
  sidebar: {
    initial: { opacity: 0, x: -18 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.42, ease: EASE_SMOOTH },
    },
  },
  topbar: {
    initial: { opacity: 0, y: -10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.34, ease: EASE_SMOOTH },
    },
  },
  content: {
    initial: { opacity: 0, y: 14 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: motionDurations.base, ease: EASE_SMOOTH, delay: 0.06 },
    },
  },
  card: {
    initial: { opacity: 0, y: 8 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28, ease: EASE_SMOOTH },
    },
  },
  list: {
    initial: {},
    animate: {
      transition: {
        delayChildren: 0.03,
        staggerChildren: 0.035,
      },
    },
  },
  listItem: {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.24, ease: EASE_SMOOTH },
    },
  },
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_SNAPPY } },
    exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_SNAPPY } },
  },
  modal: {
    initial: { opacity: 0, y: 14, scale: 0.99 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.24, ease: EASE_SMOOTH },
    },
    exit: {
      opacity: 0,
      y: 10,
      scale: 0.992,
      transition: { duration: 0.16, ease: EASE_SNAPPY },
    },
  },
  drawer: {
    initial: { opacity: 0, x: 32 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.28, ease: EASE_SMOOTH },
    },
    exit: {
      opacity: 0,
      x: 24,
      transition: { duration: 0.18, ease: EASE_SNAPPY },
    },
  },
});

export const motionInteractions = Object.freeze({
  buttonHover: {
    y: -1,
    scale: 1.006,
    transition: { duration: 0.18, ease: EASE_SMOOTH },
  },
  buttonTap: {
    scale: 0.992,
    transition: { duration: 0.1, ease: EASE_SNAPPY },
  },
  cardHover: {
    y: -2.5,
    scale: 1.006,
    transition: { duration: 0.2, ease: EASE_SMOOTH },
  },
});

const defaultTransition = { duration: motionDurations.base, ease: EASE_SMOOTH };

export const MotionProvider = ({ children }) => (
  <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion="user" transition={defaultTransition}>
      {children}
    </MotionConfig>
  </LazyMotion>
);

export const MotionPage = ({ children, className = '' }) => (
  <motion.div className={className} variants={motionVariants.page} initial="initial" animate="animate" exit="exit">
    {children}
  </motion.div>
);

import { motion } from 'framer-motion';
import { motionInteractions, motionVariants } from '../../design/motion';
import { cx } from './utils';

const Card = ({
  title,
  subtitle,
  children,
  footer,
  className = '',
  hover = false,
  headRight = null,
}) => {
  return (
    <motion.section
      className={cx('ui-card', hover ? 'ui-card-hover' : '', className)}
      variants={motionVariants.card}
      initial="initial"
      animate="animate"
      whileHover={hover ? motionInteractions.cardHover : undefined}
      layout
    >
      {title || subtitle || headRight ? (
        <header className="ui-card-head">
          <div>
            {title ? <h2 className="ui-card-title">{title}</h2> : null}
            {subtitle ? <p className="ui-card-subtitle">{subtitle}</p> : null}
          </div>
          {headRight}
        </header>
      ) : null}
      <div className="ui-card-body">{children}</div>
      {footer ? <footer className="ui-card-foot">{footer}</footer> : null}
    </motion.section>
  );
};

export default Card;

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { motionInteractions } from '../../design/motion';
import { cx } from './utils';

const MotionLink = motion.create ? motion.create(Link) : motion(Link);

const Button = ({
  children,
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className = '',
  to,
  type = 'button',
  ...props
}) => {
  const classNames = cx(
    'ui-button',
    variant,
    size === 'sm' ? 'sm' : '',
    iconOnly ? 'icon-only' : '',
    className,
  );
  const interactionProps = props.disabled
    ? {}
    : {
      whileHover: motionInteractions.buttonHover,
      whileTap: motionInteractions.buttonTap,
    };

  if (to) {
    return (
      <MotionLink className={classNames} to={to} {...interactionProps} {...props}>
        {children}
      </MotionLink>
    );
  }

  return (
    <motion.button className={classNames} type={type} {...interactionProps} {...props}>
      {children}
    </motion.button>
  );
};

export default Button;

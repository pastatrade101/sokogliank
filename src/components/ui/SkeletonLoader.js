import { cx } from './utils';

const sizeMap = {
  sm: 'h-sm',
  md: 'h-md',
  lg: 'h-lg',
  xl: 'h-xl',
};

const SkeletonLoader = ({ size = 'md', className = '' }) => (
  <div className={cx('ui-skeleton', sizeMap[size] || sizeMap.md, className)} aria-hidden="true" />
);

export default SkeletonLoader;

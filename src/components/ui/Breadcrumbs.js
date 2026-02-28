import { Link } from 'react-router-dom';

const Breadcrumbs = ({ items = [] }) => {
  return (
    <nav className="ui-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="ui-breadcrumb-item">
          {item.to ? <Link className="ui-breadcrumb-link" to={item.to}>{item.label}</Link> : item.label}
          {index < items.length - 1 ? (
            <span className="ui-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          ) : null}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;

const FiltersPanel = ({ title = 'Filters', children, actions }) => {
  return (
    <section className="ui-filters-panel">
      <div className="ui-filters-head">
        <h2 className="ui-card-title">{title}</h2>
        {actions || null}
      </div>
      {children}
    </section>
  );
};

export default FiltersPanel;

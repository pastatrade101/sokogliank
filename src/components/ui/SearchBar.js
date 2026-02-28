import AppIcon from '../icons/AppIcon';

const SearchBar = ({ value, onChange, placeholder = 'Search...' }) => {
  const hasValue = String(value ?? '').trim().length > 0;

  return (
    <label className={`ui-search ${hasValue ? 'is-expanded' : ''}`.trim()} htmlFor="search-input">
      <AppIcon name="search" size={16} />
      <input
        id="search-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
};

export default SearchBar;

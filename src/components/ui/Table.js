import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { motionVariants } from '../../design/motion';
import Button from './Button';
import AppIcon from '../icons/AppIcon';

const DEFAULT_PAGE_SIZE = 8;

const Table = ({
  columns,
  rows,
  getRowId,
  pageSize = DEFAULT_PAGE_SIZE,
  onRowClick,
  emptyContent = 'No records found.',
}) => {
  const [sortState, setSortState] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sortState.key) {
      return rows;
    }
    const targetColumn = columns.find((column) => column.key === sortState.key);
    if (!targetColumn) {
      return rows;
    }
    const accessor = targetColumn.sortValue || ((row) => row[sortState.key]);
    return [...rows].sort((a, b) => {
      const aValue = accessor(a);
      const bValue = accessor(b);
      if (aValue === bValue) {
        return 0;
      }
      if (aValue === null || aValue === undefined) {
        return 1;
      }
      if (bValue === null || bValue === undefined) {
        return -1;
      }
      if (aValue > bValue) {
        return sortState.direction === 'asc' ? 1 : -1;
      }
      return sortState.direction === 'asc' ? -1 : 1;
    });
  }, [columns, rows, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const boundedPage = Math.min(page, totalPages);
  const start = (boundedPage - 1) * pageSize;
  const end = start + pageSize;
  const visibleRows = sortedRows.slice(start, end);

  const handleSort = (column) => {
    if (!column.sortable) {
      return;
    }
    setPage(1);
    setSortState((current) => {
      if (current.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }
      return {
        key: column.key,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  return (
    <div>
      <motion.div
        className="ui-table-wrap"
        role="region"
        aria-live="polite"
        variants={motionVariants.card}
        initial="initial"
        animate="animate"
      >
        <table className="ui-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  {column.sortable ? (
                    <button
                      type="button"
                      className="ui-table-sort"
                      onClick={() => handleSort(column)}
                    >
                      {column.label}
                      {sortState.key === column.key ? (
                        <AppIcon name={sortState.direction === 'asc' ? 'arrowUp' : 'arrowDown'} size={14} />
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={motionVariants.list} initial="initial" animate="animate">
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <motion.tr
                  key={getRowId(row)}
                  className={onRowClick ? 'ui-table-row-hover' : ''}
                  variants={motionVariants.listItem}
                  layout
                  onClick={() => {
                    if (onRowClick) {
                      onRowClick(row);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td key={`${getRowId(row)}-${column.key}`}>
                      {column.render ? column.render(row) : row[column.key] ?? '--'}
                    </td>
                  ))}
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>{emptyContent}</td>
              </tr>
            )}
          </motion.tbody>
        </table>
      </motion.div>

      <div className="ui-table-pagination">
        <span>
          Showing {visibleRows.length === 0 ? 0 : start + 1}-{Math.min(end, sortedRows.length)} of {sortedRows.length}
        </span>
        <div className="quick-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={boundedPage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span>
            Page {boundedPage} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={boundedPage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Table;

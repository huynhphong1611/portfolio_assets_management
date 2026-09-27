import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Dense, sortable report table.
 *
 * columns: [{ key, label, align: 'left'|'right'|'center', render(row), sortValue(row),
 *             width, className, footer(rows) → node, title }]
 * groupBy: row → group key (renders collapsible group headers with subtotals from column.footer)
 */
export default function DataTable({
  columns = [], rows = [], rowKey, defaultSort = null, groupBy = null, groupLabel = null,
  groupOrder = null, onRowClick, selectedKey = null, emptyText = 'Không có dữ liệu',
  footer = true, className = '', rowClassName, stickyHeader = true, maxHeight = null,
}) {
  const [sort, setSort] = useState(defaultSort);
  const [collapsed, setCollapsed] = useState({});

  const getKey = (row, i) => (rowKey ? rowKey(row, i) : i);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return rows;
    const val = (r) => (col.sortValue ? col.sortValue(r) : r[col.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'vi') * dir;
    });
  }, [rows, sort, columns]);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    for (const r of sorted) {
      const k = groupBy(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    let keys = Array.from(map.keys());
    if (groupOrder) {
      keys.sort((a, b) => {
        const ia = groupOrder.indexOf(a), ib = groupOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return keys.map(k => ({ key: k, rows: map.get(k) }));
  }, [sorted, groupBy, groupOrder]);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    setSort(prev => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: col.align === 'right' ? 'desc' : 'asc' };
      return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderCell = (col, row) => (col.render ? col.render(row) : row[col.key]);

  const renderRow = (row, i) => {
    const k = getKey(row, i);
    const cls = [
      'pp-tr',
      onRowClick ? 'pp-tr--clickable' : '',
      selectedKey !== null && selectedKey === k ? 'pp-tr--selected' : '',
      rowClassName ? rowClassName(row) : '',
    ].join(' ');
    return (
      <tr key={k} className={cls} onClick={onRowClick ? () => onRowClick(row) : undefined}>
        {columns.map(col => (
          <td key={col.key} className={`pp-td pp-td--${col.align || 'left'} ${col.className || ''}`} title={col.cellTitle ? col.cellTitle(row) : undefined}>
            {renderCell(col, row)}
          </td>
        ))}
      </tr>
    );
  };

  const renderFooter = (subset, label, isGroup) => {
    if (!columns.some(c => c.footer)) return null;
    return (
      <tr className={isGroup ? 'pp-tr-subtotal' : 'pp-tr-total'}>
        {columns.map((col, idx) => (
          <td key={col.key} className={`pp-td pp-td--${col.align || 'left'}`}>
            {col.footer ? col.footer(subset) : (idx === 0 ? label : '')}
          </td>
        ))}
      </tr>
    );
  };

  const hasRows = rows.length > 0;
  // Group header: label spans the leading columns that have no footer,
  // the remaining cells show the group's totals (Portfolio Performance style).
  const firstFooterIdx = columns.findIndex((c, i) => i > 0 && c.footer);
  const labelSpan = firstFooterIdx === -1 ? columns.length : firstFooterIdx;

  return (
    <div className={`pp-table-wrap ${className}`} style={maxHeight ? { maxHeight, overflow: 'auto' } : undefined}>
      <table className="pp-table">
        <thead className={stickyHeader ? 'pp-thead--sticky' : ''}>
          <tr>
            {columns.map(col => {
              const active = sort && sort.key === col.key;
              const sortable = col.sortable !== false;
              return (
                <th
                  key={col.key}
                  className={`pp-th pp-th--${col.align || 'left'} ${sortable ? 'pp-th--sortable' : ''} ${active ? 'pp-th--active' : ''}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  onClick={sortable ? () => toggleSort(col) : undefined}
                  title={col.title || ''}
                >
                  <span className="pp-th-inner">
                    {col.label}
                    {sortable && (
                      active ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="pp-th-sort-idle" />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {!hasRows && (
            <tr><td className="pp-td pp-td--empty" colSpan={columns.length}>{emptyText}</td></tr>
          )}
          {hasRows && !groups && sorted.map(renderRow)}
          {hasRows && groups && groups.map(g => {
            const isCollapsed = !!collapsed[g.key];
            return (
              <React.Fragment key={g.key}>
                <tr className="pp-tr-group" onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}>
                  <td className="pp-td" colSpan={labelSpan}>
                    <span className="pp-group-toggle">
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <strong>{groupLabel ? groupLabel(g.key, g.rows) : g.key}</strong>
                      <span className="pp-group-count">{g.rows.length}</span>
                    </span>
                  </td>
                  {columns.slice(labelSpan).map(col => (
                    <td key={col.key} className={`pp-td pp-td--${col.align || 'left'}`}>
                      {col.footer && col.groupFooter !== false ? col.footer(g.rows) : ''}
                    </td>
                  ))}
                </tr>
                {!isCollapsed && g.rows.map(renderRow)}
              </React.Fragment>
            );
          })}
        </tbody>
        {hasRows && footer && (
          <tfoot>{renderFooter(sorted, 'Tổng cộng', false)}</tfoot>
        )}
      </table>
    </div>
  );
}

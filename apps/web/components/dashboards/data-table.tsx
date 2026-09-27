import type { ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
};

export function DataTable<Row>({
  label,
  rows,
  columns,
  rowKey,
}: {
  label: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
}) {
  if (rows.length === 0) {
    return <p className="dashboard-table-empty">No records to show yet.</p>;
  }

  return (
    <div className="dashboard-table-scroll">
      <table className="dashboard-table" aria-label={label}>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

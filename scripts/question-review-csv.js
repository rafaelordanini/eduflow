const COLUMNS = ['id', 'source', 'year', 'subject', 'topic', 'enunciado', 'opcoes', 'gabarito', 'explicacao', 'created_at'];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stringifyCsv(rows) {
  return `${COLUMNS.join(',')}\n${rows.map(row => COLUMNS.map(column => csvCell(row[column])).join(',')).join('\n')}\n`;
}

module.exports = { COLUMNS, csvCell, stringifyCsv };

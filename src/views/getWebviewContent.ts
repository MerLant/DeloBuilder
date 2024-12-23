import { TableDefinition } from '../types';

/**
 * Функция для генерации HTML-контента веб-вью с улучшенным стилем таблицы
 * @param dbStructure Массив определений таблиц базы данных
 * @returns Строка HTML-контента
 */
export function getWebviewContent(dbStructure: TableDefinition[]): string {
  const tablesHtml = dbStructure
    .map(
      (table) => `
        <vscode-collapsible>
          <vscode-collapsible-header class="table-header">
            <span class="table-title">${table.name}</span>
            <span class="column-count">(${table.columns.length} колонок)</span>
          </vscode-collapsible-header>
          <vscode-collapsible-content>
            <vscode-data-grid grid-template-columns="1fr 1fr 1fr 1fr 1fr 1fr 2fr" aria-label="Структура таблицы ${
              table.name
            }">
              <vscode-data-grid-row row-type="header" class="data-grid-header">
                <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Название столбца</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Тип</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Nullable</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="4">Unique</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="5">Primary</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="6">Default</vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="7">Связи</vscode-data-grid-cell>
              </vscode-data-grid-row>
              ${table.columns
                .map(
                  (column, index) => `
                    <vscode-data-grid-row class="data-grid-row ${
                      index % 2 === 0 ? 'even' : 'odd'
                    }">
                      <vscode-data-grid-cell grid-column="1">${escapeHtml(
                        column.name,
                      )}</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="2">${escapeHtml(
                        column.type,
                      )}</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="3">${
                        column.nullable ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="4">${
                        column.unique ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="5">${
                        column.primary ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="6">${escapeHtml(
                        column.default || '',
                      )}</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="7">${
                        column.references
                          ? `Таблица: ${escapeHtml(
                              column.references.table,
                            )}, Колонка: ${escapeHtml(
                              column.references.column || 'id',
                            )}`
                          : ''
                      }</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                  `,
                )
                .join('')}
            </vscode-data-grid>
          </vscode-collapsible-content>
        </vscode-collapsible>
      `,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Структура базы данных Laravel</title>
      <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js"></script>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }

        h1 {
          color: var(--vscode-titleBar-activeForeground);
          margin-bottom: 20px;
          text-align: center;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          font-size: 1.2em;
          border-bottom: 1px solid var(--vscode-editorIndentGuide-activeBackground);
        }

        .table-title {
          font-weight: bold;
        }

        .column-count {
          font-size: 0.9em;
          color: var(--vscode-editorWidget-border);
        }

        vscode-data-grid {
          border: 1px solid var(--vscode-editorWidget-border);
          border-radius: 4px;
          overflow: hidden;
          box-shadow: var(--vscode-shadow);
        }

        .data-grid-header {
          background-color: var(--vscode-list-activeSelectionBackground);
          color: var(--vscode-list-activeSelectionForeground);
          font-weight: bold;
          text-align: center;
        }

        .data-grid-row.even {
          background-color: var(--vscode-editor-background);
        }

        .data-grid-row.odd {
          background-color: var(--vscode-editorWidget-background);
        }

        vscode-data-grid-cell {
          padding: 8px;
          border-bottom: 1px solid var(--vscode-editorWidget-border);
        }

        vscode-collapsible {
          margin-bottom: 20px;
        }

        /* Адаптивность */
        @media (max-width: 768px) {
          vscode-data-grid {
            grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 2fr;
          }
        }
      </style>
    </head>
    <body>
      <h1>Структура базы данных Laravel</h1>
      ${tablesHtml}
    </body>
    </html>
  `;
}

/**
 * Функция для экранирования специальных символов в HTML
 * @param str Строка для экранирования
 * @returns Экранированная строка
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

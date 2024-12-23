import * as vscode from 'vscode';
import { parseMigrations, TableDefinition } from './migrationParser';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'laravelui.showDatabaseStructure',
    async () => {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Рабочее пространство не открыто.');
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      let migrationsPath = '';
      if (workspaceFolders && workspaceFolders.length > 0) {
        const firstFolderPath = workspaceFolders[0].uri.fsPath;
        migrationsPath = `${firstFolderPath}/database/migrations`;
      } else {
        vscode.window.showErrorMessage('Рабочая папка не открыта');
        return;
      }

      try {
        const dbStructure = await parseMigrations(migrationsPath);
        const panel = vscode.window.createWebviewPanel(
          'laraveluiDatabaseStructure',
          'Структура базы данных Laravel',
          vscode.ViewColumn.One,
          { enableScripts: true },
        );

        panel.webview.html = getWebviewContent(dbStructure);
      } catch (error) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage(
            'Ошибка при парсинге миграций: ' + error.message,
          );
        } else {
          vscode.window.showErrorMessage(
            'Неизвестная ошибка при парсинге миграций.',
          );
        }
      }
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}

// Функция для генерации HTML-контента для webview
function getWebviewContent(dbStructure: TableDefinition[]): string {
  const tablesHtml = dbStructure
    .map(
      (table) => `
        <vscode-collapsible>
          <vscode-collapsible-header>${table.name}</vscode-collapsible-header>
          <vscode-collapsible-content>
            <vscode-data-grid grid-template-columns="1fr 1fr 1fr 1fr 1fr 1fr 1fr">
              <vscode-data-grid-row row-type="header">
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
                  (column) => `
                    <vscode-data-grid-row>
                      <vscode-data-grid-cell grid-column="1">${
                        column.name
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="2">${
                        column.type
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="3">${
                        column.nullable ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="4">${
                        column.unique ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="5">${
                        column.primary ? 'Да' : 'Нет'
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="6">${
                        column.default || ''
                      }</vscode-data-grid-cell>
                      <vscode-data-grid-cell grid-column="7">${
                        column.references
                          ? `Таблица: ${column.references.table}, Колонка: ${
                              column.references.column || 'id'
                            }`
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
        body { font-family: var(--vscode-font-family); padding: 20px; }
        vscode-data-grid { width: 100%; margin-bottom: 20px; }
        vscode-collapsible { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <h1>Структура базы данных Laravel</h1>
      ${tablesHtml}
    </body>
    </html>
  `;
}

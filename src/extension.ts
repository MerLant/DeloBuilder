import * as vscode from 'vscode';
import { parseMigrations, TableDefinition } from './migrationParser'; // Импортируйте ваш парсер миграций и определение таблицы

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'laravelui.showDatabaseStructure',
    async () => {
      // Проверяем, открыто ли рабочее пространство
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Рабочее пространство не открыто.');
        return;
      }

      // Получаем путь к первой папке в рабочем пространстве
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let migrationsPath = '';
      if (workspaceFolders && workspaceFolders.length > 0) {
        const firstFolderPath = workspaceFolders[0].uri.fsPath;
        migrationsPath = `${firstFolderPath}/database/migrations`;
      } else {
        vscode.window.showErrorMessage('Рабочая папка не открыта');
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
    <h2>Таблица: ${table.name}</h2>
    <table>
      <tr>
        <th>Название столбца</th>
        <th>Тип</th>
        <th>Nullable</th>
        <th>Unique</th>
        <th>Primary</th>
        <th>Default</th>
        <th>Связи</th>
      </tr>
      ${table.columns
        .map(
          (column) => `
        <tr>
          <td>${column.name}</td>
          <td>${column.type}</td>
          <td>${column.nullable ? 'Да' : 'Нет'}</td>
          <td>${column.unique ? 'Да' : 'Нет'}</td>
          <td>${column.primary ? 'Да' : 'Нет'}</td>
          <td>${column.default || ''}</td>
          <td>${
            column.references
              ? `Таблица: ${column.references.table}, Колонка: ${
                  column.references.column || 'id'
                }`
              : ''
          }</td>
        </tr>
      `,
        )
        .join('')}
    </table>
  `,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Структура базы данных Laravel</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
      </style>
    </head>
    <body>
      <h1>Структура базы данных Laravel</h1>
      ${tablesHtml}
    </body>
    </html>
  `;
}

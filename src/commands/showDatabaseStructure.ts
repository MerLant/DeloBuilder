import * as vscode from 'vscode';
import { parseMigrations } from '../parsers/migrationParser';
import { getWebviewContent } from '../views/getWebviewContent';
import { getMigrationsPath } from '../utils/helper';
import { TableDefinition } from '../types';

export function registerShowDatabaseStructureCommand(
  context: vscode.ExtensionContext,
) {
  const disposable = vscode.commands.registerCommand(
    'laravelui.showDatabaseStructure',
    async () => {
      const migrationsPath = getMigrationsPath();
      if (!migrationsPath) {
        vscode.window.showErrorMessage(
          'Не удалось определить путь к миграциям.',
        );
        return;
      }

      try {
        const dbStructure: TableDefinition[] = await parseMigrations(
          migrationsPath,
        );
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

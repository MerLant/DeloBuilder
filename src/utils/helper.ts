import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Функция для получения пути к директории миграций Laravel
 */
export function getMigrationsPath(): string | null {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage('Рабочее пространство не открыто.');
    return null;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Рабочая папка не открыта.');
    return null;
  }

  const firstFolderPath = workspaceFolders[0].uri.fsPath;
  const migrationsPath = path.join(firstFolderPath, 'database', 'migrations');

  if (!fs.existsSync(migrationsPath)) {
    vscode.window.showErrorMessage(
      'Папка миграций не найдена: ' + migrationsPath,
    );
    return null;
  }

  return migrationsPath;
}

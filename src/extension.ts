import * as vscode from 'vscode';
import { registerShowDatabaseStructureCommand } from './commands/showDatabaseStructure';

export function activate(context: vscode.ExtensionContext) {
  // Регистрация команды для показа структуры базы данных
  registerShowDatabaseStructureCommand(context);
}

export function deactivate() {}

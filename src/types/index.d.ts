// src/types/index.d.ts

/**
 * Тип определения внешнего ключа
 */
export interface ForeignKey {
  table: string;
  column: string;
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Тип определения колонки таблицы
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  primary?: boolean;
  default?: string;
  references?: ForeignKey;
}

/**
 * Тип определения таблицы
 */
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

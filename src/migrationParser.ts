import * as fs from 'fs';
import * as path from 'path';

/**
 * Описание одного столбца таблицы
 */
interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  primary?: boolean;
  default?: string;
  references?: {
    table: string;
    column: string; // Обычно "id"
    onDelete?: string;
    onUpdate?: string;
  };
}

/**
 * Описание структуры одной таблицы
 */
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

/**
 * Хранилище всех таблиц.
 */
type TablesMap = Record<string, TableDefinition>;

/**
 * Рекурсивно получаем список всех php-файлов из указанной директории
 */
async function getAllPhpFiles(dir: string): Promise<string[]> {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const fullPath = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await getAllPhpFiles(fullPath)));
    } else if (dirent.isFile() && dirent.name.endsWith('.php')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Регулярки для поиска блоков Schema::create(...) и Schema::table(...)
 */
const CREATE_REGEX =
  /Schema::create\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*function\s*\(\s*Blueprint\s*\$table\s*\)\s*\{([\s\S]*?)\}\);/g;
const TABLE_REGEX =
  /Schema::table\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*function\s*\(\s*Blueprint\s*\$table\s*\)\s*\{([\s\S]*?)\}\);/g;

/**
 * Разбиваем тело вызова Schema::create(...) или Schema::table(...) на отдельные строки $table->...
 */
function extractTableLines(codeBlock: string): string[] {
  // Удалим все переводы строк, чтобы многострочные цепочки стали в одну строку
  // Удаляем переносы строк, но также удаляем пробелы перед/после "->"
  const oneLine = codeBlock
    // Убираем переносы строк
    .replace(/\r?\n+/g, '')
    // Убираем лишние пробелы перед "->"
    .replace(/\s*->/g, '->');

  // Теперь порежем по ";" и выберем только строки, где реально есть $table->
  return oneLine
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.includes('$table->'));
}

/**
 * Парсим строку типа: $table->dropColumn('col1', 'col2')
 */
function parseDropColumn(line: string): string[] | null {
  const match = line.match(/\$table->dropColumn\(([^)]+)\)/);
  if (!match) {
    return null;
  }

  // Внутри могут быть несколько аргументов: 'one', 'two'
  const rawArgs = match[1].trim();
  // Разделим, обрежем пробелы и снимем кавычки
  const columns = rawArgs
    .split(',')
    .map((arg) => arg.trim().replace(/^['"`]|['"`]$/g, ''));
  return columns;
}

/**
 * Парсим строку foreign: $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
 */
function parseForeignKey(line: string) {
  // Пример такой строки:
  //   $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
  // Ищем foreign('user_id') + цепочку
  const foreignMatch = line.match(
    /\$table->foreign\(['"`]([^'"`]+)['"`]\)(.*)/,
  );
  if (!foreignMatch) {
    return null;
  }

  const columnName = foreignMatch[1];
  const chain = foreignMatch[2]; // ->references('id')->on('users')->onDelete('cascade') ...

  // references(...) -> on(...)
  const refMatch = chain.match(
    /->references\(['"`]([^'"`]+)['"`]\)->on\(['"`]([^'"`]+)['"`]\)/,
  );
  const references = {
    column: '',
    table: '',
    onDelete: undefined as string | undefined,
    onUpdate: undefined as string | undefined,
  };

  if (refMatch) {
    references.column = refMatch[1];
    references.table = refMatch[2];
  }

  // onDelete(...)
  const onDeleteMatch = chain.match(/->onDelete\(['"`]([^'"`]+)['"`]\)/);
  if (onDeleteMatch) {
    references.onDelete = onDeleteMatch[1];
  }

  // onUpdate(...)
  const onUpdateMatch = chain.match(/->onUpdate\(['"`]([^'"`]+)['"`]\)/);
  if (onUpdateMatch) {
    references.onUpdate = onUpdateMatch[1];
  }

  return {
    columnName,
    references,
  };
}

/**
 * Парсим обычную колонку: $table->string('title')->nullable()->default('abc')->unique()...
 */
function parseAddOrModifyColumn(line: string): ColumnDefinition | null {
  // Пример:
  //   $table->string('name', 255)->nullable()->default('test')
  // mainMatch[1] = "string"
  // mainMatch[2] = "'name', 255"
  // mainMatch[3] = "->nullable()->default('test')"
  const mainMatch = line.match(/\$table->(\w+)\(([^)]*)\)(.*)/);
  if (!mainMatch) {
    return null;
  }

  const columnType = mainMatch[1];
  const argsString = mainMatch[2];
  const chain = mainMatch[3]; // ->nullable()->default('test')->unique() ...

  // Первый аргумент почти всегда – имя столбца
  const argList = argsString
    .split(',')
    .map((arg) => arg.trim().replace(/^['"`]|['"`]$/g, ''));

  const columnName = argList[0] || '';

  const col: ColumnDefinition = {
    name: columnName,
    type: columnType,
  };

  // Проверим цепочку
  if (chain.includes('->unique()')) {
    col.unique = true;
  }
  if (chain.includes('->nullable()')) {
    col.nullable = true;
  }
  if (chain.includes('->primary()')) {
    col.primary = true;
  }

  // ->default(...)
  const defaultMatch = chain.match(/->default\(([^)]+)\)/);
  if (defaultMatch) {
    let val = defaultMatch[1].trim();
    // Снимем возможные кавычки
    val = val.replace(/^['"`]|['"`]$/g, '');
    col.default = val;
  }

  return col;
}

/**
 * Применяем блок create (Schema::create(...))
 * Создаём таблицу заново (или перезаписываем)
 */
function applyCreateTable(
  tableName: string,
  blockBody: string,
  tables: TablesMap,
) {
  const columns: ColumnDefinition[] = [];

  const lines = extractTableLines(blockBody);

  for (const line of lines) {
    // dropColumn(...)
    if (line.includes('->dropColumn(')) {
      const dropCols = parseDropColumn(line);
      if (dropCols) {
        for (const dcol of dropCols) {
          const idx = columns.findIndex((c) => c.name === dcol);
          if (idx !== -1) {
            columns.splice(idx, 1);
          }
        }
      }
      continue;
    }

    // foreign(...)
    if (line.includes('->foreign(')) {
      const fk = parseForeignKey(line);
      if (fk) {
        // если уже есть колонка – просто добавим references
        const existingCol = columns.find((c) => c.name === fk.columnName);
        if (existingCol) {
          existingCol.references = fk.references;
        } else {
          // если колонки не было, добавим на лету
          columns.push({
            name: fk.columnName,
            type: 'unsignedBigInteger',
            references: fk.references,
          });
        }
      }
      continue;
    }

    // остальные случаи – это, скорее всего, добавление/модификация колонки
    const colDef = parseAddOrModifyColumn(line);
    if (colDef) {
      const existingCol = columns.find((c) => c.name === colDef.name);
      if (existingCol) {
        Object.assign(existingCol, colDef);
      } else {
        columns.push(colDef);
      }
    }
  }

  // Запишем в нашу структуру
  tables[tableName] = {
    name: tableName,
    columns,
  };
}

/**
 * Применяем блок alter (Schema::table(...))
 * Модифицируем уже существующую таблицу, либо создаём пустую, если её нет
 */
function applyAlterTable(
  tableName: string,
  blockBody: string,
  tables: TablesMap,
) {
  // Если таблицы нет, создадим пустую структуру
  if (!tables[tableName]) {
    tables[tableName] = { name: tableName, columns: [] };
  }

  const tableDef = tables[tableName];
  const lines = extractTableLines(blockBody);

  for (const line of lines) {
    // dropColumn(...)
    if (line.includes('->dropColumn(')) {
      const dropCols = parseDropColumn(line);
      if (dropCols) {
        for (const dcol of dropCols) {
          const idx = tableDef.columns.findIndex((c) => c.name === dcol);
          if (idx !== -1) {
            tableDef.columns.splice(idx, 1);
          }
        }
      }
      continue;
    }

    // foreign(...)
    if (line.includes('->foreign(')) {
      const fk = parseForeignKey(line);
      if (fk) {
        const existingCol = tableDef.columns.find(
          (c) => c.name === fk.columnName,
        );
        if (existingCol) {
          existingCol.references = fk.references;
        } else {
          // нет колонки – добавляем
          tableDef.columns.push({
            name: fk.columnName,
            type: 'unsignedBigInteger',
            references: fk.references,
          });
        }
      }
      continue;
    }

    // прочее – это добавление/модификация колонки
    const colDef = parseAddOrModifyColumn(line);
    if (colDef) {
      const existingCol = tableDef.columns.find((c) => c.name === colDef.name);
      if (existingCol) {
        Object.assign(existingCol, colDef);
      } else {
        tableDef.columns.push(colDef);
      }
    }
  }
}

/**
 * Основная функция, которая:
 * 1) Сканирует директорию на наличие php-файлов,
 * 2) Сортирует их (по названию) – имитируя порядок миграций,
 * 3) В каждом файле ищет блоки Schema::create(...) и Schema::table(...),
 * 4) Применяет их к общей структуре таблиц,
 * 5) Возвращает итоговую структуру (массив TableDefinition).
 */
export async function parseMigrations(
  migrationsDir: string,
): Promise<TableDefinition[]> {
  // 1) получаем все php-файлы
  const allPhpFiles = await getAllPhpFiles(migrationsDir);

  // 2) сортируем (Laravel обычно сортирует по дате/имени)
  allPhpFiles.sort();

  const tables: TablesMap = {};

  // 3) идём по каждому файлу, ищем блоки
  for (const filePath of allPhpFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Сначала достанем все create-блоки
    let match: RegExpExecArray | null;
    while ((match = CREATE_REGEX.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      applyCreateTable(tableName, body, tables);
    }

    // Потом все alter-блоки
    while ((match = TABLE_REGEX.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      applyAlterTable(tableName, body, tables);
    }
  }

  // 4) Преобразуем объект tables в массив
  const result = Object.values(tables);

  // (Опционально) вывести для проверки
  // console.log(JSON.stringify(result, null, 2));

  return result;
}

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Spreadsheet, { type CellStyle } from 'x-data-spreadsheet';
import 'x-data-spreadsheet/dist/xspreadsheet.css';

type SheetColumn = {
  header: string;
  key: string;
  width?: number;
  alignment?: 'left' | 'center' | 'right';
};

type SheetInput = {
  name?: string;
  columns?: SheetColumn[];
  rows?: Record<string, unknown>[];
  freezePanes?: { x?: number };
};

type ThemeInput = {
  headerBg?: string;
  headerText?: string;
  rowEvenBg?: string;
  rowOddBg?: string;
};

type WorkbookInput = {
  sheets?: SheetInput[];
  theme?: ThemeInput;
};

type SpreadsheetCell = {
  text: string;
  style?: number;
};

type SpreadsheetSheetData = {
  name: string;
  freeze: string;
  styles: CellStyle[];
  rows: Record<number, { cells: Record<number, SpreadsheetCell> }>;
  cols: Record<number, { width: number }> & { len: number };
};

const props = defineProps<{
  schema: WorkbookInput | null;
}>();

const hostRef = ref<HTMLElement | null>(null);
let spreadsheet: Spreadsheet | null = null;
let resizeObserver: ResizeObserver | null = null;

const DEFAULT_THEME = {
  headerBg: '#0f766e',
  headerText: '#f8fafc',
  rowEvenBg: '#ffffff',
  rowOddBg: '#f8fafc'
};

function normalizeHex(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;

  const normalized = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) return `#${normalized}`;

  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function readableColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#0f172a';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.66 ? '#0f172a' : '#f8fafc';
}

function normalizeAlign(value: unknown): 'left' | 'center' | 'right' {
  if (value === 'center' || value === 'right') return value;
  return 'left';
}

function toColumnLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function toFreezeExpression(xSplit: unknown): string {
  if (typeof xSplit !== 'number' || !Number.isFinite(xSplit) || xSplit <= 0) {
    return 'A1';
  }
  const safeSplit = Math.max(1, Math.floor(xSplit));
  return `${toColumnLabel(safeSplit)}1`;
}

function toColumnWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return 130;
  }
  return Math.max(72, Math.min(380, Math.round(width * 8.8)));
}

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    const maybeFormula = (value as { formula?: unknown }).formula;
    if (typeof maybeFormula === 'string') {
      return maybeFormula;
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return String(value);
}

function createSheetStyles(theme: ThemeInput | undefined): CellStyle[] {
  const headerBg = normalizeHex(theme?.headerBg, DEFAULT_THEME.headerBg);
  const headerText = normalizeHex(theme?.headerText, DEFAULT_THEME.headerText);
  const rowEvenBg = normalizeHex(theme?.rowEvenBg, DEFAULT_THEME.rowEvenBg);
  const rowOddBg = normalizeHex(theme?.rowOddBg, DEFAULT_THEME.rowOddBg);

  const rowEvenText = readableColor(rowEvenBg);
  const rowOddText = readableColor(rowOddBg);

  return [
    {
      bgcolor: headerBg,
      color: headerText,
      align: 'center',
      valign: 'middle',
      textwrap: true,
      font: { bold: true }
    },
    { bgcolor: rowEvenBg, color: rowEvenText, align: 'left', valign: 'middle' },
    { bgcolor: rowEvenBg, color: rowEvenText, align: 'center', valign: 'middle' },
    { bgcolor: rowEvenBg, color: rowEvenText, align: 'right', valign: 'middle' },
    { bgcolor: rowOddBg, color: rowOddText, align: 'left', valign: 'middle' },
    { bgcolor: rowOddBg, color: rowOddText, align: 'center', valign: 'middle' },
    { bgcolor: rowOddBg, color: rowOddText, align: 'right', valign: 'middle' }
  ];
}

function styleIndex(rowIdx: number, align: 'left' | 'center' | 'right'): number {
  const alignOffset = align === 'center' ? 1 : align === 'right' ? 2 : 0;
  const base = rowIdx % 2 === 0 ? 1 : 4;
  return base + alignOffset;
}

function toSpreadsheetSheetData(sheet: SheetInput, idx: number, theme: ThemeInput | undefined): SpreadsheetSheetData {
  const columns = sheet.columns || [];
  const rows = sheet.rows || [];
  const styles = createSheetStyles(theme);

  const colsData: SpreadsheetSheetData['cols'] = { len: columns.length };
  columns.forEach((column, ci) => {
    colsData[ci] = { width: toColumnWidth(column.width) };
  });

  const rowsData: SpreadsheetSheetData['rows'] = {};
  const headerCells: Record<number, SpreadsheetCell> = {};

  columns.forEach((column, ci) => {
    headerCells[ci] = { text: column.header || `Coluna ${ci + 1}`, style: 0 };
  });
  rowsData[0] = { cells: headerCells };

  rows.forEach((row, ri) => {
    const dataCells: Record<number, SpreadsheetCell> = {};
    columns.forEach((column, ci) => {
      const align = normalizeAlign(column.alignment);
      dataCells[ci] = {
        text: stringifyCellValue(row?.[column.key]),
        style: styleIndex(ri, align)
      };
    });
    rowsData[ri + 1] = { cells: dataCells };
  });

  return {
    name: sheet.name || `Planilha ${idx + 1}`,
    freeze: toFreezeExpression(sheet.freezePanes?.x),
    styles,
    rows: rowsData,
    cols: colsData
  };
}

function toSpreadsheetData(schema: WorkbookInput | null): SpreadsheetSheetData[] {
  const sheets = schema?.sheets || [];
  if (sheets.length === 0) {
    return [
      {
        name: 'Planilha',
        freeze: 'A1',
        styles: createSheetStyles(schema?.theme),
        rows: { 0: { cells: { 0: { text: 'Sem dados para exibir', style: 0 } } } },
        cols: { len: 1, 0: { width: 260 } }
      }
    ];
  }

  return sheets.map((sheet, index) => toSpreadsheetSheetData(sheet, index, schema?.theme));
}

function renderSpreadsheet() {
  const host = hostRef.value;
  if (!host) return;

  if (!spreadsheet) {
    spreadsheet = new Spreadsheet(host, {
      mode: 'read',
      showToolbar: false,
      showGrid: true,
      showContextmenu: false,
      showBottomBar: true,
      row: { len: 500, height: 28 },
      col: { len: 26, width: 120, indexWidth: 56, minWidth: 70 },
      view: {
        width: () => Math.max(320, host.clientWidth),
        height: () => Math.max(320, host.clientHeight)
      }
    });
  }

  spreadsheet.loadData(toSpreadsheetData(props.schema));
  (spreadsheet as any).reRender?.();
}

watch(
  () => props.schema,
  () => {
    renderSpreadsheet();
  },
  { deep: true }
);

onMounted(() => {
  renderSpreadsheet();
  if (hostRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      (spreadsheet as any)?.reRender?.();
    });
    resizeObserver.observe(hostRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (hostRef.value) {
    hostRef.value.innerHTML = '';
  }
  spreadsheet = null;
});
</script>

<template>
  <div class="excel-shell">
    <div ref="hostRef" class="excel-host"></div>
  </div>
</template>

<style scoped>
.excel-shell {
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  overflow: hidden;
  background: #f8fafc;
}

.excel-host {
  height: min(64vh, 620px);
  min-height: 340px;
}

:deep(.x-spreadsheet) {
  border: none;
}

:deep(.x-spreadsheet-bottombar) {
  border-top: 1px solid #d1d5db;
}

@media (max-width: 768px) {
  .excel-host {
    height: 460px;
    min-height: 320px;
  }
}
</style>

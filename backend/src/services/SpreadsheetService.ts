import ExcelJS from 'exceljs';

export class SpreadsheetService {
    async createWorkbook(schema: any): Promise<ExcelJS.Workbook> {
        const workbook = new ExcelJS.Workbook();
        const theme = this.parseTheme(schema.theme);
        const usedWorksheetNames = new Set<string>();

        for (let sheetIndex = 0; sheetIndex < schema.sheets.length; sheetIndex += 1) {
            const sheetSchema = schema.sheets[sheetIndex];
            const worksheetName = this.getSafeWorksheetName(sheetSchema.name, sheetIndex, usedWorksheetNames);
            const worksheet = workbook.addWorksheet(worksheetName);
            const cols = sheetSchema.columns;
            const headerRowNumber = sheetSchema.showTitle ? 2 : 1;

            // Define colunas
            worksheet.columns = cols.map((col: any) => ({
                header: col.header,
                key: col.key,
                width: col.width || 20,
                style: { alignment: { vertical: 'middle', horizontal: this.getHorizontalAlignment(col.alignment) } }
            }));

            // Título opcional
            if (sheetSchema.showTitle) {
                worksheet.spliceRows(1, 0, []);
                const titleCell = worksheet.getCell('A1');
                titleCell.value = schema.title;
                titleCell.font = { bold: true, size: 16, color: { argb: theme.headerText } };
                titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.headerBg } };
                titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
                worksheet.getRow(1).height = 40;
                worksheet.mergeCells(1, 1, 1, cols.length);
            }

            // Batched row addition
            const rowsToAdd = sheetSchema.rows.map((r: any) => {
                const rowObj: any = {};
                Object.keys(r).forEach(k => {
                    rowObj[k] = this.normalizeCellValue(r[k]);
                });
                return rowObj;
            });
            worksheet.addRows(rowsToAdd);

            // Estilização concentrada (Performance)
            const headerRow = worksheet.getRow(headerRowNumber);
            headerRow.height = 30;
            headerRow.eachCell(c => this.applyHeaderStyle(c, theme));

            // Estilização de dados e formatos
            worksheet.eachRow((row, rowNum) => {
                if (rowNum <= headerRowNumber) return;
                row.height = 25;
                const bgColor = rowNum % 2 === 0 ? theme.rowEvenBg : theme.rowOddBg;
                row.eachCell((cell, colNum) => {
                    this.applyDataStyle(cell, bgColor, theme.borderColor);
                    const colFormat = cols[colNum - 1]?.format || cols[colNum - 1]?.type;
                    this.applyFormatting(cell, colFormat);
                });
            });

            if (sheetSchema.autoFilter) {
                worksheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: cols.length } };
            }

            if (sheetSchema.freezePanes) {
                worksheet.views = [{ state: 'frozen', xSplit: sheetSchema.freezePanes.x || 0, ySplit: headerRowNumber }];
            }
        }
        return workbook;
    }

    private getSafeWorksheetName(rawName: unknown, sheetIndex: number, usedNames: Set<string>): string {
        const cleaned = String(rawName || '')
            .replace(/[\*\?:\\/\[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const baseName = (cleaned || `Planilha ${sheetIndex + 1}`).slice(0, 31);

        if (!usedNames.has(baseName)) {
            usedNames.add(baseName);
            return baseName;
        }

        let suffixIndex = 2;
        while (suffixIndex <= 9999) {
            const suffix = ` (${suffixIndex})`;
            const candidate = `${baseName.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
            if (!usedNames.has(candidate)) {
                usedNames.add(candidate);
                return candidate;
            }
            suffixIndex += 1;
        }

        const fallback = `Planilha ${sheetIndex + 1}`.slice(0, 31);
        usedNames.add(fallback);
        return fallback;
    }

    private parseTheme(t: any) {
        const fix = (c: string | undefined, def: string) => {
            if (!c) return def;
            let hex = c.replace('#', '');
            return hex.length === 6 ? `FF${hex}` : hex;
        };
        return {
            headerBg: fix(t?.headerBg, 'FF4F46E5'),
            headerText: fix(t?.headerText, 'FFFFFFFF'),
            rowEvenBg: fix(t?.rowEvenBg, 'FFF1F5F9'),
            rowOddBg: fix(t?.rowOddBg, 'FFFFFFFF'),
            borderColor: fix(t?.borderColor, 'FFE2E8F0')
        };
    }

    private applyHeaderStyle(cell: ExcelJS.Cell, theme: any) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.headerBg } };
        cell.font = { bold: true, color: { argb: theme.headerText } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    private applyDataStyle(cell: ExcelJS.Cell, bgColor: string, borderColor: string) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
        };
    }

    private applyFormatting(cell: ExcelJS.Cell, format: unknown) {
        const formats: any = {
            currency: '"R$ "#,##0.00',
            date: 'dd/mm/yyyy',
            percentage: '0.00%',
            number: '#,##0.00'
        };
        const normalized = typeof format === 'string' ? format.toLowerCase().trim() : '';
        if (formats[normalized]) cell.numFmt = formats[normalized];
    }

    private getHorizontalAlignment(rawAlignment: unknown): 'left' | 'center' | 'right' {
        if (rawAlignment === 'center' || rawAlignment === 'right') {
            return rawAlignment;
        }
        return 'left';
    }

    private normalizeCellValue(value: unknown): unknown {
        if (value && typeof value === 'object') {
            const maybeFormula = (value as { formula?: unknown }).formula;
            if (typeof maybeFormula === 'string' && maybeFormula.trim().length > 0) {
                return { formula: maybeFormula.trim() };
            }

            try {
                return JSON.stringify(value);
            } catch (_error) {
                return String(value);
            }
        }

        return value;
    }

    async exportToBuffer(workbook: ExcelJS.Workbook, format: 'xlsx' | 'csv'): Promise<Buffer> {
        const buffer = format === 'csv' ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}

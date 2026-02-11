import ExcelJS from 'exceljs';

export class SpreadsheetService {
    async createWorkbook(schema: any): Promise<ExcelJS.Workbook> {
        const workbook = new ExcelJS.Workbook();
        const defaultTheme = {
            headerBg: 'FF4F46E5',
            headerText: 'FFFFFFFF',
            rowEvenBg: 'FFF1F5F9',
            rowOddBg: 'FFFFFFFF',
            borderColor: 'FFE2E8F0'
        };

        const safeColor = (color: string | undefined, fallback: string) => {
            if (!color) return fallback;
            // Garante o prefixo FF para o canal Alpha do ARGB se for Hex
            const hex = color.startsWith('#') ? color.replace('#', 'FF') : `FF${color}`;
            // Validação básica de tamanho para evitar strings malformatadas
            return hex.length > 8 ? hex.substring(0, 8) : hex.padEnd(8, 'F');
        };

        const theme = {
            headerBg: safeColor(schema.theme?.headerBg, defaultTheme.headerBg),
            headerText: safeColor(schema.theme?.headerText, defaultTheme.headerText),
            rowEvenBg: safeColor(schema.theme?.rowEvenBg, defaultTheme.rowEvenBg),
            rowOddBg: safeColor(schema.theme?.rowOddBg, defaultTheme.rowOddBg),
            borderColor: safeColor(schema.theme?.borderColor, defaultTheme.borderColor)
        };

        for (const sheetSchema of schema.sheets) {
            const worksheet = workbook.addWorksheet(sheetSchema.name);

            // 1. Configurar colunas e formatos primeiro (headers vão para a linha 1 por padrão)
            worksheet.columns = sheetSchema.columns.map((col: any) => ({
                header: col.header,
                key: col.key,
                width: col.width || 20,
                style: {
                    alignment: { vertical: 'middle', horizontal: col.alignment || 'left' },
                }
            }));

            // 2. Se tiver título, inserimos uma linha no topo e mesclamos
            if (sheetSchema.showTitle) {
                worksheet.spliceRows(1, 0, []); // Insere linha vazia no topo, empurra headers para linha 2
                const lastColNum = sheetSchema.columns?.length || 1;
                const lastCol = String.fromCharCode(64 + lastColNum);
                worksheet.mergeCells(`A1:${lastCol}1`);

                const titleCell = worksheet.getCell('A1');
                titleCell.value = schema.title;
                titleCell.font = { bold: true, size: 16, color: { argb: theme.headerText } };
                titleCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: theme.headerBg }
                };
                titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
                worksheet.getRow(1).height = 40;
            }

            // 3. Configurações de View / Filtros (após saber se temos título ou não)
            const headerRowNumber = sheetSchema.showTitle ? 2 : 1;

            if (sheetSchema.freezePanes) {
                worksheet.views = [
                    {
                        state: 'frozen',
                        xSplit: sheetSchema.freezePanes.x || 0,
                        ySplit: sheetSchema.showTitle ? (sheetSchema.freezePanes.y || 2) : (sheetSchema.freezePanes.y || 1)
                    }
                ];
            }

            if (sheetSchema.autoFilter) {
                const lastColNum = sheetSchema.columns?.length || 1;
                const lastCol = String.fromCharCode(64 + lastColNum);
                worksheet.autoFilter = `A${headerRowNumber}:${lastCol}${headerRowNumber}`;
            }

            // 4. Estilizar cabeçalho
            const headerRow = worksheet.getRow(headerRowNumber);
            headerRow.height = 30;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: theme.headerBg }
                };
                cell.font = {
                    bold: true,
                    size: 11,
                    color: { argb: theme.headerText }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // Adicionar linhas tratando possíveis fórmulas
            sheetSchema.rows.forEach((rowData: any) => {
                const row = worksheet.addRow({});
                Object.keys(rowData).forEach((key) => {
                    const value = rowData[key];
                    if (value && typeof value === 'object' && value.formula) {
                        row.getCell(key).value = { formula: value.formula };
                    } else {
                        row.getCell(key).value = value;
                    }
                });
            });

            // Estilizar linhas e aplicar formatos
            worksheet.eachRow((row, rowNumber) => {
                // Pular título e cabeçalho
                if (sheetSchema.showTitle) {
                    if (rowNumber <= 2) return;
                } else {
                    if (rowNumber === 1) return;
                }

                row.height = 25;
                const isEven = rowNumber % 2 === 0;
                const bgColor = isEven ? theme.rowEvenBg : theme.rowOddBg;

                row.eachCell((cell, colNumber) => {
                    const colDef = sheetSchema.columns[colNumber - 1];

                    // Aplicar cores alternadas
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgColor }
                    };

                    // Aplicar bordas finas
                    cell.border = {
                        top: { style: 'thin', color: { argb: theme.borderColor } },
                        left: { style: 'thin', color: { argb: theme.borderColor } },
                        bottom: { style: 'thin', color: { argb: theme.borderColor } },
                        right: { style: 'thin', color: { argb: theme.borderColor } }
                    };

                    // Aplicar formatação de acordo com o tipo
                    if (colDef) {
                        switch (colDef.format) {
                            case 'currency':
                                cell.numFmt = '"R$ "#,##0.00';
                                break;
                            case 'date':
                                cell.numFmt = 'dd/mm/yyyy';
                                break;
                            case 'percentage':
                                cell.numFmt = '0.00%';
                                break;
                            case 'number':
                                cell.numFmt = '#,##0.00';
                                break;
                        }
                    }
                });
            });
        }

        return workbook;
    }

    async exportToBuffer(workbook: ExcelJS.Workbook, format: 'xlsx' | 'csv'): Promise<Buffer> {
        if (format === 'csv') {
            return await workbook.csv.writeBuffer() as any;
        }
        return await workbook.xlsx.writeBuffer() as any;
    }
}

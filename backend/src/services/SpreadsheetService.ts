import ExcelJS from 'exceljs';

export class SpreadsheetService {
    async createWorkbook(schema: any): Promise<ExcelJS.Workbook> {
        const workbook = new ExcelJS.Workbook();
        const theme = schema.theme || {
            headerBg: 'FF4F46E5',
            headerText: 'FFFFFFFF',
            rowEvenBg: 'FFF1F5F9',
            rowOddBg: 'FFFFFFFF',
            borderColor: 'FFE2E8F0'
        };

        for (const sheetSchema of schema.sheets) {
            const worksheet = workbook.addWorksheet(sheetSchema.name);

            // Configurações de View / Ações Automáticas
            if (sheetSchema.freezePanes) {
                worksheet.views = [
                    { state: 'frozen', xSplit: sheetSchema.freezePanes.x || 0, ySplit: sheetSchema.freezePanes.y || 0 }
                ];
            }

            if (sheetSchema.autoFilter) {
                const lastCol = String.fromCharCode(64 + (sheetSchema.columns?.length || 1));
                worksheet.autoFilter = `A1:${lastCol}1`;
            }

            // Configurar colunas e formatos
            worksheet.columns = sheetSchema.columns.map((col: any) => ({
                header: col.header,
                key: col.key,
                width: col.width || 20,
                style: {
                    alignment: { vertical: 'middle', horizontal: col.alignment || 'left' },
                }
            }));

            // Estilizar cabeçalho
            const headerRow = worksheet.getRow(1);
            headerRow.height = 30;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: theme.headerBg.replace('#', 'FF') }
                };
                cell.font = {
                    bold: true,
                    size: 12,
                    color: { argb: theme.headerText.replace('#', 'FF') }
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
                if (rowNumber === 1) return;

                row.height = 25;
                const isEven = rowNumber % 2 === 0;
                const bgColor = isEven ? theme.rowEvenBg : theme.rowOddBg;

                row.eachCell((cell, colNumber) => {
                    const colDef = sheetSchema.columns[colNumber - 1];

                    // Aplicar cores alternadas
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgColor.replace('#', 'FF') }
                    };

                    // Aplicar bordas finas
                    cell.border = {
                        top: { style: 'thin', color: { argb: theme.borderColor.replace('#', 'FF') } },
                        left: { style: 'thin', color: { argb: theme.borderColor.replace('#', 'FF') } },
                        bottom: { style: 'thin', color: { argb: theme.borderColor.replace('#', 'FF') } },
                        right: { style: 'thin', color: { argb: theme.borderColor.replace('#', 'FF') } }
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

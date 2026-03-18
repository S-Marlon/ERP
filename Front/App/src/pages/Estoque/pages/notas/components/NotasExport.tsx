import React from 'react';

interface StockEntryNote {
    id: string | number;
    invoiceNumber: string;
    series?: string;
    accessKey: string;
    emissionDate?: string;
    entryDate: string;
    supplierCnpj: string;
    supplierName: string;
    totalFreight?: number;
    totalInsurance?: number;
    totalIBS?: number;
    totalCBS?: number;
    totalTaxes?: number;
    totalOtherExpenses?: number;
    totalNoteValue: number;
    items?: any[];
    itemsCount?: number;
    status?: string;
}

interface NotasExportProps {
    notes: StockEntryNote[];
    formatCurrency: (value: number | undefined) => string;
}

const NotasExport: React.FC<NotasExportProps> = ({ notes, formatCurrency }) => {
    const exportToCSV = () => {
        if (notes.length === 0) {
            alert('Não há notas para exportar');
            return;
        }

        const headers = [
            'NF',
            'Data',
            'Fornecedor',
            'CNPJ',
            'Itens',
            'Valor Total',
            'Frete',
            'Seguro',
            'Impostos',
            'Outras Despesas',
        ];

        const rows = notes.map((note) => [
            note.invoiceNumber.replace('NF ', ''),
            note.entryDate,
            note.supplierName,
            note.supplierCnpj,
            note.itemsCount || note.items?.length || 0,
            note.totalNoteValue || 0,
            note.totalFreight || 0,
            note.totalInsurance || 0,
            note.totalTaxes || 0,
            note.totalOtherExpenses || 0,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `notas_fiscais_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const printNotes = () => {
        if (notes.length === 0) {
            alert('Não há notas para imprimir');
            return;
        }

        const printWindow = window.open('', '', 'height=600,width=800');
        if (!printWindow) {
            alert('Não foi possível abrir a janela de impressão');
            return;
        }

        let htmlContent = `
            <html>
                <head>
                    <title>Relatório de Notas Fiscais</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                        .total { font-weight: bold; }
                        .page-break { page-break-after: always; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Notas Fiscais</h1>
                    <p>Data de Geração: ${new Date().toLocaleDateString('pt-BR')}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>NF</th>
                                <th>Data</th>
                                <th>Fornecedor</th>
                                <th>CNPJ</th>
                                <th>Itens</th>
                                <th>Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        notes.forEach((note, idx) => {
            htmlContent += `
                <tr>
                    <td>${note.invoiceNumber.replace('NF ', '')}</td>
                    <td>${note.entryDate}</td>
                    <td>${note.supplierName}</td>
                    <td>${note.supplierCnpj}</td>
                    <td>${note.itemsCount || note.items?.length || 0}</td>
                    <td class="total">${formatCurrency(note.totalNoteValue)}</td>
                </tr>
            `;

            // Quebra de página a cada 15 notas
            if ((idx + 1) % 15 === 0 && idx < notes.length - 1) {
                htmlContent += `<tr class="page-break"><td colspan="6"></td></tr>`;
            }
        });

        htmlContent += `
                        </tbody>
                    </table>
                    <p style="margin-top: 20px;">Total de Notas: <strong>${notes.length}</strong></p>
                </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    };

    const styles = {
        container: {
            display: 'flex',
            gap: '10px',
            margin: '15px 0',
        } as React.CSSProperties,
        button: {
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'all 0.2s',
        } as React.CSSProperties,
        buttonCSV: {
            backgroundColor: '#10b981',
            color: 'white',
        } as React.CSSProperties,
        buttonPrint: {
            backgroundColor: '#6b7280',
            color: 'white',
        } as React.CSSProperties,
    };

    return (
        <div style={styles.container}>
            <button
                style={{ ...styles.button, ...styles.buttonCSV }}
                onClick={exportToCSV}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981';
                }}
            >
                📥 Exportar CSV
            </button>
            <button
                style={{ ...styles.button, ...styles.buttonPrint }}
                onClick={printNotes}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4b5563';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6b7280';
                }}
            >
                🖨️ Imprimir
            </button>
        </div>
    );
};

export default NotasExport;

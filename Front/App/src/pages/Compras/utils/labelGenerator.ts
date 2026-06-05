// src/utils/labelGenerator.ts


export interface LabelData {
  name: string;
  sku: string;
  price: number;
  quantity: number;
  unit?: string;
  isPromo?: boolean;
  batch?: string;
  expiryDate?: string;
  gtin?: string; // Opcional: para o código de barras real
}

// Configurações de tamanhos (dots/pontos) para Elgin L42 ou similares
const CONFIG = {
  "105x27": "Q216,24",
  "60x40": "Q320,24",
};

const sanitize = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\x20-\x7E]/g, "")    // Remove caracteres especiais
    .replace(/"/g, "'")             // Troca aspas duplas por simples
    .toUpperCase();
};

export const generatePRN = (items: LabelData[], size: "105x27" | "60x40" = "105x27") => {
  // Início do arquivo (PPLB)
  let prn = `I8,1,001\nq819\nO\nJF\nWN\nZT\n${CONFIG[size]}\n`;

  items.forEach((item) => {
    for (let i = 0; i < item.quantity; i++) {
      prn += "N\n"; // Limpa o buffer da impressora
      
      // Lógica de Variaveis (Simples ou Detalhada)
      prn += `A774,177,2,2,1,1,N,"${sanitize(item.name)}"\n`;
      prn += `A552,132,2,5,1,1,N,"R$ ${item.price.toFixed(2)}"\n`;
      
      if (item.batch || item.expiryDate) {
        // Se tiver detalhes, imprime linha extra pequena
        const detalhes = `${item.batch ? 'LT:' + item.batch : ''} ${item.expiryDate ? 'VAL:' + item.expiryDate : ''}`;
        prn += `A579,85,2,1,1,1,N,"${sanitize(detalhes)}"\n`;
      }

      prn += `A579,52,2,1,2,2,N,"COD: ${sanitize(item.sku)}"\n`;
      
      // Código de Barras (opcional usando o SKU ou GTIN)
      const barcodeValue = item.gtin || item.sku.replace(/\D/g, '');
      if (barcodeValue) {
        prn += `B579,10,2,1,2,5,40,N,"${barcodeValue}"\n`;
      }

      prn += "P1\n"; // Imprime essa etiqueta
    }
  });

  // Gatilho de download
  const blob = new Blob([prn], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IMPRIMIR_${Date.now()}.prn`;
  a.click();
  URL.revokeObjectURL(url);
};
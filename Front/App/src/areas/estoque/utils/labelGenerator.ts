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
  gtin?: string;
}

// Configurações otimizadas para etiquetas térmicas (Elgin L42 / PPLB)
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
  // Inicialização padrão PPLB (Velocidade e densidade otimizadas para nitidez)
  let prn = `I8,1,001\nq819\nS4\nD10\nO\nJF\nWN\nZT\n${CONFIG[size]}\n`;

  items.forEach((item) => {
    for (let i = 0; i < item.quantity; i++) {
      prn += "N\n"; // Limpa o buffer para a próxima etiqueta

      if (size === "105x27") {
        // --- LAYOUT PROFISSIONAL: 105x27 mm (Horizontal Compacto & Elegante) ---
        
        // 1. Nome do Produto (Negrito nítido, alinhado na parte superior)
        prn += `A780,185,2,2,1,1,N,"${sanitize(item.name)}"\n`;

        // 2. Bloco de Preço com Centavos Menores (Movido para a Direita)
        const priceStr = item.price.toFixed(2).replace('.', ',');
        const [inteiro, centavos] = priceStr.split(',');

        // R$ ajustado para a direita
        prn += `A640,132,2,3,1,1,N,"R$"\n`;
        // Parte inteira maior
        prn += `A580,122,2,5,2,2,N,"${inteiro},"\n`;
        // Centavos menores mais à direita (X aumentado para 490)
        prn += `A400,122,2,5,1,1,N,"${centavos}"\n`;

        // 3. Selo de Promoção / Oferta Destacado (se aplicável)
        if (item.isPromo) {
          prn += `A780,115,2,3,1,1,N,"[OFERTA]"\n`;
        }

        // 4. Detalhes Logísticos (SKU, Unidade, Lote, Validade em linha limpa unificada)
        let infoLine = `COD: ${sanitize(item.sku)}`;
        if (item.unit) infoLine += ` (${item.unit})`;
        if (item.batch) infoLine += ` | L: ${sanitize(item.batch)}`;
        if (item.expiryDate) infoLine += ` | VAL: ${item.expiryDate}`;
        
        prn += `A780,45,2,1,1,1,N,"${infoLine}"\n`;

        // 5. Código de Barras Compacto na Lateral/Inferior Direita
        const barcodeValue = item.gtin || item.sku.replace(/\D/g, '');
        if (barcodeValue) {
          prn += `B240,15,2,1,2,4,32,N,"${barcodeValue}"\n`;
        }

      } else {
        // --- LAYOUT PROFISSIONAL: 60x40 mm (Quadrado / Vertical) ---
        
        if (item.isPromo) {
          prn += `A280,350,2,3,1,1,N,"--- OFERTA ESPECIAL ---"\n`;
        }

        prn += `A280,310,2,3,1,1,N,"${sanitize(item.name)}"\n`;
        
        // Preço com centavos menores (Movido para a Direita)
        const priceStr60 = item.price.toFixed(2).replace('.', ',');
        const [inteiro60, centavos60] = priceStr60.split(',');

        prn += `A370,240,2,3,1,1,N,"R$"\n`;
        prn += `A310,230,2,5,2,2,N,"${inteiro60},"\n`;
        prn += `A220,246,2,4,1,1,N,"${centavos60}"\n`;

        let infoLine60 = `COD: ${sanitize(item.sku)}`;
        if (item.unit) infoLine60 += ` | ${item.unit}`;
        prn += `A280,180,2,1,1,1,N,"${infoLine60}"\n`;

        if (item.batch || item.expiryDate) {
          const det60 = `${item.batch ? 'LOTE: ' + item.batch : ''} ${item.expiryDate ? 'VAL: ' + item.expiryDate : ''}`;
          prn += `A280,140,2,1,1,1,N,"${sanitize(det60)}"\n`;
        }

        const barcodeValue60 = item.gtin || item.sku.replace(/\D/g, '');
        if (barcodeValue60) {
          prn += `B280,40,2,1,2,5,50,N,"${barcodeValue60}"\n`;
        }
      }

      prn += "P1\n"; // Comando de impressão da etiqueta atual
    }
  });

  // Gatilho de download do arquivo .PRN formatado para impressoras térmicas
  const blob = new Blob([prn], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ETIQUETAS_${Date.now()}.prn`;
  a.click();
  URL.revokeObjectURL(url);
};
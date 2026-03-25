// src/pages/Estoque/hooks/useLabelPrint.ts
import { generatePRN, LabelData } from '../utils/labelGenerator'; // ajuste o caminho se necessário

export const useLabelPrint = () => { // <--- PRECISA TER O 'export' AQUI
  const printLabels = (data: LabelData | LabelData[], size: "105x27" | "60x40" = "105x27") => {
    const items = Array.isArray(data) ? data : [data];
    generatePRN(items, size);
  };

  return { printLabels };
};
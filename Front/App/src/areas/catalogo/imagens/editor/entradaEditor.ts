// O que o editor de imagem recebe, venha de onde vier (anúncio do ML, família do catálogo): os itens com a foto e os
// campos de cada um (o texto {Campo} vira o valor do item) e onde guardar o modelo. Arquivo leve: as telas importam
// daqui sem carregar o editor (que traz a biblioteca de desenho).
import type { CampoEtiqueta } from '../etiqueta';

export interface ItemDoEditor {
  idItem: number;
  sku: string;
  nome: string;
  foto: string | null;                       // foto limpa do item (base quando "foto de cada item" está ligado)
  fotos?: { url: string; nome: string }[];   // fotos limpas do item, para escolher a que vai editar
  campos: CampoEtiqueta[];
  noMl?: boolean;                            // já publicado: a imagem nova vai ao ML pelo botão do anúncio
  kits?: number[];                           // o item também é vendido em kit c/N (atalho do "repetir a foto")
}

export interface EntradaEditor {
  chave: string;                             // reserva do modelo no navegador (ex.: "anuncio-4", "familia-101")
  idFamilia: number | null;
  familia: string | null;
  modeloPadrao: string;                      // texto inicial da cota (ex.: "{Tamanho} · {Largura}")
  itens: ItemDoEditor[];
  fotoPorItem?: boolean;                     // padrão do "foto de cada item" (anúncio: sim; família: não)
  idFotoFamiliaInicial?: number | null;      // abre direto nesta foto da família (pula a escolha)
}

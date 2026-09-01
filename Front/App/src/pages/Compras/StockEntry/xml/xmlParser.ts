// xmlParser.ts
import { XMLParser } from 'fast-xml-parser'; // Instalar: npm i fast-xml-parser

export interface NFeParsedData {
  cabecalho: {
    chave: string;
    numero: string;
    serie: string;
    dataEmissao: string;
  };
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    inscricaoEstadual: string;
  };
  totais: {
    valorProdutos: number;
    valorFrete: number;
    valorOutros: number;
    valorDesconto: number;
    valorNota: number;
  };
  itens: Array<{
    numeroItem: number;
    codigoProduto: string;
    ean: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  // Armazena o mapa bruto para depuração <tag>: valor
  rawMap: Record<string, any>;
}

export function parseNFeXml(xmlString: string): NFeParsedData {
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  };
  
  const parser = new XMLParser(options);
  const jsonObj = parser.parse(xmlString);

  // Tratativa padrão SEFAZ (nfeProc -> NFe -> infNFe)
  const infNFe = jsonObj?.nfeProc?.NFe?.infNFe || jsonObj?.NFe?.infNFe;

  if (!infNFe) {
    throw new Error("Estrutura do XML de NF-e inválida ou não reconhecida.");
  }

  const ide = infNFe.ide || {};
  const emit = infNFe.emit || {};
  const total = infNFe.total?.ICMSTot || {};
  const detList = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];

  // Mapeamento dos itens
  const itens = detList.map((det: any, index: number) => {
    const prod = det.prod || {};
    return {
      numeroItem: index + 1,
      codigoProduto: prod.cProd || '',
      ean: prod.cEAN || '',
      descricao: prod.xProd || '',
      unidade: prod.uCom || '',
      quantidade: parseFloat(prod.qCom || 0),
      valorUnitario: parseFloat(prod.vUnCom || 0),
      valorTotal: parseFloat(prod.vProd || 0),
    };
  });

  return {
    cabecalho: {
      chave: infNFe["@_Id"]?.replace("NFe", "") || "",
      numero: ide.nNF || "",
      serie: ide.serie || "",
      dataEmissao: ide.dhEmi || "",
    },
    emitente: {
      cnpj: emit.CNPJ || emit.CPF || "",
      razaoSocial: emit.xNome || "",
      nomeFantasia: emit.xFant || "Não Informado",
      inscricaoEstadual: emit.IE || "",
    },
    totais: {
      valorProdutos: parseFloat(total.vProd || 0),
      valorFrete: parseFloat(total.vFrete || 0),
      valorOutros: parseFloat(total.vOutro || 0),
      valorDesconto: parseFloat(total.vDesc || 0),
      valorNota: parseFloat(total.vNF || 0),
    },
    itens,
    rawMap: jsonObj // Mantém o JSON completo para a depuração tag a tag
  };
}
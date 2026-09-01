import { parseEmitNFe, EmitNFeData } from './03-emitParser';
import { parseIdeNFe, IdeNFeData } from './02-ideParser';
import { parseTranspNFe, TranspNFeData } from './06-transpParser';
import { parseDestAndLocations, CompleteDestAndLocationsData } from './04-destParser';
import { parseCobrPagNFe, CobrPagNFeData } from './07-cobrPagParser';
import { parseInfAdicNFe, InfAdicNFeData } from './09-infAdicParser';
import { parseTotalNFe, TotalNFeData } from './08-totalParser';
import { parseProdutosNFe, ItemNFeData } from './05-detParser'; // 👈 Importando o parser de produtos/det

export interface NfeDataFromXML {
    chaveAcesso: string;
    numero: string;
    serie: string;
    dataEmissao: string;
    naturezaOperacao: string;
    tipoOperacao: string;
    destinoOperacao: string;
    finalidade: string;
    presencaComprador: string;
    emitente: EmitNFeData & {
        cnpj?: string;
        nome?: string;
        nomeFantasia?: string;
        ie?: string;
        iest?: string;
        im?: string;
        crt?: string;
        cnae?: string;
        logradouro?: string;
        numeroEnd?: string;
        complemento?: string;
        bairro?: string;
        municipio?: string;
        cMun?: string;
        uf?: string;
        cep?: string;
        cPais?: string;
        xPais?: string;
        fone?: string;
    };
    ide: IdeNFeData;
    transp: TranspNFeData | null;
    destinatario: CompleteDestAndLocationsData['dest'];
    retirada: CompleteDestAndLocationsData['retirada'];
    entrega: CompleteDestAndLocationsData['entrega'];
    autXML: CompleteDestAndLocationsData['autXML'];
    cobranca: CobrPagNFeData | null;
    informacoesAdicionais: InfAdicNFeData | null;
    totais: TotalNFeData | null;
    produtos: ItemNFeData[]; // 👈 Tipado fortemente com os itens parseados
}

export const parseNfeComplete = (xmlString: string): NfeDataFromXML => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('O arquivo XML está malformado ou corrompido.');
    }

    // 1. Extração da Chave de Acesso via atributo Id da infNFe
    const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
    const idAttr = infNFe?.getAttribute('Id') || '';
    const chaveAcesso = idAttr.replace('NFe', '');

    // 2. Executa todos os parsers modulares, incluindo o de produtos
    const emitParsed = parseEmitNFe(xmlString);
    const ideParsed = parseIdeNFe(xmlString);
    const transpParsed = parseTranspNFe(xmlString);
    const destParsed = parseDestAndLocations(xmlString);
    const cobrPagParsed = parseCobrPagNFe(xmlString);
    const infAdicParsed = parseInfAdicNFe(xmlString);
    const totalParsed = parseTotalNFe(xmlString);
    const produtosParsed = parseProdutosNFe(xmlString); // 👈 Executando o parser de produtos

    return {
        chaveAcesso,
        numero: ideParsed.nNF,
        serie: ideParsed.serie,
        dataEmissao: ideParsed.dhEmi,
        naturezaOperacao: ideParsed.natOp,
        tipoOperacao: ideParsed.tpNF,
        destinoOperacao: ideParsed.idDest,
        finalidade: ideParsed.finNFe,
        presencaComprador: ideParsed.indPres,
        emitente: {
            ...emitParsed,
            cnpj: emitParsed.cnpjOrCpf,
            nome: emitParsed.xNome,
            nomeFantasia: emitParsed.xFant,
            logradouro: emitParsed.enderEmit.xLgr,
            numeroEnd: emitParsed.enderEmit.nro,
            complemento: emitParsed.enderEmit.xCpl,
            bairro: emitParsed.enderEmit.xBairro,
            municipio: emitParsed.enderEmit.xMun,
            cMun: emitParsed.enderEmit.cMun,
            uf: emitParsed.enderEmit.uf,
            cep: emitParsed.enderEmit.cep,
            cPais: emitParsed.enderEmit.cPais,
            xPais: emitParsed.enderEmit.xPais,
            fone: emitParsed.enderEmit.fone,
        },
        ide: ideParsed,
        transp: transpParsed,
        destinatario: destParsed.dest,
        retirada: destParsed.retirada,
        entrega: destParsed.entrega,
        autXML: destParsed.autXML,
        cobranca: cobrPagParsed,
        informacoesAdicionais: infAdicParsed,
        totais: totalParsed,
        produtos: produtosParsed, // 👈 Inserindo a lista rica de produtos no objeto final
    };
};
// src/components/NFeReader.tsx

import React, { useState } from 'react';


 interface NFeData {
  chaveAcesso: string;
  numero: string;
  dataEmissao: string;
  emitente: {
    cnpj: string;
    nome: string;
    uf: string;
  };
  destinatario: {
    cnpjCpf: string;
    nome: string;
  };
  valorTotal: string;
  produtos: Produto[];
}

 interface Produto {
  codigo: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
}

// Ajuste o namespace para o padrão NF-e (xmlns)
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

const NFeReader: React.FC = () => {
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Função principal para parsear o XML e extrair os dados.
   * @param xmlString O conteúdo do arquivo XML como string.
   */
  const parseNFeXml = (xmlString: string): NFeData | null => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // VERIFICAÇÃO DETALHADA DE ERROS DO PARSER
        const parserErrors = xmlDoc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0) {
            // Se houver um erro, capture a mensagem detalhada
            const errorText = parserErrors[0].textContent;
            console.error('Erro detalhado do DOMParser:', errorText);
            throw new Error(`XML Malformado. Detalhe: ${errorText || 'Nenhuma informação de erro adicional.'}`);
        }

      // Função auxiliar para obter valor de uma tag com namespace
      const getTagValue = (parent: Element, tagName: string): string => {
        const element = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] || parent.getElementsByTagName(tagName)[0];
        return element ? element.textContent || '' : '';
      };
      
      const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0];
      if (!infNFe) throw new Error('Tag <infNFe> não encontrada.');

      // Extração dos dados principais
      const ide = infNFe.getElementsByTagNameNS(NFE_NS, 'ide')[0];
      const emit = infNFe.getElementsByTagNameNS(NFE_NS, 'emit')[0];
      const dest = infNFe.getElementsByTagNameNS(NFE_NS, 'dest')[0];
      const total = infNFe.getElementsByTagNameNS(NFE_NS, 'total')[0]?.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0];

      const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || 'N/A';
      
      // Extração de Produtos
      const detElements = infNFe.getElementsByTagNameNS(NFE_NS, 'det');
      const produtos: Produto[] = Array.from(detElements).map(det => {
        const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0];
        return {
          codigo: getTagValue(prod, 'cProd'),
          descricao: getTagValue(prod, 'xProd'),
          quantidade: getTagValue(prod, 'qCom'),
          valorUnitario: getTagValue(prod, 'vUnCom'),
        } as Produto;
      });

      return {
        chaveAcesso: chaveAcesso,
        numero: getTagValue(ide, 'nNF'),
        dataEmissao: getTagValue(ide, 'dhEmi').substring(0, 10), // Apenas a data
        emitente: {
          cnpj: getTagValue(emit, 'CNPJ'),
          nome: getTagValue(emit, 'xNome'),
          uf: getTagValue(emit.getElementsByTagNameNS(NFE_NS, 'enderEmit')[0], 'UF'),
        },
        destinatario: {
          cnpjCpf: getTagValue(dest, 'CNPJ') || getTagValue(dest, 'CPF'),
          nome: getTagValue(dest, 'xNome'),
        },
        valorTotal: getTagValue(total, 'vNF'),
        produtos: produtos,
      } as NFeData;

    } catch (e) {
      console.error(e);
      setError(`Erro ao processar o XML: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      return null;
    }
  };

  /**
   * Lida com o evento de seleção do arquivo.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setNfeData(null);
    setError(null);

    if (file && file.type === 'text/xml' || file?.name.endsWith('.xml')) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        const data = parseNFeXml(xmlContent);
        if (data) {
          setNfeData(data);
        }
      };
      
      reader.onerror = () => {
        setError('Erro ao ler o arquivo.');
      };

      reader.readAsText(file);
    } else if (file) {
      setError('Por favor, selecione um arquivo XML (.xml) válido.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Leitor de NF-e (XML)</h2>
      <input 
        type="file" 
        accept=".xml" 
        onChange={handleFileChange} 
      />

      {error && <p style={{ color: 'red', marginTop: '10px' }}>⚠️ {error}</p>}
      
      {nfeData && (
        <div style={{ border: '1px solid #ccc', padding: '15px', marginTop: '20px', borderRadius: '5px' }}>
          <h3>Dados Principais da NF-e</h3>
          <p><strong>Chave de Acesso:</strong> {nfeData.chaveAcesso}</p>
          <p><strong>Número da NF:</strong> {nfeData.numero}</p>
          <p><strong>Data de Emissão:</strong> {nfeData.dataEmissao}</p>
          <p><strong>Valor Total:</strong> R$ {parseFloat(nfeData.valorTotal).toFixed(2).replace('.', ',')}</p>
          
          <h4>Emitente</h4>
          <p><strong>Nome:</strong> {nfeData.emitente.nome}</p>
          <p><strong>CNPJ:</strong> {nfeData.emitente.cnpj}</p>

          <h4>Destinatário</h4>
          <p><strong>Nome:</strong> {nfeData.destinatario.nome}</p>
          <p><strong>CNPJ/CPF:</strong> {nfeData.destinatario.cnpjCpf}</p>

          <h4>Produtos ({nfeData.produtos.length} itens)</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Cód.</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Descrição</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Qtd.</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Valor Unit.</th>
              </tr>
            </thead>
            <tbody>
              {nfeData.produtos.map((p, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.codigo}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.descricao}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.quantidade}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>R$ {parseFloat(p.valorUnitario).toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NFeReader;
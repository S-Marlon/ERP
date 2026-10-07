// components/LeitorXML.tsx
import React, { useState } from 'react';
import { parseEnvelopeNFe, EnvelopeNFeData } from './utils/envelopeParser';
import { parseIdeNFe, IdeNFeData } from './utils/02-ideParser';
import { parseEmitNFe, EmitNFeData } from './utils/03-emitParser';
import { parseDestAndLocations, CompleteDestAndLocationsData } from './utils/04-destParser';
import { parseProdutosNFe, ItemNFeData } from './utils/05-detParser';
import { parseTranspNFe, TranspNFeData } from './utils/06-transpParser';
import { parseCobrPagNFe, CobrPagNFeData, getTPagDescricao } from './utils/07-cobrPagParser';
import { parseTotalNFe, TotalNFeData } from './utils/08-totalParser';
import { parseInfAdicNFe, InfAdicNFeData } from './utils/09-infAdicParser';

// Função de formatação do XML
function formatXml(xml: string): string {
  let formatted = '';
  let indent = '';
  const tab = '    ';
  
  xml.split(/>\s*</).forEach((node) => {
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length);
    }
    formatted += indent + '<' + node + '>\r\n';
    if (node.match(/^<?\w[^>]*[^/]$/) && !node.startsWith('!--')) {
      indent += tab;
    }
  });
  
  return formatted.substring(1, formatted.length - 3);
}

// Helper para traduzir a modalidade de frete da NF-e
function getModFreteDescricao(mod: string): string {
  switch (mod) {
    case '0': return '0 - Contratação do Frete pelo Remetente (CIF)';
    case '1': return '1 - Contratação do Frete pelo Destinatário (FOB)';
    case '2': return '2 - Contratação do Frete por conta de Terceiros';
    case '3': return '3 - Transporte Próprio por conta do Remetente';
    case '4': return '4 - Transporte Próprio por conta do Destinatário';
    case '9': return '9 - Sem Ocorrência de Transporte';
    default: return `${mod} - Não Informado / Outros`;
  }
}

export function LeitorXML() {
  const [xmlBrutoFormatado, setXmlBrutoFormatado] = useState<string>('');
  const [envelopeData, setEnvelopeData] = useState<EnvelopeNFeData | null>(null);
  const [ideData, setIdeData] = useState<IdeNFeData | null>(null);
  const [emitData, setEmitData] = useState<EmitNFeData | null>(null);
  const [destData, setDestData] = useState<CompleteDestAndLocationsData | null>(null);
  const [produtosData, setProdutosData] = useState<ItemNFeData[] | null>(null);
  const [transpData, setTranspData] = useState<TranspNFeData | null>(null);
  const [cobrPagData, setCobrPagData] = useState<CobrPagNFeData | null>(null);
  const [totalData, setTotalData] = useState<TotalNFeData | null>(null);
  const [infAdicData, setInfAdicData] = useState<InfAdicNFeData | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setErro(null);
        const content = e.target?.result as string;
        
        setXmlBrutoFormatado(formatXml(content));

        // PASSO 1: Envelope
        const resultadoEnvelope = parseEnvelopeNFe(content);
        setEnvelopeData(resultadoEnvelope);

        // PASSO 2: Identificação (<ide>)
        const resultadoIde = parseIdeNFe(content);
        setIdeData(resultadoIde);

        // PASSO 3: Emitente (<emit>)
        const resultadoEmit = parseEmitNFe(content);
        setEmitData(resultadoEmit);

        // PASSO 4: Destinatário e Locais
        const resultadoDest = parseDestAndLocations(content);
        setDestData(resultadoDest);

        // PASSO 5: Produtos e Serviços (<det>)
        const resultadoProd = parseProdutosNFe(content);
        setProdutosData(resultadoProd);

        // PASSO 6: Transporte (<transp>)
        const resultadoTransp = parseTranspNFe(content);
        setTranspData(resultadoTransp);

        // PASSO 7: Cobrança e Pagamentos (<cobr> e <pag>)
        const resultadoCobrPag = parseCobrPagNFe(content);
        setCobrPagData(resultadoCobrPag);

        // PASSO 8: Totais da NF-e (<total>)
        const resultadoTotal = parseTotalNFe(content);
        setTotalData(resultadoTotal);

        // PASSO 9: Informações Adicionais (<infAdic>)
        const resultadoInfAdic = parseInfAdicNFe(content);
        setInfAdicData(resultadoInfAdic);

      } catch (err: any) {
        setErro(err.message || 'Erro ao processar o arquivo XML.');
        setEnvelopeData(null);
        setIdeData(null);
        setEmitData(null);
        setDestData(null);
        setProdutosData(null);
        setTranspData(null);
        setCobrPagData(null);
        setTotalData(null);
        setInfAdicData(null);
        setXmlBrutoFormatado('');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>📥 Leitor Modular de NF-e / NFC-e</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '2px dashed #007bff', borderRadius: '8px', background: '#f8f9fa' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Selecione o XML da Nota Fiscal:</label>
        <input type="file" accept=".xml" onChange={handleFileUpload} />
      </div>

      {erro && (
        <div style={{ padding: '12px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '20px' }}>
          <strong>Erro de Validação:</strong> {erro}
        </div>
      )}

      {envelopeData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* COLUNA ESQUERDA: Visualizador Formatado */}
          <div style={{ background: '#1e1e1e', color: '#9cdcfe', padding: '15px', borderRadius: '8px', height: '740px', display: 'flex', flexDirection: 'column', minWidth: 0, boxSizing: 'border-box' }}>
            <h3 style={{ color: '#ce9178', marginTop: 0 }}>📄 Visualizador do XML Formatado</h3>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              overflowX: 'auto',
              background: '#252526', 
              padding: '10px', 
              borderRadius: '4px', 
              fontFamily: 'monospace', 
              fontSize: '12px', 
              whiteSpace: 'pre', 
              color: '#d4d4d4',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {xmlBrutoFormatado}
            </div>
          </div>

          {/* COLUNA DIREITA: Passos Processados (Steps) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '740px', overflowY: 'auto', paddingRight: '5px' }}>
            
            {/* STEP 1: Estrutura e Envelope */}
            <div style={{ background: '#fff', border: '1px solid #cce5ff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #007bff' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#007bff', display: 'flex', justifyContent: 'space-between' }}>
                <span>Step 1: Estrutura e Envelope</span>
                <span style={{ fontSize: '11px', background: '#cce5ff', color: '#004085', padding: '2px 6px', borderRadius: '4px' }}>Obrigatório</span>
              </h4>
              <p style={{ margin: '6px 0', fontSize: '13px' }}>
                <strong>&lt;nfeProc versao&gt;:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>{envelopeData.versaoNfeProc}</span>
              </p>
              <p style={{ margin: '6px 0', fontSize: '13px' }}>
                <strong>&lt;infNFe versao&gt;:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>{envelopeData.versaoInfNfe}</span>
              </p>
              <p style={{ margin: '6px 0', fontSize: '13px' }}>
                <strong>&lt;infNFe Id&gt; (Chave):</strong> <br/>
                <span style={{ fontFamily: 'monospace', background: '#e2f0d9', padding: '4px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '3px', color: '#274e13', fontWeight: 'bold' }}>
                  {envelopeData.chaveAcesso}
                </span>
              </p>
              <p style={{ margin: '6px 0', fontSize: '13px' }}>
                <strong>Protocolo de Autorização:</strong> {' '}
                <span style={{ color: envelopeData.possuiProtocolo ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                  {envelopeData.possuiProtocolo ? '✔ Presente (<protNFe>)' : '❌ Ausente'}
                </span>
              </p>
            </div>

            {/* STEP 2: Identificação da NF-e (<ide>) */}
            {ideData && (
              <div style={{ background: '#fff', border: '1px solid #d4edda', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #28a745' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#28a745', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 2: Identificação (&lt;ide&gt;)</span>
                  <span style={{ fontSize: '11px', background: '#d4edda', color: '#155724', padding: '2px 6px', borderRadius: '4px' }}>Obrigatório</span>
                </h4>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Modelo / Série / Número:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>Mod {ideData.mod} | Série {ideData.serie} | Nº {ideData.nNF}</span>
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Natureza da Operação:</strong> <span style={{ color: '#333' }}>{ideData.natOp}</span>
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Data de Emissão:</strong> <span style={{ fontFamily: 'monospace' }}>{ideData.dhEmi}</span>
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Finalidade / Destino:</strong> <span style={{ fontFamily: 'monospace' }}>Fin: {ideData.finNFe} | Dest: {ideData.idDest}</span>
                </p>
              </div>
            )}

            {/* STEP 3: Emitente (<emit>) */}
            {emitData && (
              <div style={{ background: '#fff', border: '1px solid #ffeeba', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #ffc107' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 3: Emitente (&lt;emit&gt;)</span>
                  <span style={{ fontSize: '11px', background: '#ffeeba', color: '#856404', padding: '2px 6px', borderRadius: '4px' }}>Obrigatório</span>
                </h4>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Razão Social:</strong> <span style={{ fontWeight: 'bold' }}>{emitData.xNome}</span>
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>CNPJ / CPF:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>{emitData.cnpjOrCpf}</span>
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Inscrição Estadual (IE):</strong> <span style={{ fontFamily: 'monospace' }}>{emitData.ie}</span> | <strong>CRT:</strong> {emitData.crt}
                </p>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Endereço:</strong> <span style={{ color: '#555' }}>{emitData.enderEmit.xLgr}, {emitData.enderEmit.nro} - {emitData.enderEmit.xBairro}, {emitData.enderEmit.xMun} - {emitData.enderEmit.uf}</span>
                </p>
              </div>
            )}

            {/* STEP 4: Destinatário e Locais (<dest>, <retirada>, <entrega>, <autXML>) */}
            {destData && (
              <div style={{ background: '#fff', border: '1px solid #bee5eb', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #17a2b8' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#17a2b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 4: Destinatário & Locais</span>
                  <span style={{ fontSize: '11px', background: '#bee5eb', color: '#0c5460', padding: '2px 6px', borderRadius: '4px' }}>Variável</span>
                </h4>
                
                {destData.dest ? (
                  <>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}>
                      <strong>Destinatário:</strong> <span style={{ fontWeight: 'bold' }}>{destData.dest.xNome}</span>
                    </p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}>
                      <strong>CNPJ/CPF/Estrangeiro:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>{destData.dest.cnpjOrCpfOrEstrangeiro}</span>
                    </p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}>
                      <strong>IE:</strong> <span style={{ fontFamily: 'monospace' }}>{destData.dest.ie || 'Não informada'}</span> | <strong>Ind. IE:</strong> {destData.dest.indIEDest}
                    </p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}>
                      <strong>Endereço:</strong> <span style={{ color: '#555' }}>{destData.dest.enderDest.xLgr}, {destData.dest.enderDest.nro} - {destData.dest.enderDest.xBairro}, {destData.dest.enderDest.xMun} - {destData.dest.enderDest.uf}</span>
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '6px 0', fontSize: '13px', color: '#6c757d', fontStyle: 'italic' }}>
                    Nenhum destinatário informado.
                  </p>
                )}

                {destData.retirada && (
                  <p style={{ margin: '8px 0 2px 0', fontSize: '12px', color: '#495057' }}>
                    📦 <strong>Retirada no Local:</strong> {destData.retirada.xLgr}, {destData.retirada.nro} - {destData.retirada.xMun}/{destData.retirada.uf}
                  </p>
                )}

                {destData.entrega && (
                  <p style={{ margin: '4px 0 2px 0', fontSize: '12px', color: '#495057' }}>
                    🚚 <strong>Entrega no Local:</strong> {destData.entrega.xLgr}, {destData.entrega.nro} - {destData.entrega.xMun}/{destData.entrega.uf}
                  </p>
                )}

                {destData.autXML.length > 0 && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#495057' }}>
                    🔑 <strong>Autorizados XML:</strong> {destData.autXML.map(a => a.cnpjOrCpf).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* STEP 5: Produtos e Serviços (<det> / <prod>) */}
            {produtosData && produtosData.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e2d9f3', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #6f42c1' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#6f42c1', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 5: Produtos e Serviços ({produtosData.length} ite{produtosData.length > 1 ? 'ns' : 'm'})</span>
                  <span style={{ fontSize: '11px', background: '#e2d9f3', color: '#432874', padding: '2px 6px', borderRadius: '4px' }}>Obrigatório</span>
                </h4>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '6px' }}>Item</th>
                        <th style={{ padding: '6px' }}>Código</th>
                        <th style={{ padding: '6px' }}>Descrição</th>
                        <th style={{ padding: '6px' }}>Qtd</th>
                        <th style={{ padding: '6px' }}>V. Unit</th>
                        <th style={{ padding: '6px' }}>V. Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtosData.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: '6px', fontFamily: 'monospace' }}>{item.prod.nItem}</td>
                          <td style={{ padding: '6px', fontFamily: 'monospace' }}>{item.prod.cProd}</td>
                          <td style={{ padding: '6px' }}>
                            <div>{item.prod.xProd}</div>
                            {item.prod.infAdProd && (
                              <div style={{ fontSize: '11px', color: '#6c757d', fontStyle: 'italic' }}>Obs: {item.prod.infAdProd}</div>
                            )}
                          </td>
                          <td style={{ padding: '6px', fontFamily: 'monospace' }}>{item.prod.qCom} {item.prod.uCom}</td>
                          <td style={{ padding: '6px', fontFamily: 'monospace' }}>R$ {item.prod.vUnCom}</td>
                          <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: 'bold' }}>R$ {item.prod.vProd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STEP 6: Transporte e Frete (<transp>) */}
            {transpData && (
              <div style={{ background: '#fff', border: '1px solid #f5c6cb', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #dc3545' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#721c24', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 6: Transporte e Frete (&lt;transp&gt;)</span>
                  <span style={{ fontSize: '11px', background: '#f5c6cb', color: '#721c24', padding: '2px 6px', borderRadius: '4px' }}>Opcional/Variável</span>
                </h4>
                
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <strong>Modalidade do Frete:</strong> <span style={{ fontFamily: 'monospace', background: '#f1f1f1', padding: '2px 6px', borderRadius: '4px' }}>{getModFreteDescricao(transpData.modFrete)}</span>
                </p>

                {transpData.transporta ? (
                  <p style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Transportador:</strong> <span>{transpData.transporta.xNome}</span> ({transpData.transporta.cnpjOrCpf || 'Sem CNPJ/CPF'}) - {transpData.transporta.xMun}/{transpData.transporta.uf}
                  </p>
                ) : (
                  <p style={{ margin: '6px 0', fontSize: '13px', color: '#6c757d', fontStyle: 'italic' }}>
                    Nenhum transportador dedicado informado.
                  </p>
                )}

                {transpData.veicTransp && (
                  <p style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Veículo:</strong> <span style={{ fontFamily: 'monospace' }}>Placa {transpData.veicTransp.placa} / {transpData.veicTransp.uf}</span>
                  </p>
                )}

                {transpData.vol.length > 0 && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>
                    📦 <strong>Volumes:</strong> {transpData.vol.map((v) => `${v.qVol || '1'} vol(s) - ${v.esp || 'Espécie não informada'} (Peso Bruto: ${v.pesoB || '0'}kg)`).join('; ')}
                  </p>
                )}
              </div>
            )}

            {/* STEP 7: Cobrança e Pagamentos (<cobr> e <pag>) */}
            {cobrPagData && (
              <div style={{ background: '#fff', border: '1px solid #d1ecf1', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #17a2b8' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0c5460', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 7: Cobrança & Pagamentos</span>
                  <span style={{ fontSize: '11px', background: '#d1ecf1', color: '#0c5460', padding: '2px 6px', borderRadius: '4px' }}>Variável</span>
                </h4>

                {cobrPagData.fat && (
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <strong>Fatura Nº:</strong> {cobrPagData.fat.nFat} | <strong>V. Líquido:</strong> R$ {cobrPagData.fat.vLiq}
                  </div>
                )}

                {cobrPagData.dup.length > 0 && (
                  <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                    <strong>Duplicatas:</strong>{' '}
                    {cobrPagData.dup.map((d, i) => (
                      <span key={i} style={{ display: 'inline-block', background: '#f8f9fa', border: '1px solid #dee2e6', padding: '2px 6px', borderRadius: '4px', marginRight: '4px', marginBottom: '2px' }}>
                        {d.nDup} (Venc: {d.dVenc} - R$ {d.vDup})
                      </span>
                    ))}
                  </div>
                )}

                {cobrPagData.detPag.length > 0 && (
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>
                    <strong>Formas de Pagamento:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                      {cobrPagData.detPag.map((pag, idx) => (
                        <li key={idx} style={{ fontSize: '12px', color: '#333' }}>
                          {getTPagDescricao(pag.tPag)}: <strong>R$ {pag.vPag}</strong>
                          {pag.tBand && ` (Bandeira: ${pag.tBand})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cobrPagData.vTroco && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#28a745', fontWeight: 'bold' }}>
                    💵 Troco: R$ {cobrPagData.vTroco}
                  </p>
                )}
              </div>
            )}

            {/* STEP 8: Totais da Nota (<total> / <ICMSTot>) */}
            {totalData && totalData.icmsTot && (
              <div style={{ background: '#fff', border: '1px solid #ffe8cc', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #fd7e14' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#d9480f', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 8: Totais e Consolidado (&lt;total&gt;)</span>
                  <span style={{ fontSize: '11px', background: '#ffe8cc', color: '#d9480f', padding: '2px 6px', borderRadius: '4px' }}>Obrigatório</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                  <div><strong>V. Produtos:</strong> R$ {totalData.icmsTot.vProd}</div>
                  <div><strong>V. Frete:</strong> R$ {totalData.icmsTot.vFrete || '0,00'}</div>
                  <div><strong>V. Desconto:</strong> R$ {totalData.icmsTot.vDesc || '0,00'}</div>
                  <div><strong>Base ICMS:</strong> R$ {totalData.icmsTot.vBC || '0,00'}</div>
                  <div><strong>Valor ICMS:</strong> R$ {totalData.icmsTot.vICMS || '0,00'}</div>
                  <div><strong>Valor PIS:</strong> R$ {totalData.icmsTot.vPIS || '0,00'}</div>
                  <div><strong>Valor COFINS:</strong> R$ {totalData.icmsTot.vCOFINS || '0,00'}</div>
                  <div><strong>Outras Desp:</strong> R$ {totalData.icmsTot.vOutro || '0,00'}</div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>Valor Total da Nota (vNF):</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2b8a3e', background: '#ebfbee', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                    R$ {totalData.icmsTot.vNF}
                  </span>
                </div>
              </div>
            )}

            {/* STEP 9: Informações Complementares (<infAdic>) */}
            {infAdicData && (
              <div style={{ background: '#fff', border: '1px solid #e2e3e5', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #6c757d' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#383d41', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Step 9: Informações Complementares (&lt;infAdic&gt;)</span>
                  <span style={{ fontSize: '11px', background: '#e2e3e5', color: '#383d41', padding: '2px 6px', borderRadius: '4px' }}>Variável</span>
                </h4>

                {infAdicData.infCpl && (
                  <p style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Inf. Contribuinte:</strong> <span style={{ color: '#495057' }}>{infAdicData.infCpl}</span>
                  </p>
                )}

                {infAdicData.infAdFisco && (
                  <p style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Inf. Fisco:</strong> <span style={{ color: '#495057' }}>{infAdicData.infAdFisco}</span>
                  </p>
                )}

                {infAdicData.infIntermed && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>
                    🛒 <strong>Intermediador (Marketplace):</strong> CNPJ <span style={{ fontFamily: 'monospace' }}>{infAdicData.infIntermed.CNPJ}</span>
                  </p>
                )}
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
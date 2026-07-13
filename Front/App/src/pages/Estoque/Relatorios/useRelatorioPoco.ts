import { useState, useEffect } from "react";
import { Form, message } from "antd"; // Adicionado message para evitar quebras no catch
import dayjs from "dayjs";

export function useRelatorioPoco() {
  const [form] = Form.useForm();
  // Inicializa como objeto vazio para evitar erros de leitura antes do primeiro evento
  const [formData, setFormData] = useState<Record<string, any>>({});

  const dtTermino = Form.useWatch('dtTermino', form);
  const garantiaMeses = Form.useWatch('garantiaMeses', form);

  // Inicializa valores padrões no formulário
  useEffect(() => {
    form.setFieldsValue({
      perfDe: 0,
      revDe: 0,
      perfDiamUnidade: '"',
      revDiamUnidade: '"',
      diamInternoUnidade: '"'
    });
    // Sincroniza o estado inicial com o form
    setFormData(form.getFieldsValue());
  }, [form]);

  // Escuta as mudanças dos inputs e atualiza o estado
  const handleValuesChange = (_: any, allValues: any) => {
    setFormData(allValues);
  };

  // Função para Impressão do Relatório Técnico
 const handlePrint = async () => {
  try {
    // 1. Valida e captura todos os campos do formulário de uma vez
    const values = await form.validateFields();

    // 2. Tratamento e formatação dos dados brutos do formulário
    const dadosTratados = {
      ...values,
      dtInicio: values.dtInicio ? dayjs(values.dtInicio).format("DD/MM/YYYY") : "Não informada",
      dtTermino: values.dtTermino ? dayjs(values.dtTermino).format("DD/MM/YYYY") : "Não informada",
      dtLimpeza: values.dtLimpeza ? dayjs(values.dtLimpeza).format("DD/MM/YYYY") : "Não informada",
      bombaDtInstalacao: values.bombaDtInstalacao ? dayjs(values.bombaDtInstalacao).format("DD/MM/YYYY") : "Não informada",
      
      dataGarantiaFinal: values.dtTermino && values.garantiaMeses 
        ? dayjs(values.dtTermino).add(values.garantiaMeses, 'month').format('DD/MM/YYYY')
        : "N/A",

      perfuracoes: (values.perfuracoes || []).map((p: any) => ({
        de: p.perfDe ?? 0,
        ate: p.perfAte ? `${p.perfAte}m` : "---",
        diametro: p.perfDiam ? `${p.perfDiam}${p.perfDiamUnidade || '"'}` : "---"
      })),

      revestimentos: (values.revestimentos || []).map((r: any) => ({
        de: r.revDe ?? 0,
        ate: r.revAte ? `${r.revAte}m` : "---",
        diametro: r.revDiam ? `${r.revDiam}${r.revDiamUnidade || '"'}` : "---",
        material: r.revMaterial || "---",
        uniao: r.revUniao || "---"
      })),

      riscosEAnomalias: {
        caimento: values.chkCaimento ? "Sim" : "Não",
        estruturasSubterraneas: values.chkEstruturas ? "Sim" : "Não",
        aguaTurva: values.chkAguaNaoLimpou ? "Sim" : "Não",
        energiaRuim: values.chkEnergiaRuim ? "Sim" : "Não",
        presencaFerro: values.chkPresencaFerro ? "Sim" : "Não",
        lajeInfiltracao: values.chkLajeInfiltracao ? "Sim" : "Não",
        reducaoVazao: values.chkReducaoVazao ? "Sim" : "Não",
        aquecimentoBomba: values.chkAquecimentoBomba ? "Sim" : "Não",
      }
    };

    // 3. GERAÇÃO DO RELATÓRIO
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.warning("Por favor, permita pop-ups para visualizar o relatório.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório Técnico de Poço - ${dadosTratados.cliente || 'Sem Nome'}</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif; 
            margin: 0; 
            padding: 12px; 
            color: #2D3748; 
            font-size: 12px; 
            line-height: 1.4; 
            background-color: #fff;
          }
          
          /* Topo Elegante estilo corporativo */
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 2px solid #004d54; 
            padding-bottom: 12px; 
            margin-bottom: 20px; 
          }
          .header-title h1 { 
            margin: 0; 
            color: #004d54; 
            font-size: 18px; 
            font-weight: 700; 
            letter-spacing: 0.5px;
          }
          .header-title p { margin: 4px 0 0 0; color: #718096; font-size: 10px; }
          .header-meta { text-align: right; color: #4A5568; font-size: 10px; }

          /* Box de Seções */
          .section { 
            background: #ffffff; 
            border: 1px solid #E2E8F0; 
            padding: 8px; 
            margin-bottom: 10px; 
            border-radius: 6px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .section-title { 
            font-weight: 700; 
            color: #004d54; 
            border-bottom: 1px solid #E2E8F0; 
            padding-bottom: 5px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            font-size: 12px; 
            letter-spacing: 0.7px; 
          }

          /* Grid System limpo */
          .grid { display: flex; flex-wrap: wrap; margin: 0 -8px; }
          .col-2 { width: 16.666%; padding: 0 8px; margin-bottom: 10px; }
          .col-3 { width: 25%; padding: 0 8px; margin-bottom: 10px; }
          .col-4 { width: 33.333%; padding: 0 8px; margin-bottom: 10px; }
          .col-6 { width: 50%; padding: 0 8px; margin-bottom: 10px; }
          .col-8 { width: 66.666%; padding: 0 8px; margin-bottom: 10px; }
          .col-12 { width: 100%; padding: 0 8px; margin-bottom: 10px; }
          
          .label { font-weight: 600; color: #718096; text-transform: uppercase; font-size: 9px; margin-bottom: 2px; }
          .value { font-size: 11.5px; color: #1A202C; font-weight: 700;}
          .value-highlight { color: #c53030; font-weight: 800; }

          /* Tabelas Zebradas com Design Moderno */
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
          table, th, td { border: 1px solid #E2E8F0; }
          th { background-color: #f4f7f9; color: #004d54; padding: 7px 10px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 10px; color: #2D3748; }
          tr:nth-child(even) { background-color: #f8fafc; } /* Efeito Zebrado Moderno */

          /* Matriz de Ocorrências e Checkboxes */
          .checkbox-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .checkbox-table td { padding: 6px 10px; border: 1px solid #E2E8F0; }
          .badge { 
            display: inline-block; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-size: 9px; 
            font-weight: 700; 
            text-transform: uppercase;
          }
          .badge-sim { background-color: #eafed7; color: #469b2c96; }
          .badge-nao { background-color: #fed7d7; color: #9b2c2c; }

          /* Assinaturas na parte inferior */
          .footer-signatures { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 45%; border-top: 1px solid #A0AEC0; padding-top: 6px; font-size: 11px; color: #1A202C; font-weight: 500; }
          .sig-box span { color: #718096; font-size: 9px; display: block; margin-top: 2px; }

          @media print {
            body { padding: 0; margin: 0; }
            .section { page-break-inside: avoid; box-shadow: none; }
            th { background-color: #f4f7f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .badge-sim { background-color: #fed7d7 !important; color: #469b2c96 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .badge-nao { background-color: #fed7d7 !important; color: #9b2c2c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-title">
            <h1>RELATÓRIO TÉCNICO DE POÇO ARTESIANO</h1>
            <p>Especificações Estruturais, Bombeamento e Parâmetros Hidrodinâmicos</p>
          </div>
          <div class="header-meta">
            <strong>Data de Emissão:</strong> ${dayjs().format("DD/MM/YYYY HH:mm")}<br>
            <strong>Status do Documento:</strong> Finalizado
          </div>
          
        </div>

        <!-- 1. DADOS DO CLIENTE -->
        <div class="section">
          <div class="section-title">Identificação do Cliente / Proprietário</div>
          <div class="grid">
            <div class="col-6"><div class="label">Nome / Razão Social</div><div class="value">${dadosTratados.cliente || '---'}</div></div>
            <div class="col-3"><div class="label">CPF / CNPJ</div><div class="value">${dadosTratados.documento || '---'}</div></div>
            <div class="col-3"><div class="label">Contato Telefônico</div><div class="value">${dadosTratados.celular || '---'}</div></div>
            <div class="col-6"><div class="label">Endereço da Propriedade</div><div class="value">${dadosTratados.endereco || '---'}</div></div>
            <div class="col-2"><div class="label">Bairro</div><div class="value">${dadosTratados.bairro || '---'}</div></div>
            <div class="col-2"><div class="label">CEP</div><div class="value">${dadosTratados.cep || '---'}</div></div>
            <div class="col-2"><div class="label">Cidade / UF</div><div class="value">${dadosTratados.cidade || '---'} — ${dadosTratados.uf || '--'}</div></div>
          </div>
        </div>

        <!-- 2. DADOS DA OBRA E GEOLOGIA -->
        <div class="section">
          <div class="section-title">Dados Cronológicos e Dados Geológicos Básicos</div>
          <div class="grid">
            <div class="col-3"><div class="label">Coordenadas Geográficas (GPS)</div><div class="value">${dadosTratados.localizacao || '---'}</div></div>
            <div class="col-3"><div class="label">Profundidade Final</div><div class="value">${dadosTratados.profundidade ? `${dadosTratados.profundidade} metros` : '---'}</div></div>
            <div class="col-3"><div class="label">Diâmetro Nominal Interno</div><div class="value">${dadosTratados.diametroInterno ? `${dadosTratados.diametroInterno}${dadosTratados.diamInternoUnidade || '"'}` : '---'}</div></div>
            <div class="col-3"><div class="label">Vazão Estimada (Perfuração)</div><div class="value">${dadosTratados.vazaoAprox ? `${dadosTratados.vazaoAprox} L/h` : '---'}</div></div>
            
            
            
          </div>
        </div>

        <!-- 3. PERFIL E ESTRUTURA (TABELAS ZEBRADAS) -->
        <div class="section">
          <div class="section-title">Perfil Estrutural e Construtivo do Poço</div>
          <div class="grid">

            <div class="col-2"><div class="label">Data de Início</div><div class="value">${dadosTratados.dtInicio}</div></div>
            <div class="col-2"><div class="label">Data de Conclusão</div><div class="value">${dadosTratados.dtTermino}</div></div>
            <div class="col-2"><div class="label">Período de Garantia</div><div class="value">${dadosTratados.garantiaMeses ? `${dadosTratados.garantiaMeses} Meses` : '---'}</div></div>
            <div class="col-3"><div class="label">Término da Garantia</div><div class="value value-highlight">${dadosTratados.dataGarantiaFinal}</div></div>
            <div class="col-3"><div class="label">Formação / Solo Predominante</div><div class="value">${dadosTratados.tipoSolo || '---'}</div></div>


            <div class="col-6">
              <div class="label" style="margin-bottom: 6px;">Etapas de Perfuração e Diâmetros</div>
              <table>
                <thead>
                  <tr><th>De (m)</th><th>Até (m)</th><th>Diâmetro Nominal</th></tr>
                </thead>
                <tbody>
                  ${dadosTratados.perfuracoes.map((p: any) => `<tr><td>${p.de}</td><td>${p.ate}</td><td>${p.diametro}</td></tr>`).join('')}
                  ${dadosTratados.perfuracoes.length === 0 ? '<tr><td colspan="3" style="text-align:center; color:#718096;">Nenhuma etapa registrada</td></tr>' : ''}
                </tbody>
              </table>
            </div>
            <div class="col-6">
              <div class="label" style="margin-bottom: 6px;">Coluna de Revestimento / Isolação</div>
              <table>
                <thead>
                  <tr><th>De (m)</th><th>Até (m)</th><th>Diâmetro</th><th>Especificação Material</th></tr>
                </thead>
                <tbody>
                  ${dadosTratados.revestimentos.map((r: any) => `<tr><td>${r.de}</td><td>${r.ate}</td><td>${r.diametro}</td><td>${r.material}</td></tr>`).join('')}
                  ${dadosTratados.revestimentos.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#718096;">Nenhum revestimento inserido</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 4. SISTEMA DE BOMBEAMENTO -->
        <div class="section">
          <div class="section-title">Conjunto Motobomba e Componentes Adutores</div>
          <div class="grid">
            <div class="col-3"><div class="label">Fabricante/Marca da Bomba</div><div class="value">${dadosTratados.bombaMarca || '---'}</div></div>
            <div class="col-3"><div class="label">Motor (Modelo/Potência)</div><div class="value">${dadosTratados.imgMotorModelo || '---'}</div></div>
            <div class="col-3"><div class="label">Modelo do Bombeador</div><div class="value">${dadosTratados.imgBombeadorModelo || '---'}</div></div>
            <div class="col-3"><div class="label">Data de Instalação</div><div class="value">${dadosTratados.bombaDtInstalacao}</div></div>
            
            <div class="col-3"><div class="label">Tubulação Edutora</div><div class="value">${dadosTratados.bombaQtdTubos || 0} barras de ${dadosTratados.bombaTamTubo || 0}m (${dadosTratados.bombaTubulacao || '---'})</div></div>
            
            <div class="col-3"><div class="label">Profundidade da Bomba</div><div class="value">${dadosTratados.bombaProfundidade ? `${dadosTratados.bombaProfundidade} m` : '---'}</div></div>
            <div class="col-2"><div class="label">Cabo Elétrico</div><div class="value">${dadosTratados.bombaCabeamento || '---'}</div></div>
           <div class="col-2"><div class="label">Vazão Regulada</div><div class="value">${dadosTratados.bombaVazaoEstimada ? `${dadosTratados.bombaVazaoEstimada} L/h` : '---'}</div></div>
            
            <div class="col-2"><div class="label">Cavalete de saida</div><div class="value">${dadosTratados.bombaCavalete || '---'}</div></div>

          </div>
        </div>

        <!-- 5. DIAGNÓSTICO TÉCNICO E MANUTENÇÃO -->
        <div class="section">
          <div class="section-title">Matriz de Anomalias e Plano Analítico de Manutenção</div>
          
          <table class="checkbox-table">
            <tr>
              <td><span class="label">Queda de Vazão Crítica:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.reducaoVazao === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.reducaoVazao}</span></td>
              <td><span class="label">Presença de Ferro/Manganês:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.presencaFerro === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.presencaFerro}</span></td>
              <td><span class="label">Água Turva / Areia Fina:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.aguaTurva === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.aguaTurva}</span></td>
            </tr>
            <tr>
              <td><span class="label">Instabilidade na Rede Elétrica:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.energiaRuim === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.energiaRuim}</span></td>
              <td><span class="label">Risco Infiltração Superficial:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.lajeInfiltracao === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.lajeInfiltracao}</span></td>
              <td><span class="label">Superaquecimento da Motobomba:</span></td>
              <td><span class="badge ${dadosTratados.riscosEAnomalias.aquecimentoBomba === "Sim" ? "badge-sim" : "badge-nao"}">${dadosTratados.riscosEAnomalias.aquecimentoBomba}</span></td>
            </tr>
            
          </table>

          <div class="grid">

           <div class="col-2"><div class="label">Nível Estático (NE)</div><div class="value">${dadosTratados.bombaNivelEstatico ? `${dadosTratados.bombaNivelEstatico} m` : '---'}</div></div>
            <div class="col-2"><div class="label">Nível Dinâmico (ND)</div><div class="value">${dadosTratados.bombaNivelDinamico ? `${dadosTratados.bombaNivelDinamico} m` : '---'}</div></div>
            
            <div class="col-4"><div class="label">Leitura de Amperagem Atual</div><div class="value">${dadosTratados.manutAmperagem ? `${dadosTratados.manutAmperagem} A` : '---'}</div></div>
            <div class="col-4"><div class="label">Resistência de Isolamento (Megômetro)</div><div class="value">${dadosTratados.manutMegometro ? `${dadosTratados.manutMegometro} MΩ` : '---'}</div></div>
            
            <div class="col-12" style="margin-top: 4px;"><div class="label">Diretrizes Preventivas Estipuladas</div><div class="value" style="font-style: italic; color: #4A5568;">"${dadosTratados.manutDiretrizesTexto || 'Nenhuma diretriz extra inserida.'}"</div></div>
          </div>
        </div>

        
        

        <script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
              window.print();
            }, 300);
          });
        </script>
      </body>
      </html>
    `);

    // <!-- ASSINATURAS -->
    //     <div class="footer-signatures">
    //       <div class="sig-box">
    //         ${dadosTratados.respNomePerf || 'Responsável Técnico'}
    //         <span>CREA / CFT / Visto de Fiscalização</span>
    //       </div>
    //       <div class="sig-box">
    //         ${dadosTratados.cliente || 'Assinatura do Proprietário'}
    //         <span>Termo de Recebimento e Conformidade Técnica</span>
    //       </div>
    //     </div>
    printWindow.document.close();

  } catch (error) {
    console.error("Erro ao validar dados do formulário:", error);
    message.error("Por favor, verifique se há campos obrigatórios incorretos antes de imprimir.");
  }
};

  // NOME CORRIGIDO AQUI: handleExportXML
  const handleExportXML = () => {
    const obtenerValor = (valor: any) => (valor === undefined || valor === null ? '' : valor);
    const obterDataIso = (valor: any) => (valor && typeof valor === 'object' && valor.toISOString ? valor.toISOString() : obtenerValor(valor));
    const obterBoolStr = (valor: any) => (valor ? 'true' : 'false'); // Garante mapeamento consistente

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<relatorio_tecnico versao="1.0">
  <dados_cliente>
    <cliente><![CDATA[${obtenerValor(formData.cliente)}]]></cliente>
    <documento>${obtenerValor(formData.documento)}</documento>
    <endereco><![CDATA[${obtenerValor(formData.endereco)}]]></endereco>
    <bairro><![CDATA[${obtenerValor(formData.bairro)}]]></bairro>
    <cidade><![CDATA[${obtenerValor(formData.cidade)}]]></cidade>
    <uf>${obtenerValor(formData.uf)}</uf>
    <cep>${obtenerValor(formData.cep)}</cep>
    <celular>${obtenerValor(formData.celular)}</celular>
    <email>${obtenerValor(formData.email)}</email>
  </dados_cliente>
  <dados_obra>
    <localizacao><![CDATA[${obtenerValor(formData.localizacao)}]]></localizacao>
    <dtInicio>${obterDataIso(formData.dtInicio)}</dtInicio>
    <dtTermino>${obterDataIso(formData.dtTermino)}</dtTermino>
    <dtLimpeza>${obterDataIso(formData.dtLimpeza)}</dtLimpeza>
    <dtGarantia>${obterDataIso(formData.dtGarantia)}</dtGarantia>
    <tipoSolo><![CDATA[${obtenerValor(formData.tipoSolo)}]]></tipoSolo>
    <vazaoAprox>${obtenerValor(formData.vazaoAprox)}</vazaoAprox>
    <profundidade>${obtenerValor(formData.profundidade)}</profundidade>
    <diametroInterno>${obtenerValor(formData.diametroInterno)}</diametroInterno>
  </dados_obra>
  <especificacoes_estruturais>
    <perfDe>${obtenerValor(formData.perfDe)}</perfDe>
    <perfAte>${obtenerValor(formData.perfAte)}</perfAte>
    <perfDiam>${obtenerValor(formData.perfDiam)}</perfDiam>
    <revDe>${obtenerValor(formData.revDe)}</revDe>
    <revAte>${obtenerValor(formData.revAte)}</revAte>
    <revDiam>${obtenerValor(formData.revDiam)}</revDiam>
    <revMaterial><![CDATA[${obtenerValor(formData.revMaterial)}]]></revMaterial>
    <revUniao><![CDATA[${obtenerValor(formData.revUniao)}]]></revUniao>
  </especificacoes_estruturais>
  <observacoes_perfuracao>
    <chkCaimento>${obterBoolStr(formData.chkCaimento)}</chkCaimento>
    <chkEstruturas>${obterBoolStr(formData.chkEstruturas)}</chkEstruturas>
    <chkAguaNaoLimpou>${obterBoolStr(formData.chkAguaNaoLimpou)}</chkAguaNaoLimpou>
    <chkEnergiaRuim>${obterBoolStr(formData.chkEnergiaRuim)}</chkEnergiaRuim>
    <equipePerfuracao><![CDATA[${obtenerValor(formData.equipePerfuracao)}]]></equipePerfuracao>
    <obsGeraisPerfuracao><![CDATA[${obtenerValor(formData.obsGeraisPerfuracao)}]]></obsGeraisPerfuracao>
    <respNomePerf><![CDATA[${obtenerValor(formData.respNomePerf)}]]></respNomePerf>
  </observacoes_perfuracao>
  <imagens_tecnicas>
    <imgCimentacao><![CDATA[${obtenerValor(formData.imgCimentacao)}]]></imgCimentacao>
    <imgRochaMetros>${obtenerValor(formData.imgRochaMetros)}</imgRochaMetros>
    <imgMotorModelo><![CDATA[${obtenerValor(formData.imgMotorModelo)}]]></imgMotorModelo>
    <imgBombeadorModelo><![CDATA[${obtenerValor(formData.imgBombeadorModelo)}]]></imgBombeadorModelo>
  </imagens_tecnicas>
  <bombeamento>
    <bombaMarca><![CDATA[${obtenerValor(formData.bombaMarca)}]]></bombaMarca>
    <bombaDtInstalacao>${obterDataIso(formData.bombaDtInstalacao)}</bombaDtInstalacao>
    <bombaProfundidade>${obtenerValor(formData.bombaProfundidade)}</bombaProfundidade>
    <bombaMotobomba><![CDATA[${obtenerValor(formData.bombaMotobomba)}]]></bombaMotobomba>
    <bombaTubulacao><![CDATA[${obtenerValor(formData.bombaTubulacao)}]]></bombaTubulacao>
    <bombaCabeamento><![CDATA[${obtenerValor(formData.bombaCabeamento)}]]></bombaCabeamento>
    <bombaCavalete><![CDATA[${obtenerValor(formData.bombaCavalete)}]]></bombaCavalete>
    <bombaNivelEstatico>${obtenerValor(formData.bombaNivelEstatico)}</bombaNivelEstatico>
    <bombaNivelDinamico>${obtenerValor(formData.bombaNivelDinamico)}</bombaNivelDinamico>
    <bombaVazaoEstimada>${obtenerValor(formData.bombaVazaoEstimada)}</bombaVazaoEstimada>
    <bombaObsGerais><![CDATA[${obtenerValor(formData.bombaObsGerais)}]]></bombaObsGerais>
    <equipeInstalacaoBomba><![CDATA[${obtenerValor(formData.equipeInstalacaoBomba)}]]></equipeInstalacaoBomba>
    <respNomeBomba><![CDATA[${obtenerValor(formData.respNomeBomba)}]]></respNomeBomba>
  </bombeamento>
  <teste_vazao>
    <testeVazaoDados><![CDATA[${obtenerValor(formData.testeVazaoDados)}]]></testeVazaoDados>
  </teste_vazao>
</relatorio_tecnico>`;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_${formData.cliente || 'Poco'}_${dayjs().format('YYYY-MM-DD')}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Importante liberar memória do blob criado
  };

  // Função para Importar os Dados do XML para o Form
  const handleImportXML = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const xmlText = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // Validação básica do XML importado
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
          message.error("Arquivo XML inválido ou corrompido.");
          return;
        }

        const getTagValue = (tagName: string, isBool = false) => {
          const element = xmlDoc.getElementsByTagName(tagName)[0];
          if (!element) return isBool ? false : '';
          const txt = element.textContent || '';
          return isBool ? txt === 'true' : txt;
        };

        const getTagDateValue = (tagName: string) => {
          const val = getTagValue(tagName);
          return val ? dayjs(val) : null;
        };

        const importedData = {
          cliente: getTagValue('cliente'),
          documento: getTagValue('documento'),
          endereco: getTagValue('endereco'),
          bairro: getTagValue('bairro'),
          cidade: getTagValue('cidade'),
          uf: getTagValue('uf'),
          cep: getTagValue('cep'),
          celular: getTagValue('celular'),
          email: getTagValue('email'),
          localizacao: getTagValue('localizacao'),
          dtInicio: getTagDateValue('dtInicio'),
          dtTermino: getTagDateValue('dtTermino'),
          dtLimpeza: getTagDateValue('dtLimpeza'),
          dtGarantia: getTagDateValue('dtGarantia'),
          tipoSolo: getTagValue('tipoSolo'),
          vazaoAprox: getTagValue('vazaoAprox'),
          profundidade: getTagValue('profundidade'),
          diametroInterno: getTagValue('diametroInterno'),
          perfDe: getTagValue('perfDe'),
          perfAte: getTagValue('perfAte'),
          perfDiam: getTagValue('perfDiam'),
          revDe: getTagValue('revDe'),
          revAte: getTagValue('revAte'),
          revDiam: getTagValue('revDiam'),
          revMaterial: getTagValue('revMaterial'),
          revUniao: getTagValue('revUniao'),
          chkCaimento: getTagValue('chkCaimento', true), 
          chkEstruturas: getTagValue('chkEstruturas', true),
          chkAguaNaoLimpou: getTagValue('chkAguaNaoLimpou', true),
          chkEnergiaRuim: getTagValue('chkEnergiaRuim', true),
          equipePerfuracao: getTagValue('equipePerfuracao'),
          obsGeraisPerfuracao: getTagValue('obsGeraisPerfuracao'),
          respNomePerf: getTagValue('respNomePerf'),
          imgCimentacao: getTagValue('imgCimentacao'),
          imgRochaMetros: getTagValue('imgRochaMetros'),
          imgMotorModelo: getTagValue('imgMotorModelo'),
          imgBombeadorModelo: getTagValue('imgBombeadorModelo'),
          bombaMarca: getTagValue('bombaMarca'),
          bombaDtInstalacao: getTagDateValue('bombaDtInstalacao'),
          bombaProfundidade: getTagValue('bombaProfundidade'),
          bombaMotobomba: getTagValue('bombaMotobomba'),
          bombaTubulacao: getTagValue('bombaTubulacao'),
          bombaCabeamento: getTagValue('bombaCabeamento'),
          bombaCavalete: getTagValue('bombaCavalete'),
          bombaNivelEstatico: getTagValue('bombaNivelEstatico'),
          bombaNivelDinamico: getTagValue('bombaNivelDinamico'),
          bombaVazaoEstimada: getTagValue('bombaVazaoEstimada'),
          bombaObsGerais: getTagValue('bombaObsGerais'),
          equipeInstalacaoBomba: getTagValue('equipeInstalacaoBomba'),
          respNomeBomba: getTagValue('respNomeBomba'),
          testeVazaoDados: getTagValue('testeVazaoDados'),
        };

        form.setFieldsValue(importedData);
        setFormData(importedData);
        message.success("Dados importados com sucesso!");
      } catch (err) {
        console.error("Erro ao importar XML", err);
        message.error("Erro ao processar o arquivo XML.");
      }
    };
    reader.readAsText(file);
    return false; // Retornar false previne o upload padrão do AntD (action action URL)
  };

  return {
    form,
    dtTermino,
    garantiaMeses,
    handleValuesChange,
    handlePrint,
    handleExportXML,
    handleImportXML
  };
}
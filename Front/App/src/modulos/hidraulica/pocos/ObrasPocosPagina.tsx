// Módulo Obras de poços: grupo próprio na barra lateral ("Poços artesianos"), uma seção por endereço
// (/modulos/hidraulica/pocos/<secao>, ver secoesPocos.ts). A Central é a entrada. Os atalhos internos ("abrir obra",
// "ver no mapa", os cartões da Central) mudam a seção pelo navPocos e o endereço acompanha; as partes de cobrança,
// materiais, processo e orçamento/contrato vivem dentro da obra.
import React, { useEffect, useRef } from 'react';
import { Flex, Segmented, Typography } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import CentralPocos from './CentralPocos';
import ObrasAba from './ObrasAba';
import MapaPocos from './MapaPocos';
import AgendaPocos from './AgendaPocos';
import PainelPocos from './PainelPocos';
import { ManutencoesPocos } from './ManutencaoPocos';
import MonitoramentoPocos from './MonitoramentoPocos';
import AtendimentoPocos from './AtendimentoPocos';
import { navPocos, useNavPocos } from './navPocos';
import { enderecoDaSecao, GRUPOS_POCOS, secaoDaAba, secaoDoEndereco, secoesDoGrupo } from './secoesPocos';
import { MaisFerramentas } from './InicioPocos';
import CentralDocumentos from './CentralDocumentos';
import { secaoLigada, useRecursosPocos } from './recursosPocos';
import BuscaPocos from './BuscaPocos';
import { FichasPocos } from './FichaPoco';

const { Title, Text } = Typography;
const TELAS: Record<string, React.ReactNode> = {
  central: <CentralPocos />, atendimento: <AtendimentoPocos />, obras: <ObrasAba />, agenda: <AgendaPocos />, manutencao: <ManutencoesPocos />,
  iot: <MonitoramentoPocos />, mapa: <MapaPocos />, resultado: <PainelPocos />, ferramentas: <MaisFerramentas />, documentos: <CentralDocumentos />,
};

const ObrasPocosPagina: React.FC = () => {
  const { secao } = useParams<{ secao?: string }>();
  const navigate = useNavigate();
  const nav = useNavPocos();
  const atual = secaoDoEndereco(secao);
  const ultimoPedido = useRef(nav.pedido);

  // endereço → seção interna (clique na barra lateral, voltar do navegador, link salvo)
  useEffect(() => {
    // endereço antigo (kit-visita, relatorio): abre a aba certa de Documentos e troca o endereço pelo novo
    if (atual.subvista) { navPocos.ir({ aba: atual.aba, subvista: atual.subvista }); navigate(enderecoDaSecao(atual), { replace: true }); return; }
    if (nav.aba === atual.aba && (!atual.vista || nav.vista === atual.vista)) return;
    if (atual.vista) navPocos.ir({ aba: atual.aba, vista: atual.vista }); else navPocos.trocarAba(atual.aba);
  }, [secao]);   // eslint-disable-line react-hooks/exhaustive-deps

  // pedido interno ("abrir obra", "ver no mapa", atalhos da Central) → endereço
  useEffect(() => {
    if (nav.pedido === ultimoPedido.current) return;
    ultimoPedido.current = nav.pedido;
    const destino = secaoDaAba(nav.aba, nav.vista);
    if (destino.secao !== atual.secao) navigate(enderecoDaSecao(destino));
  }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => navPocos.trocarAba('central'), []);   // ao sair do módulo, volta a abrir pela Central
  // as outras telas do mesmo grupo da barra lateral viram abas no topo (ex.: Obras · A receber · Materiais)
  const recursos = useRecursosPocos();
  const doGrupo = secoesDoGrupo(atual.grupo).filter(s => s.secao === atual.secao || secaoLigada(s.secao, recursos));
  const tituloGrupo = GRUPOS_POCOS.find(g => g.grupo === atual.grupo)?.titulo || atual.titulo;
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Title level={3} style={{ margin: 0 }}><AimOutlined /> Poços artesianos · {tituloGrupo}</Title>
          <BuscaPocos />
        </Flex>
        {atual.aba === 'central' && <Text type="secondary">Do primeiro contato à manutenção: contratos, obras, poços, agenda, monitoramento e pós-venda.</Text>}
        {doGrupo.length > 1 && (
          <Segmented style={{ marginTop: 10 }} value={atual.secao} onChange={v => navigate(enderecoDaSecao({ secao: String(v) }))}
            options={doGrupo.map(s => ({ value: s.secao, label: s.titulo }))} />
        )}
      </div>
      <React.Fragment key={atual.aba}>{TELAS[atual.aba]}</React.Fragment>
      <FichasPocos />
    </div>
  );
};

export default ObrasPocosPagina;

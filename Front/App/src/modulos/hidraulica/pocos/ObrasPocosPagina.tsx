// Módulo Obras de poços: grupo próprio na barra lateral ("Poços artesianos"), uma seção por endereço
// (/modulos/hidraulica/pocos/<secao>, ver secoesPocos.ts). A Central é a entrada. Os atalhos internos ("abrir obra",
// "ver no mapa", os cartões da Central) mudam a seção pelo navPocos e o endereço acompanha; as partes de cobrança,
// materiais, processo e orçamento/contrato vivem dentro da obra.
import React, { useEffect, useRef } from 'react';
import { Typography } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import CentralPocos from './CentralPocos';
import RelatorioPocoPage from './RelatorioPocoPage';
import ObrasAba from './ObrasAba';
import MapaPocos from './MapaPocos';
import AgendaPocos from './AgendaPocos';
import PainelPocos from './PainelPocos';
import { ManutencoesPocos } from './ManutencaoPocos';
import MonitoramentoPocos from './MonitoramentoPocos';
import AtendimentoPocos from './AtendimentoPocos';
import { navPocos, useNavPocos } from './navPocos';
import { secaoDaAba, secaoDoEndereco } from './secoesPocos';

const { Title, Text } = Typography;
const BASE = '/modulos/hidraulica/pocos';

const TELAS: Record<string, React.ReactNode> = {
  central: <CentralPocos />, atendimento: <AtendimentoPocos />, obras: <ObrasAba />, agenda: <AgendaPocos />, manutencao: <ManutencoesPocos />,
  iot: <MonitoramentoPocos />, mapa: <MapaPocos />, resultado: <PainelPocos />, relatorio: <RelatorioPocoPage />,
};

const ObrasPocosPagina: React.FC = () => {
  const { secao } = useParams<{ secao?: string }>();
  const navigate = useNavigate();
  const nav = useNavPocos();
  const atual = secaoDoEndereco(secao);
  const ultimoPedido = useRef(nav.pedido);

  // endereço → seção interna (clique na barra lateral, voltar do navegador, link salvo)
  useEffect(() => {
    if (nav.aba === atual.aba && (!atual.vista || nav.vista === atual.vista)) return;
    if (atual.vista) navPocos.ir({ aba: atual.aba, vista: atual.vista }); else navPocos.trocarAba(atual.aba);
  }, [atual.secao]);   // eslint-disable-line react-hooks/exhaustive-deps

  // pedido interno ("abrir obra", "ver no mapa", atalhos da Central) → endereço
  useEffect(() => {
    if (nav.pedido === ultimoPedido.current) return;
    ultimoPedido.current = nav.pedido;
    const destino = secaoDaAba(nav.aba, nav.vista);
    if (destino.secao !== atual.secao) navigate(destino.secao ? `${BASE}/${destino.secao}` : BASE);
  }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => navPocos.trocarAba('central'), []);   // ao sair do módulo, volta a abrir pela Central
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}><AimOutlined /> Poços artesianos · {atual.titulo}</Title>
        {atual.aba === 'central' && <Text type="secondary">Do primeiro contato à manutenção: contratos, obras, poços, agenda, monitoramento e pós-venda.</Text>}
      </div>
      <React.Fragment key={atual.aba}>{TELAS[atual.aba]}</React.Fragment>
    </div>
  );
};

export default ObrasPocosPagina;

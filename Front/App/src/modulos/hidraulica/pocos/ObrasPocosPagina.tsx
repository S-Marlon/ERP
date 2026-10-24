// Módulo Obras de poços: abre na Central (contratos a finalizar, informações a completar e a prévia do plano mensal) e
// tem uma aba para cada parte do dia a dia. O mapa de etapas do desenvolvimento ficou em planoObras.ts e
// docs/plano-obras-pocos.md (todas prontas); as partes de cobrança, materiais e processo vivem dentro da obra.
import React, { useEffect } from 'react';
import { Tabs, Typography } from 'antd';
import {
  AimOutlined, ApiOutlined, BarChartOutlined, CalendarOutlined, CustomerServiceOutlined, DashboardOutlined, EnvironmentOutlined, FileTextOutlined, HistoryOutlined,
} from '@ant-design/icons';
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

const { Title, Text } = Typography;

const ABAS: { chave: string; titulo: string; icone: React.ReactNode; tela: React.ReactNode }[] = [
  { chave: 'central', titulo: 'Central', icone: <DashboardOutlined />, tela: <CentralPocos /> },
  { chave: 'atendimento', titulo: 'Atendimento e pós-venda', icone: <CustomerServiceOutlined />, tela: <AtendimentoPocos /> },
  { chave: 'obras', titulo: 'Obras, poços e clientes', icone: <AimOutlined />, tela: <ObrasAba /> },
  { chave: 'agenda', titulo: 'Agenda', icone: <CalendarOutlined />, tela: <AgendaPocos /> },
  { chave: 'manutencao', titulo: 'Manutenção', icone: <HistoryOutlined />, tela: <ManutencoesPocos /> },
  { chave: 'iot', titulo: 'Monitoramento', icone: <ApiOutlined />, tela: <MonitoramentoPocos /> },
  { chave: 'mapa', titulo: 'Mapa', icone: <EnvironmentOutlined />, tela: <MapaPocos /> },
  { chave: 'resultado', titulo: 'Resultado', icone: <BarChartOutlined />, tela: <PainelPocos /> },
  { chave: 'relatorio', titulo: 'Relatório avulso', icone: <FileTextOutlined />, tela: <RelatorioPocoPage /> },
];

const ObrasPocosPagina: React.FC = () => {
  const nav = useNavPocos();   // "ver no mapa", "abrir obra" e os atalhos da Central trocam a aba
  useEffect(() => () => navPocos.trocarAba('central'), []);   // ao sair do módulo, volta a abrir pela Central
  const aba = ABAS.some(a => a.chave === nav.aba) ? nav.aba : 'central';
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}><AimOutlined /> Obras de poços artesianos</Title>
        <Text type="secondary">Do primeiro contato à manutenção: contratos, obras, poços, agenda, monitoramento e pós-venda.</Text>
      </div>
      <Tabs activeKey={aba} onChange={navPocos.trocarAba} destroyOnHidden
        items={ABAS.map(a => ({ key: a.chave, label: <span>{a.icone} {a.titulo}</span>, children: a.tela }))} />
    </div>
  );
};

export default ObrasPocosPagina;

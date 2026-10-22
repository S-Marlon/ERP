// Módulo Obras de poços: o mapa do módulo (etapas) e uma aba por funcionalidade. O relatório técnico (formulário e
// impressões) já funciona; as outras abrem por etapas.
import React, { useEffect } from 'react';
import {
  AimOutlined, ApiOutlined, BarChartOutlined, CalendarOutlined, DollarOutlined, EnvironmentOutlined, FileTextOutlined, HistoryOutlined, InboxOutlined,
} from '@ant-design/icons';
import ModuloEmEtapas from '../../../shared/components/mapaModulo/ModuloEmEtapas';
import { FUNCIONALIDADES } from './planoObras';
import RelatorioPocoPage from './RelatorioPocoPage';
import ObrasAba from './ObrasAba';
import MapaPocos from './MapaPocos';
import AgendaPocos from './AgendaPocos';
import PainelPocos from './PainelPocos';
import { ManutencoesPocos } from './ManutencaoPocos';
import MonitoramentoPocos from './MonitoramentoPocos';
import { navPocos, useNavPocos } from './navPocos';

const ICONES: Record<string, React.ReactNode> = {
  relatorio: <FileTextOutlined />, obras: <AimOutlined />, mapa: <EnvironmentOutlined />, cobranca: <DollarOutlined />, materiais: <InboxOutlined />,
  agenda: <CalendarOutlined />, manutencao: <HistoryOutlined />, iot: <ApiOutlined />, resultado: <BarChartOutlined />,
};

const ObrasPocosPagina: React.FC = () => {
  const nav = useNavPocos();   // "ver no mapa" / "abrir obra" trocam a aba
  useEffect(() => () => navPocos.trocarAba('obras'), []);   // ao sair do módulo, volta a abrir pelas obras
  return (
    <ModuloEmEtapas
      titulo={<><AimOutlined /> Obras de poços artesianos</>}
      descricao="Da perfuração à manutenção: obras, ficha de cada poço, mapa regional, sinal e cobrança, materiais, agenda e monitoramento remoto."
      funcionalidades={FUNCIONALIDADES} icones={ICONES} telas={{ relatorio: <RelatorioPocoPage />, obras: <ObrasAba />, mapa: <MapaPocos />, agenda: <AgendaPocos />, manutencao: <ManutencoesPocos />, iot: <MonitoramentoPocos />, resultado: <PainelPocos /> }}
      aba={nav.aba} onAba={navPocos.trocarAba}
      textoAlertas="Obras paradas ou atrasadas ficam em Resultado e painel; manutenções vencendo e garantias em Histórico e manutenção; alertas dos sensores em Monitoramento remoto."
    />
  );
};

export default ObrasPocosPagina;

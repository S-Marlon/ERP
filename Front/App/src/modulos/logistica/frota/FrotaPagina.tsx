// Módulo Gestor de frotas: o mapa do módulo (etapas) e uma aba por funcionalidade; as prontas mostram a tela delas.
import React from 'react';
import { CarOutlined, DashboardOutlined, FileProtectOutlined, FireOutlined, IdcardOutlined, NodeIndexOutlined, ToolOutlined } from '@ant-design/icons';
import ModuloEmEtapas from '../../../shared/components/mapaModulo/ModuloEmEtapas';
import { FUNCIONALIDADES } from './planoFrota';
import VeiculosAba from './VeiculosAba';

const ICONES: Record<string, React.ReactNode> = {
  veiculos: <CarOutlined />, abastecimentos: <FireOutlined />, manutencoes: <ToolOutlined />, documentos: <FileProtectOutlined />,
  motoristas: <IdcardOutlined />, viagens: <NodeIndexOutlined />, custos: <DashboardOutlined />,
};

const FrotaPagina: React.FC = () => (
  <ModuloEmEtapas
    titulo={<><CarOutlined /> Gestor de frotas</>}
    descricao="Veículos da loja, abastecimentos, manutenções, documentos, motoristas e viagens, com o custo de cada veículo indo para o financeiro."
    funcionalidades={FUNCIONALIDADES} icones={ICONES} telas={{ veiculos: <VeiculosAba /> }}
    textoAlertas="Manutenção vencendo, documento vencendo e consumo fora do normal aparecem aqui quando as etapas abrirem."
  />
);

export default FrotaPagina;

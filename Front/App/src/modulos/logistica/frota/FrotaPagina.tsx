// Módulo Gestor de frotas: a visão geral (o mapa do módulo e em que etapa estamos) e uma aba por funcionalidade. As
// funcionalidades abrem por etapas; enquanto não abrem, a aba mostra o que vão fazer e com que parte do ERP se ligam.
import React, { useState } from 'react';
import { Alert, Card, Col, Empty, List, Row, Space, Steps, Tabs, Tag, Typography } from 'antd';
import {
  AlertOutlined, CarOutlined, DashboardOutlined, FileProtectOutlined, IdcardOutlined, NodeIndexOutlined, ToolOutlined, FireOutlined,
} from '@ant-design/icons';
import { etapaAtual, etapasDoPlano, Funcionalidade, FUNCIONALIDADES, SituacaoFuncionalidade } from './planoFrota';
import VeiculosAba from './VeiculosAba';

const { Text, Title, Paragraph } = Typography;

const ICONE: Record<string, React.ReactNode> = {
  veiculos: <CarOutlined />, abastecimentos: <FireOutlined />, manutencoes: <ToolOutlined />, documentos: <FileProtectOutlined />,
  motoristas: <IdcardOutlined />, viagens: <NodeIndexOutlined />, custos: <DashboardOutlined />,
};
const SITUACAO: Record<SituacaoFuncionalidade, { cor: string; texto: string }> = {
  PLANEJADA: { cor: 'default', texto: 'planejada' },
  EM_CONSTRUCAO: { cor: 'processing', texto: 'em construção' },
  PRONTA: { cor: 'success', texto: 'pronta' },
};

/** Aba de uma funcionalidade que ainda não abriu: o que ela vai fazer, o que guarda e com o que se liga. */
const FuncionalidadeEmBreve: React.FC<{ f: Funcionalidade }> = ({ f }) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert type="info" showIcon icon={ICONE[f.chave]}
      message={<span>{f.titulo} <Tag color={SITUACAO[f.situacao].cor}>{SITUACAO[f.situacao].texto}</Tag><Tag>etapa {f.etapa}</Tag></span>}
      description={f.resumo} />
    <Row gutter={[12, 12]}>
      <Col xs={24} lg={10}>
        <Card size="small" title="O que vai fazer" style={{ height: '100%' }}>
          <List size="small" dataSource={f.oQueFaz} renderItem={x => <List.Item style={{ padding: '4px 0' }}>• {x}</List.Item>} />
        </Card>
      </Col>
      <Col xs={24} lg={7}>
        <Card size="small" title="O que guarda" style={{ height: '100%' }}>
          <Space size={[4, 6]} wrap>{f.dados.map(d => <Tag key={d}>{d}</Tag>)}</Space>
        </Card>
      </Col>
      <Col xs={24} lg={7}>
        <Card size="small" title="Liga com o ERP" style={{ height: '100%' }}>
          <List size="small" dataSource={f.ligaCom} renderItem={x => <List.Item style={{ padding: '4px 0' }}><Text type="secondary">{x}</Text></List.Item>} />
        </Card>
      </Col>
    </Row>
  </Space>
);

const VisaoGeral: React.FC<{ onAbrir: (chave: string) => void }> = ({ onAbrir }) => {
  const etapas = etapasDoPlano();
  const atual = etapaAtual();
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Etapas do módulo">
        <Steps size="small" direction="vertical" current={etapas.findIndex(e => e.etapa === atual)}
          items={etapas.map(e => ({
            title: <span>Etapa {e.etapa}: {e.titulos.join(', ')}</span>,
            description: <Tag color={SITUACAO[e.situacao].cor}>{SITUACAO[e.situacao].texto}</Tag>,
            status: e.situacao === 'PRONTA' ? 'finish' : e.etapa === atual ? 'process' : 'wait',
          }))} />
      </Card>
      <Row gutter={[12, 12]}>
        {FUNCIONALIDADES.map(f => (
          <Col xs={24} md={12} xl={8} key={f.chave}>
            <Card size="small" hoverable onClick={() => onAbrir(f.chave)} style={{ height: '100%' }}
              title={<Space>{ICONE[f.chave]}{f.titulo}</Space>} extra={<Tag color={SITUACAO[f.situacao].cor}>{SITUACAO[f.situacao].texto}</Tag>}>
              <Paragraph type="secondary" style={{ marginBottom: 6 }}>{f.resumo}</Paragraph>
              <Text type="secondary" style={{ fontSize: 12 }}>Etapa {f.etapa} · liga com {f.ligaCom.join(', ')}</Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small" title={<Space><AlertOutlined /> Alertas da frota</Space>}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Manutenção vencendo, documento vencendo e consumo fora do normal aparecem aqui quando as etapas abrirem." />
      </Card>
    </Space>
  );
};

const FrotaPagina: React.FC = () => {
  const [aba, setAba] = useState('visao');
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}><CarOutlined /> Gestor de frotas</Title>
        <Text type="secondary">Veículos da loja, abastecimentos, manutenções, documentos, motoristas e viagens, com o custo de cada veículo indo para o financeiro.</Text>
      </div>
      <Tabs activeKey={aba} onChange={setAba} items={[
        { key: 'visao', label: <span><DashboardOutlined /> Visão geral</span>, children: <VisaoGeral onAbrir={setAba} /> },
        ...FUNCIONALIDADES.map(f => ({
          key: f.chave,
          label: <span style={{ opacity: f.situacao === 'PRONTA' ? 1 : 0.65 }}>{ICONE[f.chave]} {f.titulo}</span>,
          // a funcionalidade pronta mostra a tela dela; as outras, o que vão fazer
          children: f.chave === 'veiculos' ? <VeiculosAba /> : <FuncionalidadeEmBreve f={f} />,
        })),
      ]} />
    </div>
  );
};

export default FrotaPagina;

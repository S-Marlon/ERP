// Central › Primeiros passos (some quando tudo está feito) e a página "Mais ferramentas" (atalhos para as telas que
// não têm item próprio na barra lateral).
import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Flex, List, Progress, Row, Typography } from 'antd';
import { CheckCircleFilled, RightOutlined } from '@ant-design/icons';
import { agendaApi, materiaisApi, obrasApi, processoApi } from './obrasApi';
import { navPocos } from './navPocos';
import { ChavePasso, faltaComecar, PassoInicial, primeirosPassos } from './primeirosPassos';
import { enderecoDaSecao, secoesDoGrupo } from './secoesPocos';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const IR: Record<Exclude<ChavePasso, 'ORCAMENTO'>, () => void> = {
  EMPRESA: () => navPocos.ir({ aba: 'atendimento', subvista: 'CONFIG' }),
  CONTRATO: () => navPocos.ir({ aba: 'atendimento', subvista: 'CONFIG' }),
  EQUIPE: () => navPocos.ir({ aba: 'agenda', subvista: 'EQUIPE' }),
  EQUIPAMENTOS: () => navPocos.ir({ aba: 'agenda', subvista: 'EQUIPAMENTOS' }),
  MATERIAIS: () => navPocos.ir({ aba: 'obras', vista: 'MATERIAIS' }),
  CLIENTE: () => navPocos.ir({ aba: 'obras', vista: 'CLIENTES' }),
};

/** Quadro da Central enquanto o módulo não está pronto para o primeiro orçamento. */
export const PrimeirosPassos: React.FC<{ onOrcamento: () => void }> = ({ onOrcamento }) => {
  const [passos, setPassos] = useState<PassoInicial[] | null>(null);
  useEffect(() => {
    Promise.all([
      processoApi.config(), agendaApi.equipe(true), agendaApi.equipamentos(true), materiaisApi.cadastro(), obrasApi.clientes(), obrasApi.obras(),
    ]).then(([c, equipe, equipamentos, materiais, clientes, obras]) => setPassos(primeirosPassos({
      empresaNome: c.empresaNome, empresaTelefone: c.empresaTelefone, logo: c.logo, responsavelTecnico: c.responsavelTecnico, foroCidade: c.foroCidade,
      equipe: equipe.length, equipamentos: equipamentos.length, materiais: materiais.length, clientes: clientes.length, obras: obras.length,
    }))).catch(() => setPassos(null));
  }, []);
  if (!passos || !faltaComecar(passos)) return null;
  const feitos = passos.filter(p => p.feito).length;
  return (
    <Card size="small" title="Primeiros passos" style={{ borderColor: '#91caff' }}
      extra={<Flex align="center" gap={8}><Text type="secondary">{feitos} de {passos.length}</Text>
        <Progress percent={Math.round((feitos / passos.length) * 100)} size="small" style={{ width: 120, margin: 0 }} showInfo={false} /></Flex>}>
      <List
        size="small"
        dataSource={passos}
        renderItem={p => (
          <List.Item
            style={{ opacity: p.feito ? 0.55 : 1 }}
            actions={p.feito ? [] : [
              <Button key="ir" size="small" type={p.chave === 'ORCAMENTO' ? 'primary' : 'default'}
                onClick={() => (p.chave === 'ORCAMENTO' ? onOrcamento() : IR[p.chave]())}>
                {p.chave === 'ORCAMENTO' ? 'Orçamento rápido' : 'Fazer'} <RightOutlined />
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={p.feito ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} /> : <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #bfbfbf', borderRadius: '50%' }} />}
              title={<span style={{ textDecoration: p.feito ? 'line-through' : undefined }}>{p.titulo}</span>}
              description={p.feito ? undefined : p.descricao}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

/** "Mais ferramentas": um cartão por tela do grupo, com o que ela faz. */
export const MaisFerramentas: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Row gutter={[12, 12]}>
      {secoesDoGrupo('mais').filter(s => s.descricao).map(s => (
        <Col key={s.secao} xs={24} md={12} lg={8}>
          <Card size="small" hoverable onClick={() => navigate(enderecoDaSecao(s))} style={{ height: '100%' }}>
            <Flex justify="space-between" align="center">
              <Text strong style={{ fontSize: 15 }}>{s.titulo}</Text>
              <RightOutlined style={{ color: '#8c8c8c' }} />
            </Flex>
            <Text type="secondary">{s.descricao}</Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

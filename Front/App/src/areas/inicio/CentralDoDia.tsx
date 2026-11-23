// Página inicial: a central do dia. O que está atrasado, o que é para hoje, o que vence na semana e sugestões para girar
// o estoque e melhorar o lucro, tudo calculado dos dados (nota começada, inventário a contar, contas, pedidos, preços,
// curva ABC...). Cada tarefa leva direto à tela que resolve; quando resolvida, some sozinha.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Empty, Flex, Row, Segmented, Skeleton, Space, Tag, Tooltip, Typography, theme } from 'antd';
import {
  AuditOutlined, CalculatorOutlined, DollarOutlined, FileSearchOutlined, InboxOutlined, ReloadOutlined, ShopOutlined,
  ShoppingCartOutlined, TagsOutlined, WalletOutlined,
} from '@ant-design/icons';
import { AREAS, AreaTarefa, buscarTarefas, dataPorExtenso, Nivel, NIVEIS, RespostaTarefas, saudacao, Tarefa } from './inicioApi';
import { operadorAtual } from '../vendas/caixa/caixaApi';

const { Text, Title } = Typography;

const ICONE_AREA: Record<AreaTarefa, React.ReactNode> = {
  CAIXA: <WalletOutlined />, VENDAS: <ShopOutlined />, COMPRAS: <ShoppingCartOutlined />, ESTOQUE: <InboxOutlined />,
  FINANCEIRO: <DollarOutlined />, PRECOS: <TagsOutlined />, MANUAL: <AuditOutlined />,
};
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Atalhos do dia a dia (abrem a tela direto). */
const ATALHOS = [
  { rotulo: 'PDV', rota: '/vendas/pdv', icone: <ShopOutlined /> },
  { rotulo: 'Entrada de NF', rota: '/compras/entrada-nfe', icone: <FileSearchOutlined /> },
  { rotulo: 'Orçamentos', rota: '/vendas/orcamentos', icone: <CalculatorOutlined /> },
  { rotulo: 'Inventário', rota: '/estoque/inventario', icone: <AuditOutlined /> },
  { rotulo: 'Compra inteligente', rota: '/compras/inteligente', icone: <ShoppingCartOutlined /> },
  { rotulo: 'Onde focar', rota: '/estoque/onde-focar', icone: <TagsOutlined /> },
];

const CartaoTarefa: React.FC<{ t: Tarefa; onAbrir: (rota: string) => void }> = ({ t, onAbrir }) => {
  const { token } = theme.useToken();
  const cor = NIVEIS[t.nivel].cor;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px', borderRadius: token.borderRadius,
      border: `1px solid ${token.colorBorderSecondary}`, borderLeft: `3px solid ${cor}`, background: token.colorBgContainer }}>
      <div style={{ fontSize: 16, color: cor, paddingTop: 1 }}>{ICONE_AREA[t.area]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ display: 'block', lineHeight: 1.3 }}>{t.titulo}</Text>
        {t.detalhe && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t.detalhe}</Text>}
        {!!t.exemplos?.length && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }} ellipsis={{ tooltip: t.exemplos.join(' · ') }}>
            {t.exemplos.join(' · ')}
          </Text>
        )}
        <Space size={4} style={{ marginTop: 4 }}>
          <Tag style={{ margin: 0, fontSize: 10 }}>{AREAS[t.area]}</Tag>
          {t.valor ? <Tag style={{ margin: 0, fontSize: 10 }}>{brl(t.valor)}</Tag> : null}
        </Space>
      </div>
      <Button size="small" type={t.nivel === 'URGENTE' || t.nivel === 'HOJE' ? 'primary' : 'default'} onClick={() => onAbrir(t.rota)}>{t.acao}</Button>
    </div>
  );
};

const Bloco: React.FC<{ nivel: Nivel; tarefas: Tarefa[]; onAbrir: (rota: string) => void }> = ({ nivel, tarefas, onAbrir }) => (
  <Card size="small" styles={{ body: { padding: 10 } }}
    title={<Space><span style={{ color: NIVEIS[nivel].cor }}>{NIVEIS[nivel].titulo}</span><Badge count={tarefas.length} showZero color={NIVEIS[nivel].cor} /></Space>}>
    {tarefas.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={NIVEIS[nivel].vazio} style={{ margin: '8px 0' }} />
      : <Flex vertical gap={6}>{tarefas.map(t => <CartaoTarefa key={t.chave} t={t} onAbrir={onAbrir} />)}</Flex>}
  </Card>
);

export default function CentralDoDia() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<RespostaTarefas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [area, setArea] = useState<AreaTarefa | 'TODAS'>('TODAS');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setDados(await buscarTarefas()); } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar.'); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  // Volta para a central depois de resolver algo: recarrega ao focar a janela
  useEffect(() => {
    const aoFocar = () => carregar();
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, [carregar]);

  const tarefas = useMemo(() => (dados?.tarefas || []).filter(t => area === 'TODAS' || t.area === area), [dados, area]);
  const por = (n: Nivel) => tarefas.filter(t => t.nivel === n);
  const contagem = useMemo(() => {
    const m = new Map<AreaTarefa, number>();
    for (const t of dados?.tarefas || []) m.set(t.area, (m.get(t.area) || 0) + 1);
    return m;
  }, [dados]);
  const urgentes = (dados?.tarefas || []).filter(t => t.nivel === 'URGENTE').length;
  const deHoje = (dados?.tarefas || []).filter(t => t.nivel === 'HOJE').length;

  return (
    <div style={{ padding: 12 }}>
      <Flex justify="space-between" align="flex-end" wrap gap={12} style={{ marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{saudacao()}, {operadorAtual() === 'ADM' ? 'bem-vindo' : operadorAtual().split(' ')[0]}</Title>
          <Text type="secondary">
            {dados ? `${dataPorExtenso(dados.hoje)} · ` : ''}
            {dados ? (urgentes + deHoje === 0 ? 'nada pendente para hoje' : `${urgentes ? `${urgentes} atrasada${urgentes > 1 ? 's' : ''} · ` : ''}${deHoje} para hoje`) : 'carregando o dia...'}
          </Text>
        </div>
        <Space wrap>
          {ATALHOS.map(a => <Button key={a.rota} icon={a.icone} onClick={() => navigate(a.rota)}>{a.rotulo}</Button>)}
          <Tooltip title="Atualizar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Flex>

      {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 12 }} action={<Button size="small" onClick={carregar}>Tentar de novo</Button>} />}
      {!!dados?.fontesComErro.length && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Não foi possível verificar: ${dados.fontesComErro.join(', ')}. O resto da lista está certo.`} />
      )}

      <Segmented style={{ marginBottom: 12 }} value={area} onChange={v => setArea(v as AreaTarefa | 'TODAS')}
        options={[{ value: 'TODAS', label: `Todas (${dados?.tarefas.length ?? 0})` },
          ...(Object.keys(AREAS) as AreaTarefa[]).filter(a => contagem.get(a)).map(a => ({ value: a, label: `${AREAS[a]} (${contagem.get(a)})` }))]} />

      {!dados && carregando ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={14}>
            <Flex vertical gap={12}>
              <Bloco nivel="URGENTE" tarefas={por('URGENTE')} onAbrir={navigate} />
              <Bloco nivel="HOJE" tarefas={por('HOJE')} onAbrir={navigate} />
            </Flex>
          </Col>
          <Col xs={24} xl={10}>
            <Flex vertical gap={12}>
              <Bloco nivel="SEMANA" tarefas={por('SEMANA')} onAbrir={navigate} />
              <Bloco nivel="SUGESTAO" tarefas={por('SUGESTAO')} onAbrir={navigate} />
            </Flex>
          </Col>
        </Row>
      )}
    </div>
  );
}

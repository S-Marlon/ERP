// Página inicial: a central do dia. O que está atrasado, o que é para hoje, o que vence na semana e sugestões para girar
// o estoque e melhorar o lucro, tudo calculado dos dados (nota começada, inventário a contar, contas, pedidos, preços,
// curva ABC...), mais os lembretes do operador. Cada tarefa leva direto à tela que resolve; a automática some sozinha
// quando resolvida e pode ser adiada; o lembrete é marcado como feito.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Col, Drawer, Dropdown, Empty, Flex, Form, Input, List, Modal, Popconfirm, Row, Segmented, Skeleton, Space, Tag,
  Tooltip, Typography, message, theme,
} from 'antd';
import {
  AuditOutlined, CalculatorOutlined, CheckOutlined, ClockCircleOutlined, DeleteOutlined, DollarOutlined, DownOutlined, EditOutlined,
  FileSearchOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, ShopOutlined, ShoppingCartOutlined, TagsOutlined, WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  AREAS, AreaTarefa, buscarTarefas, dataPorExtenso, diaMes, inicioApi, Lembrete, Nivel, NIVEIS, Prioridade, QuandoAdiar, RespostaTarefas,
  saudacao, Tarefa,
} from './inicioApi';
import { operadorAtual } from '../vendas/caixa/caixaApi';
import { CampoData } from '../../shared/formularios/CamposNumero';

const { Text, Title } = Typography;

const ICONE_AREA: Record<AreaTarefa, React.ReactNode> = {
  CAIXA: <WalletOutlined />, VENDAS: <ShopOutlined />, COMPRAS: <ShoppingCartOutlined />, ESTOQUE: <InboxOutlined />,
  FINANCEIRO: <DollarOutlined />, PRECOS: <TagsOutlined />, MANUAL: <AuditOutlined />,
};
const PRIORIDADES: Array<{ value: Prioridade; label: string }> = [{ value: 'ALTA', label: 'Alta' }, { value: 'NORMAL', label: 'Normal' }, { value: 'BAIXA', label: 'Baixa' }];
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

interface Acoes {
  abrir: (rota: string) => void;
  adiar: (t: Tarefa, para: QuandoAdiar | 'ESCOLHER') => void;
  feito: (t: Tarefa) => void;
  editar: (t: Tarefa) => void;
  excluir: (t: Tarefa) => void;
}

const MenuAdiar: React.FC<{ t: Tarefa; acoes: Acoes }> = ({ t, acoes }) => (
  <Dropdown trigger={['click']} menu={{
    items: [{ key: 'AMANHA', label: 'Amanhã' }, { key: 'SEMANA', label: 'Daqui a uma semana' }, { key: 'ESCOLHER', label: 'Escolher a data...' }],
    onClick: ({ key }) => acoes.adiar(t, key as QuandoAdiar | 'ESCOLHER'),
  }}>
    <Tooltip title="Não dá para fazer agora: tira da lista até a data"><Button size="small" icon={<ClockCircleOutlined />}>Adiar <DownOutlined /></Button></Tooltip>
  </Dropdown>
);

const CartaoTarefa: React.FC<{ t: Tarefa; acoes: Acoes }> = ({ t, acoes }) => {
  const { token } = theme.useToken();
  const cor = NIVEIS[t.nivel].cor;
  const lembrete = t.area === 'MANUAL';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px', borderRadius: token.borderRadius,
      border: `1px solid ${token.colorBorderSecondary}`, borderLeft: `3px solid ${cor}`, background: lembrete ? token.colorFillQuaternary : token.colorBgContainer }}>
      <div style={{ fontSize: 16, color: cor, paddingTop: 1 }}>{ICONE_AREA[t.area]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ display: 'block', lineHeight: 1.3 }}>{t.titulo}</Text>
        {t.detalhe && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t.detalhe}</Text>}
        {!!t.exemplos?.length && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }} ellipsis={{ tooltip: t.exemplos.join(' · ') }}>
            {t.exemplos.join(' · ')}
          </Text>
        )}
        <Flex gap={4} wrap align="center" style={{ marginTop: 5 }}>
          <Tag style={{ margin: 0, fontSize: 10 }}>{lembrete ? 'Lembrete' : AREAS[t.area]}</Tag>
          {t.prioridade === 'ALTA' && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>Prioridade alta</Tag>}
          {t.responsavel && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{t.responsavel}</Tag>}
          {t.valor ? <Tag style={{ margin: 0, fontSize: 10 }}>{brl(t.valor)}</Tag> : null}
          <span style={{ flex: 1 }} />
          {lembrete ? (
            <Space size={4}>
              <Tooltip title="Editar"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => acoes.editar(t)} /></Tooltip>
              <Popconfirm title="Excluir o lembrete?" okText="Excluir" okButtonProps={{ danger: true }} cancelText="Não" onConfirm={() => acoes.excluir(t)}>
                <Tooltip title="Excluir"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
              </Popconfirm>
              <MenuAdiar t={t} acoes={acoes} />
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => acoes.feito(t)}>Feito</Button>
            </Space>
          ) : (
            <Space size={4}>
              <MenuAdiar t={t} acoes={acoes} />
              <Button size="small" type={t.nivel === 'URGENTE' || t.nivel === 'HOJE' ? 'primary' : 'default'} onClick={() => acoes.abrir(t.rota)}>{t.acao}</Button>
            </Space>
          )}
        </Flex>
      </div>
    </div>
  );
};

const Bloco: React.FC<{ nivel: Nivel; tarefas: Tarefa[]; acoes: Acoes }> = ({ nivel, tarefas, acoes }) => (
  <Card size="small" styles={{ body: { padding: 10 } }}
    title={<Space><span style={{ color: NIVEIS[nivel].cor }}>{NIVEIS[nivel].titulo}</span><Badge count={tarefas.length} showZero color={NIVEIS[nivel].cor} /></Space>}>
    {tarefas.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={NIVEIS[nivel].vazio} style={{ margin: '8px 0' }} />
      : <Flex vertical gap={6}>{tarefas.map(t => <CartaoTarefa key={t.chave} t={t} acoes={acoes} />)}</Flex>}
  </Card>
);

type FormLembrete = { titulo: string; descricao?: string; vencimento?: dayjs.Dayjs | null; prioridade: Prioridade; responsavel?: string };

export default function CentralDoDia() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<RespostaTarefas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [area, setArea] = useState<AreaTarefa | 'TODAS'>('TODAS');
  // Lembrete: criar (id null) ou editar
  const [lembrete, setLembrete] = useState<{ id: number | null } | null>(null);
  const [formLembrete] = Form.useForm<FormLembrete>();
  const [salvando, setSalvando] = useState(false);
  // Adiar escolhendo a data
  const [adiandoEm, setAdiandoEm] = useState<Tarefa | null>(null);
  const [dataAdiar, setDataAdiar] = useState<dayjs.Dayjs | null>(null);
  // Listas do rodapé
  const [painel, setPainel] = useState<'ADIADAS' | 'AGENDADOS' | 'FEITOS' | null>(null);
  const [feitos, setFeitos] = useState<Array<{ id: number; titulo: string; concluidaPor: string | null; concluidaEm: string }>>([]);

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

  const fazer = async (acao: () => Promise<unknown>, ok: string) => {
    try { await acao(); message.success(ok); await carregar(); } catch (e) { message.error(e instanceof Error ? e.message : 'Não foi possível.'); }
  };

  const textoAdiado = (ate: string) => `Adiada para ${dayjs(ate).format('DD/MM')}.`;
  const adiar = async (t: Tarefa, para: QuandoAdiar | 'ESCOLHER') => {
    if (para === 'ESCOLHER') { setAdiandoEm(t); setDataAdiar(dayjs().add(2, 'day')); return; }
    try {
      const r = t.idTarefa ? await inicioApi.adiarLembrete(t.idTarefa, para) : await inicioApi.adiarTarefa(t.chave, t.titulo, para);
      message.success(textoAdiado(r.ate));
      await carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Não foi possível adiar.'); }
  };

  const abrirLembrete = (t?: Tarefa | Lembrete) => {
    const id = t ? ('idTarefa' in t ? t.idTarefa ?? null : (t as Lembrete).id) : null;
    formLembrete.setFieldsValue({
      titulo: t?.titulo || '', descricao: t?.descricao || '', prioridade: t?.prioridade || 'NORMAL', responsavel: t?.responsavel || '',
      vencimento: t?.vencimento ? dayjs(t.vencimento) : null,
    });
    setLembrete({ id });
  };

  const salvarLembrete = async () => {
    const v = await formLembrete.validateFields();
    const d = { titulo: v.titulo, descricao: v.descricao || null, prioridade: v.prioridade, responsavel: v.responsavel || null, vencimento: v.vencimento ? v.vencimento.format('YYYY-MM-DD') : null };
    setSalvando(true);
    try {
      if (lembrete?.id) await inicioApi.editarLembrete(lembrete.id, d); else await inicioApi.criarLembrete(d);
      message.success(lembrete?.id ? 'Lembrete salvo.' : 'Lembrete criado.');
      setLembrete(null);
      await carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { setSalvando(false); }
  };

  const acoes: Acoes = {
    abrir: rota => navigate(rota),
    adiar,
    feito: t => t.idTarefa && fazer(() => inicioApi.situacao(t.idTarefa!, 'FEITA'), 'Feito!'),
    editar: t => abrirLembrete(t),
    excluir: t => t.idTarefa && fazer(() => inicioApi.situacao(t.idTarefa!, 'CANCELADA'), 'Lembrete excluído.'),
  };

  const abrirPainel = async (p: 'ADIADAS' | 'AGENDADOS' | 'FEITOS') => {
    setPainel(p);
    if (p === 'FEITOS') { try { setFeitos(await inicioApi.feitos()); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } }
  };

  const tarefas = useMemo(() => (dados?.tarefas || []).filter(t => area === 'TODAS' || t.area === area), [dados, area]);
  const por = (n: Nivel) => tarefas.filter(t => t.nivel === n);
  const contagem = useMemo(() => {
    const m = new Map<AreaTarefa, number>();
    for (const t of dados?.tarefas || []) m.set(t.area, (m.get(t.area) || 0) + 1);
    return m;
  }, [dados]);
  const urgentes = (dados?.tarefas || []).filter(t => t.nivel === 'URGENTE').length;
  const deHoje = (dados?.tarefas || []).filter(t => t.nivel === 'HOJE').length;
  const nome = operadorAtual();

  return (
    <div style={{ padding: 12 }}>
      <Flex justify="space-between" align="flex-end" wrap gap={12} style={{ marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{saudacao()}, {nome === 'ADM' ? 'bem-vindo' : nome.split(' ')[0]}</Title>
          <Text type="secondary">
            {dados ? `${dataPorExtenso(dados.hoje)} · ` : ''}
            {dados ? (urgentes + deHoje === 0 ? 'nada pendente para hoje' : `${urgentes ? `${urgentes} atrasada${urgentes > 1 ? 's' : ''} · ` : ''}${deHoje} para hoje`) : 'carregando o dia...'}
            {dados?.feitasHoje ? ` · ${dados.feitasHoje} feita${dados.feitasHoje > 1 ? 's' : ''} hoje` : ''}
          </Text>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirLembrete()}>Lembrete</Button>
          {ATALHOS.map(a => <Button key={a.rota} icon={a.icone} onClick={() => navigate(a.rota)}>{a.rotulo}</Button>)}
          <Tooltip title="Atualizar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Flex>

      {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 12 }} action={<Button size="small" onClick={carregar}>Tentar de novo</Button>} />}
      {!!dados?.fontesComErro.length && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Não foi possível verificar: ${dados.fontesComErro.join(', ')}. O resto da lista está certo.`} />
      )}

      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <Segmented value={area} onChange={v => setArea(v as AreaTarefa | 'TODAS')}
          options={[{ value: 'TODAS', label: `Todas (${dados?.tarefas.length ?? 0})` },
            ...(Object.keys(AREAS) as AreaTarefa[]).filter(a => contagem.get(a)).map(a => ({ value: a, label: `${AREAS[a]} (${contagem.get(a)})` }))]} />
        <Space size={4} wrap>
          <Button size="small" type="link" disabled={!dados?.adiadas.length} onClick={() => abrirPainel('ADIADAS')}>{dados?.adiadas.length ?? 0} adiada(s)</Button>
          <Button size="small" type="link" disabled={!dados?.agendados.length} onClick={() => abrirPainel('AGENDADOS')}>{dados?.agendados.length ?? 0} lembrete(s) mais adiante</Button>
          <Button size="small" type="link" onClick={() => abrirPainel('FEITOS')}>Feitos</Button>
        </Space>
      </Flex>

      {!dados && carregando ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={14}>
            <Flex vertical gap={12}>
              <Bloco nivel="URGENTE" tarefas={por('URGENTE')} acoes={acoes} />
              <Bloco nivel="HOJE" tarefas={por('HOJE')} acoes={acoes} />
            </Flex>
          </Col>
          <Col xs={24} xl={10}>
            <Flex vertical gap={12}>
              <Bloco nivel="SEMANA" tarefas={por('SEMANA')} acoes={acoes} />
              <Bloco nivel="SUGESTAO" tarefas={por('SUGESTAO')} acoes={acoes} />
            </Flex>
          </Col>
        </Row>
      )}

      {/* Lembrete: criar ou editar */}
      <Modal open={!!lembrete} title={lembrete?.id ? 'Editar lembrete' : 'Novo lembrete'} okText="Salvar" cancelText="Cancelar"
        onOk={salvarLembrete} confirmLoading={salvando} onCancel={() => setLembrete(null)} destroyOnHidden>
        <Form form={formLembrete} layout="vertical" requiredMark={false} initialValues={{ prioridade: 'NORMAL' }}>
          <Form.Item name="titulo" label="O que fazer" rules={[{ required: true, whitespace: true, min: 3, message: 'Escreva o que precisa ser feito.' }]}>
            <Input autoFocus maxLength={150} placeholder="Ex.: ligar para a IMDEPA sobre o pedido 45" />
          </Form.Item>
          <Form.Item name="descricao" label="Detalhes"><Input.TextArea rows={2} maxLength={500} /></Form.Item>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="vencimento" label="Até quando" extra="Sem data: fica em Esta semana (prioridade alta: em Hoje).">
                <CampoData style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={14}><Form.Item name="prioridade" label="Prioridade"><Segmented block options={PRIORIDADES} /></Form.Item></Col>
            <Col span={24}><Form.Item name="responsavel" label="Quem faz" extra="Vazio = qualquer um."><Input maxLength={60} placeholder={nome === 'ADM' ? '' : nome} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Adiar escolhendo a data */}
      <Modal open={!!adiandoEm} title="Adiar até" okText="Adiar" cancelText="Cancelar" width={360} destroyOnHidden
        okButtonProps={{ disabled: !dataAdiar || !dataAdiar.isAfter(dayjs(), 'day') }}
        onOk={async () => { const t = adiandoEm!; setAdiandoEm(null); await adiar(t, dataAdiar!.format('YYYY-MM-DD')); }}
        onCancel={() => setAdiandoEm(null)}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{adiandoEm?.titulo}</Text>
        <CampoData style={{ width: '100%' }} value={dataAdiar} onChange={d => setDataAdiar(Array.isArray(d) ? d[0] ?? null : d)} disabledDate={d => !d.isAfter(dayjs(), 'day')} />
      </Modal>

      {/* Adiadas, lembretes mais adiante e feitos */}
      <Drawer open={!!painel} onClose={() => setPainel(null)} width={460} destroyOnHidden
        title={painel === 'ADIADAS' ? 'Tarefas adiadas' : painel === 'AGENDADOS' ? 'Lembretes mais adiante' : 'Lembretes feitos (7 dias)'}>
        {painel === 'ADIADAS' && (
          <List dataSource={dados?.adiadas || []} locale={{ emptyText: 'Nada adiado.' }} renderItem={a => (
            <List.Item actions={[<Button key="v" size="small" onClick={() => fazer(() => inicioApi.desfazerAdiamento(a.chave), 'A tarefa voltou para a lista.')}>Voltar agora</Button>]}>
              <List.Item.Meta title={a.titulo} description={`Volta em ${diaMes(a.ate)} (se ainda estiver pendente).`} />
            </List.Item>
          )} />
        )}
        {painel === 'AGENDADOS' && (
          <List dataSource={dados?.agendados || []} locale={{ emptyText: 'Nenhum.' }} renderItem={l => (
            <List.Item actions={[<Button key="e" size="small" icon={<EditOutlined />} onClick={() => { setPainel(null); abrirLembrete(l); }}>Editar</Button>]}>
              <List.Item.Meta title={<Space>{l.titulo}{l.prioridade === 'ALTA' && <Tag color="red">Alta</Tag>}</Space>}
                description={[l.vencimento && `Até ${diaMes(l.vencimento)}`, l.responsavel, l.descricao].filter(Boolean).join(' · ')} />
            </List.Item>
          )} />
        )}
        {painel === 'FEITOS' && (
          <List dataSource={feitos} locale={{ emptyText: 'Nenhum lembrete feito nos últimos 7 dias.' }} renderItem={f => (
            <List.Item actions={[<Button key="r" size="small" onClick={async () => { await fazer(() => inicioApi.situacao(f.id, 'ABERTA'), 'Lembrete reaberto.'); setFeitos(await inicioApi.feitos()); }}>Reabrir</Button>]}>
              <List.Item.Meta title={<Text delete>{f.titulo}</Text>} description={`${dayjs(f.concluidaEm).format('DD/MM HH:mm')}${f.concluidaPor ? ` · ${f.concluidaPor}` : ''}`} />
            </List.Item>
          )} />
        )}
      </Drawer>
    </div>
  );
}

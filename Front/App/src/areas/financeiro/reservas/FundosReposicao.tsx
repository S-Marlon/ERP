// Financeiro › Fundos de reposição: dinheiro separado do capital de giro para recomprar itens caros (fios, bombas,
// irrigação, rolamentos, óleos). Cada venda das categorias do fundo soma o custo; cada compra pela NF tira; ajustes à mão.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Drawer, Empty, Flex, Input, Modal, Popconfirm, Progress, Row, Space, Statistic, Switch, Table, Tag, Tooltip, TreeSelect, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { DadosFundo, Fundo, ListaFundos, MovimentoFundo, reservasApi } from './reservasApi';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { FORMATOS_DATA } from '../../../shared/formularios/numeros';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s: string) => s.split('-').reverse().join('/');
const COR_TIPO: Record<MovimentoFundo['tipo'], string> = { VENDA: 'green', DEVOLUCAO: 'orange', COMPRA: 'red', AJUSTE: 'blue', INICIAL: 'purple' };
const ROTULO_TIPO: Record<MovimentoFundo['tipo'], string> = { VENDA: 'Vendas', DEVOLUCAO: 'Devolução', COMPRA: 'Compra', AJUSTE: 'Ajuste', INICIAL: 'Inicial' };

const ModalFundo: React.FC<{ aberto: Fundo | 'NOVO' | null; lista: ListaFundos; onFechar: () => void; onSalvo: () => void }> = ({ aberto, lista, onFechar, onSalvo }) => {
  const [d, setD] = useState<DadosFundo>({ nome: '', categorias: [], percentualCusto: 1, saldoInicial: 0, dataInicio: dayjs().format('YYYY-MM-DD'), ativo: true });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setD(aberto === 'NOVO'
      ? { nome: '', categorias: [], percentualCusto: 1, saldoInicial: 0, dataInicio: dayjs().format('YYYY-MM-DD'), ativo: true }
      : { nome: aberto.nome, categorias: aberto.categorias, percentualCusto: aberto.percentualCusto, saldoInicial: aberto.saldoInicial, dataInicio: aberto.dataInicio, ativo: aberto.ativo });
  }, [aberto]);
  const arvore = useMemo(() => {
    const filhos = (pai: number | null): any[] => lista.categorias.filter(c => c.pai === pai).map(c => ({ value: c.id, title: c.nome, children: filhos(c.id) }));
    return filhos(null);
  }, [lista.categorias]);
  const fundoDe = (cat: number) => lista.fundos.find(f => f.categorias.includes(cat) && (aberto === 'NOVO' || f.id !== aberto?.id));
  const salvar = async () => {
    setSalvando(true);
    try {
      if (aberto === 'NOVO') await reservasApi.criar(d); else if (aberto) await reservasApi.salvar(aberto.id, d);
      message.success('Fundo salvo.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setSalvando(false); }
  };
  return (
    <Modal open={!!aberto} title={aberto === 'NOVO' ? 'Novo fundo de reposição' : `Fundo ${aberto?.nome ?? ''}`} onCancel={onFechar} onOk={salvar}
      okText="Salvar" cancelText="Voltar" confirmLoading={salvando} okButtonProps={{ disabled: !d.nome.trim() || !d.categorias.length }} destroyOnHidden width={620}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input placeholder="Nome (ex.: Fios e cabos)" value={d.nome} maxLength={80} onChange={e => setD({ ...d, nome: e.target.value })} />
        <TreeSelect style={{ width: '100%' }} treeData={arvore} multiple showSearch treeNodeFilterProp="title" placeholder="Categorias do fundo (a subcategoria acompanha)"
          value={d.categorias} onChange={v => setD({ ...d, categorias: v as number[] })} popupMatchSelectWidth={false} allowClear
          tagRender={({ value, closable, onClose }) => {
            const outro = fundoDe(Number(value));
            return <Tag closable={closable} onClose={onClose} color={outro ? 'orange' : undefined} style={{ marginInlineEnd: 4 }}>
              {lista.categorias.find(c => c.id === Number(value))?.nome}{outro ? ` (sai de ${outro.nome})` : ''}</Tag>;
          }} />
        <Flex gap={8} wrap align="center">
          <Text style={{ width: 210 }}>Separar do custo vendido</Text>
          <CampoNumero min={1} max={300} suffix="%" value={Math.round(d.percentualCusto * 100)} onChange={v => setD({ ...d, percentualCusto: (Number(v) || 100) / 100 })} />
          <Text type="secondary" style={{ fontSize: 12 }}>100% = o custo; 110% cobre aumento do fornecedor</Text>
        </Flex>
        <Flex gap={8} wrap align="center">
          <Text style={{ width: 210 }}>Já separado hoje (saldo inicial)</Text>
          <CampoDinheiro style={{ width: 160 }} value={d.saldoInicial} onChange={v => setD({ ...d, saldoInicial: Number(v) || 0 })} />
        </Flex>
        <Flex gap={8} wrap align="center">
          <Text style={{ width: 210 }}>Contar vendas e compras desde</Text>
          <DatePicker format={FORMATOS_DATA} value={dayjs(d.dataInicio)} allowClear={false} onChange={v => v && setD({ ...d, dataInicio: v.format('YYYY-MM-DD') })} />
        </Flex>
        <Alert type="info" showIcon title="Use a data de hoje e informe o que já está separado. Uma data antiga faz as compras de antes (como a carga inicial do estoque) saírem do fundo." />
        {aberto !== 'NOVO' && <Space><Switch checked={d.ativo} onChange={v => setD({ ...d, ativo: v })} /><Text>Ativo (entra no total separado)</Text></Space>}
      </Space>
    </Modal>
  );
};

const ExtratoFundo: React.FC<{ id: number | null; onFechar: () => void; onMudou: () => void }> = ({ id, onFechar, onMudou }) => {
  const [f, setF] = useState<Fundo | null>(null);
  const [aj, setAj] = useState({ data: dayjs().format('YYYY-MM-DD'), valor: null as number | null, motivo: '' });
  const carregar = () => id && reservasApi.extrato(id).then(setF).catch(e => message.error(e.message));
  useEffect(() => { setF(null); setAj({ data: dayjs().format('YYYY-MM-DD'), valor: null, motivo: '' }); carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null;
  const lancar = async () => {
    try { await reservasApi.ajuste(id, { ...aj, valor: aj.valor as number }); message.success('Ajuste lançado.'); setAj({ ...aj, valor: null, motivo: '' }); carregar(); onMudou(); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  return (
    <Drawer open={!!id} onClose={onFechar} width="min(900px, 100vw)" destroyOnHidden loading={!f} title={f ? `Extrato · ${f.nome}` : 'Extrato'}>
      {f && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={10}>
            <Col span={6}><Statistic title="Saldo" value={brl(f.resumo.saldo)} valueStyle={{ color: f.resumo.saldo < 0 ? '#cf1322' : '#389e0d' }} /></Col>
            <Col span={6}><Statistic title="Entrou (vendas)" value={brl(f.resumo.entradas)} /></Col>
            <Col span={6}><Statistic title="Saiu (compras)" value={brl(f.resumo.compras)} /></Col>
            <Col span={6}><Statistic title="Ajustes e inicial" value={brl(f.resumo.ajustes)} /></Col>
          </Row>
          <Card size="small" title="Lançar ajuste">
            <Flex gap={8} wrap>
              <DatePicker format={FORMATOS_DATA} value={dayjs(aj.data)} allowClear={false} onChange={v => v && setAj({ ...aj, data: v.format('YYYY-MM-DD') })} />
              <CampoDinheiro style={{ width: 150 }} placeholder="+ soma / − tira" value={aj.valor} onChange={v => setAj({ ...aj, valor: v === null ? null : Number(v) })} />
              <Input style={{ flex: '1 1 240px' }} placeholder="Motivo (ex.: transferi para a conta reserva, usei para pagar o aluguel)" maxLength={150} value={aj.motivo} onChange={e => setAj({ ...aj, motivo: e.target.value })} />
              <Button type="primary" icon={<PlusOutlined />} disabled={!aj.valor || !aj.motivo.trim()} onClick={lancar}>Lançar</Button>
            </Flex>
          </Card>
          <Table size="small" rowKey={(m, k) => `${m.data}-${m.tipo}-${k}`} pagination={{ pageSize: 50, hideOnSinglePage: true }} dataSource={f.extrato || []}
            locale={{ emptyText: <Empty description="Sem movimentos desde a data de início." /> }}
            columns={[
              { title: 'Data', dataIndex: 'data', width: 95, render: (v: string) => dataBr(v) },
              { title: '', dataIndex: 'tipo', width: 95, render: (v: MovimentoFundo['tipo']) => <Tag color={COR_TIPO[v]}>{ROTULO_TIPO[v]}</Tag> },
              { title: 'Descrição', dataIndex: 'descricao', render: (v: string, m) => <>{v}{m.compraAcimaDoSaldo && <Tooltip title="O fundo não tinha esse valor: parte da compra saiu do capital de giro"> <WarningOutlined style={{ color: '#d48806' }} /></Tooltip>}</> },
              { title: 'Valor', dataIndex: 'valor', width: 120, align: 'right' as const, render: (v: number) => <Text type={v < 0 ? 'danger' : 'success'}>{brl(v)}</Text> },
              { title: 'Saldo', dataIndex: 'saldo', width: 120, align: 'right' as const, render: (v: number) => <Text strong type={v < 0 ? 'danger' : undefined}>{brl(v)}</Text> },
              {
                title: '', key: 'x', width: 40, render: (_, m) => m.idAjuste ? (
                  <Popconfirm title="Excluir o ajuste?" onConfirm={() => reservasApi.excluirAjuste(id, m.idAjuste!).then(() => { carregar(); onMudou(); }).catch(e => message.error(e.message))}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>) : null,
              },
            ]} />
        </Space>
      )}
    </Drawer>
  );
};

const FundosReposicao: React.FC = () => {
  const [lista, setLista] = useState<ListaFundos | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<Fundo | 'NOVO' | null>(null);
  const [extrato, setExtrato] = useState<number | null>(null);
  const carregar = async () => {
    setCarregando(true);
    try { setLista(await reservasApi.listar()); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);
  if (!lista) return <div style={{ padding: 16 }}><Card loading /></div>;
  const ativos = lista.fundos.filter(f => f.ativo);
  const mes = ativos.reduce((a, f) => ({ e: a.e + f.resumo.entradasMes, c: a.c + f.resumo.comprasMes }), { e: 0, c: 0 });

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Fundos de reposição</Title>
            <Text type="secondary">Dinheiro separado do capital de giro para recomprar itens caros: cada venda soma o custo, cada compra pela NF tira.</Text>
          </div>
          <Space><Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditando('NOVO')}>Novo fundo</Button></Space>
        </Flex>
        <Row gutter={10}>
          <Col xs={12} md={6}><Card size="small"><Tooltip title="Soma dos saldos dos fundos ativos: este valor não é capital de giro">
            <Statistic title="Total que deveria estar separado" value={brl(lista.totalSeparado)} valueStyle={{ color: lista.totalSeparado < 0 ? '#cf1322' : '#389e0d' }} /></Tooltip></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Estoque dessas categorias" value={brl(lista.totalEstoque)} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Entrou este mês (vendas)" value={brl(mes.e)} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Saiu este mês (compras)" value={brl(mes.c)} /></Card></Col>
        </Row>
        {!lista.fundos.length && <Card><Empty description="Nenhum fundo ainda. Crie um para cada grupo que você separa (fios e cabos, bombas, irrigação, rolamentos, óleos)." /></Card>}
        <Row gutter={[12, 12]}>
          {lista.fundos.map(f => {
            const cob = f.resumo.cobertura;
            return (
              <Col key={f.id} xs={24} md={12} xl={8}>
                <Card size="small" style={{ opacity: f.ativo ? 1 : 0.55 }}
                  title={<Space>{f.nome}{!f.ativo && <Tag>inativo</Tag>}{f.percentualCusto !== 1 && <Tag>{Math.round(f.percentualCusto * 100)}% do custo</Tag>}</Space>}
                  extra={<Space size={2}>
                    <Button size="small" onClick={() => setExtrato(f.id)}>Extrato</Button>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditando(f)} />
                    <Popconfirm title="Excluir o fundo? Os ajustes dele somem (vendas e compras não mudam)." onConfirm={() => reservasApi.excluir(f.id).then(carregar).catch(e => message.error(e.message))}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>}>
                  <Flex justify="space-between" align="baseline">
                    <Text type="secondary">Deveria ter separado</Text>
                    <Text strong style={{ fontSize: 22, color: f.resumo.saldo < 0 ? '#cf1322' : '#389e0d' }}>{brl(f.resumo.saldo)}</Text>
                  </Flex>
                  <Tooltip title="Quanto do estoque dessas categorias o saldo consegue recomprar">
                    <Progress percent={cob === null ? 0 : Math.max(0, Math.min(100, Math.round(cob * 100)))} size="small"
                      format={() => (cob === null ? 'sem estoque' : `${Math.round(cob * 100)}% do estoque`)} status={cob !== null && cob < 0.3 ? 'exception' : undefined} />
                  </Tooltip>
                  <Text type="secondary" style={{ fontSize: 12 }}>Estoque {brl(f.resumo.estoque)} · este mês +{brl(f.resumo.entradasMes)} / −{brl(f.resumo.comprasMes)} · desde {dataBr(f.dataInicio)}</Text>
                  {f.resumo.saldo < 0 && <Alert type="warning" showIcon style={{ marginTop: 6, padding: '2px 8px' }} title={`Faltam ${brl(-f.resumo.saldo)}: compras pagas com o capital de giro`} />}
                  {(f.ultimos || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>{f.ultimos!.map((m, k) => (
                      <Flex key={k} justify="space-between" style={{ fontSize: 12 }}>
                        <Text type="secondary" ellipsis style={{ maxWidth: '70%' }}>{dataBr(m.data)} · {m.descricao}</Text>
                        <Text type={m.valor < 0 ? 'danger' : 'success'}>{brl(m.valor)}</Text>
                      </Flex>
                    ))}</div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Space>
      <ModalFundo aberto={editando} lista={lista} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      <ExtratoFundo id={extrato} onFechar={() => setExtrato(null)} onMudou={carregar} />
    </div>
  );
};

export default FundosReposicao;

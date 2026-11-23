// Vendas › Pedidos faturados: venda para empresa com entrega depois. O orçamento vira pedido (reserva o material), é
// faturado com a NF-e emitida no emissor da loja (número/chave) e as parcelas no contas a receber (boleto gerado no banco:
// cola a linha digitável), e é entregue de uma vez (baixa do estoque). Não passa pelo caixa.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Drawer, Empty, Flex, Input, Modal, Row, Segmented, Select, Space, Steps, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CarOutlined, CopyOutlined, DeleteOutlined, FileDoneOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, SaveOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ErroPedido, ETAPAS, formatarLinhaDigitavel, ParcelaPedido, PedidoFaturadoDetalhe, PedidoFaturadoResumo, pedidosFaturadosApi,
} from './pedidosFaturadosApi';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { FORMATOS_DATA } from '../../../shared/formularios/numeros';
import { htmlRomaneio } from './romaneio';
import { imprimirHtml } from '../../../shared/core/impressao/saida';
import { lerConfiguracoes } from '../../../shared/core/configuracoes/configuracoes';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s?: string | null) => (s ? `${s.slice(0, 10).split('-').reverse().join('/')}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '—');
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const hoje = () => dayjs().format('YYYY-MM-DD');
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const ROTULO_FORMA: Record<string, string> = { BOLETO: 'Boleto', PIX: 'PIX', DEPOSITO: 'Depósito', DINHEIRO: 'Dinheiro', CHEQUE: 'Cheque' };

// ------------------------------------------------------------------ ficha do pedido

const FichaPedido: React.FC<{ id: number | null; onFechar: () => void; onMudou: () => void }> = ({ id, onFechar, onMudou }) => {
  const [d, setD] = useState<PedidoFaturadoDetalhe | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState({ previsaoEntrega: null as string | null, enderecoEntrega: '', pedidoCliente: '', observacao: '' });
  const [nota, setNota] = useState({ numero: null as number | null, serie: 1, chave: '', emitidaEm: hoje() });
  const [parcelas, setParcelas] = useState<ParcelaPedido[]>([]);
  const [recebidoPor, setRecebidoPor] = useState('');
  const [boletos, setBoletos] = useState<Record<number, string>>({});
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [notaCancelada, setNotaCancelada] = useState(false);

  const carregar = async () => {
    if (!id) return;
    try {
      const x = await pedidosFaturadosApi.detalhe(id);
      setD(x);
      setDados({ previsaoEntrega: x.previsaoEntrega, enderecoEntrega: x.enderecoEntrega || '', pedidoCliente: x.pedidoCliente || '', observacao: x.observacao || '' });
      setParcelas(x.parcelasSugeridas);
      setBoletos(Object.fromEntries(x.parcelas.map(p => [p.idTitulo!, p.codigoBarras || ''])));
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao abrir.'); onFechar(); }
  };
  useEffect(() => {
    setD(null); setNota({ numero: null, serie: 1, chave: '', emitidaEm: hoje() }); setRecebidoPor(''); setCancelando(false); setMotivo(''); setNotaCancelada(false);
    carregar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fazer = async (acao: () => Promise<unknown>, ok: string) => {
    setSalvando(true);
    try { await acao(); message.success(ok); await carregar(); onMudou(); return true; } catch (e) {
      if (e instanceof ErroPedido && e.detalhes?.codigo === 'NOTA_EXTERNA') message.warning(e.message); else message.error(e instanceof Error ? e.message : 'Erro.');
      return false;
    } finally { setSalvando(false); }
  };

  if (!id) return null;
  const aberto = d && d.etapa !== 'CANCELADO';
  const faturado = !!d && ['FATURADO', 'CONCLUIDO'].includes(d.etapa);
  const entregue = !!d?.entregueEm;
  const somaParcelas = r2(parcelas.reduce((a, p) => a + (Number(p.valor) || 0), 0));
  const passo = !d ? 0 : d.etapa === 'CONCLUIDO' ? 3 : faturado || entregue ? 2 : 1;
  const mudarParcela = (i: number, x: Partial<ParcelaPedido>) => setParcelas(ps => ps.map((p, k) => (k === i ? { ...p, ...x } : p)));

  return (
    <Drawer open={!!id} onClose={onFechar} width="min(1100px, 100vw)" destroyOnHidden loading={!d}
      title={d ? <Space wrap>Pedido faturado Nº {d.id}<Tag color={ETAPAS[d.etapa].cor}>{ETAPAS[d.etapa].rotulo}</Tag><Text type="secondary">{d.cliente}</Text></Space> : 'Pedido'}
      extra={d && (
        <Space>
          {d.etapa !== 'CANCELADO' && (
            <Space.Compact>
              <Tooltip title="Folha para separar, conferir e entregar (sem valores, vai com o motorista), com a assinatura de quem recebe">
                <Button icon={<PrinterOutlined />} onClick={() => imprimirHtml(htmlRomaneio(d, lerConfiguracoes().empresa))}>Romaneio</Button>
              </Tooltip>
              <Tooltip title="Via do cliente: com preços e total do pedido">
                <Button onClick={() => imprimirHtml(htmlRomaneio(d, lerConfiguracoes().empresa, { comValores: true }))}>com valores</Button>
              </Tooltip>
            </Space.Compact>
          )}
          {aberto && !entregue && <Button danger icon={<StopOutlined />} onClick={() => setCancelando(true)}>Cancelar pedido</Button>}
        </Space>
      )}>
      {d && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Steps size="small" current={passo} status={d.etapa === 'CANCELADO' ? 'error' : undefined} items={[
            { title: 'Orçamento', description: d.idOrcamento ? `Nº ${d.idOrcamento}` : undefined },
            { title: 'Confirmado', description: dataBr(d.criadoEm) },
            { title: faturado ? 'Faturado' : entregue ? 'Entregue' : 'Faturar e entregar', description: faturado ? dataBr(d.faturadoEm) : entregue ? dataBr(d.entregueEm) : undefined },
            { title: 'Concluído', description: d.etapa === 'CONCLUIDO' ? dataBr(d.entregueEm && d.faturadoEm ? (d.entregueEm > d.faturadoEm ? d.entregueEm : d.faturadoEm) : null) : undefined },
          ]} />
          {d.etapa === 'CANCELADO' && <Alert type="error" showIcon title={`Cancelado em ${dataBr(d.canceladoEm)}: ${d.motivoCancelamento || ''}`} />}

          <Card size="small" title="Dados do pedido" extra={aberto && (
            <Button size="small" icon={<SaveOutlined />} loading={salvando}
              onClick={() => fazer(() => pedidosFaturadosApi.atualizar(d.id, { ...dados, enderecoEntrega: dados.enderecoEntrega || null, pedidoCliente: dados.pedidoCliente || null, observacao: dados.observacao || null }), 'Pedido salvo.')}>
              Salvar</Button>)}>
            <Row gutter={[12, 8]}>
              <Col xs={12} md={5}><Text style={{ fontSize: 12 }}>Total</Text><div><Text strong style={{ fontSize: 18 }}>{brl(d.total)}</Text></div></Col>
              <Col xs={12} md={7}><Text style={{ fontSize: 12 }}>Condição combinada</Text><div><Text>{d.condicaoPagamento || 'A combinar'}</Text></div></Col>
              <Col xs={12} md={5}>
                <Text style={{ fontSize: 12 }}>Pedido de compra do cliente</Text>
                <Input value={dados.pedidoCliente} disabled={!aberto} maxLength={60} placeholder="Nº da OC" onChange={e => setDados({ ...dados, pedidoCliente: e.target.value })} />
              </Col>
              <Col xs={12} md={7}>
                <Text style={{ fontSize: 12 }}>Previsão de entrega</Text>
                <DatePicker style={{ width: '100%' }} format={FORMATOS_DATA} disabled={!aberto || entregue} value={dados.previsaoEntrega ? dayjs(dados.previsaoEntrega) : null}
                  onChange={v => setDados({ ...dados, previsaoEntrega: v ? v.format('YYYY-MM-DD') : null })} />
              </Col>
              <Col xs={24} md={12}>
                <Text style={{ fontSize: 12 }}>Endereço de entrega</Text>
                <Input value={dados.enderecoEntrega} disabled={!aberto || entregue} maxLength={255} placeholder="Vazio = retira na loja" onChange={e => setDados({ ...dados, enderecoEntrega: e.target.value })} />
              </Col>
              <Col xs={24} md={12}>
                <Text style={{ fontSize: 12 }}>Observação</Text>
                <Input value={dados.observacao} disabled={!aberto} maxLength={255} onChange={e => setDados({ ...dados, observacao: e.target.value })} />
              </Col>
            </Row>
          </Card>

          <Card size="small" title={`Itens (${d.itens.length})`}>
            <Table size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={d.itens} columns={[
              { title: 'Código', dataIndex: 'sku', width: 130 },
              { title: 'Item', key: 'n', render: (_, i) => <>{i.nome}{i.componentes.length > 0 && <div><Text type="secondary" style={{ fontSize: 11 }}>{i.componentes.map(c => `${qtd(c.quantidade)}× ${c.nome}`).join(' · ')}</Text></div>}</> },
              { title: 'Qtd', key: 'q', align: 'right' as const, width: 110, render: (_, i) => `${qtd(i.quantidade)} ${i.unidade || ''}` },
              { title: 'Unitário', dataIndex: 'precoUnitario', align: 'right' as const, width: 110, render: (v: number) => brl(v) },
              { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <b>{brl(v)}</b> },
            ]} />
          </Card>

          <Row gutter={12}>
            {/* -------------------------------------------------------------- faturamento */}
            <Col xs={24} lg={14}>
              <Card size="small" title={<Space><FileDoneOutlined />Faturamento (NF-e e parcelas)</Space>} style={{ height: '100%' }}>
                {faturado || d.nota ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {d.nota && (
                      <Descriptions size="small" column={2} items={[
                        { key: 'n', label: 'NF-e', children: <b>{d.nota.numero} · série {d.nota.serie}</b> },
                        { key: 'e', label: 'Emitida em', children: dataBr(d.nota.emitidaEm) },
                        { key: 's', label: 'Situação', children: <Tag color={d.nota.status === 'AUTORIZADA' ? 'green' : 'default'}>{d.nota.status === 'AUTORIZADA' ? 'Autorizada (emitida fora do ERP)' : d.nota.status}</Tag> },
                        { key: 'c', label: 'Chave', children: d.nota.chave ? <Text copyable style={{ fontSize: 11 }}>{d.nota.chave}</Text> : '—' },
                      ]} />
                    )}
                    <Table size="small" pagination={false} rowKey="idTitulo" dataSource={d.parcelas} columns={[
                      { title: 'Parc.', key: 'p', width: 55, render: (_, p) => `${p.parcela}/${p.totalParcelas}` },
                      { title: 'Vencimento', dataIndex: 'vencimento', width: 95, render: (v: string) => dataBr(v) },
                      { title: 'Valor', dataIndex: 'valor', align: 'right' as const, width: 100, render: (v: number) => brl(v) },
                      { title: 'Forma', dataIndex: 'forma', width: 80, render: (v: string) => ROTULO_FORMA[v] || v || '—' },
                      {
                        title: 'Boleto (linha digitável)', key: 'b', render: (_, p) => p.forma !== 'BOLETO' ? <Tag color={p.status === 'PAGO' ? 'green' : undefined}>{p.status === 'PAGO' ? 'Pago' : p.status === 'CANCELADO' ? 'Cancelado' : 'Em aberto'}</Tag>
                          : p.status !== 'ABERTO'
                            ? <Space size={4}><Tag color={p.status === 'PAGO' ? 'green' : undefined}>{p.status === 'PAGO' ? 'Pago' : 'Cancelado'}</Tag><Text style={{ fontSize: 11 }}>{formatarLinhaDigitavel(p.codigoBarras)}</Text></Space>
                            : p.codigoBarras && boletos[p.idTitulo!] === p.codigoBarras
                              ? <Space size={2}>
                                  <Text style={{ fontSize: 11 }}>{formatarLinhaDigitavel(p.codigoBarras)}</Text>
                                  <Tooltip title="Copiar"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(p.codigoBarras!).then(() => message.success('Linha digitável copiada.')).catch(() => undefined)} /></Tooltip>
                                  <Button size="small" type="link" onClick={() => setBoletos({ ...boletos, [p.idTitulo!]: '' })}>trocar</Button>
                                </Space>
                              : <Space.Compact style={{ width: '100%' }}>
                                  <Input size="small" placeholder="Cole a linha digitável do boleto" value={boletos[p.idTitulo!] || ''} onChange={e => setBoletos({ ...boletos, [p.idTitulo!]: e.target.value })} />
                                  <Button size="small" type="primary" loading={salvando} disabled={!boletos[p.idTitulo!]}
                                    onClick={() => fazer(() => pedidosFaturadosApi.parcela(d.id, p.idTitulo!, { codigoBarras: boletos[p.idTitulo!] }), 'Boleto salvo na parcela.')}>Salvar</Button>
                                </Space.Compact>,
                      },
                    ]} />
                    <Text type="secondary" style={{ fontSize: 12 }}>O recebimento de cada parcela é baixado em Financeiro › Contas a receber.</Text>
                  </Space>
                ) : !aberto ? <Empty description="Não faturado." /> : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Emita a NF-e no emissor de vocês e informe aqui o número (a chave é opcional, mas ajuda na conferência).</Text>
                    <Flex gap={8} wrap>
                      <CampoNumero placeholder="Nº da NF-e" min={1} style={{ width: 130 }} value={nota.numero} onChange={v => setNota({ ...nota, numero: v ? Number(v) : null })} />
                      <CampoNumero placeholder="Série" min={0} max={999} style={{ width: 80 }} prefix="Série" value={nota.serie} onChange={v => setNota({ ...nota, serie: Number(v) || 0 })} />
                      <DatePicker format={FORMATOS_DATA} style={{ width: 140 }} value={dayjs(nota.emitidaEm)} disabledDate={x => x.isAfter(dayjs(), 'day')}
                        onChange={v => setNota({ ...nota, emitidaEm: v ? v.format('YYYY-MM-DD') : hoje() })} />
                      <Input placeholder="Chave de acesso (44 dígitos, opcional)" style={{ flex: '1 1 260px' }} value={nota.chave} onChange={e => setNota({ ...nota, chave: e.target.value })} />
                    </Flex>
                    <Text strong style={{ fontSize: 13 }}>Parcelas no contas a receber</Text>
                    {parcelas.map((p, i) => (
                      <Flex key={i} gap={6} align="center" wrap>
                        <Tag style={{ margin: 0, width: 34, textAlign: 'center' }}>{i + 1}</Tag>
                        <DatePicker format={FORMATOS_DATA} style={{ width: 130 }} value={p.vencimento ? dayjs(p.vencimento) : null} allowClear={false}
                          onChange={v => v && mudarParcela(i, { vencimento: v.format('YYYY-MM-DD') })} />
                        <CampoDinheiro style={{ width: 120 }} min={0.01} value={p.valor} onChange={v => mudarParcela(i, { valor: Number(v) || 0 })} />
                        <Select style={{ width: 110 }} value={p.forma} onChange={v => mudarParcela(i, { forma: v })} options={d.formasParcela.map(f => ({ value: f, label: ROTULO_FORMA[f] || f }))} />
                        {p.forma === 'BOLETO' && (
                          <Input style={{ flex: '1 1 200px' }} placeholder="Linha digitável (pode colar depois)" value={p.codigoBarras || ''} onChange={e => mudarParcela(i, { codigoBarras: e.target.value })} />
                        )}
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={parcelas.length === 1} onClick={() => setParcelas(ps => ps.filter((_, k) => k !== i))} />
                      </Flex>
                    ))}
                    <Flex justify="space-between" align="center" wrap gap={6}>
                      <Button size="small" icon={<PlusOutlined />} onClick={() => {
                        const ultima = parcelas[parcelas.length - 1];
                        setParcelas([...parcelas, { parcela: parcelas.length + 1, totalParcelas: parcelas.length + 1, vencimento: dayjs(ultima?.vencimento || hoje()).add(30, 'day').format('YYYY-MM-DD'),
                          valor: r2(Math.max(0, d.total - somaParcelas)), forma: 'BOLETO', codigoBarras: null }]);
                      }}>Parcela</Button>
                      <Text type={Math.abs(somaParcelas - d.total) > 0.009 ? 'danger' : 'secondary'}>Parcelas somam {brl(somaParcelas)} de {brl(d.total)}</Text>
                    </Flex>
                    <Button type="primary" icon={<FileDoneOutlined />} loading={salvando} disabled={!nota.numero || Math.abs(somaParcelas - d.total) > 0.009}
                      onClick={() => fazer(() => pedidosFaturadosApi.faturar(d.id, {
                        nota: { numero: nota.numero!, serie: nota.serie, chave: nota.chave || undefined, emitidaEm: nota.emitidaEm },
                        parcelas: parcelas.map(p => ({ ...p, codigoBarras: p.forma === 'BOLETO' ? p.codigoBarras || null : null })),
                      }), 'Pedido faturado: parcelas lançadas no contas a receber.')}>
                      Faturar
                    </Button>
                  </Space>
                )}
              </Card>
            </Col>

            {/* -------------------------------------------------------------- entrega */}
            <Col xs={24} lg={10}>
              <Card size="small" title={<Space><CarOutlined />Entrega</Space>} style={{ height: '100%' }}>
                {entregue ? (
                  <Descriptions size="small" column={1} items={[
                    { key: 'q', label: 'Entregue em', children: dataBr(d.entregueEm) },
                    { key: 'r', label: 'Recebido por', children: d.recebidoPor || '—' },
                    { key: 'e', label: 'Endereço', children: d.enderecoEntrega || 'Retirou na loja' },
                  ]} />
                ) : !aberto ? <Empty description="Não entregue." /> : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Table size="small" pagination={false} rowKey="idItem" dataSource={d.estoque} columns={[
                      { title: 'Sai do estoque', dataIndex: 'nome', render: (v: string, e) => <>{v}{e.podeSemEstoque && <Text type="secondary" style={{ fontSize: 11 }}> (vende sem estoque)</Text>}</> },
                      { title: 'Qtd', dataIndex: 'sai', align: 'right' as const, width: 60, render: (v: number) => qtd(v) },
                      {
                        title: 'Livre', key: 'l', align: 'right' as const, width: 80, render: (_, e) => {
                          const livre = r2(e.saldo - e.reservadoOutros);
                          return <Tooltip title={`Saldo ${qtd(e.saldo)}${e.reservadoOutros > 0 ? ` · ${qtd(e.reservadoOutros)} reservado em outros pedidos` : ''}`}>
                            <Text type={livre < e.sai && !e.podeSemEstoque ? 'danger' : undefined}>{qtd(livre)}</Text></Tooltip>;
                        },
                      },
                    ]} />
                    {d.faltas.length > 0 && (
                      <Alert type="warning" showIcon title="Falta material para entregar"
                        description={d.faltas.map(f => `${f.nome}: precisa ${qtd(f.sai)}, livre ${qtd(f.disponivel)}`).join(' · ')} />
                    )}
                    <Input placeholder="Quem recebeu (nome)" value={recebidoPor} maxLength={100} onChange={e => setRecebidoPor(e.target.value)} />
                    <Button type="primary" icon={<CarOutlined />} block loading={salvando} disabled={!recebidoPor.trim() || d.faltas.length > 0}
                      onClick={() => Modal.confirm({
                        title: `Registrar a entrega do pedido Nº ${d.id}?`,
                        content: 'O material sai do estoque agora.' + (faturado ? ' O pedido fica concluído.' : ' Falta faturar (NF-e e parcelas).'),
                        okText: 'Entregar', cancelText: 'Voltar',
                        onOk: () => fazer(() => pedidosFaturadosApi.entregar(d.id, recebidoPor.trim()), 'Entrega registrada: estoque baixado.'),
                      })}>
                      Registrar entrega
                    </Button>
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      )}

      <Modal open={cancelando} title={`Cancelar o pedido Nº ${d?.id ?? ''}`} okText="Cancelar pedido" okButtonProps={{ danger: true, disabled: motivo.trim().length < 3 || (!!d?.nota && d.nota.status === 'AUTORIZADA' && !notaCancelada) }}
        cancelText="Voltar" confirmLoading={salvando} onCancel={() => setCancelando(false)} destroyOnHidden
        onOk={async () => { if (d && await fazer(() => pedidosFaturadosApi.cancelar(d.id, motivo.trim(), notaCancelada), 'Pedido cancelado: reserva liberada.')) setCancelando(false); }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>A reserva do material é liberada e as parcelas sem recebimento são canceladas.</Text>
          {d?.nota?.status === 'AUTORIZADA' && (
            <Alert type="warning" showIcon title={`A NF-e ${d.nota.numero} foi emitida fora do ERP`}
              description={<Checkbox checked={notaCancelada} onChange={e => setNotaCancelada(e.target.checked)}>Já cancelei a nota no emissor de vocês</Checkbox>} />
          )}
          <Input.TextArea placeholder="Motivo" value={motivo} maxLength={255} onChange={e => setMotivo(e.target.value)} />
        </Space>
      </Modal>
    </Drawer>
  );
};

// ------------------------------------------------------------------ lista

const PedidosFaturados: React.FC = () => {
  const [situacao, setSituacao] = useState<'ABERTOS' | 'TODOS'>('ABERTOS');
  const [lista, setLista] = useState<PedidoFaturadoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [aberto, setAberto] = useState<number | null>(Number(searchParams.get('id')) || null);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await pedidosFaturadosApi.listar(situacao)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao listar.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [situacao]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (searchParams.get('id')) setSearchParams({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? lista.filter(p => `${p.id} ${p.cliente} ${p.pedidoCliente || ''} ${p.notaNumero || ''}`.toLowerCase().includes(termo)) : lista;
  const abertos = lista.filter(p => ['CONFIRMADO', 'FATURADO', 'ENTREGUE_SEM_NOTA'].includes(p.etapa));
  const atrasados = abertos.filter(p => !p.entregueEm && p.previsaoEntrega && p.previsaoEntrega < hoje()).length;

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Pedidos faturados</Title>
            <Text type="secondary">Venda para empresa com entrega depois: nasce de um orçamento (botão "Pedido" em Vendas › Orçamentos).</Text>
          </div>
          <Space wrap>
            <Input.Search allowClear placeholder="Cliente, nº, OC ou NF" style={{ width: 240 }} value={busca} onChange={e => setBusca(e.target.value)} />
            <Segmented value={situacao} onChange={v => setSituacao(v as any)} options={[{ value: 'ABERTOS', label: 'Em andamento' }, { value: 'TODOS', label: 'Todos' }]} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          </Space>
        </Flex>
        {abertos.length > 0 && (
          <Text type="secondary">
            {abertos.length} em andamento · {brl(abertos.reduce((a, p) => a + p.total, 0))}
            {atrasados > 0 && <Text type="danger"> · {atrasados} com entrega atrasada</Text>}
          </Text>
        )}
        <Card size="small">
          <Table<PedidoFaturadoResumo> size="small" rowKey="id" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 30, hideOnSinglePage: true }}
            onRow={p => ({ onClick: () => setAberto(p.id), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <Empty description="Nenhum pedido faturado. Em Vendas › Orçamentos, use o botão Pedido." /> }}
            columns={[
              { title: 'Nº', dataIndex: 'id', width: 70 },
              { title: 'Cliente', key: 'c', render: (_, p) => <>{p.cliente}{p.pedidoCliente && <div><Text type="secondary" style={{ fontSize: 11 }}>OC {p.pedidoCliente}</Text></div>}</> },
              { title: 'Etapa', dataIndex: 'etapa', width: 170, render: (v: PedidoFaturadoResumo['etapa']) => <Tag color={ETAPAS[v].cor}>{ETAPAS[v].rotulo}</Tag> },
              {
                title: 'Entrega', key: 'e', width: 120, render: (_, p) => p.entregueEm ? <Text type="secondary">{dataBr(p.entregueEm.slice(0, 10))}</Text>
                  : p.etapa === 'CANCELADO' ? '—'
                    : <Text type={p.previsaoEntrega && p.previsaoEntrega < hoje() ? 'danger' : undefined}>{p.previsaoEntrega ? dataBr(p.previsaoEntrega) : 'sem data'}</Text>,
              },
              { title: 'NF-e', dataIndex: 'notaNumero', width: 90, render: (v: number | null) => v ?? '—' },
              {
                title: 'A receber', key: 'r', width: 150, align: 'right' as const, render: (_, p) => p.parcelasAbertas
                  ? <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
                      <Text>{brl(p.aReceber || 0)} <Text type="secondary" style={{ fontSize: 11 }}>({p.parcelasAbertas} parc.)</Text></Text>
                      {!!p.boletosFaltando && <Text type="warning" style={{ fontSize: 11 }}>{p.boletosFaltando} boleto(s) sem linha digitável</Text>}
                    </Space>
                  : '—',
              },
              { title: 'Total', dataIndex: 'total', width: 120, align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
            ]} />
        </Card>
      </Space>
      <FichaPedido id={aberto} onFechar={() => setAberto(null)} onMudou={carregar} />
    </div>
  );
};

export default PedidosFaturados;

// Financeiro › Contas a pagar: boletos das notas de entrada, contas da loja (lançadas à mão ou pelas contas fixas),
// vencimentos, pagamento e ajuste (inclusive confirmar o valor da conta que entrou estimada).
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Input, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CheckOutlined, CopyOutlined, EditOutlined, PlusOutlined, ReloadOutlined, RetweetOutlined, RollbackOutlined } from '@ant-design/icons';
import { dataBr, FORMAS_PAGAMENTO, FormaPagamento, hojeIso, pagarApi, TituloPagar } from './pagarApi';
import NovaContaModal from './NovaContaModal';
import { SelectCategoria, useDadosConta } from './camposConta';
import { opcoesDeCategoria } from './contasForm';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SITUACOES = [
  { value: 'ABERTOS', label: 'Em aberto' }, { value: 'VENCIDOS', label: 'Vencidos' },
  { value: 'PAGOS', label: 'Pagos' }, { value: 'TODOS', label: 'Todos' },
];

export const FinanceiroContasPagar: React.FC = () => {
  const navigate = useNavigate();
  const [situacao, setSituacao] = useState('ABERTOS');
  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [novaConta, setNovaConta] = useState(false);
  const { categorias } = useDadosConta(true);
  const [busca, setBusca] = useState('');
  const [titulos, setTitulos] = useState<TituloPagar[]>([]);
  const [resumo, setResumo] = useState({ aberto: 0, vencido: 0, proximos7: 0, pagoMes: 0 });
  const [carregando, setCarregando] = useState(false);
  const [pagando, setPagando] = useState<TituloPagar | null>(null);
  const [pagoEm, setPagoEm] = useState(hojeIso());
  const [forma, setForma] = useState<FormaPagamento>('BOLETO');
  const [ajustando, setAjustando] = useState<TituloPagar | null>(null);
  const [ajuste, setAjuste] = useState({ vencimento: '', valor: 0, codigoBarras: '', idCategoria: null as number | null, descricao: '' });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await pagarApi.listar(situacao, busca.trim(), idCategoria);
      setTitulos(r.titulos);
      setResumo(r.resumo);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [situacao, busca, idCategoria]);
  useEffect(() => { carregar(); }, [situacao, idCategoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const acao = async (fn: () => Promise<unknown>, sucesso: string) => {
    try {
      await fn();
      message.success(sucesso);
      carregar();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
      return false;
    }
  };

  const confirmarPagamento = async () => {
    if (pagando && await acao(() => pagarApi.pagar(pagando.idTitulo, pagoEm, forma), 'Pagamento registrado.')) setPagando(null);
  };
  const salvarAjuste = async () => {
    if (ajustando && await acao(() => pagarApi.ajustar(ajustando.idTitulo, {
      vencimento: ajuste.vencimento, valor: ajuste.valor, codigoBarras: ajuste.codigoBarras.trim() || null,
      idCategoria: ajuste.idCategoria, descricao: ajuste.descricao,
    }), ajustando.estimado ? 'Valor confirmado.' : 'Título ajustado.')) setAjustando(null);
  };

  const abrirAjuste = (t: TituloPagar) => {
    setAjustando(t);
    setAjuste({ vencimento: t.vencimento, valor: t.valor, codigoBarras: t.codigoBarras || '', idCategoria: t.idCategoria, descricao: t.descricao || '' });
  };

  const card = (titulo: string, valor: number, cor?: string, filtro?: string) => (
    <Card size="small" hoverable={Boolean(filtro)} onClick={filtro ? () => setSituacao(filtro) : undefined}>
      <Statistic title={titulo} value={valor} precision={2} prefix="R$" valueStyle={{ fontSize: 20, color: cor }}
        formatter={v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
    </Card>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Contas a pagar</Title>
          <Text type="secondary">Boletos das notas de entrada e as contas da loja (água, luz, aluguel...), lançadas à mão ou pelas contas fixas.</Text>
        </div>
        <Space wrap>
          <Button icon={<RetweetOutlined />} onClick={() => navigate('/financeiro/contas-fixas')}>Contas fixas</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNovaConta(true)}>Nova conta</Button>
        </Space>
      </div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented value={situacao} onChange={v => setSituacao(String(v))} options={SITUACOES} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Todas as categorias" style={{ width: 230 }} value={idCategoria ?? undefined}
          options={opcoesDeCategoria(categorias, 'DESPESA', idCategoria)} onChange={v => setIdCategoria((v as number) ?? null)} />
        <Input.Search allowClear placeholder="Quem recebe, descrição, documento ou NF" style={{ width: 280 }} value={busca}
          onChange={e => setBusca(e.target.value)} onSearch={carregar} />
        <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
      </Space>

      <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
        <Col xs={12} lg={6}>{card('Em aberto', resumo.aberto, undefined, 'ABERTOS')}</Col>
        <Col xs={12} lg={6}>{card('Vencido', resumo.vencido, resumo.vencido > 0 ? '#cf1322' : undefined, 'VENCIDOS')}</Col>
        <Col xs={12} lg={6}>{card('Vence em 7 dias', resumo.proximos7, resumo.proximos7 > 0 ? '#d48806' : undefined)}</Col>
        <Col xs={12} lg={6}>{card('Pago no mês', resumo.pagoMes, '#389e0d', 'PAGOS')}</Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<TituloPagar>
          size="small" rowKey="idTitulo" loading={carregando} dataSource={titulos} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          columns={[
            {
              title: 'Vencimento', dataIndex: 'vencimento', width: 110,
              render: (v: string, t) => <Text type={t.vencido ? 'danger' : undefined} strong={t.vencido}>{dataBr(v)}</Text>,
            },
            {
              title: 'Quem recebe', key: 'quem', ellipsis: true,
              render: (_, t) => (
                <div style={{ lineHeight: 1.3 }}>
                  <div>{t.fornecedor || '—'}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t.idLote ? '' : t.descricao}{t.idRecorrente ? ' · conta fixa' : ''}
                  </Text>
                  {t.categoria && <Tag style={{ marginLeft: t.idLote ? 0 : 6, fontSize: 11 }}>{t.categoria}</Tag>}
                </div>
              ),
            },
            {
              title: 'Documento', key: 'doc', width: 170,
              render: (_, t) => (
                <div>
                  <div>{t.numeroDocumento || '—'} <Text type="secondary" style={{ fontSize: 11 }}>({t.parcela}/{t.totalParcelas})</Text></div>
                  {t.numeroNf && <Text type="secondary" style={{ fontSize: 11 }}>NF {t.numeroNf}</Text>}
                </div>
              ),
            },
            {
              title: 'Forma', key: 'forma', width: 130,
              render: (_, t) => (
                <Space size={4}>
                  {FORMAS_PAGAMENTO.find(f => f.value === t.forma)?.label || t.forma}
                  {t.codigoBarras && (
                    <Tooltip title={`Copiar linha digitável ${t.codigoBarras}`}>
                      <CopyOutlined style={{ color: '#1677ff' }} onClick={() => { navigator.clipboard.writeText(t.codigoBarras!); message.success('Linha digitável copiada.'); }} />
                    </Tooltip>
                  )}
                </Space>
              ),
            },
            {
              title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const,
              render: (v: number, t) => (
                <div>
                  <b>{brl(v)}</b>
                  {t.estimado && t.status === 'ABERTO' && (
                    <div><Tooltip title="Valor estimado: confirme quando a conta chegar"><Tag color="blue" style={{ margin: 0, cursor: 'pointer' }} onClick={() => abrirAjuste(t)}>estimado · confirmar</Tag></Tooltip></div>
                  )}
                </div>
              ),
            },
            {
              title: 'Situação', key: 'sit', width: 140,
              render: (_, t) => (t.status === 'PAGO'
                ? <Tag color="green">Pago {dataBr(t.pagoEm)}</Tag>
                : t.vencido ? <Tag color="red">Vencido</Tag> : <Tag color="gold">Em aberto</Tag>),
            },
            {
              title: '', key: 'acoes', width: 150, align: 'right' as const,
              render: (_, t) => (
                <Space size={2}>
                  {t.status === 'ABERTO' && (<>
                    <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => { setPagando(t); setPagoEm(hojeIso()); setForma(t.forma); }}>Pagar</Button>
                    <Tooltip title="Ajustar vencimento, valor, categoria ou linha digitável">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => abrirAjuste(t)} />
                    </Tooltip>
                  </>)}
                  {t.status === 'PAGO' && (
                    <Tooltip title="Desfazer o pagamento (registrado por engano)">
                      <Button size="small" type="text" icon={<RollbackOutlined />} onClick={() => acao(() => pagarApi.reabrir(t.idTitulo), 'Título reaberto.')} />
                    </Tooltip>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={pagando !== null} title={`Pagar ${pagando?.numeroDocumento || ''} · ${brl(pagando?.valor || 0)}`} okText="Registrar pagamento" cancelText="Voltar"
        onOk={confirmarPagamento} onCancel={() => setPagando(null)} destroyOnHidden width={380}>
        <Text type="secondary">{pagando?.fornecedor}{pagando?.idLote ? '' : ` · ${pagando?.descricao || ''}`}</Text>
        {pagando?.estimado && <Alert type="warning" showIcon style={{ marginTop: 8 }} message="O valor ainda é estimado: confirme o valor da conta (no lápis) antes de pagar." />}
        <Space direction="vertical" style={{ width: '100%', marginTop: 10 }}>
          <span>Data do pagamento</span>
          <Input type="date" value={pagoEm} max={hojeIso()} onChange={e => setPagoEm(e.target.value)} />
          <span>Forma</span>
          <Select style={{ width: '100%' }} value={forma} options={FORMAS_PAGAMENTO} onChange={setForma} />
        </Space>
      </Modal>

      <Modal open={ajustando !== null} title={ajustando?.estimado ? `Confirmar o valor · ${ajustando.descricao || ''}` : `Ajustar ${ajustando?.numeroDocumento || ajustando?.descricao || ''}`}
        okText={ajustando?.estimado ? 'Confirmar' : 'Salvar'} cancelText="Voltar"
        onOk={salvarAjuste} onCancel={() => setAjustando(null)} destroyOnHidden width={460}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {ajustando?.estimado && <Text type="secondary">A conta chegou: informe o valor dela (e a linha digitável, se for boleto).</Text>}
          {ajustando && !ajustando.idLote && (<>
            <span>Descrição</span>
            <Input maxLength={150} value={ajuste.descricao} onChange={e => setAjuste(a => ({ ...a, descricao: e.target.value }))} />
          </>)}
          <span>Vencimento</span>
          <Input type="date" value={ajuste.vencimento} onChange={e => setAjuste(a => ({ ...a, vencimento: e.target.value }))} />
          <span>Valor</span>
          <CampoNumero min={0} precision={2} style={{ width: '100%' }} value={ajuste.valor} onChange={v => setAjuste(a => ({ ...a, valor: Number(v) || 0 }))} />
          <span>Linha digitável</span>
          <Input value={ajuste.codigoBarras} placeholder="cole a linha digitável do boleto" onChange={e => setAjuste(a => ({ ...a, codigoBarras: e.target.value }))} />
          <span>Categoria</span>
          <SelectCategoria categorias={categorias} value={ajuste.idCategoria} onChange={v => setAjuste(a => ({ ...a, idCategoria: v }))} />
        </Space>
      </Modal>

      <NovaContaModal aberto={novaConta} onFechar={() => setNovaConta(false)} onSalvo={() => { setNovaConta(false); carregar(); }}
        onContaFixa={() => { setNovaConta(false); navigate('/financeiro/contas-fixas'); }} />
    </div>
  );
};

export default FinanceiroContasPagar;

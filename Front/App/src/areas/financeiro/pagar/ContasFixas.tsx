// Financeiro › Contas fixas: as contas que se repetem (aluguel, água, luz, internet, seguro, salário). O ERP lança
// sozinho no contas a pagar o mês atual e os 2 seguintes; conta de valor que varia vai estimada e se confirma quando chega.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Col, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { EditOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, StopOutlined, TagsOutlined } from '@ant-design/icons';
import { ContaFixa, ContaFixaForm, dataBr, FORMAS_PAGAMENTO, hojeIso, pagarApi, PERIODICIDADES } from './pagarApi';
import { QuemRecebe, SelectCategoria, useDadosConta } from './camposConta';
import { primeiroMesSugerido } from './contasForm';
import CategoriasDrawer from './CategoriasDrawer';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COR_STATUS = { ATIVA: 'green', PAUSADA: 'gold', ENCERRADA: 'default' } as const;
const ROTULO_STATUS = { ATIVA: 'Ativa', PAUSADA: 'Pausada', ENCERRADA: 'Encerrada' } as const;

const vazio = (): ContaFixaForm => ({
  descricao: '', idCategoria: null, idFornecedor: null, favorecido: null, valor: 0, valorVariavel: false, diaVencimento: 10,
  periodicidade: 'MENSAL', inicio: primeiroMesSugerido(hojeIso(), 10), fim: null, forma: 'BOLETO', observacao: null,
});

const ContaFixaModal: React.FC<{ conta: ContaFixa | 'nova' | null; onFechar: () => void; onSalvo: () => void; onCategorias: () => void; versaoCategorias: number }> = ({ conta, onFechar, onSalvo, onCategorias, versaoCategorias }) => {
  const [f, setF] = useState<ContaFixaForm>(vazio());
  const [mesTocado, setMesTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { categorias, fornecedores, recarregarCategorias } = useDadosConta(conta !== null);
  useEffect(() => { recarregarCategorias(); }, [versaoCategorias, recarregarCategorias]);
  useEffect(() => {
    if (!conta) return;
    setMesTocado(conta !== 'nova');
    setF(conta === 'nova' ? vazio() : { ...conta, inicio: conta.inicio.slice(0, 7), fim: conta.fim ? conta.fim.slice(0, 7) : null });
  }, [conta]);
  const mudar = (p: Partial<ContaFixaForm>) => setF(x => {
    const n = { ...x, ...p };
    // conta nova: o primeiro mês acompanha o dia até o operador mexer nele (não nascer vencida)
    if (p.diaVencimento !== undefined && !mesTocado) n.inicio = primeiroMesSugerido(hojeIso(), p.diaVencimento);
    return n;
  });

  const salvar = async () => {
    if (!conta) return;
    setSalvando(true);
    try {
      const dados = { ...f, favorecido: f.favorecido?.trim() || null, observacao: f.observacao?.trim() || null };
      const r = conta === 'nova' ? await pagarApi.criarFixa(dados) : await pagarApi.salvarFixa(conta.idRecorrente, dados);
      message.success(r.gerados ? `Salva: ${r.gerados} mês(es) lançado(s) no contas a pagar.` : 'Conta fixa salva.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open={conta !== null} title={conta === 'nova' ? 'Nova conta fixa' : 'Editar conta fixa'} okText="Salvar" cancelText="Voltar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={580}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <div><Text>Descrição</Text><Input placeholder="Ex.: Aluguel da loja, Energia elétrica" maxLength={150} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} /></div>
        <div><Text>Quem recebe</Text><QuemRecebe key={conta === 'nova' ? 'nova' : conta?.idRecorrente} idFornecedor={f.idFornecedor} favorecido={f.favorecido} fornecedores={fornecedores} onChange={mudar} /></div>
        <div>
          <Text>Categoria</Text> <a style={{ fontSize: 12 }} onClick={onCategorias}>gerenciar categorias</a>
          <SelectCategoria categorias={categorias} value={f.idCategoria} onChange={idCategoria => mudar({ idCategoria })} />
        </div>
        <Row gutter={10}>
          <Col span={9}>
            <Text>{f.valorVariavel ? 'Valor estimado' : 'Valor'}</Text>
            <InputNumber min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }} value={f.valor} onChange={v => mudar({ valor: Number(v) || 0 })} />
          </Col>
          <Col span={15} style={{ paddingTop: 22 }}>
            <Checkbox checked={f.valorVariavel} onChange={e => mudar({ valorVariavel: e.target.checked })}>Valor varia todo mês (água, luz)</Checkbox>
          </Col>
        </Row>
        {f.valorVariavel && <Text type="secondary" style={{ fontSize: 12 }}>Os meses entram com a estimativa e a marca "estimado"; quando a conta chegar, confirme o valor no contas a pagar.</Text>}
        <Row gutter={10}>
          <Col span={8}><Text>Vence no dia</Text><InputNumber min={1} max={31} style={{ width: '100%' }} value={f.diaVencimento} onChange={v => mudar({ diaVencimento: Number(v) || 1 })} /></Col>
          <Col span={16}><Text>Repete</Text><Select style={{ width: '100%' }} value={f.periodicidade} options={PERIODICIDADES} onChange={periodicidade => mudar({ periodicidade })} /></Col>
        </Row>
        <Row gutter={10}>
          <Col span={12}>
            <Text>Primeira conta (mês)</Text>
            <Input type="month" value={f.inicio} onChange={e => { setMesTocado(true); mudar({ inicio: e.target.value }); }} />
          </Col>
          <Col span={12}>
            <Text>Última (fim do contrato)</Text>
            <Input type="month" value={f.fim || ''} onChange={e => mudar({ fim: e.target.value || null })} />
          </Col>
        </Row>
        <Row gutter={10}>
          <Col span={10}><Text>Forma</Text><Select style={{ width: '100%' }} value={f.forma} options={FORMAS_PAGAMENTO} onChange={forma => mudar({ forma })} /></Col>
          <Col span={14}><Text>Observação</Text><Input maxLength={255} placeholder="Ex.: contrato até set/27, reajuste IGP-M" value={f.observacao || ''} onChange={e => mudar({ observacao: e.target.value })} /></Col>
        </Row>
        {conta !== 'nova' && <Text type="secondary" style={{ fontSize: 12 }}>Ao salvar, os próximos meses que ainda não foram mexidos saem com os dados novos; o mês atual fica como está (ajuste no contas a pagar, se precisar).</Text>}
      </Space>
    </Modal>
  );
};

const ContasFixas: React.FC = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState<ContaFixa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<ContaFixa | 'nova' | null>(null);
  const [categorias, setCategorias] = useState(false);
  const [versaoCategorias, setVersaoCategorias] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await pagarApi.fixas()); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao carregar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const status = async (c: ContaFixa, s: ContaFixa['status'], ok: string) => {
    try { await pagarApi.statusFixa(c.idRecorrente, s); message.success(ok); carregar(); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  const ativas = lista.filter(c => c.status === 'ATIVA');
  const porMes = ativas.reduce((a, c) => a + c.valor / ({ MENSAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }[c.periodicidade] || 1), 0);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Contas fixas</Title>
          <Text type="secondary">Aluguel, água, luz, internet, seguro, salários: o ERP lança sozinho no contas a pagar o mês atual e os 2 seguintes.</Text>
        </div>
        <Space wrap>
          <Button icon={<TagsOutlined />} onClick={() => setCategorias(true)}>Categorias</Button>
          <Button onClick={() => navigate('/financeiro/pagar')}>Contas a pagar</Button>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditando('nova')}>Nova conta fixa</Button>
        </Space>
      </div>

      {ativas.length > 0 && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space size={24} wrap>
            <span><Text type="secondary">Contas ativas</Text> <b>{ativas.length}</b></span>
            <Tooltip title="Soma das contas ativas convertida para um mês (a anual entra com 1/12, a bimestral com 1/2...)">
              <span><Text type="secondary">Custo fixo por mês</Text> <b>{brl(porMes)}</b></span>
            </Tooltip>
            <span><Text type="secondary">Pago neste ano</Text> <b>{brl(lista.reduce((a, c) => a + c.pagoNoAno, 0))}</b></span>
          </Space>
        </Card>
      )}

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<ContaFixa>
          size="small" rowKey="idRecorrente" loading={carregando} dataSource={lista} pagination={false}
          locale={{ emptyText: 'Nenhuma conta fixa ainda: cadastre o aluguel, a luz, a internet...' }}
          columns={[
            {
              title: 'Conta', render: (_, c) => (
                <div>
                  <Text strong>{c.descricao}</Text>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{c.quemRecebe || '—'}</Text>{c.categoria && <Tag style={{ marginLeft: 6 }}>{c.categoria}</Tag>}</div>
                </div>
              ),
            },
            {
              title: 'Valor', width: 140, align: 'right',
              render: (_, c) => <div>{brl(c.valor)}{c.valorVariavel && <div><Tag color="blue" style={{ margin: 0 }}>varia (estimado)</Tag></div>}</div>,
            },
            {
              title: 'Vencimento', width: 190,
              render: (_, c) => (
                <div>
                  <div>dia {c.diaVencimento} · {PERIODICIDADES.find(p => p.value === c.periodicidade)?.label.toLowerCase()}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>desde {c.inicio.slice(5, 7)}/{c.inicio.slice(0, 4)}{c.fim ? ` até ${c.fim.slice(5, 7)}/${c.fim.slice(0, 4)}` : ''}</Text>
                </div>
              ),
            },
            {
              title: 'Próxima em aberto', width: 160,
              render: (_, c) => c.proximo
                ? <div>{dataBr(c.proximo.vencimento)}<div><Text type="secondary" style={{ fontSize: 12 }}>{brl(c.proximo.valor)}{c.proximo.estimado ? ' (estimado)' : ''}</Text></div></div>
                : <Text type="secondary">—</Text>,
            },
            { title: 'Forma', width: 130, render: (_, c) => FORMAS_PAGAMENTO.find(f => f.value === c.forma)?.label || c.forma },
            { title: 'Situação', width: 100, render: (_, c) => <Tag color={COR_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Tag> },
            {
              title: '', width: 130, align: 'right',
              render: (_, c) => (
                <Space size={2}>
                  <Tooltip title="Editar"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditando(c)} /></Tooltip>
                  {c.status === 'ATIVA' && (
                    <Popconfirm title="Pausar esta conta?" description="Os próximos meses ainda não mexidos saem do contas a pagar (o mês atual fica)." okText="Pausar" cancelText="Voltar"
                      onConfirm={() => status(c, 'PAUSADA', 'Conta pausada.')}>
                      <Tooltip title="Pausar"><Button size="small" type="text" icon={<PauseCircleOutlined />} /></Tooltip>
                    </Popconfirm>
                  )}
                  {c.status !== 'ATIVA' && (
                    <Tooltip title="Ativar de novo (lança os próximos meses)"><Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={() => status(c, 'ATIVA', 'Conta ativada.')} /></Tooltip>
                  )}
                  {c.status !== 'ENCERRADA' && (
                    <Popconfirm title="Encerrar esta conta?" description="Para contrato que acabou. Os próximos meses ainda não mexidos saem do contas a pagar." okText="Encerrar" okButtonProps={{ danger: true }} cancelText="Voltar"
                      onConfirm={() => status(c, 'ENCERRADA', 'Conta encerrada.')}>
                      <Tooltip title="Encerrar"><Button size="small" type="text" danger icon={<StopOutlined />} /></Tooltip>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <ContaFixaModal conta={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }}
        onCategorias={() => setCategorias(true)} versaoCategorias={versaoCategorias} />
      <CategoriasDrawer aberto={categorias} onFechar={() => setCategorias(false)} onAlterado={() => setVersaoCategorias(v => v + 1)} />
    </div>
  );
};

export default ContasFixas;

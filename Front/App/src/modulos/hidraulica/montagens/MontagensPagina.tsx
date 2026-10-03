// Módulo Hidráulica · Montagens: OS de montagem de mangueiras.
// Lista por etapa; editor com cliente/equipamento/previsão, mangueiras (ficha + materiais montados pelo
// montador), itens avulsos; etapas, sinal (entra no caixa), impressão, cancelamento e entrega pelo PDV.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Checkbox, DatePicker, Drawer, Empty, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Steps, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, DollarOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, ShoppingCartOutlined, StopOutlined, ToolOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { buscarClientesPdv, ClienteBusca } from '../../../pages/PDV/services/api/products';
import { operadorAtual, ROTULO_FORMA } from '../../../pages/PDV/caixa/caixaApi';
import { caixaStore } from '../../../pages/PDV/caixa/caixaStore';
import { EtapaOs, ETAPAS_OS, FichaMangueira, OsDetalhe, OsResumo, osApi } from './montagensApi';
import { brl, CamposFicha, CamposMontagem, EstadoMontagem, estadoInicialMontagem, fichaDaMontagem, gravarUltimos, ItemEscolhido, linhasDaMontagem, SeletorItem } from './montador';
import { imprimirOs } from './impressaoOs';
import { CHAVE_ENTREGAR_OS } from './MontagemPdv';

const { Text, Title } = Typography;
const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const erroDe = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);
const ETAPAS_FLUXO: EtapaOs[] = ['ABERTA', 'AGUARDANDO_MATERIAL', 'EM_MONTAGEM', 'PRONTA'];

interface ItemEdit {
  chave: number; idItem: number; descricao: string; idUnidade: number | null; quantidade: number; precoUnitario?: number;
  unidade?: string; unidadeBase?: boolean; faltaMaterial?: boolean; servico?: boolean;
}
interface MangueiraEdit { chave: number; ficha: FichaMangueira; itens: ItemEdit[] }
interface Cabecalho { idCliente: number | null; clienteNome: string; contato: string; equipamento: string; previsao: Dayjs | null; observacao: string }

let seq = 1;
const novaChave = () => seq++;
const CAB_VAZIO: Cabecalho = { idCliente: null, clienteNome: '', contato: '', equipamento: '', previsao: null, observacao: '' };

// ---------------------------------------------------------------------------------------------
// Montar materiais de uma mangueira (mesmo montador do PDV)
// ---------------------------------------------------------------------------------------------
const ModalMontarMateriais: React.FC<{ aberto: boolean; onFechar: () => void; onConfirmar: (itens: ItemEdit[], ficha: Partial<FichaMangueira>) => void }> = ({ aberto, onFechar, onConfirmar }) => {
  const [e, setE] = useState<EstadoMontagem>(estadoInicialMontagem);
  useEffect(() => { if (aberto) setE(estadoInicialMontagem()); }, [aberto]);
  const linhas = useMemo(() => linhasDaMontagem(e), [e]);
  return (
    <Modal open={aberto} onCancel={onFechar} width={720} title={<Space><ToolOutlined /> Montar materiais</Space>} okText="Usar estes materiais" cancelText="Cancelar"
      okButtonProps={{ disabled: linhas.length === 0 }} destroyOnHidden
      onOk={() => {
        gravarUltimos(e);
        onConfirmar(
          linhas.map(l => ({ chave: novaChave(), idItem: l.item.id, descricao: l.item.nome, idUnidade: null, quantidade: l.quantidade, unidadeBase: l.unidadeBase, unidade: l.unidadeBase ? 'm' : '' })),
          fichaDaMontagem(e, {}),
        );
      }}>
      <CamposMontagem valor={e} onChange={setE} />
      {linhas.length > 0 && (
        <Table size="small" style={{ marginTop: 10 }} pagination={false} rowKey={l => `${l.papel}-${l.item.id}`} dataSource={linhas} columns={[
          { title: '', dataIndex: 'papel', width: 100, render: (p: string) => <Tag style={{ margin: 0 }}>{p}</Tag> },
          { title: 'Item', key: 'i', render: (_, l) => l.item.nome },
          { title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_, l) => `${l.quantidade.toLocaleString('pt-BR')}${l.unidadeBase ? ' m' : ''}` },
        ]} />
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------
// Tabela de materiais (de uma mangueira ou avulsos)
// ---------------------------------------------------------------------------------------------
const TabelaItens: React.FC<{ itens: ItemEdit[]; editavel: boolean; onChange: (itens: ItemEdit[]) => void }> = ({ itens, editavel, onChange }) => (
  <Table<ItemEdit> size="small" pagination={false} rowKey="chave" dataSource={itens}
    locale={{ emptyText: 'Sem materiais' }}
    columns={[
      {
        title: 'Material', key: 'd',
        render: (_, i) => (
          <span>{i.descricao}{' '}
            {i.servico && <Tag style={{ fontSize: 10, margin: 0 }}>serviço</Tag>}
            {i.faltaMaterial && <Tooltip title="Estoque atual não cobre a quantidade"><Tag color="orange" style={{ fontSize: 10, margin: 0 }}>falta material</Tag></Tooltip>}
          </span>
        ),
      },
      {
        title: 'Qtd', key: 'q', width: 130,
        render: (_, i) => (editavel
          ? <InputNumber size="small" min={0} precision={3} decimalSeparator="," value={i.quantidade} addonAfter={i.unidade || undefined} style={{ width: 120 }}
              onChange={v => onChange(itens.map(x => (x.chave === i.chave ? { ...x, quantidade: Number(v) || 0, precoUnitario: undefined } : x)))} />
          : `${i.quantidade.toLocaleString('pt-BR')} ${i.unidade || ''}`),
      },
      { title: 'Unit.', key: 'p', width: 100, align: 'right' as const, render: (_, i) => (i.precoUnitario === undefined ? <Text type="secondary">ao salvar</Text> : brl(i.precoUnitario)) },
      { title: 'Total', key: 't', width: 100, align: 'right' as const, render: (_, i) => (i.precoUnitario === undefined ? '—' : brl(Math.round(i.quantidade * i.precoUnitario * 100) / 100)) },
      ...(editavel ? [{
        title: '', key: 'x', width: 36,
        render: (_: unknown, i: ItemEdit) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(itens.filter(x => x.chave !== i.chave))} />,
      }] : []),
    ]} />
);

// ---------------------------------------------------------------------------------------------
// Editor da OS
// ---------------------------------------------------------------------------------------------
const DrawerOs: React.FC<{ idOs: number | 'nova' | null; onFechar: () => void; onAlterado: () => void }> = ({ idOs, onFechar, onAlterado }) => {
  const navigate = useNavigate();
  const [detalhe, setDetalhe] = useState<OsDetalhe | null>(null);
  const [cab, setCab] = useState<Cabecalho>(CAB_VAZIO);
  const [mangueiras, setMangueiras] = useState<MangueiraEdit[]>([]);
  const [avulsos, setAvulsos] = useState<ItemEdit[]>([]);
  const [clientes, setClientes] = useState<ClienteBusca[]>([]);
  const [montandoPara, setMontandoPara] = useState<number | null>(null);
  const [novoAvulso, setNovoAvulso] = useState<ItemEscolhido | null>(null);
  const [qtdAvulso, setQtdAvulso] = useState<number | null>(1);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [modalSinal, setModalSinal] = useState(false);
  const [sinal, setSinal] = useState<{ valor: number | null; forma: string }>({ valor: null, forma: 'PIX' });

  const finalizada = detalhe?.status === 'ENTREGUE' || detalhe?.status === 'CANCELADA';
  const editavel = !finalizada;

  const paraItemEdit = (i: OsDetalhe['itensAvulsos'][number]): ItemEdit => ({
    chave: novaChave(), idItem: i.idItem, descricao: i.descricao, idUnidade: i.idUnidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario,
    unidade: i.unidade, faltaMaterial: i.faltaMaterial, servico: i.servico,
  });

  const carregar = async (id: number) => {
    try {
      const d = await osApi.detalhe(id);
      setDetalhe(d);
      setCab({ idCliente: d.idCliente, clienteNome: d.cliente || '', contato: d.contato || '', equipamento: d.equipamento || '', previsao: d.previsao ? dayjs(d.previsao) : null, observacao: d.observacao || '' });
      setMangueiras(d.mangueiras.map(m => ({ chave: novaChave(), ficha: { equipamento: m.equipamento, posicao: m.posicao, bitola: m.bitola, comprimentoM: m.comprimentoM, quantidade: m.quantidade, terminalA: m.terminalA, terminalB: m.terminalB, angulo: m.angulo, pressaoTrabalho: m.pressaoTrabalho, observacao: m.observacao }, itens: m.itens.map(paraItemEdit) })));
      setAvulsos(d.itensAvulsos.map(paraItemEdit));
      if (d.idCliente) setClientes([{ id: d.idCliente, nome: d.cliente, documento: '', tipo: '', razaoSocial: null }]);
      setSujo(false);
    } catch (e) {
      message.error(erroDe(e, 'Erro ao carregar a OS.'));
    }
  };

  useEffect(() => {
    if (idOs === null) return;
    if (idOs === 'nova') {
      setDetalhe(null); setCab(CAB_VAZIO); setAvulsos([]); setSujo(false);
      setMangueiras([{ chave: novaChave(), ficha: {}, itens: [] }]);
    } else carregar(idOs);
  }, [idOs]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setSujo(true); };
  const setCabM = marcar<Cabecalho>(setCab);
  const setMangueirasM = marcar<MangueiraEdit[]>(setMangueiras);
  const setAvulsosM = marcar<ItemEdit[]>(setAvulsos);

  const totalEditado = [...mangueiras.flatMap(m => m.itens), ...avulsos].reduce((a, i) => a + (i.precoUnitario === undefined ? 0 : Math.round(i.quantidade * i.precoUnitario * 100) / 100), 0);

  const montarEntrada = () => ({
    idCliente: cab.idCliente, clienteNome: cab.clienteNome || 'CONSUMIDOR', contato: cab.contato, equipamento: cab.equipamento,
    previsao: cab.previsao ? cab.previsao.format('YYYY-MM-DD') : null, observacao: cab.observacao,
    mangueiras: mangueiras.map(m => ({
      ...m.ficha, equipamento: m.ficha.equipamento || cab.equipamento,
      itens: m.itens.filter(i => i.quantidade > 0).map(i => ({ idItem: i.idItem, idUnidade: i.idUnidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario, unidadeBase: i.unidadeBase })),
    })),
    itensAvulsos: avulsos.filter(i => i.quantidade > 0).map(i => ({ idItem: i.idItem, idUnidade: i.idUnidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      if (idOs === 'nova') {
        const r = await osApi.criar(montarEntrada());
        message.success(`OS Nº ${r.idOs} aberta.`);
        onAlterado();
        await carregar(r.idOs);
      } else if (typeof idOs === 'number') {
        await osApi.salvar(idOs, montarEntrada());
        message.success('OS salva.');
        onAlterado();
        await carregar(idOs);
      }
    } catch (e) {
      message.error(erroDe(e, 'Erro ao salvar a OS.'));
    } finally {
      setSalvando(false);
    }
  };

  const mudarEtapa = async (status: EtapaOs) => {
    if (!detalhe) return;
    try { await osApi.etapa(detalhe.idOs, status); await carregar(detalhe.idOs); onAlterado(); } catch (e) { message.error(erroDe(e, 'Erro ao mudar a etapa.')); }
  };

  const receberSinal = async () => {
    if (!detalhe) return;
    try {
      await osApi.sinal(detalhe.idOs, Number(sinal.valor) || 0, sinal.forma, operadorAtual());
      message.success('Sinal recebido (entrou no caixa).');
      setModalSinal(false);
      caixaStore.recarregar();
      await carregar(detalhe.idOs);
      onAlterado();
    } catch (e) {
      message.error(erroDe(e, 'Erro ao receber o sinal.'));
      if (/caixa/i.test(erroDe(e, ''))) caixaStore.mostrar('abrir');
    }
  };

  const cancelar = () => {
    if (!detalhe) return;
    let motivo = '';
    let devolver = detalhe.sinalAberto > 0;
    Modal.confirm({
      title: `Cancelar a OS Nº ${detalhe.idOs}?`,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Motivo (obrigatório)" onChange={e => { motivo = e.target.value; }} />
          {detalhe.sinalAberto > 0 && (
            <Checkbox defaultChecked onChange={e => { devolver = e.target.checked; }}>
              Devolver o sinal de {brl(detalhe.sinalAberto)} agora (sai do caixa). Desmarcado, fica como crédito do cliente.
            </Checkbox>
          )}
        </Space>
      ),
      okText: 'Cancelar OS', okButtonProps: { danger: true }, cancelText: 'Voltar',
      onOk: async () => {
        if (!motivo.trim()) { message.warning('Informe o motivo.'); throw new Error('motivo'); }
        try {
          const r = await osApi.cancelar(detalhe.idOs, motivo, devolver, operadorAtual());
          message.success(r.devolvido > 0 ? `OS cancelada; ${brl(r.devolvido)} devolvido.` : 'OS cancelada.');
          caixaStore.recarregar();
          await carregar(detalhe.idOs);
          onAlterado();
        } catch (e) { message.error(erroDe(e, 'Erro ao cancelar.')); throw e; }
      },
    });
  };

  const entregar = () => {
    if (!detalhe) return;
    if (sujo) { message.warning('Salve a OS antes de entregar.'); return; }
    try { sessionStorage.setItem(CHAVE_ENTREGAR_OS, String(detalhe.idOs)); } catch { /* sem armazenamento */ }
    navigate('/vendas/pdv');
  };

  const titulo = idOs === 'nova' ? 'Nova OS de montagem' : detalhe ? `OS Nº ${detalhe.idOs} · ${ETAPAS_OS[detalhe.status].label}` : 'OS';

  return (
    <Drawer open={idOs !== null} onClose={() => { if (sujo) { Modal.confirm({ title: 'Descartar alterações?', okText: 'Descartar', cancelText: 'Voltar', onOk: onFechar }); } else onFechar(); }}
      width={980} title={titulo}
      extra={(
        <Space>
          {detalhe && <Button icon={<PrinterOutlined />} onClick={() => imprimirOs(detalhe)} disabled={sujo}>Imprimir</Button>}
          {editavel && <Button type="primary" loading={salvando} onClick={salvar} disabled={idOs !== 'nova' && !sujo}>{idOs === 'nova' ? 'Abrir OS' : 'Salvar'}</Button>}
        </Space>
      )}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {detalhe && !finalizada && (
          <Card size="small">
            <Steps size="small" current={ETAPAS_FLUXO.indexOf(detalhe.status)} onChange={i => mudarEtapa(ETAPAS_FLUXO[i])}
              items={ETAPAS_FLUXO.map(s => ({ title: ETAPAS_OS[s].label }))} />
            <Space style={{ marginTop: 12 }} wrap>
              <Button icon={<DollarOutlined />} onClick={() => { setSinal({ valor: null, forma: 'PIX' }); setModalSinal(true); }}>Receber sinal</Button>
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={entregar}>Entregar (vender no PDV)</Button>
              <Button danger icon={<StopOutlined />} onClick={cancelar}>Cancelar OS</Button>
            </Space>
          </Card>
        )}
        {detalhe?.status === 'ENTREGUE' && <Alert type="success" showIcon message={`Entregue em ${dataBr(detalhe.entregueEm)} · venda Nº ${detalhe.idVenda}`} />}
        {detalhe?.status === 'CANCELADA' && <Alert type="error" showIcon message={`Cancelada em ${dataBr(detalhe.canceladoEm)}: ${detalhe.motivoCancelamento || ''}`} />}
        {detalhe?.faltaMaterial && !finalizada && <Alert type="warning" showIcon message="Há material sem estoque suficiente (veja as marcações). Ele sai do estoque só na entrega." />}

        {/* Cliente e equipamento */}
        <Card size="small" title="Cliente e equipamento">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Cliente do cadastro</Text>
              <Select showSearch allowClear filterOption={false} disabled={!editavel} placeholder="Buscar por nome, CPF ou CNPJ" style={{ width: '100%' }}
                value={cab.idCliente ?? undefined} onSearch={t => { if (t.trim().length >= 2) buscarClientesPdv(t).then(setClientes); }}
                onChange={id => { const c = clientes.find(x => x.id === id); setCabM({ ...cab, idCliente: c?.id ?? null, clienteNome: c?.nome || cab.clienteNome }); }}
                options={clientes.map(c => ({ value: c.id, label: `${c.nome}${c.documento ? ` · ${c.documento}` : ''}` }))} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Nome (se não for cadastrado)</Text>
              <Input disabled={!editavel || Boolean(cab.idCliente)} value={cab.clienteNome} onChange={e => setCabM({ ...cab, clienteNome: e.target.value })} maxLength={150} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Contato</Text>
              <Input disabled={!editavel} value={cab.contato} onChange={e => setCabM({ ...cab, contato: e.target.value })} placeholder="(11) 99999-0000" maxLength={100} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Equipamento</Text>
              <Input disabled={!editavel} value={cab.equipamento} onChange={e => setCabM({ ...cab, equipamento: e.target.value })} placeholder="Ex.: retroescavadeira JCB 3C" maxLength={150} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Previsão de entrega</Text>
              <DatePicker disabled={!editavel} format="DD/MM/YYYY" style={{ width: '100%' }} value={cab.previsao} onChange={v => setCabM({ ...cab, previsao: v })} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Observação</Text>
              <Input disabled={!editavel} value={cab.observacao} onChange={e => setCabM({ ...cab, observacao: e.target.value })} maxLength={500} />
            </div>
          </div>
        </Card>

        {/* Mangueiras */}
        {mangueiras.map((m, idx) => (
          <Card key={m.chave} size="small"
            title={<Space><ToolOutlined />Mangueira {idx + 1}{m.ficha.posicao ? ` · ${m.ficha.posicao}` : ''}</Space>}
            extra={editavel && (
              <Space size={4}>
                <Button size="small" type="primary" ghost icon={<ToolOutlined />} onClick={() => setMontandoPara(m.chave)}>Montar materiais</Button>
                <Tooltip title="Duplicar (outra peça parecida)">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => setMangueirasM([...mangueiras.slice(0, idx + 1), { chave: novaChave(), ficha: { ...m.ficha }, itens: m.itens.map(i => ({ ...i, chave: novaChave() })) }, ...mangueiras.slice(idx + 1)])} />
                </Tooltip>
                <Popconfirm title="Tirar esta mangueira da OS?" okText="Tirar" cancelText="Não" onConfirm={() => setMangueirasM(mangueiras.filter(x => x.chave !== m.chave))}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )}>
            <CamposFicha comComprimento valor={m.ficha} onChange={f => setMangueirasM(mangueiras.map(x => (x.chave === m.chave ? { ...x, ficha: f } : x)))} />
            <div style={{ marginTop: 8 }}>
              <TabelaItens itens={m.itens} editavel={editavel} onChange={itens => setMangueirasM(mangueiras.map(x => (x.chave === m.chave ? { ...x, itens } : x)))} />
            </div>
          </Card>
        ))}
        {editavel && <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setMangueirasM([...mangueiras, { chave: novaChave(), ficha: {}, itens: [] }])}>Adicionar mangueira</Button>}

        {/* Itens avulsos */}
        <Card size="small" title="Outros itens (conexões, adaptadores, serviços...)">
          {editavel && (
            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <div style={{ flex: 1 }}><SeletorItem valor={novoAvulso} onChange={setNovoAvulso} placeholder="Buscar item ou serviço" /></div>
              <InputNumber min={0} precision={3} decimalSeparator="," value={qtdAvulso} onChange={setQtdAvulso} style={{ width: 100 }} />
              <Button icon={<PlusOutlined />} disabled={!novoAvulso || !(Number(qtdAvulso) > 0)}
                onClick={() => { if (!novoAvulso) return; setAvulsosM([...avulsos, { chave: novaChave(), idItem: novoAvulso.id, descricao: novoAvulso.nome, idUnidade: null, quantidade: Number(qtdAvulso) }]); setNovoAvulso(null); setQtdAvulso(1); }}>
                Adicionar
              </Button>
            </Space.Compact>
          )}
          <TabelaItens itens={avulsos} editavel={editavel} onChange={setAvulsosM} />
        </Card>

        {/* Totais e sinais */}
        <Card size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Space direction="vertical" size={2}>
              <Text strong>Sinais</Text>
              {detalhe && detalhe.sinais.length > 0 ? detalhe.sinais.map(s => (
                <Text key={s.idAdiantamento} style={{ fontSize: 12 }}>
                  Nº {s.idAdiantamento} · {ROTULO_FORMA[s.forma] || s.forma} · {brl(s.valor)} <Tag style={{ fontSize: 10 }}>{s.status === 'ABERTO' ? `disponível ${brl(s.saldo)}` : s.status.toLowerCase()}</Tag>
                </Text>
              )) : <Text type="secondary" style={{ fontSize: 12 }}>Nenhum sinal</Text>}
            </Space>
            <div style={{ textAlign: 'right' }}>
              <div>Total {sujo && <Text type="secondary" style={{ fontSize: 11 }}>(itens novos têm o preço definido ao salvar)</Text>}: <b style={{ fontSize: 18 }}>{brl(sujo ? totalEditado : detalhe?.total ?? totalEditado)}</b></div>
              {detalhe && detalhe.sinalAberto > 0 && <div>Sinal: -{brl(detalhe.sinalAberto)} · <b>A pagar: {brl(detalhe.saldoAPagar)}</b></div>}
            </div>
          </div>
        </Card>
      </Space>

      <ModalMontarMateriais aberto={montandoPara !== null} onFechar={() => setMontandoPara(null)}
        onConfirmar={(itens, ficha) => {
          setMangueirasM(mangueiras.map(x => (x.chave === montandoPara
            ? { ...x, itens: [...x.itens, ...itens], ficha: { ...ficha, ...Object.fromEntries(Object.entries(x.ficha).filter(([, v]) => v !== undefined && v !== null && v !== '')) } }
            : x)));
          setMontandoPara(null);
        }} />

      <Modal open={modalSinal} title="Receber sinal da OS" okText="Receber" cancelText="Voltar" onCancel={() => setModalSinal(false)} onOk={receberSinal}
        okButtonProps={{ disabled: !(Number(sinal.valor) > 0) }} destroyOnHidden width={400}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Entra no caixa agora e abate no pagamento da entrega.</Text>
          <Space.Compact style={{ width: '100%' }}>
            <Select value={sinal.forma} onChange={f => setSinal(s => ({ ...s, forma: f }))} style={{ width: 150 }}
              options={['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'].map(f => ({ value: f, label: ROTULO_FORMA[f] }))} />
            <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} value={sinal.valor} onChange={v => setSinal(s => ({ ...s, valor: v }))} />
          </Space.Compact>
        </Space>
      </Modal>
    </Drawer>
  );
};

// ---------------------------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------------------------
const MontagensPagina: React.FC = () => {
  const [filtro, setFiltro] = useState('ABERTAS');
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<OsResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState<number | 'nova' | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await osApi.listar(filtro, busca.trim())); } catch (e) { message.error(erroDe(e, 'Erro ao listar as OS.')); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoje = dayjs().format('YYYY-MM-DD');
  const contagem = (s: EtapaOs) => lista.filter(o => o.status === s).length;

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}><ToolOutlined /> Montagens de mangueiras</Title>
            <Text type="secondary">OS com sinal, ficha técnica e entrega pelo PDV. Montagem na hora: botão "Montagem" no PDV.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberta('nova')}>Nova OS</Button>
          </Space>
        </div>

        {filtro === 'ABERTAS' && lista.length > 0 && (
          <Space wrap>
            {ETAPAS_FLUXO.map(s => <Tag key={s} color={ETAPAS_OS[s].color}>{ETAPAS_OS[s].label}: {contagem(s)}</Tag>)}
          </Space>
        )}

        <Card size="small">
          <Space wrap style={{ marginBottom: 10 }}>
            <Segmented value={filtro} onChange={v => setFiltro(String(v))} options={[
              { value: 'ABERTAS', label: 'Em andamento' }, { value: 'PRONTA', label: 'Prontas' }, { value: 'ENTREGUE', label: 'Entregues' },
              { value: 'CANCELADA', label: 'Canceladas' }, { value: 'TODAS', label: 'Todas' },
            ]} />
            <Input.Search allowClear placeholder="Cliente, contato, equipamento ou nº" style={{ width: 300 }}
              value={busca} onChange={e => setBusca(e.target.value)} onSearch={carregar} />
          </Space>
          <Table<OsResumo>
            size="small"
            rowKey="idOs"
            loading={carregando}
            dataSource={lista}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            onRow={o => ({ onClick: () => setAberta(o.idOs), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma OS" /> }}
            columns={[
              { title: 'Nº', dataIndex: 'idOs', width: 60 },
              {
                title: 'Cliente', key: 'c',
                render: (_, o) => (
                  <div style={{ lineHeight: 1.2 }}>
                    <div>{o.cliente}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{[o.equipamento, o.contato, `${o.qtdMangueiras} mangueira(s)`].filter(Boolean).join(' · ')}</Text>
                  </div>
                ),
              },
              { title: 'Etapa', dataIndex: 'status', width: 160, render: (s: EtapaOs) => <Tag color={ETAPAS_OS[s].color}>{ETAPAS_OS[s].label}</Tag> },
              {
                title: 'Previsão', dataIndex: 'previsao', width: 110,
                render: (p: string | null, o) => (p
                  ? <Text type={p < hoje && !['ENTREGUE', 'CANCELADA'].includes(o.status) ? 'danger' : undefined}>{dataBr(p)}</Text>
                  : '—'),
              },
              { title: 'Total', dataIndex: 'total', width: 110, align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
              { title: 'Sinal', dataIndex: 'sinal', width: 100, align: 'right' as const, render: (v: number) => (v > 0 ? brl(v) : '—') },
            ]}
          />
        </Card>
      </Space>
      <DrawerOs idOs={aberta} onFechar={() => setAberta(null)} onAlterado={carregar} />
    </div>
  );
};

export default MontagensPagina;

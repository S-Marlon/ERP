// Editor de um atributo do PIM: dados (com travas conforme o uso), opções da lista editáveis no lugar
// (renomear, código, ordem, mesclar, excluir), uso real e correções (texto → lista, valores soltos).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Checkbox, Descriptions, Drawer, Empty, Flex, Form, Input, Modal, Popconfirm, Select, Space, Spin, Table, Tabs, Tag,
  Tooltip, Typography, message,
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, LockOutlined, MergeCellsOutlined, PlusOutlined, SaveOutlined, ToolOutlined, WarningOutlined,
} from '@ant-design/icons';
import { atributoEdicaoApi, DetalheAtributo, ErroApiAtributo, OpcaoDetalhe, Trava, updateAtributoGlobal } from './GlobalAttributeManager.api';
import type { GrupoVisualAPIResponse, UnidadeAPIResponse } from './GlobalAttributeManager.types';

const { Text } = Typography;

interface Props {
  idAtributo: string | null;
  grupos: GrupoVisualAPIResponse[];
  unidades: UnidadeAPIResponse[];
  onFechar: () => void;
  /** Algo foi gravado: recarregar a lista */
  onAlterado: () => void;
  onExcluir?: (id: string) => void;
}

/** Ícone/rótulo da trava de um campo: vermelho bloqueia, amarelo só avisa. */
const RotuloTrava: React.FC<{ rotulo: string; trava?: Trava }> = ({ rotulo, trava }) => (
  <Space size={4}>
    <span>{rotulo}</span>
    {trava?.nivel === 'bloqueado' && <Tooltip title={trava.motivo}><LockOutlined style={{ color: '#cf1322' }} /></Tooltip>}
    {trava?.nivel === 'aviso' && <Tooltip title={trava.motivo}><WarningOutlined style={{ color: '#d48806' }} /></Tooltip>}
  </Space>
);

/** Pergunta antes de gravar quando o servidor avisa que nome/SKU de itens vão mudar. */
const comConfirmacao = async <T,>(executar: (confirmar: boolean) => Promise<T>): Promise<T | null> => {
  try {
    return await executar(false);
  } catch (e) {
    if (e instanceof ErroApiAtributo && e.status === 409 && e.detalhes?.codigo === 'CONFIRMAR') {
      const ok = await new Promise<boolean>(resolve => Modal.confirm({
        title: e.message,
        width: 560,
        content: <ul style={{ paddingLeft: 18, marginBottom: 0 }}>{(e.detalhes.impacto?.mensagens || []).map((m: string) => <li key={m}>{m}</li>)}</ul>,
        okText: 'Entendi, gravar', cancelText: 'Cancelar', onOk: () => resolve(true), onCancel: () => resolve(false),
      }));
      return ok ? executar(true) : null;
    }
    throw e;
  }
};

const EditorAtributoDrawer: React.FC<Props> = ({ idAtributo, grupos, unidades, onFechar, onAlterado, onExcluir }) => {
  const [form] = Form.useForm();
  const [d, setD] = useState<DetalheAtributo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState('dados');
  // Opções em edição: valor/código digitados por id
  const [edicao, setEdicao] = useState<Record<number, { valor: string; codigo: string }>>({});
  const [nova, setNova] = useState({ valor: '', codigo: '' });
  const [plano, setPlano] = useState<Awaited<ReturnType<typeof atributoEdicaoApi.converterEmLista>> | null>(null);

  const carregar = useCallback(async () => {
    if (!idAtributo) return;
    setCarregando(true);
    try {
      const r = await atributoEdicaoApi.detalhe(idAtributo);
      setD(r);
      setEdicao({});
      setPlano(null);
      form.setFieldsValue({ ...r.atributo, grupoId: r.atributo.grupoId || undefined, unidadeId: r.atributo.unidadeId || undefined });
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [idAtributo, form]);
  useEffect(() => { if (idAtributo) { setAba('dados'); carregar(); } else setD(null); }, [idAtributo]); // eslint-disable-line react-hooks/exhaustive-deps

  const travas = d?.travas;
  const ehLista = d?.atributo.tipo === 'lista';

  // ---------------------------------------------------------------- dados
  const salvarDados = async () => {
    if (!d) return;
    const v = await form.validateFields();
    const a = d.atributo;
    // Só o que mudou (o servidor confere as travas de novo)
    const mudou: Record<string, unknown> = {};
    if (v.nome !== a.nome) mudou.nome = v.nome;
    if (v.codigo !== a.codigo) mudou.codigo = v.codigo;
    if (v.tipo !== a.tipo) mudou.tipo = v.tipo;
    if ((v.grupoId || '') !== a.grupoId) mudou.grupoId = v.grupoId || null;
    if ((v.unidadeId || '') !== a.unidadeId) mudou.unidadeId = v.unidadeId || null;
    if (v.escopoPadrao !== a.escopoPadrao) mudou.escopoPadrao = v.escopoPadrao;
    if ((v.descricao || '') !== a.descricao) mudou.descricao = v.descricao || '';
    if (v.obrigatorioPadrao !== a.obrigatorioPadrao) mudou.obrigatorioPadrao = v.obrigatorioPadrao;
    if (v.pesquisavel !== a.pesquisavel) mudou.pesquisavel = v.pesquisavel;
    if (!Object.keys(mudou).length) { message.info('Nada mudou.'); return; }
    setSalvando(true);
    try {
      await updateAtributoGlobal(a.id, mudou as any);
      message.success('Atributo salvo.');
      onAlterado();
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  // ---------------------------------------------------------------- opções
  const executar = async (fn: () => Promise<unknown>, ok: string) => {
    setSalvando(true);
    try {
      const r = await fn();
      if (r !== null) { message.success(ok); onAlterado(); await carregar(); }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setSalvando(false);
    }
  };
  const editado = (o: OpcaoDetalhe) => edicao[o.id] && (edicao[o.id].valor !== o.valor || edicao[o.id].codigo !== o.codigo);
  const salvarOpcao = (o: OpcaoDetalhe) => executar(
    () => comConfirmacao(confirmar => atributoEdicaoApi.editarOpcao(d!.atributo.id, o.id, { ...edicao[o.id], confirmar })),
    `"${edicao[o.id].valor}" salvo.`,
  );
  // Todas as opções editadas de uma vez (o servidor confere a lista final e pede uma confirmação só)
  const editadas = (d?.opcoes || []).filter(o => editado(o));
  const salvarTodas = () => executar(
    () => comConfirmacao(confirmar => atributoEdicaoApi.editarOpcoesLote(
      d!.atributo.id, editadas.map(o => ({ id: o.id, valor: edicao[o.id].valor.trim(), codigo: edicao[o.id].codigo.trim() })), confirmar,
    )),
    `${editadas.length} opção(ões) salva(s).`,
  );
  const mover = (indice: number, delta: number) => {
    if (!d) return;
    const ids = d.opcoes.map(o => o.id);
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= ids.length) return;
    [ids[indice], ids[alvo]] = [ids[alvo], ids[indice]];
    setD({ ...d, opcoes: ids.map(id => d.opcoes.find(o => o.id === id)!) });
    atributoEdicaoApi.ordenarOpcoes(d.atributo.id, ids).then(onAlterado).catch(e => message.error(e.message));
  };
  const mesclar = (o: OpcaoDetalhe) => {
    let destino: number | undefined;
    Modal.confirm({
      title: `Juntar "${o.valor}" em outra opção`,
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Os {o.itens} item(ns) de "{o.valor}" passam para a opção escolhida e "{o.valor}" sai da lista.</Text>
          <Select style={{ width: '100%' }} placeholder="Opção que fica" showSearch optionFilterProp="label" onChange={(v: number) => { destino = v; }}
            options={d!.opcoes.filter(x => x.id !== o.id).map(x => ({ value: x.id, label: `${x.valor}${x.codigo ? ` = ${x.codigo}` : ''} (${x.itens} itens)` }))} />
        </Space>
      ),
      okText: 'Juntar',
      onOk: () => {
        if (!destino) { message.warning('Escolha a opção que fica.'); return Promise.reject(); }
        return executar(() => comConfirmacao(confirmar => atributoEdicaoApi.mesclarOpcao(d!.atributo.id, o.id, destino!, confirmar)), 'Opções juntadas.');
      },
    });
  };
  const adicionar = () => {
    if (!nova.valor.trim()) { message.warning('Informe o valor.'); return; }
    executar(async () => { await atributoEdicaoApi.adicionarOpcao(d!.atributo.id, nova.valor.trim(), nova.codigo.trim() || undefined); setNova({ valor: '', codigo: '' }); return true; },
      `"${nova.valor.trim()}" entrou na lista.`);
  };

  const colunasOpcoes = [
    {
      title: '#', key: 'ordem', width: 70,
      render: (_: unknown, __: OpcaoDetalhe, i: number) => (
        <Space size={0}>
          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => mover(i, -1)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === (d?.opcoes.length || 0) - 1} onClick={() => mover(i, 1)} />
        </Space>
      ),
    },
    {
      title: 'Valor (vai no nome)', key: 'valor',
      render: (_: unknown, o: OpcaoDetalhe) => (
        <Input size="small" value={edicao[o.id]?.valor ?? o.valor}
          onChange={e => setEdicao(x => ({ ...x, [o.id]: { valor: e.target.value, codigo: x[o.id]?.codigo ?? o.codigo } }))} />
      ),
    },
    {
      title: <Tooltip title="Vai no SKU quando o modelo usa {Atributo:cod} (ex.: 1/2&quot; = 08)">Código (vai no SKU)</Tooltip>, key: 'codigo', width: 140,
      render: (_: unknown, o: OpcaoDetalhe) => (
        <Input size="small" style={{ fontFamily: 'monospace' }} value={edicao[o.id]?.codigo ?? o.codigo}
          onChange={e => setEdicao(x => ({ ...x, [o.id]: { valor: x[o.id]?.valor ?? o.valor, codigo: e.target.value.replace(/[^A-Za-z0-9._-]/g, '') } }))} />
      ),
    },
    {
      title: 'Itens', dataIndex: 'itens', width: 70, align: 'right' as const,
      render: (n: number) => (n ? <Tag color="blue" style={{ margin: 0 }}>{n}</Tag> : <Text type="secondary">0</Text>),
    },
    {
      key: 'acoes', width: 120,
      render: (_: unknown, o: OpcaoDetalhe) => (
        <Space size={0}>
          {editado(o) && (
            <>
              <Tooltip title="Salvar (os itens continuam nesta opção)"><Button size="small" type="link" icon={<SaveOutlined />} onClick={() => salvarOpcao(o)} /></Tooltip>
              <Button size="small" type="text" onClick={() => setEdicao(x => { const n = { ...x }; delete n[o.id]; return n; })}>×</Button>
            </>
          )}
          <Tooltip title="Juntar em outra opção (ex.: duas grafias do mesmo valor)"><Button size="small" type="text" icon={<MergeCellsOutlined />} onClick={() => mesclar(o)} /></Tooltip>
          {o.itens > 0 ? (
            <Tooltip title={`Em uso por ${o.itens} item(ns): junte em outra opção em vez de excluir`}><Button size="small" type="text" disabled icon={<LockOutlined />} /></Tooltip>
          ) : (
            <Popconfirm title={`Excluir "${o.valor}"?`} onConfirm={() => executar(() => atributoEdicaoApi.excluirOpcao(d!.atributo.id, o.id), 'Opção excluída.')}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------- render
  const inc = d?.inconsistencias;
  const temInconsistencia = !!inc && (inc.valoresSemOpcao > 0 || inc.valoresDeItensApagados > 0);
  const lugaresModelo = (f: DetalheAtributo['uso']['familiasTemplate'][number]) => [
    f.noNome.texto && 'nome', f.noNome.codigo && 'nome (código)', f.noSku.texto && 'SKU', f.noSku.codigo && 'SKU (código)',
  ].filter(Boolean).join(', ');

  return (
    <Drawer
      open={!!idAtributo}
      onClose={() => {
        const n = (d?.opcoes || []).filter(o => editado(o)).length;
        if (!n) { onFechar(); return; }
        Modal.confirm({ title: `Sair sem salvar ${n} opção(ões) alterada(s)?`, okText: 'Sair sem salvar', okButtonProps: { danger: true }, cancelText: 'Continuar editando', onOk: onFechar });
      }}
      width={920}
      destroyOnHidden
      title={d ? <Space>{d.atributo.nome}<Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.atributo.codigo}</Text><Tag>{d.atributo.tipo}</Tag></Space> : 'Atributo'}
      extra={d && (
        <Space>
          <Tooltip title={travas?.excluir.nivel === 'bloqueado' ? travas.excluir.motivo : 'Excluir o atributo'}>
            <Button danger icon={<DeleteOutlined />} disabled={travas?.excluir.nivel === 'bloqueado'} onClick={() => onExcluir?.(d.atributo.id)}>Excluir</Button>
          </Tooltip>
        </Space>
      )}
    >
      <style>{'.opcao-editada td { background: #fffbe6 !important; }'}</style>
      <Spin spinning={carregando}>
        {d && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Flex gap={8} wrap>
              <Tag color={d.uso.itens ? 'blue' : 'default'}>{d.uso.itens} item(ns) com valor</Tag>
              <Tag color={d.uso.vinculos.length ? 'purple' : 'default'}>{d.uso.vinculos.length} vínculo(s) com família/categoria</Tag>
              <Tag color={d.uso.familiasTemplate.length ? 'gold' : 'default'}>{d.uso.familiasTemplate.length} modelo(s) de nome/SKU</Tag>
            </Flex>
            {temInconsistencia && (
              <Alert type="warning" showIcon
                message="Valores inconsistentes neste atributo"
                description={(
                  <Space direction="vertical" size={4}>
                    {inc!.valoresSemOpcao > 0 && <span>{inc!.valoresSemOpcao} valor(es) gravados como texto solto, fora da lista: {inc!.textosSemOpcao.join(', ')}.</span>}
                    {inc!.valoresDeItensApagados > 0 && <span>{inc!.valoresDeItensApagados} valor(es) de itens que já foram apagados.</span>}
                    <Button size="small" icon={<ToolOutlined />} loading={salvando}
                      onClick={() => executar(async () => {
                        const r = await atributoEdicaoApi.corrigirValores(d.atributo.id);
                        message.info(`${r.ligados} ligado(s) à opção${r.opcoesCriadas ? ` (${r.opcoesCriadas} opção(ões) criada(s))` : ''}, ${r.orfaosApagados} órfão(s) apagado(s).`);
                        return r;
                      }, 'Valores corrigidos.')}>
                      Corrigir
                    </Button>
                  </Space>
                )} />
            )}

            <Tabs activeKey={aba} onChange={setAba} items={[
              {
                key: 'dados', label: 'Dados',
                children: (
                  <Form form={form} layout="vertical">
                    <Flex gap={12} wrap>
                      <Form.Item name="nome" label={<RotuloTrava rotulo="Nome" trava={travas?.nome} />} rules={[{ required: true }]} style={{ flex: '1 1 260px' }}>
                        <Input disabled={travas?.nome.nivel === 'bloqueado'} />
                      </Form.Item>
                      <Form.Item name="codigo" label={<RotuloTrava rotulo="Código técnico" trava={travas?.codigo} />} rules={[{ required: true }, { pattern: /^[A-Za-z0-9_]+$/, message: 'Letras, números e _' }]} style={{ flex: '1 1 200px' }}>
                        <Input style={{ fontFamily: 'monospace' }} disabled={travas?.codigo.nivel === 'bloqueado'} />
                      </Form.Item>
                    </Flex>
                    <Flex gap={12} wrap>
                      <Form.Item name="tipo" label={<RotuloTrava rotulo="Tipo de dado" trava={travas?.tipo} />} style={{ flex: '1 1 160px' }}>
                        <Select disabled={travas?.tipo.nivel === 'bloqueado'} options={['texto', 'numero', 'decimal', 'boolean', 'lista', 'data'].map(t => ({ value: t, label: t }))} />
                      </Form.Item>
                      <Form.Item name="escopoPadrao" label={<RotuloTrava rotulo="Papel padrão" trava={travas?.escopo} />} style={{ flex: '1 1 180px' }}>
                        <Select options={[{ value: 'ficha', label: 'Ficha técnica' }, { value: 'grade', label: 'Grade (gera variação)' }, { value: 'dna', label: 'DNA (fixo da família)' }]} />
                      </Form.Item>
                      <Form.Item name="unidadeId" label={<RotuloTrava rotulo="Unidade" trava={travas?.unidade} />} style={{ flex: '1 1 160px' }}>
                        <Select allowClear placeholder="sem unidade" options={unidades.map(u => ({ value: String(u.id), label: `${u.nome} (${u.simbolo})` }))} />
                      </Form.Item>
                      <Form.Item name="grupoId" label="Grupo" style={{ flex: '1 1 180px' }}>
                        <Select allowClear placeholder="sem grupo" options={grupos.map(g => ({ value: String(g.id), label: g.nome }))} />
                      </Form.Item>
                    </Flex>
                    <Form.Item name="descricao" label="Ajuda para o operador">
                      <Input.TextArea rows={2} placeholder="Ex.: medida nominal da mangueira, em polegadas" />
                    </Form.Item>
                    <Space size={24}>
                      <Form.Item name="obrigatorioPadrao" valuePropName="checked" noStyle><Checkbox>Obrigatório por padrão</Checkbox></Form.Item>
                      <Form.Item name="pesquisavel" valuePropName="checked" noStyle><Checkbox>Pesquisável</Checkbox></Form.Item>
                    </Space>
                    <Flex justify="flex-end" style={{ marginTop: 16 }}>
                      <Button type="primary" icon={<SaveOutlined />} loading={salvando} onClick={salvarDados}>Salvar dados</Button>
                    </Flex>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <LockOutlined style={{ color: '#cf1322' }} /> bloqueado pelo uso · <WarningOutlined style={{ color: '#d48806' }} /> pode mudar, com efeito no que já existe (passe o mouse para ver)
                    </Text>
                  </Form>
                ),
              },
              ehLista ? {
                key: 'opcoes', label: <Badge count={d.opcoes.length} size="small" offset={[10, 0]} color="#1677ff">Opções da lista</Badge>,
                children: (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Edite no lugar: os itens continuam ligados à opção (renomear não perde nada). Se a mudança alterar nome/SKU de itens, o sistema avisa antes.
                      Opção em uso não pode ser excluída: junte em outra.
                    </Text>
                    {editadas.length > 0 && (
                      <Flex justify="space-between" align="center" style={{ padding: '6px 10px', borderRadius: 6, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                        <Text>{editadas.length} opção(ões) alterada(s), ainda não salva(s)</Text>
                        <Space>
                          <Button size="small" onClick={() => setEdicao({})}>Descartar</Button>
                          <Button size="small" type="primary" icon={<SaveOutlined />} loading={salvando} onClick={salvarTodas}>Salvar todas ({editadas.length})</Button>
                        </Space>
                      </Flex>
                    )}
                    <Table<OpcaoDetalhe> size="small" rowKey="id" pagination={false} dataSource={d.opcoes} columns={colunasOpcoes}
                      rowClassName={o => (editado(o) ? 'opcao-editada' : '')}
                      locale={{ emptyText: <Empty description="Sem opções ainda" /> }} />
                    <Flex gap={8} align="center">
                      <Input placeholder='Nova opção (ex.: 5/8")' value={nova.valor} onChange={e => setNova(n => ({ ...n, valor: e.target.value }))} onPressEnter={adicionar} />
                      <Input placeholder="Código (opcional)" style={{ width: 160, fontFamily: 'monospace' }} value={nova.codigo}
                        onChange={e => setNova(n => ({ ...n, codigo: e.target.value.replace(/[^A-Za-z0-9._-]/g, '') }))} onPressEnter={adicionar} />
                      <Button type="primary" icon={<PlusOutlined />} onClick={adicionar} loading={salvando}>Adicionar</Button>
                    </Flex>
                  </Space>
                ),
              } : {
                key: 'valores', label: 'Valores gravados',
                children: (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {d.atributo.tipo === 'texto' && d.valores.length > 0 && (
                      <Alert type="info" showIcon
                        message="Converter em lista"
                        description={(
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <span>Com poucos valores diferentes, lista é melhor: evita grafias diferentes e permite código no SKU. Cada valor vira uma opção e os itens passam a apontar para ela.</span>
                            {!plano ? (
                              <Button size="small" onClick={() => atributoEdicaoApi.converterEmLista(d.atributo.id, false).then(setPlano).catch(e => message.error(e.message))}>Ver como fica</Button>
                            ) : (
                              <>
                                {plano.aviso && <Text type="warning">{plano.aviso}</Text>}
                                <Flex gap={4} wrap>{plano.opcoes.map(o => (
                                  <Tooltip key={o.valor} title={o.variantes.length ? `Junta também: ${o.variantes.join(', ')}` : undefined}>
                                    <Tag>{o.valor} = {o.codigo} <Text type="secondary">({o.qtd})</Text>{o.variantes.length ? ' *' : ''}</Tag>
                                  </Tooltip>
                                ))}</Flex>
                                <Popconfirm title={`Converter "${d.atributo.nome}" em lista com ${plano.opcoes.length} opção(ões)?`}
                                  description="Os códigos podem ser ajustados depois, na aba de opções."
                                  onConfirm={() => executar(() => atributoEdicaoApi.converterEmLista(d.atributo.id, true), 'Convertido em lista.')}>
                                  <Button size="small" type="primary">Converter em lista</Button>
                                </Popconfirm>
                              </>
                            )}
                          </Space>
                        )} />
                    )}
                    <Table size="small" rowKey="texto" pagination={{ pageSize: 20, hideOnSinglePage: true }} dataSource={d.valores}
                      locale={{ emptyText: <Empty description="Nenhum item com valor neste atributo" /> }}
                      columns={[{ title: 'Valor', dataIndex: 'texto' }, { title: 'Itens', dataIndex: 'qtd', width: 90, align: 'right' as const }]} />
                  </Space>
                ),
              },
              {
                key: 'uso', label: 'Onde é usado',
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Descriptions size="small" column={1} bordered items={[
                      { key: 'i', label: 'Itens com valor', children: d.uso.itens },
                    ]} />
                    <Table size="small" rowKey={v => `${v.tipo}-${v.id}`} pagination={false} dataSource={d.uso.vinculos}
                      title={() => <Text strong>Famílias e categorias ligadas</Text>}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum vínculo" /> }}
                      columns={[
                        { title: 'Tipo', dataIndex: 'tipo', width: 100, render: (t: string) => <Tag color={t === 'familia' ? 'blue' : 'purple'}>{t === 'familia' ? 'Família' : 'Categoria'}</Tag> },
                        { title: 'Nome', dataIndex: 'nome' },
                        { title: 'Papel', dataIndex: 'escopo', width: 90, render: (e: string) => <Tag>{e}</Tag> },
                        { title: 'Obrigatório', dataIndex: 'obrigatorio', width: 100, render: (o: boolean) => (o ? 'sim' : '') },
                      ]} />
                    <Table size="small" rowKey="id" pagination={false} dataSource={d.uso.familiasTemplate}
                      title={() => <Text strong>Modelos de nome/SKU que citam o atributo</Text>}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum modelo usa este atributo" /> }}
                      columns={[{ title: 'Família', dataIndex: 'nome' }, { title: 'Onde', key: 'onde', width: 220, render: (_, f) => lugaresModelo(f) }]} />
                  </Space>
                ),
              },
            ]} />
          </Space>
        )}
      </Spin>
    </Drawer>
  );
};

export default EditorAtributoDrawer;

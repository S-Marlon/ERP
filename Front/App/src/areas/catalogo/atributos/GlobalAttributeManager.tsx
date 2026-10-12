// Dicionário de atributos do PIM: lista com uso real e alertas (duplicados, sem uso, sem grupo),
// edição detalhada numa gaveta (EditorAtributoDrawer: travas, opções no lugar, texto → lista) e grupos.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Empty, Flex, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Spin, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CloseOutlined, DeleteOutlined, EditOutlined, FolderAddOutlined, InfoCircleOutlined, MergeCellsOutlined, PlusOutlined, RobotOutlined, SearchOutlined,
} from '@ant-design/icons';
import Swal from 'sweetalert2';
import {
  createAtributoGlobal, createGrupoAtributo, deleteAtributoGlobal, deleteGrupoAtributo, getAtributosGlobais, getGruposAtributos, getUnidadesMedida,
  mesclarAtributoGlobal, updateGrupoAtributo,
} from './GlobalAttributeManager.api';
import { GrupoVisualAPIResponse, IAtributoGlobal, UnidadeAPIResponse } from './GlobalAttributeManager.types';
import { ImportarAtributosModal } from './ImportarAtributosModal';
import EditorAtributoDrawer from './EditorAtributoDrawer';

const { Title, Text } = Typography;

/** Nome comparável (sem acento, caixa, espaço e símbolos) para achar atributos duplicados. */
export const chaveNomeAtributo = (nome: string) =>
  String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

// Código gerado a partir do texto (o "próprio" é o digitado pelo usuário, ex.: bitola "08")
const codigoGerado = (valor: string) => String(valor).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const codigoProprio = (o: { valor: string; codigo?: string }) => !!o.codigo && o.codigo !== codigoGerado(o.valor) && !/^OPC_\d+$/.test(o.codigo);

type FiltroRapido = 'todos' | 'sem_grupo' | 'sem_uso' | 'duplicados';
const PAPEL: Record<string, { cor: string; rotulo: string }> = {
  ficha: { cor: 'blue', rotulo: 'Ficha' }, grade: { cor: 'orange', rotulo: 'Grade' }, dna: { cor: 'magenta', rotulo: 'DNA' },
};

interface Props { tenantId?: number }

export const GlobalAttributeManager: React.FC<Props> = ({ tenantId = 1 }) => {
  const [formGrupo] = Form.useForm();
  const [formAtributo] = Form.useForm();
  const [unidades, setUnidades] = useState<UnidadeAPIResponse[]>([]);
  const [grupos, setGrupos] = useState<GrupoVisualAPIResponse[]>([]);
  const [atributos, setAtributos] = useState<IAtributoGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [rapido, setRapido] = useState<FiltroRapido>('todos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [modalGrupo, setModalGrupo] = useState<{ aberto: boolean; grupo: GrupoVisualAPIResponse | null }>({ aberto: false, grupo: null });
  const [modalNovo, setModalNovo] = useState(false);
  const [modalIa, setModalIa] = useState(false);
  const tipoNovo = Form.useWatch('tipo', formAtributo);

  const carregar = async () => {
    try {
      const [u, g, a] = await Promise.all([getUnidadesMedida(tenantId), getGruposAtributos(tenantId), getAtributosGlobais(tenantId)]);
      setUnidades(u || []);
      setGrupos((g || []).sort((x: any, y: any) => (x.ordemExibicao || 0) - (y.ordemExibicao || 0)));
      setAtributos(a || []);
    } catch (err: any) {
      message.error(`Falha ao carregar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { carregar(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- alertas
  const gruposValidos = useMemo(() => new Set(grupos.map(g => String(g.id))), [grupos]);
  const semGrupo = (a: IAtributoGlobal) => !a.grupoId || !gruposValidos.has(String(a.grupoId));
  const duplicados = useMemo(() => {
    const porChave = new Map<string, IAtributoGlobal[]>();
    atributos.forEach(a => { const k = chaveNomeAtributo(a.nome); porChave.set(k, [...(porChave.get(k) || []), a]); });
    const mapa = new Map<string, IAtributoGlobal[]>();
    porChave.forEach(g => { if (g.length > 1) g.forEach(a => mapa.set(a.id, g.filter(x => x.id !== a.id))); });
    return mapa;
  }, [atributos]);
  const contagem = {
    sem_grupo: atributos.filter(semGrupo).length,
    sem_uso: atributos.filter(a => !a.emUso).length,
    duplicados: duplicados.size,
  };

  const exibidos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return atributos.filter(a => {
      if (grupoFiltro !== 'todos' && String(a.grupoId) !== grupoFiltro) return false;
      if (rapido === 'sem_grupo' && !semGrupo(a)) return false;
      if (rapido === 'sem_uso' && a.emUso) return false;
      if (rapido === 'duplicados' && !duplicados.has(a.id)) return false;
      return !t || a.nome.toLowerCase().includes(t) || a.codigo.toLowerCase().includes(t)
        || (a.opcoes || []).some(o => o.valor.toLowerCase().includes(t));
    }).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  }, [atributos, grupoFiltro, rapido, busca, duplicados]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- ações
  const salvarGrupo = async (v: any) => {
    setSalvando(true);
    try {
      const dados = { nome: v.nome.trim(), descricao: v.descricao?.trim(), ordemExibicao: v.ordemExibicao || 0 };
      if (modalGrupo.grupo) await updateGrupoAtributo(modalGrupo.grupo.id, dados, tenantId);
      else await createGrupoAtributo(dados, tenantId);
      message.success(modalGrupo.grupo ? 'Grupo atualizado.' : 'Grupo criado.');
      setModalGrupo({ aberto: false, grupo: null });
      formGrupo.resetFields();
      carregar();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGrupo = async (g: GrupoVisualAPIResponse) => {
    if (atributos.some(a => String(a.grupoId) === String(g.id))) {
      message.warning('Há atributos neste grupo: mude o grupo deles antes.');
      return;
    }
    const ok = await Swal.fire({ title: `Remover o grupo "${g.nome}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!ok.isConfirmed) return;
    try {
      await deleteGrupoAtributo(g.id, tenantId);
      if (grupoFiltro === String(g.id)) setGrupoFiltro('todos');
      carregar();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const criarAtributo = async (v: any) => {
    const opcoes: string[] = v.valoresSugeridos || [];
    if (v.tipo === 'lista' && opcoes.length === 0) { message.warning('Lista precisa de ao menos 1 opção.'); return; }
    setSalvando(true);
    try {
      await createAtributoGlobal({
        ...v, nome: v.nome.trim(), codigo: String(v.codigo || '').trim(), descricao: v.descricao?.trim() || undefined,
        valoresSugeridos: v.tipo === 'lista' ? opcoes : undefined,
      }, tenantId);
      message.success('Atributo criado.');
      formAtributo.resetFields();
      setModalNovo(false);
      carregar();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const mesclarAtributo = async (origem: IAtributoGlobal) => {
    const candidatos = atributos.filter(a => a.id !== origem.id && a.tipo === origem.tipo);
    if (!candidatos.length) { message.info(`Não há outro atributo do tipo "${origem.tipo}" para mesclar.`); return; }
    const sugeridos = new Set((duplicados.get(origem.id) || []).map(a => a.id));
    const { value: destinoId } = await Swal.fire({
      title: `Mesclar "${origem.nome}" em...`,
      html: `<p style="text-align:left;font-size:13px">Os valores de <b>${origem.qtdItens || 0}</b> item(ns), os <b>${origem.qtdVinculos || 0}</b> vínculo(s) e os modelos de nome/SKU que citam este atributo passam para o destino. Depois "${origem.nome}" sai do dicionário. Se um item já tiver valor no destino, o do destino fica.</p>`,
      input: 'select',
      inputOptions: Object.fromEntries(candidatos
        .sort((a, b) => Number(sugeridos.has(b.id)) - Number(sugeridos.has(a.id)) || a.nome.localeCompare(b.nome))
        .map(a => [a.id, `${sugeridos.has(a.id) ? '★ ' : ''}${a.nome} (${a.codigo}) · ${a.qtdItens || 0} itens`])),
      inputPlaceholder: 'Atributo que fica',
      showCancelButton: true,
      confirmButtonText: 'Mesclar',
      inputValidator: v => (!v ? 'Escolha o atributo que fica' : undefined),
    });
    if (!destinoId) return;
    try {
      const r = await mesclarAtributoGlobal(origem.id, String(destinoId), tenantId);
      message.success(r.message);
      setEditando(null);
      carregar();
    } catch (err: any) {
      message.error(err?.message || 'Erro ao mesclar.');
    }
  };

  const excluirAtributo = async (id: string) => {
    const a = atributos.find(x => x.id === id);
    if (!a) return;
    const ok = await Swal.fire({ title: `Excluir "${a.nome}"?`, text: 'Sai do dicionário de atributos.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!ok.isConfirmed) return;
    try {
      await deleteAtributoGlobal(id, tenantId);
      message.success('Atributo excluído.');
      setEditando(null);
      carregar();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  // ---------------------------------------------------------------- tabela
  const colunas = [
    {
      title: 'Atributo', key: 'nome',
      render: (_: unknown, a: IAtributoGlobal) => (
        <Space direction="vertical" size={0}>
          <Space size={4} wrap>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => setEditando(a.id)}>{a.nome}</Text>
            {a.ajudaContextual && <Tooltip title={a.ajudaContextual}><InfoCircleOutlined style={{ color: '#1677ff', fontSize: 12 }} /></Tooltip>}
            {duplicados.has(a.id) && (
              <Tooltip title={`Parecido com: ${duplicados.get(a.id)!.map(x => `${x.nome} (${x.tipo}, ${x.qtdItens || 0} itens)`).join('; ')}. Mescle se for o mesmo.`}>
                <Tag color="red" style={{ fontSize: 10, margin: 0 }}>possível duplicado</Tag>
              </Tooltip>
            )}
            {!a.emUso && <Tag style={{ fontSize: 10, margin: 0 }}>sem uso</Tag>}
            {semGrupo(a) && <Tag color="default" style={{ fontSize: 10, margin: 0, borderStyle: 'dashed' }}>sem grupo</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{a.codigo}</Text>
        </Space>
      ),
    },
    {
      title: 'Tipo', key: 'tipo', width: 120,
      render: (_: unknown, a: IAtributoGlobal) => {
        const u = unidades.find(x => String(x.id) === String(a.unidadeId));
        return <Space size={4}><Tag style={{ margin: 0 }}>{a.tipo}</Tag>{u && <Text type="secondary">{u.simbolo}</Text>}</Space>;
      },
    },
    {
      title: 'Papel padrão', key: 'papel', width: 110,
      render: (_: unknown, a: IAtributoGlobal) => { const p = PAPEL[a.escopoPadrao] || PAPEL.ficha; return <Tag color={p.cor}>{p.rotulo}</Tag>; },
    },
    {
      title: 'Opções', key: 'opcoes',
      render: (_: unknown, a: IAtributoGlobal) => {
        const ops = a.opcoes || [];
        if (a.tipo !== 'lista') return <Text type="secondary" style={{ fontSize: 12 }}>valor livre</Text>;
        if (!ops.length) return <Tag color="red">lista sem opções</Tag>;
        return (
          <Flex gap={2} wrap style={{ maxWidth: 320 }}>
            {ops.slice(0, 8).map(o => (
              <Tag key={o.id} color={o.emUso ? 'blue' : 'default'} style={{ fontSize: 10, margin: 0 }}>{o.valor}{codigoProprio(o) && <b> = {o.codigo}</b>}</Tag>
            ))}
            {ops.length > 8 && <Tag style={{ fontSize: 10, margin: 0 }}>+{ops.length - 8}</Tag>}
          </Flex>
        );
      },
    },
    {
      title: 'Uso', key: 'uso', width: 120, align: 'right' as const,
      sorter: (x: IAtributoGlobal, y: IAtributoGlobal) => (x.qtdItens || 0) - (y.qtdItens || 0),
      render: (_: unknown, a: IAtributoGlobal) => (
        <Tooltip title={`${a.qtdItens || 0} item(ns) com valor · ${a.qtdVinculos || 0} vínculo(s) com família/categoria`}>
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
            <Text strong={!!a.qtdItens}>{a.qtdItens || 0} itens</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{a.qtdVinculos || 0} vínculo(s)</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      key: 'acoes', width: 120, align: 'center' as const,
      render: (_: unknown, a: IAtributoGlobal) => (
        <Space size={0}>
          <Tooltip title="Editar (dados, opções, uso)"><Button type="text" icon={<EditOutlined />} onClick={() => setEditando(a.id)} /></Tooltip>
          <Tooltip title="Mesclar em outro atributo (duplicados)"><Button type="text" icon={<MergeCellsOutlined />} onClick={() => mesclarAtributo(a)} /></Tooltip>
          <Tooltip title={a.emUso ? 'Em uso por itens ou famílias: mescle ou remova os vínculos antes' : 'Excluir'}>
            <Button type="text" danger disabled={a.emUso} icon={<DeleteOutlined />} onClick={() => excluirAtributo(a.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
  }

  const itemGrupo = (id: string, nome: React.ReactNode, qtd: number, g?: GrupoVisualAPIResponse) => {
    const ativo = grupoFiltro === id;
    return (
      <div key={id} onClick={() => setGrupoFiltro(id)} style={{
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: ativo ? '#e6f4ff' : undefined, border: `1px solid ${ativo ? '#1677ff' : '#f0f0f0'}`,
      }}>
        <Text strong={ativo}>{nome}</Text>
        <Space size={2}>
          <Tag style={{ margin: 0 }}>{qtd}</Tag>
          {g && <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 11 }} />} onClick={e => {
            e.stopPropagation();
            formGrupo.setFieldsValue({ nome: g.nome, descricao: g.descricao, ordemExibicao: (g as any).ordemExibicao || 0 });
            setModalGrupo({ aberto: true, grupo: g });
          }} />}
          {g && <Button type="text" size="small" danger icon={<CloseOutlined style={{ fontSize: 11 }} />} onClick={e => { e.stopPropagation(); excluirGrupo(g); }} />}
        </Space>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Atributos do PIM</Title>
          <Text type="secondary">Dicionário usado por categorias e famílias: tipo, papel padrão, opções das listas (com código para o SKU) e onde cada um é usado.</Text>
        </div>
        <Space wrap>
          <Button icon={<RobotOutlined />} onClick={() => setModalIa(true)}>Importar por IA</Button>
          <Button icon={<FolderAddOutlined />} onClick={() => { formGrupo.resetFields(); setModalGrupo({ aberto: true, grupo: null }); }}>Novo grupo</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalNovo(true)}>Novo atributo</Button>
        </Space>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card size="small" title="Grupos">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {itemGrupo('todos', 'Todos', atributos.length)}
              {grupos.map(g => itemGrupo(String(g.id), g.nome, atributos.filter(a => String(a.grupoId) === String(g.id)).length, g))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={18}>
          <Card size="small">
            <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
              <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar por nome, código ou opção (ex.: 1/2&quot;)" style={{ maxWidth: 340 }}
                value={busca} onChange={e => setBusca(e.target.value)} />
              <Segmented value={rapido} onChange={v => setRapido(v as FiltroRapido)} options={[
                { value: 'todos', label: 'Todos' },
                { value: 'duplicados', label: `Possíveis duplicados (${contagem.duplicados})` },
                { value: 'sem_uso', label: `Sem uso (${contagem.sem_uso})` },
                { value: 'sem_grupo', label: `Sem grupo (${contagem.sem_grupo})` },
              ]} />
            </Flex>
            <Table<IAtributoGlobal> size="middle" rowKey="id" dataSource={exibidos} columns={colunas}
              pagination={{ pageSize: 20, showSizeChanger: true, hideOnSinglePage: true }}
              onRow={a => ({ onDoubleClick: () => setEditando(a.id) })}
              locale={{ emptyText: <Empty description="Nenhum atributo aqui" /> }} />
          </Card>
        </Col>
      </Row>

      <EditorAtributoDrawer idAtributo={editando} grupos={grupos} unidades={unidades} onFechar={() => setEditando(null)}
        onAlterado={carregar} onExcluir={excluirAtributo} />

      <Modal title={modalGrupo.grupo ? `Editar grupo · ${modalGrupo.grupo.nome}` : 'Novo grupo'} open={modalGrupo.aberto} footer={null} destroyOnHidden
        onCancel={() => setModalGrupo({ aberto: false, grupo: null })}>
        <Form form={formGrupo} layout="vertical" onFinish={salvarGrupo} initialValues={{ ordemExibicao: 0 }}>
          <Flex gap={12}>
            <Form.Item name="nome" label="Nome" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="Ex.: Medidas" /></Form.Item>
            <Form.Item name="ordemExibicao" label="Ordem"><InputNumber min={0} /></Form.Item>
          </Flex>
          <Form.Item name="descricao" label="Descrição"><Input.TextArea rows={2} /></Form.Item>
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setModalGrupo({ aberto: false, grupo: null })}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={salvando}>Salvar</Button>
          </Flex>
        </Form>
      </Modal>

      <Modal title="Novo atributo" open={modalNovo} footer={null} width={640} destroyOnHidden onCancel={() => setModalNovo(false)}>
        <Form form={formAtributo} layout="vertical" onFinish={criarAtributo} initialValues={{ tipo: 'texto', escopoPadrao: 'ficha', pesquisavel: true }}>
          <Flex gap={12} wrap>
            <Form.Item name="nome" label="Nome" rules={[{ required: true }]} style={{ flex: '1 1 240px' }}>
              <Input placeholder="Ex.: Bitola Nominal" onChange={e => formAtributo.setFieldsValue({
                codigo: e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
              })} />
            </Form.Item>
            <Form.Item name="codigo" label="Código técnico" rules={[{ required: true }, { pattern: /^[A-Za-z0-9_]+$/, message: 'Letras, números e _' }]} style={{ flex: '1 1 200px' }}>
              <Input style={{ fontFamily: 'monospace' }} />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item name="tipo" label="Tipo de dado" style={{ flex: '1 1 150px' }}>
              <Select options={[
                { value: 'texto', label: 'Texto' }, { value: 'lista', label: 'Lista de opções' }, { value: 'numero', label: 'Número inteiro' },
                { value: 'decimal', label: 'Decimal' }, { value: 'boolean', label: 'Sim/Não' }, { value: 'data', label: 'Data' },
              ]} />
            </Form.Item>
            <Form.Item name="escopoPadrao" label="Papel padrão" style={{ flex: '1 1 170px' }}>
              <Select options={[{ value: 'ficha', label: 'Ficha técnica' }, { value: 'grade', label: 'Grade (variação)' }, { value: 'dna', label: 'DNA (fixo)' }]} />
            </Form.Item>
            <Form.Item name="grupoId" label="Grupo" style={{ flex: '1 1 160px' }}>
              <Select allowClear options={grupos.map(g => ({ value: g.id, label: g.nome }))} />
            </Form.Item>
            <Form.Item name="unidadeId" label="Unidade" style={{ flex: '1 1 140px' }}>
              <Select allowClear options={unidades.map(u => ({ value: u.id, label: `${u.nome} (${u.simbolo})` }))} />
            </Form.Item>
          </Flex>
          {tipoNovo === 'lista' && (
            <Form.Item name="valoresSugeridos" label="Opções" extra='Enter para cada uma. Com código para o SKU: 1/2" = 08'>
              <Select mode="tags" tokenSeparators={[',']} placeholder='Ex.: 1/4" = 04, 3/8" = 06, 1/2" = 08' open={false} />
            </Form.Item>
          )}
          <Form.Item name="descricao" label="Ajuda para o operador"><Input.TextArea rows={2} /></Form.Item>
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setModalNovo(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={salvando}>Criar</Button>
          </Flex>
        </Form>
      </Modal>

      <ImportarAtributosModal visible={modalIa} onClose={() => setModalIa(false)} gruposDisponiveis={grupos}
        onImportarSucesso={async (dados: any) => {
          try {
            await createAtributoGlobal({ ...dados, grupoId: dados.grupoId || grupos[0]?.id }, tenantId);
            message.success('Atributo importado.');
            carregar();
          } catch (err: any) {
            message.error(err.message || 'Erro ao importar.');
          }
        }} />
    </div>
  );
};

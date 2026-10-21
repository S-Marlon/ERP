// Catálogo › Tags: rótulos de uso/aplicação que atravessam categorias ("bicicleta", "rolamentos", "moto"). À esquerda o
// cadastro (criar, editar, juntar, excluir); à direita as famílias com as tags, para aplicar ou tirar a tag escolhida em
// lote. A tag da família vale para todos os itens dela; abrindo a família dá para pôr a tag só num item (a exceção).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, AutoComplete, Button, Card, Col, Empty, Flex, Input, List, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, TreeSelect, Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, MergeCellsOutlined, MinusOutlined, PlusOutlined, ReloadOutlined, TagsOutlined } from '@ant-design/icons';
import { CORES_TAG, CorTag, FamiliaComTags, ItemComTags, TagCatalogo, tagsApi } from './tagsApi';
import { politicaPrecoApi } from '../precos/politicaPrecoApi';
import { arvoreCategorias, NoArvore } from '../precos/politicaPrecoTela';

const { Text, Title } = Typography;
type Mostrar = 'TODAS' | 'COM' | 'SEM';

const TagCor: React.FC<{ nome: string; cor: string; herdada?: boolean }> = ({ nome, cor, herdada }) => (
  <Tooltip title={herdada === undefined ? undefined : herdada ? 'Herdada da família' : 'Só deste item'}>
    <Tag color={cor === 'default' ? undefined : cor} style={{ marginBottom: 2, ...(herdada === false ? { borderStyle: 'dashed' } : {}) }}>{nome}</Tag>
  </Tooltip>
);

const SeletorCor: React.FC<{ value: CorTag; onChange: (c: CorTag) => void }> = ({ value, onChange }) => (
  <Select size="small" style={{ width: 120 }} value={value} onChange={onChange}
    options={CORES_TAG.map(c => ({ value: c, label: <Tag color={c === 'default' ? undefined : c} style={{ margin: 0 }}>{c === 'default' ? 'cinza' : c}</Tag> }))} />
);

/** Itens de uma família: as tags herdadas e as próprias; põe ou tira a tag escolhida só no item. */
const ItensDaFamilia: React.FC<{ idFamilia: number; tag: TagCatalogo | null; versao: number; onMudou: () => void }> = ({ idFamilia, tag, versao, onMudou }) => {
  const [itens, setItens] = useState<ItemComTags[] | null>(null);
  const carregar = useCallback(() => { tagsApi.itensDaFamilia(idFamilia).then(setItens).catch(e => message.error(e.message)); }, [idFamilia]);
  useEffect(() => { carregar(); }, [carregar, versao]);
  const aplicar = async (i: ItemComTags, acao: 'ADICIONAR' | 'REMOVER') => {
    if (!tag) return;
    try { await tagsApi.aplicar(tag.idTag, acao, { idsItens: [i.idItem] }); carregar(); onMudou(); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  if (!itens) return <Text type="secondary">carregando…</Text>;
  return (
    <List size="small" dataSource={itens} locale={{ emptyText: 'Família sem itens' }}
      renderItem={i => {
        const atual = tag ? i.tags.find(t => t.idTag === tag.idTag) : undefined;
        return (
          <List.Item actions={tag ? [
            atual?.herdada ? <Text type="secondary" style={{ fontSize: 12 }}>tem pela família</Text>
              : atual ? <Button size="small" type="link" icon={<MinusOutlined />} onClick={() => aplicar(i, 'REMOVER')}>tirar só deste</Button>
                : <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => aplicar(i, 'ADICIONAR')}>pôr só neste</Button>,
          ] : undefined}>
            <div><Text strong>{i.sku}</Text> <Text>{i.nome}</Text> <span style={{ marginLeft: 6 }}>{i.tags.map(t => <TagCor key={t.idTag} {...t} />)}</span></div>
          </List.Item>
        );
      }} />
  );
};

const TagsCatalogo: React.FC = () => {
  const [tags, setTags] = useState<TagCatalogo[]>([]);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [nova, setNova] = useState<{ nome: string; grupo: string; cor: CorTag }>({ nome: '', grupo: '', cor: 'blue' });
  const [editando, setEditando] = useState<TagCatalogo | null>(null);
  const [juntando, setJuntando] = useState<{ origem: TagCatalogo; destino: number | null } | null>(null);
  // famílias
  const [arvore, setArvore] = useState<NoArvore[]>([]);
  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrar, setMostrar] = useState<Mostrar>('TODAS');
  const [familias, setFamilias] = useState<FamiliaComTags[]>([]);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [versaoItens, setVersaoItens] = useState(0);

  const tag = tags.find(t => t.idTag === escolhida) || null;
  const grupos = [...new Set(tags.map(t => t.grupo).filter((g): g is string => !!g))];

  const carregarTags = useCallback(() => tagsApi.listar().then(setTags).catch(e => message.error(e.message)), []);
  const carregarFamilias = useCallback(async () => {
    setCarregando(true);
    try {
      setFamilias(await tagsApi.familias({ idCategoria, busca, idTag: mostrar === 'COM' ? escolhida : null, semTag: mostrar === 'SEM' }));
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [idCategoria, busca, mostrar, escolhida]);
  useEffect(() => { carregarTags(); politicaPrecoApi.opcoes().then(o => setArvore(arvoreCategorias(o.categorias))).catch(() => setArvore([])); }, [carregarTags]);
  useEffect(() => { const t = setTimeout(carregarFamilias, 250); return () => clearTimeout(t); }, [carregarFamilias]);
  useEffect(() => { setMarcadas([]); }, [idCategoria, busca, mostrar]);

  const executar = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); message.success(ok); carregarTags(); carregarFamilias(); setVersaoItens(v => v + 1); return true; }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); return false; }
  };
  const criar = async () => {
    try {
      const r = await tagsApi.criar({ nome: nova.nome, grupo: nova.grupo.trim() || null, cor: nova.cor });
      message.success('Tag criada.');
      setNova(n => ({ ...n, nome: '' }));
      await carregarTags();
      setEscolhida(r.idTag);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  const emLote = (acao: 'ADICIONAR' | 'REMOVER') => tag && executar(
    () => tagsApi.aplicar(tag.idTag, acao, { idsFamilias: marcadas }),
    acao === 'ADICIONAR' ? `"${tag.nome}" posta em ${marcadas.length} família(s).` : `"${tag.nome}" tirada de ${marcadas.length} família(s).`,
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}><TagsOutlined /> Tags do catálogo</Title>
        <Text type="secondary">Rótulos de uso e aplicação que atravessam categorias (ex.: "bicicleta", "rolamentos"). A tag na família vale para todos os itens dela, inclusive os que entrarem depois. A busca do PDV acha pela tag.</Text>
      </div>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card size="small" title="Tags" extra={<Button size="small" icon={<ReloadOutlined />} onClick={carregarTags} />}>
            <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 10 }}>
              <Input placeholder="Nova tag (ex.: bicicleta)" maxLength={60} value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} onPressEnter={criar} />
              <Flex gap={6}>
                <AutoComplete size="small" style={{ flex: 1 }} placeholder="Grupo (opcional, ex.: Aplicação)" value={nova.grupo} options={grupos.map(g => ({ value: g }))}
                  onChange={grupo => setNova(n => ({ ...n, grupo }))} />
                <SeletorCor value={nova.cor} onChange={cor => setNova(n => ({ ...n, cor }))} />
                <Button size="small" type="primary" icon={<PlusOutlined />} disabled={nova.nome.trim().length < 2} onClick={criar}>Criar</Button>
              </Flex>
            </Space>
            {tags.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma tag ainda" /> : (
              <List size="small" dataSource={tags} style={{ maxHeight: 520, overflowY: 'auto' }}
                renderItem={t => (
                  <List.Item
                    onClick={() => setEscolhida(t.idTag === escolhida ? null : t.idTag)}
                    style={{ cursor: 'pointer', background: t.idTag === escolhida ? '#e6f4ff' : undefined, borderRadius: 6, padding: '4px 8px', opacity: t.ativo ? 1 : 0.5 }}
                    actions={[
                      <Tooltip key="e" title="Editar"><Button size="small" type="text" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); setEditando(t); }} /></Tooltip>,
                      <Tooltip key="j" title="Juntar com outra"><Button size="small" type="text" icon={<MergeCellsOutlined />} onClick={e => { e.stopPropagation(); setJuntando({ origem: t, destino: null }); }} /></Tooltip>,
                      <Popconfirm key="x" title={`Excluir "${t.nome}"?`} description={`Sai de ${t.familias} família(s) e dos itens.`} okText="Excluir" okButtonProps={{ danger: true }} cancelText="Voltar"
                        onConfirm={() => executar(() => tagsApi.excluir(t.idTag), 'Tag excluída.').then(ok => ok && t.idTag === escolhida && setEscolhida(null))}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                      </Popconfirm>,
                    ]}>
                    <div>
                      <TagCor nome={t.nome} cor={t.cor} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{t.grupo ? `${t.grupo} · ` : ''}{t.familias} família(s) · {t.itens} item(ns){t.ativo ? '' : ' · desativada'}</Text>
                    </div>
                  </List.Item>
                )} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card size="small" title="Famílias"
            extra={tag
              ? <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{marcadas.length} marcada(s)</Text>
                  <Button size="small" type="primary" icon={<PlusOutlined />} disabled={!marcadas.length} onClick={() => emLote('ADICIONAR')}>Pôr "{tag.nome}"</Button>
                  <Button size="small" icon={<MinusOutlined />} disabled={!marcadas.length} onClick={() => emLote('REMOVER')}>Tirar "{tag.nome}"</Button>
                </Space>
              : <Text type="secondary" style={{ fontSize: 12 }}>Escolha uma tag à esquerda para pôr ou tirar</Text>}>
            <Flex gap={8} wrap style={{ marginBottom: 8 }}>
              <TreeSelect allowClear showSearch treeNodeFilterProp="title" style={{ width: 240 }} placeholder="Categoria (com as subcategorias)"
                treeData={arvore} value={idCategoria ?? undefined} onChange={v => setIdCategoria((v as number) ?? null)} />
              <Input allowClear placeholder="Nome da família" style={{ width: 200 }} value={busca} onChange={e => setBusca(e.target.value)} />
              <Segmented value={mostrar} onChange={v => setMostrar(v as Mostrar)} options={[
                { value: 'TODAS', label: 'Todas' },
                { value: 'COM', label: tag ? `Com "${tag.nome}"` : 'Com a tag', disabled: !tag },
                { value: 'SEM', label: 'Sem nenhuma tag' },
              ]} />
            </Flex>
            <Table<FamiliaComTags>
              size="small" rowKey="idFamilia" loading={carregando} dataSource={familias} pagination={{ pageSize: 50, hideOnSinglePage: true, showTotal: n => `${n} família(s)` }}
              rowSelection={tag ? { selectedRowKeys: marcadas, onChange: k => setMarcadas(k as number[]) } : undefined}
              expandable={{ expandedRowRender: f => <ItensDaFamilia idFamilia={f.idFamilia} tag={tag} versao={versaoItens} onMudou={carregarTags} /> }}
              columns={[
                { title: 'Família', render: (_, f) => <div><Text strong>{f.nome}</Text> <Text type="secondary" style={{ fontSize: 12 }}>· {f.itens} item(ns){f.categoria ? ` · ${f.categoria}` : ''}</Text></div> },
                { title: 'Tags', width: '45%', render: (_, f) => f.tags.length ? f.tags.map(t => <TagCor key={t.idTag} {...t} />) : <Text type="secondary" style={{ fontSize: 12 }}>sem tag</Text> },
              ]}
            />
            {!tag && familias.length > 0 && <Alert type="info" showIcon style={{ marginTop: 8 }} message="Escolha (ou crie) uma tag à esquerda: aí dá para marcar várias famílias e pôr a tag de uma vez. Abra a família (+) para pôr a tag só num item." />}
          </Card>
        </Col>
      </Row>

      <Modal open={!!editando} title="Editar tag" okText="Salvar" cancelText="Voltar" onCancel={() => setEditando(null)} destroyOnHidden
        onOk={() => editando && executar(() => tagsApi.salvar(editando.idTag, { nome: editando.nome, grupo: editando.grupo, cor: editando.cor, ativo: editando.ativo }), 'Tag salva.').then(ok => ok && setEditando(null))}>
        {editando && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Nome</Text>
            <Input maxLength={60} value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} />
            <Text>Grupo</Text>
            <AutoComplete style={{ width: '100%' }} value={editando.grupo || ''} options={grupos.map(g => ({ value: g }))} onChange={g => setEditando({ ...editando, grupo: g || null })} />
            <Flex gap={16} align="center">
              <span>Cor <SeletorCor value={editando.cor} onChange={cor => setEditando({ ...editando, cor })} /></span>
              <span>Ativa <Switch size="small" checked={editando.ativo} onChange={ativo => setEditando({ ...editando, ativo })} /></span>
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>Desativada: some da busca do PDV e dos filtros, mas continua nas famílias (dá para reativar).</Text>
          </Space>
        )}
      </Modal>

      <Modal open={!!juntando} title={`Juntar "${juntando?.origem.nome}" com outra tag`} okText="Juntar" cancelText="Voltar" onCancel={() => setJuntando(null)} destroyOnHidden
        okButtonProps={{ disabled: !juntando?.destino }}
        onOk={() => juntando?.destino && executar(() => tagsApi.juntar(juntando.origem.idTag, juntando.destino!), 'Tags juntadas.').then(ok => {
          if (!ok) return;
          if (escolhida === juntando.origem.idTag) setEscolhida(juntando.destino);
          setJuntando(null);
        })}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">As famílias e os itens de "{juntando?.origem.nome}" passam para a tag escolhida e "{juntando?.origem.nome}" é apagada. Use para "bike" e "bicicleta", por exemplo.</Text>
          <Select style={{ width: '100%' }} placeholder="Juntar em..." showSearch optionFilterProp="label" value={juntando?.destino ?? undefined}
            options={tags.filter(t => t.idTag !== juntando?.origem.idTag).map(t => ({ value: t.idTag, label: t.nome }))}
            onChange={destino => setJuntando(j => j && { ...j, destino })} />
        </Space>
      </Modal>
    </div>
  );
};

export default TagsCatalogo;

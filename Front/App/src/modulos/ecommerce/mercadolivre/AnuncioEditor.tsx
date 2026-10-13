// Editor do anúncio do ML: dados, itens/variações (foto e preço), atributos da categoria e o que falta para publicar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AutoComplete, Avatar, Button, Card, Col, Drawer, Empty, Flex, Form, Input, InputNumber, List, Popconfirm, Row, Segmented,
  Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, Upload, message,
} from 'antd';
import {
  BarcodeOutlined, CheckCircleFilled, CloseCircleFilled, DeleteOutlined, ExclamationCircleFilled, InboxOutlined,
  PictureOutlined, PlusOutlined, SendOutlined, UploadOutlined, WarningFilled,
} from '@ant-design/icons';
import { enviarArquivoAnexo } from '../../../areas/catalogo/skus/CatalogSku.service';
import { AnuncioDetalhe, anunciosApi, AtributoML, formatarMoeda, ItemDoAnuncio, ValorAtributo } from './mercadoLivreApi';
import { agruparPendencias, textoComPrimeiraMaiuscula } from './pendencias';
import CategoriaMlModal from './CategoriaMlModal';
import AdicionarAnuncioModal from './AdicionarAnuncioModal';
import SituacaoTag from './SituacaoTag';

const { Text } = Typography;

interface Props {
  id: number | null;
  onFechar: () => void;
  onAlterado: () => void;
}

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro.');

// ---------------------------------------------------------------------------
// Valor fixo de um atributo, conforme o tipo do ML
// ---------------------------------------------------------------------------

const ValorFixo: React.FC<{ atributo: AtributoML; valor: Extract<ValorAtributo, { origem: 'fixo' }> | null; onSalvar: (v: ValorAtributo | null) => void }> = ({ atributo, valor, onSalvar }) => {
  const [texto, setTexto] = useState(valor?.valor || '');
  const [unidade, setUnidade] = useState(valor?.unidade || atributo.unidadePadrao || atributo.unidades[0] || null);
  useEffect(() => { setTexto(valor?.valor || ''); setUnidade(valor?.unidade || atributo.unidadePadrao || atributo.unidades[0] || null); }, [valor, atributo]);

  const salvar = (t = texto, u = unidade) => {
    const limpo = String(t ?? '').trim();
    if (!limpo) { if (valor) onSalvar(null); return; }
    const opcao = atributo.valores.find(v => v.nome.toLowerCase() === limpo.toLowerCase());
    if (limpo === valor?.valor && (u || null) === (valor?.unidade || null)) return;
    onSalvar({ origem: 'fixo', valor: opcao?.nome || limpo, valorId: opcao?.id || null, unidade: atributo.tipo === 'number_unit' ? u : null });
  };

  if (atributo.tipo === 'number_unit') {
    return (
      <Space.Compact style={{ width: '100%' }}>
        <InputNumber style={{ width: '100%' }} value={texto === '' ? null : Number(texto)} onChange={v => setTexto(v === null ? '' : String(v))} onBlur={() => salvar()} decimalSeparator="," />
        <Select style={{ width: 90 }} value={unidade} options={atributo.unidades.map(u => ({ value: u, label: u }))} onChange={u => { setUnidade(u); salvar(texto, u); }} />
      </Space.Compact>
    );
  }
  if (atributo.tipo === 'number') {
    return <InputNumber style={{ width: '100%' }} value={texto === '' ? null : Number(texto)} onChange={v => setTexto(v === null ? '' : String(v))} onBlur={() => salvar()} decimalSeparator="," />;
  }
  if (atributo.tipo === 'boolean') {
    const opcoes = atributo.valores.length ? atributo.valores : [{ id: '', nome: 'Sim' }, { id: '', nome: 'Não' }];
    return <Select style={{ width: '100%' }} value={texto || undefined} placeholder="Escolha" options={opcoes.map(o => ({ value: o.nome, label: o.nome }))} onChange={v => { setTexto(v); salvar(v); }} />;
  }
  return (
    <AutoComplete
      style={{ width: '100%' }} value={texto} onChange={setTexto} onBlur={() => salvar()} onSelect={(v: string) => { setTexto(v); salvar(v); }}
      placeholder={atributo.valores.length ? 'Escolha ou digite' : 'Digite o valor'}
      options={atributo.valores.filter(v => !texto || v.nome.toLowerCase().includes(texto.toLowerCase())).slice(0, 50).map(v => ({ value: v.nome }))}
    />
  );
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const AnuncioEditor: React.FC<Props> = ({ id, onFechar, onAlterado }) => {
  const [det, setDet] = useState<AnuncioDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fixoEmEdicao, setFixoEmEdicao] = useState<Set<string>>(new Set());
  const [todosAtributos, setTodosAtributos] = useState(false);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [adicionarItens, setAdicionarItens] = useState(false);
  const [filtroItens, setFiltroItens] = useState<{ texto: string; ids: number[] } | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState<number | 'todos' | null>(null);

  const aplicar = useCallback((d: AnuncioDetalhe) => {
    setDet(d);
    setTitulo(d.titulo || '');
    setDescricao(d.descricao || '');
  }, []);

  const recarregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    try { aplicar(await anunciosApi.detalhe(id)); }
    catch (e) { message.error(erroMsg(e)); }
    finally { setCarregando(false); }
  }, [id, aplicar]);

  useEffect(() => {
    setDet(null);
    setFixoEmEdicao(new Set());
    setFiltroItens(null);
    setTodosAtributos(false);
    if (id) recarregar();
  }, [id, recarregar]);

  const executar = async (acao: () => Promise<AnuncioDetalhe>, ok?: string) => {
    setSalvando(true);
    try {
      aplicar(await acao());
      if (ok) message.success(ok);
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setSalvando(false);
    }
  };

  const salvar = (corpo: Parameters<typeof anunciosApi.salvar>[1], ok?: string) => id && executar(() => anunciosApi.salvar(id, corpo), ok);

  const salvarAtributo = (idAtributo: string, valor: ValorAtributo | null) => {
    if (!det) return;
    const novo = { ...det.atributos };
    if (valor) novo[idAtributo] = valor; else delete novo[idAtributo];
    setFixoEmEdicao(s => { const n = new Set(s); n.delete(idAtributo); return n; });
    salvar({ atributos: novo });
  };

  const enviarFoto = async (item: ItemDoAnuncio, arquivo: File) => {
    setEnviandoFoto(item.idItem);
    try {
      await enviarArquivoAnexo(item.idItem, arquivo, item.fotos === 0 ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA');
      message.success(`Foto enviada para ${item.sku}.`);
      await recarregar();
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setEnviandoFoto(null);
    }
  };

  const fotoParaTodosSemFoto = async (arquivo: File) => {
    if (!det) return;
    const alvo = det.itens.filter(i => i.fotos === 0);
    setEnviandoFoto('todos');
    try {
      for (const i of alvo) await enviarArquivoAnexo(i.idItem, arquivo, 'IMAGEM_PRINCIPAL');
      message.success(`Foto colocada em ${alvo.length} item(ns).`);
      await recarregar();
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setEnviandoFoto(null);
    }
  };

  const skuDoItem = useMemo(() => new Map((det?.itens || []).map(i => [i.idItem, i.sku])), [det]);
  const pendencias = useMemo(() => agruparPendencias(det?.pendencias || [], skuDoItem), [det, skuDoItem]);
  const erros = (det?.pendencias || []).filter(p => p.nivel === 'erro').length;
  const editavel = det?.situacao === 'RASCUNHO';
  const atributoComErro = useMemo(() => new Set((det?.pendencias || []).filter(p => p.nivel === 'erro' && p.atributo).map(p => p.atributo!)), [det]);
  const itemComErro = useMemo(() => new Set((det?.pendencias || []).filter(p => p.nivel === 'erro' && p.idItem).map(p => p.idItem!)), [det]);

  const atributosVisiveis = useMemo(() => {
    if (!det) return [];
    return det.atributosCategoria.filter(a => todosAtributos || a.obrigatorio || a.permiteVariar || det.atributos[a.id] || fixoEmEdicao.has(a.id));
  }, [det, todosAtributos, fixoEmEdicao]);

  const itensVisiveis = useMemo(() => (det?.itens || []).filter(i => !filtroItens || filtroItens.ids.includes(i.idItem)), [det, filtroItens]);

  // -------------------------------------------------------------------------
  // Blocos
  // -------------------------------------------------------------------------

  const blocoDados = det && (
    <Card size="small" title="Anúncio" style={{ marginBottom: 16 }}>
      <Form layout="vertical" size="middle" disabled={!editavel}>
        <Form.Item label="Título" style={{ marginBottom: 12 }} help={<Text type="secondary" style={{ fontSize: 12 }}>Produto + o que o comprador busca (tipo, medida, material). Sem caixa alta, sem "promoção" ou "frete grátis".</Text>}>
          <Input
            value={titulo} maxLength={det.categoria?.maxTitulo || 60} showCount
            onChange={e => setTitulo(e.target.value)}
            onBlur={() => titulo.trim() !== (det.titulo || '') && salvar({ titulo })}
          />
        </Form.Item>
        <Form.Item label="Categoria do Mercado Livre" style={{ marginBottom: 12 }}>
          <Flex gap={8} align="center" wrap>
            {det.categoria
              ? <Text>{det.categoria.caminho} <Tag>{det.categoria.id}</Tag>{!det.categoria.final && <Tag color="red">tem subcategorias</Tag>}</Text>
              : <Text type="danger">Nenhuma categoria escolhida</Text>}
            <Button size="small" onClick={() => setCategoriaAberta(true)}>{det.categoria ? 'Trocar' : 'Escolher categoria'}</Button>
          </Flex>
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={9}>
            <Form.Item label="Tipo de anúncio" style={{ marginBottom: 12 }}>
              <Segmented value={det.tipoAnuncio} onChange={v => salvar({ tipoAnuncio: String(v) })} options={[
                { value: 'gold_special', label: 'Clássico' },
                { value: 'gold_pro', label: <Tooltip title="Comissão maior, parcelamento sem juros para o comprador">Premium</Tooltip> },
              ]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={7}>
            <Form.Item label="Condição" style={{ marginBottom: 12 }}>
              <Segmented value={det.condicao} onChange={v => salvar({ condicao: String(v) })} options={[{ value: 'new', label: 'Novo' }, { value: 'used', label: 'Usado' }]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Ajuste sobre o preço do ERP" style={{ marginBottom: 12 }} tooltip="Ex.: 15% cobre a comissão. Item com preço próprio (na tabela) ignora o ajuste.">
              <InputNumber
                key={`aj${det.ajustePreco}`} defaultValue={det.ajustePreco} suffix="%" min={-50} max={300} step={1} style={{ width: '100%' }} decimalSeparator=","
                onBlur={e => { const v = Number(String(e.target.value).replace(',', '.').replace('%', '')) || 0; if (v !== det.ajustePreco) salvar({ ajustePreco: v }); }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Descrição" style={{ marginBottom: 0 }}>
          <Input.TextArea
            value={descricao} autoSize={{ minRows: 3, maxRows: 10 }} onChange={e => setDescricao(e.target.value)}
            onBlur={() => descricao.trim() !== (det.descricao || '').trim() && salvar({ descricao })}
            placeholder="Medidas, aplicação, material, o que vem na embalagem. Texto simples (o ML não aceita HTML nem links)."
          />
        </Form.Item>
      </Form>
    </Card>
  );

  const blocoItens = det && (
    <Card
      size="small" style={{ marginBottom: 16 }}
      title={<Space>{det.itens.length > 1 ? `Variações (${det.itens.length})` : 'Item'}{det.eixos.length > 0 && <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>variando por {det.eixos.map(e => det.atributosCategoria.find(a => a.id === e)?.nome || e).join(', ')}</Text>}</Space>}
      extra={editavel && (
        <Space>
          {det.itens.some(i => i.fotos === 0) && (
            <Upload accept="image/*" showUploadList={false} beforeUpload={f => { fotoParaTodosSemFoto(f); return false; }}>
              <Tooltip title="Coloca a mesma foto como principal em todos os itens que ainda não têm foto">
                <Button size="small" icon={<UploadOutlined />} loading={enviandoFoto === 'todos'}>Foto para os sem foto ({det.itens.filter(i => i.fotos === 0).length})</Button>
              </Tooltip>
            </Upload>
          )}
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAdicionarItens(true)}>Adicionar itens</Button>
        </Space>
      )}
    >
      {filtroItens && (
        <Alert type="info" showIcon style={{ marginBottom: 8 }} message={<>Mostrando {filtroItens.ids.length} item(ns) com: <b>{filtroItens.texto}</b></>}
          action={<Button size="small" onClick={() => setFiltroItens(null)}>Mostrar todos</Button>} />
      )}
      <Table<ItemDoAnuncio>
        size="small" rowKey="idItem" dataSource={itensVisiveis} pagination={itensVisiveis.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
        scroll={{ x: 900 }}
        rowClassName={i => (itemComErro.has(i.idItem) ? 'ml-linha-erro' : '')}
        columns={[
          {
            title: 'Foto', width: 64,
            render: (_, i) => (
              <Upload accept="image/*" showUploadList={false} disabled={!editavel} beforeUpload={f => { enviarFoto(i, f); return false; }}>
                <Tooltip title={i.fotos ? `${i.fotos} foto(s): clique para enviar mais` : 'Sem foto: clique para enviar'}>
                  <Spin spinning={enviandoFoto === i.idItem} size="small">
                    {i.fotoUrl
                      ? <Avatar shape="square" size={44} src={i.fotoUrl} style={{ cursor: 'pointer' }} />
                      : <Avatar shape="square" size={44} icon={<UploadOutlined />} style={{ cursor: 'pointer', background: '#fff1f0', color: '#cf1322', border: '1px dashed #ffa39e' }} />}
                  </Spin>
                </Tooltip>
              </Upload>
            ),
          },
          {
            title: 'Item',
            render: (_, i) => (
              <div>
                <Text strong>{i.sku}</Text>{!i.ativo && <Tag color="red" style={{ marginLeft: 6 }}>inativo</Tag>}
                <div><Text type="secondary" style={{ fontSize: 12 }}>{i.nome}</Text></div>
                {det.eixos.length > 0 && (
                  <Space size={2} wrap>
                    {det.eixos.map(e => <Tag key={e} color="blue" style={{ fontSize: 11 }}>{i.valores[e]?.valor || '—'}{i.valores[e]?.unidade ? ` ${i.valores[e]?.unidade}` : ''}</Tag>)}
                  </Space>
                )}
              </div>
            ),
          },
          { title: 'Estoque', dataIndex: 'estoque', width: 74, align: 'right', render: v => <Text type={v > 0 ? undefined : 'warning'}>{v}</Text> },
          { title: 'Preço ERP', dataIndex: 'preco', width: 96, align: 'right', render: formatarMoeda },
          {
            title: <Tooltip title="Vazio = preço do ERP com o ajuste do anúncio">Preço no ML</Tooltip>, width: 130,
            render: (_, i) => (
              <InputNumber
                key={`${i.idItem}-${i.precoMl}-${i.precoAnuncio}`} size="small" style={{ width: '100%' }} min={0} step={0.1} precision={2} decimalSeparator="," disabled={!editavel}
                defaultValue={i.precoMl ?? undefined} placeholder={i.precoAnuncio.toFixed(2).replace('.', ',')}
                onBlur={e => {
                  const t = String(e.target.value).trim();
                  const v = t === '' ? null : Number(t.replace(/\./g, '').replace(',', '.'));
                  if (v === i.precoMl || (v !== null && !(v > 0))) return;
                  executar(() => anunciosApi.precoItem(det.id, i.idItem, v));
                }}
              />
            ),
          },
          {
            title: 'Comissão / recebe', width: 130, align: 'right',
            render: (_, i) => i.comissao === null ? <Text type="secondary">—</Text> : (
              <Tooltip title={`Comissão do ML ${i.percentualComissao}% (${formatarMoeda(i.comissao)}). O frete, quando houver, sai à parte.`}>
                <div style={{ lineHeight: 1.2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>-{formatarMoeda(i.comissao)}</Text>
                  <div><Text strong>{formatarMoeda(i.precoAnuncio - i.comissao)}</Text></div>
                </div>
              </Tooltip>
            ),
          },
          {
            title: '', width: 62,
            render: (_, i) => (
              <Space size={4}>
                <Tooltip title={i.gtin ? `GTIN ${i.gtin}` : 'Sem código de barras'}><BarcodeOutlined style={{ color: i.gtin ? '#52c41a' : '#d9d9d9' }} /></Tooltip>
                <Tooltip title={i.pesoKg && i.medidasCm ? `${i.pesoKg} kg · ${i.medidasCm.altura}×${i.medidasCm.largura}×${i.medidasCm.comprimento} cm` : 'Sem peso ou medidas'}>
                  <InboxOutlined style={{ color: i.pesoKg && i.medidasCm ? '#52c41a' : '#d9d9d9' }} />
                </Tooltip>
              </Space>
            ),
          },
          {
            title: '', width: 40,
            render: (_, i) => editavel && det.itens.length > 1 && (
              <Popconfirm title={`Tirar ${i.sku} deste anúncio?`} okText="Tirar" onConfirm={() => executar(() => anunciosApi.removerItem(det.id, i.idItem))}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  );

  const resumoValores = (a: AtributoML) => {
    if (!det) return null;
    const valores = det.itens.map(i => i.valores[a.id]);
    const preenchidos = valores.filter(Boolean) as NonNullable<ItemDoAnuncio['valores'][string]>[];
    const faltam = valores.length - preenchidos.length;
    const distintos = [...new Set(preenchidos.map(v => `${v.valor}${v.unidade ? ` ${v.unidade}` : ''}`))];
    const foraDaLista = a.tipo === 'list' && a.valores.length > 0 && preenchidos.some(v => !v.valorId);
    return (
      <Space size={4} wrap>
        {distintos.length === 0 && <Text type={a.obrigatorio ? 'danger' : 'secondary'}>sem valor</Text>}
        {distintos.length === 1 && <Text>{distintos[0]}</Text>}
        {distintos.length > 1 && (
          <Tooltip title={distintos.slice(0, 30).join(' · ')}>
            <Text>{distintos.length} valores: {distintos.slice(0, 3).join(', ')}{distintos.length > 3 ? '…' : ''}</Text>
          </Tooltip>
        )}
        {det.eixos.includes(a.id) && <Tag color="blue">variação</Tag>}
        {faltam > 0 && distintos.length > 0 && <Tag color={a.obrigatorio ? 'red' : 'default'}>falta em {faltam}</Tag>}
        {foraDaLista && <Tooltip title="Algum valor não bate com a lista do ML: ele pode recusar ou trocar"><Tag color="orange">fora da lista</Tag></Tooltip>}
      </Space>
    );
  };

  const blocoAtributos = det && (
    <Card
      size="small" style={{ marginBottom: 16 }}
      title="Atributos do Mercado Livre"
      extra={det.categoria && (
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>Todos ({det.atributosCategoria.length})</Text>
          <Switch size="small" checked={todosAtributos} onChange={setTodosAtributos} />
        </Space>
      )}
    >
      {!det.categoria ? <Empty description="Escolha a categoria para ver o que o ML pede." image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Ligue cada atributo a um dado do cadastro (muda por item, ex.: Bitola) ou a um valor fixo para o anúncio todo. Mais atributos preenchidos = mais exposição na busca.
          </Text>
          <Table<AtributoML>
            size="small" rowKey="id" dataSource={atributosVisiveis} pagination={false}
            rowClassName={a => (atributoComErro.has(a.id) ? 'ml-linha-erro' : '')}
            columns={[
              {
                title: 'Atributo', width: 210,
                render: (_, a) => (
                  <div>
                    <Text strong={a.obrigatorio}>{a.nome}</Text>
                    <div>
                      <Space size={2}>
                        {a.obrigatorio && <Tag color="red" style={{ fontSize: 11 }}>obrigatório</Tag>}
                        {a.permiteVariar && <Tooltip title="Pode ser o que diferencia as variações"><Tag color="blue" style={{ fontSize: 11 }}>pode variar</Tag></Tooltip>}
                      </Space>
                    </div>
                  </div>
                ),
              },
              {
                title: 'De onde vem', width: 300,
                render: (_, a) => {
                  const v = det.atributos[a.id];
                  const atual = v ? (v.origem === 'erp' ? `erp:${v.atributoId}` : v.origem) : fixoEmEdicao.has(a.id) ? 'fixo' : '';
                  return (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Select
                        style={{ width: '100%' }} value={atual} disabled={!editavel} showSearch optionFilterProp="label" popupMatchSelectWidth={false}
                        onChange={(x: string) => {
                          if (x === '') salvarAtributo(a.id, null);
                          else if (x === 'marca') salvarAtributo(a.id, { origem: 'marca' });
                          else if (x === 'fixo') { if (v) salvarAtributo(a.id, null); setFixoEmEdicao(s => new Set(s).add(a.id)); }
                          else salvarAtributo(a.id, { origem: 'erp', atributoId: Number(x.slice(4)) });
                        }}
                        options={[
                          { value: '', label: '— sem valor —' },
                          { value: 'fixo', label: 'Valor fixo (o mesmo em todos)' },
                          { value: 'marca', label: 'Marca do item' },
                          ...(det.atributosErp.length ? [{ label: 'Do cadastro (por item)', options: det.atributosErp.map(e => ({ value: `erp:${e.id}`, label: e.nome })) }] : []),
                        ]}
                      />
                      {(v?.origem === 'fixo' || (!v && fixoEmEdicao.has(a.id))) && (
                        <ValorFixo atributo={a} valor={v?.origem === 'fixo' ? v : null} onSalvar={x => salvarAtributo(a.id, x)} />
                      )}
                    </Space>
                  );
                },
              },
              { title: 'Valor no anúncio', render: (_, a) => resumoValores(a) },
            ]}
          />
          {!todosAtributos && det.atributosCategoria.length > atributosVisiveis.length && (
            <Button type="link" size="small" onClick={() => setTodosAtributos(true)}>
              + {det.atributosCategoria.length - atributosVisiveis.length} atributos opcionais (ajudam na busca do ML)
            </Button>
          )}
        </>
      )}
    </Card>
  );

  const painelLateral = det && (
    <div style={{ position: 'sticky', top: 0 }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <SituacaoTag a={det} />
          <Flex justify="space-between"><Text type="secondary">Itens</Text><Text>{det.qtdItens}</Text></Flex>
          <Flex justify="space-between"><Text type="secondary">Estoque total</Text><Text>{det.estoque}</Text></Flex>
          <Flex justify="space-between"><Text type="secondary">Preço no ML</Text>
            <Text>{det.precoMin === null ? '—' : det.precoMin === det.precoMax ? formatarMoeda(det.precoMin) : `${formatarMoeda(det.precoMin)} a ${formatarMoeda(det.precoMax)}`}</Text>
          </Flex>
          {det.itens[0]?.percentualComissao != null && (
            <Flex justify="space-between"><Text type="secondary">Comissão ({det.tipoAnuncio === 'gold_pro' ? 'Premium' : 'Clássico'})</Text><Text>{det.itens[0].percentualComissao}%</Text></Flex>
          )}
          <Tooltip title={erros ? 'Resolva as pendências em vermelho primeiro.' : 'A publicação entra na próxima etapa do módulo.'}>
            <Button type="primary" block icon={<SendOutlined />} disabled>Publicar no Mercado Livre</Button>
          </Tooltip>
        </Space>
      </Card>

      <Card
        size="small"
        title={erros ? <Space><CloseCircleFilled style={{ color: '#cf1322' }} />O que falta ({pendencias.filter(p => p.nivel === 'erro').length})</Space>
          : <Space><CheckCircleFilled style={{ color: '#52c41a' }} />Pronto para publicar</Space>}
        styles={{ body: { maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', padding: '4px 12px' } }}
      >
        {pendencias.length === 0 ? <Text type="secondary">Nada pendente.</Text> : (
          <List
            size="small" dataSource={pendencias}
            renderItem={p => (
              <List.Item
                style={{ padding: '6px 0', cursor: p.idItens.length ? 'pointer' : undefined }}
                onClick={() => p.idItens.length && setFiltroItens({ texto: p.texto, ids: p.idItens })}
              >
                <Space align="start" size={8}>
                  {p.nivel === 'erro' ? <ExclamationCircleFilled style={{ color: '#cf1322', marginTop: 4 }} /> : <WarningFilled style={{ color: '#faad14', marginTop: 4 }} />}
                  <div>
                    <Text style={{ fontSize: 13 }}>{textoComPrimeiraMaiuscula(p.texto)}</Text>
                    {p.skus.length > 0 && (
                      <Tooltip title={p.skus.slice(0, 25).join(', ') + (p.skus.length > 25 ? '…' : '')}>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{p.skus.length === 1 ? p.skus[0] : `${p.skus.length} itens`} · ver na tabela</Text></div>
                      </Tooltip>
                    )}
                  </div>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );

  return (
    <Drawer
      open={id !== null} onClose={onFechar} width="min(1320px, 100vw)" destroyOnHidden
      title={det ? <Space><PictureOutlined />{det.titulo || 'Anúncio'}{det.familia && <Tag>{det.familia}</Tag>}</Space> : 'Anúncio'}
      styles={{ body: { background: '#f5f6f8', paddingTop: 16 } }}
    >
      <style>{'.ml-linha-erro > td { background: #fff7f6 !important; }'}</style>
      <Spin spinning={carregando || salvando}>
        {!det ? <div style={{ minHeight: 300 }} /> : (
          <Row gutter={16}>
            <Col xs={24} xl={17}>
              {!editavel && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Anúncio publicado: as alterações vão pelo envio ao ML (próxima etapa)." />}
              {blocoDados}
              {blocoItens}
              {blocoAtributos}
            </Col>
            <Col xs={24} xl={7}>{painelLateral}</Col>
          </Row>
        )}
      </Spin>

      {det && (
        <>
          <CategoriaMlModal
            aberto={categoriaAberta} titulo={det.titulo || ''} atual={det.categoriaMl}
            onFechar={() => setCategoriaAberta(false)}
            onEscolher={async c => { await salvar({ categoriaMl: c }, 'Categoria escolhida: atributos ligados pelo nome quando deu.'); setCategoriaAberta(false); }}
          />
          <AdicionarAnuncioModal
            aberto={adicionarItens} modo="itens" onFechar={() => setAdicionarItens(false)}
            onEscolherItens={ids => { setAdicionarItens(false); executar(() => anunciosApi.adicionarItens(det.id, ids), 'Itens adicionados.'); }}
          />
        </>
      )}
    </Drawer>
  );
};

export default AnuncioEditor;

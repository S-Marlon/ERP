// Botão "Rolamentos" na conferência da nota: lê as linhas de rolamento (tipo, código, vedação, folga, marca),
// sugere as medidas pelo código e cadastra em lote — ou vincula ao item que já tem o mesmo SKU. 1ª linha: a marca
// sempre fecha o SKU (6205-2RS-C3/SKF). 2ª linha também leva a marca (6205-ZZ/GTOP), a não ser que a opção de juntar a
// 2ª linha num item só esteja ligada (6205-ZZ/2L).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Checkbox, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { PlusOutlined, ToolOutlined } from '@ant-design/icons';
import type { EntradaNfExtensaoProps, LinhaEntradaNf } from '../../registroModulos';
import type { MappingPayload } from '../../../pages/Compras/StockEntry/ItemsConference/ProductMappingModal';
import { mapeamentoRapido } from '../../../pages/Compras/StockEntry/edicaoLote';
import { garantirFamilias } from './estruturaRolamentos';
import { createMarca } from '../../../pages/Catalogo/pages/MarcasManager/services/comercialMarcas.service';
import {
  ConfigRolamentos, ItemExistente, MarcaModulo, montarDescricao, montarNome, montarSku, rolamentosApi, siglaDaMarca, Sufixo, TIPOS, TipoRolamento, VEDACOES,
} from './rolamentosApi';

const { Text } = Typography;
const PARECE_ROLAMENTO = /\b(ROL|ROLAMENTO|ROLAMENTOS|ROLAM|MANCAL|BUCHA)\b/i;

interface Linha {
  tempId: string | number;
  nItem?: number;
  item: LinhaEntradaNf;
  aplicar: boolean;
  jaVinculada: string | null;
  tipo: TipoRolamento | null;
  codigo: string;
  vedacao: string;
  folga: string | null;
  idMarca: number | null;
  marcaTexto: string | null;
  linha: 1 | 2 | null;
  d: number | null; D: number | null; B: number | null;
  origemMedidas: 'TABELA' | 'APRENDIDA' | 'MANUAL' | null;
  codigoCompleto: string | null;
  sufixos: Sufixo[];
}

const RolamentosEntrada: React.FC<EntradaNfExtensaoProps> = ({ linhas: linhasNota, aplicarMapeamentos, readOnly }) => {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [config, setConfig] = useState<ConfigRolamentos>({});
  const [marcas, setMarcas] = useState<MarcaModulo[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [existentes, setExistentes] = useState<Record<string, ItemExistente>>({});
  const [linhaDasMarcas, setLinhaDasMarcas] = useState<Record<number, 1 | 2>>({});
  const [markup, setMarkup] = useState(2);
  // Código do fabricante sem significado conhecido que o operador está definindo (fica no dicionário do módulo)
  const [definindo, setDefinindo] = useState<string | null>(null);
  const [significado, setSignificado] = useState('');

  const candidatas = useMemo(() => linhasNota.filter(l => PARECE_ROLAMENTO.test(String(l.descricao || ''))).length, [linhasNota]);

  const abrir = async () => {
    setAberto(true);
    setCarregando(true);
    try {
      const [cfg, analise] = await Promise.all([
        rolamentosApi.config(),
        rolamentosApi.analisar(linhasNota.map(l => ({ chave: String(l.tempId), descricao: String(l.descricao || '') }))),
      ]);
      setConfig(cfg.configuracao);
      setMarcas(cfg.marcas);
      setMarkup(cfg.configuracao.markup || 2);
      setLinhaDasMarcas({});
      setExistentes(analise.existentes);
      const porChave = new Map(linhasNota.map(l => [String(l.tempId), l]));
      setLinhas(analise.linhas.filter(a => a.ehRolamento).map(a => {
        const item = porChave.get(a.chave)!;
        const vinculada = item.mapeamento?.mode === 'EXISTING_DIRECT' ? (item.mapeamento.existingProduct?.sku || 'item do catálogo') : null;
        return {
          tempId: item.tempId, nItem: item.nItem, item, aplicar: !vinculada, jaVinculada: vinculada,
          tipo: a.tipo, codigo: a.codigo || '', vedacao: a.vedacao || 'ABERTO', folga: a.folga,
          idMarca: a.marca?.id ?? null, marcaTexto: a.marca ? null : a.marcaTexto, linha: a.linha,
          d: a.medidas?.d ?? null, D: a.medidas?.D ?? null, B: a.medidas?.B ?? null, origemMedidas: a.origemMedidas,
          codigoCompleto: a.codigoCompleto, sufixos: a.sufixos || [],
        };
      }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao analisar os rolamentos.');
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  };

  const alterar = (tempId: string | number, campo: Partial<Linha>) => setLinhas(ls => ls.map(l => (l.tempId === tempId ? { ...l, ...campo } : l)));
  const marcaDe = (id: number | null) => (id ? marcas.find(m => m.id === id) || null : null);

  // SKU e nome de cada linha (iguais às regras do backend) e o que falta para aplicar
  const calculado = (l: Linha) => {
    const marca = marcaDe(l.idMarca);
    const mesclada = Boolean(config.segundaLinhaMesclada);
    const pronto = l.codigo.trim() && l.tipo && l.linha && (marca || (l.linha === 2 && mesclada));
    const sku = pronto ? montarSku({ codigo: l.codigo, vedacao: l.vedacao, folga: l.folga, linha: l.linha!, marca, mesclada }) : null;
    const nome = pronto ? montarNome({ codigo: l.codigo, vedacao: l.vedacao, folga: l.folga, linha: l.linha!, marca, medidas: { d: l.d, D: l.D, B: l.B }, mesclada }) : null;
    const pendencias: string[] = [];
    if (!l.tipo) pendencias.push('tipo');
    if (!l.codigo.trim()) pendencias.push('código');
    if (!l.linha) pendencias.push('linha 1ª/2ª');
    if (!marca && !(l.linha === 2 && mesclada)) pendencias.push('marca');
    if (l.tipo && !config.subcategorias?.[l.tipo]) pendencias.push('subcategoria do tipo não configurada');
    if (l.linha === 2 && mesclada && !config.idMarcaSegundaLinha) pendencias.push('marca "2ª Linha" não configurada');
    return { sku, nome, pendencias, existente: sku ? existentes[sku.toUpperCase()] : undefined };
  };

  // Itens que já existem com os SKUs calculados (vincula em vez de cadastrar de novo)
  const skus = linhas.map(l => calculado(l).sku).filter(Boolean).join('|');
  useEffect(() => {
    if (!aberto || !skus) return;
    const t = setTimeout(() => {
      rolamentosApi.skus(skus.split('|')).then(r => setExistentes(r.existentes)).catch(() => undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [skus, aberto]);

  const trocarMarca = (l: Linha, idMarca: number | null) => {
    const m = marcaDe(idMarca);
    alterar(l.tempId, { idMarca, marcaTexto: null, linha: m ? (linhaDasMarcas[m.id] ?? m.linha ?? l.linha) : l.linha });
  };
  // Linha da marca: vale para todas as linhas dela na nota e fica salva na marca
  const trocarLinha = (l: Linha, linha: 1 | 2) => {
    if (l.idMarca) {
      setLinhaDasMarcas(x => ({ ...x, [l.idMarca!]: linha }));
      setLinhas(ls => ls.map(o => (o.idMarca === l.idMarca ? { ...o, linha } : o)));
    } else {
      alterar(l.tempId, { linha });
    }
  };

  const criarMarca = async (texto: string) => {
    try {
      const r = await createMarca({ nome: texto, codigo: siglaDaMarca({ nome: texto, codigo: null }) || null });
      const id = Number(r.id_marca);
      const cfg = await rolamentosApi.config();
      setMarcas(cfg.marcas);
      setLinhas(ls => ls.map(o => (o.marcaTexto === texto && !o.idMarca ? { ...o, idMarca: id, marcaTexto: null } : o)));
      message.success(`Marca "${texto}" criada. Defina se é 1ª ou 2ª linha.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao criar a marca.');
    }
  };

  const montarMapping = (l: Linha, sku: string, nome: string, agrupar: boolean, existente: ItemExistente | undefined, familiaId: number | null): MappingPayload => {
    const item = l.item;
    const unidadeNf = String(item.unidade || 'UN').toUpperCase();
    if (existente) {
      return {
        mode: 'EXISTING_DIRECT', existingProductId: existente.idItem,
        existingProduct: { sku: existente.sku, nome: existente.nome, tipo_recurso: existente.tipoRecurso },
        supplierLinkData: { sku_fornecedor: item.sku || '', ean_fornecedor: item.ean || null, descricao_fornecedor: item.descricao || '' },
        salesUnits: [],
        conversaoCompra: { unidade_compra: unidadeNf, unidade_base: (existente.unidadeBase || unidadeNf).toUpperCase(), fator: 1 },
        configVendas: null, draftIdentity: null,
      };
    }
    const a = config.atributos || {};
    const atributos: Record<number, unknown> = {};
    const por = (id: number | undefined, valor: unknown) => { if (id && valor !== null && valor !== undefined && valor !== '') atributos[id] = valor; };
    por(a.codigo, l.codigo.trim().toUpperCase());
    if (l.tipo && TIPOS[l.tipo].comVedacao) por(a.vedacao, l.vedacao === 'ABERTO' ? 'Aberto' : l.vedacao);
    por(a.folga, l.folga || 'Normal');
    por(a.linha, l.linha === 2 ? '2ª linha' : '1ª linha');
    por(a.diametroInterno, l.d); por(a.diametroExterno, l.D); por(a.largura, l.B);
    const base = mapeamentoRapido({ ...item, tipoRecurso: 'PRODUTO' }, {
      markup,
      classificacao: {
        familiaId, categoriaId: null,
        marcaId: l.linha === 2 && config.segundaLinhaMesclada ? (config.idMarcaSegundaLinha ?? null) : l.idMarca, atributos,
      },
    });
    return {
      ...base,
      draftIdentity: {
        ...base.draftIdentity!, tipo_recurso: 'PRODUTO', sku_comercial: sku, nome_comercial: nome,
        descricao_comercial: descricaoDe(l),
      },
      // O módulo sabe que linhas com o mesmo SKU são o mesmo produto (ex.: duas marcas de 2ª linha)
      ...(agrupar ? { agrupamentoConfirmado: sku.toUpperCase() } : {}),
    };
  };

  // Descrição do item novo: tipo, medidas, código do fabricante e o significado de cada sufixo
  const descricaoDe = (l: Linha) => (l.tipo ? montarDescricao({
    tipo: l.tipo, codigo: l.codigo, codigoCompleto: l.codigoCompleto, marca: marcaDe(l.idMarca)?.nome ?? null, linha: l.linha ?? 1,
    medidas: { d: l.d, D: l.D, B: l.B }, sufixos: l.sufixos,
  }) : '');

  const salvarSignificado = async () => {
    const codigo = definindo;
    const texto = significado.trim();
    if (!codigo || !texto) return;
    try {
      const sufixos = { ...(config.sufixos || {}), [codigo]: texto };
      await rolamentosApi.salvarConfig({ sufixos });
      setConfig(c => ({ ...c, sufixos }));
      setLinhas(ls => ls.map(l => ({ ...l, sufixos: l.sufixos.map(s => (s.codigo === codigo ? { ...s, significado: texto, categoria: s.categoria ?? 'OUTRO' } : s)) })));
      setDefinindo(null);
      message.success(`"${codigo}" salvo no dicionário de rolamentos.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar o significado.');
    }
  };

  const selecionadas = linhas.filter(l => l.aplicar);
  const aplicar = async () => {
    const calc = selecionadas.map(l => ({ l, c: calculado(l) }));
    const comPendencia = calc.filter(x => x.c.pendencias.length);
    if (comPendencia.length) {
      message.warning(`Complete as linhas ${comPendencia.map(x => x.l.nItem ?? x.l.tempId).join(', ')} antes de aplicar.`);
      return;
    }
    setSalvando(true);
    try {
      for (const [id, linha] of Object.entries(linhaDasMarcas)) {
        await rolamentosApi.salvarMarca(Number(id), linha, (marcaDe(Number(id))?.apelidos || []).join(', '));
      }
      const medidas = selecionadas.filter(l => l.origemMedidas === 'MANUAL' && l.d && l.D && l.B)
        .map(l => ({ codigo: l.codigo.trim().toUpperCase(), tipo: l.tipo, d: l.d!, D: l.D!, B: l.B! }));
      if (medidas.length) await rolamentosApi.salvarMedidas(medidas);
      const novos = calc.filter(x => !x.c.existente);
      // Família de cada código (Rolamento 6205): a que já existe na subcategoria do tipo ou uma nova, com as medidas como DNA
      const familias = await garantirFamilias(config, novos.map(x => ({ tipo: x.l.tipo!, codigo: x.l.codigo, medidas: { d: x.l.d, D: x.l.D, B: x.l.B } })));
      const contagem = new Map<string, number>();
      for (const x of novos) contagem.set(x.c.sku!, (contagem.get(x.c.sku!) || 0) + 1);
      aplicarMapeamentos(calc.map(x => ({
        tempId: x.l.tempId,
        mapping: montarMapping(x.l, x.c.sku!, x.c.nome!, (contagem.get(x.c.sku!) || 0) > 1, x.c.existente,
          familias[`${x.l.tipo}|${x.l.codigo.trim().toUpperCase()}`] ?? null),
      })));
      setAberto(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao aplicar.');
    } finally {
      setSalvando(false);
    }
  };

  const configIncompleta = !config.subcategorias || Object.keys(config.subcategorias).length === 0;
  // Marcas de rolamento (com linha) primeiro; as outras do sistema ficam num grupo à parte
  const marcaUtil = (m: MarcaModulo) => m.id !== config.idMarcaSegundaLinha && m.nome.toLowerCase() !== 'sem marca';
  const opcoesMarca = [
    { label: 'Marcas de rolamento', options: marcas.filter(m => marcaUtil(m) && (m.linha || linhaDasMarcas[m.id])).map(m => ({ value: m.id, label: m.nome })) },
    { label: 'Outras marcas do sistema', options: marcas.filter(m => marcaUtil(m) && !m.linha && !linhaDasMarcas[m.id]).map(m => ({ value: m.id, label: m.nome })) },
  ].filter(g => g.options.length);
  const medida = (l: Linha, campo: 'd' | 'D' | 'B') => (
    <InputNumber size="small" min={0} precision={3} decimalSeparator="," controls={false} style={{ width: 62 }} value={l[campo]}
      onChange={v => alterar(l.tempId, { [campo]: v === null ? null : Number(v), origemMedidas: 'MANUAL' } as Partial<Linha>)} />
  );

  return (
    <>
      <Tooltip title="Lê os rolamentos da nota, sugere medidas e cadastra em lote (1ª/2ª linha)">
        <Badge count={candidatas} size="small" offset={[-4, 2]}>
          <Button size="small" icon={<ToolOutlined />} disabled={readOnly} onClick={abrir}>Rolamentos</Button>
        </Badge>
      </Tooltip>

      <Modal
        open={aberto} onCancel={() => setAberto(false)} width={1380} destroyOnHidden
        title={`Rolamentos da nota (${linhas.length})`}
        footer={[
          <Space key="markup" style={{ float: 'left' }}>
            <Text>Markup dos itens novos</Text>
            <InputNumber size="small" min={1} step={0.1} precision={2} decimalSeparator="," value={markup} onChange={v => setMarkup(Number(v) || 2)} style={{ width: 80 }} />
          </Space>,
          <Button key="v" onClick={() => setAberto(false)}>Cancelar</Button>,
          <Button key="a" type="primary" loading={salvando} disabled={!selecionadas.length || configIncompleta} onClick={aplicar}>
            Aplicar em {selecionadas.length} linha(s)
          </Button>,
        ]}
      >
        <Spin spinning={carregando}>
          {configIncompleta && !carregando && (
            <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="Estrutura de rolamentos ainda não montada no catálogo."
              action={<Button size="small" onClick={() => navigate('/modulos/transmissao/rolamentos')}>Configurar</Button>} />
          )}
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Confira o que foi lido da descrição. A marca fecha o SKU (6205-2RS-C3/SKF){config.segundaLinhaMesclada ? '; 2ª linha: qualquer marca vira o mesmo item (/2L)' : ''}.
            Item que já existe com o mesmo SKU é vinculado; o resto vira item novo. Medidas digitadas ficam salvas para as próximas notas.
          </Text>
          <Table<Linha>
            size="small" rowKey="tempId" dataSource={linhas} pagination={false} scroll={{ x: 1300, y: 520 }}
            locale={{ emptyText: carregando ? ' ' : 'Nenhum rolamento reconhecido nesta nota.' }}
            columns={[
              {
                title: '', key: 'ap', width: 34, fixed: 'left',
                render: (_, l) => <Checkbox checked={l.aplicar} onChange={e => alterar(l.tempId, { aplicar: e.target.checked })} />,
              },
              {
                title: 'Na nota', key: 'nota', width: 210, fixed: 'left',
                render: (_, l) => (
                  <div style={{ lineHeight: 1.25 }}>
                    <Text style={{ fontSize: 12 }}>{l.nItem ? `${l.nItem}. ` : ''}{l.item.descricao}</Text>
                    {l.jaVinculada && <div><Tag color="purple" style={{ fontSize: 10, marginTop: 2 }}>já vinculada: {l.jaVinculada}</Tag></div>}
                    {l.sufixos.length > 0 && (
                      <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {l.sufixos.map(s => (s.significado ? (
                          <Tooltip key={s.codigo} title={`${s.significado}${s.provavel ? ' (provável)' : ''}`}>
                            <Tag style={{ fontSize: 10, margin: 0, cursor: 'help' }}>{s.codigo}</Tag>
                          </Tooltip>
                        ) : (
                          <Tooltip key={s.codigo} title="Código sem significado conhecido: clique para definir (fica salvo para as próximas notas)">
                            <Tag color="orange" style={{ fontSize: 10, margin: 0, cursor: 'pointer' }} onClick={() => { setDefinindo(s.codigo); setSignificado(''); }}>{s.codigo} ?</Tag>
                          </Tooltip>
                        )))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: 'Tipo', key: 'tipo', width: 160,
                render: (_, l) => (
                  <Select size="small" style={{ width: '100%' }} value={l.tipo ?? undefined} placeholder="tipo" popupMatchSelectWidth={240}
                    onChange={v => alterar(l.tempId, { tipo: v, vedacao: TIPOS[v as TipoRolamento].comVedacao ? l.vedacao : 'ABERTO' })}
                    options={Object.entries(TIPOS).map(([v, t]) => ({ value: v, label: t.familia.replace('Rolamento ', '') }))} />
                ),
              },
              { title: 'Código', key: 'cod', width: 105, render: (_, l) => <Input size="small" value={l.codigo} onChange={e => alterar(l.tempId, { codigo: e.target.value.toUpperCase() })} /> },
              {
                title: 'Vedação', key: 'ved', width: 95,
                render: (_, l) => (
                  <Select size="small" style={{ width: '100%' }} value={l.vedacao} disabled={!l.tipo || !TIPOS[l.tipo].comVedacao} popupMatchSelectWidth={150}
                    onChange={v => alterar(l.tempId, { vedacao: v })} options={VEDACOES} />
                ),
              },
              {
                title: 'Folga', key: 'folga', width: 80,
                render: (_, l) => (
                  <Select size="small" style={{ width: '100%' }} value={l.folga ?? ''} onChange={v => alterar(l.tempId, { folga: v || null })}
                    options={[{ value: '', label: 'Normal' }, { value: 'C2', label: 'C2' }, { value: 'C3', label: 'C3' }, { value: 'C4', label: 'C4' }]} />
                ),
              },
              {
                title: 'Marca', key: 'marca', width: 170,
                render: (_, l) => (
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Select size="small" showSearch allowClear optionFilterProp="label" style={{ width: '100%' }} placeholder="marca"
                      value={l.idMarca ?? undefined} onChange={v => trocarMarca(l, v ?? null)}
                      options={opcoesMarca} />
                    {!l.idMarca && l.marcaTexto && (
                      <Button size="small" type="link" icon={<PlusOutlined />} style={{ padding: 0, height: 16, fontSize: 11 }} onClick={() => criarMarca(l.marcaTexto!)}>
                        criar "{l.marcaTexto}"
                      </Button>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Linha', key: 'linha', width: 88,
                render: (_, l) => (
                  <Select size="small" style={{ width: '100%' }} value={l.linha ?? undefined} placeholder="?" status={l.linha ? undefined : 'warning'}
                    onChange={v => trocarLinha(l, v)} options={[{ value: 1, label: '1ª' }, { value: 2, label: '2ª' }]} />
                ),
              },
              {
                title: 'Medidas d × D × B (mm)', key: 'med', width: 230,
                render: (_, l) => (
                  <Space size={2}>
                    {medida(l, 'd')}{medida(l, 'D')}{medida(l, 'B')}
                    {l.origemMedidas === 'TABELA' && <Tooltip title="Pela tabela padrão do código"><Tag style={{ fontSize: 9, margin: 0 }}>tab</Tag></Tooltip>}
                    {l.origemMedidas === 'APRENDIDA' && <Tooltip title="Digitada numa nota anterior"><Tag color="cyan" style={{ fontSize: 9, margin: 0 }}>salva</Tag></Tooltip>}
                  </Space>
                ),
              },
              {
                title: 'Resultado', key: 'res', width: 230,
                render: (_, l) => {
                  const c = calculado(l);
                  if (c.pendencias.length) return <Text type="danger" style={{ fontSize: 12 }}>Falta: {c.pendencias.join(', ')}</Text>;
                  return (
                    <div style={{ lineHeight: 1.3 }}>
                      <b>{c.sku}</b>
                      <div>{c.existente
                        ? <Tag color="green" style={{ fontSize: 10, margin: 0 }}>vincula a: {c.existente.nome}</Tag>
                        : (
                          <Tooltip title={<div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{descricaoDe(l)}</div>}>
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, cursor: 'help' }}>novo: {c.nome}</Tag>
                          </Tooltip>
                        )}</div>
                    </div>
                  );
                },
              },
            ]}
          />
        </Spin>
      </Modal>

      <Modal open={definindo !== null} title={`O que significa "${definindo ?? ''}"?`} okText="Salvar no dicionário" cancelText="Voltar"
        onOk={salvarSignificado} okButtonProps={{ disabled: !significado.trim() }} onCancel={() => setDefinindo(null)} destroyOnHidden width={440}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Vai na descrição dos itens novos e vale para as próximas notas. Não muda o SKU. Confira no catálogo do fabricante se tiver dúvida.
        </Text>
        <Input autoFocus style={{ marginTop: 8 }} maxLength={200} value={significado} onChange={e => setSignificado(e.target.value)}
          onPressEnter={salvarSignificado} placeholder="Ex.: código de embalagem do fabricante" />
      </Modal>
    </>
  );
};

export default RolamentosEntrada;

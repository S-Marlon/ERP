// Nomes e SKUs das variações: modelos (nome e SKU) em cima e uma grade com os atributos de cada variação, editáveis,
// com o nome e o SKU novos calculados na hora. Salva pela formalização da família (o servidor monta de novo e grava).
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Flex, Input, Modal, Row, Segmented, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, message, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, ExclamationCircleOutlined, SearchOutlined, SettingOutlined, UndoOutlined } from '@ant-design/icons';
import type { AtributoConfig, Familia } from '../CatalogManager.types';
import { formalizarItensDaFamilia, getDiagnosticoFormalizacao } from '../FamilyManager.api';
import {
  atributosNosTemplates, AvaliacaoVariacao, avaliarVariacao, CHAVE_MARCA, FamiliaNomenclatura, opcoesDoAtributo, PapelMarca, skusRepetidos,
  valoresMudaram, VariacaoEditavel,
} from '../nomenclaturaVariacoes';

const { Text } = Typography;
const porTexto = (a: unknown, b: unknown) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });

interface Props {
  open: boolean;
  onClose: () => void;
  familia?: Familia;
  /** A família tem alterações não salvas (modelos, sigla...): o servidor monta com o que está salvo */
  temAlteracoes?: boolean;
  onSalvarFamilia?: () => Promise<unknown> | void;
  onAtualizarTemplateComercial: (v: string) => void;
  onAtualizarTemplateSku: (v: string) => void;
  onAtualizarSiglaSku: (v: string) => void;
  onAtualizarSeparadorSku?: (v: string) => void;
  /** Variações gravadas: recarregar os itens da família */
  onSalvo?: () => void;
}

type Filtro = 'TODAS' | 'PENDENTES' | 'MUDAM' | 'EDITADAS';
interface Linha extends VariacaoEditavel { original: Record<string, unknown> }

export const EditorNomenclaturaModal: React.FC<Props> = ({
  open, onClose, familia, temAlteracoes, onSalvarFamilia, onAtualizarTemplateComercial, onAtualizarTemplateSku, onAtualizarSiglaSku,
  onAtualizarSeparadorSku, onSalvo,
}) => {
  const { token } = theme.useToken();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [busca, setBusca] = useState('');
  const [comFicha, setComFicha] = useState(false);
  const [marcadas, setMarcadas] = useState<React.Key[]>([]);
  const [lote, setLote] = useState<{ atributo?: string; valor?: string }>({});
  const [focoModelo, setFocoModelo] = useState<'nome' | 'sku'>('nome');

  const carregar = async () => {
    if (!familia?.id) return;
    setCarregando(true);
    try {
      const d = await getDiagnosticoFormalizacao(String(familia.id));
      setMarcas((d.marcas || []).map((m: { nome: string }) => m.nome));
      setLinhas((d.itens || []).map((i: any) => {
        const valores = { ...(i.valoresAtributos || {}) };
        return {
          idItem: String(i.idItem || i.id), skuAtual: i.sku || '', nomeAtual: i.nomeComercial || i.nome || '', variacao: i.variacao,
          valores, original: { ...valores },
        };
      }).sort((a: Linha, b: Linha) => porTexto(a.skuAtual, b.skuAtual)));
      setMarcadas([]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar as variações.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { if (open) carregar(); }, [open, familia?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modelos e atributos da tela (com o que ainda não foi salvo na família)
  const atributos: AtributoConfig[] = useMemo(
    () => (familia?.atributos || []).filter(a => !(a as any).isMarcaSistema && a.id !== CHAVE_MARCA),
    [familia?.atributos],
  );
  const fam: FamiliaNomenclatura = {
    nome: familia?.nome || '', siglaSku: familia?.siglaSku, separadorSku: familia?.separadorSku ?? '-',
    templateSku: familia?.templateSku, templateNomeComercial: familia?.templateNomeComercial,
    papelMarca: (familia?.marcaComportamento as PapelMarca) || 'ficha', marca: familia?.nomeMarca || '',
  };
  const usados = atributosNosTemplates(fam, atributos);
  const colunasAtributos = atributos
    .filter(a => comFicha || usados.has(a.id) || a.classificacao === 'dna' || a.classificacao === 'grade' || a.obrigatorio)
    .sort((a, b) => Number(usados.has(b.id)) - Number(usados.has(a.id)) || (a.classificacao === 'grade' ? -1 : 1));
  const usaMarca = fam.papelMarca === 'grade' || /\{marca\}|\[marca\]/i.test(`${fam.templateSku} ${fam.templateNomeComercial}`);

  const avaliacoes = useMemo(() => new Map(linhas.map(l => [l.idItem, avaliarVariacao(l, fam, atributos)])),
    [linhas, fam.templateSku, fam.templateNomeComercial, fam.siglaSku, fam.separadorSku, fam.papelMarca, fam.marca, fam.nome, atributos]); // eslint-disable-line react-hooks/exhaustive-deps
  const repetidos = useMemo(() => skusRepetidos([...avaliacoes.values()]), [avaliacoes]);
  const av = (l: Linha) => avaliacoes.get(l.idItem) as AvaliacaoVariacao;
  const editada = (l: Linha) => valoresMudaram(l.original, l.valores);
  const repetido = (l: Linha) => repetidos.has(av(l).skuNovo.toUpperCase());
  const paraSalvar = linhas.filter(l => av(l).pronta && !repetido(l) && (editada(l) || av(l).mudaNome || av(l).mudaSku));

  const visiveis = linhas.filter(l => {
    const a = av(l);
    if (filtro === 'PENDENTES' && a.pronta && !repetido(l)) return false;
    if (filtro === 'MUDAM' && !(a.pronta && (a.mudaNome || a.mudaSku))) return false;
    if (filtro === 'EDITADAS' && !editada(l)) return false;
    const t = busca.trim().toLowerCase();
    return !t || [l.skuAtual, l.nomeAtual, a.skuNovo, a.nomeNovo, ...Object.values(l.valores).map(String)].some(x => String(x).toLowerCase().includes(t));
  });

  const definir = (ids: string[], chave: string, valor: unknown) =>
    setLinhas(ls => ls.map(l => (ids.includes(l.idItem) ? { ...l, valores: { ...l.valores, [chave]: valor ?? '' } } : l)));

  // ---------------------------------------------------------------- célula editável de cada atributo
  const editor = (a: AtributoConfig | 'MARCA', l: Linha) => {
    const chave = a === 'MARCA' ? CHAVE_MARCA : a.id;
    const valor = l.valores[chave];
    const mudou = String(valor ?? '') !== String(l.original[chave] ?? '');
    const estilo = { width: '100%', background: mudou ? token.colorWarningBg : undefined };
    if (a === 'MARCA') {
      return <Select size="small" showSearch allowClear style={estilo} value={(valor as string) || undefined} placeholder={fam.marca || 'marca'}
        options={marcas.map(m => ({ value: m, label: m }))} onChange={v => definir([l.idItem], chave, v)} />;
    }
    const opcoes = opcoesDoAtributo(a);
    const padrao = a.valorPadraoFamilia ? `padrão: ${a.valorPadraoFamilia}` : a.nome;
    if (a.tipoDado === 'lista' && opcoes.length) {
      const foraDaLista = valor !== undefined && valor !== '' && !opcoes.includes(String(valor));
      return (
        <Select size="small" showSearch allowClear style={estilo} status={foraDaLista ? 'error' : undefined} placeholder={padrao}
          value={(valor as string) || undefined} popupMatchSelectWidth={false}
          options={[...(foraDaLista ? [{ value: String(valor), label: `${valor} (fora da lista)` }] : []), ...opcoes.map(o => ({ value: o, label: o }))]}
          onChange={v => definir([l.idItem], chave, v)} />
      );
    }
    if (a.tipoDado === 'boolean') {
      return <Select size="small" allowClear style={estilo} value={valor === undefined || valor === '' ? undefined : String(valor)} placeholder={padrao}
        options={[{ value: '1', label: 'Sim' }, { value: '0', label: 'Não' }]} onChange={v => definir([l.idItem], chave, v)} />;
    }
    return <Input size="small" style={estilo} value={String(valor ?? '')} placeholder={padrao} type={a.tipoDado === 'data' ? 'date' : 'text'}
      inputMode={a.tipoDado === 'numero' || a.tipoDado === 'decimal' ? 'decimal' : undefined}
      onChange={e => definir([l.idItem], chave, e.target.value)} />;
  };

  const corPapel: Record<string, string> = { dna: 'purple', grade: 'cyan', ficha: 'default' };
  const colunas: ColumnsType<Linha> = [
    {
      title: 'Variação atual', key: 'atual', width: 220, fixed: 'left',
      sorter: (a, b) => porTexto(a.skuAtual, b.skuAtual), defaultSortOrder: 'ascend',
      render: (_, l) => (
        <div style={{ lineHeight: 1.25 }}>
          <Text code style={{ fontSize: 11 }}>{l.skuAtual || '—'}</Text>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{l.nomeAtual}</div>
        </div>
      ),
    },
    ...(usaMarca ? [{
      title: <Tooltip title={fam.papelMarca === 'grade' ? 'A marca diferencia as variações' : 'Marca do item'}><span>Marca <Tag color="gold" style={{ fontSize: 9, margin: 0 }}>{fam.papelMarca}</Tag></span></Tooltip>,
      key: 'marca', width: 150,
      render: (_: unknown, l: Linha) => editor('MARCA', l),
    }] : []),
    ...colunasAtributos.map(a => ({
      title: (
        <Tooltip title={`${a.classificacao.toUpperCase()}${usados.has(a.id) ? ' · usado no nome/SKU' : ''}${a.obrigatorio ? ' · obrigatório' : ''}`}>
          <span>{a.nome}{usados.has(a.id) && <span style={{ color: token.colorPrimary }}> •</span>} <Tag color={corPapel[a.classificacao]} style={{ fontSize: 9, margin: 0 }}>{a.classificacao}</Tag></span>
        </Tooltip>
      ),
      key: `a${a.id}`, width: 160,
      sorter: (x: Linha, y: Linha) => porTexto(x.valores[a.id], y.valores[a.id]),
      render: (_: unknown, l: Linha) => editor(a, l),
    })),
    {
      title: 'Como fica', key: 'novo', width: 340,
      render: (_, l) => {
        const a = av(l);
        const rep = repetido(l);
        const cor = !a.pronta || rep ? token.colorError : a.mudaNome || a.mudaSku ? token.colorSuccess : token.colorTextTertiary;
        return (
          <div style={{ lineHeight: 1.3 }}>
            <Flex gap={4} align="center" wrap>
              <Text code style={{ fontSize: 11, color: cor }}>{a.skuNovo || '—'}</Text>
              {rep && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>SKU repetido</Tag>}
              {a.pronta && !rep && !a.mudaNome && !a.mudaSku && <Tag style={{ fontSize: 10, margin: 0 }}>sem mudança</Tag>}
              {!a.pronta && (
                <Tooltip title={a.pendencias.join(' · ') || 'Falta valor no nome/SKU'}>
                  <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ fontSize: 10, margin: 0 }}>{a.pendencias.length || 1} pendência(s)</Tag>
                </Tooltip>
              )}
            </Flex>
            <div style={{ fontSize: 11, color: a.mudaNome && a.pronta ? token.colorText : token.colorTextSecondary }}>{a.nomeNovo}</div>
          </div>
        );
      },
    },
    {
      title: '', key: 'desfazer', width: 40, fixed: 'right',
      render: (_, l) => editada(l) && (
        <Tooltip title="Desfazer as edições desta variação">
          <Button size="small" type="text" icon={<UndoOutlined />} onClick={() => setLinhas(ls => ls.map(x => (x.idItem === l.idItem ? { ...x, valores: { ...x.original } } : x)))} />
        </Tooltip>
      ),
    },
  ];

  // ---------------------------------------------------------------- modelos (nome e SKU)
  const inserirToken = (t: string) => {
    if (focoModelo === 'sku') onAtualizarTemplateSku(`${familia?.templateSku || ''}${t}`);
    else onAtualizarTemplateComercial(`${familia?.templateNomeComercial || ''}${t}`);
  };
  const exemplo = linhas.find(l => av(l).pronta) || linhas[0];

  // ---------------------------------------------------------------- salvar
  const gravar = async () => {
    if (!familia?.id || !paraSalvar.length) return;
    setSalvando(true);
    try {
      // Família não salva: o servidor montaria com os modelos antigos
      if (temAlteracoes && onSalvarFamilia && (await onSalvarFamilia()) === false) return;
      for (let i = 0; i < paraSalvar.length; i += 50) {
        await formalizarItensDaFamilia(String(familia.id), paraSalvar.slice(i, i + 50).map(l => ({ idItem: l.idItem, atributos: l.valores })));
      }
      message.success(`${paraSalvar.length} variação(ões) gravada(s) com o nome e o SKU novos.`);
      onSalvo?.();
      await carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao gravar as variações.');
    } finally {
      setSalvando(false);
    }
  };
  const confirmarGravar = () => {
    const pendentes = linhas.filter(l => !av(l).pronta || repetido(l)).length;
    Modal.confirm({
      title: `Gravar ${paraSalvar.length} variação(ões)?`,
      content: (
        <div>
          {temAlteracoes && <p>Os modelos da família mudaram: a família é salva antes, para o servidor montar com os modelos novos.</p>}
          <p>Os atributos, o nome e o SKU de cada uma são gravados. O SKU raiz (interno) não muda.</p>
          {pendentes > 0 && <p style={{ color: token.colorWarning }}>{pendentes} com pendência ou SKU repetido ficam de fora.</p>}
        </div>
      ),
      okText: 'Gravar', cancelText: 'Voltar', onOk: gravar,
    });
  };

  const fechar = () => {
    const editadas = linhas.filter(editada).length;
    if (!editadas) { onClose(); return; }
    Modal.confirm({
      title: `Sair sem gravar ${editadas} variação(ões) editada(s)?`, okText: 'Sair sem gravar', okButtonProps: { danger: true }, cancelText: 'Continuar editando',
      onOk: onClose,
    });
  };

  const contagem = {
    pendentes: linhas.filter(l => !av(l).pronta || repetido(l)).length,
    mudam: linhas.filter(l => av(l).pronta && (av(l).mudaNome || av(l).mudaSku)).length,
    editadas: linhas.filter(editada).length,
  };
  const atributoLote = atributos.find(a => a.id === lote.atributo);

  return (
    <Modal open={open} onCancel={fechar} width="96vw" style={{ top: 16, maxWidth: 1700 }} destroyOnHidden
      title={<Space><SettingOutlined /> Nomes e SKUs das variações · {familia?.nome}</Space>}
      styles={{ body: { maxHeight: 'calc(100vh - 170px)', overflowY: 'auto' } }}
      footer={(
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {linhas.length} variação(ões) · {contagem.mudam} mudam · {contagem.pendentes} com pendência · {contagem.editadas} editada(s)
          </Text>
          <Space>
            <Button onClick={fechar}>Fechar</Button>
            <Button type="primary" icon={<CheckCircleOutlined />} disabled={!paraSalvar.length} loading={salvando} onClick={confirmarGravar}>
              Gravar {paraSalvar.length} variação(ões)
            </Button>
          </Space>
        </Flex>
      )}>
      <Flex vertical gap={12}>
        {/* Modelos */}
        <Card size="small" title="Modelos" extra={temAlteracoes && <Tag color="gold">família com alterações não salvas</Tag>}>
          <Row gutter={[12, 8]}>
            <Col xs={24} lg={13}>
              <Text style={{ fontSize: 12 }}>Nome comercial</Text>
              <Input value={familia?.templateNomeComercial || ''} onFocus={() => setFocoModelo('nome')}
                onChange={e => onAtualizarTemplateComercial(e.target.value)} placeholder="{FAMILIA} - {Rosca} - {Mangueira}"
                style={{ borderColor: focoModelo === 'nome' ? token.colorPrimary : undefined }} />
            </Col>
            <Col xs={12} lg={4}>
              <Text style={{ fontSize: 12 }}>Sigla</Text>
              <Input value={familia?.siglaSku || ''} onChange={e => onAtualizarSiglaSku(e.target.value.replace(/[^A-Za-z0-9._-]/g, ''))} placeholder="190FJ" />
            </Col>
            <Col xs={12} lg={2}>
              <Tooltip title="{S} no modelo do SKU"><Text style={{ fontSize: 12 }}>Separador</Text></Tooltip>
              <Input value={familia?.separadorSku ?? '-'} maxLength={2} disabled={!onAtualizarSeparadorSku} onChange={e => onAtualizarSeparadorSku?.(e.target.value)} />
            </Col>
            <Col xs={24} lg={5}>
              <Text style={{ fontSize: 12 }}>SKU</Text>
              <Input value={familia?.templateSku || ''} onFocus={() => setFocoModelo('sku')} style={{ fontFamily: 'monospace', borderColor: focoModelo === 'sku' ? token.colorPrimary : undefined }}
                onChange={e => onAtualizarTemplateSku(e.target.value.replace(/[ºª¢¬?<>\\|'*+^~`´]/g, ''))} placeholder="{SIGLA}{S}{Rosca}" />
            </Col>
          </Row>
          <Flex gap={4} wrap align="center" style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Clique para pôr no modelo {focoModelo === 'sku' ? 'do SKU' : 'do nome'}:</Text>
            {['{FAMILIA}', '{SIGLA}', '{S}', '{MARCA}'].map(t => <Tag key={t} color="blue" style={{ cursor: 'pointer', margin: 0 }} onClick={() => inserirToken(t)}>{t}</Tag>)}
            {atributos.map(a => (
              <React.Fragment key={a.id}>
                <Tag color={corPapel[a.classificacao]} style={{ cursor: 'pointer', margin: 0 }} onClick={() => inserirToken(`{${a.nome}}`)}>{`{${a.nome}}`}</Tag>
                {(a.opcoesValidas || []).some(o => typeof o !== 'string' && o.codigo) && (
                  <Tooltip title="Código da opção (ex.: a bitola), em vez do texto: ideal para o SKU">
                    <Tag color={corPapel[a.classificacao]} style={{ cursor: 'pointer', margin: 0, borderStyle: 'dashed' }} onClick={() => inserirToken(`{${a.nome}:cod}`)}>{`{${a.nome}:cod}`}</Tag>
                  </Tooltip>
                )}
              </React.Fragment>
            ))}
          </Flex>
          {exemplo && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: token.colorFillQuaternary }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Exemplo ({exemplo.skuAtual}): </Text>
              <Text code>{av(exemplo).skuNovo}</Text> <Text strong>{av(exemplo).nomeNovo}</Text>
            </div>
          )}
        </Card>

        {repetidos.size > 0 && (
          <Alert type="error" showIcon title={`${repetidos.size} SKU(s) repetido(s) na família`}
            description="Duas variações gerariam o mesmo SKU: inclua no modelo do SKU o atributo que diferencia, ou corrija os valores." />
        )}

        {/* Variações */}
        <Flex gap={8} wrap align="center">
          <Input size="small" allowClear prefix={<SearchOutlined />} placeholder="Buscar SKU, nome ou valor" style={{ width: 240 }} value={busca} onChange={e => setBusca(e.target.value)} />
          <Segmented size="small" value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
            { value: 'TODAS', label: `Todas (${linhas.length})` },
            { value: 'PENDENTES', label: `Pendentes (${contagem.pendentes})` },
            { value: 'MUDAM', label: `Vão mudar (${contagem.mudam})` },
            { value: 'EDITADAS', label: `Editadas (${contagem.editadas})` },
          ]} />
          <Space size={4}><Switch size="small" checked={comFicha} onChange={setComFicha} /> <Text style={{ fontSize: 12 }}>Ficha técnica</Text></Space>
          {marcadas.length > 0 && (
            <Flex gap={6} wrap align="center" style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, background: token.colorPrimaryBg }}>
              <Text strong style={{ fontSize: 12 }}>{marcadas.length} marcada(s):</Text>
              <Select size="small" placeholder="Atributo" style={{ width: 160 }} value={lote.atributo}
                options={atributos.map(a => ({ value: a.id, label: a.nome }))} onChange={v => setLote({ atributo: v })} />
              {atributoLote && (opcoesDoAtributo(atributoLote).length
                ? <Select size="small" showSearch placeholder="Valor" style={{ width: 160 }} value={lote.valor} popupMatchSelectWidth={false}
                    options={opcoesDoAtributo(atributoLote).map(o => ({ value: o, label: o }))} onChange={v => setLote(l => ({ ...l, valor: v }))} />
                : <Input size="small" placeholder="Valor" style={{ width: 140 }} value={lote.valor} onChange={e => setLote(l => ({ ...l, valor: e.target.value }))} />)}
              <Button size="small" type="primary" disabled={!lote.atributo || lote.valor === undefined}
                onClick={() => { definir(marcadas.map(String), lote.atributo!, lote.valor); message.success(`${atributoLote?.nome} preenchido em ${marcadas.length}.`); }}>
                Preencher
              </Button>
              <Button size="small" type="text" onClick={() => setMarcadas([])}>Limpar</Button>
            </Flex>
          )}
        </Flex>

        {carregando ? <Flex justify="center" style={{ padding: 40 }}><Spin /></Flex> : linhas.length === 0
          ? <Empty description="Nenhuma variação nesta família ainda. Inclua itens pela lista de itens da família." />
          : (
            <Table<Linha>
              size="small"
              rowKey="idItem"
              columns={colunas}
              dataSource={visiveis}
              rowSelection={{ selectedRowKeys: marcadas, onChange: setMarcadas, preserveSelectedRowKeys: true }}
              pagination={{ pageSize: 25, size: 'small', hideOnSinglePage: true, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
              scroll={{ x: 'max-content' }}
            />
          )}
      </Flex>
    </Modal>
  );
};

export default EditorNomenclaturaModal;

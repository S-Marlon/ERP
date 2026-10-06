// Classificação do item novo na entrada de NF: família (que já traz a categoria) ou só a categoria, a marca
// e, se o operador quiser, os valores dos atributos que o item herda. Nada disso é obrigatório aqui:
// o que ficar vazio é completado depois no editor de catálogo (o item só não é publicado enquanto faltar obrigatório).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Row, Select, Space, Spin, Switch, Tag, Tooltip, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getCategorias, getFamilies } from '../../../Catalogo/pages/FamilyManager/FamilyManager.api';
import { STATUS_FAMILIA_CONFIG } from '../../../Catalogo/pages/FamilyManager/CatalogManager.types';
import type { AtributoFicha } from '../../../Catalogo/pages/CatalogSkus/CatalogSku.service';
import CampoAtributo, { PAPEL_ATRIBUTO, ordenarPorPapel, valorVazio } from '../../../Catalogo/pages/CatalogSkus/CampoAtributo';
import { getAtributosParaItem } from '../../api/comprasApi';
import { definirCategoriaDaFamilia } from '../../../Catalogo/pages/CategoryManager/categoryService';
import { createMarca, getMarcas } from '../../../Catalogo/pages/MarcasManager/services/comercialMarcas.service';
import { ModalNovaCategoria, ModalNovaFamilia } from './DefinicoesPimRapidas';

const { Text } = Typography;

export interface ClassificacaoItem {
  familiaId: number | null;
  categoriaId: number | null;
  // null = não preencher agora (fica para o editor de catálogo)
  atributos: Record<number, unknown> | null;
  // Marca do item (família com marca DNA impõe a dela)
  marcaId?: number | null;
}

export const CLASSIFICACAO_VAZIA: ClassificacaoItem = { familiaId: null, categoriaId: null, atributos: null, marcaId: null };

interface FamiliaOpcao {
  id: number; nome: string; status: string; categoriaId: number | null;
  // Papel da marca na família: ficha (cada item a sua), dna (todos com a da família), grade (cada item precisa da sua)
  papelMarca: string; idMarca: number | null; nomeMarca: string;
}
interface MarcaOpcao { id: number; nome: string }

// "Sem Marca" (registro padrão do banco) vale como ausência de marca
const marcaReal = (nome: unknown) => !['', 'semmarca'].includes(String(nome || '').toLowerCase().replace(/\s+/g, ''));

let cacheMarcas: Promise<MarcaOpcao[]> | null = null;
export const carregarMarcas = () => {
  if (!cacheMarcas) {
    cacheMarcas = getMarcas()
      .then(ms => ms.filter(m => m.status !== 'Inativo' && marcaReal(m.nome)).map(m => ({ id: Number(m.id), nome: m.nome })).sort((a, b) => a.nome.localeCompare(b.nome)))
      .catch(err => { cacheMarcas = null; throw err; });
  }
  return cacheMarcas;
};
interface CategoriaOpcao { id: number; caminho: string }

// Famílias e categorias mudam pouco: carregadas uma vez por sessão da tela
let cacheCatalogo: Promise<{ familias: FamiliaOpcao[]; categorias: CategoriaOpcao[] }> | null = null;
export const carregarFamiliasECategorias = () => {
  if (!cacheCatalogo) {
    cacheCatalogo = Promise.all([getFamilies(), getCategorias()])
      .then(([fams, cats]) => {
        const porId = new Map(cats.map(c => [c.id, c]));
        const caminho = (id: string) => {
          const partes: string[] = [];
          let atual = porId.get(id);
          const vistos = new Set<string>();
          while (atual && !vistos.has(atual.id)) {
            vistos.add(atual.id);
            partes.unshift(atual.nome);
            atual = atual.paiId ? porId.get(atual.paiId) : undefined;
          }
          return partes.join(' › ');
        };
        return {
          familias: fams.map(f => ({
            id: Number(f.id), nome: f.nome, status: f.status, categoriaId: Number(f.categoriaPai) || null,
            papelMarca: String(f.marcaComportamento || 'ficha'), idMarca: Number(f.idMarca) || null, nomeMarca: f.nomeMarca || '',
          })),
          categorias: cats.map(c => ({ id: Number(c.id), caminho: caminho(c.id) })).sort((a, b) => a.caminho.localeCompare(b.caminho)),
        };
      })
      .catch(err => { cacheCatalogo = null; throw err; });
  }
  return cacheCatalogo;
};

// Depois de criar/alterar família ou categoria por aqui: a próxima leitura busca de novo no servidor
export const invalidarFamiliasECategorias = () => { cacheCatalogo = null; };

interface Props {
  value: ClassificacaoItem;
  onChange: (valor: ClassificacaoItem) => void;
  // Lote: os valores de cada item são preenchidos numa tabela do modal (um item por linha)
  lote?: boolean;
  // Atributos que valem para a família/categoria escolhida (o modal de lote monta a tabela com eles)
  onAtributos?: (lista: AtributoFicha[]) => void;
}

export const ClassificacaoPim: React.FC<Props> = ({ value, onChange, lote, onAtributos }) => {
  const [familias, setFamilias] = useState<FamiliaOpcao[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([]);
  const [atributos, setAtributos] = useState<AtributoFicha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Definições rápidas: nova família / nova categoria (para o item ou para a família nova)
  const [modalFamilia, setModalFamilia] = useState(false);
  const [modalCategoria, setModalCategoria] = useState<null | 'item' | 'familia'>(null);
  const [categoriaCriada, setCategoriaCriada] = useState<number | null>(null);
  const [categoriaDaFamilia, setCategoriaDaFamilia] = useState<number | null>(null);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [versao, setVersao] = useState(0);
  const [marcas, setMarcas] = useState<MarcaOpcao[]>([]);
  const [buscaMarca, setBuscaMarca] = useState('');
  const [criandoMarca, setCriandoMarca] = useState(false);

  const recarregar = async () => {
    invalidarFamiliasECategorias();
    const r = await carregarFamiliasECategorias();
    setFamilias(r.familias);
    setCategorias(r.categorias);
    setVersao(n => n + 1);
  };

  useEffect(() => {
    carregarFamiliasECategorias()
      .then(r => { setFamilias(r.familias); setCategorias(r.categorias); })
      .catch(e => setErro(e.message || 'Erro ao carregar famílias e categorias.'));
    carregarMarcas().then(setMarcas).catch(e => setErro(e.message || 'Erro ao carregar as marcas.'));
  }, []);

  // Marca nova sem sair da entrada: digita na busca e cria
  const criarMarca = async () => {
    const nome = buscaMarca.trim();
    if (!nome) return;
    setCriandoMarca(true);
    try {
      const r = await createMarca({ nome });
      cacheMarcas = null;
      setMarcas(await carregarMarcas());
      setBuscaMarca('');
      onChange({ ...value, marcaId: Number(r.id_marca) });
      message.success(`Marca "${nome}" criada.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao criar a marca.');
    } finally {
      setCriandoMarca(false);
    }
  };

  // Atributos que o item terá nesta família/categoria
  useEffect(() => {
    if (!value.familiaId && !value.categoriaId) { setAtributos([]); return; }
    let ativo = true;
    setCarregando(true);
    getAtributosParaItem(value.familiaId, value.categoriaId)
      .then(r => { if (ativo) { setAtributos(ordenarPorPapel(r.atributos || [])); setErro(null); } })
      .catch(e => { if (ativo) { setAtributos([]); setErro(e.message); } })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [value.familiaId, value.categoriaId, versao]);

  useEffect(() => { onAtributos?.(value.familiaId || value.categoriaId ? atributos : []); }, [atributos, value.familiaId, value.categoriaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const familia = familias.find(f => f.id === value.familiaId) || null;
  const marcaDaFamilia = familia?.papelMarca === 'dna' && marcaReal(familia.nomeMarca) ? familia.nomeMarca : null;
  const categoriaEfetiva = familia ? familia.categoriaId : value.categoriaId;
  const editaveis = atributos.filter(a => !a.valorFixo);
  const obrigatorios = editaveis.filter(a => a.obrigatorio);
  const preenchendo = value.atributos !== null;
  const faltando = obrigatorios.filter(a => !preenchendo || valorVazio(value.atributos?.[a.atributoId]));

  const categoriaOptions = useMemo(() => categorias.map(c => ({ value: c.id, label: c.caminho })), [categorias]);

  // Família escolhida sem categoria: define aqui mesmo (os itens passam a herdar os atributos dela)
  const definirCategoria = async () => {
    if (!familia || !categoriaDaFamilia) return;
    setSalvandoCategoria(true);
    try {
      await definirCategoriaDaFamilia(familia.id, String(categoriaDaFamilia));
      message.success('Categoria da família definida.');
      setCategoriaDaFamilia(null);
      await recarregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao definir a categoria da família.');
    } finally {
      setSalvandoCategoria(false);
    }
  };

  const linkNovo = (texto: string, onClick: () => void, dica: string) => (
    <Tooltip title={dica}>
      <Button type="link" size="small" icon={<PlusOutlined />} onClick={onClick} style={{ padding: 0, height: 18, fontSize: 11 }}>{texto}</Button>
    </Tooltip>
  );

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {erro && <Alert type="error" showIcon message={erro} style={{ padding: '4px 8px' }} />}
      <Row gutter={8}>
        <Col span={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 11 }}>Família</Text>
            {linkNovo('nova família', () => setModalFamilia(true), 'Criar uma família com os atributos de grade, sem sair da entrada')}
          </div>
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Sem família (classificar depois)"
            style={{ width: '100%', marginTop: 2 }}
            value={value.familiaId ?? undefined}
            onChange={v => onChange({ ...value, familiaId: v ?? null, categoriaId: null, atributos: null })}
            options={familias.map(f => ({
              value: f.id,
              label: `${f.nome}${f.status !== 'ATIVO' ? ` (${STATUS_FAMILIA_CONFIG[f.status as keyof typeof STATUS_FAMILIA_CONFIG]?.label || f.status})` : ''}`,
            }))}
          />
        </Col>
        <Col span={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 11 }}>Categoria</Text>
            {!familia && linkNovo('nova categoria', () => setModalCategoria('item'), 'Criar uma categoria (item sem família herda os atributos dela)')}
          </div>
          <Tooltip title={familia ? 'A categoria vem da família (regra do PIM). Para mudar, mude a família.' : undefined}>
            <Select
              size="small"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Sem categoria"
              disabled={Boolean(familia)}
              style={{ width: '100%', marginTop: 2 }}
              value={categoriaEfetiva ?? undefined}
              onChange={v => onChange({ ...value, familiaId: null, categoriaId: v ?? null, atributos: null })}
              options={categoriaOptions}
            />
          </Tooltip>
        </Col>
      </Row>

      <div>
        <Text strong style={{ fontSize: 11 }}>Marca</Text>
        {marcaDaFamilia ? (
          <Tooltip title="Marca DNA da família: todos os itens dela recebem esta marca. Para mudar, ajuste a família no catálogo.">
            <Select size="small" disabled style={{ width: '100%', marginTop: 2 }} value={marcaDaFamilia} options={[{ value: marcaDaFamilia, label: `${marcaDaFamilia} (da família)` }]} />
          </Tooltip>
        ) : (
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Sem marca"
            style={{ width: '100%', marginTop: 2 }}
            value={value.marcaId ?? undefined}
            onChange={v => onChange({ ...value, marcaId: v ?? null })}
            searchValue={buscaMarca}
            onSearch={setBuscaMarca}
            options={marcas.map(m => ({ value: m.id, label: m.nome }))}
            notFoundContent={buscaMarca.trim() ? (
              <Button type="link" size="small" icon={<PlusOutlined />} loading={criandoMarca} onClick={criarMarca}>Criar marca "{buscaMarca.trim()}"</Button>
            ) : 'Nenhuma marca'}
          />
        )}
        {familia?.papelMarca === 'grade' && !value.marcaId && (
          <Text type="warning" style={{ fontSize: 11 }}>Nesta família a marca diferencia os itens: escolha a marca deste item.</Text>
        )}
      </div>

      {familia && !familia.categoriaId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 8px' }}>
          <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Família sem categoria:</Text>
          <Select
            size="small"
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder="escolher a categoria da família"
            style={{ flex: 1, minWidth: 0 }}
            value={categoriaDaFamilia ?? undefined}
            onChange={v => setCategoriaDaFamilia(v ?? null)}
            options={categoriaOptions}
          />
          <Button size="small" type="primary" disabled={!categoriaDaFamilia} loading={salvandoCategoria} onClick={definirCategoria}>Definir</Button>
          {linkNovo('nova', () => setModalCategoria('familia'), 'Criar uma categoria nova para esta família')}
        </div>
      )}

      {familia && familia.status !== 'ATIVO' && (
        <Text type="warning" style={{ fontSize: 11 }}>
          Família não está ativa: o item entra no estoque, mas só é publicado quando a família for ativada.
        </Text>
      )}

      {(value.familiaId || value.categoriaId) && (
        <Spin spinning={carregando} size="small">
          {atributos.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>Nenhum atributo herdado por esta {familia ? 'família' : 'categoria'}.</Text>
          ) : (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '6px 8px', background: '#fcfcfc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Space size={4} wrap>
                  <Text style={{ fontSize: 12 }}>{atributos.length} atributo(s)</Text>
                  {(['dna', 'grade', 'ficha'] as const).map(p => {
                    const n = atributos.filter(a => a.papel === p).length;
                    return n > 0 ? <Tooltip key={p} title={PAPEL_ATRIBUTO[p].ajuda}><Tag color={PAPEL_ATRIBUTO[p].color} style={{ fontSize: 10, margin: 0 }}>{n} {PAPEL_ATRIBUTO[p].label}</Tag></Tooltip> : null;
                  })}
                </Space>
                {editaveis.length > 0 && (
                  <Space size={6}>
                    <Text style={{ fontSize: 12 }}>Preencher valores agora</Text>
                    <Switch size="small" checked={preenchendo} onChange={on => onChange({ ...value, atributos: on ? (value.atributos || {}) : null })} />
                  </Space>
                )}
              </div>

              {preenchendo && lote && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                  Preencha os valores de cada item na tabela abaixo (atributos de grade costumam mudar de um item para outro).
                </Text>
              )}

              {preenchendo && !lote && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px', marginTop: 8 }}>
                  {atributos.map(a => (
                    <div key={a.atributoId}>
                      <Space size={4} style={{ marginBottom: 2 }}>
                        <Tag color={PAPEL_ATRIBUTO[a.papel]?.color} style={{ fontSize: 9, margin: 0, lineHeight: '14px', padding: '0 3px' }}>{PAPEL_ATRIBUTO[a.papel]?.label || a.papel}</Tag>
                        <Text style={{ fontSize: 11 }}>{a.nome}{a.obrigatorio && !a.valorFixo && <Text type="danger"> *</Text>}</Text>
                      </Space>
                      <CampoAtributo
                        atributo={a}
                        valor={value.atributos?.[a.atributoId] ?? null}
                        onChange={v => {
                          const proximo = { ...(value.atributos || {}) };
                          if (valorVazio(v)) delete proximo[a.atributoId];
                          else proximo[a.atributoId] = v;
                          onChange({ ...value, atributos: proximo });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {faltando.length > 0 && !lote && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 6, padding: '4px 8px', fontSize: 12 }}
                  message={`Sem ${faltando.map(a => a.nome).join(', ')}, o item entra no estoque mas fica FORA DO PDV.`}
                  description={<span style={{ fontSize: 11 }}>
                    {preenchendo ? 'Preencha acima' : 'Ligue "Preencher valores agora"'} ou resolva depois em Catálogo › Pendências do PIM.
                  </span>}
                />
              )}
              {lote && obrigatorios.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  Obrigatórios: {obrigatorios.map(a => a.nome).join(', ')}. Item sem eles entra no estoque mas fica fora do PDV até completar
                  {preenchendo ? '.' : ' (ligue "Preencher valores agora" ou resolva depois em Catálogo › Pendências do PIM).'}
                </Text>
              )}
            </div>
          )}
        </Spin>
      )}

      <ModalNovaFamilia
        open={modalFamilia}
        categorias={categorias}
        categoriaInicial={value.categoriaId}
        categoriaCriada={categoriaCriada}
        onFechar={() => setModalFamilia(false)}
        onNovaCategoria={() => setModalCategoria('familia')}
        onCriada={async id => {
          setModalFamilia(false);
          await recarregar();
          onChange({ ...value, familiaId: id, categoriaId: null, atributos: null });
        }}
      />
      <ModalNovaCategoria
        open={modalCategoria !== null}
        categorias={categorias}
        paiInicial={modalCategoria === 'item' ? value.categoriaId : (categoriaDaFamilia ?? null)}
        onFechar={() => setModalCategoria(null)}
        onCriada={async id => {
          const para = modalCategoria;
          setModalCategoria(null);
          await recarregar();
          if (para === 'item') onChange({ ...value, familiaId: null, categoriaId: id, atributos: null });
          else if (modalFamilia) setCategoriaCriada(id);
          else setCategoriaDaFamilia(id);
        }}
      />
    </Space>
  );
};

export default ClassificacaoPim;

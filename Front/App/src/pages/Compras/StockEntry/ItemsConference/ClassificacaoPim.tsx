// Classificação do item novo na entrada de NF: família (que já traz a categoria) ou só a categoria,
// e, se o operador quiser, os valores dos atributos que o item herda. Nada disso é obrigatório aqui:
// o que ficar vazio é completado depois no editor de catálogo (o item só não é publicado enquanto faltar obrigatório).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Row, Select, Space, Spin, Switch, Tag, Tooltip, Typography } from 'antd';
import { getCategorias, getFamilies } from '../../../Catalogo/pages/FamilyManager/FamilyManager.api';
import { STATUS_FAMILIA_CONFIG } from '../../../Catalogo/pages/FamilyManager/CatalogManager.types';
import type { AtributoFicha } from '../../../Catalogo/pages/CatalogSkus/CatalogSku.service';
import CampoAtributo, { PAPEL_ATRIBUTO, ordenarPorPapel, valorVazio } from '../../../Catalogo/pages/CatalogSkus/CampoAtributo';
import { getAtributosParaItem } from '../../api/comprasApi';

const { Text } = Typography;

export interface ClassificacaoItem {
  familiaId: number | null;
  categoriaId: number | null;
  // null = não preencher agora (fica para o editor de catálogo)
  atributos: Record<number, unknown> | null;
}

export const CLASSIFICACAO_VAZIA: ClassificacaoItem = { familiaId: null, categoriaId: null, atributos: null };

interface FamiliaOpcao { id: number; nome: string; status: string; categoriaId: number | null }
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
          familias: fams.map(f => ({ id: Number(f.id), nome: f.nome, status: f.status, categoriaId: Number(f.categoriaPai) || null })),
          categorias: cats.map(c => ({ id: Number(c.id), caminho: caminho(c.id) })).sort((a, b) => a.caminho.localeCompare(b.caminho)),
        };
      })
      .catch(err => { cacheCatalogo = null; throw err; });
  }
  return cacheCatalogo;
};

interface Props {
  value: ClassificacaoItem;
  onChange: (valor: ClassificacaoItem) => void;
  // Lote: os valores preenchidos valem para todos os itens selecionados
  lote?: boolean;
}

export const ClassificacaoPim: React.FC<Props> = ({ value, onChange, lote }) => {
  const [familias, setFamilias] = useState<FamiliaOpcao[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([]);
  const [atributos, setAtributos] = useState<AtributoFicha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarFamiliasECategorias()
      .then(r => { setFamilias(r.familias); setCategorias(r.categorias); })
      .catch(e => setErro(e.message || 'Erro ao carregar famílias e categorias.'));
  }, []);

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
  }, [value.familiaId, value.categoriaId]);

  const familia = familias.find(f => f.id === value.familiaId) || null;
  const categoriaEfetiva = familia ? familia.categoriaId : value.categoriaId;
  const editaveis = atributos.filter(a => !a.valorFixo);
  const obrigatorios = editaveis.filter(a => a.obrigatorio);
  const preenchendo = value.atributos !== null;
  const faltando = obrigatorios.filter(a => !preenchendo || valorVazio(value.atributos?.[a.atributoId]));

  const categoriaOptions = useMemo(() => categorias.map(c => ({ value: c.id, label: c.caminho })), [categorias]);

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {erro && <Alert type="error" showIcon message={erro} style={{ padding: '4px 8px' }} />}
      <Row gutter={8}>
        <Col span={12}>
          <Text strong style={{ fontSize: 11 }}>Família</Text>
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Sem família (classificar depois)"
            style={{ width: '100%', marginTop: 2 }}
            value={value.familiaId ?? undefined}
            onChange={v => onChange({ familiaId: v ?? null, categoriaId: null, atributos: null })}
            options={familias.map(f => ({
              value: f.id,
              label: `${f.nome}${f.status !== 'ATIVO' ? ` (${STATUS_FAMILIA_CONFIG[f.status as keyof typeof STATUS_FAMILIA_CONFIG]?.label || f.status})` : ''}`,
            }))}
          />
        </Col>
        <Col span={12}>
          <Text strong style={{ fontSize: 11 }}>Categoria</Text>
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
              onChange={v => onChange({ familiaId: null, categoriaId: v ?? null, atributos: null })}
              options={categoriaOptions}
            />
          </Tooltip>
        </Col>
      </Row>

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

              {preenchendo && (
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

              {faltando.length > 0 && (
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
              {lote && preenchendo && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  Os valores preenchidos valem para todos os itens selecionados; campos vazios não alteram o que cada item já tem.
                </Text>
              )}
            </div>
          )}
        </Spin>
      )}
    </Space>
  );
};

export default ClassificacaoPim;

// Ações em lote da conferência: cadastro rápido de itens novos e classificação (família/categoria/atributos).
// Os valores de atributos são preenchidos item a item numa tabela (grade costuma mudar de um item para outro).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { ThunderboltFilled, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { ClassificacaoPim, ClassificacaoItem, CLASSIFICACAO_VAZIA } from './ClassificacaoPim';
import { foraDaVenda, linhaItemNovo, linhaSemVinculo } from '../edicaoLote';
import { getTipoRecursoConfig } from '../tipoRecurso';
import type { AtributoFicha } from '../../../Catalogo/pages/CatalogSkus/CatalogSku.service';
import CampoAtributo, { PAPEL_ATRIBUTO, valorVazio } from '../../../Catalogo/pages/CatalogSkus/CampoAtributo';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type ValoresPorItem = Record<string, Record<number, unknown>>;

// ---------------------------------------------------------------- valores de atributos por item

/** Estado da tabela: atributos da família/categoria escolhida e os valores de cada linha. */
const useAtributosPorItem = (itens: any[], classificacao: ClassificacaoItem) => {
  const [atributos, setAtributos] = useState<AtributoFicha[]>([]);
  const [valores, setValores] = useState<ValoresPorItem>({});
  // Só reinicia quando mudam as linhas (não quando a lista é recriada com os mesmos itens)
  const chaveItens = itens.map(i => String(i.tempId)).join(',');

  // Trocou família/categoria: cada linha começa com o que já tinha, se for a mesma classificação
  useEffect(() => {
    const inicio: ValoresPorItem = {};
    for (const i of itens) {
      const d = i.mapeamento?.draftIdentity;
      const mesma = d && (d.familia_id ?? null) === classificacao.familiaId
        && (classificacao.familiaId ? true : (d.categoria_id ?? null) === classificacao.categoriaId);
      inicio[String(i.tempId)] = mesma && d.atributos ? { ...d.atributos } : {};
    }
    setValores(inicio);
  }, [classificacao.familiaId, classificacao.categoriaId, chaveItens]); // eslint-disable-line react-hooks/exhaustive-deps

  const definir = (tempId: string, atributoId: number, valor: unknown) => setValores(atual => {
    const linha = { ...(atual[tempId] || {}) };
    if (valorVazio(valor)) delete linha[atributoId]; else linha[atributoId] = valor;
    return { ...atual, [tempId]: linha };
  });

  // Copia o valor da primeira linha para todas
  const copiarPrimeiro = (atributoId: number) => setValores(atual => {
    const primeiro = itens.length ? atual[String(itens[0].tempId)]?.[atributoId] : undefined;
    if (valorVazio(primeiro)) return atual;
    const proximo: ValoresPorItem = {};
    for (const i of itens) proximo[String(i.tempId)] = { ...(atual[String(i.tempId)] || {}), [atributoId]: primeiro };
    return proximo;
  });

  const editaveis = atributos.filter(a => !a.valorFixo);
  const faltandoNa = (tempId: string) => editaveis.filter(a => a.obrigatorio && valorVazio(valores[tempId]?.[a.atributoId]));
  return { atributos, setAtributos, editaveis, valores, definir, copiarPrimeiro, faltandoNa };
};

const TabelaAtributos: React.FC<{ itens: any[]; estado: ReturnType<typeof useAtributosPorItem> }> = ({ itens, estado }) => {
  const { editaveis, valores, definir, copiarPrimeiro, faltandoNa } = estado;
  if (editaveis.length === 0) return null;
  const semObrigatorio = itens.filter(i => faltandoNa(String(i.tempId)).length > 0).length;
  return (
    <div>
      <Table
        size="small"
        rowKey={r => String(r.tempId)}
        dataSource={itens}
        pagination={false}
        scroll={{ x: 260 + editaveis.length * 170, y: 360 }}
        columns={[
          {
            title: 'Item', key: 'item', fixed: 'left' as const, width: 240,
            render: (_: unknown, r: any) => (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 225 }} title={r.descricao}>{r.descricao}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>Cód. {r.sku || '-'}</Text>
              </div>
            ),
          },
          ...editaveis.map(a => ({
            key: `a${a.atributoId}`,
            width: 170,
            title: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                <Space size={3}>
                  <Tag color={PAPEL_ATRIBUTO[a.papel]?.color} style={{ fontSize: 9, margin: 0, padding: '0 3px', lineHeight: '14px' }}>{PAPEL_ATRIBUTO[a.papel]?.label || a.papel}</Tag>
                  <span style={{ fontSize: 12 }}>{a.nome}{a.obrigatorio && <Text type="danger"> *</Text>}</span>
                </Space>
                {itens.length > 1 && (
                  <Tooltip title="Copiar o valor da primeira linha para todas">
                    <Button size="small" type="text" icon={<VerticalAlignBottomOutlined />} onClick={() => copiarPrimeiro(a.atributoId)} />
                  </Tooltip>
                )}
              </div>
            ),
            render: (_: unknown, r: any) => (
              <CampoAtributo atributo={a} valor={valores[String(r.tempId)]?.[a.atributoId] ?? null} onChange={v => definir(String(r.tempId), a.atributoId, v)} />
            ),
          })),
          {
            title: '', key: 'falta', width: 90, fixed: 'right' as const,
            render: (_: unknown, r: any) => {
              const faltam = faltandoNa(String(r.tempId));
              return faltam.length === 0 ? <Tag color="green" style={{ margin: 0 }}>ok</Tag>
                : <Tooltip title={`Faltam: ${faltam.map(f => f.nome).join(', ')}`}><Tag color="orange" style={{ margin: 0 }}>falta {faltam.length}</Tag></Tooltip>;
            },
          },
        ]}
      />
      {semObrigatorio > 0 && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {semObrigatorio} item(ns) sem todos os obrigatórios: entram no estoque mas ficam fora do PDV até completar (Catálogo › Pendências do PIM).
        </Text>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- Cadastro rápido

interface CadastroRapidoProps {
  open: boolean;
  itens: any[];          // linhas selecionadas
  // Vindo do "Classificar": já abre com a família/categoria escolhida lá
  classificacaoInicial?: ClassificacaoItem | null;
  onClose: () => void;
  onConfirmar: (linhas: any[], opcoes: { markup: number; classificacao: ClassificacaoItem; porItem: ValoresPorItem | null }) => void;
}

/**
 * Linhas sem vínculo viram itens novos com os dados da nota: nome, código do fornecedor como SKU,
 * unidade da nota como unidade base e preço de varejo = custo x markup. Consumo/patrimônio entram sem preço.
 * Tudo continua editável: pelo "Vincular" da linha antes de aprovar, ou no editor de catálogo depois.
 */
export const ModalCadastroRapido: React.FC<CadastroRapidoProps> = ({ open, itens, classificacaoInicial, onClose, onConfirmar }) => {
  const [markup, setMarkup] = useState(1.8);
  const [classificacao, setClassificacao] = useState<ClassificacaoItem>(CLASSIFICACAO_VAZIA);
  useEffect(() => { if (open) { setMarkup(1.8); setClassificacao(classificacaoInicial || CLASSIFICACAO_VAZIA); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const livres = useMemo(() => itens.filter(linhaSemVinculo), [itens]);
  const ignoradas = itens.length - livres.length;
  const estado = useAtributosPorItem(livres, classificacao);
  const porItem = classificacao.atributos !== null && estado.editaveis.length > 0;

  return (
    <Modal
      open={open}
      title={`Cadastro rápido: ${livres.length} item(ns) novo(s)`}
      width={porItem ? 1150 : 860}
      onCancel={onClose}
      okText="Cadastrar como itens novos"
      okButtonProps={{ disabled: livres.length === 0 || !(markup > 0) }}
      onOk={() => onConfirmar(livres, { markup, classificacao, porItem: porItem ? estado.valores : null })}
      destroyOnClose
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {livres.length === 0 && <Alert type="warning" showIcon message="Nenhuma das linhas selecionadas está sem vínculo: não há o que cadastrar." />}
        {ignoradas > 0 && livres.length > 0 && (
          <Alert type="info" showIcon message={`${ignoradas} linha(s) já vinculada(s) ou mapeada(s) ficam como estão.`} />
        )}
        <Space align="center">
          <Text>Markup de varejo:</Text>
          <InputNumber min={0.01} step={0.1} precision={2} value={markup} onChange={v => setMarkup(Number(v) || 0)} addonAfter="×" style={{ width: 130 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>preço = custo final da nota × markup (atacado e embalagens ficam para o editor)</Text>
        </Space>

        <div style={{ padding: '8px 10px', background: '#f6f8ff', border: '1px solid #adc6ff', borderRadius: 6 }}>
          <Text strong style={{ fontSize: 11, color: '#1d39c4', display: 'block', marginBottom: 4 }}>Classificação para todos (opcional)</Text>
          <ClassificacaoPim value={classificacao} onChange={setClassificacao} lote onAtributos={estado.setAtributos} />
        </div>

        {porItem ? <TabelaAtributos itens={livres} estado={estado} /> : (
          <Table
            size="small"
            rowKey={r => String(r.tempId)}
            dataSource={livres}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            columns={[
              {
                title: 'Item da nota', key: 'desc',
                render: (_: unknown, r: any) => (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.descricao}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                      SKU Customizado: {foraDaVenda(r.tipoRecurso) || !r.sku ? 'sequência gerada na aprovação' : r.sku}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Tipo', key: 'tipo', width: 110,
                render: (_: unknown, r: any) => {
                  const t = getTipoRecursoConfig(r.tipoRecurso);
                  return <Tag color={t.color}>{t.short}</Tag>;
                },
              },
              { title: 'Custo', key: 'custo', width: 110, align: 'right' as const, render: (_: unknown, r: any) => `${brl(r.valorUnitario)} /${r.unidade || 'UN'}` },
              {
                title: 'Preço varejo', key: 'preco', width: 120, align: 'right' as const,
                render: (_: unknown, r: any) => (foraDaVenda(r.tipoRecurso)
                  ? <Text type="secondary" style={{ fontSize: 11 }}>fora da venda</Text>
                  : <b style={{ color: '#3f8600' }}>{brl((Number(r.valorUnitario) || 0) * markup)}</b>),
              },
            ]}
          />
        )}
      </Space>
    </Modal>
  );
};

// ---------------------------------------------------------------- Classificar

interface ClassificarProps {
  open: boolean;
  itens: any[];
  // Edição de uma linha: abre com a classificação atual dela
  inicial?: ClassificacaoItem | null;
  onClose: () => void;
  onConfirmar: (linhas: any[], classificacao: ClassificacaoItem, porItem: ValoresPorItem | null) => void;
  // Linhas sem vínculo: leva ao cadastro rápido já com a família/categoria escolhida
  onCadastroRapido?: (classificacao: ClassificacaoItem) => void;
}

// Família/categoria (e valores de atributos por item, se quiser) nos itens novos selecionados
export const ModalClassificarLote: React.FC<ClassificarProps> = ({ open, itens, inicial, onClose, onConfirmar, onCadastroRapido }) => {
  const [classificacao, setClassificacao] = useState<ClassificacaoItem>(CLASSIFICACAO_VAZIA);
  useEffect(() => { if (open) setClassificacao(inicial || CLASSIFICACAO_VAZIA); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const novos = useMemo(() => itens.filter(linhaItemNovo), [itens]);
  const vinculados = itens.filter(i => !linhaItemNovo(i) && !linhaSemVinculo(i)).length;
  const semVinculo = itens.filter(linhaSemVinculo).length;
  const lote = !inicial;
  const estado = useAtributosPorItem(novos, classificacao);
  const porItem = lote && classificacao.atributos !== null && estado.editaveis.length > 0;
  const temClassificacao = Boolean(classificacao.familiaId || classificacao.categoriaId);

  // Por que o Aplicar está travado (em vez de só ficar desabilitado sem explicação)
  const motivo = novos.length === 0
    ? 'Nenhuma das linhas selecionadas é item novo.'
    : !temClassificacao ? 'Escolha uma família ou uma categoria.' : null;

  return (
    <Modal
      open={open}
      title={inicial && novos.length === 1 ? `Classificar: ${novos[0].descricao || 'item novo'}` : `Classificar ${novos.length} item(ns) novo(s)`}
      width={porItem ? 1150 : 720}
      onCancel={onClose}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{motivo}</Text>
          <Space>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" disabled={Boolean(motivo)} onClick={() => onConfirmar(novos, classificacao, porItem ? estado.valores : null)}>Aplicar</Button>
          </Space>
        </div>
      }
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {novos.length === 0 && semVinculo > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${semVinculo} linha(s) ainda sem vínculo`}
            description="A classificação vale para itens novos. Primeiro transforme as linhas em itens novos (Cadastro rápido), já com esta família/categoria."
            action={onCadastroRapido && (
              <Button size="small" type="primary" icon={<ThunderboltFilled />} onClick={() => onCadastroRapido(classificacao)}>
                Cadastro rápido destas linhas
              </Button>
            )}
          />
        )}
        {(vinculados > 0 || (semVinculo > 0 && novos.length > 0)) && (
          <Alert
            type="info"
            showIcon
            message="Só itens novos são classificados aqui"
            description={
              <>
                {vinculados > 0 && <div>{vinculados} linha(s) vinculada(s) a item já cadastrado: a classificação dele é feita no editor de catálogo.</div>}
                {semVinculo > 0 && novos.length > 0 && <div>{semVinculo} linha(s) sem vínculo ficam de fora: use "Cadastro rápido" (que já classifica) ou "Vincular".</div>}
              </>
            }
          />
        )}
        <ClassificacaoPim value={classificacao} onChange={setClassificacao} lote={lote} onAtributos={estado.setAtributos} />
        {porItem && <TabelaAtributos itens={novos} estado={estado} />}
      </Space>
    </Modal>
  );
};

// Ações em lote da conferência: cadastro rápido de itens novos e classificação (família/categoria/atributos).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, InputNumber, Modal, Space, Table, Tag, Typography } from 'antd';
import { ClassificacaoPim, ClassificacaoItem, CLASSIFICACAO_VAZIA } from './ClassificacaoPim';
import { foraDaVenda, linhaItemNovo, linhaSemVinculo } from '../edicaoLote';
import { getTipoRecursoConfig } from '../tipoRecurso';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CadastroRapidoProps {
  open: boolean;
  itens: any[];          // linhas selecionadas
  onClose: () => void;
  onConfirmar: (linhas: any[], opcoes: { markup: number; classificacao: ClassificacaoItem }) => void;
}

/**
 * Linhas sem vínculo viram itens novos com os dados da nota: nome, código do fornecedor como SKU,
 * unidade da nota como unidade base e preço de varejo = custo x markup. Consumo/patrimônio entram sem preço.
 * Tudo continua editável: pelo "Vincular" da linha antes de aprovar, ou no editor de catálogo depois.
 */
export const ModalCadastroRapido: React.FC<CadastroRapidoProps> = ({ open, itens, onClose, onConfirmar }) => {
  const [markup, setMarkup] = useState(1.8);
  const [classificacao, setClassificacao] = useState<ClassificacaoItem>(CLASSIFICACAO_VAZIA);
  useEffect(() => { if (open) { setMarkup(1.8); setClassificacao(CLASSIFICACAO_VAZIA); } }, [open]);

  const livres = useMemo(() => itens.filter(linhaSemVinculo), [itens]);
  const ignoradas = itens.length - livres.length;

  return (
    <Modal
      open={open}
      title={`Cadastro rápido: ${livres.length} item(ns) novo(s)`}
      width={860}
      onCancel={onClose}
      okText="Cadastrar como itens novos"
      okButtonProps={{ disabled: livres.length === 0 || !(markup > 0) }}
      onOk={() => onConfirmar(livres, { markup, classificacao })}
      destroyOnClose
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {ignoradas > 0 && (
          <Alert type="info" showIcon message={`${ignoradas} linha(s) já vinculada(s) ou mapeada(s) ficam como estão.`} />
        )}
        <Space align="center">
          <Text>Markup de varejo:</Text>
          <InputNumber min={0.01} step={0.1} precision={2} value={markup} onChange={v => setMarkup(Number(v) || 0)} addonAfter="×" style={{ width: 130 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>preço = custo final da nota × markup (atacado e embalagens ficam para o editor)</Text>
        </Space>

        <div style={{ padding: '8px 10px', background: '#f6f8ff', border: '1px solid #adc6ff', borderRadius: 6 }}>
          <Text strong style={{ fontSize: 11, color: '#1d39c4', display: 'block', marginBottom: 4 }}>Classificação para todos (opcional)</Text>
          <ClassificacaoPim value={classificacao} onChange={setClassificacao} lote />
        </div>

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
      </Space>
    </Modal>
  );
};

interface ClassificarProps {
  open: boolean;
  itens: any[];
  // Edição de uma linha: abre com a classificação atual dela
  inicial?: ClassificacaoItem | null;
  onClose: () => void;
  onConfirmar: (linhas: any[], classificacao: ClassificacaoItem) => void;
}

// Família/categoria (e valores de atributos, se quiser) nos itens novos selecionados
export const ModalClassificarLote: React.FC<ClassificarProps> = ({ open, itens, inicial, onClose, onConfirmar }) => {
  const [classificacao, setClassificacao] = useState<ClassificacaoItem>(CLASSIFICACAO_VAZIA);
  useEffect(() => { if (open) setClassificacao(inicial || CLASSIFICACAO_VAZIA); }, [open]);

  const novos = useMemo(() => itens.filter(linhaItemNovo), [itens]);
  const vinculados = itens.filter(i => !linhaItemNovo(i) && !linhaSemVinculo(i)).length;
  const semVinculo = itens.filter(linhaSemVinculo).length;

  return (
    <Modal
      open={open}
      title={inicial && novos.length === 1 ? `Classificar: ${novos[0].descricao || 'item novo'}` : `Classificar ${novos.length} item(ns) novo(s)`}
      width={720}
      onCancel={onClose}
      okText="Aplicar"
      okButtonProps={{ disabled: novos.length === 0 || (!classificacao.familiaId && !classificacao.categoriaId) }}
      onOk={() => onConfirmar(novos, classificacao)}
      destroyOnClose
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {(vinculados > 0 || semVinculo > 0) && (
          <Alert
            type="info"
            showIcon
            message="Só itens novos são classificados aqui"
            description={
              <>
                {vinculados > 0 && <div>{vinculados} linha(s) vinculada(s) a item já cadastrado: a classificação dele é feita no editor de catálogo.</div>}
                {semVinculo > 0 && <div>{semVinculo} linha(s) sem vínculo: use "Cadastro rápido" (que já classifica) ou "Vincular".</div>}
              </>
            }
          />
        )}
        <ClassificacaoPim value={classificacao} onChange={setClassificacao} lote={!inicial} />
      </Space>
    </Modal>
  );
};

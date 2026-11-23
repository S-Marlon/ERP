// Equivalente no balcão: "sem Ebara: tem Tetis". Etiqueta na linha do carrinho que está sem estoque (aparece só quando
// existe equivalente com estoque) e janela com os equivalentes para trocar a linha ou acrescentar.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, Flex, List, Modal, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { EnvironmentOutlined, SwapOutlined, PlusOutlined } from '@ant-design/icons';
import { TagMarca } from '../../../../shared/components/TagMarca';
import { buscarEquivalentes, comEstoque, ProdutoEquivalente, RespostaEquivalentes } from '../services/equivalentesPdvApi';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Equivalentes do item (só consulta com `ativo`). */
export const useEquivalentes = (idItem: number | null, ativo = true) => {
  const [resposta, setResposta] = useState<RespostaEquivalentes | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!idItem || !ativo) { setResposta(null); return; }
    let vivo = true;
    setCarregando(true); setErro(null);
    buscarEquivalentes(idItem)
      .then(r => { if (vivo) setResposta(r); })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao buscar equivalentes.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [idItem, ativo]);
  return { resposta, carregando, erro };
};

/** Etiqueta da linha sem estoque: só aparece quando há equivalente com estoque ("Tem equivalente: TETIS (7)"). */
export const TagEquivalente: React.FC<{ idItem: number; onAbrir: () => void }> = ({ idItem, onAbrir }) => {
  const { resposta } = useEquivalentes(idItem);
  const disponiveis = comEstoque(resposta?.data || []);
  if (!disponiveis.length) return null;
  const primeiro = disponiveis[0];
  return (
    <Tooltip title={`Serve para a mesma coisa (${resposta?.criterio || 'mesmos atributos'}). Clique para ver e trocar.`}>
      <Tag color="cyan" icon={<SwapOutlined />} style={{ margin: 0, cursor: 'pointer' }} onClick={onAbrir}>
        Tem equivalente: {primeiro.brand || primeiro.name.slice(0, 20)} ({qtd(primeiro.currentStock)}){disponiveis.length > 1 ? ` +${disponiveis.length - 1}` : ''}
      </Tag>
    </Tooltip>
  );
};

interface PropsModal {
  /** Item pedido (o que está sem estoque). */
  alvo: { idItem: number; nome: string; quantidade?: number; unidade?: string } | null;
  onFechar: () => void;
  /** `trocar`: substitui a linha do carrinho; senão acrescenta. Sem `podeTrocar`, só acrescenta. */
  onEscolher: (p: ProdutoEquivalente, trocar: boolean) => void;
  podeTrocar?: boolean;
}

const MOTIVOS: Record<string, string> = {
  SEM_CATEGORIA: 'O item não tem categoria: sem ela não dá para achar equivalentes.',
  SEM_ATRIBUTO: 'O item não tem os atributos que definem equivalência (ex.: potência, código do rolamento). Preencha no cadastro.',
  SEM_EQUIVALENTE: 'Nenhum outro item da categoria tem os mesmos atributos.',
};

export const EquivalentesModal: React.FC<PropsModal> = ({ alvo, onFechar, onEscolher, podeTrocar }) => {
  const { resposta, carregando, erro } = useEquivalentes(alvo?.idItem ?? null, !!alvo);
  const lista = resposta?.data || [];
  return (
    <Modal open={!!alvo} onCancel={onFechar} footer={null} width={640} destroyOnHidden
      title={<Space direction="vertical" size={0}><span>Equivalentes</span>
        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{alvo?.nome}{resposta?.criterio ? ` · ${resposta.criterio}` : ''}</Typography.Text></Space>}>
      {erro && <Alert type="error" showIcon message={erro} />}
      <Spin spinning={carregando}>
        {!carregando && !erro && lista.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={MOTIVOS[resposta?.motivo || 'SEM_EQUIVALENTE'] || 'Sem equivalentes.'} />
        ) : (
          <List
            size="small"
            dataSource={lista}
            renderItem={p => {
              const tem = Number(p.currentStock) > 0 || p.podeVenderSemEstoque;
              return (
                <List.Item
                  style={{ opacity: tem ? 1 : 0.55 }}
                  actions={[
                    podeTrocar && <Button key="t" size="small" type="primary" icon={<SwapOutlined />} disabled={!tem} onClick={() => onEscolher(p, true)}>Trocar</Button>,
                    <Button key="a" size="small" icon={<PlusOutlined />} disabled={!tem} onClick={() => onEscolher(p, false)}>{podeTrocar ? 'Acrescentar' : 'Adicionar'}</Button>,
                  ].filter(Boolean)}>
                  <List.Item.Meta
                    title={<Flex gap={6} wrap align="center"><span>{p.name}</span><TagMarca marca={p.brand} />
                      {p.decisaoCompra === 'NAO_RECOMPRAR' && tem && <Tooltip title="A loja decidiu não recomprar: vender este primeiro libera o estoque parado"><Tag color="volcano" style={{ margin: 0 }}>Priorizar (escoar)</Tag></Tooltip>}
                      {p.decisaoCompra === 'PREFERIDO' && <Tag color="green" style={{ margin: 0 }}>Preferido</Tag>}
                    </Flex>}
                    description={<Space size={10} wrap>
                      <Typography.Text strong>{money.format(Number(p.salePrice) || 0)}<Typography.Text type="secondary" style={{ fontSize: 11 }}> /{p.unitOfMeasure || 'un'}</Typography.Text></Typography.Text>
                      <Typography.Text type={tem ? undefined : 'danger'}>Estoque: {qtd(p.currentStock)} {p.unitOfMeasure}</Typography.Text>
                      {p.location && <Tag icon={<EnvironmentOutlined />} style={{ margin: 0 }}>{p.location}</Tag>}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>{p.sku}</Typography.Text>
                    </Space>}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Spin>
      {podeTrocar && alvo?.quantidade ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Trocar mantém a quantidade da linha ({qtd(alvo.quantidade)} {alvo.unidade || ''}) no item escolhido.</Typography.Text>
      ) : null}
    </Modal>
  );
};

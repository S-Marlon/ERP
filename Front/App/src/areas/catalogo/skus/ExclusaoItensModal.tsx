// Exclusão definitiva de itens sem histórico (itens de teste): confere antes, mostra quem sai e quem fica (e por quê).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Flex, List, Modal, Spin, Tag, Typography, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';

interface ItemConferido { idItem: number; sku: string; nome: string; podeApagar: boolean; motivos: string[] }

const chamar = async <T,>(rota: string, ids: number[]): Promise<T> => {
  const r = await fetch(`${API_URL}/api/catalogo/itens/${rota}?tenant_id=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao apagar os itens.');
  return d as T;
};

interface Props {
  ids: number[];
  onFechar: () => void;
  /** Itens apagados (para tirar das listas e recarregar a tela) */
  onApagados: (ids: number[]) => void;
}

export const ExclusaoItensModal: React.FC<Props> = ({ ids, onFechar, onApagados }) => {
  const [itens, setItens] = useState<ItemConferido[] | null>(null);
  const [entendi, setEntendi] = useState(false);
  const [apagando, setApagando] = useState(false);
  const aberto = ids.length > 0;

  useEffect(() => {
    if (!aberto) return;
    setItens(null);
    setEntendi(false);
    chamar<{ itens: ItemConferido[] }>('exclusao/conferir', ids)
      .then(d => setItens(d.itens))
      .catch(e => { message.error(e.message); onFechar(); });
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const livres = (itens || []).filter(i => i.podeApagar);
  const presos = (itens || []).filter(i => !i.podeApagar);

  const apagar = async () => {
    setApagando(true);
    try {
      const r = await chamar<{ apagados: ItemConferido[]; bloqueados: ItemConferido[] }>('exclusao', livres.map(i => i.idItem));
      message.success(`${r.apagados.length} item(ns) apagado(s).${r.bloqueados.length ? ` ${r.bloqueados.length} ganharam histórico no meio do caminho e ficaram.` : ''}`);
      onApagados(r.apagados.map(i => i.idItem));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao apagar.');
    } finally {
      setApagando(false);
    }
  };

  return (
    <Modal open={aberto} onCancel={onFechar} width={720} title="Apagar itens" destroyOnHidden
      footer={(
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Checkbox checked={entendi} disabled={!livres.length} onChange={e => setEntendi(e.target.checked)}>
            Entendi: os itens somem do sistema e não dá para desfazer
          </Checkbox>
          <Flex gap={8}>
            <Button onClick={onFechar}>Cancelar</Button>
            <Button danger type="primary" icon={<DeleteOutlined />} disabled={!entendi || !livres.length} loading={apagando} onClick={apagar}>
              Apagar {livres.length} item(ns)
            </Button>
          </Flex>
        </Flex>
      )}>
      {!itens ? <Flex justify="center" style={{ padding: 32 }}><Spin /></Flex> : (
        <Flex vertical gap={12}>
          <Alert type="info" showIcon
            title="Só itens sem histórico podem ser apagados"
            description="Com nota de entrada, movimento ou saldo de estoque, venda/orçamento, devolução ou OS, o item fica (o histórico depende dele). Para tirar da frente sem apagar, inative o item no cadastro." />
          <div>
            <Typography.Text strong>Vão ser apagados ({livres.length})</Typography.Text>
            {livres.length === 0
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum dos itens marcados pode ser apagado" />
              : (
                <List size="small" bordered style={{ maxHeight: 220, overflow: 'auto', marginTop: 4 }} dataSource={livres}
                  renderItem={i => <List.Item><span><Tag style={{ margin: 0 }}>{i.sku}</Tag> {i.nome}</span></List.Item>} />
              )}
          </div>
          {presos.length > 0 && (
            <div>
              <Typography.Text strong>Ficam, porque têm histórico ({presos.length})</Typography.Text>
              <List size="small" bordered style={{ maxHeight: 200, overflow: 'auto', marginTop: 4 }} dataSource={presos}
                renderItem={i => (
                  <List.Item>
                    <Flex vertical>
                      <span><Tag style={{ margin: 0 }}>{i.sku}</Tag> {i.nome}</span>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{i.motivos.join(' · ')}</Typography.Text>
                    </Flex>
                  </List.Item>
                )} />
            </div>
          )}
        </Flex>
      )}
    </Modal>
  );
};

export default ExclusaoItensModal;

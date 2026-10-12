// Junção de itens duplicados (o mesmo produto cadastrado mais de uma vez): reutilizável em qualquer tela.
// Escolhe o item que fica e junta cada outro nele: estoque, vínculos de fornecedor e códigos de barras vão junto,
// o duplicado é inativado e o histórico (vendas, notas) continua nele. Sempre com simulação antes de gravar.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, InputNumber, Modal, Radio, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { MergeCellsOutlined } from '@ant-design/icons';
import { getTipoRecursoConfig } from '../../compras/entradaNf/tipoRecurso';
import { getItensParaJuntar, ItemSuspeito, ResultadoUnificacao, unificarItens } from './duplicadosApi';

const { Text } = Typography;
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

export /** Itens com a escolha de qual fica e o botão de juntar cada outro nele. */
const TabelaJuntar: React.FC<{
  itens: ItemSuspeito[];
  idFica: number | undefined;
  onFica: (idItem: number) => void;
  onJuntar: (par: { origem: ItemSuspeito; destino: ItemSuspeito }) => void;
}> = ({ itens, idFica, onFica, onJuntar }) => {
  const destino = itens.find(i => i.idItem === idFica);
  return (
    <Table<ItemSuspeito>
      size="small"
      rowKey="idItem"
      pagination={false}
      dataSource={itens}
      columns={[
        {
          title: 'Fica', key: 'fica', width: 60, align: 'center' as const,
          render: (_, i) => <Radio checked={i.idItem === idFica} disabled={i.status === 'INATIVO'} onChange={() => onFica(i.idItem)} />,
        },
        {
          title: 'Item', key: 'item',
          render: (_, i) => (
            <div>
              <div style={{ fontWeight: 600 }}>{i.nome}</div>
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>
                <Tag color={getTipoRecursoConfig(i.tipoRecurso).color} style={{ margin: 0, fontSize: 10 }}>{getTipoRecursoConfig(i.tipoRecurso).short}</Tag>
              </Space>
            </div>
          ),
        },
        { title: 'Família', dataIndex: 'familia', width: 160, render: (v: string | null) => v || <Text type="secondary">—</Text> },
        { title: 'Unidade', dataIndex: 'unidadeBase', width: 80, render: (v: string | null) => v || '—' },
        { title: 'Saldo', dataIndex: 'saldo', width: 90, align: 'right' as const, render: (v: number) => qtd(v) },
        { title: 'Movimentos', dataIndex: 'movimentos', width: 100, align: 'right' as const },
        {
          title: '', key: 'acao', width: 150,
          render: (_, i) => {
            if (i.status === 'INATIVO') return <Tag style={{ margin: 0 }}>já juntado / inativo</Tag>;
            if (i.idItem === idFica) return <Tag color="green" style={{ margin: 0 }}>item que fica</Tag>;
            return (
              <Button size="small" icon={<MergeCellsOutlined />} disabled={!destino} onClick={() => destino && onJuntar({ origem: i, destino })}>
                Juntar no que fica
              </Button>
            );
          },
        },
      ]}
    />
  );
};

export const ModalUnificar: React.FC<{ origem: ItemSuspeito; destino: ItemSuspeito; onClose: () => void; onConcluido: () => void }> = ({ origem, destino, onClose, onConcluido }) => {
  const [fator, setFator] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [simulacao, setSimulacao] = useState<ResultadoUnificacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  useEffect(() => { setSimulacao(null); setErro(null); }, [fator]);

  const unidadesDiferentes = (origem.unidadeBase || '') !== (destino.unidadeBase || '');
  const executar = async (simular: boolean) => {
    setProcessando(true);
    setErro(null);
    try {
      const r = await unificarItens({ idOrigem: origem.idItem, idDestino: destino.idItem, fator, motivo, simular });
      if (simular) setSimulacao(r);
      else { message.success(r.message); onConcluido(); }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Modal
      open
      width={760}
      title={<Space><MergeCellsOutlined /> Juntar {origem.sku} em {destino.sku}</Space>}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button disabled={!(fator > 0)} loading={processando && !simulacao} onClick={() => executar(true)}>Simular</Button>
          <Button type="primary" danger disabled={!simulacao || motivo.trim().length < 3} loading={processando && Boolean(simulacao)} onClick={() => executar(false)}>
            Confirmar e inativar {origem.sku}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[{ rotulo: 'Duplicado (será inativado)', i: origem, cor: '#fff1f0' }, { rotulo: 'Item que fica', i: destino, cor: '#f6ffed' }].map(x => (
            <div key={x.rotulo} style={{ flex: 1, background: x.cor, border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{x.rotulo}</Text>
              <div style={{ fontWeight: 600 }}>{x.i.sku}</div>
              <div style={{ fontSize: 12 }}>{x.i.nome}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>Saldo {qtd(x.i.saldo)} {x.i.unidadeBase || ''} · {x.i.movimentos} movimento(s)</Text>
            </div>
          ))}
        </div>

        <Space align="center" wrap>
          <Text strong style={{ fontSize: 12 }}>Conversão:</Text>
          <Text>1 {origem.unidadeBase || 'un'} de {origem.sku} =</Text>
          <InputNumber min={0.000001} value={fator} onChange={v => setFator(Number(v) || 0)} style={{ width: 100 }} />
          <Text>{destino.unidadeBase || 'un'} de {destino.sku}</Text>
        </Space>
        {unidadesDiferentes && (
          <Alert type="warning" showIcon message={`Unidades diferentes (${origem.unidadeBase || '?'} × ${destino.unidadeBase || '?'}): confira o fator antes de juntar.`} />
        )}

        <Input.TextArea rows={2} placeholder="Motivo (obrigatório para confirmar)" value={motivo} onChange={e => setMotivo(e.target.value)} />
        {erro && <Alert type="error" showIcon message={erro} />}

        {simulacao && (
          <div>
            <Text strong style={{ fontSize: 12 }}>O que vai acontecer</Text>
            {simulacao.movimentos.length === 0 ? (
              <div style={{ fontSize: 12, marginTop: 4 }}>Sem estoque para passar.</div>
            ) : (
              <Table
                size="small"
                pagination={false}
                rowKey={(m, i) => `${m.tipo}-${m.deposito}-${i}`}
                dataSource={simulacao.movimentos}
                style={{ marginTop: 4 }}
                columns={[
                  { title: 'Movimento', key: 't', width: 110, render: (_, m) => <Tag color={m.tipo === 'ENTRADA' ? 'green' : 'red'}>{m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</Tag> },
                  { title: 'Item', dataIndex: 'sku' },
                  { title: 'Depósito', dataIndex: 'deposito', width: 120 },
                  { title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_, m) => qtd(m.quantidade) },
                  { title: 'Saldo', key: 's', width: 120, align: 'right' as const, render: (_, m) => `${qtd(m.saldoAnterior)} → ${qtd(m.saldoPosterior)}` },
                  { title: 'Custo médio', key: 'c', width: 110, align: 'right' as const, render: (_, m) => money(m.custoMedio) },
                ]}
              />
            )}
            <Space direction="vertical" size={2} style={{ marginTop: 6, fontSize: 12 }}>
              <Text type="secondary">Vínculos de fornecedor que passam para {destino.sku}: {simulacao.vinculosFornecedorMovidos}</Text>
              {simulacao.gtinsMovidos.length > 0 && <Text type="secondary">Códigos de barras que passam: {simulacao.gtinsMovidos.join(', ')}</Text>}
              {simulacao.gtinsNaoMovidos.length > 0 && (
                <Tooltip title="O item que fica já tem código de barras nessa mesma unidade">
                  <Text type="warning">Não couberam em {destino.sku} (ficam sem item): {simulacao.gtinsNaoMovidos.join(', ')}</Text>
                </Tooltip>
              )}
              <Text type="secondary">Vendas e notas antigas continuam no histórico de {origem.sku}.</Text>
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
};

/** Sugestão do item que fica: o ativo com mais movimento (é o que está em uso). */
export const sugerirQueFica = (itens: ItemSuspeito[]) =>
  [...itens].filter(i => i.status !== 'INATIVO').sort((a, b) => b.movimentos - a.movimentos || a.idItem - b.idItem)[0]?.idItem;

/**
 * Janela de junção para itens escolhidos em qualquer tela (ex.: variações iguais numa família).
 * ids: os itens; null fecha. onConcluido é chamado a cada junção gravada.
 */
export const JuntarItensModal: React.FC<{ ids: number[] | null; titulo?: string; onFechar: () => void; onConcluido?: () => void }> = ({
  ids, titulo, onFechar, onConcluido,
}) => {
  const [itens, setItens] = useState<ItemSuspeito[]>([]);
  const [idFica, setIdFica] = useState<number | undefined>();
  const [carregando, setCarregando] = useState(false);
  const [unindo, setUnindo] = useState<{ origem: ItemSuspeito; destino: ItemSuspeito } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!ids?.length) { setItens([]); return; }
    let vivo = true;
    setCarregando(true);
    getItensParaJuntar(ids)
      .then(r => {
        if (!vivo) return;
        setItens(r);
        setIdFica(atual => (r.some(i => i.idItem === atual && i.status !== 'INATIVO') ? atual : sugerirQueFica(r)));
      })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os itens.'))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [ids, versao]);

  const ativos = itens.filter(i => i.status !== 'INATIVO');
  return (
    <Modal
      open={!!ids?.length}
      width={980}
      title={<Space><MergeCellsOutlined /> {titulo || 'Juntar itens duplicados'}</Space>}
      onCancel={onFechar}
      footer={<Button onClick={onFechar}>{ativos.length <= 1 && itens.length > 1 ? 'Concluir' : 'Fechar'}</Button>}
      destroyOnHidden
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Marque em <b>Fica</b> o item que continua (o de nome e SKU certos) e junte cada um dos outros nele. Estoque, fornecedores e códigos
          de barras passam para ele; o duplicado é inativado e o histórico de vendas e notas continua no original.
        </Text>
        <Spin spinning={carregando}>
          {itens.length === 0 && !carregando ? <Empty /> : (
            <TabelaJuntar itens={itens} idFica={idFica} onFica={setIdFica} onJuntar={setUnindo} />
          )}
        </Spin>
        {ativos.length <= 1 && itens.length > 1 && <Alert type="success" showIcon message="Pronto: sobrou só o item que fica." />}
      </Space>
      {unindo && (
        <ModalUnificar
          origem={unindo.origem}
          destino={unindo.destino}
          onClose={() => setUnindo(null)}
          onConcluido={() => { setUnindo(null); setVersao(v => v + 1); onConcluido?.(); }}
        />
      )}
    </Modal>
  );
};

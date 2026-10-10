// Itens duplicados: suspeitas (mesmo código de fornecedor, nomes iguais) e unificação de um item em outro.
// O item que fica recebe o estoque, os vínculos de fornecedor e os GTINs; o duplicado é inativado.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Radio, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { EyeInvisibleOutlined, MergeCellsOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { getTipoRecursoConfig } from '../../compras/entradaNf/tipoRecurso';
import { buscarItensParaJuntar, getDuplicados, getItensParaJuntar, GrupoSuspeito, ItemSuspeito, ResultadoUnificacao, unificarItens } from './duplicadosApi';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';

const { Text } = Typography;
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const MOTIVO = {
  MESMO_CODIGO_FORNECEDOR: { label: 'Mesmo código do fornecedor', color: 'red' },
  NOME_IGUAL: { label: 'Nome igual', color: 'orange' },
} as const;

// Suspeitas dispensadas ("não é duplicado") ficam guardadas neste navegador
const CHAVE_IGNORADOS = 'erp.duplicados.ignorados';
const lerIgnorados = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_IGNORADOS) || '[]'); } catch { return []; } };
const gravarIgnorados = (v: string[]) => { try { localStorage.setItem(CHAVE_IGNORADOS, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

const ItensDuplicados: React.FC = () => {
  const [grupos, setGrupos] = useState<GrupoSuspeito[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ignorados, setIgnorados] = useState<string[]>(lerIgnorados);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);
  const [fica, setFica] = useState<Record<string, number>>({});
  const [unindo, setUnindo] = useState<{ origem: ItemSuspeito; destino: ItemSuspeito } | null>(null);
  // Muda a cada junção concluída: a junção manual recarrega os itens dela
  const [versaoManual, setVersaoManual] = useState(0);

  const carregar = async () => {
    setCarregando(true);
    try {
      const g = await getDuplicados();
      setGrupos(g);
      // Sugestão do item que fica: o que tem mais movimento (é o que está em uso)
      setFica(Object.fromEntries(g.map(x => [x.chave, [...x.itens].sort((a, b) => b.movimentos - a.movimentos || a.idItem - b.idItem)[0]?.idItem])));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const visiveis = useMemo(() => grupos.filter(g => mostrarIgnorados || !ignorados.includes(g.chave)), [grupos, ignorados, mostrarIgnorados]);
  const alternarIgnorado = (chave: string) => {
    const proximo = ignorados.includes(chave) ? ignorados.filter(c => c !== chave) : [...ignorados, chave];
    setIgnorados(proximo);
    gravarIgnorados(proximo);
  };

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Itens duplicados</h2>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Itens que parecem ser o mesmo produto. Escolha o que fica e junte o outro nele: estoque, vínculos de fornecedor e códigos de barras vão junto, e o duplicado é inativado. Variações do mesmo produto (ex.: balde e galão) não são duplicados: coloque-as na mesma família com a grade preenchida e elas saem desta lista.
            </Text>
          </div>
          <Space>
            {ignorados.length > 0 && (
              <Button size="small" type="text" onClick={() => setMostrarIgnorados(v => !v)}>
                {mostrarIgnorados ? 'Esconder' : 'Mostrar'} dispensados ({ignorados.length})
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        <JuntarManual onJuntar={setUnindo} recarregar={versaoManual} />

        <Spin spinning={carregando}>
          {visiveis.length === 0 ? (
            <Card><Empty description="Nenhuma suspeita de item duplicado." /></Card>
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {visiveis.map(g => {
                const idFica = fica[g.chave];
                const dispensado = ignorados.includes(g.chave);
                return (
                  <Card
                    key={g.chave}
                    size="small"
                    style={{ opacity: dispensado ? 0.6 : 1 }}
                    title={<Space><Tag color={MOTIVO[g.motivo].color} style={{ margin: 0 }}>{MOTIVO[g.motivo].label}</Tag><span style={{ fontWeight: 500 }}>{g.descricao}</span></Space>}
                    extra={
                      <Button size="small" type="text" icon={<EyeInvisibleOutlined />} onClick={() => alternarIgnorado(g.chave)}>
                        {dispensado ? 'Voltar a suspeitar' : 'Não é duplicado'}
                      </Button>
                    }
                  >
                    <TabelaJuntar itens={g.itens} idFica={idFica} onFica={id => setFica(f => ({ ...f, [g.chave]: id }))} onJuntar={setUnindo} />
                  </Card>
                );
              })}
            </Space>
          )}
        </Spin>
      </Space>

      {unindo && (
        <ModalUnificar
          origem={unindo.origem}
          destino={unindo.destino}
          onClose={() => setUnindo(null)}
          onConcluido={() => { setUnindo(null); setVersaoManual(v => v + 1); carregar(); }}
        />
      )}
    </div>
  );
};

/** Itens com a escolha de qual fica e o botão de juntar cada outro nele. */
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

/**
 * Junção manual: itens que a busca automática não acha (ex.: o mesmo produto de 3 fornecedores com nomes
 * diferentes). Escolhe os itens, marca o que fica e junta os outros nele, um por vez, com a mesma simulação.
 */
const JuntarManual: React.FC<{ onJuntar: (par: { origem: ItemSuspeito; destino: ItemSuspeito }) => void; recarregar: number }> = ({ onJuntar, recarregar }) => {
  const lista = useListaTrabalho();
  const revisar = lista.comTag('REVISAR');
  const [ids, setIds] = useState<number[]>([]);
  const [itens, setItens] = useState<ItemSuspeito[]>([]);
  const [idFica, setIdFica] = useState<number | undefined>();
  const [opcoes, setOpcoes] = useState<Array<{ idItem: number; sku: string; nome: string }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Rótulos dos itens escolhidos (a busca muda as opções, mas o escolhido continua com nome)
  const rotulos = useRef(new Map<number, string>());

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const r = await getItensParaJuntar(ids);
        if (!vivo) return;
        setItens(r);
        r.forEach(i => rotulos.current.set(i.idItem, `${i.sku} · ${i.nome}`));
        // Sugestão do que fica: o ativo com mais movimento
        setIdFica(atual => (r.some(i => i.idItem === atual && i.status !== 'INATIVO') ? atual
          : [...r].filter(i => i.status !== 'INATIVO').sort((a, b) => b.movimentos - a.movimentos || a.idItem - b.idItem)[0]?.idItem));
      } catch (e: any) {
        message.error(e.message);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [ids, recarregar]);

  const buscar = (texto: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) { setOpcoes([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarItensParaJuntar(texto.trim());
        r.forEach(o => { if (!rotulos.current.has(o.idItem)) rotulos.current.set(o.idItem, `${o.sku} · ${o.nome}`); });
        setOpcoes(r);
      } catch (e: any) {
        message.error(e.message);
      } finally {
        setBuscando(false);
      }
    }, 300);
  };

  const ativos = itens.filter(i => i.status !== 'INATIVO');
  const opcoesSelect = [
    ...ids.filter(id => !opcoes.some(o => o.idItem === id)).map(id => ({ value: id, label: rotulos.current.get(id) || `Item ${id}` })),
    ...opcoes.map(o => ({ value: o.idItem, label: `${o.sku} · ${o.nome}` })),
  ];

  return (
    <Card
      size="small"
      title={<Space><MergeCellsOutlined /> Juntar manualmente</Space>}
      extra={revisar.length > 0 && (
        <Tooltip title="Traz os itens marcados como Revisar cadastro na lista de trabalho">
          <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setIds(atual => [...new Set([...atual, ...revisar.map(i => i.idItem)])])}>
            Trazer de Revisar cadastro ({revisar.length})
          </Button>
        </Tooltip>
      )}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Para o mesmo produto cadastrado mais de uma vez que não aparece abaixo (ex.: comprado de 3 fornecedores com nomes diferentes).
          Escolha os itens, marque o que fica e junte cada um dos outros nele.
        </Text>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Buscar itens por nome, SKU ou medida…"
          value={ids}
          onChange={(v: number[]) => setIds(v)}
          onSearch={buscar}
          filterOption={false}
          loading={buscando}
          notFoundContent={buscando ? 'Buscando…' : 'Digite ao menos 2 letras'}
          options={opcoesSelect}
          allowClear
        />
        {ids.length > 0 && (
          <Spin spinning={carregando}>
            <TabelaJuntar itens={itens} idFica={idFica} onFica={setIdFica} onJuntar={onJuntar} />
            {ativos.length < 2 && itens.length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {itens.length > 1 ? 'Pronto: sobrou só o item que fica. ' : 'Escolha pelo menos 2 itens. '}
                <Button size="small" type="link" onClick={() => setIds([])}>Limpar</Button>
              </Text>
            )}
          </Spin>
        )}
      </Space>
    </Card>
  );
};

const ModalUnificar: React.FC<{ origem: ItemSuspeito; destino: ItemSuspeito; onClose: () => void; onConcluido: () => void }> = ({ origem, destino, onClose, onConcluido }) => {
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

export default ItensDuplicados;

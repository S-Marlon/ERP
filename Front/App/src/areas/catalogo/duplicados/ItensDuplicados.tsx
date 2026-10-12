// Itens duplicados: suspeitas (mesmo código de fornecedor, nomes iguais) e unificação de um item em outro.
// O item que fica recebe o estoque, os vínculos de fornecedor e os GTINs; o duplicado é inativado.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { EyeInvisibleOutlined, MergeCellsOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { buscarItensParaJuntar, getDuplicados, getItensParaJuntar, GrupoSuspeito, ItemSuspeito } from './duplicadosApi';
import { ModalUnificar, sugerirQueFica, TabelaJuntar } from './juntarItens';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';

const { Text } = Typography;
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
        setIdFica(atual => (r.some(i => i.idItem === atual && i.status !== 'INATIVO') ? atual : sugerirQueFica(r)));
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

export default ItensDuplicados;

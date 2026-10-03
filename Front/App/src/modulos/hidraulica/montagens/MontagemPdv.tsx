// Botão "Montagem" do PDV (módulo Hidráulica · Montagens):
// - montagem na hora: mangueira + terminais + capas (+ prensagem se o cliente trouxe material) vão ao carrinho
//   e a ficha técnica é gravada ligada à venda quando ela fecha;
// - entrega de OS: a tela de Montagens pede a entrega; aqui os itens entram com o preço da OS, o sinal fica
//   disponível no pagamento e, com a venda gravada, a OS vira ENTREGUE.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Collapse, Divider, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { HistoryOutlined, ToolOutlined } from '@ant-design/icons';
import type { PdvExtensaoProps } from '../../registroModulos';
import { adicionarPendente, instalarOuvintesDaVenda, lerPendentes } from './fichasPendentes';
import { FichaMangueira, FichaSalva, montagensApi, ORIGEM_SINAL_OS, osApi } from './montagensApi';
import { brl, CamposFicha, CamposMontagem, EstadoMontagem, estadoInicialMontagem, fichaDaMontagem, gravarUltimos, linhasDaMontagem } from './montador';

const { Text } = Typography;

// Pedido de entrega vindo da tela de Montagens e a entrega em andamento no PDV
export const CHAVE_ENTREGAR_OS = 'modulo-hidraulica-montagens:entregar-os';
const CHAVE_ENTREGA_EM_ANDAMENTO = 'modulo-hidraulica-montagens:entrega-em-andamento';
const ler = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const gravar = (k: string, v: string | null) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

const ModalMontagem: React.FC<PdvExtensaoProps & { aberto: boolean; onFechar: () => void }> = ({ aberto, onFechar, adicionarItens, clienteId }) => {
  const [e, setE] = useState<EstadoMontagem>(estadoInicialMontagem);
  const [ficha, setFicha] = useState<FichaMangueira>({});
  const [historico, setHistorico] = useState<FichaSalva[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setE(estadoInicialMontagem());
    setFicha({});
    if (clienteId) montagensApi.listarFichas({ idCliente: clienteId }).then(setHistorico).catch(() => setHistorico([]));
    else setHistorico([]);
  }, [aberto, clienteId]);

  const linhas = useMemo(() => linhasDaMontagem(e), [e]);
  const totalEstimado = linhas.reduce((a, l) => a + l.item.preco * l.quantidade, 0);

  const refazer = (f: FichaSalva) => {
    setFicha({ equipamento: f.equipamento, posicao: f.posicao, bitola: f.bitola, terminalA: f.terminalA, terminalB: f.terminalB, angulo: f.angulo, pressaoTrabalho: f.pressaoTrabalho, observacao: f.observacao });
    setE(x => ({ ...x, comprimento: f.comprimentoM ?? null, pecas: f.quantidade || 1 }));
    message.info('Medidas e ficha preenchidas. Confira os itens (mangueira, terminais e capas).');
  };

  const confirmar = async () => {
    if (!e.mangueira || !(Number(e.comprimento) > 0)) { message.warning('Escolha a mangueira e o comprimento.'); return; }
    setSalvando(true);
    try {
      const falhas = await adicionarItens(linhas.map(l => ({ idItem: l.item.id, nome: l.item.nome, quantidade: l.quantidade, idUnidade: null, unidadeBase: l.unidadeBase })));
      adicionarPendente(fichaDaMontagem(e, ficha));
      gravarUltimos(e);
      if (falhas.length) message.warning(`Não foi possível adicionar: ${falhas.join(', ')}.`);
      else message.success(`Montagem adicionada (${e.pecas} peça(s)). A ficha é guardada quando a venda fechar.`);
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={aberto} onCancel={onFechar} width={760} title={<Space><ToolOutlined /> Montagem de mangueira</Space>}
      okText="Adicionar ao carrinho" cancelText="Cancelar" onOk={confirmar} confirmLoading={salvando} destroyOnHidden
      okButtonProps={{ disabled: !e.mangueira || !(Number(e.comprimento) > 0) }}>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {historico.length > 0 && (
          <Select placeholder={<span><HistoryOutlined /> Refazer uma mangueira deste cliente</span>} style={{ width: '100%' }} value={null as unknown as number}
            onChange={id => { const f = historico.find(h => h.idMangueira === id); if (f) refazer(f); }}
            options={historico.map(h => ({ value: h.idMangueira, label: `${[h.equipamento, h.posicao].filter(Boolean).join(' · ') || 'Sem equipamento'} — ${h.bitola || ''} ${h.comprimentoM ? `${h.comprimentoM} m` : ''} (${new Date(h.criadoEm).toLocaleDateString('pt-BR')})` }))} />
        )}
        <CamposMontagem valor={e} onChange={setE} />
        <Collapse size="small" items={[{ key: 'ficha', label: 'Ficha técnica (para refazer igual depois)', children: <CamposFicha valor={ficha} onChange={setFicha} /> }]} />
        <Divider style={{ margin: '4px 0' }} />
        {linhas.length === 0 ? <Text type="secondary">Escolha a mangueira e o comprimento.</Text> : (
          <Table size="small" pagination={false} rowKey={(l) => `${l.papel}-${l.item.id}`} dataSource={linhas}
            columns={[
              { title: '', dataIndex: 'papel', width: 100, render: (p: string) => <Tag style={{ margin: 0 }}>{p}</Tag> },
              { title: 'Item', key: 'i', render: (_, l) => l.item.nome },
              { title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_, l) => `${l.quantidade.toLocaleString('pt-BR')}${l.unidadeBase ? ' m' : ''}` },
              { title: 'Estimado', key: 'v', width: 110, align: 'right' as const, render: (_, l) => brl(l.item.preco * l.quantidade) },
            ]}
            footer={() => <div style={{ textAlign: 'right' }}>Estimado: <b>{brl(totalEstimado)}</b> <Text type="secondary" style={{ fontSize: 11 }}>(o carrinho aplica a faixa de preço da quantidade)</Text></div>} />
        )}
      </Space>
    </Modal>
  );
};

/** Botão do PDV (ponto de extensão registrado em registroModulos). */
const MontagemPdv: React.FC<PdvExtensaoProps> = (props) => {
  const { adicionarItens, definirCliente, vincularOrigem } = props;
  const [aberto, setAberto] = useState(false);
  const [pendentes, setPendentes] = useState(lerPendentes().length);

  useEffect(() => { instalarOuvintesDaVenda(); }, []);

  // Entrega da OS: quando a venda grava, a OS vira ENTREGUE; carrinho descartado cancela a entrega em andamento
  useEffect(() => {
    const concluida = (ev: Event) => {
      setTimeout(() => setPendentes(lerPendentes().length), 0);
      const idOs = Number(ler(CHAVE_ENTREGA_EM_ANDAMENTO));
      const idVenda = Number((ev as CustomEvent).detail?.idVenda);
      if (!idOs || !idVenda) return;
      gravar(CHAVE_ENTREGA_EM_ANDAMENTO, null);
      osApi.entregar(idOs, idVenda)
        .then(() => message.success(`OS ${idOs} entregue (venda ${idVenda}).`))
        .catch(err => message.warning(`Venda gravada, mas a OS ${idOs} não foi marcada como entregue: ${err instanceof Error ? err.message : err}`));
    };
    const nova = () => { setTimeout(() => setPendentes(lerPendentes().length), 0); gravar(CHAVE_ENTREGA_EM_ANDAMENTO, null); };
    window.addEventListener('erp:venda-concluida', concluida);
    window.addEventListener('erp:venda-nova', nova);
    return () => { window.removeEventListener('erp:venda-concluida', concluida); window.removeEventListener('erp:venda-nova', nova); };
  }, []);

  // Pedido de entrega vindo da tela de Montagens
  useEffect(() => {
    const idOs = Number(ler(CHAVE_ENTREGAR_OS));
    if (!idOs) return;
    gravar(CHAVE_ENTREGAR_OS, null);
    (async () => {
      try {
        const os = await osApi.detalhe(idOs);
        if (os.status === 'ENTREGUE' || os.status === 'CANCELADA') { message.info(`OS ${idOs} já ${os.status === 'ENTREGUE' ? 'entregue' : 'cancelada'}.`); return; }
        const itens = [...os.mangueiras.flatMap(m => m.itens), ...os.itensAvulsos];
        const falhas = await adicionarItens(itens.map(i => ({ idItem: i.idItem, nome: i.descricao, quantidade: i.quantidade, idUnidade: i.idUnidade, precoFixo: i.precoUnitario })), { substituir: true });
        definirCliente(os.idCliente ? { id: os.idCliente, nome: os.cliente } : null, os.cliente);
        vincularOrigem({ origem: ORIGEM_SINAL_OS, idOrigem: idOs, rotulo: `Entrega da OS Nº ${idOs}${os.sinalAberto > 0 ? ` · sinal de ${brl(os.sinalAberto)} disponível no pagamento` : ''}` });
        gravar(CHAVE_ENTREGA_EM_ANDAMENTO, String(idOs));
        if (falhas.length) message.warning(`Não foi possível carregar: ${falhas.join(', ')}.`);
        else message.success(`OS ${idOs} no carrinho com os preços da OS.`);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Erro ao carregar a OS.');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Button size="small" icon={<ToolOutlined />} onClick={() => setAberto(true)}>
        Montagem{pendentes > 0 ? ` (${pendentes})` : ''}
      </Button>
      <ModalMontagem {...props} aberto={aberto} onFechar={() => { setAberto(false); setPendentes(lerPendentes().length); }} />
    </>
  );
};

export default MontagemPdv;

// Botão "Montagem" do PDV (módulo Hidráulica · Montagens): monta a mangueira (metros + terminais + capas e,
// se o cliente trouxe o material, a prensagem como serviço), joga os itens no carrinho e guarda a ficha técnica,
// que é gravada ligada à venda quando ela fecha.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Collapse, Divider, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { HistoryOutlined, ToolOutlined } from '@ant-design/icons';
import { getPdvProducts } from '../../../pages/PDV/services/api/products';
import type { PdvExtensaoProps } from '../../registroModulos';
import { adicionarPendente, instalarOuvintesDaVenda, lerPendentes } from './fichasPendentes';
import { FichaSalva, montagensApi } from './montagensApi';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ItemEscolhido { id: number; nome: string; sku: string; preco: number; unidade: string }

// Últimos itens usados em cada papel (agiliza o balcão: geralmente se repete a mesma linha de terminais)
const CHAVE_ULTIMOS = 'modulo-hidraulica-montagens:ultimos-itens';
const lerUltimos = (): Record<string, ItemEscolhido> => { try { return JSON.parse(localStorage.getItem(CHAVE_ULTIMOS) || '{}'); } catch { return {}; } };
const gravarUltimo = (papel: string, item: ItemEscolhido | null) => {
  if (!item) return;
  try { localStorage.setItem(CHAVE_ULTIMOS, JSON.stringify({ ...lerUltimos(), [papel]: item })); } catch { /* sem armazenamento */ }
};

const SeletorItem: React.FC<{ valor: ItemEscolhido | null; onChange: (i: ItemEscolhido | null) => void; placeholder: string }> = ({ valor, onChange, placeholder }) => {
  const [opcoes, setOpcoes] = useState<ItemEscolhido[]>([]);
  const [termo, setTermo] = useState('');
  useEffect(() => {
    if (termo.trim().length < 2) { setOpcoes([]); return; }
    const t = setTimeout(() => {
      getPdvProducts({ searchTerm: termo, limit: 15, incluirNaoPublicaveis: true }).then(r => setOpcoes(
        (r.data as unknown as Array<{ id: number | string; name: string; sku: string; salePrice?: number; unidadeBase?: string; unitOfMeasure?: string }>).map(p => ({
          id: Number(p.id), nome: p.name, sku: p.sku, preco: Number(p.salePrice) || 0, unidade: p.unidadeBase || p.unitOfMeasure || '',
        }))));
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);
  const lista = valor && !opcoes.some(o => o.id === valor.id) ? [valor, ...opcoes] : opcoes;
  return (
    <Select showSearch allowClear filterOption={false} placeholder={placeholder} style={{ width: '100%' }}
      value={valor?.id} onSearch={setTermo} onChange={id => onChange(lista.find(o => o.id === id) || null)}
      notFoundContent={termo.length < 2 ? 'Digite ao menos 2 letras' : 'Nada encontrado'}
      options={lista.map(o => ({ value: o.id, label: <span>{o.nome} <Text type="secondary" style={{ fontSize: 11 }}>· {o.sku} · {brl(o.preco)}</Text></span> }))} />
  );
};

interface Estado {
  pecas: number;
  mangueira: ItemEscolhido | null; comprimento: number | null;
  terminalA: ItemEscolhido | null; terminalB: ItemEscolhido | null; bIgualA: boolean;
  capa: ItemEscolhido | null; capasPorPeca: number;
  cobrarPrensagem: boolean; prensagem: ItemEscolhido | null; prensagensPorPeca: number;
}

const ModalMontagem: React.FC<PdvExtensaoProps & { aberto: boolean; onFechar: () => void }> = ({ aberto, onFechar, adicionarItens, clienteId }) => {
  const [form] = Form.useForm();
  const [e, setE] = useState<Estado>({ pecas: 1, mangueira: null, comprimento: null, terminalA: null, terminalB: null, bIgualA: true, capa: null, capasPorPeca: 2, cobrarPrensagem: false, prensagem: null, prensagensPorPeca: 2 });
  const [historico, setHistorico] = useState<FichaSalva[]>([]);
  const [salvando, setSalvando] = useState(false);
  const alterar = (parcial: Partial<Estado>) => setE(x => ({ ...x, ...parcial }));

  useEffect(() => {
    if (!aberto) return;
    const u = lerUltimos();
    setE({ pecas: 1, mangueira: u.mangueira || null, comprimento: null, terminalA: u.terminalA || null, terminalB: u.terminalB || null, bIgualA: true,
      capa: u.capa || null, capasPorPeca: 2, cobrarPrensagem: false, prensagem: u.prensagem || null, prensagensPorPeca: 2 });
    form.resetFields();
    if (clienteId) montagensApi.listarFichas({ idCliente: clienteId }).then(setHistorico).catch(() => setHistorico([]));
    else setHistorico([]);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const terminalB = e.bIgualA ? e.terminalA : e.terminalB;
  const linhas = useMemo(() => {
    const l: Array<{ papel: string; item: ItemEscolhido; quantidade: number; unidadeBase?: boolean }> = [];
    if (e.mangueira && Number(e.comprimento) > 0) l.push({ papel: 'Mangueira', item: e.mangueira, quantidade: Number((Number(e.comprimento) * e.pecas).toFixed(3)), unidadeBase: true });
    if (e.terminalA && terminalB && e.terminalA.id === terminalB.id) l.push({ papel: 'Terminais', item: e.terminalA, quantidade: 2 * e.pecas });
    else {
      if (e.terminalA) l.push({ papel: 'Terminal A', item: e.terminalA, quantidade: e.pecas });
      if (terminalB) l.push({ papel: 'Terminal B', item: terminalB, quantidade: e.pecas });
    }
    if (e.capa && e.capasPorPeca > 0) l.push({ papel: 'Capas', item: e.capa, quantidade: e.capasPorPeca * e.pecas });
    if (e.cobrarPrensagem && e.prensagem && e.prensagensPorPeca > 0) l.push({ papel: 'Prensagem', item: e.prensagem, quantidade: e.prensagensPorPeca * e.pecas });
    return l;
  }, [e, terminalB]);
  const totalEstimado = linhas.reduce((a, l) => a + l.item.preco * l.quantidade, 0);

  const refazer = (f: FichaSalva) => {
    form.setFieldsValue({ equipamento: f.equipamento, posicao: f.posicao, bitola: f.bitola, angulo: f.angulo, pressaoTrabalho: f.pressaoTrabalho, observacao: f.observacao });
    alterar({ comprimento: f.comprimentoM, pecas: f.quantidade || 1 });
    message.info('Medidas e ficha preenchidas. Confira os itens (mangueira, terminais e capas).');
  };

  const confirmar = async () => {
    if (!e.mangueira || !(Number(e.comprimento) > 0)) { message.warning('Escolha a mangueira e o comprimento.'); return; }
    const ficha = form.getFieldsValue();
    setSalvando(true);
    try {
      const falhas = await adicionarItens(linhas.map(l => ({ idItem: l.item.id, nome: l.item.nome, quantidade: l.quantidade, idUnidade: null, unidadeBase: l.unidadeBase })));
      adicionarPendente({
        equipamento: ficha.equipamento, posicao: ficha.posicao, bitola: ficha.bitola || e.mangueira.nome.slice(0, 20),
        comprimentoM: Number(e.comprimento), quantidade: e.pecas, terminalA: e.terminalA?.nome, terminalB: terminalB?.nome,
        angulo: ficha.angulo, pressaoTrabalho: ficha.pressaoTrabalho, observacao: ficha.observacao,
      });
      (['mangueira', 'terminalA', 'capa', 'prensagem'] as const).forEach(p => gravarUltimo(p, e[p]));
      if (!e.bIgualA) gravarUltimo('terminalB', e.terminalB);
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

        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px', gap: 8, alignItems: 'center' }}>
          <Text strong>Peças iguais</Text>
          <InputNumber min={1} max={99} value={e.pecas} onChange={v => alterar({ pecas: Number(v) || 1 })} style={{ width: 100 }} />
          <span />

          <Text strong>Mangueira</Text>
          <SeletorItem valor={e.mangueira} onChange={i => alterar({ mangueira: i })} placeholder="Ex.: mangueira R2 3/4" />
          <InputNumber min={0} step={0.1} precision={3} decimalSeparator="," addonAfter="m/peça" value={e.comprimento} onChange={v => alterar({ comprimento: v })} />

          <Text strong>Terminal A</Text>
          <SeletorItem valor={e.terminalA} onChange={i => alterar({ terminalA: i })} placeholder="Terminal da ponta A" />
          <Text type="secondary" style={{ fontSize: 12 }}>1 por peça</Text>

          <Text strong>Terminal B</Text>
          {e.bIgualA ? <Text type="secondary">igual ao A</Text> : <SeletorItem valor={e.terminalB} onChange={i => alterar({ terminalB: i })} placeholder="Terminal da ponta B" />}
          <Checkbox checked={e.bIgualA} onChange={x => alterar({ bIgualA: x.target.checked })}>igual ao A</Checkbox>

          <Text strong>Capas</Text>
          <SeletorItem valor={e.capa} onChange={i => alterar({ capa: i })} placeholder="Capa (opcional)" />
          <InputNumber min={0} max={10} value={e.capasPorPeca} onChange={v => alterar({ capasPorPeca: Number(v) || 0 })} addonAfter="/peça" />
        </div>

        <Checkbox checked={e.cobrarPrensagem} onChange={x => alterar({ cobrarPrensagem: x.target.checked })}>
          Cobrar prensagem (cliente trouxe mangueira/terminais) <Text type="secondary" style={{ fontSize: 12 }}>— normalmente já está no preço dos terminais e capas</Text>
        </Checkbox>
        {e.cobrarPrensagem && (
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px', gap: 8, alignItems: 'center' }}>
            <Text strong>Prensagem</Text>
            <SeletorItem valor={e.prensagem} onChange={i => alterar({ prensagem: i })} placeholder="Serviço de prensagem" />
            <InputNumber min={0} max={10} value={e.prensagensPorPeca} onChange={v => alterar({ prensagensPorPeca: Number(v) || 0 })} addonAfter="/peça" />
          </div>
        )}

        <Collapse size="small" items={[{
          key: 'ficha', label: 'Ficha técnica (para refazer igual depois)',
          children: (
            <Form form={form} layout="vertical" size="small">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                <Form.Item name="equipamento" label="Equipamento"><Input placeholder="Ex.: escavadeira CAT 320" maxLength={150} /></Form.Item>
                <Form.Item name="posicao" label="Posição"><Input placeholder="Ex.: cilindro do braço" maxLength={150} /></Form.Item>
                <Form.Item name="bitola" label="Bitola / tipo"><Input placeholder="Ex.: R2 3/4" maxLength={20} /></Form.Item>
                <Form.Item name="angulo" label="Ângulo entre terminais"><Input placeholder="Ex.: 90°" maxLength={30} /></Form.Item>
                <Form.Item name="pressaoTrabalho" label="Pressão de trabalho"><Input placeholder="Ex.: 250 bar" maxLength={30} /></Form.Item>
                <Form.Item name="observacao" label="Observação"><Input maxLength={255} /></Form.Item>
              </div>
            </Form>
          ),
        }]} />

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
  const [aberto, setAberto] = useState(false);
  const [pendentes, setPendentes] = useState(lerPendentes().length);
  useEffect(() => { instalarOuvintesDaVenda(); }, []);
  useEffect(() => {
    const atualizar = () => setTimeout(() => setPendentes(lerPendentes().length), 0);
    window.addEventListener('erp:venda-concluida', atualizar);
    window.addEventListener('erp:venda-nova', atualizar);
    return () => { window.removeEventListener('erp:venda-concluida', atualizar); window.removeEventListener('erp:venda-nova', atualizar); };
  }, []);
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

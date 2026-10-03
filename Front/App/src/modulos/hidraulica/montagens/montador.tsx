// Peças compartilhadas da montagem de mangueira (PDV e OS): seletor de item do catálogo, montador
// (mangueira + terminais + capas + prensagem opcional), ficha técnica e memória dos últimos itens usados.
import React, { useEffect, useState } from 'react';
import { Checkbox, Input, InputNumber, Select, Typography } from 'antd';
import { getPdvProducts } from '../../../pages/PDV/services/api/products';
import type { FichaMangueira } from './montagensApi';

const { Text } = Typography;
export const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ItemEscolhido { id: number; nome: string; sku: string; preco: number; unidade: string }

export interface EstadoMontagem {
  pecas: number;
  mangueira: ItemEscolhido | null; comprimento: number | null;
  terminalA: ItemEscolhido | null; terminalB: ItemEscolhido | null; bIgualA: boolean;
  capa: ItemEscolhido | null; capasPorPeca: number;
  cobrarPrensagem: boolean; prensagem: ItemEscolhido | null; prensagensPorPeca: number;
}

export interface LinhaMontagem { papel: string; item: ItemEscolhido; quantidade: number; unidadeBase?: boolean }

// Últimos itens por papel (no balcão costuma repetir a mesma linha de terminais e capas)
const CHAVE_ULTIMOS = 'modulo-hidraulica-montagens:ultimos-itens';
const lerUltimos = (): Record<string, ItemEscolhido> => { try { return JSON.parse(localStorage.getItem(CHAVE_ULTIMOS) || '{}'); } catch { return {}; } };

export const estadoInicialMontagem = (): EstadoMontagem => {
  const u = lerUltimos();
  return {
    pecas: 1, mangueira: u.mangueira || null, comprimento: null, terminalA: u.terminalA || null, terminalB: u.terminalB || null, bIgualA: true,
    capa: u.capa || null, capasPorPeca: 2, cobrarPrensagem: false, prensagem: u.prensagem || null, prensagensPorPeca: 2,
  };
};

export const gravarUltimos = (e: EstadoMontagem) => {
  try {
    const atual = lerUltimos();
    (['mangueira', 'terminalA', 'capa', 'prensagem'] as const).forEach(p => { if (e[p]) atual[p] = e[p] as ItemEscolhido; });
    if (!e.bIgualA && e.terminalB) atual.terminalB = e.terminalB;
    localStorage.setItem(CHAVE_ULTIMOS, JSON.stringify(atual));
  } catch { /* sem armazenamento */ }
};

export const terminalBEfetivo = (e: EstadoMontagem) => (e.bIgualA ? e.terminalA : e.terminalB);

/** Itens que a montagem gera (quantidades para todas as peças iguais). */
export const linhasDaMontagem = (e: EstadoMontagem): LinhaMontagem[] => {
  const l: LinhaMontagem[] = [];
  const tB = terminalBEfetivo(e);
  if (e.mangueira && Number(e.comprimento) > 0) l.push({ papel: 'Mangueira', item: e.mangueira, quantidade: Number((Number(e.comprimento) * e.pecas).toFixed(3)), unidadeBase: true });
  if (e.terminalA && tB && e.terminalA.id === tB.id) l.push({ papel: 'Terminais', item: e.terminalA, quantidade: 2 * e.pecas });
  else {
    if (e.terminalA) l.push({ papel: 'Terminal A', item: e.terminalA, quantidade: e.pecas });
    if (tB) l.push({ papel: 'Terminal B', item: tB, quantidade: e.pecas });
  }
  if (e.capa && e.capasPorPeca > 0) l.push({ papel: 'Capas', item: e.capa, quantidade: e.capasPorPeca * e.pecas });
  if (e.cobrarPrensagem && e.prensagem && e.prensagensPorPeca > 0) l.push({ papel: 'Prensagem', item: e.prensagem, quantidade: e.prensagensPorPeca * e.pecas });
  return l;
};

export const SeletorItem: React.FC<{ valor: ItemEscolhido | null; onChange: (i: ItemEscolhido | null) => void; placeholder: string }> = ({ valor, onChange, placeholder }) => {
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

/** Campos da montagem (peças, mangueira, terminais, capas, prensagem). */
export const CamposMontagem: React.FC<{ valor: EstadoMontagem; onChange: (e: EstadoMontagem) => void }> = ({ valor: e, onChange }) => {
  const alterar = (parcial: Partial<EstadoMontagem>) => onChange({ ...e, ...parcial });
  const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: '110px 1fr 150px', gap: 8, alignItems: 'center' };
  return (
    <>
      <div style={grade}>
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
      <Checkbox checked={e.cobrarPrensagem} onChange={x => alterar({ cobrarPrensagem: x.target.checked })} style={{ marginTop: 8 }}>
        Cobrar prensagem (cliente trouxe mangueira/terminais) <Text type="secondary" style={{ fontSize: 12 }}>— normalmente já está no preço dos terminais e capas</Text>
      </Checkbox>
      {e.cobrarPrensagem && (
        <div style={{ ...grade, marginTop: 8 }}>
          <Text strong>Prensagem</Text>
          <SeletorItem valor={e.prensagem} onChange={i => alterar({ prensagem: i })} placeholder="Serviço de prensagem" />
          <InputNumber min={0} max={10} value={e.prensagensPorPeca} onChange={v => alterar({ prensagensPorPeca: Number(v) || 0 })} addonAfter="/peça" />
        </div>
      )}
    </>
  );
};

/** Ficha técnica (controlada). */
export const CamposFicha: React.FC<{ valor: FichaMangueira; onChange: (f: FichaMangueira) => void; comComprimento?: boolean }> = ({ valor: f, onChange, comComprimento }) => {
  const campo = (chave: keyof FichaMangueira, rotulo: string, placeholder: string, max: number) => (
    <div>
      <Text type="secondary" style={{ fontSize: 11 }}>{rotulo}</Text>
      <Input size="small" placeholder={placeholder} maxLength={max} value={(f[chave] as string) || ''} onChange={e => onChange({ ...f, [chave]: e.target.value })} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 10px' }}>
      {campo('equipamento', 'Equipamento', 'Ex.: escavadeira CAT 320', 150)}
      {campo('posicao', 'Posição', 'Ex.: cilindro do braço', 150)}
      {campo('bitola', 'Bitola / tipo', 'Ex.: R2 3/4', 20)}
      {comComprimento && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>Comprimento (m)</Text>
          <InputNumber size="small" min={0} step={0.1} precision={3} decimalSeparator="," style={{ width: '100%' }}
            value={f.comprimentoM ?? null} onChange={v => onChange({ ...f, comprimentoM: v })} />
        </div>
      )}
      {campo('terminalA', 'Terminal A', 'Ex.: JIC 3/4 reto', 150)}
      {campo('terminalB', 'Terminal B', 'Ex.: JIC 3/4 90°', 150)}
      {campo('angulo', 'Ângulo entre terminais', 'Ex.: 90°', 30)}
      {campo('pressaoTrabalho', 'Pressão de trabalho', 'Ex.: 250 bar', 30)}
      {campo('observacao', 'Observação', '', 255)}
    </div>
  );
};

/** Ficha a partir da montagem (o que o operador escolheu vira texto da ficha). */
export const fichaDaMontagem = (e: EstadoMontagem, f: FichaMangueira): FichaMangueira => ({
  ...f,
  bitola: f.bitola || e.mangueira?.nome.slice(0, 20),
  comprimentoM: Number(e.comprimento) || f.comprimentoM || null,
  quantidade: e.pecas,
  terminalA: f.terminalA || e.terminalA?.nome,
  terminalB: f.terminalB || terminalBEfetivo(e)?.nome,
});

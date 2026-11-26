// Negociação › "Incluir item": busca no catálogo (a mesma busca do PDV, por nome, SKU ou código de barras), escolhe a
// quantidade e inclui no orçamento. A linha entra pelo preço de tabela; o custo e a última venda vêm do preparar.
import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Flex, Select, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text } = Typography;
export interface ItemBuscado { idItem: number; sku: string; nome: string; unidade: string; idUnidade: number | null; preco: number; estoque: number; ehKit: boolean }

const buscar = async (texto: string): Promise<ItemBuscado[]> => {
  const q = new URLSearchParams({ query: texto, limit: '20', status: 'Ativo' });
  const r = await fetch(`${API_URL}/api/vendas/pdv/itens?${q}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Erro ao buscar os itens.');
  return (d.data || []).map((p: any) => ({
    idItem: Number(p.id), sku: p.sku || '', nome: p.name || '', unidade: p.unitOfMeasure || p.unidadeBase || '',
    idUnidade: p.idUnidadeVenda ?? null, preco: Number(p.salePrice ?? p.price ?? 0) || 0, estoque: Number(p.estoqueBase) || 0, ehKit: Boolean(p.ehKit),
  }));
};

export const AdicionarItemNegociacao: React.FC<{ onAdicionar: (p: ItemBuscado, quantidade: number) => Promise<void> }> = ({ onAdicionar }) => {
  const [texto, setTexto] = useState('');
  const [opcoes, setOpcoes] = useState<ItemBuscado[]>([]);
  const [escolhido, setEscolhido] = useState<ItemBuscado | null>(null);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [carregando, setCarregando] = useState(false);
  const [incluindo, setIncluindo] = useState(false);
  const vez = useRef(0);

  // busca meio segundo depois de parar de digitar
  useEffect(() => {
    if (texto.trim().length < 2) { setOpcoes([]); return; }
    const minha = ++vez.current;
    setCarregando(true);
    const t = setTimeout(() => {
      buscar(texto.trim())
        .then(l => { if (minha === vez.current) setOpcoes(l); })
        .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao buscar.'))
        .finally(() => { if (minha === vez.current) setCarregando(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  const incluir = async () => {
    if (!escolhido || !(quantidade > 0)) return;
    setIncluindo(true);
    try { await onAdicionar(escolhido, quantidade); setEscolhido(null); setTexto(''); setQuantidade(1); setOpcoes([]); }
    finally { setIncluindo(false); }
  };

  return (
    <Card size="small" title="Incluir item">
      <Flex gap={8} wrap align="center">
        <Select showSearch style={{ flex: 1, minWidth: 320 }} placeholder="Buscar por nome, SKU ou código de barras" filterOption={false}
          searchValue={texto} onSearch={setTexto} loading={carregando} value={escolhido?.idItem ?? null}
          notFoundContent={texto.trim().length < 2 ? 'Digite ao menos 2 letras' : carregando ? 'Buscando…' : 'Nada encontrado'}
          onChange={id => setEscolhido(opcoes.find(o => o.idItem === id) || null)}
          options={opcoes.map(o => ({
            value: o.idItem,
            label: (
              <Flex justify="space-between" gap={8}>
                <span><b>{o.sku}</b> · {o.nome}</span>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {o.preco ? `R$ ${o.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}{o.unidade ? `/${o.unidade}` : ''} · estoque {o.estoque.toLocaleString('pt-BR')}{o.ehKit ? ' · kit' : ''}
                </Text>
              </Flex>
            ),
          }))} />
        <CampoNumero min={0.0001} style={{ width: 130 }} value={quantidade} suffix={escolhido?.unidade || undefined} onChange={v => setQuantidade(Number(v) || 0)} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!escolhido || !(quantidade > 0)} loading={incluindo} onClick={incluir}>Incluir</Button>
      </Flex>
      <Text type="secondary" style={{ fontSize: 12 }}>Entra pelo preço de tabela; depois ajuste o preço ou use a régua da categoria como nos outros itens.</Text>
    </Card>
  );
};

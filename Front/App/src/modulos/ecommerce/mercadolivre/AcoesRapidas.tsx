// Ações rápidas da lista de anúncios: preço na linha (confirma com ✓), estoque que vai ao ML (reserva e teto) e
// ativo/pausado no ML. Cada uma grava na hora e já manda ao Mercado Livre.
import React, { useEffect, useState } from 'react';
import { Button, Flex, InputNumber, Popover, Space, Spin, Switch, Tooltip, Typography } from 'antd';
import { AimOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { anunciosApi, FinanceiroItem, formatarMoeda, PrevisaoPreco } from './mercadoLivreApi';
import { precoComercial } from './listaAnuncios';

const { Text } = Typography;

const NIVEL_COR: Record<string, string> = { PREJUIZO: '#cf1322', BAIXO: '#d46b08', BOM: '#389e0d', ALTO: '#1677ff', SEM_CUSTO: '#8c8c8c' };
const moeda = (v: number) => formatarMoeda(v);

/** Você recebe e lucro a um preço, perguntando ao servidor (espera parar de digitar). */
export const usePrevisaoPreco = (idAnuncio: number, idItem: number, preco: number | null, ativo: boolean) => {
  const [previsao, setPrevisao] = useState<PrevisaoPreco | null>(null);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    if (!ativo || !preco || preco <= 0) return;
    let vale = true;
    const t = window.setTimeout(async () => {
      setCarregando(true);
      try { const p = await anunciosApi.simularPreco(idAnuncio, idItem, preco); if (vale) setPrevisao(p); }
      catch { /* a previsão é só ajuda */ }
      finally { if (vale) setCarregando(false); }
    }, 350);
    return () => { vale = false; window.clearTimeout(t); };
  }, [idAnuncio, idItem, preco, ativo]);
  return { previsao: ativo ? previsao : null, carregando: ativo && carregando };
};

/** Linha "recebe R$ · lucro R$ (x%)" colorida pelo nível do lucro. */
export const LinhaPrevisao: React.FC<{ p: PrevisaoPreco | null; carregando: boolean }> = ({ p, carregando }) => {
  if (!p) return carregando ? <Spin size="small" /> : null;
  return (
    <Tooltip title={`${moeda(p.preco)} − tarifa ${moeda(p.tarifa)} − frete ${moeda(p.frete)} = ${moeda(p.recebe)}; − custo ${moeda(p.custo)} = ${moeda(p.lucro)}`}>
      <Text style={{ fontSize: 12, color: NIVEL_COR[p.nivel], whiteSpace: 'nowrap' }}>
        recebe {moeda(p.recebe)} · lucro {moeda(p.lucro)}{p.lucroSobreCustoPct !== null ? ` (${p.lucroSobreCustoPct.toFixed(0)}%)` : ''}
        {carregando && <Spin size="small" style={{ marginLeft: 4 }} />}
      </Text>
    </Tooltip>
  );
};

/** Botão do preço recomendado para o alvo (final ,90; o mínimo exato no tooltip). */
export const BotaoAlvo: React.FC<{ precoAlvo: number | null; alvoPct: number; atual: number | null; onUsar: (v: number) => void }> = ({ precoAlvo, alvoPct, atual, onUsar }) => {
  if (precoAlvo === null) return null;
  const sugerido = precoComercial(precoAlvo);
  if (atual !== null && Math.abs(atual - sugerido) < 0.005) return null;
  return (
    <Tooltip title={`Preço mínimo para ${alvoPct}% de lucro sobre o custo: ${moeda(precoAlvo)} (já com tarifa e frete do ML). Sugerido com final ,90.`}>
      <Button size="small" type="link" icon={<AimOutlined />} style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onUsar(sugerido)}>
        {alvoPct}%: {moeda(sugerido)}
      </Button>
    </Tooltip>
  );
};

/**
 * Preço no ML editável na linha, com o resultado ao vivo: enquanto digita, mostra quanto você recebe e o lucro; o botão do
 * alvo põe o preço recomendado. Confirma com ✓ ou Enter (Esc desfaz).
 */
export const PrecoRapido: React.FC<{
  idAnuncio: number; idItem: number; valor: number; proprio: boolean; atual?: FinanceiroItem; onSalvar: (v: number) => Promise<void>;
}> = ({ idAnuncio, idItem, valor, proprio, atual, onSalvar }) => {
  const [v, setV] = useState<number | null>(valor);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setV(valor); }, [valor]);
  const mudou = v !== null && Math.abs(v - valor) >= 0.005;
  const { previsao, carregando } = usePrevisaoPreco(idAnuncio, idItem, v, mudou);
  const confirmar = async () => {
    if (!mudou || !v || v <= 0) return;
    setSalvando(true);
    try { await onSalvar(v); } finally { setSalvando(false); }
  };
  const precoAlvo = atual?.precoAlvo ?? previsao?.precoAlvo ?? null;
  const abaixoDoAlvo = atual ? atual.nivel === 'PREJUIZO' || atual.nivel === 'BAIXO' : false;
  return (
    <div style={{ lineHeight: 1.3 }}>
      <Space.Compact size="small" style={{ width: mudou ? 172 : 112 }}>
        <Tooltip title={proprio ? 'Preço só do ML' : 'Preço do ERP com o ajuste do anúncio. Mudar aqui grava um preço só do ML.'}>
          <InputNumber
            size="small" prefix="R$" min={0.01} step={0.5} precision={2} decimalSeparator="," value={v} onChange={setV} style={{ width: 112 }}
            onPressEnter={confirmar} onKeyDown={e => { if (e.key === 'Escape') setV(valor); }}
          />
        </Tooltip>
        {mudou && <Tooltip title="Salvar e enviar ao ML"><Button size="small" type="primary" icon={<CheckOutlined />} loading={salvando} onClick={confirmar} /></Tooltip>}
        {mudou && <Tooltip title="Desfazer"><Button size="small" icon={<CloseOutlined />} disabled={salvando} onClick={() => setV(valor)} /></Tooltip>}
      </Space.Compact>
      {mudou && <div><LinhaPrevisao p={previsao} carregando={carregando} /></div>}
      {(mudou || abaixoDoAlvo) && (
        <div><BotaoAlvo precoAlvo={precoAlvo} alvoPct={atual?.alvoPct ?? previsao?.alvoPct ?? 30} atual={v} onUsar={setV} /></div>
      )}
    </div>
  );
};

/** Estoque ERP → ML; clicando, muda a reserva da loja e o teto no ML do anúncio. */
export const EstoqueRapido: React.FC<{
  erp: number; ml: number; noMl: boolean; reserva: number; maximo: number | null;
  onSalvar: (r: { estoqueReserva: number; estoqueMaximo: number | null }) => Promise<void>;
}> = ({ erp, ml, noMl, reserva, maximo, onSalvar }) => {
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState<number | null>(reserva);
  const [m, setM] = useState<number | null>(maximo);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setR(reserva); setM(maximo); } }, [aberto, reserva, maximo]);
  const salvar = async () => {
    setSalvando(true);
    try { await onSalvar({ estoqueReserva: r ?? 0, estoqueMaximo: m ?? null }); setAberto(false); } finally { setSalvando(false); }
  };
  return (
    <Popover
      trigger="click" open={aberto} onOpenChange={setAberto} title="Estoque no Mercado Livre" destroyOnHidden
      content={(
        <Space direction="vertical" size={8} style={{ width: 260 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Vale para os itens do anúncio sem regra própria. Ao salvar, o estoque novo já vai ao ML.</Text>
          <Flex gap={8}>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: 12 }}>Reserva da loja</Text>
              <InputNumber style={{ width: '100%' }} min={0} precision={0} value={r} onChange={setR} />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: 12 }}>Teto no ML</Text>
              <InputNumber style={{ width: '100%' }} min={0} precision={0} value={m} onChange={setM} placeholder="sem teto" />
            </div>
          </Flex>
          <Flex justify="end" gap={8}>
            <Button size="small" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button size="small" type="primary" loading={salvando} onClick={salvar}>Salvar{noMl ? ' e enviar' : ''}</Button>
          </Flex>
        </Space>
      )}
    >
      <Tooltip title="Saldo do ERP → o que vai para o ML (depois da reserva da loja e do teto). Clique para mudar.">
        <div style={{ cursor: 'pointer', lineHeight: 1.25, textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>ERP {erp} →</Text>{' '}
          <Text strong style={{ color: noMl && ml === 0 ? '#cf1322' : undefined }}>ML {ml}</Text>
          {(reserva > 0 || maximo !== null) && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>{reserva > 0 ? `reserva ${reserva}` : ''}{reserva > 0 && maximo !== null ? ' · ' : ''}{maximo !== null ? `teto ${maximo}` : ''}</Text></div>
          )}
        </div>
      </Tooltip>
    </Popover>
  );
};

/** Ativo/pausado no ML (todos os itens do anúncio). */
export const AtivoNoMl: React.FC<{ ativos: number; pausados: number; onMudar: (ativar: boolean) => Promise<void> }> = ({ ativos, pausados, onMudar }) => {
  const [carregando, setCarregando] = useState(false);
  if (ativos + pausados === 0) return <Text type="secondary">—</Text>;
  const mudar = async (ativar: boolean) => {
    setCarregando(true);
    try { await onMudar(ativar); } finally { setCarregando(false); }
  };
  return (
    <Tooltip title={ativos && pausados ? `${ativos} ativo(s), ${pausados} pausado(s)` : ativos ? 'Ativo no ML: clique para pausar' : 'Pausado no ML: clique para reativar'}>
      <Switch size="small" checked={ativos > 0} loading={carregando} onChange={mudar} checkedChildren="ativo" unCheckedChildren="pausado" />
    </Tooltip>
  );
};

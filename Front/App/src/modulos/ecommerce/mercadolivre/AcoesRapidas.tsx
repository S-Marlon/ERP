// Ações rápidas da lista de anúncios: preço na linha (confirma com ✓), estoque que vai ao ML (reserva e teto) e
// ativo/pausado no ML. Cada uma grava na hora e já manda ao Mercado Livre.
import React, { useEffect, useState } from 'react';
import { Button, Flex, InputNumber, Popover, Space, Switch, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

/** Preço editável na linha: aparece ✓/✕ quando muda; Enter confirma, Esc desfaz. */
export const PrecoRapido: React.FC<{ valor: number; proprio: boolean; onSalvar: (v: number) => Promise<void> }> = ({ valor, proprio, onSalvar }) => {
  const [v, setV] = useState<number | null>(valor);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setV(valor); }, [valor]);
  const mudou = v !== null && Math.abs(v - valor) >= 0.005;
  const confirmar = async () => {
    if (!mudou || !v || v <= 0) return;
    setSalvando(true);
    try { await onSalvar(v); } finally { setSalvando(false); }
  };
  return (
    <Space.Compact size="small" style={{ width: mudou ? 172 : 112 }}>
      <Tooltip title={proprio ? 'Preço só do ML' : 'Preço do ERP com o ajuste do anúncio. Mudar aqui grava um preço só do ML.'}>
        <InputNumber
          size="small" prefix="R$" min={0.01} step={0.5} precision={2} decimalSeparator="," value={v} onChange={setV} style={{ width: 112 }}
          onPressEnter={confirmar} onKeyDown={e => { if (e.key === 'Escape') setV(valor); }}
        />
      </Tooltip>
      {mudou && <Button size="small" type="primary" icon={<CheckOutlined />} loading={salvando} onClick={confirmar} />}
      {mudou && <Button size="small" icon={<CloseOutlined />} disabled={salvando} onClick={() => setV(valor)} />}
    </Space.Compact>
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

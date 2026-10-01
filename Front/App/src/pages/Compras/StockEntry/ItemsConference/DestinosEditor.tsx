// Destino da linha da NF no estoque. O tipo de entrada define o depósito:
// produto de venda -> Venda (pode separar parte para o Almoxarifado, ex.: 30 graxas = 20 venda + 10 uso interno),
// consumo/insumo -> Almoxarifado, ativo -> Patrimônio. null = tudo no depósito do tipo.
import React, { useEffect, useState } from 'react';
import { Button, InputNumber, Popover, Space, Tag, Tooltip, Typography } from 'antd';
import { ScissorOutlined, WarningOutlined } from '@ant-design/icons';

import { DEPOSITOS, Deposito, DestinoLinha, depositoPadraoDoTipo, destinoIncompativel, destinosEfetivos, podeSepararUsoInterno } from '../depositos';
export { DEPOSITOS, depositoPadraoDoTipo, destinosEfetivos };
export type { Deposito, DestinoLinha };

interface Props {
  destinos: DestinoLinha[] | null | undefined;
  recebida: number;
  unidade?: string;
  tipoRecurso?: string | null;
  readOnly?: boolean;
  onChange: (destinos: DestinoLinha[] | null) => void;
}

const arred = (v: number) => Number(v.toFixed(4));

export const DestinosEditor: React.FC<Props> = ({ destinos, recebida, unidade, tipoRecurso, readOnly, onChange }) => {
  const [aberto, setAberto] = useState(false);
  const usoInternoAtual = (destinos || []).find(d => d.deposito === 'ALMOXARIFADO')?.quantidade || 0;
  const [usoInterno, setUsoInterno] = useState<number>(usoInternoAtual);
  useEffect(() => { if (aberto) setUsoInterno(usoInternoAtual); }, [aberto]);

  const padrao = depositoPadraoDoTipo(tipoRecurso);
  const un = unidade || 'un';

  // Destino salvo que não combina com o tipo atual (ex.: tipo trocado depois): avisa e oferece voltar ao padrão
  if (destinoIncompativel(destinos, tipoRecurso)) {
    return (
      <Tooltip title={`O destino salvo não combina com o tipo de entrada. Clique para mandar tudo para ${DEPOSITOS[padrao].label}.`}>
        <Tag color="red" icon={<WarningOutlined />} style={{ margin: 0, cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => onChange(null)}>
          Destino incompatível
        </Tag>
      </Tooltip>
    );
  }

  const efetivos = destinosEfetivos(destinos, recebida, tipoRecurso);
  const separavel = podeSepararUsoInterno(tipoRecurso);
  const venda = arred(recebida - (usoInterno || 0));
  const valido = usoInterno >= 0 && usoInterno < recebida;

  const editor = (
    <Space direction="vertical" size={8} style={{ width: 280 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Parte dos {recebida} {un} recebidos vai para uso interno da empresa (almoxarifado), o resto fica para venda.
        Tudo entra pelo custo da nota.
      </Typography.Text>
      <Space>
        <span style={{ fontSize: 12 }}>Uso interno:</span>
        <InputNumber size="small" min={0} max={recebida} value={usoInterno} onChange={v => setUsoInterno(Number(v) || 0)} addonAfter={un} style={{ width: 130 }} />
      </Space>
      <Typography.Text style={{ fontSize: 12, color: valido ? '#16a34a' : '#dc2626' }}>
        {valido ? `Venda: ${venda} ${un} · Almoxarifado: ${usoInterno || 0} ${un}` : 'Deixe ao menos uma unidade para venda (ou mude o tipo para Consumo).'}
      </Typography.Text>
      <Space>
        <Button size="small" type="primary" disabled={!valido}
          onClick={() => {
            onChange(usoInterno > 0 ? [{ deposito: 'VENDA', quantidade: venda }, { deposito: 'ALMOXARIFADO', quantidade: arred(usoInterno) }] : null);
            setAberto(false);
          }}>
          Aplicar
        </Button>
        {usoInternoAtual > 0 && <Button size="small" onClick={() => { onChange(null); setAberto(false); }}>Tudo para venda</Button>}
        <Button size="small" type="text" onClick={() => setAberto(false)}>Cancelar</Button>
      </Space>
    </Space>
  );

  return (
    <Space size={4} wrap>
      {efetivos.map(d => (
        <Tooltip key={d.deposito} title={separavel ? DEPOSITOS[d.deposito].ajuda : `${DEPOSITOS[d.deposito].ajuda}. Definido pelo tipo de entrada.`}>
          <Tag color={DEPOSITOS[d.deposito].color} style={{ margin: 0, fontSize: 11 }}>
            {DEPOSITOS[d.deposito].label}{efetivos.length > 1 ? ` ${d.quantidade}` : ''}
          </Tag>
        </Tooltip>
      ))}
      {separavel && !readOnly && recebida > 0 && (
        <Popover content={editor} title="Separar parte para uso interno" trigger="click" open={aberto} onOpenChange={setAberto}>
          <Tooltip title="Separar parte para uso interno (almoxarifado)">
            <Button size="small" type="text" icon={<ScissorOutlined />} />
          </Tooltip>
        </Popover>
      )}
    </Space>
  );
};

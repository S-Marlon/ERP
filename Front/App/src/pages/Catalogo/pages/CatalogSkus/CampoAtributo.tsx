// Campo de edição de um atributo pelo tipo (lista, número, sim/não, data, texto).
// Usado na Ficha Técnica do catálogo e na classificação do item novo na entrada de NF.
import { DatePicker, Input, InputNumber, Select, Switch, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { AtributoFicha } from './CatalogSku.service';

export const PAPEL_ATRIBUTO: Record<string, { label: string; color: string; ordem: number; ajuda: string }> = {
  dna: { label: 'DNA', color: 'blue', ordem: 0, ajuda: 'Igual para toda a família' },
  grade: { label: 'Grade', color: 'purple', ordem: 1, ajuda: 'Diferencia os SKUs da família (ex.: tamanho, voltagem)' },
  ficha: { label: 'Ficha', color: 'cyan', ordem: 2, ajuda: 'Informação técnica do item' },
};

export const ordenarPorPapel = (lista: AtributoFicha[]) =>
  [...lista].sort((x, y) => (PAPEL_ATRIBUTO[x.papel]?.ordem ?? 9) - (PAPEL_ATRIBUTO[y.papel]?.ordem ?? 9));

export const valorVazio = (valor: unknown) => valor === null || valor === undefined || String(valor).trim() === '';

interface Props {
  atributo: AtributoFicha;
  valor: unknown;
  onChange: (valor: unknown) => void;
  disabled?: boolean;
}

export default function CampoAtributo({ atributo: a, valor, onChange, disabled }: Props) {
  if (a.valorFixo) {
    return <Typography.Text>{a.valorFixo} <Tag style={{ marginLeft: 4 }}>fixo da família</Tag></Typography.Text>;
  }
  const vazio = valorVazio(valor);
  const status = a.obrigatorio && vazio ? 'warning' as const : undefined;
  switch (a.tipo) {
    case 'lista':
      return (
        <Select size="small" allowClear style={{ width: '100%' }} status={status} placeholder="Selecione" disabled={disabled}
          value={vazio ? undefined : String(valor)} options={a.opcoes.map(o => ({ value: o, label: o }))}
          onChange={v => onChange(v ?? null)} />
      );
    case 'numero':
    case 'decimal':
      return (
        <InputNumber size="small" style={{ width: '100%' }} status={status} precision={a.tipo === 'numero' ? 0 : undefined} disabled={disabled}
          value={vazio ? null : Number(valor)} onChange={v => onChange(v ?? null)} decimalSeparator="," />
      );
    case 'boolean':
      return <Switch size="small" disabled={disabled} checked={String(valor) === 'Sim' || valor === true} onChange={v => onChange(v ? 'Sim' : 'Não')} />;
    case 'data':
      return (
        <DatePicker size="small" format="DD/MM/YYYY" status={status} disabled={disabled} value={vazio ? null : dayjs(String(valor))}
          onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)} />
      );
    default:
      return <Input size="small" status={status} disabled={disabled} value={vazio ? '' : String(valor)} onChange={e => onChange(e.target.value)} />;
  }
}

// Seletor de categoria com caminho longo (Pai › Filha › Neta): a categoria final aparece em destaque e os
// níveis acima em cinza, para o texto cortado ser o dos níveis de cima e nunca o da categoria escolhida.
import React, { useMemo } from 'react';
import { Select } from 'antd';

export interface CategoriaCaminho { id: number; caminho: string }

const partesDoCaminho = (caminho: string) => {
  const partes = caminho.split(' › ');
  return { folha: partes[partes.length - 1] || caminho, acima: partes.slice(0, -1).join(' › ') };
};

interface Props {
  categorias: CategoriaCaminho[];
  // value/onChange também vêm do Form.Item quando usado dentro de um formulário
  value?: number | null;
  onChange?: (valor: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export const SeletorCategoria: React.FC<Props> = ({ categorias, value, onChange, placeholder, disabled, size }) => {
  const opcoes = useMemo(() => categorias.map(c => ({ value: c.id, label: c.caminho })), [categorias]);
  return (
    <Select
      size={size}
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: '100%' }}
      value={value ?? undefined}
      onChange={v => onChange?.(v ?? null)}
      popupMatchSelectWidth={420}
      options={opcoes}
      labelRender={({ label, value: v }) => {
        const caminho = String(label ?? v ?? '');
        const { folha, acima } = partesDoCaminho(caminho);
        return (
          <span title={caminho}>
            <b>{folha}</b>
            {acima && <span style={{ color: '#8c8c8c', fontSize: '0.9em' }}> · {acima}</span>}
          </span>
        );
      }}
      optionRender={op => {
        const { folha, acima } = partesDoCaminho(String(op.label ?? ''));
        return (
          <div style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 500 }}>{folha}</div>
            {acima && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{acima}</div>}
          </div>
        );
      }}
    />
  );
};

export default SeletorCategoria;

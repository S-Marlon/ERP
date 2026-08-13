import React from 'react';
import { AtributoComercial, AtributoValor } from '../../../../types/produto';

interface Props {
  atributos: AtributoComercial[];
  valoresState: Record<number, Partial<AtributoValor>>;
  onChange: (atributoId: number, novoValor: Partial<AtributoValor>) => void;
}

export const FormAtributosDinamicos: React.FC<Props> = ({ atributos, valoresState, onChange }) => {

  const handleInputChange = (atributo: AtributoComercial, value: any) => {
    const payload: Partial<AtributoValor> = {
      atributo_id: atributo.id,
      valor_texto: undefined,
      valor_numero: undefined,
      valor_decimal: undefined,
      valor_boolean: undefined,
      valor_data: undefined,
      opcao_id: undefined,
    };

    switch (atributo.tipo) {
      case 'texto':
        payload.valor_texto = value;
        break;
      case 'numero':
        payload.valor_numero = value !== '' ? Number(value) : undefined;
        break;
      case 'decimal':
        payload.valor_decimal = value !== '' ? parseFloat(value) : undefined;
        break;
      case 'boolean':
        payload.valor_boolean = Boolean(value);
        break;
      case 'lista':
        payload.opcao_id = value !== '' ? Number(value) : undefined;
        break;
      case 'data':
        payload.valor_data = value;
        break;
    }

    onChange(atributo.id, payload);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {atributos.map((attr) => {
        const valAtual = valoresState[attr.id] || {};

        return (
          <div key={attr.id} className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              {attr.nome} {attr.sufixo && <span className="text-gray-500">({attr.sufixo})</span>}
              {attr.obrigatorio_padrao && <span className="text-red-500">*</span>}
            </label>

            {/* Renderização baseada no `tipo` do banco */}
            {attr.tipo === 'texto' && (
              <input
                type="text"
                value={valAtual.valor_texto || ''}
                onChange={(e) => handleInputChange(attr, e.target.value)}
                className="border p-2 rounded"
              />
            )}

            {(attr.tipo === 'numero' || attr.tipo === 'decimal') && (
              <input
                type="number"
                step={attr.tipo === 'decimal' ? '0.01' : '1'}
                value={attr.tipo === 'decimal' ? valAtual.valor_decimal ?? '' : valAtual.valor_numero ?? ''}
                onChange={(e) => handleInputChange(attr, e.target.value)}
                className="border p-2 rounded"
              />
            )}

            {attr.tipo === 'boolean' && (
              <input
                type="checkbox"
                checked={!!valAtual.valor_boolean}
                onChange={(e) => handleInputChange(attr, e.target.checked)}
                className="h-5 w-5"
              />
            )}

            {attr.tipo === 'lista' && (
              <select
                value={valAtual.opcao_id || ''}
                onChange={(e) => handleInputChange(attr, e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Selecione...</option>
                {attr.opcoes?.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.valor}
                  </option>
                ))}
              </select>
            )}

            {attr.tipo === 'data' && (
              <input
                type="date"
                value={valAtual.valor_data ? valAtual.valor_data.split('T')[0] : ''}
                onChange={(e) => handleInputChange(attr, e.target.value)}
                className="border p-2 rounded"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
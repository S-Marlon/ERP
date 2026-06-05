import React, { useState } from "react";
import { showDecompositionModal } from "./showDecompositionModal";

export type UnidadeMedidaNF = 
  // 1. Contagem
  | "UN" | "UND" | "PC" | "DZ" | "CJ" | "KT" | "MLO"
  // 2. Peso
  | "KG" | "GR" | "TON" | "MG"
  // 3. Comprimento e Superfície
  | "MT" | "M2" | "M3" | "CM" | "MM"
  // 4. Volume
  | "L" | "LT" | "ML" | "GL"
  // 5. Embalagem
  | "CX" | "FD" | "RL" | "FR" | "BD" | "LA";

type DecompositionMode = "NONE" | "MULTIPLIER" | "FRACTIONAL" | "VARIANT_LINK";

export interface DecompositionData {
  mode: DecompositionMode;
  unitsPerPackage?: number;
  baseUnit?: UnidadeMedidaNF;
  derivedName?: string;
  derivedSku?: string;
  derivedGtin?: string;
  derivedQuantity?: number;
}

interface Props {
  value: DecompositionData;
  onChange: (data: DecompositionData) => void;
  nfQuantity?: number;
  productName?: string;
  costTotal?: number;
}

const StockDecomposition: React.FC<Props> = ({
  value,
  onChange,
  nfQuantity = 1,
  productName = "",
  costTotal = 0,
}) => {
  const update = (patch: Partial<DecompositionData>) =>
    onChange({ ...value, ...patch });

  const handleOpenModal = () => {
    showDecompositionModal({
      productName,
      nfQuantity,
      unitsPerPackage: value.unitsPerPackage || 1,
      baseUnit: value.baseUnit || "UN",
      derivedName: value.derivedName,
      derivedSku: value.derivedSku,
      derivedGtin: value.derivedGtin,
      costTotal,
      onConfirm: (derivedQuantity, derivedName, derivedSku, derivedGtin) => {
        update({ derivedQuantity, derivedName, derivedSku, derivedGtin });
      },
    });
  };

  const totalDerivedUnits =
    (value.derivedQuantity || nfQuantity) * (value.unitsPerPackage || 1);

  return (
    <div style={containerStyle}>
      <h4 style={titleStyle}>📦 Entrada e Fracionamento</h4>

      {/* MODO */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Tipo de Entrada</label>
        <select
          value={value.mode}
          onChange={(e) => update({ mode: e.target.value as DecompositionMode })}
          style={inputStyle}
        >
          <option value="NONE">Produto simples (NF → Estoque)</option>
          <option value="MULTIPLIER">Caixa → Unidades</option>
          <option value="FRACTIONAL">Produto fracionado (metro/kg)</option>
          <option value="VARIANT_LINK">Vincular a produto existente</option>
        </select>
      </div>

   {(value.mode === "MULTIPLIER" || value.mode === "FRACTIONAL") && (
  <>
    {/* Novo campo de Unidade de Medida */}
    <div style={sectionStyle}>
      <label style={labelStyle}>Unidade de Saída (Estoque)</label>
      <select
        value={value.baseUnit || "UN"}
        onChange={(e) => update({ baseUnit: e.target.value as UnidadeMedidaNF })}
        style={inputStyle}
      >
        <optgroup label="Contagem">
          <option value="UN">Unidade (UN)</option>
          <option value="PC">Peça (PC)</option>
          <option value="CJ">Conjunto (CJ)</option>
        </optgroup>
        <optgroup label="Peso/Volume">
          <option value="KG">Quilograma (KG)</option>
          <option value="GR">Grama (GR)</option>
          <option value="LT">Litro (LT)</option>
          <option value="MT">Metro (MT)</option>
        </optgroup>
        {/* Adicione outras conforme sua necessidade ou use um .map() */}
      </select>
    </div>

    <div style={sectionStyle}>
      <label style={labelStyle}>Qtd. por Embalagem</label>
      <input
        type="number"
        value={value.unitsPerPackage || ""}
        onChange={(e) => update({ unitsPerPackage: Number(e.target.value) })}
        placeholder="Ex: 12 (itens por caixa)"
        style={inputStyle}
      />
    </div>

    <button
      type="button"
      onClick={handleOpenModal}
      style={{ ...buttonStyle, marginTop: 12 }}
    >
      Abrir fracionamento / derivado
    </button>
  </>
)}

      {/* PREVIEW */}
      <div style={previewStyle}>
        <strong>Resumo de Estoque:</strong>
        <div>NF: {nfQuantity} caixa(s)</div>

        {value.derivedQuantity !== undefined && (
          <>
            <div>
              Produto derivado (padrão): {totalDerivedUnits}{" "}
              {value.baseUnit || "UN"}
            </div>
            <div>
              Opção de vender conjunto: {nfQuantity} caixa(s), GTIN do
              principal: {value.derivedGtin || "-"}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StockDecomposition;

// ------------------ Estilos ------------------
const containerStyle: React.CSSProperties = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  marginBottom: 16,
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 14,
  color: "#1e293b",
};
const sectionStyle: React.CSSProperties = { marginBottom: 12 };
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
};
const previewStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  background: "#0f172a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 12,
};
const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
};
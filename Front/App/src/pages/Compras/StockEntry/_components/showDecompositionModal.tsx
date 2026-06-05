// import React, { useState, useEffect } from "react";
// import Swal from "sweetalert2";
// import withReactContent from "sweetalert2-react-content";

// const MySwal = withReactContent(Swal);

// // Definimos os modos de fracionamento
// export type DecompositionMode = "UNIT" | "FRAC"; // UNIT: Caixa->Un, FRAC: Rolo->Metros/Kg

// interface ShowDecompositionModalProps {
//   productName: string;
//   nfQuantity: number; // Qtd de caixas ou rolos na NF
//   unitsPerPackage?: number; // Itens por caixa OU metros por rolo
//   baseUnit?: string; // UN, MT, KG...
//   mode: DecompositionMode;
//   derivedName?: string;
//   derivedSku?: string;
//   derivedGtin?: string;
//   costTotal?: number;
//   onConfirm: (
//     derivedQuantity: number,
//     derivedName: string,
//     derivedSku: string,
//     derivedGtin: string,
//     sellFullBox: boolean
//   ) => void;
// }

// export const showDecompositionModal = (props: ShowDecompositionModalProps) => {
//   let state = {
//     quantity: 0,
//     name: props.derivedName || "",
//     sku: props.derivedSku || "",
//     gtin: props.derivedGtin || "",
//     sellFull: false
//   };

//   MySwal.fire({
//     title: props.mode === "UNIT" ? "📦 Desmembramento de Unidades" : "📏 Fracionamento de Medida",
//     html: (
//       <DecompositionContent
//         {...props}
//         onChange={(qty, name, sku, gtin, sellFull) => {
//           state = { quantity: qty, name, sku, gtin, sellFull };
//         }}
//       />
//     ),
//     showConfirmButton: true,
//     confirmButtonText: "Confirmar Conversão",
//     width: 800,
//     preConfirm: () => state,
//   }).then((result) => {
//     if (result.isConfirmed) {
//       const { quantity, name, sku, gtin, sellFull } = result.value;
//       props.onConfirm(quantity, name, sku, gtin, sellFull);
//     }
//   });
// };

// interface DecompositionContentProps extends ShowDecompositionModalProps {
//   onChange: (qty: number, name: string, sku: string, gtin: string, sellFull: boolean) => void;
// }

// const DecompositionContent: React.FC<DecompositionContentProps> = ({
//   productName,
//   nfQuantity,
//   unitsPerPackage = 1,
//   baseUnit = "UN",
//   mode,
//   derivedName: initialName,
//   derivedSku: initialSku,
//   derivedGtin: initialGtin,
//   costTotal = 0,
//   onChange,
// }) => {
//   const [fractionCount, setFractionCount] = useState(0); // Quantas caixas/rolos da NF vou mexer
//   const [derivedName, setDerivedName] = useState(initialName || `${productName} (${baseUnit})`);
//   const [derivedSku, setDerivedSku] = useState(initialSku || "");
//   const [derivedGtin, setDerivedGtin] = useState(initialGtin || "");
//   const [sellFullBox, setSellFullBox] = useState(false);

//   // Cálculos Automáticos
//   const totalPotentialUnits = nfQuantity * unitsPerPackage; 
//   const currentDerivedUnits = fractionCount * unitsPerPackage;
//   const remainingOriginalPacks = nfQuantity - fractionCount;
//   const unitCost = costTotal > 0 ? (costTotal / totalPotentialUnits).toFixed(2) : "0.00";

//   // Notifica o componente pai sempre que algo mudar
//   useEffect(() => {
//     onChange(currentDerivedUnits, derivedName, derivedSku, derivedGtin, sellFullBox);
//   }, [fractionCount, derivedName, derivedSku, derivedGtin, sellFullBox]);

//   const isFrac = mode === "FRAC";

//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: 'left' }}>
//       <div style={{ display: "flex", gap: 16 }}>
        
//         {/* LADO ESQUERDO: COMO ESTÁ NA NOTA */}
//         <div style={cardStyle("#f8fafc", "#64748b")}>
//           <div style={{ fontSize: "2rem" }}>{isFrac ? "🌀" : "📦"}</div>
//           <h4 style={{ margin: "8px 0" }}>Entrada (NF)</h4>
//           <p style={infoTextStyle}><strong>Produto:</strong> {productName}</p>
//           <p style={infoTextStyle}><strong>Qtd Nota:</strong> {nfQuantity} {isFrac ? 'Rolo(s)/Bobina' : 'Caixa(s)'}</p>
//           <p style={infoTextStyle}><strong>Conteúdo:</strong> {unitsPerPackage} {baseUnit} por volume</p>
          
//           <div style={{ marginTop: 15 }}>
//              <ProgressBar percent={(remainingOriginalPacks / nfQuantity) * 100} color="#3b82f6" />
//              <small>{remainingOriginalPacks} vol. mantidos no original</small>
//           </div>
//         </div>

//         {/* LADO DIREITO: O QUE SERÁ GERADO */}
//         <div style={cardStyle("#fffbeb", "#d97706")}>
//           <div style={{ fontSize: "2rem" }}>{isFrac ? "✂️" : "🛒"}</div>
//           <h4 style={{ margin: "8px 0" }}>Derivado (Venda)</h4>

//           <label style={labelStyle}>Nome para Venda</label>
//           <input value={derivedName} onChange={(e) => setDerivedName(e.target.value)} style={inputStyle} />

//           <div style={{ display: 'flex', gap: 8 }}>
//             <div style={{ flex: 1 }}>
//               <label style={labelStyle}>SKU</label>
//               <input value={derivedSku} onChange={(e) => setDerivedSku(e.target.value)} style={inputStyle} />
//             </div>
//             <div style={{ flex: 1 }}>
//               <label style={labelStyle}>EAN</label>
//               <input value={derivedGtin} onChange={(e) => setDerivedGtin(e.target.value)} style={inputStyle} />
//             </div>
//           </div>

//           <div style={{ background: '#fff', padding: 8, borderRadius: 8, marginTop: 10, border: '1px solid #fcd34d' }}>
//             <p style={{ margin: 0, fontSize: 13 }}><strong>Total a gerar:</strong> {currentDerivedUnits} {baseUnit}</p>
//             <p style={{ margin: 0, fontSize: 13 }}><strong>Custo {baseUnit}:</strong> R$ {unitCost}</p>
//           </div>

//           <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', fontSize: 12 }}>
//             <input type="checkbox" checked={sellFullBox} onChange={(e) => setSellFullBox(e.target.checked)} />
//             <label style={{ marginLeft: 6 }}>Vender embalagem completa também?</label>
//           </div>
//         </div>
//       </div>

//       {/* CONTROLE DE QUANTIDADE */}
//       <div style={sliderContainerStyle}>
//         <label style={{ fontWeight: 600, marginBottom: 10 }}>
//           {isFrac 
//             ? `Quantos rolos/volumes deseja converter em ${baseUnit}?` 
//             : `Quantas caixas deseja abrir para vender por ${baseUnit}?`}
//         </label>
//         <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 15 }}>
//             <input
//                 type="range"
//                 min={0}
//                 max={nfQuantity}
//                 step={1}
//                 value={fractionCount}
//                 onChange={(e) => setFractionCount(Number(e.target.value))}
//                 style={{ flex: 1, cursor: 'pointer' }}
//             />
//             <span style={badgeStyle}>{fractionCount} vol.</span>
//         </div>
//         <p style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>
//             Isso resultará em <strong>{currentDerivedUnits} {baseUnit}</strong> disponíveis para venda individual.
//         </p>
//       </div>
//     </div>
//   );
// };

// // --- Estilos Auxiliares ---
// const cardStyle = (bg: string, border: string): React.CSSProperties => ({
//   flex: 1,
//   background: bg,
//   padding: 16,
//   borderRadius: 12,
//   border: `1px solid ${border}33`,
//   boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
// });

// const infoTextStyle: React.CSSProperties = { margin: "4px 0", fontSize: 13, color: "#475569" };

// const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#92400e", margin: "8px 0 2px", textTransform: 'uppercase' };

// const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 };

// const sliderContainerStyle: React.CSSProperties = {
//   background: "#f1f5f9",
//   padding: 20,
//   borderRadius: 12,
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center"
// };

// const badgeStyle: React.CSSProperties = {
//     background: '#2563eb',
//     color: '#fff',
//     padding: '4px 12px',
//     borderRadius: '20px',
//     fontWeight: 'bold',
//     minWidth: '60px',
//     textAlign: 'center'
// };

// const ProgressBar: React.FC<{ percent: number; color: string }> = ({ percent, color }) => (
//   <div style={{ marginTop: 8, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: 'hidden' }}>
//     <div style={{ width: `${percent}%`, height: "100%", background: color, transition: 'width 0.3s ease' }} />
//   </div>
// );


import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export type DecompositionMode = "UNIT" | "FRAC";

interface ShowDecompositionModalProps {
  // Dados do Produto Original (NF)
  productName: string;
  nfQuantity: number;
  unitsPerPackage: number;
  originalSku?: string;
  originalGtin?: string;
  originalNcm?: string;
  costTotal: number;
  baseUnit: string; // Ex: CX, ROLO, PCT
  
  // Dados do Produto Derivado
  derivedUnit: string; // Ex: UN, MT, KG
  mode: DecompositionMode;
  derivedName?: string;
  derivedSku?: string;
  derivedGtin?: string;
  
  onConfirm: (data: any) => void;
}

export const showDecompositionModal = (props: ShowDecompositionModalProps) => {
  let currentState: any = {};

  MySwal.fire({
    title: "🛠️ Configurar Derivação de Produto",
    html: (
      <DecompositionContent
        {...props}
        onChange={(data) => { currentState = data; }}
      />
    ),
    showConfirmButton: true,
    showDenyButton: true,
    denyButtonText: "Cancelar",
    confirmButtonText: "Salvar e Fracionar",
    width: 900,
    preConfirm: () => currentState,
  }).then((result) => {
    if (result.isConfirmed) props.onConfirm(result.value);
  });
};

const DecompositionContent: React.FC<DecompositionContentProps> = (props) => {
 // Produto Original (Pai)
  const [origName, setOrigName] = useState(props.productName);
  const [origSku, setOrigSku] = useState(props.originalSku || "");
  const [origGtin, setOrigGtin] = useState(props.originalGtin || "");

  // Novos estados para controle de escala
const [unitsPerPack, setUnitsPerPack] = useState(props.unitsPerPackage || 1);
const [derivedUnit, setDerivedUnit] = useState(props.derivedUnit || "UN");

  // Produto Derivado (Filho)
  const [derName, setDerName] = useState(props.derivedName || "");
  const [derSku, setDerSku] = useState(props.derivedSku || "");
  const [derGtin, setDerGtin] = useState(props.derivedGtin || "");
  const [fractionCount, setFractionCount] = useState(0);
  const [sellFullBox, setSellFullBox] = useState(true);

  // Cálculos
  const totalPotentialUnits = props.nfQuantity * unitsPerPack;
  const currentDerivedUnits = fractionCount * unitsPerPack;
  const unitCost = props.costTotal > 0 ? (props.costTotal / totalPotentialUnits).toFixed(2) : "0.00";

  const totalVendaDisponivel = (props.nfQuantity * unitsPerPack).toFixed(2);


  // Lógica de Sugestão Automática
  useEffect(() => {
    // Se o usuário ainda não digitou um nome/sku pro derivado, sugerimos um baseado no pai
    if (!derName) {
      const suffix = props.mode === 'UNIT' ? '(UN)' : '(FRAC)';
      setDerName(`${origName} ${suffix}`);
    }
    if (!derSku && origSku) {
      setDerSku(`${origSku}-1`); // Sugestão: SKU do pai com sufixo -1 ou -UN
    }
    // O GTIN geralmente é o mesmo se não houver um EAN específico para a unidade
    if (!derGtin) setDerGtin(origGtin); 
  }, [origName, origSku]);

  


return (
  <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: 'left' }}>
    
    <div style={{ display: "flex", gap: 20 }}>
      
      {/* CARD ESQUERDO: O PAI (ORIGEM) */}
      <div style={cardStyle("#f8fafc", "#334155")}>
        <header style={headerStyle}>📦 Entrada (Atacado/Volume)</header>
        
        <label style={labelStyle}>Nome do Produto Base</label>
        <input value={origName} onChange={e => setOrigName(e.target.value)} style={inputStyle} />

        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>SKU Base</label>
            <input value={origSku} onChange={e => setOrigSku(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>GTIN/EAN Barra</label>
            <input value={origGtin} onChange={e => setOrigGtin(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Qtd. Recebida</label>
            <div style={readOnlyBox}>{props.nfQuantity} {props.baseUnit}</div>
          </div>
          <div>
            <label style={labelStyle}>Fator de Conversão</label>
            <input 
              type="number" 
              value={unitsPerPack} 
              onChange={e => setUnitsPerPack(Number(e.target.value))} 
              style={{...inputStyle, fontWeight: 'bold', color: '#2563eb'}} 
            />
          </div>
        </div>
        <small style={{fontSize: 10, color: '#64748b'}}>* Quantos(as) {derivedUnit} existem em 1 {props.baseUnit}?</small>
      </div>

      {/* SETA DE VÍNCULO */}
      <div style={{display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '24px'}}> ➔ </div>

      {/* CARD DIREITO: O FILHO (DERIVADO) */}
      <div style={cardStyle("#fffbeb", "#b45309")}>
        <header style={headerStyle}>✂️ Saída (Venda Unitária)</header>

        <label style={labelStyle}>Nome para o PDV</label>
        <input value={derName} onChange={e => setDerName(e.target.value)} style={{...inputStyle, borderColor: '#fcd34d'}} />

        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>SKU Derivado</label>
            <input value={derSku} onChange={e => setDerSku(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Unidade de Venda</label>
            <select 
              value={derivedUnit} 
              onChange={e => setDerivedUnit(e.target.value)} 
              style={inputStyle}
            >
              <option value="UN">Unidade (UN)</option>
              <option value="MT">Metros (MT)</option>
              <option value="KG">Quilos (KG)</option>
              <option value="PCT">Pacote (PCT)</option>
              <option value="L">Litros (L)</option>
            </select>
          </div>
        </div>

        <div style={gridStyle}>
            <div>
              <label style={labelStyle}>GTIN Unitário</label>
              <input value={derGtin} onChange={e => setDerGtin(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Custo p/ {derivedUnit}</label>
              <div style={{...readOnlyBox, color: '#16a34a'}}>R$ {unitCost}</div>
            </div>
        </div>
      </div>
    </div>

    {/* RESUMO DA OPERAÇÃO */}
    <div style={summaryContainerStyle}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <div style={{fontSize: '20px'}}>📊</div>
        <div>
          <h5 style={{margin: 0, color: '#1e293b'}}>Resumo da Conversão de Estoque</h5>
          <p style={{margin: 0, fontSize: 12, color: '#64748b'}}>
            Ao finalizar, o sistema converterá <strong>{props.nfQuantity} {props.baseUnit}</strong> em 
            <strong style={{color: '#2563eb'}}> {totalVendaDisponivel} {derivedUnit}</strong> para venda fracionada.
          </p>
        </div>
      </div>
      <div style={{textAlign: 'right'}}>
        <span style={{fontSize: 11, display: 'block', color: '#64748b'}}>TOTAL PARA VENDA</span>
        <span style={{fontSize: 22, fontWeight: 'bold', color: '#1e293b'}}>{totalVendaDisponivel} <small>{derivedUnit}</small></span>
      </div>
    </div>
  </div>
);


};

// --- Novos Estilos ---
const readOnlyBox: React.CSSProperties = {
  background: '#fff',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  height: '35px'
};

const summaryContainerStyle: React.CSSProperties = {
  background: '#f1f5f9',
  padding: '16px 20px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

// --- Novos Estilos ---
const infoRowStyle: React.CSSProperties = { 
  marginTop: 10, 
  display: 'flex', 
  justifyContent: 'space-between', 
  fontSize: 11, 
  color: '#64748b',
  background: '#fff',
  padding: '4px 8px',
  borderRadius: '4px'
};

const statsBadge: React.CSSProperties = {
  background: '#fff',
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};

// --- Estilos Adicionais ---
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', marginBottom: 12, borderBottom: '1px solid #ddd', paddingBottom: 5 };
const sliderBoxStyle: React.CSSProperties = { background: '#f1f5f9', padding: '15px 25px', borderRadius: 12, border: '1px solid #e2e8f0' };

const cardStyle = (bg: string, border: string): React.CSSProperties => ({
  flex: 1, background: bg, padding: 16, borderRadius: 12, border: `1px solid ${border}44`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
});

const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, color: "#64748b", margin: "8px 0 2px", textTransform: 'uppercase', letterSpacing: '0.5px' };

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, outline: 'none' };
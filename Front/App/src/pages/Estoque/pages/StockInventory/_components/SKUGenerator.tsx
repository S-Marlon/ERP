import React, { useState, useMemo } from 'react';

const PRODUCT_CATEGORIES = {
  TERM: { label: 'Terminal Prensável', prefix: 'TP' },
  ADAPT: { label: 'Adaptador', prefix: 'AD' },
  FERRULE: { label: 'Capa (Ferrule)', prefix: 'CP' },
};

const GENDERS = {
  M: { label: 'Macho', code: 'M' },
  F: { label: 'Fêmea Fixa', code: 'F' },
  FJ: { label: 'Fêmea Giratória', code: 'FJ' }, // Alterado de FG para FJ
};

const CONNECTIONS = {
  JIC: { label: 'JIC (37°)', code: 'J' }, // Reduzido para 'J' para compor FJ
  BSP: { label: 'BSP (60°)', code: 'B' },
  NPT: { label: 'NPT (Cônica)', code: 'N' },
  ORFS: { label: 'ORFS (Face Plana)', code: 'O' },
};

const HOSE_TYPES = {
  R1: { label: '1 Trama', code: 'R1' },
  R2: { label: '2 Tramas', code: 'R2' },
  R12: { label: '4 Tramas', code: 'R12' },
};

export default function SKUGeneratorV4() {
  const [category, setCategory] = useState('TERM');
  const [connection, setConnection] = useState('JIC');
  const [gender, setGender] = useState('FJ');
  const [hoseType, setHoseType] = useState('R2');
  const [angle, setAngle] = useState('90');
  const [sideA, setSideA] = useState('20'); // Rosca
  const [sideB, setSideB] = useState('16'); // Mangueira

  const sku = useMemo(() => {
    const p = PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES].prefix;
    
    if (category === 'FERRULE') {
      return `${p}${hoseType}-${sideB}`;
    }

    // Lógica para ângulo: Se for reto (00), não exibe número.
    const angleCode = angle === '00' ? '' : angle;
    
    // Padrão solicitado: TP + 90 + FJ + -MANGUEIRA + -ROSCA
    // Ex: TP90FJ-16-20
    return `${p}${gender}${angleCode}-${sideA}-${sideB}`;
  }, [category, connection, gender, hoseType, angle, sideA, sideB]);

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', padding: '30px', maxWidth: '850px', margin: 'auto', backgroundColor: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', color: '#2d3748' }}>
      <h2 style={{ color: '#1a365d', marginBottom: '20px', borderBottom: '3px solid #3182ce', display: 'inline-block' }}>Gerador de SKU Hidráulico v4.0</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        
        <section>
          <label style={labelStyle}>Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {Object.entries(PRODUCT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </section>

        {category !== 'FERRULE' && (
          <section>
            <label style={labelStyle}>Gênero/Tipo</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} style={selectStyle}>
              {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={v.code}>{v.label}</option>)}
            </select>
          </section>
        )}

        {category !== 'FERRULE' && (
          <section>
            <label style={labelStyle}>Ângulo</label>
            <select value={angle} onChange={(e) => setAngle(e.target.value)} style={selectStyle}>
              <option value="00">Reto (00)</option>
              <option value="45">45°</option>
              <option value="90">90°</option>
            </select>
          </section>
        )}

        {category === 'FERRULE' && (
          <section>
            <label style={labelStyle}>Trama</label>
            <select value={hoseType} onChange={(e) => setHoseType(e.target.value)} style={selectStyle}>
              {Object.entries(HOSE_TYPES).map(([k, v]) => <option key={k} value={v.code}>{v.label}</option>)}
            </select>
          </section>
        )}

        <section>
          <label style={labelStyle}>Traço Mangueira</label>
          <input type="text" value={sideB} onChange={(e) => setSideB(e.target.value)} style={inputStyle} />
        </section>

        <section>
          <label style={labelStyle}>Traço Rosca</label>
          <input type="text" value={sideA} onChange={(e) => setSideA(e.target.value)} style={inputStyle} />
        </section>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e0', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>RESULTADO PADRONIZADO</span>
        <h1 style={{ margin: '5px 0', fontSize: '28px', color: '#1e40af', letterSpacing: '2px' }}>{sku}</h1>
      </div>
    </div>
  );
}

const labelStyle = { fontWeight: '600', fontSize: '13px', color: '#4a5568' };
const selectStyle = { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e0', marginTop: '4px' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e0', marginTop: '4px', boxSizing: 'border-box' as const };
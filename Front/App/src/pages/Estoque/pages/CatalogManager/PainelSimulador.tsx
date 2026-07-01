import React from 'react';
import { Grupo } from './CatalogManager.types';
import { obterDicionarioOpcoes } from './CatalogManager.helpers';

interface PainelSimuladorProps {
  grupoSelecionado: Grupo;
  valoresTeste: Record<string, string>;
  onMudancaValorTeste: (id: string, valor: string) => void;
  onAtualizarTemplateComercial: (valor: string) => void;
  onAtualizarTemplateSku: (valor: string) => void;
  onAtualizarSiglaSku: (valor: string) => void;
  onAtualizarSeparadorSku: (valor: string) => void;
  onAtualizarOrdemSku?: (atributoId: string, ordem: number) => void;
  previewNomeSimulado: string;
  previewSkuSimulado: string;
  brandColor?: string;
}

export const PainelSimulador: React.FC<PainelSimuladorProps> = ({
  grupoSelecionado,
  valoresTeste,
  onMudancaValorTeste,
  onAtualizarTemplateComercial,
  onAtualizarTemplateSku,
  onAtualizarSiglaSku,
  onAtualizarSeparadorSku,
  onAtualizarOrdemSku,
  previewNomeSimulado,
  previewSkuSimulado,
  brandColor = '#0050b3'
}) => {

  const handleInjetarToken = (token: string) => {
    const templateAtual = grupoSelecionado.templateNomeComercial || '';
    onAtualizarTemplateComercial(`${templateAtual}${token}`);
  };

  return (
    <section style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr 1.2fr', 
      gap: '20px', 
      marginTop: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>

      {/* COLUNA 1: ENGENHARIA DE NOME COMERCIAL */}
      <div style={{ 
        background: '#11161d', 
        border: '1px solid #1e293b',
        borderLeft: `4px solid ${brandColor}`, 
        borderRadius: '8px', 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        {/* 🔥 Corrigido aqui de 'fontSi' para 'fontSize' */}
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b' }}>
          ⚙️ Configuração de Nome Comercial
        </div>

        {/* Display de Visualização */}
        <div style={{ background: '#0b0f14', borderRadius: '6px', padding: '12px 16px', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>🖥️ Preview do Nome Compilado</span>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#38bdf8', wordBreak: 'break-all' }}>
            {previewNomeSimulado || 'Aguardando parâmetros...'}
          </div>
        </div>

        {/* Form Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#94a3b8', fontWeight: 600, fontSize: '11px' }}>Template de Nome Comercial</label>
          <input
            type="text"
            value={grupoSelecionado.templateNomeComercial || ''}
            onChange={e => onAtualizarTemplateComercial(e.target.value)}
            style={{ height: '34px', border: '1px solid #334155', borderRadius: '6px', padding: '0 12px', fontSize: '13px', color: '#f8fafc', backgroundColor: '#0b0f14', width: '100%', boxSizing: 'border-box', outline: 'none' }}
            placeholder="Ex: {GRUPO} {POTENCIA}HP"
          />
        </div>

        {/* Injetores */}
        <div style={{ background: '#0b0f14', border: '1px solid #1e293b', borderRadius: '6px', padding: '12px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
            Tokens de Injeção Dinâmica
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <code
              onClick={() => handleInjetarToken('{GRUPO}')}
              style={{ padding: '4px 8px', background: '#334155', border: '1px solid #475569', borderRadius: '4px', fontSize: '11px', color: '#f8fafc', fontWeight: 600, fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.15s' }}
              title="Injetar Nome do Grupo"
            >
              {'{GRUPO}'}
            </code>

            {grupoSelecionado.atributos.map(attr => (
              <code
                key={attr.id}
                onClick={() => handleInjetarToken(`{${attr.nome}}`)}
                style={{ padding: '4px 8px', background: '#0369a1', border: '1px solid #0284c7', borderRadius: '4px', fontSize: '11px', color: '#f0f9ff', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}
                title={`Injetar {${attr.nome}}`}
              >
                {`{${attr.nome}}`}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* COLUNA 2: MOTOR DE GERAÇÃO DE SKU */}
      <div style={{ 
        background: '#11161d', 
        border: '1px solid #1e293b',
        borderLeft: '4px solid #00a76f', 
        borderRadius: '8px', 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b' }}>
          ⚙️ Motor de Geração de SKU
        </div>

        {/* Display de Visualização */}
        <div style={{ background: '#0b0f14', borderRadius: '6px', padding: '12px 16px', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>📦 SKU Resultante</span>
          <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#00a76f', wordBreak: 'break-all' }}>
            {previewSkuSimulado || 'AGUARDANDO_DADOS'}
          </div>
        </div>

        {/* Inputs Gêmeos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#94a3b8', fontWeight: 600, fontSize: '11px' }}>Sigla do Grupo</label>
            <input
              type="text"
              value={grupoSelecionado.siglaSku || ''}
              onChange={e => onAtualizarSiglaSku(e.target.value)}
              style={{ height: '34px', border: '1px solid #334155', borderRadius: '6px', padding: '0 12px', fontSize: '13px', color: '#f8fafc', backgroundColor: '#0b0f14', width: '100%', boxSizing: 'border-box', outline: 'none' }}
              placeholder="Ex: BOM"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#94a3b8', fontWeight: 600, fontSize: '11px' }}>Separador</label>
            <input
              type="text"
              value={grupoSelecionado.separadorSku || '-'}
              onChange={e => onAtualizarSeparadorSku(e.target.value)}
              style={{ height: '34px', border: '1px solid #334155', borderRadius: '6px', padding: '0 12px', fontSize: '13px', color: '#f8fafc', backgroundColor: '#0b0f14', width: '100%', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* Template Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#94a3b8', fontWeight: 600, fontSize: '11px' }}>Template Anatômico de SKU</label>
          <input
            type="text"
            value={grupoSelecionado.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}'}
            onChange={e => onAtualizarTemplateSku(e.target.value)}
            style={{ height: '34px', border: '1px solid #334155', borderRadius: '6px', padding: '0 12px', fontSize: '13px', color: '#f8fafc', backgroundColor: '#0b0f14', width: '100%', boxSizing: 'border-box', outline: 'none' }}
            placeholder="Ex: {SIGLA}-{POTENCIA}"
          />
        </div>
      </div>

      {/* COLUNA 3: ENTRADA DE VALORES PARA TESTE + COMPOSIÇÃO DE ORDEM */}
      <div style={{ 
        background: '#ffffff', 
        border: '1px solid #e2e8f0',
        borderRadius: '8px', 
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxHeight: '340px', 
        boxSizing: 'border-box'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', letterSpacing: '0.3px' }}>
          🧪 Entrada de Valores & Ordem de SKU
        </span>
        
        {/* Container interno de rolagem otimizado */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          overflowY: 'auto', 
          flex: 1, 
          paddingRight: '6px',
          scrollbarWidth: 'thin' // Deixa a rolagem fina em navegadores modernos
        }}>
          {grupoSelecionado.atributos.map(attr => {
            const dicionario = obterDicionarioOpcoes(attr.exemplos);
            const identificadorInput = attr.nome; 

            return (
              <div 
                key={attr.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '10px', 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  padding: '12px' 
                }}
              >
                {/* Header Interno do Card do Atributo */}
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{attr.nome}</span>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    {attr.classificacao === 'especificacao' ? 'Ficha Técnica' : attr.classificacao}
                  </span>
                </div>

                {/* Grid Duplo Split */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', alignItems: 'end' }}>
                  
                  {/* Campo de Valor de Teste */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Valor Teste</label>
                    <input
                      type="text"
                      list={`list-${identificadorInput}`}
                      value={valoresTeste[identificadorInput] || ''} 
                      onChange={e => onMudancaValorTeste(identificadorInput, e.target.value)}
                      placeholder="Ex: 1.5HP"
                      style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', width: '100%', boxSizing: 'border-box', outline: 'none' }}
                    />
                    <datalist id={`list-${identificadorInput}`}>
                      {dicionario.map((d, idx) => (
                        <option key={idx} value={d.value || d.label} /> 
                      ))}
                    </datalist>
                  </div>

                  {/* Campo de Ordem Estilizado */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Ordem SKU</label>
                    <input 
                      type='number'
                      value={attr.ordemSku || 0}
                      onChange={e => onAtualizarOrdemSku?.(String(attr.id), parseInt(e.target.value) || 0)}
                      min={0}
                      style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', width: '100%', boxSizing: 'border-box', textAlign: 'center', outline: 'none' }}
                    />
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
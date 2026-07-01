import React, { useState } from 'react';
import { AtributoConfig } from './CatalogManager.types';

interface TabelaAtributosProps {
  titulo: string;
  atributos: AtributoConfig[];
  onAtualizarAtributo: <K extends keyof AtributoConfig>(id: string, campo: K, valor: AtributoConfig[K]) => void;
  onAbrirModal: (tipo: 'dna' | 'grade' | 'livre') => void;
  mostrarExpansao?: boolean;
  tipo: 'dna' | 'grade' | 'livre'; 
  atributoPendenteEdicao?: { atributoId: string; campo: string; valor: any } | null;
}

export const TabelaAtributos: React.FC<TabelaAtributosProps> = ({
  titulo,
  atributos,
  onAtualizarAtributo,
  onAbrirModal,
  tipo,
  mostrarExpansao = true,
  atributoPendenteEdicao, // 🔓 Capturado corretamente aqui das Props
}) => {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const ehEstruturaCritica = tipo === 'dna' || tipo === 'grade';

  const obterCorSituacao = (texto: string) => {
    return texto.includes('❌') || texto.includes('Obrigatório') ? '#d32f2f' : '#637381';
  };

  const totalColunas = 3 + (mostrarExpansao ? 1 : 0) + 1;

  return (
    <div style={{ width: '100%', fontFamily: 'system-ui, sans-serif', marginBottom: '24px' }}>
      
      {/* 🌟 Tag de estilo para aplicar o efeito pulsante dinâmico */}
      <style>{`
        @keyframes pulseDestaqueAtributo {
          0% { box-shadow: inset 0 0 0 2px #faad14; background-color: #fffbe6 !important; }
          50% { box-shadow: inset 0 0 0 2px rgba(250, 173, 20, 0.4); background-color: #fffbf0 !important; }
          100% { box-shadow: inset 0 0 0 2px #faad14; background-color: #fffbe6 !important; }
        }
        .linha-atributo-pendente {
          animation: pulseDestaqueAtributo 1.4s infinite ease-in-out !important;
          border-bottom: 1px solid #faad14 !important;
        }
      `}</style>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#212b36' }}>{titulo}</span>
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#637381' }}>
            {ehEstruturaCritica 
              ? 'Regras estruturais obrigatórias para a identidade do SKU.' 
              : 'Especificações livres e filtros complementares do item.'}
          </p>
        </div>
        <button 
          type="button" 
          onClick={() => onAbrirModal(tipo)}
          style={{
            height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 600,
            color: '#0050b3', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff',
            borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bae7ff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e6f7ff'; }}
        >
          + Vincular Atributo
        </button>
      </div>

      {/* TABELA */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e1e4e8', backgroundColor: '#f9fafb' }}>
            <th style={{ padding: '8px', fontWeight: 600, color: '#454f5b', fontSize: '11px', textTransform: 'uppercase' }}>Nome do Atributo / Classificação</th>
            <th style={{ padding: '8px', fontWeight: 600, color: '#454f5b', fontSize: '11px', textTransform: 'uppercase', width: '160px' }}>Formato de Entrada</th>
            {mostrarExpansao && <th style={{ padding: '8px', fontWeight: 600, color: '#454f5b', fontSize: '11px', textTransform: 'uppercase', width: '60px', textAlign: 'center' }}>Posição SKU</th>}
            <th style={{ padding: '8px', fontWeight: 600, color: '#454f5b', fontSize: '11px', textTransform: 'uppercase', width: '140px' }}>Status de Validação</th>
            <th style={{ padding: '8px', width: '90px', textAlign: 'center', fontWeight: 600, color: '#454f5b', fontSize: '11px', textTransform: 'uppercase' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {atributos.map((attr) => {
            
            // 🎯 Identifica se esta linha é a que disparou o SweetAlert
            const isPendente = atributoPendenteEdicao?.atributoId === String(attr.id);
            const atributoIdStr = String(attr.id);
            const isExpanded = expandidoId === atributoIdStr;
            
            // Regras estruturais de bloqueio
            const bloquearEdicaoBase = ehEstruturaCritica && attr.estaSendoUtilizado;
            const ehHerdadoCategoria = attr.origem === 'categoria';

            const textoDaLinha = attr.situacao || (bloquearEdicaoBase ? '🔒 Vinculado a Itens' : ehHerdadoCategoria ? '📂 Herdado Categoria' : 'Disponível'); 
            const corDaLinha = obterCorSituacao(textoDaLinha);

            return (
              <React.Fragment key={atributoIdStr}>
                <tr 
                  className={isPendente ? 'linha-atributo-pendente' : ''} // ✨ Injeta a classe condicionalmente
                  style={{ 
                    borderBottom: isPendente ? '1px solid #faad14' : '1px solid #e1e4e8', 
                    cursor: mostrarExpansao ? 'pointer' : 'default',
                    backgroundColor: isExpanded ? '#f4f6f8' : 'transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => !isPendente && mostrarExpansao && setExpandidoId(isExpanded ? null : atributoIdStr)} // Evita fechar/abrir a sanfona no meio da edição
                  onMouseEnter={(e) => { if(!isExpanded && !isPendente) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                  onMouseLeave={(e) => { if(!isExpanded && !isPendente) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  
                  {/* Nome do Atributo + Tag Modificadora de Tipo */}
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                          type="text"
                          value={attr.nome} 
                          disabled={bloquearEdicaoBase}
                          onChange={e => onAtualizarAtributo(atributoIdStr, 'nome', e.target.value)} 
                          style={{
                            width: '60%', height: '24px', border: '1px solid transparent',
                            background: 'transparent', padding: '0 4px', fontSize: '13px',
                            fontWeight: 500, color: bloquearEdicaoBase ? '#919eab' : '#212b36',
                            borderRadius: '3px', cursor: bloquearEdicaoBase ? 'not-allowed' : 'text'
                          }}
                          onFocus={(e) => { if (!bloquearEdicaoBase) { e.target.style.border = '1px solid #c4cbd4'; e.target.style.background = '#fff'; } }}
                          onBlur={(e) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
                        />
                        
                        <select
  // 🔥 1. Usa 'classificacao' que é o campo real mapeado no estado do pai
  value={attr.classificacao || tipo} 
  
  // 🔥 2. Dispara a mudança apontando para o campo 'classificacao'
  onChange={e => onAtualizarAtributo(atributoIdStr, 'classificacao', e.target.value as any)}
  style={{
    height: '20px', fontSize: '11px', padding: '0 2px', borderRadius: '4px',
    border: '1px solid #c4cbd4', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600
  }}
>
  <option value="dna">🏷️ DNA</option>
  <option value="grade">🏁 Grade</option>
  <option value="especificacao">📋 Ficha Técnica</option>
</select>

                        {ehHerdadoCategoria && (
                          <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                            📂 Cat.
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Tipo de Dado */}
                  <td style={{ padding: '6px 8px' }}>
                    <select 
                      value={attr.tipoDado} 
                      disabled={bloquearEdicaoBase}
                      onClick={e => e.stopPropagation()} 
                      onChange={e => onAtualizarAtributo(atributoIdStr, 'tipoDado', e.target.value as any)}
                      style={{
                        width: '100%', height: '26px', border: '1px solid #c4cbd4', borderRadius: '4px',
                        backgroundColor: bloquearEdicaoBase ? '#f4f6f8' : '#ffffff', fontSize: '12px',
                        color: bloquearEdicaoBase ? '#919eab' : '#212b36', padding: '0 4px',
                        cursor: bloquearEdicaoBase ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="texto">🔤 Texto Livre</option>
                      <option value="numero">🔢 Apenas Números</option>
                      <option value="select">📋 Lista de Opções</option>
                    </select>
                  </td>

                  {/* Ordem SKU */}
                  {mostrarExpansao && (
                    <td style={{ padding: '6px 8px' }}>
                      <input 
                        type="number" 
                        value={attr.ordemSku || ''} 
                        placeholder="Ex: 1"
                        onClick={e => e.stopPropagation()} 
                        onChange={e => onAtualizarAtributo(atributoIdStr, 'ordemSku', e.target.value ? Number(e.target.value) : 0)} 
                        style={{ width: '100%', height: '26px', border: '1px solid #c4cbd4', borderRadius: '4px', padding: '0 6px', fontSize: '12px', textAlign: 'center' }}
                      />
                    </td>
                  )}

                  {/* Situação */}
                  <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 500, color: corDaLinha, whiteSpace: 'nowrap' }}>
                    <span style={{ backgroundColor: corDaLinha + '15', padding: '2px 6px', borderRadius: '4px' }}>
                      {textoDaLinha}
                    </span>
                  </td>

                  {/* Coluna de Ações */}
                  <td style={{ padding: '6px 8px', display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {mostrarExpansao && (
                      <button
                        type="button"
                        onClick={() => setExpandidoId(isExpanded ? null : atributoIdStr)}
                        style={{ border: 'none', background: 'none', color: '#0050b3', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        {isExpanded ? "Fechar ▲" : "Configurar ▼"}
                      </button>
                    )}
                    
                    <button
                      type="button"
                      disabled={bloquearEdicaoBase || ehHerdadoCategoria}
                      onClick={() => {
                        if (bloquearEdicaoBase || ehHerdadoCategoria) return;
                        alert(`Remover atributo ${attr.nome}`);
                      }}
                      title={
                        bloquearEdicaoBase 
                          ? "Não é possível excluir: existem produtos utilizando este atributo estrutural." 
                          : ehHerdadoCategoria 
                            ? "Atributos herdados da categoria mestre não podem ser removidos por esta tela."
                            : "Excluir atributo"
                      }
                      style={{
                        border: 'none', background: 'none', 
                        cursor: (bloquearEdicaoBase || ehHerdadoCategoria) ? 'not-allowed' : 'pointer',
                        opacity: (bloquearEdicaoBase || ehHerdadoCategoria) ? 0.3 : 1,
                        fontSize: '12px', padding: 0
                      }}
                    >
                      🗑️
                    </button>
                  </td>

                </tr>
                
                {/* REGRAS EXPANDIDAS */}
                {mostrarExpansao && isExpanded && (
                  <tr>
                    <td colSpan={totalColunas} style={{ padding: '16px', backgroundColor: '#f4f6f8', borderBottom: '1px solid #e1e4e8' }}>
                      <div style={{ borderLeft: '3px solid #0050b3', paddingLeft: '12px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#212b36', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          ⚙️ Regras de Formatação do SKU & Descrição Automática <small style={{ color: '#637381', textTransform: 'none' }}>(ID: {atributoIdStr})</small>
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 2fr', gap: '16px', alignItems: 'start' }}>
                          {/* Sufixo */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#454f5b' }}>Sufixo / Unidade</label>
                            <input 
                              type="text"
                              value={attr.sufixo || ''} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'sufixo', e.target.value)} 
                              placeholder="Ex: mm, RPM, W, Volts"
                              style={{ height: '28px', border: '1px solid #c4cbd4', borderRadius: '4px', padding: '0 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* Separador */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#454f5b' }}>Espaçamento do Sufixo</label>
                            <select 
                              value={attr.separadorSufixo || 'nenhum'} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'separadorSufixo', e.target.value as any)}
                              style={{ height: '28px', border: '1px solid #c4cbd4', borderRadius: '4px', padding: '0 6px', fontSize: '12px', width: '100%', backgroundColor: '#fff' }}
                            >
                              <option value="nenhum">Sem espaço (Ex: 50mm)</option>
                              <option value="espaco">Com Espaço (Ex: 50 mm)</option>
                              <option value="hifen">Com Hífen (Ex: 50-mm)</option>
                            </select>
                          </div>

                          {/* Dicionário */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#454f5b' }}>Dicionário de Conversão para o SKU</label>
                            <textarea 
                              value={attr.exemplos || ''} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'exemplos', e.target.value)} 
                              placeholder="TIMKEN=TNK, SKF=SKF" 
                              style={{ height: '54px', border: '1px solid #c4cbd4', borderRadius: '4px', padding: '6px 8px', fontSize: '11px', fontFamily: 'monospace', resize: 'none', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
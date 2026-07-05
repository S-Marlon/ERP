import React, { useState } from 'react';
import styles from './TabelaAtributos.module.css';
import { AtributoConfig } from '../CatalogManager.types';

interface TabelaAtributosProps {
  titulo: string;
  atributos: AtributoConfig[];
  onAtualizarAtributo: <K extends keyof AtributoConfig>(id: string, campo: K, valor: AtributoConfig[K]) => void;
  onMoverEscopo: (id: string, novoEscopo: 'dna' | 'grade' | 'ficha') => void; // 🧬 Nova Prop adicionada para a esteira inteligente
  onAbrirModal: (tipo: 'dna' | 'grade' | 'ficha') => void; // Alinhado para usar 'ficha'
  mostrarExpansao?: boolean;
  tipo: 'dna' | 'grade' | 'ficha'; // Alinhado para usar 'ficha'
  atributoPendenteEdicao?: { atributoId: string; campo: string; valor: any } | null;
}

export const TabelaAtributos: React.FC<TabelaAtributosProps> = ({
  titulo,
  atributos,
  onAtualizarAtributo,
  onMoverEscopo,
  onAbrirModal,
  tipo,
  mostrarExpansao = true,
  atributoPendenteEdicao,
}) => {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const ehEstruturaCritica = tipo === 'dna' || tipo === 'grade';

  const obterClasseStatus = (texto: string) => {
    if (texto.includes('❌') || texto.includes('Obrigatório')) {
      return styles.statusDanger;
    }
    return styles.statusMuted;
  };

  const totalColunas = 3 + (mostrarExpansao ? 1 : 0) + 1;

  return (
    <div className={styles.tabelaAtributosWrapper}>
      
      {/* CABEÇALHO */}
      <div className={styles.tabelaHeaderRow}>
        <div>
          <span className={styles.tabelaTitulo}>{titulo}</span>
          <p className={styles.tabelaSubtitulo}>
            {tipo === 'dna' && '🧬 DNA: Atributos fixos e obrigatórios que compõem a raiz identificadora do SKU pai.'}
            {tipo === 'grade' && '🏁 Grade: Variadores que multiplicam e geram os SKUs filhos (Tamanho, Cor, Voltagem).'}
            {tipo === 'ficha' && '📋 Ficha Técnica: Dados comerciais livres, informativos e filtros de busca.'}
          </p>
        </div>
        <button 
          type="button" 
          onClick={() => onAbrirModal(tipo)}
          className={styles.btnVincularAtributo}
        >
          + Vincular Atributo
        </button>
      </div>

      {/* TABELA */}
      <table className={styles.modernTable}>
        <thead>
          <tr>
            <th>Nome do Atributo</th>
            <th style={{ width: '150px' }}>Formato de Entrada</th>
            {mostrarExpansao && <th style={{ width: '60px', textAlign: 'center' }}>Posição SKU</th>}
            <th style={{ width: '130px' }}>Status/Origem</th>
            <th style={{ width: '220px', textAlign: 'center' }}>Classificação / Ações</th>
          </tr>
        </thead>
        <tbody>
          {atributos.map((attr) => {
            const isPendente = atributoPendenteEdicao?.atributoId === String(attr.id);
            const atributoIdStr = String(attr.id);
            const isExpanded = expandidoId === atributoIdStr;
            
            const bloquearEdicaoBase = ehEstruturaCritica && attr.estaSendoUtilizado;
            const ehHerdadoCategoria = attr.origem === 'categoria';

            const textoDaLinha = attr.situacao || (bloquearEdicaoBase ? '🔒 Em Uso' : ehHerdadoCategoria ? '📂 Categoria' : 'Disponível'); 
            const classeStatus = obterClasseStatus(textoDaLinha);

            const trClassName = `
              ${isPendente ? styles.linhaAtributoPendente : ''} 
              ${isExpanded ? styles.linhaAtributoExpandida : ''}
              ${mostrarExpansao ? styles.linhaAtributoClicavel : ''}
            `.trim();

            return (
              <React.Fragment key={atributoIdStr}>
                <tr 
                  className={trClassName}
                  onClick={() => !isPendente && mostrarExpansao && setExpandidoId(isExpanded ? null : atributoIdStr)}
                >
                  
                  {/* Nome do Atributo */}
                  <td>
                    <div className={styles.cellFlexRow} onClick={e => e.stopPropagation()}>
                      <input 
                        type="text"
                        value={attr.nome} 
                        disabled={bloquearEdicaoBase}
                        onChange={e => onAtualizarAtributo(atributoIdStr, 'nome', e.target.value)} 
                        className={styles.inlineTableInput}
                      />
                    </div>
                  </td>

                  {/* Tipo de Dado */}
                  <td>
                    <select 
                      value={attr.tipoDado} 
                      disabled={bloquearEdicaoBase}
                      onClick={e => e.stopPropagation()} 
                      onChange={e => onAtualizarAtributo(atributoIdStr, 'tipoDado', e.target.value as any)}
                      className={styles.tableBlockSelect}
                    >
                      <option value="texto">🔤 Texto Livre</option>
                      <option value="numero">🔢 Numérico</option>
                      <option value="select">📋 Seleção/Lista</option>
                    </select>
                  </td>

                  {/* Ordem SKU */}
                  {mostrarExpansao && (
                    <td>
                      <input 
                        type="number" 
                        value={attr.ordemSku || ''} 
                        placeholder="-"
                        disabled={tipo === 'ficha'}
                        onClick={e => e.stopPropagation()} 
                        onChange={e => onAtualizarAtributo(atributoIdStr, 'ordemSku', e.target.value ? Number(e.target.value) : 0)} 
                        className={styles.tableInputNumberCentered}
                      />
                    </td>
                  )}

                  {/* Situação */}
                  <td>
                    <span className={`${styles.statusBadgeBase} ${classeStatus}`}>
                      {textoDaLinha}
                    </span>
                  </td>

                  {/* Coluna de Ações + Alteração Dinâmica de Escopo */}
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.tableActionsContainer} style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      
                      {/* ESTEIRA INTELIGENTE DE MOVIMENTAÇÃO DE ESCOPO */}
                      <div className={styles.movimentacaoAcoesGrupo} style={{ display: 'flex', gap: '4px' }}>
                        {tipo !== 'dna' && (
                          <button
                            type="button"
                            title="Promover para DNA (Compõe o SKU Base)"
                            onClick={() => onMoverEscopo(atributoIdStr, 'dna')}
                            style={{ padding: '2px 6px', fontSize: '11px', cursor: 'pointer', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#1d39c4', borderRadius: '4px' }}
                          >
                            🧬 +DNA
                          </button>
                        )}
                        {tipo !== 'grade' && (
                          <button
                            type="button"
                            title="Mover para Grade (Gera as Variações/Filhos)"
                            onClick={() => onMoverEscopo(atributoIdStr, 'grade')}
                            style={{ padding: '2px 6px', fontSize: '11px', cursor: 'pointer', background: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', borderRadius: '4px' }}
                          >
                            🏁 +Grade
                          </button>
                        )}
                        {tipo !== 'ficha' && (
                          <button
                            type="button"
                            title="Rebaixar para Ficha Técnica (Apenas Informativo)"
                            onClick={() => onMoverEscopo(atributoIdStr, 'ficha')}
                            style={{ padding: '2px 6px', fontSize: '11px', cursor: 'pointer', background: '#fff7e6', border: '1px solid #ffd591', color: '#d46b08', borderRadius: '4px' }}
                          >
                            📋 +Ficha
                          </button>
                        )}
                      </div>

                      <div style={{ width: '1px', height: '16px', background: '#e8e8e8', margin: '0 4px' }} />

                      {/* CONFIGURAR EXPANSÃO */}
                      {mostrarExpansao && (
                        <button
                          type="button"
                          onClick={() => setExpandidoId(isExpanded ? null : atributoIdStr)}
                          className={styles.btnTableToggleExpand}
                          style={{ minWidth: '75px' }}
                        >
                          {isExpanded ? "Fechar ▲" : "Regras ▼"}
                        </button>
                      )}
                      
                      {/* DELETAR VINCULO */}
                      <button
                        type="button"
                        disabled={bloquearEdicaoBase || ehHerdadoCategoria}
                        onClick={() => {
                          if (bloquearEdicaoBase || ehHerdadoCategoria) return;
                          alert(`Remover atributo ${attr.nome}`);
                        }}
                        className={styles.btnTableDelete}
                        title={
                          bloquearEdicaoBase 
                            ? "Não é possível desvincular: existem produtos utilizando este atributo estrutural." 
                            : ehHerdadoCategoria 
                              ? "Atributos herdados da categoria mestre não podem ser removidos por esta tela."
                              : "Excluir vínculo do atributo"
                        }
                      >
                        🗑️
                      </button>
                    </div>
                  </td>

                </tr>
                
                {/* REGRAS EXPANDIDAS (SANFONA) */}
                {mostrarExpansao && isExpanded && (
                  <tr className={styles.linhaPainelExpandido}>
                    <td colSpan={totalColunas}>
                      <div className={styles.painelExpandidoConteudo}>
                        <h4>
                          ⚙️ Regras de Formatação do SKU & Descrição Automática <small>(ID: {atributoIdStr})</small>
                        </h4>
                        
                        <div className={styles.painelExpandidoGrid}>
                          {/* Sufixo */}
                          <div className={styles.flexColumnGap4}>
                            <label>Sufixo / Unidade</label>
                            <input 
                              type="text"
                              value={attr.sufixo || ''} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'sufixo', e.target.value)} 
                              placeholder="Ex: mm, RPM, W, Volts"
                              className={styles.configSubInput}
                            />
                          </div>

                          {/* Separador */}
                          <div className={styles.flexColumnGap4}>
                            <label>Espaçamento do Sufixo</label>
                            <select 
                              value={attr.separadorSufixo || 'nenhum'} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'separadorSufixo', e.target.value as any)}
                              className={styles.configSubSelect}
                            >
                              <option value="nenhum">Sem espaço (Ex: 50mm)</option>
                              <option value="espaco">Com Espaço (Ex: 50 mm)</option>
                              <option value="hifen">Com Hífen (Ex: 50-mm)</option>
                            </select>
                          </div>

                          {/* Dicionário */}
                          <div className={styles.flexColumnGap4}>
                            <label>Dicionário de Conversão para o SKU</label>
                            <textarea 
                              value={attr.exemplos || ''} 
                              onChange={e => onAtualizarAtributo(atributoIdStr, 'exemplos', e.target.value)} 
                              placeholder="TIMKEN=TNK, SKF=SKF" 
                              className={styles.configSubTextarea}
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
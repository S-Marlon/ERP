import React from 'react';
import styles from '../CatalogManager.module.css';
import { Grupo as Familia } from '../CatalogManager.types';
import { obterDicionarioOpcoes } from '../CatalogManager.helpers';

interface PainelSimuladorProps {
  grupoSelecionado: Familia;
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
    <section 
      className={styles.simuladorContainer} 
      style={{ '--local-brand-color': brandColor } as React.CSSProperties}
    >
      
      {/* COLUNA 1: ENGENHARIA DE NOME COMERCIAL */}
      <div className={`${styles.simuladorColuna} ${styles.colunaNomeComercial}`}>
        <div className={styles.colunaSectionTitle}>
          ⚙️ Configuração de Nome Comercial
        </div>

        {/* Display de Visualização */}
        <div className={styles.previewCardDark}>
          <span>🖥️ Preview do Nome Compilado</span>
          <div className={styles.previewCompiladoTexto}>
            {previewNomeSimulado || 'Aguardando parâmetros...'}
          </div>
        </div>

        {/* Form Input */}
        <div className={styles.sandboxInputControl}>
          <label>Template de Nome Comercial</label>
          <input
            type="text"
            value={grupoSelecionado.templateNomeComercial || ''}
            onChange={e => onAtualizarTemplateComercial(e.target.value)}
            className={styles.templateInput}
            placeholder="Ex: {FAMILIA} {POTENCIA}HP"
          />
        </div>

        {/* Injetores */}
        <div className={styles.tokenBox}>
          <span className={styles.tokenBoxTitle}>
            Tokens de Injeção Dinâmica
          </span>
          <div className={styles.templateTags}>
            <code
              onClick={() => handleInjetarToken('{FAMILIA}')}
              title="Injetar Nome da Família"
              className={styles.tagTokenBase}
            >
              {'{FAMILIA}'}
            </code>

            {grupoSelecionado.atributos.map(attr => (
              <code
                key={attr.id}
                onClick={() => handleInjetarToken(`{${attr.nome}}`)}
                title={`Injetar {${attr.nome}}`}
                className={styles.tagTokenAtributo}
              >
                {`{${attr.nome}}`}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* COLUNA 2: MOTOR DE GERAÇÃO DE SKU */}
      <div className={`${styles.simuladorColuna} ${styles.colunaMotorSku}`}>
        <div className={styles.colunaSectionTitle}>
          ⚙️ Motor de Geração de SKU
        </div>

        {/* Display de Visualização */}
        <div className={styles.previewCard}>
          <span>📦 SKU Resultante</span>
          <div className={styles.codigoSkuReal}>
            {previewSkuSimulado || 'AGUARDANDO_DADOS'}
          </div>
        </div>

        {/* Inputs Gêmeos */}
        <div className={styles.twinInputsGrid}>
          <div className={styles.sandboxInputControl}>
            <label>Sigla da Família</label>
            <input
              type="text"
              value={grupoSelecionado.siglaSku || ''}
              onChange={e => onAtualizarSiglaSku(e.target.value)}
              className={styles.templateInput}
              placeholder="Ex: BOM"
            />
          </div>

          <div className={styles.sandboxInputControl}>
            <label>Separador</label>
            <select 
              value={grupoSelecionado.separadorSku || '-'}
              onChange={e => onAtualizarSeparadorSku(e.target.value)}
              className={styles.modernSelectSimulador}
            >
              <option value="-">Hífen (-)</option>
              <option value="_">Underscore (_)</option>
              <option value=".">Ponto (.)</option>
              <option value="">Nenhum</option>
            </select>
          </div>
        </div>

        {/* Template Input */}
        <div className={styles.sandboxInputControl}>
          <label>Template Anatômico de SKU</label>
          <input
            type="text"
            value={grupoSelecionado.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}'}
            onChange={e => onAtualizarTemplateSku(e.target.value)}
            className={styles.templateInput}
            placeholder="Ex: {SIGLA}-{POTENCIA}"
          />
        </div>
      </div>

      {/* COLUNA 3: ENTRADA DE VALORES PARA TESTE + COMPOSIÇÃO DE ORDEM */}
      <div className={styles.sandboxSku}>
        <span className={styles.colunaSectionTitle}>
          🧪 Entrada de Valores & Ordem de SKU
        </span>
        
        {/* Container interno de rolagem otimizado */}
        <div className={styles.sandboxScrollContainer}>
          {grupoSelecionado.atributos.map(attr => {
            const dicionario = obterDicionarioOpcoes(attr.exemplos);
            const identificadorInput = attr.nome; 

            return (
              <div key={attr.id} className={styles.sandboxAttrCard}>
                {/* Header Interno do Card do Atributo */}
                <div className={styles.sandboxAttrCardHeader}>
                  <span className={styles.attrCardName}>{attr.nome}</span>
                  <span className={styles.attrCardBadge}>
                    {attr.classificacao === 'especificacao' ? 'Ficha Técnica' : attr.classificacao}
                  </span>
                </div>

                {/* Grid Duplo Split */}
                <div className={styles.sandboxSplitGrid}>
                  
                  {/* Campo de Valor de Teste */}
                  <div className={styles.sandboxInputControl}>
                    <label>Valor Teste</label>
                    <input
                      type="text"
                      list={`list-${identificadorInput}`}
                      value={valoresTeste[identificadorInput] || ''} 
                      onChange={e => onMudancaValorTeste(identificadorInput, e.target.value)}
                      placeholder="Ex: 1.5HP"
                      className={styles.templateInput}
                    />
                    <datalist id={`list-${identificadorInput}`}>
                      {dicionario.map((d, idx) => (
                        <option key={idx} value={d.value || d.label} /> 
                      ))}
                    </datalist>
                  </div>

                  {/* Campo de Ordem Estilizado */}
                  <div className={styles.sandboxInputControl}>
                    <label style={{ textAlign: 'center' }}>Ordem SKU</label>
                    <input 
                      type='number'
                      value={attr.ordemSku || 0}
                      onChange={e => onAtualizarOrdemSku?.(String(attr.id), parseInt(e.target.value) || 0)}
                      min={0}
                      className={styles.templateInput}
                      style={{ textAlign: 'center' }}
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
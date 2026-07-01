import { AtributoConfig, Grupo } from './CatalogManager.types';

/**
 * Normaliza e traduz a string de exemplos em um par Label/Codigo utilizável pelo Datalist
 */
export const obterDicionarioOpcoes = (exemplosString: string) => {
  const lista = exemplosString ? exemplosString.split(',').map(o => o.trim()).filter(Boolean) : [];

  return lista.map(item => {
    if (item.includes('=')) {
      const [label, codigo] = item.split('=').map(s => s.trim());
      // 🔥 Ajustado para retornar 'value' casando perfeitamente com o PainelSimulador
      return { label, value: codigo.toUpperCase() }; 
    }
    return { label: item, value: item.toUpperCase().replace(/\s+/g, '_') };
  });
};

/**
 * Gera o preview do Nome Comercial substituindo os tokens dinâmicos
 */
export const gerarPreviewNome = (
  grupo: Grupo | null, 
  valoresTeste: Record<string, string>
): string => {
  if (!grupo) return '';
  
  // 🔥 Corrigido para 'templateNomeComercial' para bater com o estado real do objeto Grupo
  let template = grupo.templateNomeComercial || '{GRUPO}';
  
  // 1. Substitui o token padrão do grupo
  template = template.replace(/{GRUPO}/g, grupo.nome || '');
  
  // 2. Substitui os tokens dos atributos dinâmicos
  if (grupo.atributos && grupo.atributos.length > 0) {
    grupo.atributos.forEach(attr => {
      const regex = new RegExp(`{${attr.nome}}`, 'g');
      const valorSubstituto = valoresTeste[attr.nome] || `[${attr.nome}]`; 
      template = template.replace(regex, valorSubstituto);
    });
  }
  
  return template;
};

/**
 * Gera o Preview do SKU respeitando a Sigla, o Separador e o Template Anatômico
 */
export const gerarPreviewSku = (
  grupo: Grupo | null,
  atributosDoSku: AtributoConfig[], // Certifique-se de passar esses atributos já ordenados por 'ordemSku'
  valoresTeste: Record<string, string>
): string => {
  if (!grupo) return 'AGUARDANDO_GRUPO';

  const sigla = (grupo.siglaSku || '').toUpperCase();
  const separador = grupo.separadorSku || '-';
  
  // 1. Monta a parte da variação/atributos baseada na ordem configurada
  const partesAtributos = atributosDoSku.map(attr => {
    const valorDigitado = valoresTeste[attr.nome]; 
    
    if (!valorDigitado) {
      return `[${attr.nome.toUpperCase()}]`;
    }

    // Procura se o valor digitado corresponde a uma chave do dicionário (Ex: TIMKEN vira TNK)
    const dicionario = obterDicionarioOpcoes(attr.exemplos);
    const correspondencia = dicionario.find(d => d.label.toUpperCase() === valorDigitado.trim().toUpperCase());
    
    const valorFinal = correspondencia ? correspondencia.value : valorDigitado;
    
    return valorFinal.trim().toUpperCase().replace(/\s+/g, '');
  });

  const variacaoCompilada = partesAtributos.join(separador);

  // 2. Aplica as variáveis dentro do template anatômico do SKU
  let templateSku = grupo.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}';
  
  templateSku = templateSku
    .replace(/{SIGLA}/g, sigla)
    .replace(/{SEPARADOR}/g, separador)
    .replace(/{VARIAÇÃO}/g, variacaoCompilada);

  return templateSku;
};
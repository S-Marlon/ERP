import { AtributoConfig, Familia, Grupo, Categoria, CategoriaTreeNode } from './CatalogManager.types';

export const obterDicionarioOpcoes = (exemplosString: string) => {
  const lista = exemplosString ? exemplosString.split(',').map(o => o.trim()).filter(Boolean) : [];

  return lista.map(item => {
    if (item.includes('=')) {
      const [label, codigo] = item.split('=').map(s => s.trim());
      return { label, value: codigo.toUpperCase() }; 
    }
    return { label: item, value: item.toUpperCase().replace(/\s+/g, '_') };
  });
};

// Helper seguro para substituir todas as ocorrências sem erro de TS
const substituirGlobal = (texto: string, busca: string, substituto: string): string => {
  if (!texto) return '';
  return texto.split(busca).join(substituto);
};

export const gerarPreviewNome = (
  grupo: Grupo | null, 
  valoresTesteOrItem: Record<string, any>
): string => {
  if (!grupo) return '';
  
  let template = grupo.templateNomeComercial || '{FAMILIA}';
  template = substituirGlobal(template, '{FAMILIA}', grupo.nome || '');
  template = substituirGlobal(template, '[FAMILIA]', grupo.nome || '');
  
  // 🔍 Tenta extrair valores de várias fontes possíveis para evitar objeto vazio {}
  const dictValores = 
    valoresTesteOrItem?.valoresAtributos || 
    valoresTesteOrItem?.atributos || 
    valoresTesteOrItem?.valores || 
    valoresTesteOrItem || {};

  const chavesParaSubstituir = new Set<string>();
  
  if (grupo.atributos && Array.isArray(grupo.atributos)) {
    grupo.atributos.forEach(attr => {
      if (attr.nome) chavesParaSubstituir.add(attr.nome);
      if (attr.id !== undefined && attr.id !== null) chavesParaSubstituir.add(String(attr.id));
      if (attr.codigo) chavesParaSubstituir.add(attr.codigo);
    });
  }

  Object.keys(dictValores).forEach(k => chavesParaSubstituir.add(k));

  chavesParaSubstituir.forEach(chave => {
    const valorEncontrado = 
      dictValores[chave] ?? 
      dictValores[chave.toLowerCase()] ?? 
      dictValores[chave.toUpperCase()];

    const valorSubstituto = (valorEncontrado !== null && valorEncontrado !== undefined && String(valorEncontrado).trim() !== '')
      ? String(valorEncontrado)
      : `[${chave}]`;

    template = substituirGlobal(template, `{${chave}}`, valorSubstituto);
    template = substituirGlobal(template, `[${chave}]`, valorSubstituto);
  });
  
  return template;
};

export const gerarPreviewSku = (
  familia: Familia | null, 
  atributosDoSku: any[], 
  valoresTesteOrItem: Record<string, any>
): string => {
  if (!familia) return "";
  let resultado = familia?.templateSku || "";
  if (!resultado) return "";

  const siglaValor = familia?.siglaSku || "";
  resultado = substituirGlobal(resultado, '{Sigla}', siglaValor);
  resultado = substituirGlobal(resultado, '[Sigla]', siglaValor);

  const dictValores = 
    valoresTesteOrItem?.valoresAtributos || 
    valoresTesteOrItem?.atributos || 
    valoresTesteOrItem?.valores || 
    valoresTesteOrItem || {};

  const chavesParaSubstituir = new Set<string>();

  if (familia.atributos && Array.isArray(familia.atributos)) {
    familia.atributos.forEach(attr => {
      if (attr.nome) chavesParaSubstituir.add(attr.nome);
      if (attr.id !== undefined && attr.id !== null) chavesParaSubstituir.add(String(attr.id));
      if (attr.codigo) chavesParaSubstituir.add(attr.codigo);
    });
  }

  if (atributosDoSku && Array.isArray(atributosDoSku)) {
    atributosDoSku.forEach(attr => {
      if (attr.nome) chavesParaSubstituir.add(attr.nome);
      if (attr.id !== undefined && attr.id !== null) chavesParaSubstituir.add(String(attr.id));
      if (attr.codigo) chavesParaSubstituir.add(attr.codigo);
    });
  }

  Object.keys(dictValores).forEach(k => chavesParaSubstituir.add(k));

  chavesParaSubstituir.forEach(chave => {
    const valorEncontrado = 
      dictValores[chave] ?? 
      dictValores[chave.toLowerCase()] ?? 
      dictValores[chave.toUpperCase()];

    const valorSubstituto = (valorEncontrado !== null && valorEncontrado !== undefined && String(valorEncontrado).trim() !== '')
      ? String(valorEncontrado)
      : `[${chave}]`;

    resultado = substituirGlobal(resultado, `{${chave}}`, valorSubstituto);
    resultado = substituirGlobal(resultado, `[${chave}]`, valorSubstituto);
  });

  return resultado;
};

export const construirArvoreAntd = (lista: Categoria[], paiId: string | null = null): CategoriaTreeNode[] => {
  return lista
    .filter(cat => {
      if (!cat.paiId && !paiId) return true;
      return String(cat.paiId) === String(paiId);
    })
    .map(cat => ({
      value: String(cat.id),
      title: `${cat.nome} (ID #${cat.id})`,
      children: construirArvoreAntd(lista, cat.id)
    }));
};

export const CAMPOS_NAO_INTEGRADOS = {
  familia: [
    'tipoItem', 
    'ncmPadrao', 
    'cestPadrao', 
    'siglaSku', 
    'templateSku', 
    'descricaoComercialPadrao', 
    'observacoesPadrao'
  ],
  atributo: ['opcoesValidas', 'valorPadraoGrupo', 'estaSendoUtilizado', 'origem']
};
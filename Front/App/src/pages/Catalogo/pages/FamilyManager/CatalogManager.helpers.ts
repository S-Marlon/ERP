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

export const normalizarChaveTemplate = (valor: unknown): string => {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

export const extrairTokensTemplate = (template: string): string[] => {
  if (!template) return [];

  const matches = template.match(/\{([^}]+)\}|\[([^\]]+)\]/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map((token) => token.replace(/^[\[{]/, '').replace(/[\]}]$/, '').trim())
        .filter(Boolean)
    )
  );
};

export const resolverValorAtributo = (
  dictValores: Record<string, any> | null | undefined,
  aliases: Array<string | number | undefined>
): any => {
  if (!dictValores || typeof dictValores !== 'object') return undefined;

  for (const alias of aliases) {
    const aliasStr = String(alias ?? '').trim();
    if (!aliasStr) continue;

    const valorDireto = dictValores[aliasStr];
    if (valorDireto !== undefined && valorDireto !== null && String(valorDireto).trim() !== '') {
      return valorDireto;
    }

    const chaveCorrespondente = Object.keys(dictValores).find(
      (chave) => normalizarChaveTemplate(chave) === normalizarChaveTemplate(aliasStr)
    );

    if (chaveCorrespondente !== undefined) {
      const valorCorrespondente = dictValores[chaveCorrespondente];
      if (valorCorrespondente !== undefined && valorCorrespondente !== null && String(valorCorrespondente).trim() !== '') {
        return valorCorrespondente;
      }
    }
  }

  return undefined;
};

export const gerarPreviewNome = (
  grupo: Grupo | null, 
  valoresTesteOrItem: Record<string, any>
): string => {
  if (!grupo) return '';
  
  let template = grupo.templateNomeComercial || '{FAMILIA}';
  template = substituirGlobal(template, '{FAMILIA}', grupo.nome || '');
  template = substituirGlobal(template, '[FAMILIA]', grupo.nome || '');

  const dictValores = 
    valoresTesteOrItem?.valoresAtributos || 
    valoresTesteOrItem?.atributos || 
    valoresTesteOrItem?.valores || 
    valoresTesteOrItem || {};

  const tokens = extrairTokensTemplate(template);

  tokens.forEach((token) => {
    const aliasCandidates = [token];

    if (grupo.atributos && Array.isArray(grupo.atributos)) {
      grupo.atributos.forEach((attr) => {
        const normToken = normalizarChaveTemplate(token);
        const normNome = normalizarChaveTemplate(attr.nome);
        const normCodigo = normalizarChaveTemplate(attr.codigo);
        const normId = normalizarChaveTemplate(attr.id);

        if (!normToken || !normNome || !normCodigo || !normId) return;

        if (
          normToken === normNome ||
          normToken === normCodigo ||
          normToken === normId
        ) {
          aliasCandidates.push(String(attr.id), attr.nome, attr.codigo);
        }
      });
    }

    const valorEncontrado = resolverValorAtributo(dictValores, aliasCandidates);
    const valorSubstituto = (valorEncontrado !== undefined && valorEncontrado !== null && String(valorEncontrado).trim() !== '')
      ? String(valorEncontrado)
      : `[${token}]`;

    template = substituirGlobal(template, `{${token}}`, valorSubstituto);
    template = substituirGlobal(template, `[${token}]`, valorSubstituto);
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

  const tokens = extrairTokensTemplate(resultado);

  tokens.forEach((token) => {
    const aliasCandidates = [token];

    const atributosParaBusca = [
      ...(familia.atributos || []),
      ...(atributosDoSku || [])
    ];

    atributosParaBusca.forEach((attr) => {
      const normToken = normalizarChaveTemplate(token);
      const normNome = normalizarChaveTemplate(attr?.nome);
      const normCodigo = normalizarChaveTemplate(attr?.codigo);
      const normId = normalizarChaveTemplate(attr?.id);

      if (!normToken || !normNome || !normCodigo || !normId) return;

      if (
        normToken === normNome ||
        normToken === normCodigo ||
        normToken === normId
      ) {
        aliasCandidates.push(String(attr?.id), attr?.nome, attr?.codigo);
      }
    });

    const valorEncontrado = resolverValorAtributo(dictValores, aliasCandidates);
    const valorSubstituto = (valorEncontrado !== undefined && valorEncontrado !== null && String(valorEncontrado).trim() !== '')
      ? String(valorEncontrado)
      : `[${token}]`;

    resultado = substituirGlobal(resultado, `{${token}}`, valorSubstituto);
    resultado = substituirGlobal(resultado, `[${token}]`, valorSubstituto);
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
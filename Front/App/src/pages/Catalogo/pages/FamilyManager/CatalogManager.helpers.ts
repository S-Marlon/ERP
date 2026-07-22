import { AtributoConfig, Grupo } from './CatalogManager.types';

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

export const gerarPreviewNome = (
  grupo: Grupo | null, 
  valoresTeste: Record<string, string>
): string => {
  if (!grupo) return '';
  
  let template = grupo.templateNomeComercial || '{FAMILIA}';
  template = template.replace(/{FAMILIA}/g, grupo.nome || '');
  
  if (grupo.atributos && grupo.atributos.length > 0) {
    grupo.atributos.forEach(attr => {
      const regex = new RegExp(`{${attr.nome}}`, 'g');
      
      // Engenharia de Herança: Se o grupo amarra o valor, o preview renderiza o valor padrão do grupo
      const valorSubstituto = attr.valorHerdadoDoGrupo 
        ? (attr.valorPadraoGrupo || `[${attr.nome}]`)
        : (valoresTeste[attr.nome] || `[${attr.nome}]`); 
        
      template = template.replace(regex, valorSubstituto);
    });
  }
  
  return template;
};

export const gerarPreviewSku = (
  grupo: Grupo | null,
  atributosDoSku: AtributoConfig[],
  valoresTeste: Record<string, string>
): string => {
  if (!grupo) return 'AGUARDANDO_GRUPO';

  const sigla = (grupo.siglaSku || '').toUpperCase();
  const separador = grupo.separadorSku || '-';
  
  const partesAtributos = atributosDoSku.map(attr => {
    // Se herdado rigidamente, pega o default estático do grupo, senão a entrada simulada
    const valorDigitado = attr.valorHerdadoDoGrupo ? attr.valorPadraoGrupo : valoresTeste[attr.nome]; 
    
    if (!valorDigitado) {
      return `[${attr.nome.toUpperCase()}]`;
    }

    const dicionario = obterDicionarioOpcoes(attr.exemplos);
    const correspondencia = dicionario.find(d => d.label.toUpperCase() === valorDigitado.trim().toUpperCase());
    const valorFinal = correspondencia ? correspondencia.value : valorDigitado;
    
    return valorFinal.trim().toUpperCase().replace(/\s+/g, '');
  });

  const variacaoCompilada = partesAtributos.join(separador);
  let templateSku = grupo.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}';
  
  templateSku = templateSku
    .replace(/{SIGLA}/g, sigla)
    .replace(/{SEPARADOR}/g, separador)
    .replace(/{VARIAÇÃO}/g, variacaoCompilada);

  return templateSku;
};

// 🌳 Versão blindada contra tipos numéricos/strings do banco
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


// ⚠️ Campos que NÃO persistem no banco (Mapeamento/Constante utilitária)
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
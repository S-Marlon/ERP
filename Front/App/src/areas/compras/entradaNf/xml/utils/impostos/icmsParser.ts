export interface IcmsData {
    orig: string;
    // Identificação do CST ou CSOSN (dependendo do regime)
    cst?: string;
    csosn?: string;
    // Valores base, alíquotas e montantes principais
    vBC?: number;
    pICMS?: number;
    vICMS?: number;
    // Partilha / ST / FCP (opcionais úteis)
    vBCST?: number;
    pICMSST?: number;
    vICMSST?: number;
    pRedBC?: number;
    // Identificador da tag de ICMS encontrada (ex: 'ICMS00', 'ICMSSN101', etc.)
    tipoICMS?: string;
}

export const parseICMS = (impostoNode: Element | null): IcmsData | null => {
    if (!impostoNode) return null;

    const icmsNode = impostoNode.getElementsByTagName('ICMS')[0];
    if (!icmsNode) return null;

    // O ICMS dentro da NF-e vem dentro de uma tag específica para o grupo tributário (ex: <ICMS00>, <ICMSSN102>, etc.)
    // Vamos varrer os filhos diretos de <ICMS> para achar qual tag está presente.
    const icmsChildren = icmsNode.children;
    if (icmsChildren.length === 0) return null;

    const specificIcmsNode = icmsChildren[0];
    const tipoICMS = specificIcmsNode.tagName;

    const getVal = (tagName: string): number | undefined => {
        const el = specificIcmsNode.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const getText = (tagName: string): string | undefined => {
        const el = specificIcmsNode.getElementsByTagName(tagName)[0];
        return el ? el.textContent || undefined : undefined;
    };

    // A origem do produto (orig) é comum a quase todos os grupos de ICMS
    const orig = getText('orig') || '0';

    // Verificamos se é Regime Normal (CST) ou Simples Nacional (CSOSN)
    const cst = getText('CST');
    const csosn = getText('CSOSN');

    return {
        orig,
        cst,
        csosn,
        tipoICMS,
        vBC: getVal('vBC'),
        pICMS: getVal('pICMS'),
        vICMS: getVal('vICMS'),
        vBCST: getVal('vBCST'),
        pICMSST: getVal('pICMSST'),
        vICMSST: getVal('vICMSST'),
        pRedBC: getVal('pRedBC'),
    };
};
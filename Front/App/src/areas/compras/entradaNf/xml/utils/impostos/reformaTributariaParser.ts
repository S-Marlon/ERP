export interface TributoReformaData {
    cClassTrib?: string; // Código de Classificação Tributária
    // CBS
    cstCBS?: string;
    vBCCBS?: number;
    pCBS?: number;
    vCBS?: number;
    // IBS
    cstIBS?: string;
    vBCIBS?: number;
    pIBS?: number;
    vIBS?: number;
    // Imposto Seletivo (IS)
    cstIS?: string;
    vBCIS?: number;
    pIS?: number;
    vIS?: number;
}

export const parseReformaTributaria = (impostoNode: Element | null): TributoReformaData | null => {
    if (!impostoNode) return null;

    // Nota: As tags exatas seguem o layout atualizado da NT 2025.002-RTC
    const ibsCbsNode = impostoNode.getElementsByTagName('IBSCBS')[0] || impostoNode.getElementsByTagName('gIBSCBS')[0];
    const isNode = impostoNode.getElementsByTagName('IS')[0] || impostoNode.getElementsByTagName('gIS')[0];

    if (!ibsCbsNode && !isNode) return null;

    const getVal = (parent: Element | null, tagName: string): number | undefined => {
        if (!parent) return undefined;
        const el = parent.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const getText = (parent: Element | null, tagName: string): string | undefined => {
        if (!parent) return undefined;
        const el = parent.getElementsByTagName(tagName)[0];
        return el ? el.textContent || undefined : undefined;
    };

    return {
        cClassTrib: getText(ibsCbsNode, 'cClassTrib'),
        // CBS
        cstCBS: getText(ibsCbsNode, 'CST'),
        vBCCBS: getVal(ibsCbsNode, 'vBC'),
        pCBS: getVal(ibsCbsNode, 'pCBS'),
        vCBS: getVal(ibsCbsNode, 'vCBS'),
        // IBS
        cstIBS: getText(ibsCbsNode, 'CST_IBS') || getText(ibsCbsNode, 'CST'),
        vBCIBS: getVal(ibsCbsNode, 'vBC_IBS') || getVal(ibsCbsNode, 'vBC'),
        pIBS: getVal(ibsCbsNode, 'pIBS'),
        vIBS: getVal(ibsCbsNode, 'vIBS'),
        // IS
        cstIS: getText(isNode, 'CST'),
        vBCIS: getVal(isNode, 'vBC'),
        pIS: getVal(isNode, 'pIS'),
        vIS: getVal(isNode, 'vIS'),
    };
};
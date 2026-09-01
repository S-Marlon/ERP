export interface CofinsData {
    cst: string;
    vBC?: number;
    pCOFINS?: number;
    vCOFINS?: number;
    qBCProd?: number;
    vAliqProd?: number;
    tipoCOFINS?: string; // Ex: COFINSAliq, COFINSQtde, COFINSNT, COFINSOutr
}

export const parseCOFINS = (impostoNode: Element | null): CofinsData | null => {
    if (!impostoNode) return null;

    const cofinsNode = impostoNode.getElementsByTagName('COFINS')[0];
    if (!cofinsNode) return null;

    const cofinsChildren = cofinsNode.children;
    if (cofinsChildren.length === 0) return null;

    const specificCofinsNode = cofinsChildren[0];
    const tipoCOFINS = specificCofinsNode.tagName;

    const getVal = (tagName: string): number | undefined => {
        const el = specificCofinsNode.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const getText = (tagName: string): string => {
        const el = specificCofinsNode.getElementsByTagName(tagName)[0];
        return el ? el.textContent || '' : '';
    };

    return {
        cst: getText('CST'),
        vBC: getVal('vBC'),
        pCOFINS: getVal('pCOFINS'),
        vCOFINS: getVal('vCOFINS'),
        qBCProd: getVal('qBCProd'),
        vAliqProd: getVal('vAliqProd'),
        tipoCOFINS,
    };
};
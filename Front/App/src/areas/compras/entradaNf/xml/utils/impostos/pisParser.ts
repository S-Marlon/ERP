export interface PisData {
    cst: string;
    vBC?: number;
    pPIS?: number;
    vPIS?: number;
    qBCProd?: number;
    vAliqProd?: number;
    tipoPIS?: string; // Ex: PISAliq, PISQtde, PISNT, PISOutr
}

export const parsePIS = (impostoNode: Element | null): PisData | null => {
    if (!impostoNode) return null;

    const pisNode = impostoNode.getElementsByTagName('PIS')[0];
    if (!pisNode) return null;

    const pisChildren = pisNode.children;
    if (pisChildren.length === 0) return null;

    const specificPisNode = pisChildren[0];
    const tipoPIS = specificPisNode.tagName;

    const getVal = (tagName: string): number | undefined => {
        const el = specificPisNode.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const getText = (tagName: string): string => {
        const el = specificPisNode.getElementsByTagName(tagName)[0];
        return el ? el.textContent || '' : '';
    };

    return {
        cst: getText('CST'),
        vBC: getVal('vBC'),
        pPIS: getVal('pPIS'),
        vPIS: getVal('vPIS'),
        qBCProd: getVal('qBCProd'),
        vAliqProd: getVal('vAliqProd'),
        tipoPIS,
    };
};
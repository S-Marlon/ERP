export interface IpiData {
    cst: string;
    clEnq?: string;
    CNPJProd?: string;
    cSelo?: string;
    qSelo?: number;
    vBC?: number;
    pIPI?: number;
    qBCProd?: number;
    vAliqProd?: number;
    vIPI?: number;
    tipoIPI?: string; // Ex: IPITrib, IPINT
}

export const parseIPI = (impostoNode: Element | null): IpiData | null => {
    if (!impostoNode) return null;

    const ipiNode = impostoNode.getElementsByTagName('IPI')[0];
    if (!ipiNode) return null;

    // O IPI possui o campo opcional <clEnq> ou <CNPJProd> e <cSelo> antes da tag de tributação (<IPITrib> ou <IPINT>)
    const getText = (parent: Element, tagName: string): string => {
        const el = parent.getElementsByTagName(tagName)[0];
        return el ? el.textContent || '' : '';
    };

    const clEnq = getText(ipiNode, 'clEnq');
    const CNPJProd = getText(ipiNode, 'CNPJProd');
    const cSelo = getText(ipiNode, 'cSelo');
    
    const qSeloEl = ipiNode.getElementsByTagName('qSelo')[0];
    const qSelo = qSeloEl && qSeloEl.textContent ? parseInt(qSeloEl.textContent, 10) : undefined;

    // Buscando a tag de tributação interna (IPITrib ou IPINT)
    const ipiTrib = ipiNode.getElementsByTagName('IPITrib')[0];
    const ipiNT = ipiNode.getElementsByTagName('IPINT')[0];
    
    const targetNode = ipiTrib || ipiNT;
    if (!targetNode) return null;

    const tipoIPI = targetNode.tagName;

    const getVal = (tagName: string): number | undefined => {
        const el = targetNode.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const cst = getText(targetNode, 'CST');

    return {
        cst,
        clEnq: clEnq || undefined,
        CNPJProd: CNPJProd || undefined,
        cSelo: cSelo || undefined,
        qSelo: isNaN(Number(qSelo)) ? undefined : qSelo,
        vBC: getVal('vBC'),
        pIPI: getVal('pIPI'),
        qBCProd: getVal('qBCProd'),
        vAliqProd: getVal('vAliqProd'),
        vIPI: getVal('vIPI'),
        tipoIPI,
    };
};
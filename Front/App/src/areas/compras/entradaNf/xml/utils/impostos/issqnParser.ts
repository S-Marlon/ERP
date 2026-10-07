export interface IssqnData {
    vBC?: number;
    vAliq?: number;
    vISSQN?: number;
    cMunFG?: string;
    cListServ?: string;
    vDeducao?: number;
    vOutr?: number;
    vDescIncond?: number;
    vDescCond?: number;
    vISSRet?: number;
    indISS?: string;
    cServico?: string;
    cMun?: string;
    cPais?: string;
    nProcesso?: string;
    indIncentivo?: string;
}

export const parseISSQN = (impostoNode: Element | null): IssqnData | null => {
    if (!impostoNode) return null;

    const issqnNode = impostoNode.getElementsByTagName('ISSQN')[0];
    if (!issqnNode) return null;

    const getVal = (tagName: string): number | undefined => {
        const el = issqnNode.getElementsByTagName(tagName)[0];
        if (!el || !el.textContent) return undefined;
        const num = parseFloat(el.textContent);
        return isNaN(num) ? undefined : num;
    };

    const getText = (tagName: string): string | undefined => {
        const el = issqnNode.getElementsByTagName(tagName)[0];
        return el ? el.textContent || undefined : undefined;
    };

    return {
        vBC: getVal('vBC'),
        vAliq: getVal('vAliq'),
        vISSQN: getVal('vISSQN'),
        cMunFG: getText('cMunFG'),
        cListServ: getText('cListServ'),
        vDeducao: getVal('vDeducao'),
        vOutr: getVal('vOutr'),
        vDescIncond: getVal('vDescIncond'),
        vDescCond: getVal('vDescCond'),
        vISSRet: getVal('vISSRet'),
        indISS: getText('indISS'),
        cServico: getText('cServico'),
        cMun: getText('cMun'),
        cPais: getText('cPais'),
        nProcesso: getText('nProcesso'),
        indIncentivo: getText('indIncentivo'),
    };
};
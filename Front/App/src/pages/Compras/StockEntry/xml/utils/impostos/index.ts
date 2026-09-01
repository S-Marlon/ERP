import { parseICMS, IcmsData } from './icmsParser';
import { parsePIS, PisData } from './pisParser';
import { parseCOFINS, CofinsData } from './cofinsParser';
import { parseIPI, IpiData } from './ipiParser';
import { parseISSQN, IssqnData } from './issqnParser';
import { parseReformaTributaria, TributoReformaData } from './reformaTributariaParser';

export interface ImpostosItemData {
    icms: IcmsData | null;
    pis: PisData | null;
    cofins: CofinsData | null;
    ipi: IpiData | null;
    issqn: IssqnData | null;
    reformaTributaria: TributoReformaData | null;
}

export const parseImpostosItem = (impostoNode: Element | null): ImpostosItemData | null => {
    if (!impostoNode) return null;

    return {
        icms: parseICMS(impostoNode),
        pis: parsePIS(impostoNode),
        cofins: parseCOFINS(impostoNode),
        ipi: parseIPI(impostoNode),
        issqn: parseISSQN(impostoNode),
        reformaTributaria: parseReformaTributaria(impostoNode),
    };
};
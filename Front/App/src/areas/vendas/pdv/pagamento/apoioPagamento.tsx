// Apoio da finalização: calculadora, último comprovante e preferências do PDV (guardadas neste navegador).
import React, { useState } from 'react';
import { Button, Flex, Typography, theme } from 'antd';
import { imprimirExtratoElgin } from '../../../../shared/utils/printService';

type DadosImpressao = Parameters<typeof imprimirExtratoElgin>[0];

// ---------------------------------------------------------------- Preferências do PDV
export interface PreferenciasPdv {
    impressaoAutomatica: boolean; somConfirmacao: boolean;
    // Frete por km: valor do km e frete mínimo (lembrados para a próxima venda)
    freteValorKm: number; freteMinimo: number;
}
const CHAVE_PREFERENCIAS = 'pdv:preferencias';
const PADRAO: PreferenciasPdv = { impressaoAutomatica: true, somConfirmacao: true, freteValorKm: 0, freteMinimo: 0 };

export const lerPreferencias = (): PreferenciasPdv => {
    try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || '{}') }; }
    catch { return PADRAO; }
};
export const salvarPreferencias = (p: PreferenciasPdv) => {
    try { localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p)); } catch { /* sem armazenamento */ }
};

// ---------------------------------------------------------------- Último comprovante (reimpressão e envio)
const CHAVE_ULTIMO = 'pdv:ultimoComprovante';
let ultimoEmMemoria: DadosImpressao | null = null;

export const guardarUltimoComprovante = (dados: DadosImpressao) => {
    ultimoEmMemoria = dados;
    try { localStorage.setItem(CHAVE_ULTIMO, JSON.stringify(dados)); } catch { /* sem armazenamento */ }
};
export const ultimoComprovante = (): DadosImpressao | null => {
    if (ultimoEmMemoria) return ultimoEmMemoria;
    try { return JSON.parse(localStorage.getItem(CHAVE_ULTIMO) || 'null'); } catch { return null; }
};

/** Texto do comprovante para WhatsApp/e-mail. */
export const textoComprovante = (d: DadosImpressao) => {
    const brl = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;
    return [
        `Venda Nº ${d.numero}${d.cliente && d.cliente !== 'CONSUMIDOR' ? ` · ${d.cliente}` : ''}`,
        ...d.itens.map(i => `${i.quantity} ${i.unidade || 'UN'} x ${i.name} · ${brl(i.price * i.quantity)}`),
        `Total: ${brl(d.total)}`,
        ...d.pagamentos.map(p => `${p.metodo}${p.parcelas && p.parcelas > 1 ? ` ${p.parcelas}x` : ''}: ${brl(p.valor)}`),
        ...(d.troco > 0 ? [`Troco: ${brl(d.troco)}`] : []),
    ].join('\n');
};

export const bipConfirmacao = () => {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 880;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch { /* sem áudio */ }
};

// ---------------------------------------------------------------- Calculadora
// Conta com precedência (× ÷ antes de + −), sem eval
const calcular = (expressao: string): number | null => {
    const partes = expressao.match(/\d+(?:\.\d+)?|[+\-*/]/g);
    if (!partes || /[+\-*/]$/.test(expressao)) return null;
    const termos: Array<number | string> = [];
    for (let i = 0; i < partes.length; i++) {
        const p = partes[i];
        if (p === '*' || p === '/') {
            const a = Number(termos.pop());
            const b = Number(partes[++i]);
            termos.push(p === '*' ? a * b : b === 0 ? NaN : a / b);
        } else termos.push(/\d/.test(p) ? Number(p) : p);
    }
    let total = Number(termos[0]);
    for (let i = 1; i < termos.length; i += 2) total = termos[i] === '+' ? total + Number(termos[i + 1]) : total - Number(termos[i + 1]);
    return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
};

export const Calculadora: React.FC<{ onUsar?: (valor: number) => void }> = ({ onUsar }) => {
    const { token } = theme.useToken();
    const [expressao, setExpressao] = useState('');
    const resultado = calcular(expressao);
    const teclar = (t: string) => {
        if (t === 'C') return setExpressao('');
        if (t === '←') return setExpressao(e => e.slice(0, -1));
        if (t === '=') return resultado !== null && setExpressao(String(resultado));
        setExpressao(e => {
            if (/[+\-*/]/.test(t) && (e === '' || /[+\-*/]$/.test(e))) return e === '' ? e : e.slice(0, -1) + t;
            if (t === '.' && /\.\d*$/.test(e)) return e;
            return e + t;
        });
    };
    const rotulo = (t: string) => ({ '*': '×', '/': '÷', '-': '−' }[t] || t);
    return (
        <Flex vertical gap={6} style={{ width: 220 }}>
            <div style={{ textAlign: 'right', padding: '6px 8px', borderRadius: token.borderRadius, background: token.colorFillTertiary }}>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', minHeight: 18 }}>
                    {expressao.replace(/\*/g, '×').replace(/\//g, '÷') || '0'}
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: 20 }}>{resultado !== null ? resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Typography.Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {['C', '←', '/', '*', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map(t => (
                    <Button key={t} onClick={() => teclar(t)} type={t === '=' ? 'primary' : 'default'} danger={t === 'C'}
                        style={{ height: 36, padding: 0, ...(t === '0' ? { gridColumn: 'span 2' } : {}) }}>{rotulo(t)}</Button>
                ))}
            </div>
            {onUsar && <Button block disabled={resultado === null || resultado <= 0} onClick={() => resultado !== null && onUsar(resultado)}>Usar como valor do pagamento</Button>}
        </Flex>
    );
};

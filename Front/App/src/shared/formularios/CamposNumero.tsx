// Campos numéricos padrão (dinheiro, quantidade, percentual) e de data. São o InputNumber/DatePicker do antd com o
// jeito brasileiro: vírgula decimal, aceita colar "1.234,56" ou "R$ 10,00", e data dia/mês/ano que se digita sem barras.
// Qualquer prop do antd continua valendo (min, max, precision, style, addonAfter...) e sobrepõe o padrão.
import { forwardRef } from 'react';
import { DatePicker, InputNumber } from 'antd';
import type { DatePickerProps, GetRef, InputNumberProps } from 'antd';
import { formatarNumeroBr, FORMATOS_DATA, lerNumeroBr } from './numeros';

type Props = InputNumberProps<number>;
type Ref = GetRef<typeof InputNumber>;

/** Número qualquer (troca direta do InputNumber): vírgula decimal e leitura de "1,5", "1.5", "1.234,56". */
export const CampoNumero = forwardRef<Ref, Props>((props, ref) => (
  <InputNumber<number> ref={ref} decimalSeparator="," parser={v => lerNumeroBr(v) as unknown as number} {...props} />
));
CampoNumero.displayName = 'CampoNumero';

/** Dinheiro: "R$", 2 casas (custo unitário pode usar precision={4}) e ponto de milhar fora da digitação. */
export const CampoDinheiro = forwardRef<Ref, Props>(({ precision = 2, ...props }, ref) => (
  <InputNumber<number>
    ref={ref}
    prefix="R$"
    precision={precision}
    decimalSeparator=","
    parser={v => lerNumeroBr(v) as unknown as number}
    formatter={(v, info) => (info.userTyping ? info.input : formatarNumeroBr(v, precision))}
    {...props}
  />
));
CampoDinheiro.displayName = 'CampoDinheiro';

/** Quantidade: até 3 casas (metro, kg), sem zeros sobrando; `unidade` aparece no fim ("m", "kg"). */
export const CampoQuantidade = forwardRef<Ref, Props & { unidade?: string }>(({ unidade, precision = 3, ...props }, ref) => (
  <InputNumber<number>
    ref={ref}
    min={0}
    suffix={unidade}
    decimalSeparator=","
    parser={v => lerNumeroBr(v) as unknown as number}
    formatter={(v, info) => (info.userTyping ? info.input : formatarNumeroBr(v, precision, { milhar: false, casasMax: true }))}
    {...props}
  />
));
CampoQuantidade.displayName = 'CampoQuantidade';

/** Percentual: "%" no fim, 2 casas sem zeros sobrando. */
export const CampoPercentual = forwardRef<Ref, Props>(({ precision = 2, ...props }, ref) => (
  <InputNumber<number>
    ref={ref}
    suffix="%"
    decimalSeparator=","
    parser={v => lerNumeroBr(v) as unknown as number}
    formatter={(v, info) => (info.userTyping ? info.input : formatarNumeroBr(v, precision, { milhar: false, casasMax: true }))}
    {...props}
  />
));
CampoPercentual.displayName = 'CampoPercentual';

/** Data dd/mm/aaaa; dá para digitar "01022026" ou "01/02/26". */
export const CampoData = (props: DatePickerProps) => <DatePicker format={FORMATOS_DATA} placeholder="dd/mm/aaaa" {...props} />;

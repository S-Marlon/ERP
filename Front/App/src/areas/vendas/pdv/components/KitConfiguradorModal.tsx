// Escolha das variações de um kit configurável ao colocar no carrinho (ex.: CV da bomba, bitola e metros do fio).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, InputNumber, Modal, Select, Space, Statistic, Tag, Typography } from 'antd';
import { calcularKit, EscolhaKitPdv, escolhasPadrao, PosicaoKit } from '../utils/kitPdv';

const { Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export interface KitPendente {
  nome: string;
  precoKit: number;          // preço do kit (com as variações padrão) na unidade da linha
  posicoes: PosicaoKit[];
  escolhas?: EscolhaKitPdv[]; // editando uma linha que já está no carrinho
}

interface Props {
  pendente: KitPendente | null;
  onConfirmar: (escolhas: EscolhaKitPdv[]) => void;
  onCancelar: () => void;
}

const KitConfiguradorModal: React.FC<Props> = ({ pendente, onConfirmar, onCancelar }) => {
  const [escolhas, setEscolhas] = useState<EscolhaKitPdv[]>([]);
  useEffect(() => {
    if (pendente) setEscolhas(pendente.escolhas || escolhasPadrao(pendente.posicoes));
  }, [pendente]);

  const calculo = useMemo(() => (pendente ? calcularKit(pendente.posicoes, escolhas) : null), [pendente, escolhas]);
  if (!pendente || !calculo) return null;

  const mudar = (slot: number, patch: Partial<EscolhaKitPdv>) =>
    setEscolhas(es => es.map(e => (e.slot === slot ? { ...e, ...patch } : e)));
  const semEstoque = calculo.estoque === 0;
  const qtdInvalida = escolhas.some(e => !(e.quantidade > 0));

  return (
    <Modal
      open
      width={760}
      title={`Montar: ${pendente.nome}`}
      okText="Colocar no carrinho"
      cancelText="Cancelar"
      onOk={() => onConfirmar(escolhas)}
      onCancel={onCancelar}
      okButtonProps={{ disabled: semEstoque || qtdInvalida }}
      destroyOnHidden
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {pendente.posicoes.map(p => {
          const e = escolhas.find(x => x.slot === p.slot);
          const escolhida = p.opcoes.find(o => o.idItem === e?.idItem) || p.padrao;
          const faltando = !escolhida.servico && !escolhida.podeVenderSemEstoque && escolhida.saldo < (e?.quantidade || 0);
          return (
            <Card key={p.slot} size="small" styles={{ body: { padding: '8px 12px' } }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  {p.permiteTrocar ? (
                    <>
                      <Text type="secondary" style={{ fontSize: 12 }}>{p.familia || 'Variação'}</Text>
                      <Select
                        style={{ width: '100%' }}
                        value={escolhida.idItem}
                        onChange={(id: number) => mudar(p.slot, { idItem: id })}
                        showSearch
                        optionFilterProp="label"
                        popupMatchSelectWidth={false}
                        options={p.opcoes.map(o => ({
                          value: o.idItem,
                          label: `${o.grade || o.sku} ${o.nome}`,
                          title: o.nome,
                          disabled: !o.servico && !o.podeVenderSemEstoque && o.saldo <= 0,
                        }))}
                        optionRender={opt => {
                          const o = p.opcoes.find(x => x.idItem === opt.value)!;
                          const dif = o.preco * (e?.quantidade || p.quantidadePadrao) - p.padrao.preco * p.quantidadePadrao;
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                              <span>
                                {o.grade ? <Tag color="blue" style={{ marginRight: 6 }}>{o.grade}</Tag> : null}
                                {o.nome} <Text type="secondary" style={{ fontSize: 11 }}>{o.sku}</Text>
                              </span>
                              <span style={{ whiteSpace: 'nowrap' }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>saldo {num(o.saldo)} {o.unidade}</Text>
                                {o.idItem !== p.padrao.idItem && (
                                  <Text style={{ marginLeft: 8 }} type={dif > 0 ? 'warning' : 'success'}>{dif >= 0 ? '+' : '−'}{brl(Math.abs(dif))}</Text>
                                )}
                              </span>
                            </div>
                          );
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Text type="secondary" style={{ fontSize: 12 }}>Fixo no kit</Text>
                      <div>{escolhida.nome} <Text type="secondary" style={{ fontSize: 11 }}>{escolhida.sku}</Text></div>
                    </>
                  )}
                </div>
                <div style={{ width: 150 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Quantidade</Text>
                  {p.permiteAlterarQtd ? (
                    <InputNumber
                      style={{ width: '100%' }} min={0.001} step={1} value={e?.quantidade}
                      addonAfter={escolhida.unidade || undefined}
                      onChange={v => mudar(p.slot, { quantidade: Number(v) || 0 })}
                    />
                  ) : (
                    <div>{num(p.quantidadePadrao)} {escolhida.unidade}</div>
                  )}
                </div>
              </div>
              {faltando && <Text type="danger" style={{ fontSize: 12 }}>Saldo de {escolhida.sku}: {num(escolhida.saldo)} {escolhida.unidade}</Text>}
            </Card>
          );
        })}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Statistic title="Preço do kit" value={pendente.precoKit} precision={2} prefix="R$" />
          <Statistic title="Diferença" value={calculo.ajuste} precision={2} prefix={calculo.ajuste >= 0 ? '+ R$' : '− R$'}
            formatter={v => Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <Statistic title="Preço montado" value={Math.max(0, pendente.precoKit + calculo.ajuste)} precision={2} prefix="R$" valueStyle={{ color: '#1677ff' }} />
          <Statistic title="Dá para montar" value={calculo.estoque === null ? '∞' : calculo.estoque} valueStyle={{ color: semEstoque ? '#cf1322' : undefined }} />
        </div>
        {semEstoque && <Alert type="error" showIcon message="Falta estoque de algum item escolhido para montar este kit." />}
      </Space>
    </Modal>
  );
};

export default KitConfiguradorModal;

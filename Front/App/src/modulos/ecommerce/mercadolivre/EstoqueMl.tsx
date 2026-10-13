// Estoque no Mercado Livre: quanto fica para a loja (reserva), o teto no ML e a atualização automática.
import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Flex, InputNumber, Popover, Row, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import type { AnuncioDetalhe, ItemDoAnuncio } from './mercadoLivreApi';

const { Text } = Typography;

const quando = (s: string | null) => (s ? s.split(' ').reverse().join(' · ').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2') : null);

interface CardProps {
  det: AnuncioDetalhe;
  onSalvar: (corpo: { estoqueReserva?: number; estoqueMaximo?: number | null; estoqueAutomatico?: boolean }) => void;
  onSincronizar: () => void;
  sincronizando: boolean;
}

/** Regra do anúncio: vale para todos os itens que não têm a sua. */
export const EstoqueAnuncioCard: React.FC<CardProps> = ({ det, onSalvar, onSincronizar, sincronizando }) => {
  const [reserva, setReserva] = useState<number | null>(det.estoqueReserva);
  const [maximo, setMaximo] = useState<number | null>(det.estoqueMaximo);
  useEffect(() => { setReserva(det.estoqueReserva); setMaximo(det.estoqueMaximo); }, [det.estoqueReserva, det.estoqueMaximo]);

  const totalErp = det.itens.reduce((s, i) => s + Math.max(0, i.estoque), 0);
  const totalMl = det.itens.reduce((s, i) => s + i.estoqueMl, 0);

  return (
    <Card
      size="small" style={{ marginBottom: 16 }} title="Estoque no Mercado Livre"
      extra={<Text type="secondary" style={{ fontSize: 12 }}>ERP {totalErp} · vai para o ML {totalMl}</Text>}
    >
      <Row gutter={16} align="bottom">
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>Reserva da loja (por item)</Text>
          <InputNumber
            style={{ width: '100%' }} min={0} precision={0} suffix="un." value={reserva}
            onChange={v => setReserva(v)} onBlur={() => { const v = reserva ?? 0; if (v !== det.estoqueReserva) onSalvar({ estoqueReserva: v }); }}
          />
        </Col>
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>Teto no ML (por item)</Text>
          <InputNumber
            style={{ width: '100%' }} min={0} precision={0} suffix="un." placeholder="sem teto" value={maximo}
            onChange={v => setMaximo(v)} onBlur={() => { if ((maximo ?? null) !== det.estoqueMaximo) onSalvar({ estoqueMaximo: maximo ?? null }); }}
          />
        </Col>
        <Col xs={24} md={12}>
          <Flex gap={8} align="center" wrap justify="flex-end">
            <Tooltip title="Quando o estoque ou o preço mudam no ERP (venda, nota, ajuste), o ML recebe sozinho em poucos minutos">
              <Space size={6}>
                <Switch size="small" checked={det.estoqueAutomatico} onChange={v => onSalvar({ estoqueAutomatico: v })} />
                <Text>Atualizar sozinho</Text>
              </Space>
            </Tooltip>
            {det.publicados > 0 && (
              <Button icon={<SyncOutlined />} loading={sincronizando} onClick={onSincronizar}>Atualizar agora no ML</Button>
            )}
          </Flex>
        </Col>
      </Row>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        No ML vai o saldo menos a reserva, até o teto (ex.: saldo 24, reserva 4, teto 10 → 10). Kit: quantos dá para montar com os componentes.
        {det.publicados > 0 && (det.sincronizadoEm ? ` Última atualização: ${quando(det.sincronizadoEm)}.` : ' Ainda não atualizado depois da publicação.')}
        {det.publicados > 0 && !det.estoqueAutomatico && ' Atualização automática desligada: use o botão.'}
      </Text>
    </Card>
  );
};

interface CelulaProps {
  item: ItemDoAnuncio;
  det: AnuncioDetalhe;
  onSalvarRegra: (regra: { estoqueReserva?: number | null; estoqueMaximo?: number | null; idUnidade?: number | null }) => Promise<void> | void;
}

/** Estoque do item: saldo do ERP, o que vai para o ML e a exceção do item (clicando). */
export const EstoqueItemCelula: React.FC<CelulaProps> = ({ item, det, onSalvarRegra }) => {
  const [aberto, setAberto] = useState(false);
  // backend de versão anterior pode não mandar estes campos: a célula não pode quebrar a tela
  const unidades = item.unidades || [];
  const regraItem = item.ml?.regra || { reserva: null, maximo: null };
  const [reserva, setReserva] = useState<number | null>(regraItem.reserva);
  const [maximo, setMaximo] = useState<number | null>(regraItem.maximo);
  useEffect(() => { setReserva(regraItem.reserva); setMaximo(regraItem.maximo); }, [regraItem.reserva, regraItem.maximo, aberto]);
  const temExcecao = regraItem.reserva !== null || regraItem.maximo !== null;
  const desatualizado = !!item.ml?.mlbId && item.ml.estoqueEnviado != null && item.ml.estoqueEnviado !== item.estoqueMl;

  const salvar = async (regra: { estoqueReserva?: number | null; estoqueMaximo?: number | null; idUnidade?: number | null }) => {
    await onSalvarRegra(regra);
    setAberto(false);
  };

  const conteudo = (
    <Space direction="vertical" size={8} style={{ width: 280 }}>
      {unidades.length > 0 && (
        <div>
          <Text style={{ fontSize: 12 }}>Vende no ML como</Text>
          <Select
            style={{ width: '100%' }} value={item.unidadeMl?.idUnidade ?? 0}
            onChange={(v: number) => salvar({ idUnidade: v || null })}
            options={[
              { value: 0, label: `${item.siglaBase || 'Unidade base'} (1 por 1)` },
              ...unidades.map(u => ({ value: u.idUnidade, label: `${u.nome} (${u.sigla}) = ${u.fator} ${item.siglaBase || 'un.'}${u.preco ? ` · R$ ${u.preco.toFixed(2).replace('.', ',')}` : ''}` })),
            ]}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>Estoque e preço do ML passam a contar nessa unidade (ex.: pacote c/12).</Text>
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>Só para {item.sku}. Vazio = regra do anúncio (reserva {det.estoqueReserva}, teto {det.estoqueMaximo ?? 'sem'}).</Text>
      <Flex gap={8}>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 12 }}>Reserva da loja</Text>
          <InputNumber style={{ width: '100%' }} min={0} precision={0} value={reserva} placeholder={String(det.estoqueReserva)} onChange={setReserva} />
        </div>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 12 }}>Teto no ML</Text>
          <InputNumber style={{ width: '100%' }} min={0} precision={0} value={maximo} placeholder={det.estoqueMaximo === null ? 'sem teto' : String(det.estoqueMaximo)} onChange={setMaximo} />
        </div>
      </Flex>
      <Flex justify="space-between">
        <Button size="small" disabled={!temExcecao} onClick={() => salvar({ estoqueReserva: null, estoqueMaximo: null })}>Usar a do anúncio</Button>
        <Button size="small" type="primary" onClick={() => salvar({ estoqueReserva: reserva, estoqueMaximo: maximo })}>Aplicar</Button>
      </Flex>
    </Space>
  );

  return (
    <Popover trigger="click" open={aberto} onOpenChange={setAberto} title="Estoque deste item no ML" content={conteudo} destroyOnHidden>
      <div style={{ cursor: 'pointer', lineHeight: 1.25, textAlign: 'right' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>{item.kit ? 'monta' : 'ERP'}</Text>{' '}
          {item.unidadeMl
            ? <Tooltip title={`${item.estoqueBase} ${item.siglaBase || ''} = ${item.estoque} ${item.unidadeMl.sigla} (${item.unidadeMl.fator} por ${item.unidadeMl.sigla})`}>
                <Text type={item.estoque > 0 ? undefined : 'warning'}>{item.estoqueBase} {item.siglaBase} = {item.estoque} {item.unidadeMl.sigla}</Text>
              </Tooltip>
            : <Text type={item.estoque > 0 ? undefined : 'warning'}>{item.estoque}</Text>}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>ML</Text> <Text strong>{item.estoqueMl}</Text>
          {temExcecao && <Tooltip title="Este item tem regra própria"><Tag color="purple" style={{ fontSize: 10, marginLeft: 4, marginRight: 0, padding: '0 3px' }}>próp.</Tag></Tooltip>}
        </div>
        {item.kit && <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 3px' }}>kit</Tag>}
        {desatualizado && (
          <Tooltip title={`No ML está ${item.ml.estoqueEnviado}; vai ${item.estoqueMl} na próxima atualização`}>
            <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 3px' }}>ML: {item.ml.estoqueEnviado}</Tag>
          </Tooltip>
        )}
      </div>
    </Popover>
  );
};

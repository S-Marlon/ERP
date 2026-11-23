// Nova conta da loja no contas a pagar (água, luz, seguro em 10x, conserto...): uma ou várias parcelas mensais.
// Conta que se repete todo mês vai melhor como conta fixa (o ERP lança sozinho).
import React, { useEffect, useState } from 'react';
import { Alert, Checkbox, Col, Input, Modal, Row, Select, Space, Typography, message } from 'antd';
import { FORMAS_PAGAMENTO, hojeIso, NovaConta, pagarApi } from './pagarApi';
import { QuemRecebe, SelectCategoria, useDadosConta } from './camposConta';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const vazio = (): NovaConta => ({
  descricao: '', idCategoria: null, idFornecedor: null, favorecido: null, vencimento: hojeIso(), valor: 0, parcelas: 1, forma: 'BOLETO', codigoBarras: null, estimado: false,
});

const NovaContaModal: React.FC<{ aberto: boolean; onFechar: () => void; onSalvo: () => void; onContaFixa?: () => void }> = ({ aberto, onFechar, onSalvo, onContaFixa }) => {
  const [c, setC] = useState<NovaConta>(vazio());
  const [salvando, setSalvando] = useState(false);
  const { categorias, fornecedores } = useDadosConta(aberto);
  useEffect(() => { if (aberto) setC(vazio()); }, [aberto]);
  const mudar = (p: Partial<NovaConta>) => setC(x => ({ ...x, ...p }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await pagarApi.criarConta({ ...c, codigoBarras: c.codigoBarras?.trim() || null, favorecido: c.favorecido?.trim() || null });
      message.success(r.parcelas > 1 ? `${r.parcelas} parcelas lançadas (${brl(r.total)}).` : 'Conta lançada.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao lançar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} title="Nova conta a pagar" okText="Lançar" cancelText="Voltar" onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={560}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {onContaFixa && (
          <Alert type="info" showIcon message={<span>Conta que se repete (aluguel, luz, internet)? Cadastre como <a onClick={onContaFixa}>conta fixa</a>: o ERP lança todo mês sozinho.</span>} />
        )}
        <div><Text>Descrição</Text><Input placeholder="Ex.: Conserto do ar-condicionado" maxLength={150} value={c.descricao} onChange={e => mudar({ descricao: e.target.value })} /></div>
        <div><Text>Quem recebe</Text><QuemRecebe idFornecedor={c.idFornecedor} favorecido={c.favorecido} fornecedores={fornecedores} onChange={mudar} /></div>
        <div><Text>Categoria</Text><SelectCategoria categorias={categorias} value={c.idCategoria} onChange={idCategoria => mudar({ idCategoria })} /></div>
        <Row gutter={10}>
          <Col span={9}><Text>{c.parcelas > 1 ? '1º vencimento' : 'Vencimento'}</Text><Input type="date" value={c.vencimento} onChange={e => mudar({ vencimento: e.target.value })} /></Col>
          <Col span={9}>
            <Text>{c.parcelas > 1 ? 'Valor de cada parcela' : 'Valor'}</Text>
            <CampoDinheiro min={0} precision={2} style={{ width: '100%' }} value={c.valor} onChange={v => mudar({ valor: Number(v) || 0 })} />
          </Col>
          <Col span={6}><Text>Parcelas</Text><CampoNumero min={1} max={60} style={{ width: '100%' }} value={c.parcelas} onChange={v => mudar({ parcelas: Number(v) || 1 })} /></Col>
        </Row>
        {c.parcelas > 1 && <Text type="secondary" style={{ fontSize: 12 }}>{c.parcelas} parcelas mensais de {brl(c.valor)} = {brl(c.valor * c.parcelas)}, no mesmo dia de cada mês.</Text>}
        <Row gutter={10}>
          <Col span={10}><Text>Forma</Text><Select style={{ width: '100%' }} value={c.forma} options={FORMAS_PAGAMENTO} onChange={forma => mudar({ forma })} /></Col>
          {c.parcelas === 1 && (
            <Col span={14}><Text>Linha digitável (opcional)</Text><Input placeholder="cole a linha do boleto" value={c.codigoBarras || ''} onChange={e => mudar({ codigoBarras: e.target.value })} /></Col>
          )}
        </Row>
        <Checkbox checked={c.estimado} onChange={e => mudar({ estimado: e.target.checked })}>
          Valor estimado <Text type="secondary" style={{ fontSize: 12 }}>(a conta ainda não chegou: confirme o valor depois)</Text>
        </Checkbox>
      </Space>
    </Modal>
  );
};

export default NovaContaModal;

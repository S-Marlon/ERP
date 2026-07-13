import React, { useMemo } from 'react';
import { 
  Typography, 
  Button, 
  Badge, 
  Upload, 
  Row, 
  Col, 
  Card, 
  Alert, 
  Divider, 
  Spin, 
  Space,
  Statistic
} from 'antd';
import { 
  UploadOutlined, 
  SyncOutlined, 
  CheckCircleOutlined, 
  WarningOutlined,
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import MappingModal from './_components/ProductMappingModal';
import NfeCards from './_components/NfeCards';
import { ItemsConference } from './ItemsConference';
import { useStockEntry } from './useStockEntry';
import { SupplierModal } from './SupplierModal';

const { Title, Text } = Typography;

const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const StockEntryForm: React.FC = () => {
  const {
    financials, items, subtotal, adjustedPhysicalSubtotal, isSubmitDisabled,
    frete, 
    supplierExists, isSupplierChecking, isSupplierModalOpen, supplierCreationLoading,
    supplierCreationName, supplierCreationFantasyName, supplierToCreate,
    isMappingModalOpen, itemToMap, isProcessingItems,
    setSupplierCreationName, setSupplierCreationFantasyName,
    handleXmlUpload, handleCancelSupplierCreation, handleCreateSupplierSubmit,
    handleConfirmItems, handleUnconfirmItems, handleToggleSingleItem,
    handleRemoveItemsFromConference, handleOpenMappingFromTable, handleModalMapSuccess,
    handleQuantityReceivedChange, handleAssignGroupToItems, setIsMappingModalOpen, setItemToMap,
    setIsSupplierModalOpen 
  } = useStockEntry();

  // Memos operacionais
  const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
  const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
  const totalUnmapped = useMemo(() => items.filter(i => !i.mappedId).length, [items]);
  const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
  const totalDiscounts = useMemo(() => items.reduce((acc, it) => acc + (it.valorDesconto || 0), 0), [items]);

  // Função adaptadora para o componente Upload do Ant Design
  const beforeUpload = (file: File) => {
    // Simula o evento nativo esperado pelo seu hook atual
    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleXmlUpload(mockEvent);
    return false; // Evita envio automático via HTTP
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      
      {/* 1. CABEÇALHO DA PÁGINA */}
      <Card style={{ marginBottom: 24, borderRadius: 8 }} bordered={false}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Title level={3} style={{ margin: 0 }}>
              📥 Entrada de Mercadorias <Text type="secondary" style={{ fontSize: '16px' }}>(Registro de NF-e)</Text>
            </Title>
            <Space size="small" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <Badge count={`Pendentes: ${items.length}`} color="amber" />
              <Badge count={`Conferidos: ${totalConfirmed}`} color="green" />
              <Badge count={`Divergências: ${totalDivergences}`} color="red" />
              <Badge count={`Sem Vínculo: ${totalUnmapped}`} color="purple" />
            </Space>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Upload beforeUpload={beforeUpload} accept=".xml" showUploadList={false}>
              <Button 
                type={financials.accessKey ? 'default' : 'primary'} 
                icon={financials.accessKey ? <SyncOutlined /> : <UploadOutlined />}
                size="large"
              >
                {financials.accessKey ? 'Alterar XML da Nota' : 'Importar XML da NF-e'}
              </Button>
            </Upload>
          </Col>
        </Row>
      </Card>

      {/* 2. LAYOUT DO WORKSPACE */}
      <Spin spinning={isProcessingItems} tip="Analisando e vinculando itens com o banco...">
        <Row gutter={[24, 24]}>
          
          {/* COLUNA ESQUERDA - FLUXO PRINCIPAL */}
          <Col xs={24} lg={18}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              {financials.accessKey && (
                <NfeCards
                  data={{
                    chaveAcesso: financials.accessKey,
                    numero: financials.invoiceNumber.replace('NF ', ''),
                    serie: '1',
                    dataEmissao: financials.entryDate,
                    emitente: { cnpj: financials.supplierCnpj, nome: financials.supplier, nomeFantasia: financials.supplierFantasyName },
                    frete: frete, 
                    totais: {
                      valorTotalProdutos: subtotal,
                      valorTotalIpi: financials.totalIpi,
                      valorTotalFrete: financials.totalFreight,
                      valorOutrasDespesas: financials.totalOtherExpenses,
                      valorTotalDesconto: totalDiscounts,
                      valorTotalIcms: 0,
                      valorTotalIcmsST: financials.totalIcmsST,
                      valorTotalIBS: financials.totalIBS,
                      valorTotalCBS: financials.totalCBS,
                      valorTotalNf: financials.totalNoteValue,
                      valorTotalTributos: (financials.totalIpi + financials.totalIcmsST + (financials.totalIBS || 0) + (financials.totalCBS || 0)),
                    }
                  }}
                  supplierStatus={{ exists: supplierExists, isChecking: isSupplierChecking }}
                  actions={{ onCreateSupplier: () => setIsSupplierModalOpen(true), formatCurrency }}
                />
              )}

              {items.length > 0 && (
                <Card bordered={false} style={{ borderRadius: 8 }}>
                  <ItemsConference
                    items={items.map((i, index) => ({ ...i, nItem: i.nItem || index + 1, confirmed: i.isConfirmed, isConfirmed: i.isConfirmed }))}
                    onConfirmItems={handleConfirmItems}
                    onUnconfirmItems={handleUnconfirmItems}
                    onMapProducts={handleOpenMappingFromTable}
                    onRemoveItems={handleRemoveItemsFromConference}
                    onToggleItem={handleToggleSingleItem}
                    onQuantityChange={handleQuantityReceivedChange} 
                    onAssignGroupToItems={handleAssignGroupToItems}
                    onUnassignGroup={() => {}}
                    onUnassignItem={() => {}}
                  />
                </Card>
              )}
            </Space>
          </Col>

          {/* COLUNA DIREITA - ALERTAS E RESUMO FINANCEIRO */}
          <Col xs={24} lg={6}>
            <Space direction="vertical" size={24} style={{ width: '100%', sticky: 'top', top: 24 }}>
              
              {/* Painel de Alertas de Divergência */}
              {totalDivergences > 0 ? (
                <Alert
                  message={<Text strong style={{ color: '#a8071a' }}>🚨 Divergências Detectadas ({totalDivergences})</Text>}
                  description={
                    <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: 8 }}>
                      {items.filter(i => i.difference !== 0).map(item => (
                        <div key={item.tempId} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px style dashed #ffa39e' }}>
                          <Text strong>SKU {item.sku || 'N/A'}:</Text> {item.descricao} <br />
                          <Text type="danger">NF: {item.quantidade} | Recebido: {item.receivedQuantity}</Text>
                        </div>
                      ))}
                    </div>
                  }
                  type="error"
                  showIcon
                />
              ) : items.length > 0 ? (
                <Alert
                  message="🎉 Conferência Perfeita!"
                  description="A contagem física bate exatamente com as quantidades discriminadas na NF-e."
                  type="success"
                  showIcon
                />
              ) : null}

              {/* Resumo Financeiro */}
              <Card 
                title={<Space><DollarOutlined style={{ color: '#52c41a' }} /><span>Resumo do Recebimento</span></Space>}
                bordered={false}
                style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic title="Itens Físicos" value={totalPhysicalItems} suffix="un" valueStyle={{ fontSize: 18 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Total da Nota" value={financials.totalNoteValue} precision={2} prefix="R$" valueStyle={{ fontSize: 18 }} />
                  </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />

                {/* Feedback das travas de conferência de Frete */}
                <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: 6, marginBottom: 16 }}>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>DISTRIBUIÇÃO DO FRETE</Text>
                  <Row justify="space-between">
                    <Text size="small">Soma Informada: <Text strong>R$ 0,00</Text></Text>
                    <Text size="small">Soma Distribuída: <Text strong>R$ 0,00</Text></Text>
                  </Row>
                </div>

                <Statistic 
                  title={<Text strong style={{ fontSize: 14 }}>Custo Ajustado Total (Com Impostos/Frete)</Text>} 
                  value={adjustedPhysicalSubtotal + financials.totalFreight + financials.totalIpi + financials.totalOtherExpenses} 
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: 24 }}
                />

                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<CheckCircleOutlined />}
                  style={{ marginTop: 20, height: 48, background: isSubmitDisabled ? undefined : '#52c41a', border: 'none' }}
                  disabled={isSubmitDisabled}
                  onClick={() => console.log('Processar Envio:', items)}
                >
                  {items.length === 0 ? 'Aguardando XML...' : 'Confirmar Entrada e Estoque'}
                </Button>
              </Card>

            </Space>
          </Col>
        </Row>
      </Spin>

      {/* 3. MODAIS CONTROLADOS */}
      {isMappingModalOpen && itemToMap && (
        <MappingModal
          item={itemToMap}
          supplierCnpj={financials.supplierCnpj}
          onClose={() => { setIsMappingModalOpen(false); setItemToMap(null); }}
          onMap={handleModalMapSuccess}
        />
      )}

      <SupplierModal
        isOpen={isSupplierModalOpen}
        loading={supplierCreationLoading}
        name={supplierCreationName}
        fantasyName={supplierCreationFantasyName}
        cnpj={supplierToCreate?.cnpj || ''}
        setName={setSupplierCreationName}
        setFantasyName={setSupplierCreationFantasyName}
        onCancel={handleCancelSupplierCreation}
        onSubmit={handleCreateSupplierSubmit}
      />
    </div>
  );
};

export default StockEntryForm;
import React, { useMemo, useState } from 'react';
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
  Statistic,
  Tooltip,
  Progress,
  Modal,
  Radio,
  message
} from 'antd';
import {
  UploadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  DeleteOutlined,
  PrinterOutlined,
  BarcodeOutlined,
  SendOutlined,
  CarOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import MappingModal from './ItemsConference/ProductMappingModal';
import NfeCards from './nfeCards/NfeCards';
import { ItemsConference } from './ItemsConference/ItemsConference';
import { SupplierModal } from './SupplierModal';
import PhysicalConferenceTable from './PhysicalConferenceTable';

// Importando o parser completo modularizado
import { parseNfeComplete, NfeDataFromXML } from './xml/utils/nfeParser';
import { reconcileFreight } from './freightReconciliation';
import { reconcileFinancial } from './financialReconciliation';

const { Title, Text } = Typography;

const StockEntryForm: React.FC = () => {
  // Estados locais
  const [rawXmlString, setRawXmlString] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [isProcessingItems, setIsProcessingItems] = useState<boolean>(false);

  // Estados de Modais
  
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [itemToMap, setItemToMap] = useState<any>(null);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState<boolean>(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [isTotalDetailsModalOpen, setIsTotalDetailsModalOpen] = useState<boolean>(false);

  // Estado para o Modal de Distribuição de Frete
  const [isFreightModalOpen, setIsFreightModalOpen] = useState<boolean>(false);
  const [freightDistributionMode, setFreightDistributionMode] = useState<string>('proportional_value');

  // Estados temporários para criação de fornecedor
  const [supplierCreationName, setSupplierCreationName] = useState<string>('');
  const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState<string>('');

  // 1. Processamento modular completo da NFe
  const parsedNfe = useMemo<NfeDataFromXML | null>(() => {
    if (!rawXmlString) return null;
    try {
      return parseNfeComplete(rawXmlString);
    } catch (error) {
      console.error("Erro ao parsear a NF-e do XML:", error);
      return null;
    }
  }, [rawXmlString]);

  // Valor total da NF-e extraído do XML
  const nfeTotalValue = useMemo(() => {
    return Number(parsedNfe?.totais?.icmsTot?.vNF || 0) || 0;
  }, [parsedNfe]);

  // Valor do Frete extraído do XML
  const nfeFreightValue = useMemo(() => {
    return Number(parsedNfe?.totais?.icmsTot?.vFrete || 0) || 0;
  }, [parsedNfe]);

  const freightReconciliation = useMemo(() => {
    return reconcileFreight(nfeFreightValue, items);
  }, [nfeFreightValue, items]);

  const financialReconciliation = useMemo(() => {
    const totals = parsedNfe?.totais?.icmsTot;
    return reconcileFinancial({
      produtos: totals?.vProd,
      frete: totals?.vFrete,
      seguro: totals?.vSeg,
      outrasDespesas: totals?.vOutro,
      desconto: totals?.vDesc,
      ipi: totals?.vIPI,
      icmsSt: totals?.vICMSST,
      total: totals?.vNF,
    }, items);
  }, [parsedNfe, items]);



  // Função para lidar com o upload do arquivo XML
  // Função para lidar com o upload do arquivo XML
  const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingItems(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawXmlString(content);
        try {
          const parsed = parseNfeComplete(content);
          if (parsed && parsed.produtos) {
            // Dentro de handleXmlUpload, ao mapear os itens do XML:


            const initialItems = parsed.produtos.map((item, index) => {
              const qtdXml = parseFloat(item.prod.qCom) || 0;
              const vlrUnit = parseFloat(item.prod.vUnCom) || 0;
              const vlrProd = parseFloat(item.prod.vProd) || (qtdXml * vlrUnit);

              // 1. Cálculo correto do valor base unitário (preço original do item sem acréscimos)
              const baseUnitCalculated = qtdXml > 0 ? vlrProd / qtdXml : vlrUnit;

              // 2. Captura de frete e despesas do item
              const freightItem = parseFloat(item.prod.vFrete || '0') || 0;
              const otherExpenses = parseFloat(item.prod.vOutro || '0') || 0;
              const insuranceItem = parseFloat(item.prod.vSeg || '0') || 0;

              // 3. Captura robusta de Impostos que somam no Total da Nota (IPI e ST)
              const ipiObj = item.imposto?.ipi?.IPITrib || item.imposto?.IPI?.ipitrib || item.imposto?.ipi || {};
              const vIpiItem = parseFloat(ipiObj.vIPI || ipiObj.VIPI || '0') || 0;

              const icmsObj = item.imposto?.icms || {};
              const vStItem = Number(icmsObj.vICMSST || icmsObj.vBCST || 0) || 0;

              const totalAcrescimosItem = freightItem + otherExpenses + insuranceItem + vIpiItem + vStItem;

              // Valor total real do item composto na NF-e
              const valorTotalRealItem = vlrProd + totalAcrescimosItem;

              // Custo unitário efetivo já rateando os acréscimos
              const effectiveUnitCost = qtdXml > 0 ? valorTotalRealItem / qtdXml : vlrUnit;

              const vIcmsItem = Number(icmsObj.vICMS || 0) || 0;

              const totalTaxes = vIcmsItem + vIpiItem + freightItem + otherExpenses;

              return {
                tempId: `item-${index + 1}`,
                nItem: item.nItem || String(index + 1),
                sku: item.prod.cProd,
                ean: item.prod.cEAN,
                descricao: item.prod.xProd,
                ncm: item.prod.NCM,
                unidade: item.prod.uCom,
                quantidade: qtdXml,
                receivedQuantity: qtdXml,
                valorUnitario: Number(effectiveUnitCost.toFixed(4)),
                valorBaseUnitario: Number(baseUnitCalculated.toFixed(4)), // 👈 Restaurado com fallback seguro para nunca zerar
                valorTotal: valorTotalRealItem,
                valorProdutos: vlrProd,
                freightOriginal: freightItem,
                freightDistributed: 0,
                freightAdded: freightItem,
                seguro: insuranceItem,
                outrasDespesas: otherExpenses,
                desconto: parseFloat(item.prod.vDesc || '0') || 0,
                ipi: vIpiItem,
                icmsSt: vStItem,
                prod: {
                  ...item.prod,
                  qCom: String(qtdXml),
                  vUnCom: String(vlrUnit),
                  vProd: String(vlrProd),
                },
                imposto: {
                  ...item.imposto,
                  totalTaxes: totalAcrescimosItem
                },
                difference: 0,
                isConfirmed: false,
              };
            });




            setItems(initialItems);
            if (parsed.emitente?.nome) {
              setSupplierCreationName(parsed.emitente.nome);
              setSupplierCreationFantasyName(parsed.emitente.nomeFantasia || '');
            }
          } else {
            setItems([]);
          }
        } catch (err) {
          console.error("Erro ao popular itens da NF-e:", err);
          setItems([]);
        }
      }
      setIsProcessingItems(false);
    };
    reader.readAsText(file);
  };

  const beforeUpload = (file: File) => {
    handleXmlUpload({ target: { files: [file] } });
    return false;
  };

  // Função para aplicar a distribuição de frete nos itens
  const handleApplyFreightDistribution = () => {
    const totalItens = items.reduce((total, item) => {
      const freteConsiderado = Number(item.freightAdded) || 0;
      return total + Math.max(0, (Number(item.valorTotal) || 0) - freteConsiderado);
    }, 0);
    if (totalItens <= 0) {
      message.error("Não há valor nos itens para ratear o frete.");
      return;
    }

    setItems(prevItems => prevItems.map(item => {
      const freteAtual = Number(item.freightAdded) || 0;
      const itemProdTotal = Math.max(0, (Number(item.valorTotal) || 0) - freteAtual);
      let freightPortion = 0;

      if (freightDistributionMode === 'proportional_value') {
        const proportion = itemProdTotal / totalItens;
        freightPortion = nfeFreightValue * proportion;
      } else if (freightDistributionMode === 'proportional_quantity') {
        const totalQty = prevItems.reduce((acc, i) => acc + (i.quantidade || 0), 0);
        const proportion = totalQty > 0 ? (item.quantidade || 0) / totalQty : 0;
        freightPortion = nfeFreightValue * proportion;
      } else if (freightDistributionMode === 'equal') {
        freightPortion = prevItems.length > 0 ? nfeFreightValue / prevItems.length : 0;
      }

      const quantidade = Number(item.quantidade) || 1;
      const novoValorTotal = itemProdTotal + freightPortion;
      const newUnitCost = novoValorTotal / quantidade;
      return {
        ...item,
        valorUnitario: Number(newUnitCost.toFixed(4)),
        valorTotal: Number(novoValorTotal.toFixed(2)),
        freightDistributed: Number(freightPortion.toFixed(2)),
        freightAdded: Number(freightPortion.toFixed(2)),
      };
    }));

    setIsFreightModalOpen(false);
    message.success("Frete distribuído com sucesso entre os custos unitários dos itens!");
  };

  // Manipuladores de Ações dos Itens
  const handleToggleItemConfirmation = (tempId: string) => {
    setItems(prev => prev.map(item =>
      item.tempId === tempId ? { ...item, isConfirmed: !item.isConfirmed } : item
    ));
  };

  const handleConfirmAllItems = () => {
    setItems(prev => prev.map(item => ({ ...item, isConfirmed: true })));
    message.success("Todos os itens foram marcados como conferidos.");
  };

  const handleUnconfirmAllItems = () => {
    setItems(prev => prev.map(item => ({ ...item, isConfirmed: false })));
  };

  const handleRemoveItem = (tempId: string) => {
    setItems(prev => prev.filter(item => item.tempId !== tempId));
    message.info("Item removido da conferência.");
  };

  const handleReceberTotalDoFilho = (valorCalculado: number) => {
    console.log("O valor recebido do filho é:", valorCalculado);
    // Faça o que precisar com o valor aqui (ex: salvar em um estado do pai)
  };

  const handleQuantityChange = (tempId: string, newReceivedQty: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId === tempId) {
        const diff = newReceivedQty - item.quantidade;
        return {
          ...item,
          receivedQuantity: newReceivedQty,
          difference: diff
        };
      }
      return item;
    }));
  };

  const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
  const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
  const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
  const progressPercent = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round((totalConfirmed / items.length) * 100);
  }, [items.length, totalConfirmed]);

  const isSubmitDisabled = items.length === 0 || totalConfirmed < items.length;

  const handlePrintDanfeHtml = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Permita pop-ups no navegador para gerar a impressão.');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFE Simplificado - NF-e ${parsedNfe?.chaveAcesso || ''}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 10px; background: #fff; }
.container { width: 100%; max-width: 800px; margin: 0 auto; border: 1px solid #000; padding: 8px; }
.flex { display: flex; justify-content: space-between; }
.box { border: 1px solid #000; padding: 5px; margin-bottom: 6px; }
.text-right { text-align: right; }
.bold { font-weight: bold; }
</style>
</head>
<body>
<div class="container">
<div class="box">
<div class="flex">
<div>
<span class="bold" style="font-size: 14px;">${parsedNfe?.emitente.nome || 'Emitente não informado'}</span><br>
<span>CNPJ: ${parsedNfe?.emitente.cnpj || '-'} | Fantasia: ${parsedNfe?.emitente.nomeFantasia || '-'}</span><br>
<span>NF-e Nº: ${parsedNfe?.numero || '-'} | Emissão: ${parsedNfe?.dataEmissao || '-'}</span>
</div>
<div class="text-right">
<span class="bold" style="font-size: 13px;">DANFE SIMPLIFICADO</span><br>
<span>Entrada de Mercadorias</span><br>
<span style="font-size: 9px;">Chave: ${parsedNfe?.chaveAcesso || '-'}</span>
</div>
</div>
</div>
</div>
</body>
</html>
`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div style={{ padding: '12px', background: '#f5f5f5', minHeight: '100vh' }}>

      {/* 1. CABEÇALHO DA PÁGINA */}
      <Card style={{ marginBottom: 12, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: '12px 24px' }} bordered={false}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} xl={6}>
            <Space align="center" size="small" wrap>
              <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                📥 Entrada de Mercadorias
              </Title>
              {parsedNfe?.chaveAcesso ? (
                <Badge status="processing" text={<Text strong style={{ color: '#1890ff', fontSize: 12 }}>Ativa</Text>} />
              ) : (
                <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>Aguardando</Text>} />
              )}
            </Space>
          </Col>

          <Col xs={24} xl={8}>
            {items.length > 0 ? (
              <Space size="large" align="center" wrap style={{ width: '100%', justifyContent: 'center' }}>
                <Space size="small">
                  <Badge count={items.length} style={{ backgroundColor: '#faad14' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Pendentes</Text>
                </Space>
                <Space size="small">
                  <Badge count={totalConfirmed} style={{ backgroundColor: '#52c41a' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Conferidos</Text>
                </Space>
                <Space size="small">
                  <Badge count={totalDivergences} style={{ backgroundColor: '#ff4d4f' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Divergências</Text>
                </Space>
                <div style={{ width: 120, display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: -2 }}>
                    <Text type="secondary" style={{ fontSize: 9 }}>Progresso</Text>
                    <Text strong style={{ fontSize: 9, color: progressPercent === 100 ? '#52c41a' : '#1890ff' }}>{progressPercent}%</Text>
                  </div>
                  <Progress percent={progressPercent} showInfo={false} strokeColor={progressPercent === 100 ? '#52c41a' : '#1890ff'} size="small" />
                </div>
              </Space>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Importe um XML de NF-e para iniciar a conferência automática.</Text>
              </div>
            )}
          </Col>

          <Col xs={24} xl={10} style={{ textAlign: 'right' }}>
            <Space size="small" wrap style={{ justifyContent: 'flex-end' }}>
              <Tooltip title="Escanear produto via código de barras">
                <Button icon={<BarcodeOutlined />} size="middle" disabled={!parsedNfe?.chaveAcesso}>
                  Escanear
                </Button>
              </Tooltip>
              <Tooltip title="Enviar DANFE e XML">
                <Button icon={<SendOutlined />} size="middle" disabled={!parsedNfe?.chaveAcesso}>
                  Contabilidade
                </Button>
              </Tooltip>
              <Tooltip title="Imprimir DANFE Simplificado">
                <Button icon={<PrinterOutlined />} size="large" onClick={handlePrintDanfeHtml} disabled={!parsedNfe?.chaveAcesso}>
                  Imprimir DANFE
                </Button>
              </Tooltip>
              {parsedNfe?.chaveAcesso && (
                <Tooltip title="Descartar nota atual">
                  <Button danger icon={<DeleteOutlined />} size="middle" onClick={() => window.location.reload()}>
                    Limpar
                  </Button>
                </Tooltip>
              )}
              <Upload beforeUpload={beforeUpload} accept=".xml" showUploadList={false}>
                <Button type={parsedNfe?.chaveAcesso ? 'default' : 'primary'} icon={parsedNfe?.chaveAcesso ? <SyncOutlined /> : <UploadOutlined />}>
                  {parsedNfe?.chaveAcesso ? 'Trocar XML' : 'Importar XML'}
                </Button>
              </Upload>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 2. LAYOUT DO WORKSPACE */}
      <Spin spinning={isProcessingItems} tip="Analisando e vinculando itens com o banco...">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={19}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {parsedNfe?.chaveAcesso && (
                <NfeCards
                  data={parsedNfe}
                  supplierStatus={{ exists: true, isChecking: false }}
                  actions={{ onCreateSupplier: () => setIsSupplierModalOpen(true) }}
                />
              )}

              {items.length > 0 && (
                <Card bordered={false} style={{ borderRadius: 8 }}>
                  <ItemsConference
                    items={items.map((i, index) => ({ ...i, nItem: i.nItem || index + 1, confirmed: i.isConfirmed, isConfirmed: i.isConfirmed }))}
                    onConfirmItems={handleConfirmAllItems}
                    onUnconfirmItems={handleUnconfirmAllItems}
                    onMapProducts={(item) => { setItemToMap(item); setIsMappingModalOpen(true); }}
                    onRemoveItems={handleRemoveItem}
                    onToggleItem={(tempId) => handleToggleItemConfirmation(tempId)}
                    onQuantityChange={(tempId, qty) => handleQuantityChange(tempId, qty)}
                    onAssignGroupToItems={() => { }}
                    onUnassignGroup={() => { }}
                    onUnassignItem={() => { }}
                  />
                </Card>
              )}
            </Space>
          </Col>

          {/* COLUNA DIREITA */}
          <Col xs={24} lg={5}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>

            {/* Alerta 1: Validação Fiscal e Jurídica (Sefaz) */}
             {parsedNfe ? (
               parsedNfe.status === 'AUTORIZADA' || parsedNfe?.protNFe?.infProt?.cStat === '100' ? (
                 <Alert
                   type="success"
                   showIcon
                   message="NF-e Autorizada na Sefaz"
                   description={`Nota Válida. Emitente: ${parsedNfe?.emit?.xNome || 'Fornecedor'} (${parsedNfe?.emit?.CNPJ || ''})`}
                 />
               ) : (
                 <Alert
                   type="error"
                   showIcon
                   message="⚠️ Alerta Fiscal / Sefaz"
                   description="A NF-e não consta como autorizada, foi cancelada ou possui irregularidades na Sefaz."
                 />
               )
             ) : (
               <Alert
                 type="info"
                 showIcon
                 message="Aguardando XML para Validação Sefaz"
                 description="Importe o XML para verificar o status na Secretaria da Fazenda."
               />
             )}

            
             {/* Alerta 1: Validação Financeira */}
             {items.length > 0 || nfeTotalValue > 0 ? (
               <Alert
                 type={financialReconciliation.matches ? "success" : "error"}
                 showIcon
                 message={financialReconciliation.matches ? "Valores Financeiros Correspondem" : "Divergência Financeira Detectada"}
                 description={
                   <div style={{ fontSize: '12px' }}>
                     <div>Produtos: NF R$ {financialReconciliation.note.produtos.toFixed(2)} | Itens R$ {financialReconciliation.items.produtos.toFixed(2)}</div>
                     <div>Frete: NF R$ {financialReconciliation.note.frete.toFixed(2)} | Itens R$ {financialReconciliation.items.frete.toFixed(2)}</div>
                     <div>IPI: NF R$ {financialReconciliation.note.ipi.toFixed(2)} | Itens R$ {financialReconciliation.items.ipi.toFixed(2)}</div>
                     <div>ICMS-ST: NF R$ {financialReconciliation.note.icmsSt.toFixed(2)} | Itens R$ {financialReconciliation.items.icmsSt.toFixed(2)}</div>
                     <div>Total: NF R$ {financialReconciliation.note.total.toFixed(2)} | Itens R$ {financialReconciliation.items.total.toFixed(2)}</div>
                     <strong>Diferença total: R$ {financialReconciliation.totalDifference.toFixed(2)}</strong>
                   </div>
                 }
               />
             ) : (
               <Alert
                 type="info"
                 showIcon
                 message="Aguardando XML"
                 description="Importe um XML para validar os valores financeiros."
               />
             )}

             {/* Alerta 3: Distribuição de Frete */}
             {(nfeFreightValue > 0 || freightReconciliation.itemsTotal > 0) ? (
               <Alert
                 type={freightReconciliation.matches ? "success" : "error"}
                 showIcon
                 message={freightReconciliation.matches ? "Frete conciliado" : "Divergência de frete"}
                 description={
                   <div>
                     <div>Frete da NF-e: <strong>R$ {freightReconciliation.noteTotal.toFixed(2)}</strong></div>
                     <div>Frete considerado nos itens: <strong>R$ {freightReconciliation.itemsTotal.toFixed(2)}</strong></div>
                     <div>Diferença: <strong>R$ {freightReconciliation.difference.toFixed(2)}</strong></div>

                     {!freightReconciliation.matches && (
                       <Button size="small" type="primary" ghost icon={<CarOutlined />} onClick={() => setIsFreightModalOpen(true)} style={{ marginTop: 6 }}>
                         Configurar Rateio
                       </Button>
                     )}
                   </div>
                 }
               />
             ) : null}

             {/* Alerta 4: Validade e Lotes (Inspeção Qualitativa) */}
             {items.length > 0 && items.some(i => i.hasExpirationIssue || i.isExpired) ? (
               <Alert
                 message={<Text strong style={{ color: '#d46b08' }}>⚠️ Alerta de Validade / Lotes</Text>}
                 description={
                   <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 8 }}>
                     {items.filter(i => i.hasExpirationIssue || i.isExpired).map(item => (
                       <div key={item.tempId} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #ffd591' }}>
                         <Text strong>SKU {item.sku || 'N/A'}:</Text> {item.descricao} <br />
                         <Text type="warning">Lote: {item.lote || 'Não informado'} | Validade: {item.validade || 'N/A'}</Text>
                       </div>
                     ))}
                   </div>
                 }
                 type="warning"
                 showIcon
               />
             ) : null}

             {/* Alerta 5: Divergência de Quantidade Física */}
             {totalDivergences > 0 ? (
               <Alert
                 message={<Text strong style={{ color: '#a8071a' }}>🚨 Divergências Físicas ({totalDivergences})</Text>}
                 description={
                   <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 8 }}>
                     {items.filter(i => i.difference !== 0).map(item => (
                       <div key={item.tempId} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #ffa39e' }}>
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
               <Alert message="🎉 Conferência Física Perfeita!" description="A contagem física bate com a NF-e." type="success" showIcon />
             ) : null}

              {/* Card de Resumo do Recebimento */}
              <Card
                title={
                  <Space>
                    <DollarOutlined style={{ color: '#52c41a' }} />
                    <span>Resumo do Recebimento</span>
                  </Space>
                }
                extra={
                  parsedNfe?.totais?.icmsTot && (
                    <Button type="link" size="small" onClick={() => setIsTotalDetailsModalOpen(true)} style={{ padding: 0 }}>
                      Detalhes
                    </Button>
                  )
                }
                bordered={false}
                style={{ borderRadius: 8 }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic title="Itens Físicos" value={totalPhysicalItems} suffix="un" valueStyle={{ fontSize: 16 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Total da Nota"
                      value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
                      precision={2}
                      prefix="R$"
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </Row>

                {parsedNfe?.totais?.icmsTot && (
                  <div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 6, marginTop: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                      <span>Produtos:</span>
                      <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vProd || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {parseFloat(parsedNfe.totais.icmsTot.vFrete || '0') > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                        <span>(+) Frete:</span>
                        <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                      <span>(+) Seguro:</span>
                      <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vSeg || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>


                    {parseFloat(parsedNfe.totais.icmsTot.vSeg || '0') > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                        <span>(+) Seguro:</span>
                        <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {parseFloat(parsedNfe.totais.icmsTot.vOutro || '0') > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                        <span>(+) Outros:</span>
                        <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

                      </div>
                    )}

                    {parseFloat(parsedNfe.totais.icmsTot.vIPI || '0') > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                        <span>(+) IPI:</span>
                        <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vIPI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

                      </div>
                    )}

                    {parseFloat(parsedNfe.totais.icmsTot.vST || '0') > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
                        <span>(+) ICMS ST:</span>
                        <span>R$ {parseFloat(parsedNfe.totais.icmsTot.vICMSST).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

                      </div>
                    )}

                    <div>
                        <span>(=) Total:</span>
                        
                      {(() => {
  const icmsTot = parsedNfe?.totais?.icmsTot;
  
  // Converte cada string para número, usando 0 como padrão se estiver vazia
  const vProd = parseFloat(icmsTot?.vProd || '0') || 0;

  const vICMSST = parseFloat(icmsTot?.vICMSST || icmsTot?.vST || '0') || 0;
  const vIPI = parseFloat(icmsTot?.vIPI || '0') || 0;
  const vFrete = parseFloat(icmsTot?.vFrete || '0') || 0;
  const vSeg = parseFloat(icmsTot?.vSeg || '0') || 0;
  const vOutro = parseFloat(icmsTot?.vOutro || '0') || 0;

  // Soma matemática correta
  const total = vProd + vICMSST + vIPI + vFrete + vSeg + vOutro;

  return (
    <span>
      R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
})()}



                      </div>



                  </div>


                )}

                <Divider style={{ margin: '14px 0' }} />

                <Statistic
                  title={<Text strong style={{ fontSize: 13 }}>Custo Ajustado Total</Text>}
                  value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
                  value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: 22 }}
                />

                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<CheckCircleOutlined />}
                  style={{ marginTop: 16, height: 46, background: isSubmitDisabled ? undefined : '#52c41a', border: 'none' }}
                  disabled={isSubmitDisabled}
                  onClick={() => setIsConferenceModalOpen(true)}
                >
                  {items.length === 0 ? 'Aguardando XML...' : 'Confirmar Entrada e Estoque'}
                </Button>
              </Card>
            </Space>
          </Col>
        </Row>
      </Spin>

      {/* 3. MODAIS */}
      {isMappingModalOpen && itemToMap && (
        <MappingModal
          item={itemToMap}
          supplierCnpj={parsedNfe?.emitente.cnpj || ''}
          onClose={() => { setIsMappingModalOpen(false); setItemToMap(null); }}
          onMap={() => { }}
        />
      )}

      {/* Modal de Configuração de Frete Aprimorado */}
      <Modal
        title="🚚 Configurar Distribuição de Frete"
        open={isFreightModalOpen}
        onCancel={() => setIsFreightModalOpen(false)}
        onOk={handleApplyFreightDistribution}
        okText="Aplicar Rateio no Custo"
        cancelText="Cancelar"
        width={540}
      >
        <p style={{ marginBottom: 8 }}>
          Valor total do frete informado na NF-e: <strong>R$ {nfeFreightValue.toFixed(2)}</strong>
        </p>
        <p style={{ color: '#595959', fontSize: 13, marginBottom: 16 }}>
          Escolha abaixo o critério de rateio para incorporar o frete proporcionalmente aos custos unitários dos produtos:
        </p>

        <Radio.Group
          onChange={(e) => setFreightDistributionMode(e.target.value)}
          value={freightDistributionMode}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Radio value="proportional_value" style={{ flex: 1 }}>
              <Text strong>Proporcional ao Valor do Item</Text>
            </Radio>
            <Tooltip title="Itens de maior valor financeiro recebem uma fatia proporcionalmente maior do frete. É o método padrão e mais recomendado para contabilidade.">
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
            </Tooltip>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Radio value="proportional_quantity" style={{ flex: 1 }}>
              <Text strong>Proporcional à Quantidade</Text>
            </Radio>
            <Tooltip title="O frete é rateado com base no volume físico (unidades). Ideal quando os produtos têm pesos ou quantidades muito discrepantes, mas custos unitários parecidos.">
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
            </Tooltip>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Radio value="equal" style={{ flex: 1 }}>
              <Text strong>Dividido Igualmente</Text>
            </Radio>
            <Tooltip title="O valor total do frete é dividido pelo número total de linhas de itens na nota de forma linear, independentemente de preços ou quantidades.">
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
            </Tooltip>
          </div>
        </Radio.Group>
      </Modal>

      <Modal
        title="Conferência Física de Quantidades"
        open={isConferenceModalOpen}
        onCancel={() => setIsConferenceModalOpen(false)}
        width={1280}
        footer={[
          <Button key="back" onClick={() => setIsConferenceModalOpen(false)}>Continuar depois</Button>,
          <Button key="submit" type="primary" style={{ background: '#52c41a' }} onClick={() => setIsConferenceModalOpen(false)}>
            Finalizar e Dar Entrada no Estoque
          </Button>
        ]}
        destroyOnClose
      >
        <PhysicalConferenceTable
          items={items}
          onConfirmItems={handleConfirmAllItems}
          onUnconfirmItems={handleUnconfirmAllItems}
          onQuantityChange={handleQuantityChange}
        />
      </Modal>

      <Modal
        title="📊 Detalhamento Completo de Totais e Tributos da NF-e"
        open={isTotalDetailsModalOpen}
        onCancel={() => setIsTotalDetailsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsTotalDetailsModalOpen(false)}>
            Fechar
          </Button>
        ]}
        width={700}
        destroyOnClose
      >
        {parsedNfe?.totais?.icmsTot ? (
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card size="small" title="Valores Comerciais">
                <p><strong>Valor dos Produtos (vProd):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vProd || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Frete (vFrete):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Desconto (vDesc):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vDesc || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p style={{ marginTop: 12 }}><strong style={{ fontSize: 14, color: '#1890ff' }}>Valor Total da Nota (vNF): R$ {parseFloat(parsedNfe.totais.icmsTot.vNF || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="Tributos e Impostos">
                <p><strong>Base de Cálculo ICMS (vBC):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vBC || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Valor do ICMS (vICMS):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vICMS || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Valor IPI (vIPI):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vIPI || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </Card>
            </Col>
          </Row>
        ) : (
          <Text type="secondary">Nenhum dado de totais disponível na nota atual.</Text>
        )}
      </Modal>

      <SupplierModal
        isOpen={isSupplierModalOpen}
        loading={false}
        name={supplierCreationName}
        fantasyNameXml={parsedNfe?.emitente.nomeFantasia || ''}
        cnpj={parsedNfe?.emitente.cnpj || ''}
        stateRegistration={parsedNfe?.emitente.ie}
        address={`${parsedNfe?.emitente.logradouro}, ${parsedNfe?.emitente.numeroEnd}`}
        cityStateZip={`${parsedNfe?.emitente.municipio} - ${parsedNfe?.emitente.uf}`}
        phone={parsedNfe?.emitente.fone}
        fantasyName={supplierCreationFantasyName}
        setFantasyName={setSupplierCreationFantasyName}
        onCancel={() => setIsSupplierModalOpen(false)}
        onSubmit={() => setIsSupplierModalOpen(false)}
      />
    </div>
  );
};

export default StockEntryForm;
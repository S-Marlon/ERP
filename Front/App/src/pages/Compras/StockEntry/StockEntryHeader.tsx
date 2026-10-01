// StockEntryHeader.tsx
import React, { useState } from 'react';
import { Typography, Button, Badge, Upload, Row, Col, Card, Space, Tooltip, Progress, Tag, Modal, Descriptions, Divider, Select } from 'antd';
import {
    UploadOutlined,
    SyncOutlined,
    PrinterOutlined,
    BarcodeOutlined,
    SendOutlined,
    DeleteOutlined,
    CloudServerOutlined,
    InfoCircleOutlined,
    ExclamationCircleOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface StockEntryHeaderProps {
    parsedNfe: any;
    itemsLength: number;
    totalConfirmed: number;
    totalDivergences: number;
    progressPercent: number;
    loteId: number | null; 
    loteStatus?: string;      
    stagingError?: string | null; 
    beforeUpload: (file: File) => boolean;
    handlePrintDanfeHtml: () => void;
    onReset: () => void;
}

export const StockEntryHeader: React.FC<StockEntryHeaderProps> = ({
    parsedNfe,
    itemsLength,
    totalConfirmed,
    totalDivergences,
    progressPercent,
    loteId,
    loteStatus = 'RASCUNHO',
    stagingError,
    beforeUpload,
    handlePrintDanfeHtml,
    onReset
}) => {
    const [isStagingModalOpen, setIsStagingModalOpen] = useState(false);

    return (
        <>
            <Card style={{ marginBottom: 6, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: '12px 24px' }} bordered={false}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} xl={7}>
                        <Space align="center" size="small" wrap>
                            <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                                📥 Entrada de Mercadorias
                            </Title>
                            {parsedNfe?.chaveAcesso ? (
                                <Space size={6} wrap>
                                    
                                    {stagingError ? (
                                        <Tooltip title="Clique para ver o motivo da falha ao salvar o rascunho">
                                            <Tag 
                                                icon={<ExclamationCircleOutlined />} 
                                                color="error" 
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                                                onClick={() => setIsStagingModalOpen(true)}
                                            >
                                                Erro no Staging <InfoCircleOutlined style={{ fontSize: 12, marginLeft: 2 }} />
                                            </Tag>
                                        </Tooltip>
                                    ) : loteId ? (
                                        <Tooltip title="Clique para ver detalhes do rascunho salvo em Staging">
                                            <Tag 
                                                icon={<CloudServerOutlined />} 
                                                color="success" 
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                                                onClick={() => setIsStagingModalOpen(true)}
                                            >
                                                RASCUNHO - Staging #{loteId} <InfoCircleOutlined style={{ fontSize: 12, marginLeft: 2 }} />
                                            </Tag>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Clique para ver o status do processamento do rascunho">
                                            <Tag 
                                                icon={<SyncOutlined spin />} 
                                                color="processing" 
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                                                onClick={() => setIsStagingModalOpen(true)}
                                            >
                                                Salvando Staging... <InfoCircleOutlined style={{ fontSize: 12, marginLeft: 2 }} />
                                            </Tag>
                                        </Tooltip>
                                    )}
                                </Space>
                            ) : (
                                <Tag 
                                                icon={<ClockCircleOutlined />} 
                                                color="secondary" 
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                                                onClick={() => setIsStagingModalOpen(true)}
                                            >
                                                AGUARDANDO 
                                            </Tag>
                            )}
                        </Space>
                    </Col>

                    {/* <Col xs={24} xl={7}>
                        {itemsLength > 0 ? (
                            <Space size="large" align="center" wrap style={{ width: '100%', justifyContent: 'center' }}>
                                <Space size="small">
                                    <Badge count={itemsLength} style={{ backgroundColor: '#faad14' }} />
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
                    </Col> */}

                    <Col xs={24} xl={10} style={{ textAlign: 'right' }}>
                        <Space size="small" wrap style={{ justifyContent: 'flex-end' }}>
                            <Tooltip title="Escanear produto via código de barras">
                                <Button icon={<BarcodeOutlined />} size="middle" disabled={!parsedNfe?.chaveAcesso}>
                                    Escanear
                                </Button>
                            </Tooltip>
                            
                            <Tooltip title="Enviar dados para outros módulos">
                                <Button icon={<SendOutlined/>}>
                                Enviar
                                </Button>
                            </Tooltip>

                            <Tooltip title="Imprimir DANFE Simplificado">
                                <Button icon={<PrinterOutlined />} size="middle" onClick={handlePrintDanfeHtml} disabled={!parsedNfe?.chaveAcesso}>
                                    Imprimir DANFE
                                </Button>
                            </Tooltip>

                            {parsedNfe?.chaveAcesso && (
                                <Tooltip title="Descartar nota atual e limpar rascunho">
                                    <Button danger icon={<DeleteOutlined />} size="middle" onClick={onReset}>
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

            {/* MODAL DE INFORMAÇÕES / ERRO DO STAGING */}
            <Modal
                title={
                    <Space>
                        {stagingError ? (
                            <>
                                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                                <span style={{ color: '#ff4d4f' }}>Falha no Rascunho de Staging</span>
                            </>
                        ) : (
                            <>
                                <CloudServerOutlined style={{ color: '#52c41a' }} />
                                <span>Detalhes do Rascunho em Staging (Lote #{loteId})</span>
                            </>
                        )}
                    </Space>
                }
                open={isStagingModalOpen}
                onOk={() => setIsStagingModalOpen(false)}
                onCancel={() => setIsStagingModalOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setIsStagingModalOpen(false)}>
                        Fechar
                    </Button>
                ]}
                width={650}
            >
                <Divider style={{ margin: '12px 0' }} />
                
                {stagingError ? (
                    <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', padding: 16, borderRadius: 6 }}>
                        <Text type="danger" strong style={{ fontSize: 14 }}>Ocorreu um erro ao persistir os dados no banco de dados:</Text>
                        <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#cf1322', fontFamily: 'monospace' }}>
                            {stagingError}
                        </p>
                        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#666' }}>
                            As alterações locais da tela continuam funcionando, mas o rascunho não foi salvo na tabela de staging do backend. Verifique sua conexão ou se a API está rodando corretamente.
                        </p>
                    </div>
                ) : (
                    <>
                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="Status Atual">
                                <Tag color={loteStatus === 'RASCUNHO' ? 'warning' : 'processing'}>
                                    {loteStatus} / Staging Ativo
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="ID do Lote (Banco de Dados)">{loteId || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Chave de Acesso da NF-e">
                                <Text copyable style={{ fontSize: 12 }}>{parsedNfe?.chaveAcesso || '-'}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Fornecedor">{parsedNfe?.emitente?.nome || parsedNfe?.emitente?.xNome || '-'}</Descriptions.Item>
                            <Descriptions.Item label="CNPJ do Emitente">{parsedNfe?.emitente?.cnpj || parsedNfe?.emitente?.CNPJ || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Total de Itens Vinculados">{itemsLength} itens</Descriptions.Item>
                        </Descriptions>
                        
                        <div style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f', padding: 12, borderRadius: 6 }}>
                            <Text type="success" strong>O que é esta área de Staging?</Text>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#389e0d' }}>
                                Os dados desta nota fiscal foram salvos temporariamente na tabela de staging do banco de dados. 
                                Isso permite que você feche a tela, edite quantidades físicas, faça o mapeamento de produtos e realize a conferência sem perder o progresso antes da efetiva entrada no estoque oficial.
                            </p>
                        </div>
                    </>
                )}
            </Modal>
        </>
    );
};
import React from 'react';
import { Modal, Form, Input, Button, Typography, Row, Col, Divider, Collapse } from 'antd';

const { Text } = Typography;

interface SupplierModalProps {
    isOpen: boolean;
    loading: boolean;
    // Dados principais vindos do XML
    name: string;           // xNome (LUBEFER IND. E COM. LTDA)
    fantasyNameXml: string; // xFant (LUBEFER)
    cnpj: string;           // CNPJ (56941685000125)
    
    // Dados secundários do XML (já formatados pelo backend)
    stateRegistration?: string; // IE (382153402119)
    address?: string;           // Montado: RODOVIA DOM PEDRO I - LOTE GLEBA 06, 103 - PONTE NOVA
    cityStateZip?: string;      // Montado: ITATIBA - SP, 13252320
    phone?: string;             // fone (1148947474)

    // Dados editáveis (Configuração do Sistema)
    fantasyName: string;
    setFantasyName: (val: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
    isOpen, 
    loading, 
    name, 
    fantasyNameXml,
    cnpj, 
    stateRegistration,
    address, 
    cityStateZip,
    phone,
    fantasyName, 
    setFantasyName, 
    onCancel, 
    onSubmit
}) => {
    // Itens do Collapse para os dados secundários extraídos do XML
    const secondaryDataItems = [
        {
            key: '1',
            label: 'Ver mais detalhes cadastrais do XML (Endereço, IE, Contato)',
            children: (
                <Form layout="vertical">
                    {stateRegistration && (
                        <Form.Item label="Inscrição Estadual (IE)">
                            <Input value={stateRegistration} disabled />
                        </Form.Item>
                    )}
                    {address && (
                        <Form.Item label="Endereço">
                            <Input value={address} disabled />
                        </Form.Item>
                    )}
                    {cityStateZip && (
                        <Form.Item label="Município / UF / CEP">
                            <Input value={cityStateZip} disabled />
                        </Form.Item>
                    )}
                    {phone && (
                        <Form.Item label="Telefone">
                            <Input value={phone} disabled />
                        </Form.Item>
                    )}
                </Form>
            ),
        },
    ];

    return (
        <Modal
            title="Cadastrar Novo Fornecedor"
            open={isOpen}
            onCancel={onCancel}
            width={800}
            footer={[
                <Button key="cancel" onClick={onCancel} disabled={loading}>Cancelar</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={onSubmit}>Salvar Fornecedor</Button>,
            ]}
            destroyOnClose
        >
            <div style={{ marginBottom: 20 }}>
                <Text type="secondary">
                    Parceiro não encontrado. Confirme os dados principais abaixo e defina o nome de exibição para o sistema.
                </Text>
            </div>

            <Row gutter={24}>
                {/* Coluna da Esquerda: Dados Oficiais Essenciais (ReadOnly) */}
                <Col span={12}>
                    <Divider orientation="left" plain>Dados Principais (XML)</Divider>
                    <Form layout="vertical">
                        <Form.Item label="Razão Social (xNome)">
                            <Input value={name} disabled />
                        </Form.Item>
                        <Form.Item label="Nome Fantasia Original (xFant)">
                            <Input value={fantasyNameXml || 'Não informado'} disabled />
                        </Form.Item>
                        <Form.Item label="CNPJ">
                            <Input value={cnpj} disabled />
                        </Form.Item>
                    </Form>

                    {/* Bloco expansível para os dados secundários do XML */}
                    <div style={{ marginTop: 8 }}>
                        <Collapse ghost items={secondaryDataItems} />
                    </div>
                </Col>

                {/* Coluna da Direita: Configuração (Editável) */}
                <Col span={12}>
                    <Divider orientation="left" plain>Configuração do Sistema</Divider>
                    <Form layout="vertical">
                        <Form.Item 
                            label="Apelido / Nome de Exibição" 
                            help="Como você quer identificar este fornecedor no dia a dia?"
                        >
                            <Input 
                                placeholder={fantasyNameXml || "Ex: Fornecedor ABC"} 
                                value={fantasyName} 
                                onChange={(e) => setFantasyName(e.target.value)} 
                                autoFocus
                            />
                        </Form.Item>
                        <div style={{ marginTop: 30, padding: 12, background: '#f9f9f9', borderRadius: 6 }}>
                            <Text strong>Nota:</Text>
                            <Text type="secondary" style={{ display: 'block', marginTop: 5 }}>
                                Os dados à esquerda vieram diretamente das tags oficiais da NF-e (Receita Federal) e estão travados para garantir a integridade fiscal.
                            </Text>
                        </div>
                    </Form>
                </Col>
            </Row>
        </Modal>
    );
};
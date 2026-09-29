    import React, { useState } from 'react';
    import { Table, Tag, Tooltip, Select, Button } from 'antd';
    import { LockOutlined, SafetyCertificateOutlined, PlusOutlined, DeploymentUnitOutlined, XOutlined, FileExcelOutlined } from '@ant-design/icons';
    import { ModalAtributoDna } from './ModalAtributoDna';

    interface AtributoDnaRow {
    id: string;
    nome: string;
    codigoInterno: string; // Identificador técnico (slug), não o sufixo de unidade
    tipoDado: string;
    heranca: boolean;
    dominio: string;
    }

    const dadosIniciaisDna: AtributoDnaRow[] = [
    { id: '1', nome: 'Material Base / Construtivo', codigoInterno: 'mat_base', tipoDado: 'Lista (Whitelist)', heranca: true, dominio: 'Aço Inox, Aço Galvanizado' },
    { id: '2', nome: 'Norma Técnica / Construtiva', codigoInterno: 'norma_tec', tipoDado: 'Texto (Máscara)', heranca: true, dominio: 'Padrão SAE / DIN' },
    ];

    const atributosGlobaisMock = [
    { id: '10', nome: 'Classe de Pressão Nominal', codigoInterno: 'pressao_nom' },
    { id: '11', nome: 'Acabamento Superficial', codigoInterno: 'acabamento' },
    { id: '12', nome: 'Código de Homologação ANP', codigoInterno: 'homologacao_anp' },
    ];

    export const TabelaDnaProduto: React.FC<{
    onMudarEscopo?: (id: string, escopo: string) => void;
    onAdicionarDna?: (novoAtributo: any) => void;
    }> = ({ onMudarEscopo, onAdicionarDna }) => {
    
    const [dataSource, setDataSource] = useState<AtributoDnaRow[]>(dadosIniciaisDna);
    const [modalVisible, setModalVisible] = useState<boolean>(false);

    const handleSalvarOuVincular = (novoItem: any) => {
        const formatado: AtributoDnaRow = {
        id: String(Date.now()),
        nome: novoItem.nome,
        codigoInterno: novoItem.sufixo || 'attr_dna',
        tipoDado: novoItem.tipoDado === 'lista' ? 'Lista (Whitelist)' : 'Texto / Outros',
        heranca: true,
        dominio: novoItem.dominioValores || 'Global',
        };

        setDataSource(prev => [...prev, formatado]);

        if (onAdicionarDna) {
        onAdicionarDna(novoItem);
        }
    };

    const colunas = [
        {
        title: 'Ações',
        key: 'acoes',
        width: 80,
        align: 'center' as const,
        render: () => (
            <div>

            <Tooltip title="Atributo de DNA Estrutural (Imutável pela raiz)">
            <LockOutlined style={{ color: '#0e7490', fontSize: '16px' }} />
            </Tooltip>
            <Tooltip title="Excluir (Imutável pela raiz)">
            <FileExcelOutlined style={{color: 'red'}}/>
            </Tooltip>

            </div>
        ),
        },
        {
        title: 'Atributo de DNA',
        dataIndex: 'nome',
        key: 'nome',
        render: (texto: string, record: AtributoDnaRow) => (
            <div>
            <span style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>{texto}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Domínio / Regra: {record.dominio}</span>
            </div>
        ),
        },
        {
        title: 'Chave / Slug Interno',
        dataIndex: 'codigoInterno',
        key: 'codigoInterno',
        render: (key: string) => (
            <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#334155' }}>
            {key}
            </code>
        ),
        },
        {
        title: 'Tipo de Dado',
        dataIndex: 'tipoDado',
        key: 'tipoDado',
        render: (tipo: string) => (
            <Tag color="cyan" style={{ fontWeight: 500 }}>{tipo}</Tag>
        ),
        },
        {
        title: 'Herança',
        dataIndex: 'heranca',
        key: 'heranca',
        render: (_, record) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag icon={<SafetyCertificateOutlined />} color="success" style={{ margin: 0 }}>
                DNA Rígido
            </Tag>
            
            </div>
        ),
        },
    ];

    return (
        <>
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cffafe', overflow: 'hidden' }}>
            <div style={{ background: '#ecfeff', padding: '12px 16px', borderBottom: '1px solid #cffafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', background: '#0891B2', color: 'white' , padding: '2px 6px', borderRadius: '6px' }}><DeploymentUnitOutlined /></span>
                <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#0e7490', fontWeight: 700 }}>DNA DO PRODUTO (OBRIGATÓRIO)</h4>
                <span style={{ fontSize: '11px', color: '#155e75' }}>Atributos de engenharia macro herdados e imutáveis para padronização de SKUs.</span>
                </div>
            </div>
            
            <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />} 
                onClick={() => setModalVisible(true)}
                style={{ background: '#0e7490', borderColor: '#0e7490' }}
            >
                Adicionar / Vincular DNA
            </Button>
            </div>
            
            <Table 
            dataSource={dataSource} 
            columns={colunas} 
            pagination={false} 
            rowKey="id"
            size="small"
            />
        </div>

        <ModalAtributoDna
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onSalvarVinculoOuCriar={handleSalvarOuVincular}
            atributosGlobaisDisponiveis={atributosGlobaisMock}
        />
        </>
    );
    };
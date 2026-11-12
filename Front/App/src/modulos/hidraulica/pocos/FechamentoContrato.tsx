// Obras de poços › fechamento do contrato: todo serviço que sai do orçamento tem contrato, escrito (papel assinado) ou
// informal (de boca ou WhatsApp). O informal fica registrado no controle interno, com o dia e como foi combinado.
import React, { useEffect, useState } from 'react';
import { Alert, Card, Col, Input, Modal, Row, Space, Typography } from 'antd';
import { FileProtectOutlined, MessageOutlined } from '@ant-design/icons';
import type { FechamentoContrato, FormaContrato } from './obrasApi';

const { Text } = Typography;
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const OPCOES: { forma: FormaContrato; titulo: string; texto: string; icone: React.ReactNode }[] = [
  { forma: 'ESCRITO', titulo: 'Escrito', texto: 'Contrato em papel assinado pelo cliente.', icone: <FileProtectOutlined style={{ fontSize: 22, color: '#1677ff' }} /> },
  { forma: 'INFORMAL', titulo: 'Informal', texto: 'Combinado de boca ou por WhatsApp, sem papel assinado.', icone: <MessageOutlined style={{ fontSize: 22, color: '#fa8c16' }} /> },
];

export const FechamentoModal: React.FC<{
  aberto: boolean; titulo: string; inicial?: { formaContrato?: FormaContrato | null; fechadoEm?: string | null; combinadoComo?: string | null } | null; okTexto?: string;
  onFechar: () => void; onConfirmar: (f: FechamentoContrato) => Promise<void> | void;
}> = ({ aberto, titulo, inicial, okTexto, onFechar, onConfirmar }) => {
  const [f, setF] = useState<FechamentoContrato>({ formaContrato: 'ESCRITO', fechadoEm: hoje(), combinadoComo: null });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (aberto) setF({ formaContrato: inicial?.formaContrato || 'ESCRITO', fechadoEm: inicial?.fechadoEm || hoje(), combinadoComo: inicial?.combinadoComo || null });
  }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
  const informal = f.formaContrato === 'INFORMAL';
  const falta = informal && !String(f.combinadoComo || '').trim();
  const confirmar = async () => {
    setSalvando(true);
    try { await onConfirmar(f); } finally { setSalvando(false); }
  };
  return (
    <Modal open={aberto} title={titulo} onCancel={onFechar} onOk={confirmar} okText={okTexto || 'Registrar'} cancelText="Voltar"
      okButtonProps={{ disabled: falta, loading: salvando }} destroyOnHidden width={560}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">Todo serviço fechado tem contrato. O informal fica no controle interno da empresa (valores, pagamentos e dados do cliente).</Text>
        <Row gutter={10}>
          {OPCOES.map(o => {
            const ativo = f.formaContrato === o.forma;
            return (
              <Col span={12} key={o.forma}>
                <Card size="small" hoverable onClick={() => setF(x => ({ ...x, formaContrato: o.forma }))}
                  style={{ borderColor: ativo ? '#1677ff' : undefined, background: ativo ? '#f0f7ff' : undefined, height: '100%' }}>
                  <Space align="start">{o.icone}<div><Text strong>{o.titulo}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{o.texto}</Text></div></div></Space>
                </Card>
              </Col>
            );
          })}
        </Row>
        <div>
          <Text>{informal ? 'Combinado em' : 'Assinado em'}</Text>
          <Input type="date" max={hoje()} value={f.fechadoEm || ''} onChange={e => setF(x => ({ ...x, fechadoEm: e.target.value || null }))} />
        </div>
        <div>
          <Text>{informal ? 'Como foi combinado' : 'Observação'}{informal && <Text type="danger"> *</Text>}</Text>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={255} value={f.combinadoComo || ''}
            placeholder={informal ? 'Ex.: por WhatsApp com o João; ele mandou "pode fazer" e o áudio confirmando o valor' : 'Opcional: ex.: 2 vias, uma com o cliente'}
            onChange={e => setF(x => ({ ...x, combinadoComo: e.target.value || null }))} />
        </div>
        {informal && <Alert type="info" showIcon message='Guarde as mensagens do combinado. Em Documentos da obra sai o "Contrato interno" com tudo o que foi acertado.' />}
      </Space>
    </Modal>
  );
};

// Identificação do cliente da venda: busca no cadastro (nome, razão social, CPF/CNPJ) ou consumidor final.
import React, { useEffect, useState } from 'react';
import { Button, Empty, Input, List, Modal, Space, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { buscarClientesPdv, ClienteBusca } from '../services/api/products';
import { ClientePdv } from '../hooks/usePDVState';

const formatarDocumento = (doc: string) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

interface Props {
  open: boolean;
  onSelecionar: (c: ClientePdv | null) => void;
  onFechar: () => void;
}

export const ClientePdvModal: React.FC<Props> = ({ open, onSelecionar, onFechar }) => {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ClienteBusca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [destaque, setDestaque] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    const t = setTimeout(() => {
      buscarClientesPdv(busca.trim())
        .then(r => { setResultados(r); setDestaque(0); })
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, open]);

  useEffect(() => { if (open) setBusca(''); }, [open]);

  const escolher = (c: ClienteBusca) => onSelecionar({ id: c.id, nome: c.nome, documento: c.documento, tipo: c.tipo });

  return (
    <Modal
      open={open}
      title={<Space><UserOutlined /> Cliente da venda</Space>}
      onCancel={onFechar}
      footer={
        <Space>
          <Button onClick={() => onSelecionar(null)} type="primary" ghost>Consumidor final (F6)</Button>
          <Button onClick={onFechar}>Fechar (Esc)</Button>
        </Space>
      }
      width={560}
      destroyOnClose
    >
      <Input.Search
        autoFocus
        allowClear
        placeholder="Nome, razão social, CPF ou CNPJ"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        loading={carregando}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setDestaque(d => Math.min(d + 1, resultados.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)); }
          if (e.key === 'Enter' && resultados[destaque]) { e.preventDefault(); escolher(resultados[destaque]); }
          if (e.key === 'F6') { e.preventDefault(); onSelecionar(null); }
        }}
      />
      <List
        style={{ marginTop: 10, maxHeight: 360, overflow: 'auto' }}
        size="small"
        dataSource={resultados}
        locale={{ emptyText: <Empty description={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} /> }}
        renderItem={(c, idx) => (
          <List.Item
            onClick={() => escolher(c)}
            style={{ cursor: 'pointer', background: idx === destaque ? '#e6f4ff' : undefined, borderRadius: 6, padding: '6px 8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.nome}</div>
                {c.razaoSocial && c.razaoSocial !== c.nome && <div style={{ fontSize: 11, color: '#64748b' }}>{c.razaoSocial}</div>}
              </div>
              <Space>
                <Tag>{c.tipo}</Tag>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatarDocumento(c.documento)}</span>
              </Space>
            </div>
          </List.Item>
        )}
      />
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>↑ ↓ para escolher · Enter confirma · cadastro de clientes em Parceiros &gt; Clientes</div>
    </Modal>
  );
};

export { formatarDocumento };

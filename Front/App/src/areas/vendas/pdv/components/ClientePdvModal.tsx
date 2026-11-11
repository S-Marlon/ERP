// Identificação do cliente da venda: busca no cadastro (nome, razão social, CPF/CNPJ ou telefone), consumidor final ou
// cadastro rápido só com nome e telefone (cliente do balcão que compra a prazo).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Flex, Input, List, Modal, Space, Tag, Typography } from 'antd';
import type { InputRef } from 'antd';
import { PhoneOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { buscarClientesPdv, cadastrarClienteRapido, ClienteBusca } from '../services/api/products';
import { ClientePdv } from '../hooks/usePDVState';

const formatarDocumento = (doc: string) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

interface Props {
  open: boolean;
  /** Já abre buscando isto (ex.: o telefone anotado no orçamento). */
  buscaInicial?: string;
  /** Título no lugar de "Cliente da venda". */
  titulo?: string;
  onSelecionar: (c: ClientePdv | null) => void;
  onFechar: () => void;
}

export const ClientePdvModal: React.FC<Props> = ({ open, buscaInicial, titulo, onSelecionar, onFechar }) => {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ClienteBusca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [destaque, setDestaque] = useState(0);
  // cadastro rápido
  const [novo, setNovo] = useState<{ nome: string; telefone: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroNovo, setErroNovo] = useState<{ texto: string; cliente?: ClienteBusca } | null>(null);
  const nomeRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!open || novo) return;
    setCarregando(true);
    const t = setTimeout(() => {
      buscarClientesPdv(busca.trim())
        .then(r => { setResultados(r); setDestaque(0); })
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, open, novo]);

  useEffect(() => { if (open) { setBusca(buscaInicial || ''); setNovo(null); setErroNovo(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (c: ClienteBusca) => onSelecionar({ id: c.id, nome: c.nome, documento: c.documento, tipo: c.tipo });

  // o que foi digitado na busca já vai para o cadastro: números viram o telefone, letras o nome
  const abrirNovo = () => {
    const t = busca.trim();
    const soNumeros = /^[\d\s()+-]+$/.test(t);
    setNovo({ nome: soNumeros ? '' : t, telefone: soNumeros ? t : '' });
    setErroNovo(null);
    setTimeout(() => nomeRef.current?.focus(), 50);
  };

  const salvarNovo = async () => {
    if (!novo) return;
    setSalvando(true);
    setErroNovo(null);
    const r = await cadastrarClienteRapido(novo.nome, novo.telefone);
    setSalvando(false);
    if (r.ok) { escolher(r.cliente); return; }
    setErroNovo({ texto: r.erro, cliente: r.cliente });
  };

  return (
    <Modal
      open={open}
      title={<Space><UserOutlined /> {novo ? 'Cliente novo (rápido)' : titulo || 'Cliente da venda'}</Space>}
      onCancel={onFechar}
      footer={novo ? (
        <Space>
          <Button onClick={() => setNovo(null)}>Voltar à busca</Button>
          <Button type="primary" icon={<UserAddOutlined />} loading={salvando} onClick={salvarNovo}>{titulo ? 'Cadastrar e usar' : 'Cadastrar e usar na venda'}</Button>
        </Space>
      ) : (
        <Space>
          <Button icon={<UserAddOutlined />} onClick={abrirNovo}>Cliente novo</Button>
          <Button onClick={() => onSelecionar(null)} type="primary" ghost>Consumidor final (F6)</Button>
          <Button onClick={onFechar}>Fechar (Esc)</Button>
        </Space>
      )}
      width={560}
      destroyOnHidden
    >
      {novo ? (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Typography.Text type="secondary">Só o nome e o telefone, para vender a prazo agora. CPF, endereço e o resto dá para completar depois em Parceiros › Clientes.</Typography.Text>
          <div>
            <Typography.Text>Nome</Typography.Text>
            <Input ref={nomeRef} placeholder="Ex.: José da Silva" maxLength={255} value={novo.nome}
              onChange={e => setNovo(n => n && { ...n, nome: e.target.value })} onPressEnter={salvarNovo} />
          </div>
          <div>
            <Typography.Text>Telefone (com DDD)</Typography.Text>
            <Input prefix={<PhoneOutlined />} placeholder="Ex.: 54 99707-7069" maxLength={20} value={novo.telefone}
              onChange={e => setNovo(n => n && { ...n, telefone: e.target.value })} onPressEnter={salvarNovo} />
          </div>
          {erroNovo && (
            <Alert type={erroNovo.cliente ? 'warning' : 'error'} showIcon message={erroNovo.texto}
              action={erroNovo.cliente && <Button size="small" type="primary" onClick={() => escolher(erroNovo.cliente!)}>Usar {erroNovo.cliente.nome}</Button>} />
          )}
        </Space>
      ) : (
        <>
          <Input.Search
            autoFocus
            allowClear
            placeholder="Nome, razão social, CPF/CNPJ ou telefone"
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
            locale={{
              emptyText: (
                <Empty description={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}>
                  <Button type="primary" icon={<UserAddOutlined />} onClick={abrirNovo}>Cadastrar {busca ? `"${busca.trim()}"` : 'cliente novo'}</Button>
                </Empty>
              ),
            }}
            renderItem={(c, idx) => (
              <List.Item
                onClick={() => escolher(c)}
                style={{ cursor: 'pointer', background: idx === destaque ? '#e6f4ff' : undefined, borderRadius: 6, padding: '6px 8px' }}
              >
                <Flex justify="space-between" style={{ width: '100%' }} gap={8}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.nome}</div>
                    {c.razaoSocial && c.razaoSocial !== c.nome && <div style={{ fontSize: 11, color: '#64748b' }}>{c.razaoSocial}</div>}
                    {c.telefone && <div style={{ fontSize: 11, color: '#64748b' }}><PhoneOutlined /> {c.telefone}</div>}
                  </div>
                  <Space>
                    <Tag>{c.tipo}</Tag>
                    {c.documento ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatarDocumento(c.documento)}</span> : <Typography.Text type="secondary" style={{ fontSize: 11 }}>sem CPF</Typography.Text>}
                  </Space>
                </Flex>
              </List.Item>
            )}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>↑ ↓ para escolher · Enter confirma · cadastro completo em Parceiros &gt; Clientes</div>
        </>
      )}
    </Modal>
  );
};

export { formatarDocumento };

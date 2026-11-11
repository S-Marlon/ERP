// Obras de poços › busca geral (no topo de todas as telas do módulo): um campo para achar cliente, poço ou contrato por
// nome, telefone, CPF/CNPJ, identificação do poço, cidade/endereço ou nº do contrato. Cliente e poço abrem a ficha por
// cima da tela atual; contrato abre a obra.
import React, { useEffect, useRef, useState } from 'react';
import { AutoComplete, Input, Space, Tag, Typography } from 'antd';
import { EnvironmentOutlined, FileTextOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { foneBr, obrasApi, ResultadoBusca, SERVICOS, SITUACOES_OBRA, TIPOS_CONTRATO } from './obrasApi';
import { abrirFichaCliente, abrirFichaPoco, abrirObra } from './navPocos';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Linha: React.FC<{ titulo: React.ReactNode; detalhe: Array<React.ReactNode | null | false> }> = ({ titulo, detalhe }) => (
  <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
    <div style={{ whiteSpace: 'normal' }}>{titulo}</div>
    <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'normal' }}>
      {detalhe.filter(Boolean).map((x, i) => <React.Fragment key={i}>{i > 0 && ' · '}{x}</React.Fragment>)}
    </Text>
  </div>
);
const Grupo: React.FC<{ icone: React.ReactNode; titulo: string; qtd: number }> = ({ icone, titulo, qtd }) => (
  <Space size={6} style={{ fontWeight: 600 }}>{icone}{titulo}<Text type="secondary" style={{ fontWeight: 400 }}>({qtd})</Text></Space>
);

const BuscaPocos: React.FC = () => {
  const [texto, setTexto] = useState('');
  const [r, setR] = useState<ResultadoBusca | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef('');
  useEffect(() => {
    const t = texto.trim();
    if (!t) { setR(null); return; }
    const id = setTimeout(() => {
      ultima.current = t;
      setBuscando(true);
      obrasApi.busca(t).then(x => { if (ultima.current === t) setR(x); }).catch(() => setR(null)).finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(id);
  }, [texto]);

  const options = r ? [
    {
      label: <Grupo icone={<UserOutlined />} titulo="Clientes" qtd={r.clientes.length} />,
      options: r.clientes.map(c => ({
        value: `C${c.idCliente}`,
        label: <Linha titulo={<Text strong>{c.nome}</Text>} detalhe={[c.telefone && foneBr(c.telefone), c.cidade, `${c.pocos} poço(s)`, `${c.obras} contrato(s)/obra(s)`]} />,
      })),
    },
    {
      label: <Grupo icone={<EnvironmentOutlined />} titulo="Poços" qtd={r.pocos.length} />,
      options: r.pocos.map(p => ({
        value: `P${p.idPoco}`,
        label: <Linha titulo={<Text strong>{p.identificacao}</Text>}
          detalhe={[p.proprietario, p.local, p.profundidadeM && `${p.profundidadeM} m`, p.latitude === null && 'sem GPS']} />,
      })),
    },
    {
      label: <Grupo icone={<FileTextOutlined />} titulo="Contratos e obras" qtd={r.contratos.length} />,
      options: r.contratos.map(o => ({
        value: `O${o.idObra}`,
        label: <Linha
          titulo={<Space size={4} wrap><Text strong>Nº {o.idObra}</Text><Text>{o.titulo || o.servicos.map(s => SERVICOS[s]).join(' + ')}</Text>
            <Tag color={SITUACOES_OBRA[o.situacao].cor} style={{ margin: 0 }}>{SITUACOES_OBRA[o.situacao].texto}</Tag>
            {(o.tipoContrato === 'FORMAL' || o.tipoContrato === 'INFORMAL') && <Tag color={TIPOS_CONTRATO[o.tipoContrato].cor} style={{ margin: 0 }}>{TIPOS_CONTRATO[o.tipoContrato].texto}</Tag>}</Space>}
          detalhe={[o.cliente, o.poco, o.valor !== null && brl(o.valor)]} />,
      })),
    },
  ].filter(g => g.options.length) : [];

  const escolher = (v: string) => {
    const id = Number(v.slice(1));
    setTexto(''); setR(null);
    if (v[0] === 'C') abrirFichaCliente(id);
    else if (v[0] === 'P') abrirFichaPoco(id);
    else abrirObra(id, 'ORCAMENTO');
  };

  return (
    <AutoComplete value={texto} onChange={setTexto} onSelect={escolher} options={options} style={{ width: 400, maxWidth: '100%' }}
      popupMatchSelectWidth={540} listHeight={460}
      notFoundContent={texto.trim() && r && !buscando ? 'Nada encontrado' : null}>
      <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar cliente, telefone, CPF, poço ou nº do contrato" />
    </AutoComplete>
  );
};

export default BuscaPocos;

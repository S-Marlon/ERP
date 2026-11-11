// Documentos: um lugar só para gerar e imprimir o que é institucional. Três abas: o kit de visita (modelos em branco ou
// preenchidos), os documentos de uma obra (orçamento, contrato, aditivos, laudo e adesivo, com a mesma pré-visualização
// A4) e o relatório técnico avulso (sem obra cadastrada).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, List, Row, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import { FileTextOutlined, FolderOpenOutlined, PrinterOutlined, ToolOutlined } from '@ant-design/icons';
import KitVisita from './KitVisita';
import RelatorioPocoPage from './RelatorioPocoPage';
import { Aditivo, DocumentoObra, Obra, obrasApi, orcamentoApi, processoApi, SITUACOES_OBRA, urlArquivo } from './obrasApi';
import { htmlAditivo, htmlAdesivo, htmlContrato, htmlLaudo, htmlOrcamento } from './documentosPocos';
import { semImpressao } from './documentosEmBranco';
import { abrirObra, navPocos, useNavPocos } from './navPocos';

const { Text } = Typography;
type Aba = 'KIT' | 'OBRA' | 'RELATORIO';
const ABAS: Aba[] = ['KIT', 'OBRA', 'RELATORIO'];

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const imprimir = (html: string) => {
  const w = window.open('', '_blank');
  if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

type ItemDoc = { chave: string; titulo: string; descricao: string; aviso?: string; html: () => string };

/** Os documentos que a obra já pode gerar, com o aviso quando ainda é cedo (ex.: laudo de obra não concluída). */
const documentosDaObra = (d: DocumentoObra, aditivos: Aditivo[]): ItemDoc[] => {
  const logo = urlArquivo(d.empresa.logo), hoje = hojeIso(), o = d.obra;
  const concluida = o.situacao === 'CONCLUIDA';
  return [
    { chave: 'ORCAMENTO', titulo: 'Orçamento', descricao: 'Itens, valores, pagamento, prazo, garantia e condições gerais.', html: () => htmlOrcamento(d, logo, hoje) },
    { chave: 'CONTRATO', titulo: 'Contrato', descricao: 'O contrato da configuração preenchido com os dados da obra e do cliente.',
      aviso: o.contratoAssinadoEm ? undefined : 'contrato ainda não marcado como assinado', html: () => htmlContrato(d, logo, hoje) },
    ...aditivos.map(a => ({
      chave: `ADITIVO_${a.idAditivo}`, titulo: `Termo aditivo nº ${a.numero}`, descricao: a.adicionais.map(x => x.descricao).join(' · ') || 'Adicionais aprovados.',
      aviso: a.assinadoEm ? undefined : 'ainda não assinado', html: () => htmlAditivo(d, a, aditivos, logo, hoje),
    })),
    { chave: 'LAUDO', titulo: 'Laudo de entrega', descricao: 'Profundidade, vazão, níveis, bomba, garantia e recomendações.',
      aviso: concluida ? undefined : 'a obra ainda não foi concluída', html: () => htmlLaudo(d, logo, hoje) },
    { chave: 'ADESIVO', titulo: 'Adesivo do quadro', descricao: 'Quatro adesivos de 10 × 6 cm por folha, com o telefone da assistência.', html: () => htmlAdesivo(d, logo) },
  ];
};

/** pedida: obra que chegou escolhida (ficha do poço, busca); pedido muda a cada atalho para reagir mesmo se repetir. */
const DocumentosDaObra: React.FC<{ pedida?: number; pedido?: number }> = ({ pedida, pedido }) => {
  const [obras, setObras] = useState<Obra[]>([]);
  const [idObra, setIdObra] = useState<number | null>(pedida ?? null);
  useEffect(() => { if (pedida) setIdObra(pedida); }, [pedida, pedido]);
  const [doc, setDoc] = useState<DocumentoObra | null>(null);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [vendo, setVendo] = useState('ORCAMENTO');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { obrasApi.obras().then(setObras).catch(e => message.error(e.message)); }, []);
  useEffect(() => {
    setDoc(null); setAditivos([]);
    if (!idObra) return;
    setCarregando(true);
    Promise.all([processoApi.documento(idObra), orcamentoApi.aditivos(idObra).catch(() => ({ aditivos: [] as Aditivo[] }))])
      .then(([d, a]) => { setDoc(d); setAditivos(a.aditivos); setVendo('ORCAMENTO'); })
      .catch(e => message.error(e.message)).finally(() => setCarregando(false));
  }, [idObra]);

  const itens = useMemo(() => (doc ? documentosDaObra(doc, aditivos) : []), [doc, aditivos]);
  const atual = itens.find(i => i.chave === vendo) || itens[0];
  const previa = useMemo(() => (atual ? semImpressao(atual.html()) : ''), [atual]);

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} lg={7}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">Escolha a obra para ver e imprimir os documentos dela.</Text>
          <Select showSearch allowClear placeholder="Obra (nº, cliente ou título)" style={{ width: '100%' }} value={idObra ?? undefined} onChange={v => setIdObra(v ?? null)}
            optionFilterProp="label" loading={!obras.length && carregando}
            options={obras.map(o => ({ value: o.idObra, label: `${o.idObra} · ${o.cliente}${o.titulo ? ` · ${o.titulo}` : ''} (${SITUACOES_OBRA[o.situacao].texto.toLowerCase()})` }))} />
          {doc && (
            <List size="small" bordered dataSource={itens} renderItem={i => (
              <List.Item onClick={() => setVendo(i.chave)} style={{ cursor: 'pointer', background: atual?.chave === i.chave ? '#f0f7ff' : undefined }}
                actions={[<Button key="p" size="small" type="text" icon={<PrinterOutlined />} onClick={e => { e.stopPropagation(); imprimir(i.html()); }} />]}>
                <List.Item.Meta title={<Space size={4} wrap>{i.titulo}{i.aviso && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>{i.aviso}</Tag>}</Space>}
                  description={<Text type="secondary" style={{ fontSize: 12 }}>{i.descricao}</Text>} />
              </List.Item>
            )} />
          )}
          {doc && (
            <Button block icon={<FolderOpenOutlined />} onClick={() => abrirObra(doc.obra.idObra, 'ORCAMENTO')}>Abrir a obra (editar itens, contrato, aditivos)</Button>
          )}
          {!doc && !carregando && obras.length === 0 && <Alert type="info" showIcon message="Nenhuma obra cadastrada ainda." />}
        </Space>
      </Col>
      <Col xs={24} lg={17}>
        <Card size="small" loading={carregando} title={atual ? `Pré-visualização (A4) · ${atual.titulo}` : 'Pré-visualização (A4)'}
          extra={atual && <Button type="primary" icon={<PrinterOutlined />} onClick={() => imprimir(atual.html())}>Imprimir</Button>}
          styles={{ body: { padding: 8, background: '#e5e7eb' } }}>
          {previa
            ? <iframe title="Pré-visualização do documento" srcDoc={previa}
              style={{ width: '100%', maxWidth: 860, height: '80vh', display: 'block', margin: '0 auto', border: '1px solid #d1d5db', background: '#e5e7eb' }} />
            : <Empty style={{ padding: 60, background: '#fff' }} description="Escolha uma obra" />}
        </Card>
      </Col>
    </Row>
  );
};

const CentralDocumentos: React.FC = () => {
  const nav = useNavPocos();
  const pedida = navPocos.get().subvista as Aba | undefined;
  const [aba, setAba] = useState<Aba>(pedida && ABAS.includes(pedida) ? pedida : 'KIT');
  // atalhos de outras telas (ex.: "Kit de visita" na Central, endereço antigo do Relatório avulso)
  useEffect(() => { if (nav.aba === 'documentos' && nav.subvista && ABAS.includes(nav.subvista as Aba)) setAba(nav.subvista as Aba); }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Segmented value={aba} onChange={v => setAba(v as Aba)} options={[
          { value: 'KIT', label: <span><FileTextOutlined /> Kit de visita</span> },
          { value: 'OBRA', label: <span><FolderOpenOutlined /> Documentos de uma obra</span> },
          { value: 'RELATORIO', label: <span><ToolOutlined /> Relatório técnico avulso</span> },
        ]} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {aba === 'KIT' ? 'Modelos para levar ao cliente, em branco ou preenchidos.' : aba === 'OBRA' ? 'Os documentos já preenchidos com os dados de uma obra.' : 'Relatório técnico sem obra cadastrada (rascunho neste computador).'}
        </Text>
      </Flex>
      {aba === 'KIT' && <KitVisita />}
      {aba === 'OBRA' && <DocumentosDaObra pedida={nav.aba === 'documentos' && nav.subvista === 'OBRA' ? nav.abrirObra : undefined} pedido={nav.pedido} />}
      {aba === 'RELATORIO' && <RelatorioPocoPage />}
    </Space>
  );
};

export default CentralDocumentos;

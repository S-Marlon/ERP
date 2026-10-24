// Obras de poços › o processo de uma obra (fica dentro da obra aberta): o checklist do orçamento à pós-venda, as fotos
// de antes, durante e depois (com "pode divulgar"), e os atalhos: orçamento em PDF, laudo, adesivo do quadro e as
// mensagens de WhatsApp (avaliação no Google, lembrete de revisão).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Image, Input, Modal, Popconfirm, Row, Space, Switch, Table, Tag, Tooltip, Typography, Upload, message,
} from 'antd';
import {
  CameraOutlined, CheckOutlined, DeleteOutlined, FilePdfOutlined, PrinterOutlined, StopOutlined, TagOutlined, UndoOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import {
  dataBr, ESTADOS_ETAPA, ETAPAS_FOTO, EtapaFoto, FotoObra, ItemChecklist, ORIGENS_LEAD, processoApi, ProcessoObra as Processo, urlArquivo,
} from './obrasApi';
import { htmlAdesivo, htmlLaudo, htmlOrcamento } from './documentosPocos';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const quando = (s: string | null) => (s ? `${dataBr(s)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '');
const GRUPOS: Record<ItemChecklist['grupo'], string> = { ORCAMENTO: '1 · Atendimento e orçamento', OBRA: '2 · Obra (fotos)', ENTREGA: '3 · Entrega', POS_VENDA: '4 · Pós-venda' };

/** Reduz a foto do celular (até 1600 px, JPEG) antes de enviar: fica leve no servidor e no WhatsApp. */
export const reduzirImagem = (arquivo: File, maximo = 1600, qualidade = 0.82) => new Promise<string>((ok, falha) => {
  const leitor = new FileReader();
  leitor.onerror = () => falha(new Error('Não deu para ler a imagem.'));
  leitor.onload = () => {
    const img = new window.Image();
    img.onerror = () => falha(new Error('Arquivo não é uma imagem.'));
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.src = String(leitor.result);
  };
  leitor.readAsDataURL(arquivo);
});

/** Abre o documento numa janela nova (o navegador oferece imprimir ou "Salvar como PDF"). */
const imprimir = (html: string) => {
  const w = window.open('', '_blank');
  if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

const FotosDaEtapa: React.FC<{ etapa: EtapaFoto; fotos: FotoObra[]; idObra: number; onMudou: () => void; bloqueada: boolean }> = ({ etapa, fotos, idObra, onMudou, bloqueada }) => {
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo: File) => {
    setEnviando(true);
    try {
      const conteudo = await reduzirImagem(arquivo);
      await processoApi.enviarFoto(idObra, { etapa, conteudo, nome: arquivo.name, podeDivulgar: false });
      onMudou();
    } catch (e) { erro(e); } finally { setEnviando(false); }
  };
  const salvar = async (f: FotoObra, mudou: Partial<FotoObra>) => {
    try { await processoApi.salvarFoto(f.idFoto, { etapa: f.etapa, legenda: f.legenda, podeDivulgar: f.podeDivulgar, ...mudou }); onMudou(); } catch (e) { erro(e); }
  };
  return (
    <Card size="small" title={`${ETAPAS_FOTO[etapa]} (${fotos.length})`} style={{ height: '100%' }}
      extra={!bloqueada && (
        <Upload accept="image/*" multiple showUploadList={false} beforeUpload={f => { enviar(f); return false; }}>
          <Button size="small" icon={<CameraOutlined />} loading={enviando}>Adicionar</Button>
        </Upload>
      )}>
      {!fotos.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem fotos" /> : (
        <Image.PreviewGroup>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {fotos.map(f => (
              <div key={f.idFoto} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Image src={urlArquivo(f.url) || ''} width={84} height={64} style={{ objectFit: 'cover', borderRadius: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input size="small" placeholder="Legenda" defaultValue={f.legenda || ''} maxLength={150}
                    onBlur={e => { const v = e.target.value.trim() || null; if (v !== f.legenda) salvar(f, { legenda: v }); }} />
                  <Space size={6} style={{ marginTop: 4 }}>
                    <Tooltip title="O cliente autorizou usar esta foto na propaganda">
                      <Space size={4}><Switch size="small" checked={f.podeDivulgar} onChange={podeDivulgar => salvar(f, { podeDivulgar })} /><Text style={{ fontSize: 12 }}>pode divulgar</Text></Space>
                    </Tooltip>
                    <Popconfirm title="Apagar a foto?" okText="Apagar" cancelText="Voltar" onConfirm={async () => { try { await processoApi.apagarFoto(f.idFoto); onMudou(); } catch (e) { erro(e); } }}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </Space>
        </Image.PreviewGroup>
      )}
    </Card>
  );
};

export const ProcessoDaObra: React.FC<{ idObra: number; cancelada: boolean }> = ({ idObra, cancelada }) => {
  const [p, setP] = useState<Processo | null>(null);
  const [marcando, setMarcando] = useState<{ item: ItemChecklist; situacao: 'FEITO' | 'NAO_SE_APLICA'; quando: string; obs: string } | null>(null);
  const carregar = useCallback(() => processoApi.daObra(idObra).then(setP).catch(erro), [idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  const marcar = async (etapa: string, situacao: 'FEITO' | 'NAO_SE_APLICA' = 'FEITO', feitoEm?: string | null, observacao?: string | null) => {
    try { await processoApi.marcar(idObra, etapa, { situacao, feitoEm: feitoEm || null, observacao: observacao || null }); carregar(); } catch (e) { erro(e); }
  };
  const documento = async (qual: 'ORCAMENTO' | 'LAUDO' | 'ADESIVO') => {
    try {
      const d = await processoApi.documento(idObra);
      if (!d.empresa.configurado) message.info('Dica: preencha os dados da empresa e o logo em Atendimento e pós-venda › Configuração.');
      const logo = urlArquivo(d.empresa.logo);
      imprimir(qual === 'ORCAMENTO' ? htmlOrcamento(d, logo, hojeIso()) : qual === 'LAUDO' ? htmlLaudo(d, logo, hojeIso()) : htmlAdesivo(d, logo));
    } catch (e) { erro(e); }
  };
  const whatsapp = (link: string | null, etapa?: string) => {
    if (!link) { message.warning('O cliente não tem telefone (celular) no cadastro.'); return; }
    window.open(link, '_blank');
    if (etapa) Modal.confirm({ title: 'Mensagem enviada?', content: 'Registrar esta etapa como feita agora?', okText: 'Sim, registrar', cancelText: 'Ainda não', onOk: () => marcar(etapa) });
  };
  if (!p) return <Card size="small" loading />;
  if (cancelada) return <Alert type="info" showIcon message="Obra cancelada: sem processo a seguir." />;
  const atalho = (i: ItemChecklist) => {
    if (i.etapa === 'ORCAMENTO_ENVIADO') return <Button size="small" icon={<FilePdfOutlined />} onClick={() => documento('ORCAMENTO')}>Orçamento PDF</Button>;
    if (i.etapa === 'LAUDO_ENTREGUE') return <Button size="small" icon={<PrinterOutlined />} onClick={() => documento('LAUDO')}>Laudo</Button>;
    if (i.etapa === 'ADESIVO_QUADRO') return <Button size="small" icon={<TagOutlined />} onClick={() => documento('ADESIVO')}>Adesivo</Button>;
    if (i.etapa === 'AVALIACAO_PEDIDA') return <Button size="small" icon={<WhatsAppOutlined />} onClick={() => whatsapp(p.whatsappAvaliacao, 'AVALIACAO_PEDIDA')}>Pedir avaliação</Button>;
    if (i.etapa === 'REVISAO_LEMBRADA') return <Button size="small" icon={<WhatsAppOutlined />} onClick={() => whatsapp(p.whatsappRevisao, 'REVISAO_LEMBRADA')}>Lembrar revisão</Button>;
    return null;
  };
  const porEtapa = (e: EtapaFoto) => p.fotos.filter(f => f.etapa === e);
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            {p.resumo.atrasadas > 0 && <Tag color="red">{p.resumo.atrasadas} atrasada(s)</Tag>}
            {p.resumo.pendentes > 0 && <Tag color="gold">{p.resumo.pendentes} pendente(s)</Tag>}
            {p.resumo.emDia && <Tag color="green">processo em dia</Tag>}
            {p.lead && <Tag>veio por {ORIGENS_LEAD[p.lead.origem].toLowerCase()}</Tag>}
          </Space>
          <Space wrap>
            <Button icon={<FilePdfOutlined />} onClick={() => documento('ORCAMENTO')}>Orçamento PDF</Button>
            <Button icon={<PrinterOutlined />} onClick={() => documento('LAUDO')}>Laudo de entrega</Button>
            <Button icon={<TagOutlined />} onClick={() => documento('ADESIVO')}>Adesivo do quadro</Button>
            <Button icon={<WhatsAppOutlined />} onClick={() => whatsapp(p.whatsapp)}>WhatsApp do cliente</Button>
          </Space>
        </Space>
      </Card>
      <Card size="small" title="Checklist do processo">
        <Table<ItemChecklist> size="small" rowKey="etapa" pagination={false} dataSource={p.checklist}
          columns={[
            { title: 'Etapa', render: (_, i, idx) => <>{(idx === 0 || p.checklist[idx - 1].grupo !== i.grupo) && <div><Text type="secondary" style={{ fontSize: 11 }}>{GRUPOS[i.grupo]}</Text></div>}{i.titulo}</> },
            { title: 'Situação', width: 130, render: (_, i) => <Tag color={ESTADOS_ETAPA[i.estado].cor}>{ESTADOS_ETAPA[i.estado].texto}</Tag> },
            {
              title: 'Quando', width: 220, render: (_, i) => (
                <Text style={{ fontSize: 12 }}>
                  {i.feitoEm ? <>{quando(i.feitoEm)}{i.noPrazo === false && <Tag color="orange" style={{ marginLeft: 4 }}>fora do prazo</Tag>}</> : i.prazo && i.estado !== 'AINDA_NAO' ? `prazo ${quando(i.prazo)}` : i.prazo ? `a partir de ${dataBr(i.prazo)}` : ''}
                  {i.observacao ? <div><Text type="secondary" style={{ fontSize: 11 }}>{i.observacao}</Text></div> : null}
                </Text>
              ),
            },
            {
              title: '', width: 330, align: 'right', render: (_, i) => (
                <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
                  {atalho(i)}
                  {i.manual && (i.estado === 'FEITO' || i.estado === 'NAO_SE_APLICA'
                    ? <Tooltip title="Desfazer"><Button size="small" type="text" icon={<UndoOutlined />} onClick={async () => { try { await processoApi.desfazer(idObra, i.etapa); carregar(); } catch (e) { erro(e); } }} /></Tooltip>
                    : <>
                        <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => setMarcando({ item: i, situacao: 'FEITO', quando: '', obs: '' })}>Feito</Button>
                        {i.etapa !== 'VISITA' && i.etapa !== 'ORCAMENTO_ENVIADO' && (
                          <Tooltip title="Não se aplica a esta obra"><Button size="small" type="text" icon={<StopOutlined />} onClick={() => setMarcando({ item: i, situacao: 'NAO_SE_APLICA', quando: '', obs: '' })} /></Tooltip>
                        )}
                      </>)}
                </Space>
              ),
            },
          ]} />
      </Card>
      <Row gutter={[10, 10]}>
        {(Object.keys(ETAPAS_FOTO) as EtapaFoto[]).map(e => (
          <Col xs={24} md={8} key={e}><FotosDaEtapa etapa={e} fotos={porEtapa(e)} idObra={idObra} onMudou={carregar} bloqueada={cancelada} /></Col>
        ))}
      </Row>
      <Text type="secondary" style={{ fontSize: 12 }}>As fotos são reduzidas antes de enviar. Marque "pode divulgar" só com a autorização do cliente: elas vão para a galeria de propaganda.</Text>
      <Modal open={!!marcando} title={marcando ? `${marcando.situacao === 'FEITO' ? 'Registrar' : 'Não se aplica'}: ${marcando.item.titulo}` : ''} okText="Registrar" cancelText="Voltar"
        onCancel={() => setMarcando(null)} destroyOnHidden
        onOk={async () => { if (marcando) { await marcar(marcando.item.etapa, marcando.situacao, marcando.quando ? marcando.quando.replace('T', ' ') : null, marcando.obs); setMarcando(null); } }}>
        {marcando && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {marcando.situacao === 'FEITO' && <div><Text>Quando (vazio = agora)</Text><Input type="datetime-local" value={marcando.quando} onChange={e => setMarcando({ ...marcando, quando: e.target.value })} /></div>}
            <div><Text>Observação</Text><Input maxLength={255} value={marcando.obs} onChange={e => setMarcando({ ...marcando, obs: e.target.value })}
              placeholder={marcando.situacao === 'NAO_SE_APLICA' ? 'Ex.: serviço sem quadro' : 'Ex.: enviado por WhatsApp'} /></div>
          </Space>
        )}
      </Modal>
    </Space>
  );
};

// Obras de poços › orçamento rápido e contrato: o primeiro orçamento para o contato (cliente, local, itens como
// "50 metros × R$ 180", condições) com o PDF para imprimir ou mandar; dentro da obra, a parte "Orçamento e contrato"
// com os itens, o orçamento e o contrato completo em PDF, a assinatura do contrato e os termos aditivos.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Divider, Empty, Flex, Input, InputNumber, List, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CheckOutlined, CopyOutlined, DeleteOutlined, FilePdfOutlined, FileTextOutlined, PlusOutlined, PrinterOutlined, SaveOutlined, UndoOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  AdicionalDoAditivo, Aditivo, dataBr, GRUPOS_ITEM, GrupoItem, ItemOrcamentoForm, ITENS_PRONTOS, Lead, linhaItem, NovoOrcamento, Obra, obrasApi, orcamentoApi,
  Poco, processoApi, resumoItens, Servico, SERVICOS, UNIDADES_ITEM, urlArquivo,
} from './obrasApi';
import { htmlAditivo, htmlContrato, htmlOrcamento } from './documentosPocos';
import { ClientePocoModal } from './ClientesPoco';
import { abrirObra } from './navPocos';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Abre a janela de impressão já no clique (senão o navegador bloqueia por vir depois de uma espera) e escreve o
 * documento quando ele fica pronto; se der erro, fecha a janela.
 */
export const imprimirQuandoPronto = async (montar: () => Promise<string>) => {
  const w = window.open('', '_blank');
  if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return false; }
  w.document.write('<p style="font-family:Arial;padding:20px">Montando o documento…</p>');
  try {
    const html = await montar();
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  } catch (e) { w.close(); erro(e); return false; }
};

/** Documento da obra (orçamento ou contrato) com o logo da configuração. */
const documentoDaObra = (idObra: number, qual: 'ORCAMENTO' | 'CONTRATO') => imprimirQuandoPronto(async () => {
  const d = await processoApi.documento(idObra);
  if (!d.empresa.configurado) message.info('Dica: preencha os dados da empresa e o logo em Atendimento e pós-venda › Configuração.');
  const logo = urlArquivo(d.empresa.logo);
  return qual === 'ORCAMENTO' ? htmlOrcamento(d, logo, hojeIso()) : htmlContrato(d, logo, hojeIso());
});

// ------------------------------------------------------------------ editor dos itens

export const EditorItens: React.FC<{ itens: ItemOrcamentoForm[]; onChange: (i: ItemOrcamentoForm[]) => void; bloqueado?: boolean }> = ({ itens, onChange, bloqueado }) => {
  const mudar = (i: number, x: Partial<ItemOrcamentoForm>) => onChange(itens.map((it, k) => (k === i ? linhaItem({ ...it, ...x }) : it)));
  const r = resumoItens(itens);
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Table<ItemOrcamentoForm & { k: number }> size="small" pagination={false} rowKey="k" dataSource={itens.map((it, k) => ({ ...it, k }))}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem itens: comece por um dos botões abaixo." /> }}
        columns={[
          { title: 'Descrição', render: (_, it) => <Input size="small" disabled={bloqueado} maxLength={200} value={it.descricao} onChange={e => mudar(it.k, { descricao: e.target.value })} /> },
          {
            title: 'Grupo', width: 130, render: (_, it) => (
              <Select size="small" disabled={bloqueado} style={{ width: '100%' }} value={it.grupo} onChange={v => mudar(it.k, { grupo: v as GrupoItem })}
                options={Object.entries(GRUPOS_ITEM).map(([value, label]) => ({ value, label }))} />
            ),
          },
          { title: 'Qtd.', width: 90, render: (_, it) => <InputNumber size="small" disabled={bloqueado} min={0} style={{ width: '100%' }} value={it.quantidade} onChange={v => mudar(it.k, { quantidade: Number(v) || 0 })} /> },
          {
            title: 'Un.', width: 72, render: (_, it) => (
              <Select size="small" disabled={bloqueado} style={{ width: '100%' }} value={it.unidade} onChange={v => mudar(it.k, { unidade: v })}
                options={UNIDADES_ITEM.map(u => ({ value: u, label: u }))} />
            ),
          },
          {
            title: 'Valor unit.', width: 130, render: (_, it) => (
              <InputNumber size="small" disabled={bloqueado} min={0} step={10} prefix="R$" decimalSeparator="," style={{ width: '100%' }} value={it.valorUnitario}
                onChange={v => mudar(it.k, { valorUnitario: Number(v) || 0 })} />
            ),
          },
          { title: 'Total', width: 110, align: 'right', render: (_, it) => <Text type={it.opcional ? 'secondary' : undefined}>{it.opcional ? `${brl(it.valorUnitario)}/${it.unidade}` : brl(it.valorTotal)}</Text> },
          {
            title: <Tooltip title="Se necessário: aparece no orçamento, mas não entra no total (ex.: metro excedente)">Se nec.</Tooltip>, width: 64, align: 'center',
            render: (_, it) => <Checkbox disabled={bloqueado} checked={it.opcional} onChange={e => mudar(it.k, { opcional: e.target.checked })} />,
          },
          {
            title: '', width: 70, render: (_, it) => !bloqueado && (
              <Space size={0}>
                <Tooltip title="Subir"><Button size="small" type="text" disabled={!it.k} onClick={() => { const n = [...itens]; [n[it.k - 1], n[it.k]] = [n[it.k], n[it.k - 1]]; onChange(n); }}>↑</Button></Tooltip>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(itens.filter((_, k) => k !== it.k))} />
              </Space>
            ),
          },
        ]} />
      {!bloqueado && (
        <Space wrap size={4}>
          {ITENS_PRONTOS.map(p => <Button key={p.rotulo} size="small" icon={<PlusOutlined />} onClick={() => onChange([...itens, linhaItem(p.item)])}>{p.rotulo}</Button>)}
          <Button size="small" type="dashed" icon={<PlusOutlined />}
            onClick={() => onChange([...itens, linhaItem({ grupo: 'OUTRO', descricao: '', quantidade: 1, unidade: 'un', valorUnitario: 0, opcional: false })])}>Linha em branco</Button>
        </Space>
      )}
      <Flex justify="flex-end" gap={16} wrap>
        {r.metrosPrevistos !== null && <Text type="secondary">{r.metrosPrevistos} m previstos{r.valorMetroExcedente ? ` · excedente ${brl(r.valorMetroExcedente)}/m` : ''}</Text>}
        {r.opcionais > 0 && <Text type="secondary">se necessário: {brl(r.opcionais)}</Text>}
        <Text strong style={{ fontSize: 15 }}>Total {brl(r.total)}</Text>
      </Flex>
    </Space>
  );
};

// ------------------------------------------------------------------ orçamento rápido

interface Condicoes {
  servicos: Servico[]; titulo: string; escopo: string; valorSinal: number | null; sinalQuando: 'ANTES' | 'NO_ATO'; formaPagamento: string;
  prazoExecucaoDias: number | null; validadeOrcamentoDias: number | null; garantiaMeses: number | null;
}
const servicosDoTexto = (t: string | null | undefined): Servico[] =>
  /limp/i.test(t || '') ? ['LIMPEZA'] : /bomba/i.test(t || '') ? ['TROCA_BOMBA'] : /manuten/i.test(t || '') ? ['MANUTENCAO'] : ['PERFURACAO', 'INSTALACAO'];

/**
 * Orçamento rápido para o primeiro contato: escolhe (ou cadastra) o cliente — ou usa o contato (lead) —, o local,
 * os itens e as condições; grava como obra em "orçamento" e já abre o PDF.
 */
export const OrcamentoRapido: React.FC<{
  aberto: boolean; onFechar: () => void; lead?: Lead | null; cliente?: { idCliente: number; nome: string } | null; onCriado?: (idObra: number) => void;
}> = ({ aberto, onFechar, lead, cliente: clienteInicial, onCriado }) => {
  const [cliente, setCliente] = useState<{ idCliente: number; nome: string } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [idPoco, setIdPoco] = useState<number | 'novo'>('novo');
  const [local, setLocal] = useState({ endereco: '', cidade: '', uf: '', gps: '' });
  const [itens, setItens] = useState<ItemOrcamentoForm[]>([]);
  const [c, setC] = useState<Condicoes | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setCliente(clienteInicial || (lead?.idCliente && lead.cliente ? { idCliente: lead.idCliente, nome: lead.cliente } : null));
    setLocal({ endereco: '', cidade: lead?.cidade || '', uf: '', gps: '' });
    setIdPoco('novo');
    const servicos = servicosDoTexto(lead?.necessidade);
    setItens(servicos.includes('PERFURACAO') ? [linhaItem(ITENS_PRONTOS[0].item), linhaItem(ITENS_PRONTOS[1].item)] : []);
    setC({ servicos, titulo: '', escopo: '', valorSinal: null, sinalQuando: 'ANTES', formaPagamento: '', prazoExecucaoDias: null, validadeOrcamentoDias: null, garantiaMeses: 12 });
    processoApi.config().then(cfg => setC(a => (a ? { ...a, formaPagamento: a.formaPagamento || cfg.formaPagamentoPadrao || '', validadeOrcamentoDias: a.validadeOrcamentoDias ?? cfg.validadeOrcamentoDias } : a)))
      .catch(() => undefined);
  }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPocos([]); setIdPoco('novo');
    if (cliente) obrasApi.pocos({ idProprietario: cliente.idCliente }).then(p => { setPocos(p); if (p.length === 1) setIdPoco(p[0].idPoco); }).catch(() => undefined);
  }, [cliente]);
  if (!c) return null;
  const mudar = (x: Partial<Condicoes>) => setC({ ...c, ...x });
  const total = resumoItens(itens).total;
  const salvar = async (pdf: boolean) => {
    if (!cliente && !lead) { message.warning('Escolha ou cadastre o cliente.'); return; }
    if (!c.servicos.length) { message.warning('Marque ao menos um serviço.'); return; }
    if (itens.some(i => !i.descricao.trim())) { message.warning('Toda linha precisa de descrição.'); return; }
    const corpo: NovoOrcamento = {
      idCliente: cliente?.idCliente ?? null, idLead: lead?.idLead ?? null, idPoco: idPoco === 'novo' ? null : idPoco,
      local: idPoco === 'novo' && (local.endereco || local.cidade || local.gps) ? { ...local, gps: local.gps || null } : null,
      servicos: c.servicos, titulo: c.titulo || null, escopo: c.escopo || null, valorSinal: c.valorSinal, sinalQuando: c.sinalQuando, formaPagamento: c.formaPagamento || null,
      prazoExecucaoDias: c.prazoExecucaoDias, validadeOrcamentoDias: c.validadeOrcamentoDias, garantiaMeses: c.garantiaMeses, itens,
      valorContratado: itens.length ? undefined : null,
    };
    setSalvando(true);
    let idObra = 0;
    const criar = async () => { const r = await orcamentoApi.criar(corpo); idObra = r.idObra; return r; };
    try {
      if (pdf) {
        const ok = await imprimirQuandoPronto(async () => {
          await criar();
          const d = await processoApi.documento(idObra);
          return htmlOrcamento(d, urlArquivo(d.empresa.logo), hojeIso());
        });
        if (!ok && !idObra) return;
      } else await criar();
      message.success(`Orçamento nº ${idObra} gravado.${pdf ? ' Depois de mandar ao cliente, marque "Orçamento enviado" no processo.' : ''}`);
      onFechar();
      if (onCriado) onCriado(idObra); else abrirObra(idObra, 'ORCAMENTO');
    } catch (e) { erro(e); } finally { setSalvando(false); }
  };
  return (
    <Modal open={aberto} onCancel={onFechar} width={980} destroyOnHidden title={`Orçamento rápido${lead ? ` · contato ${lead.nome}` : ''}`}
      footer={<Space>
        <Button onClick={onFechar}>Voltar</Button>
        <Button icon={<SaveOutlined />} loading={salvando} onClick={() => salvar(false)}>Só gravar</Button>
        <Button type="primary" icon={<FilePdfOutlined />} loading={salvando} onClick={() => salvar(true)}>Gravar e gerar o PDF</Button>
      </Space>}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Text strong>Cliente</Text>
            <Flex gap={8} align="center" style={{ marginTop: 4 }}>
              <UserOutlined />
              <Text>{cliente ? cliente.nome : lead ? `${lead.nome} (cadastro novo a partir do contato)` : <Text type="secondary">nenhum escolhido</Text>}</Text>
              <Button size="small" onClick={() => setEscolhendo(true)}>{cliente ? 'trocar' : 'escolher / cadastrar'}</Button>
            </Flex>
          </Col>
          <Col xs={24} md={14}>
            <Text strong>Local do poço</Text>
            <Select style={{ width: '100%', marginTop: 4 }} value={idPoco} onChange={setIdPoco}
              options={[{ value: 'novo', label: pocos.length ? 'Outro local (poço novo)' : 'Local novo' }, ...pocos.map(p => ({ value: p.idPoco, label: `${p.identificacao}${p.cidade ? ` · ${p.cidade}` : ''}` }))]} />
          </Col>
        </Row>
        {idPoco === 'novo' && (
          <Row gutter={8}>
            <Col xs={24} md={10}><Input placeholder="Endereço / sítio / estrada" value={local.endereco} maxLength={150} onChange={e => setLocal({ ...local, endereco: e.target.value })} /></Col>
            <Col xs={14} md={6}><Input placeholder="Cidade" value={local.cidade} maxLength={60} onChange={e => setLocal({ ...local, cidade: e.target.value })} /></Col>
            <Col xs={4} md={2}><Input placeholder="UF" value={local.uf} maxLength={2} onChange={e => setLocal({ ...local, uf: e.target.value })} /></Col>
            <Col xs={6} md={6}><Input placeholder="GPS -23.55, -46.63" value={local.gps} onChange={e => setLocal({ ...local, gps: e.target.value })} /></Col>
          </Row>
        )}
        <Row gutter={8} align="bottom">
          <Col xs={24} md={14}>
            <Text strong>Serviços</Text><br />
            <Checkbox.Group value={c.servicos} onChange={v => mudar({ servicos: v as Servico[] })}
              options={Object.entries(SERVICOS).map(([value, label]) => ({ value, label }))} />
          </Col>
          <Col xs={24} md={10}><Text>Título (opcional)</Text><Input maxLength={120} placeholder="Ex.: Poço artesiano do sítio" value={c.titulo} onChange={e => mudar({ titulo: e.target.value })} /></Col>
        </Row>
        <Divider style={{ margin: '4px 0' }} titlePlacement="start" plain>Itens (quantidade × valor)</Divider>
        <EditorItens itens={itens} onChange={setItens} />
        <Divider style={{ margin: '4px 0' }} titlePlacement="start" plain>Condições</Divider>
        <Row gutter={[8, 8]}>
          <Col xs={12} md={5}><Text>Sinal</Text><InputNumber min={0} prefix="R$" style={{ width: '100%' }} value={c.valorSinal} onChange={v => mudar({ valorSinal: v === null ? null : Number(v) })} /></Col>
          <Col xs={12} md={5}><Text>Sinal pago</Text>
            <Segmented block value={c.sinalQuando} onChange={v => mudar({ sinalQuando: v as Condicoes['sinalQuando'] })} options={[{ value: 'ANTES', label: 'Antes' }, { value: 'NO_ATO', label: 'No dia' }]} />
          </Col>
          <Col xs={8} md={4}><Text>Prazo</Text><InputNumber min={1} max={365} suffix="dias" style={{ width: '100%' }} value={c.prazoExecucaoDias} onChange={v => mudar({ prazoExecucaoDias: v === null ? null : Number(v) })} /></Col>
          <Col xs={8} md={5}><Text>Validade</Text><InputNumber min={1} max={365} suffix="dias" style={{ width: '100%' }} value={c.validadeOrcamentoDias} onChange={v => mudar({ validadeOrcamentoDias: v === null ? null : Number(v) })} /></Col>
          <Col xs={8} md={5}><Text>Garantia</Text><InputNumber min={0} max={120} suffix="meses" style={{ width: '100%' }} value={c.garantiaMeses} onChange={v => mudar({ garantiaMeses: v === null ? null : Number(v) })} /></Col>
          <Col xs={24} md={12}><Text>Forma de pagamento</Text>
            <Input.TextArea rows={2} maxLength={500} value={c.formaPagamento} onChange={e => mudar({ formaPagamento: e.target.value })} placeholder="Ex.: 30% de sinal e o saldo na entrega, no PIX" />
          </Col>
          <Col xs={24} md={12}><Text>Escopo / observações do orçamento</Text>
            <Input.TextArea rows={2} maxLength={4000} value={c.escopo} onChange={e => mudar({ escopo: e.target.value })} placeholder={'Ex.: Perfuração 6" até 50 m, revestimento geomecânico, pré-filtro e laje de proteção'} />
          </Col>
        </Row>
        {c.valorSinal !== null && c.valorSinal > total && total > 0 && <Alert type="warning" showIcon message="O sinal está maior que o total do orçamento." />}
      </Space>
      <ClientePocoModal open={escolhendo} onFechar={() => setEscolhendo(false)} onSelecionar={x => { setCliente({ idCliente: x.idCliente, nome: x.nome }); setEscolhendo(false); }} />
    </Modal>
  );
};

// ------------------------------------------------------------------ parte da obra: orçamento e contrato

const AditivosDaObra: React.FC<{ obra: Obra; onMudou: () => void }> = ({ obra, onMudou }) => {
  const [d, setD] = useState<{ aditivos: Aditivo[]; semAditivo: AdicionalDoAditivo[] } | null>(null);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [obs, setObs] = useState('');
  const carregar = useCallback(() => orcamentoApi.aditivos(obra.idObra).then(r => { setD(r); setEscolhidos(r.semAditivo.map(a => a.idAdicional)); }).catch(erro), [obra.idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <Card size="small" loading />;
  const acao = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); message.success(ok); carregar(); onMudou(); } catch (e) { erro(e); } };
  const imprimir = (a: Aditivo) => imprimirQuandoPronto(async () => {
    const doc = await processoApi.documento(obra.idObra);
    return htmlAditivo(doc, a, d.aditivos, urlArquivo(doc.empresa.logo), hojeIso());
  });
  const ultimo = d.aditivos[d.aditivos.length - 1];
  return (
    <Card size="small" title="Termos aditivos" extra={<Text type="secondary" style={{ fontSize: 12 }}>O que mudou depois do contrato (metros a mais, material, serviço) entra por adicional aprovado em "Sinal e cobrança".</Text>}>
      {d.semAditivo.length > 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 8 }} message={`${d.semAditivo.length} adicional(is) aprovado(s) ainda sem termo aditivo`}
          description={(
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Checkbox.Group value={escolhidos} onChange={v => setEscolhidos(v as number[])} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                options={d.semAditivo.map(a => ({ value: a.idAdicional, label: `${a.descricao} · ${brl(a.valor)}` }))} />
              <Flex gap={8}>
                <Input placeholder="Observação no termo (opcional)" maxLength={255} value={obs} onChange={e => setObs(e.target.value)} />
                <Button type="primary" icon={<FileTextOutlined />} disabled={!escolhidos.length}
                  onClick={() => acao(() => orcamentoApi.emitirAditivo(obra.idObra, { idsAdicionais: escolhidos, observacao: obs || null }).then(() => setObs('')), 'Termo aditivo emitido.')}>
                  Emitir aditivo ({brl(d.semAditivo.filter(a => escolhidos.includes(a.idAdicional)).reduce((s, a) => s + a.valor, 0))})
                </Button>
              </Flex>
            </Space>
          )} />
      )}
      <List size="small" dataSource={d.aditivos} locale={{ emptyText: 'Nenhum termo aditivo.' }} renderItem={a => (
        <List.Item actions={[
          <Button key="p" size="small" icon={<PrinterOutlined />} onClick={() => imprimir(a)}>Imprimir</Button>,
          a.assinadoEm
            ? <Popconfirm key="s" title="Desmarcar a assinatura?" onConfirm={() => acao(() => orcamentoApi.assinado(a.idAditivo, null), 'Assinatura desmarcada.')}><Button size="small" icon={<UndoOutlined />}>desmarcar</Button></Popconfirm>
            : <Button key="s" size="small" icon={<CheckOutlined />} onClick={() => acao(() => orcamentoApi.assinado(a.idAditivo, hojeIso()), 'Aditivo marcado como assinado.')}>Assinado</Button>,
          ...(a === ultimo && !a.assinadoEm ? [
            <Popconfirm key="x" title="Apagar este aditivo?" description="Os adicionais voltam a ficar sem aditivo." onConfirm={() => acao(() => orcamentoApi.apagarAditivo(a.idAditivo), 'Aditivo apagado.')}>
              <Button size="small" danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>,
          ] : []),
        ]}>
          <List.Item.Meta
            title={<Space>Aditivo nº {a.numero} · {brl(a.valor)}{a.assinadoEm ? <Tag color="green">assinado em {dataBr(a.assinadoEm)}</Tag> : <Tag color="gold">aguardando assinatura</Tag>}</Space>}
            description={`${a.adicionais.map(x => x.descricao).join(' · ')}${a.observacao ? ` · ${a.observacao}` : ''} · emitido ${dataBr(a.emitidoEm)}`} />
        </List.Item>
      )} />
    </Card>
  );
};

/** Parte "Orçamento e contrato" da obra aberta. */
export const OrcamentoEContrato: React.FC<{ obra: Obra; onMudou: () => void }> = ({ obra, onMudou }) => {
  const [itens, setItens] = useState<ItemOrcamentoForm[] | null>(null);
  const [mudou, setMudou] = useState(false);
  const [contrato, setContrato] = useState<{ estado: string; feitoEm: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => {
    orcamentoApi.itens(obra.idObra).then(r => { setItens(r.itens); setMudou(false); }).catch(erro);
    processoApi.daObra(obra.idObra).then(p => {
      const i = p.checklist.find(x => x.etapa === 'CONTRATO_ASSINADO');
      setContrato(i ? { estado: i.estado, feitoEm: i.feitoEm } : null);
    }).catch(() => setContrato(null));
  }, [obra.idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!itens) return <Card size="small" loading />;
  const bloqueado = obra.situacao === 'CONCLUIDA' || obra.situacao === 'CANCELADA';
  const salvar = async () => {
    setSalvando(true);
    try { const r = await orcamentoApi.salvarItens(obra.idObra, itens); setItens(r.itens); setMudou(false); message.success('Itens salvos: o total virou o valor contratado.'); onMudou(); }
    catch (e) { erro(e); } finally { setSalvando(false); }
  };
  const antesDeImprimir = async (qual: 'ORCAMENTO' | 'CONTRATO') => {
    if (mudou) { message.warning('Salve os itens antes de gerar o documento.'); return; }
    await documentoDaObra(obra.idObra, qual);
  };
  const duplicar = async () => {
    try { const r = await orcamentoApi.duplicar(obra.idObra); message.success(`Orçamento nº ${r.idObra} criado (cópia).`); abrirObra(r.idObra, 'ORCAMENTO'); } catch (e) { erro(e); }
  };
  const marcarContrato = async (desfazer: boolean) => {
    try {
      if (desfazer) await processoApi.desfazer(obra.idObra, 'CONTRATO_ASSINADO');
      else await processoApi.marcar(obra.idObra, 'CONTRATO_ASSINADO', { situacao: 'FEITO' });
      carregar(); onMudou();
    } catch (e) { erro(e); }
  };
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" title="Itens do orçamento"
        extra={<Space wrap>
          {!bloqueado && <Button type="primary" icon={<SaveOutlined />} disabled={!mudou} loading={salvando} onClick={salvar}>Salvar itens</Button>}
          <Button icon={<FilePdfOutlined />} onClick={() => antesDeImprimir('ORCAMENTO')}>Orçamento PDF</Button>
          <Button icon={<CopyOutlined />} onClick={duplicar}>Duplicar</Button>
        </Space>}>
        {bloqueado && <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Obra concluída ou cancelada: os itens ficam como estão (o que mudou de preço entra como adicional e termo aditivo)." />}
        {!itens.length && obra.valorContratado ? <Alert type="info" showIcon style={{ marginBottom: 8 }} message={`Esta obra tem só o valor fechado (${brl(obra.valorContratado)}). Ao salvar itens, o total deles passa a ser o valor contratado.`} /> : null}
        <EditorItens itens={itens} bloqueado={bloqueado} onChange={i => { setItens(i); setMudou(true); }} />
      </Card>
      <Card size="small" title="Contrato"
        extra={<Button type="primary" icon={<FileTextOutlined />} onClick={() => antesDeImprimir('CONTRATO')}>Contrato completo (PDF)</Button>}>
        <Flex gap={8} align="center" wrap>
          {contrato?.estado === 'FEITO'
            ? <><Tag color="green">assinado{contrato.feitoEm ? ` em ${dataBr(contrato.feitoEm)}` : ''}</Tag><Button size="small" icon={<UndoOutlined />} onClick={() => marcarContrato(true)}>desmarcar</Button></>
            : <>
              <Tag color={contrato?.estado === 'ATRASADO' ? 'red' : 'default'}>{contrato?.estado === 'ATRASADO' ? 'a obra começou sem contrato assinado' : 'ainda não assinado'}</Tag>
              <Button size="small" icon={<CheckOutlined />} onClick={() => marcarContrato(false)}>Contrato assinado</Button>
            </>}
          <Text type="secondary" style={{ fontSize: 12 }}>
            As cláusulas vêm do modelo em Atendimento e pós-venda › Configuração (lá dá para mudar o texto, o foro e o responsável técnico).
            Para o contrato, complete a ficha do cliente (CPF/CNPJ, RG, estado civil, endereço).
          </Text>
        </Flex>
      </Card>
      <AditivosDaObra obra={obra} onMudou={onMudou} />
    </Space>
  );
};

// Ficha do poço › "Relatório para o cliente": confere o que falta (crítico e recomendável), escolhe as seções e as
// fotos, mostra a prévia e imprime (ou salva em PDF) para mandar ao cliente depois da obra.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Col, Empty, Flex, List, Modal, Row, Space, Spin, Tag, Typography, message } from 'antd';
import { CheckCircleTwoTone, PrinterOutlined, WarningOutlined } from '@ant-design/icons';
import {
  ConfigProcesso, ConjuntoDoPoco, conjuntoApi, ETAPAS_FOTO, PocoCompleto, processoApi, SERVICOS, TIPOS_FOTO_POCO, urlArquivo,
} from './obrasApi';
import { DadosRelatorioCliente, htmlRelatorioCliente, SecaoCliente, SECOES_CLIENTE, verificarRelatorio } from './relatorioCliente';

const { Text } = Typography;
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const RelatorioClienteModal: React.FC<{ aberto: boolean; ficha: PocoCompleto | null; onFechar: () => void }> = ({ aberto, ficha, onFechar }) => {
  const [conj, setConj] = useState<ConjuntoDoPoco | null>(null);
  const [config, setConfig] = useState<ConfigProcesso | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [secoes, setSecoes] = useState<Record<SecaoCliente, boolean>>(() => Object.fromEntries(SECOES_CLIENTE.map(s => [s.id, true])) as Record<SecaoCliente, boolean>);
  const [semFotos, setSemFotos] = useState<string[]>([]);   // fotos tiradas do relatório
  const quadro = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!aberto || !ficha) return;
    setCarregando(true);
    Promise.all([conjuntoApi.doPoco(ficha.poco.idPoco), processoApi.config().catch(() => null)])
      .then(([c, cfg]) => { setConj(c); setConfig(cfg); })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setCarregando(false));
  }, [aberto, ficha]);

  // fotos do poço (bomba, cabeça, quadro, local) e das obras (antes, durante, depois)
  const fotos = useMemo(() => [
    ...(conj?.fotos || []).map(f => ({ url: urlArquivo(f.url) || '', legenda: [TIPOS_FOTO_POCO[f.tipo], f.legenda].filter(Boolean).join(' · '), tipo: f.tipo })),
    ...(conj?.fotosDasObras || []).map(f => ({ url: urlArquivo(f.url) || '', legenda: [f.obra, ETAPAS_FOTO[f.etapa], f.legenda].filter(Boolean).join(' · '), tipo: 'OBRA' })),
  ].filter(f => f.url), [conj]);

  const dados: DadosRelatorioCliente | null = useMemo(() => {
    if (!ficha) return null;
    const p = ficha.poco;
    const a = conj?.atual;
    return {
      empresa: {
        nome: config?.empresaNome, documento: config?.empresaDocumento, telefone: config?.empresaTelefone || config?.empresaWhatsapp, email: config?.empresaEmail,
        endereco: config?.empresaEndereco, logo: config?.logo ? urlArquivo(config.logo) : null, textoGarantia: config?.textoGarantia,
        responsavelTecnico: config?.responsavelTecnico, registroTecnico: config?.registroTecnico,
      },
      poco: { identificacao: p.identificacao, endereco: p.endereco, bairro: p.bairro, cidade: p.cidade, uf: p.uf, latitude: p.latitude, longitude: p.longitude,
        profundidadeM: p.profundidadeM, diametro: p.diametro, vazaoLh: p.vazaoLh, nivelEstaticoM: p.nivelEstaticoM, nivelDinamicoM: p.nivelDinamicoM, dataPerfuracao: p.dataPerfuracao },
      cliente: ficha.proprietario ? { nome: ficha.proprietario.nome, telefone: ficha.proprietario.telefone, documento: ficha.proprietario.documento } : null,
      // só obras que valeram (em execução ou concluídas)
      servicos: ficha.contratos.filter(c => !['ORCAMENTO', 'CANCELADA'].includes(c.situacao)).map(c => ({
        titulo: c.titulo, servicos: c.servicos.map(s => SERVICOS[s] || s).join(', '), conclusao: c.dataTermino, garantiaAte: c.garantiaAte,
      })),
      estrutura: ficha.estrutura || null,
      conjunto: a ? { ...a } : null,
      ocorrencias: (ficha.ocorrencias || []).map(o => ({ rotulo: o.rotulo, vezes: o.vezes, ultimaVez: o.ultimaVez })),
      fotos: fotos.filter(f => !semFotos.includes(f.url)).map(f => ({ url: f.url, legenda: f.legenda })),
      hoje: hojeIso(),
    };
  }, [ficha, conj, config, fotos, semFotos]);

  const pendencias = dados ? verificarRelatorio(dados, { fotosDaBomba: fotos.filter(f => f.tipo === 'BOMBA' && !semFotos.includes(f.url)).length }) : [];
  const criticas = pendencias.filter(p => p.nivel === 'CRITICO');
  const html = dados ? htmlRelatorioCliente(dados, secoes) : '';

  const imprimir = () => {
    const janela = quadro.current?.contentWindow;
    if (!janela) return;
    const ir = () => { janela.focus(); janela.print(); };
    if (criticas.length) {
      Modal.confirm({
        title: `Falta ${criticas.length === 1 ? 'um item crítico' : `${criticas.length} itens críticos`}`,
        content: <ul style={{ paddingLeft: 18 }}>{criticas.map(c => <li key={c.texto}>{c.texto}</li>)}</ul>,
        okText: 'Gerar mesmo assim', cancelText: 'Voltar e completar', onOk: ir,
      });
    } else ir();
  };

  return (
    <Modal open={aberto} title={`Relatório para o cliente · ${ficha?.poco.identificacao || ''}`} width="min(1280px, 97vw)" onCancel={onFechar} destroyOnHidden
      footer={<Space><Button onClick={onFechar}>Fechar</Button><Button type="primary" icon={<PrinterOutlined />} disabled={!dados || carregando} onClick={imprimir}>Imprimir / salvar PDF</Button></Space>}>
      <Spin spinning={carregando}>
        <Row gutter={16}>
          <Col xs={24} lg={8}>
            <Flex vertical gap={10}>
              {/* verificação: o que falta antes de mandar */}
              {pendencias.length === 0
                ? <Alert type="success" showIcon icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} message="Tudo certo para mandar ao cliente." />
                : (
                  <Alert type={criticas.length ? 'error' : 'warning'} showIcon icon={<WarningOutlined />}
                    message={criticas.length ? `${criticas.length} item(ns) crítico(s) faltando` : 'Recomendado completar antes de mandar'}
                    description={(
                      <List size="small" dataSource={pendencias} renderItem={p => (
                        <List.Item style={{ padding: '3px 0' }}>
                          <Space direction="vertical" size={0}>
                            <Space size={4}><Tag color={p.nivel === 'CRITICO' ? 'red' : 'orange'} style={{ margin: 0, fontSize: 10 }}>{p.nivel === 'CRITICO' ? 'crítico' : 'aviso'}</Tag><Text>{p.texto}</Text></Space>
                            <Text type="secondary" style={{ fontSize: 11 }}>onde: {p.onde}</Text>
                          </Space>
                        </List.Item>
                      )} />
                    )} />
                )}
              <div>
                <Text strong>O que vai no relatório</Text>
                {SECOES_CLIENTE.map(s => (
                  <div key={s.id}><Checkbox checked={secoes[s.id]} onChange={e => setSecoes(x => ({ ...x, [s.id]: e.target.checked }))}>{s.titulo}</Checkbox></div>
                ))}
              </div>
              {secoes.fotos && (
                <div>
                  <Text strong>Fotos ({fotos.length - semFotos.length} de {fotos.length})</Text>
                  {fotos.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem fotos: envie em Bomba e instalação › Fotos." /> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                      {fotos.map(f => {
                        const fora = semFotos.includes(f.url);
                        return (
                          <div key={f.url} title={f.legenda} onClick={() => setSemFotos(l => (fora ? l.filter(x => x !== f.url) : [...l, f.url]))}
                            style={{ cursor: 'pointer', position: 'relative', opacity: fora ? 0.35 : 1, border: `2px solid ${fora ? 'transparent' : '#1677ff'}`, borderRadius: 6, overflow: 'hidden' }}>
                            <img src={f.url} alt="" style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} />
                            <div style={{ fontSize: 9, padding: '1px 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.legenda}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>Clique na foto para tirar ou pôr de volta.</Text>
                </div>
              )}
            </Flex>
          </Col>
          <Col xs={24} lg={16}>
            <iframe ref={quadro} title="Prévia do relatório" srcDoc={html} style={{ width: '100%', height: '72vh', border: '1px solid #e8e8e8', borderRadius: 6, background: '#fff' }} />
          </Col>
        </Row>
      </Spin>
    </Modal>
  );
};

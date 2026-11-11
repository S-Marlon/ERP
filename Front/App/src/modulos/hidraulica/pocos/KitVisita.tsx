// Kit de visita: os modelos em branco (proposta, tabela de preços, contrato, autorização de metragem adicional) com a
// pré-visualização A4 de cada um; marca os que vai levar e imprime todos de uma vez (ou só o que está vendo).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Flex, InputNumber, Row, Segmented, Space, Typography, message } from 'antd';
import { PrinterOutlined, SettingOutlined } from '@ant-design/icons';
import { ConfigProcesso, processoApi, urlArquivo } from './obrasApi';
import { htmlEmBranco, juntarPaginas, ModeloBranco, MODELOS_BRANCO, PADRAO_PROPOSTA, PadraoProposta, semImpressao } from './documentosEmBranco';
import { navPocos } from './navPocos';

const { Text } = Typography;

const imprimir = (html: string) => {
  const w = window.open('', '_blank');
  if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// O pacote padrão da proposta fica lembrado neste navegador (é só uma comodidade: vale o que estiver na tela)
const CHAVE_PADRAO = 'pocos.kit.padraoProposta';
const lerPadrao = (): { usar: boolean; valores: PadraoProposta } => {
  try { const s = JSON.parse(localStorage.getItem(CHAVE_PADRAO) || 'null'); if (s?.valores) return s; } catch { /* sem armazenamento */ }
  return { usar: false, valores: PADRAO_PROPOSTA };
};
const guardarPadrao = (p: { usar: boolean; valores: PadraoProposta }) => { try { localStorage.setItem(CHAVE_PADRAO, JSON.stringify(p)); } catch { /* sem armazenamento */ } };

const KitVisita: React.FC = () => {
  const [cfg, setCfg] = useState<ConfigProcesso | null>(null);
  const [vendo, setVendo] = useState<ModeloBranco>('PROPOSTA');
  const [marcados, setMarcados] = useState<ModeloBranco[]>(['PROPOSTA', 'TABELA']);
  const [padrao, setPadrao] = useState(lerPadrao);
  useEffect(() => { processoApi.config().then(setCfg).catch(e => message.error(e.message)); }, []);
  useEffect(() => guardarPadrao(padrao), [padrao]);

  const logo = cfg ? urlArquivo(cfg.logo) : null;
  const pacote = padrao.usar ? padrao.valores : null;
  const html = (id: ModeloBranco) => htmlEmBranco(id, cfg!, logo, pacote);
  const previa = useMemo(() => (cfg ? semImpressao(htmlEmBranco(vendo, cfg, logo, pacote)) : ''), [cfg, vendo, logo, pacote]);
  const valor = (k: keyof PadraoProposta, rotulo: string, props: object) => (
    <div style={{ flex: 1 }}><Text type="secondary" style={{ fontSize: 11 }}>{rotulo}</Text>
      <InputNumber size="small" min={0} style={{ width: '100%' }} value={padrao.valores[k]} {...props}
        onChange={v => setPadrao(p => ({ ...p, valores: { ...p.valores, [k]: v === null ? null : Number(v) } }))} /></div>
  );
  if (!cfg) return <Card loading />;

  const marcar = (id: ModeloBranco, sim: boolean) => setMarcados(m => (sim ? MODELOS_BRANCO.map(x => x.id).filter(x => x === id || m.includes(x)) : m.filter(x => x !== id)));
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!cfg.configurado && (
        <Alert type="info" showIcon message="Os modelos saem com o logo e os dados da empresa da configuração."
          action={<Button size="small" icon={<SettingOutlined />} onClick={() => navPocos.ir({ aba: 'atendimento', subvista: 'CONFIG' })}>Preencher</Button>} />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text type="secondary">Marque o que vai levar na visita. Clique num modelo para ver como ele sai na folha.</Text>
            {MODELOS_BRANCO.map(m => (
              <Card key={m.id} size="small" hoverable onClick={() => setVendo(m.id)}
                style={{ borderColor: vendo === m.id ? '#1677ff' : undefined, background: vendo === m.id ? '#f0f7ff' : undefined }}>
                <Flex gap={10} align="start">
                  <Checkbox checked={marcados.includes(m.id)} onClick={e => e.stopPropagation()} onChange={e => marcar(m.id, e.target.checked)} />
                  <div style={{ flex: 1 }}>
                    <Text strong>{m.titulo}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{m.descricao}</Text></div>
                    {m.id === 'PROPOSTA' && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                        <Segmented size="small" block value={padrao.usar ? 'PADRAO' : 'BRANCO'}
                          onChange={v => { setPadrao(p => ({ ...p, usar: v === 'PADRAO' })); setVendo('PROPOSTA'); }}
                          options={[{ value: 'BRANCO', label: 'Em branco' }, { value: 'PADRAO', label: 'Com o padrão' }]} />
                        {padrao.usar && (
                          <Flex gap={6} style={{ marginTop: 6 }}>
                            {valor('metros', 'Metragem', { suffix: 'm', max: 1000 })}
                            {valor('valorVista', 'À vista', { prefix: 'R$', step: 500 })}
                            {valor('valorParcelado', 'Parcelado', { prefix: 'R$', step: 500 })}
                          </Flex>
                        )}
                      </div>
                    )}
                  </div>
                </Flex>
              </Card>
            ))}
            <Button type="primary" block icon={<PrinterOutlined />} disabled={!marcados.length}
              onClick={() => imprimir(juntarPaginas(marcados.map(html)))}>
              Imprimir os marcados ({marcados.length})
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Os valores da tabela e o metro excedente da proposta vêm da planilha da empresa; o contrato segue o modelo da configuração.
            </Text>
          </Space>
        </Col>
        <Col xs={24} lg={16}>
          <Card size="small" title={`Pré-visualização (A4) · ${MODELOS_BRANCO.find(m => m.id === vendo)?.titulo}`}
            extra={<Button icon={<PrinterOutlined />} onClick={() => imprimir(html(vendo))}>Imprimir este</Button>}
            styles={{ body: { padding: 8, background: '#e5e7eb' } }}>
            {previa
              ? <iframe title="Pré-visualização do modelo" srcDoc={previa}
                style={{ width: '100%', maxWidth: 820, height: '78vh', display: 'block', margin: '0 auto', border: '1px solid #d1d5db', background: '#fff' }} />
              : <Empty />}
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default KitVisita;

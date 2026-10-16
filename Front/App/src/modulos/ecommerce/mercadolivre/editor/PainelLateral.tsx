// Painel lateral do editor: resumo do anúncio, ações no Mercado Livre (travadas enquanto há alterações não salvas),
// resultado da conferência/publicação e o que falta para publicar.
import React from 'react';
import { Alert, Badge, Button, Card, Divider, Flex, List, Popconfirm, Space, Tooltip, Typography } from 'antd';
import {
  CheckCircleFilled, CheckCircleOutlined, CloseCircleFilled, LoadingOutlined, ExclamationCircleFilled, LinkOutlined, PauseCircleOutlined, PlayCircleOutlined,
  DownloadOutlined, SafetyCertificateOutlined, SendOutlined, StopOutlined, WarningFilled,
} from '@ant-design/icons';
import { AnuncioDetalhe, ConferenciaItem, DivergenciasLinha, foraDoMl, formatarMoeda } from '../mercadoLivreApi';
import { PendenciaAgrupada, textoComPrimeiraMaiuscula } from '../pendencias';

const { Text } = Typography;

export type AcaoMl = 'conferir' | 'publicar' | 'enviar' | 'pausar' | 'reativar' | 'encerrar';

interface Props {
  det: AnuncioDetalhe;                                  // como está salvo
  temRascunho: boolean;
  ocupado: AcaoMl | null;
  conferencia: ConferenciaItem[] | null;
  falhas: { sku: string; erro: string }[];
  pendencias: PendenciaAgrupada[];
  onAcao: (acao: AcaoMl) => void;
  onPendencia: (p: PendenciaAgrupada) => void;
  divergencias?: DivergenciasLinha[] | null;            // ERP × ML dos itens publicados (null = conferindo)
  onTrazerPacote?: (linha: DivergenciasLinha) => void;   // grava no cadastro a embalagem que está no ML
}

const Linha: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <Flex justify="space-between" gap={8}><Text type="secondary">{rotulo}</Text><Text style={{ textAlign: 'right' }}>{children}</Text></Flex>
);

const PainelLateral: React.FC<Props> = ({ det, temRascunho, ocupado, conferencia, falhas, pendencias, onAcao, onPendencia, divergencias, onTrazerPacote }) => {
  const paraEnviar = (divergencias || []).filter(l => l.diferencas.some(d => d.enviavel));
  const soPainel = (divergencias || []).flatMap(l => l.diferencas.filter(d => !d.enviavel).map(d => ({ sku: l.sku, d })));
  const erros = pendencias.filter(p => p.nivel === 'erro').length;
  const vivos = det.itens.filter(i => i.ml.mlbId && !foraDoMl(i.ml.status));
  const travado = temRascunho ? 'Salve ou desfaça as alterações antes.' : undefined;
  const algumOcupado = ocupado !== null;

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }} title="Mercado Livre">
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Linha rotulo="Itens">{det.qtdItens}{det.publicados > 0 ? ` · ${det.publicados} no ML` : ''}{det.aPublicar && det.publicados ? ` · ${det.aPublicar} a publicar` : ''}</Linha>
          <Linha rotulo="Estoque que vai ao ML">{det.itens.reduce((s, i) => s + i.estoqueMl, 0)}</Linha>
          <Linha rotulo="Preço no ML">
            {det.precoMin === null ? '—' : det.precoMin === det.precoMax ? formatarMoeda(det.precoMin) : `${formatarMoeda(det.precoMin)} a ${formatarMoeda(det.precoMax)}`}
          </Linha>
          {det.itens[0]?.percentualComissao != null && (
            <Linha rotulo={`Comissão (${det.tipoAnuncio === 'gold_pro' ? 'Premium' : 'Clássico'})`}>{det.itens[0].percentualComissao}%</Linha>
          )}

          <Divider style={{ margin: '6px 0' }} />

          {det.aPublicar > 0 && (
            <>
              <Tooltip title={travado || 'O Mercado Livre confere cada item sem publicar nada (as fotos já sobem e ficam guardadas)'}>
                <Button block icon={<SafetyCertificateOutlined />} loading={ocupado === 'conferir'} disabled={!det.categoria || temRascunho || algumOcupado} onClick={() => onAcao('conferir')}>
                  Conferir no Mercado Livre
                </Button>
              </Tooltip>
              <Popconfirm
                title={`Publicar ${det.aPublicar} item(ns) no Mercado Livre?`}
                description={<div style={{ maxWidth: 320 }}>Cada item vira um anúncio público{det.modo === 'FAMILIA' && det.aPublicar > 1 ? ', juntos como variações' : ''}. Preço e estoque vão como estão aqui.</div>}
                okText="Publicar" onConfirm={() => onAcao('publicar')} disabled={erros > 0 || temRascunho}
              >
                <Tooltip title={travado || (erros ? 'Resolva o que está em vermelho em "O que falta".' : undefined)}>
                  <Button type="primary" block icon={<SendOutlined />} loading={ocupado === 'publicar'} disabled={erros > 0 || temRascunho || algumOcupado}>
                    Publicar {det.aPublicar > 1 ? `${det.aPublicar} itens` : ''} no ML
                  </Button>
                </Tooltip>
              </Popconfirm>
            </>
          )}

          {vivos.length > 0 && (
            <>
              <Tooltip title={travado || 'Manda aos itens que já estão no ML só o que está diferente: atributos, fotos, descrição e título'}>
                <Badge count={paraEnviar.length} size="small" style={{ width: '100%' }} title={`${paraEnviar.length} item(ns) diferente(s) do ML`}>
                  <Button block type={paraEnviar.length ? 'primary' : 'default'} icon={<SendOutlined />} loading={ocupado === 'enviar'} disabled={temRascunho || algumOcupado} onClick={() => onAcao('enviar')}>
                    Enviar atributos, fotos e descrição
                  </Button>
                </Badge>
              </Tooltip>
              {divergencias === null && <Text type="secondary" style={{ fontSize: 12 }}><LoadingOutlined /> comparando com o ML…</Text>}
              {divergencias && !paraEnviar.length && !soPainel.length && (
                <Text type="success" style={{ fontSize: 12 }}><CheckCircleOutlined /> Atributos, fotos e descrição iguais ao ML.</Text>
              )}
              {paraEnviar.length > 0 && (
                <Alert
                  type="warning" showIcon style={{ padding: '6px 10px' }}
                  message={<b>{paraEnviar.length} item(ns) diferente(s) do ML: clique em Enviar</b>}
                  description={(
                    <div style={{ fontSize: 12, maxHeight: 220, overflowY: 'auto' }}>
                      {paraEnviar.map(l => (
                        <div key={l.idLinha} style={{ marginBottom: 4 }}>
                          <b>{l.sku}</b>
                          {l.diferencas.filter(d => d.enviavel).map((d, k) => <div key={k}>• {d.texto}</div>)}
                          {l.pacoteMl && onTrazerPacote && (
                            <Tooltip title={`Grava no cadastro do item a embalagem que está no ML (${l.pacoteMl.alturaCm} × ${l.pacoteMl.larguraCm} × ${l.pacoteMl.comprimentoCm} cm, ${l.pacoteMl.pesoG} g), em vez de mandar a do ERP`}>
                              <Button size="small" type="link" icon={<DownloadOutlined />} style={{ padding: 0, height: 'auto', fontSize: 12 }} disabled={temRascunho || algumOcupado} onClick={() => onTrazerPacote(l)}>
                                Trazer embalagem do ML para o cadastro
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                />
              )}
              {soPainel.length > 0 && (
                <Alert
                  type="info" showIcon style={{ padding: '6px 10px' }}
                  message={`${soPainel.length} diferença(s) que só mudam pelo painel do ML`}
                  description={<div style={{ fontSize: 12, maxHeight: 160, overflowY: 'auto' }}>{soPainel.map((x, k) => <div key={k}><b>{x.sku}</b>: {x.d.texto}</div>)}</div>}
                />
              )}
              <Flex gap={8}>
                {vivos.some(i => i.ml.status === 'active') ? (
                  <Popconfirm title="Pausar no Mercado Livre?" description="Os anúncios deixam de aparecer e vender até você reativar." okText="Pausar" onConfirm={() => onAcao('pausar')} disabled={algumOcupado}>
                    <Button block icon={<PauseCircleOutlined />} loading={ocupado === 'pausar'} disabled={algumOcupado}>Pausar</Button>
                  </Popconfirm>
                ) : (
                  <Button block icon={<PlayCircleOutlined />} loading={ocupado === 'reativar'} disabled={algumOcupado} onClick={() => onAcao('reativar')}>Reativar</Button>
                )}
                <Popconfirm
                  title="Encerrar e excluir no Mercado Livre?" okText="Encerrar e excluir" okButtonProps={{ danger: true }} onConfirm={() => onAcao('encerrar')} disabled={algumOcupado}
                  description={<div style={{ maxWidth: 320 }}>Os {det.publicados} anúncio(s) são encerrados e excluídos no ML (lá não tem volta). Os itens voltam a "a publicar" aqui, para publicar de novo do jeito certo.</div>}
                >
                  <Button block danger icon={<StopOutlined />} loading={ocupado === 'encerrar'} disabled={algumOcupado}>Encerrar</Button>
                </Popconfirm>
              </Flex>
            </>
          )}
          {det.publicados > 0 && det.permalink && <Button block type="link" icon={<LinkOutlined />} href={det.permalink} target="_blank">Ver no Mercado Livre</Button>}

          {conferencia && (
            <Alert
              type={conferencia.every(c => c.ok) ? 'success' : 'warning'} showIcon style={{ marginTop: 4 }}
              message={conferencia.every(c => c.ok) ? 'O ML aceitou todos os itens.' : `O ML apontou problema em ${conferencia.filter(c => !c.ok).length} item(ns).`}
              description={conferencia.some(c => !c.ok) && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {conferencia.filter(c => !c.ok).map(c => (
                    <div key={c.idLinha ?? c.idItem} style={{ marginBottom: 6 }}><Text strong>{c.sku}</Text>{c.erros.map((e, k) => <div key={k} style={{ fontSize: 12 }}>• {e}</div>)}</div>
                  ))}
                </div>
              )}
            />
          )}
          {falhas.length > 0 && (
            <Alert type="error" showIcon message={`${falhas.length} item(ns) não subiram`}
              description={<div style={{ maxHeight: 200, overflowY: 'auto' }}>{falhas.map(f => <div key={f.sku} style={{ fontSize: 12 }}><b>{f.sku}</b>: {f.erro}</div>)}</div>} />
          )}
        </Space>
      </Card>

      <Card
        size="small"
        title={erros
          ? <Space><CloseCircleFilled style={{ color: '#cf1322' }} />O que falta ({erros})</Space>
          : <Space><CheckCircleFilled style={{ color: '#52c41a' }} />{det.aPublicar > 0 ? 'Pronto para publicar' : 'Tudo certo'}</Space>}
        styles={{ body: { maxHeight: 320, overflowY: 'auto', padding: '2px 12px' } }}
      >
        {pendencias.length === 0 ? <Text type="secondary" style={{ display: 'block', padding: '8px 0' }}>Nada pendente.</Text> : (
          <List
            size="small" dataSource={pendencias}
            renderItem={p => (
              <List.Item style={{ padding: '6px 0', cursor: 'pointer' }} onClick={() => onPendencia(p)}>
                <Space align="start" size={8}>
                  {p.nivel === 'erro' ? <ExclamationCircleFilled style={{ color: '#cf1322', marginTop: 4 }} /> : <WarningFilled style={{ color: '#faad14', marginTop: 4 }} />}
                  <div>
                    <Text style={{ fontSize: 13 }}>{textoComPrimeiraMaiuscula(p.texto)}</Text>
                    {p.skus.length > 0 && (
                      <Tooltip title={p.skus.slice(0, 25).join(', ') + (p.skus.length > 25 ? '…' : '')}>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{p.skus.length === 1 ? p.skus[0] : `${p.skus.length} itens`} · ver</Text></div>
                      </Tooltip>
                    )}
                  </div>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </>
  );
};

export default PainelLateral;

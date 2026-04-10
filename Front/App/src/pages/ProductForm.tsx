import React, { useEffect, useState } from 'react'

type MetodoPrecificacao = 'MARKUP' | 'MANUAL'
type TipoRegistro = 'PAI' | 'VARIACAO'

interface Variacao {
  nome: string
  codigo_barras: string
  preco_venda: number
  estoque: number
}

export default function ProductForm() {
  const [activeTab, setActiveTab] = useState('geral')
const [nfeData, setNfeData] = useState<NfeData | null>(null);

useEffect(() => {
  // simulação (substituir pela sua API/XML)
  const mock: NfeData = {
  invoiceNumber: '123',
  supplier: 'Fornecedor X',
  supplierFantasyName: 'Fornecedor X',
  supplierCnpj: '00000000000000',
  entryDate: new Date().toISOString(),
  accessKey: 'ABC',
  totalFreight: 0,
  totalIpi: 0,
  totalIcmsST: 0,
  totalOtherExpenses: 0,
  totalNoteValue: 100,

  items: [
    {
      tempId: 1,
      isMapped: false,
      isConfirmed: false,
      quantityReceived: 10,
      difference: 0,
      total: 100,

      sku: 'ABC123',
      gtin: '7890000000000',
      descricao: 'LUVA NBR WAVE Tamanho M',
      ncm: '40151900',
      cfop: '1102',
      unidadeMedida: 'UN',

      quantidade: 10,
      valorUnitario: 10,

      valorProdutos: 100,
      valorDesconto: 0,
      valorOutrasDespesas: 0,
      valorFrete: 0,

      valorIcms: 0,
      valorIpi: 0,
      valorIcmsST: 0,
      valorPis: 0,
      valorCofins: 0,

      valorTotalItem: 100,
      valorCustoReal: 10,

      origem: 0,
      valorTotalTributos: 0,
    }
  ]
}

  setNfeData(mock)
}, [])

  const [produto, setProduto] = useState({
    descricao: '',
    codigo_interno: '',
    codigo_barras: '',
    marca: '',
    categoria: '',
    tipo_produto: 'COMERCIAL',
    status: 'Ativo',

    preco_custo: 0,
    markup_praticado: 1,
    preco_venda_manual: 0,
    metodo_precificacao: 'MARKUP' as MetodoPrecificacao,

    estoque_minimo: 0,
    unidade: 'UN',

    peso: 0,
    altura: 0,
    largura: 0,
    comprimento: 0,

    sync_ecommerce: false,
    seo_title: '',
    slug: '',
    meta_description: '',
    description_html: '',
    imagem_url: '',

    tipo_registro: 'VARIACAO' as TipoRegistro,
  })

  const [temVariacoes, setTemVariacoes] = useState(false)
  const [variacoes, setVariacoes] = useState<Variacao[]>([])

  const precoFinal =
    produto.metodo_precificacao === 'MARKUP'
      ? produto.preco_custo * produto.markup_praticado
      : produto.preco_venda_manual

  // adicionar variação
  const adicionarVariacao = () => {
    setVariacoes([
      ...variacoes,
      { nome: '', codigo_barras: '', preco_venda: 0, estoque: 0 },
    ])
  }

  const atualizarVariacao = (index: number, field: string, value: any) => {
    const novas = [...variacoes]
    ;(novas[index] as any)[field] = value
    setVariacoes(novas)
  }

  const salvarProduto = () => {
    const payload = {
      produto: {
        ...produto,
        tipo_registro: temVariacoes ? 'PAI' : 'VARIACAO',
      },
      variacoes: temVariacoes ? variacoes : [],
    }

    console.log('SALVANDO:', payload)
    // aqui você chama sua API
  }

  const updateItem = (tempId: number, changes: Partial<ProductEntry>) => {
  if (!nfeData) return;

  const updatedItems = nfeData.items.map(item =>
    item.tempId === tempId ? { ...item, ...changes } : item
  );

  setNfeData({
    ...nfeData,
    items: updatedItems,
  });
};

  return (
    <div style={styles.container}>
      <h2>Cadastro de Produto</h2>

      {/* TABS */}
      <div style={styles.tabs}>
{['geral', 'comercial', 'estoque', 'ecommerce', 'variacoes', 'produtos_nf'].map(tab => (
              <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? styles.tabActive : styles.tab}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* GERAL */}
      {activeTab === 'geral' && (
        <div style={styles.section}>
          <input
            placeholder="Descrição"
            value={produto.descricao}
            onChange={e => setProduto({ ...produto, descricao: e.target.value })}
          />

          <input
            placeholder="Código interno"
            value={produto.codigo_interno}
            onChange={e =>
              setProduto({ ...produto, codigo_interno: e.target.value })
            }
          />

          <input
            placeholder="Código de barras"
            value={produto.codigo_barras}
            onChange={e =>
              setProduto({ ...produto, codigo_barras: e.target.value })
            }
          />
        </div>
      )}

      {/* COMERCIAL */}
      {activeTab === 'comercial' && (
        <div style={styles.section}>
          <select
            value={produto.metodo_precificacao}
            onChange={e =>
              setProduto({
                ...produto,
                metodo_precificacao: e.target.value as MetodoPrecificacao,
              })
            }
          >
            <option value="MARKUP">Markup</option>
            <option value="MANUAL">Manual</option>
          </select>

          <input
            type="number"
            placeholder="Preço custo"
            onChange={e =>
              setProduto({ ...produto, preco_custo: Number(e.target.value) })
            }
          />

          {produto.metodo_precificacao === 'MARKUP' && (
            <input
              type="number"
              placeholder="Markup"
              onChange={e =>
                setProduto({
                  ...produto,
                  markup_praticado: Number(e.target.value),
                })
              }
            />
          )}

          {produto.metodo_precificacao === 'MANUAL' && (
            <input
              type="number"
              placeholder="Preço manual"
              onChange={e =>
                setProduto({
                  ...produto,
                  preco_venda_manual: Number(e.target.value),
                })
              }
            />
          )}

          <strong>Preço final: R$ {precoFinal.toFixed(2)}</strong>
        </div>
      )}

      {/* ESTOQUE */}
      {activeTab === 'estoque' && (
        <div style={styles.section}>
          <input
            type="number"
            placeholder="Estoque mínimo"
            onChange={e =>
              setProduto({
                ...produto,
                estoque_minimo: Number(e.target.value),
              })
            }
          />

          <input
            placeholder="Unidade"
            onChange={e =>
              setProduto({ ...produto, unidade: e.target.value })
            }
          />
        </div>
      )}

      {/* ECOMMERCE */}
      {activeTab === 'ecommerce' && (
        <div style={styles.section}>
          <label>
            <input
              type="checkbox"
              checked={produto.sync_ecommerce}
              onChange={e =>
                setProduto({
                  ...produto,
                  sync_ecommerce: e.target.checked,
                })
              }
            />
            Sincronizar com e-commerce
          </label>

          <input
            placeholder="SEO Title"
            onChange={e =>
              setProduto({ ...produto, seo_title: e.target.value })
            }
          />

          <input
            placeholder="Slug"
            onChange={e =>
              setProduto({ ...produto, slug: e.target.value })
            }
          />

          <textarea
            placeholder="Descrição HTML"
            onChange={e =>
              setProduto({
                ...produto,
                description_html: e.target.value,
              })
            }
          />
        </div>
      )}

      {/* VARIAÇÕES */}
      {activeTab === 'variacoes' && (
        <div style={styles.section}>
          <label>
            <input
              type="checkbox"
              checked={temVariacoes}
              onChange={e => setTemVariacoes(e.target.checked)}
            />
            Produto possui variações
          </label>

          {temVariacoes && (
            <>
              <button onClick={adicionarVariacao}>
                + Adicionar variação
              </button>

              {variacoes.map((v, i) => (
                <div key={i} style={styles.card}>
                  <input
                    placeholder="Nome (ex: Tamanho M)"
                    onChange={e =>
                      atualizarVariacao(i, 'nome', e.target.value)
                    }
                  />

                  <input
                    placeholder="EAN"
                    onChange={e =>
                      atualizarVariacao(i, 'codigo_barras', e.target.value)
                    }
                  />

                  <input
                    type="number"
                    placeholder="Preço"
                    onChange={e =>
                      atualizarVariacao(i, 'preco_venda', Number(e.target.value))
                    }
                  />

                  <input
                    type="number"
                    placeholder="Estoque"
                    onChange={e =>
                      atualizarVariacao(i, 'estoque', Number(e.target.value))
                    }
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}


      {activeTab === 'produtos_nf' && (
  <div style={styles.section}>
    <h3 style={styles.sectionTitle}>📦 Produtos da Nota Fiscal</h3>

    {(nfeData?.items ?? []).map((item) => (
      <div key={item.tempId} style={styles.card}>

        {/* HEADER */}
        <div style={styles.cardHeader}>
          <strong>{item.descricao}</strong>
          <span>SKU: {item.sku}</span>
        </div>

        {/* DADOS PRINCIPAIS */}
        <div style={styles.grid}>
          <div>
            <label>Qtd</label>
            <input value={item.quantidade} readOnly style={styles.input} />
          </div>

          <div>
            <label>Custo Unit.</label>
            <input
              value={`R$ ${item.valorCustoReal.toFixed(2)}`}
              readOnly
              style={styles.input}
            />
          </div>

          <div>
            <label>Total</label>
            <input
              value={`R$ ${item.valorTotalItem.toFixed(2)}`}
              readOnly
              style={styles.input}
            />
          </div>

          <div>
            <label>NCM</label>
            <input value={item.ncm} readOnly style={styles.input} />
          </div>
        </div>

        {/* AÇÕES */}
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() =>
              updateItem(item.tempId, { isMapped: true })
            }
            style={styles.button}
          >
            🔗 Mapear existente
          </button>

          <button
            onClick={() =>
              updateItem(item.tempId, { isMapped: false })
            }
            style={styles.button}
          >
            🆕 Novo produto
          </button>
        </div>

        {/* MAPEAMENTO */}
        {item.isMapped && (
          <div style={styles.subSection}>
            <label>ID Produto existente</label>
            <input
              value={item.mappedId || ''}
              onChange={(e) =>
                updateItem(item.tempId, { mappedId: e.target.value })
              }
              style={styles.input}
            />
          </div>
        )}

        {/* NOVO PRODUTO */}
        {!item.isMapped && (
          <div style={styles.subSection}>
            <h4>Cadastro rápido</h4>

            <div style={styles.grid}>
              <input
  value={item.descricao}
  onChange={(e) =>
    updateItem(item.tempId, { descricao: e.target.value })
  }
/>
              <input
  value={item.gtin}
  onChange={(e) =>
    updateItem(item.tempId, { gtin: e.target.value })
  }
  style={styles.input}
/>

<input
  value={item.unidadeMedida}
  onChange={(e) =>
    updateItem(item.tempId, { unidadeMedida: e.target.value })
  }
  style={styles.input}
/>

<input
  value={item.ncm}
  onChange={(e) =>
    updateItem(item.tempId, { ncm: e.target.value })
  }
  style={styles.input}
/>
            </div>

            <div style={styles.grid}>
              <select style={styles.input}>
                <option value="MARKUP">Markup</option>
                <option value="MANUAL">Manual</option>
              </select>

              <input
                type="number"
                placeholder="Markup"
                defaultValue={1.5}
                style={styles.input}
              />

              <input
                type="number"
                placeholder="Preço venda"
                style={styles.input}
              />

              <input
                type="number"
                defaultValue={1}
                style={styles.input}
                placeholder="Fator conversão"
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <label>
                <input type="checkbox" /> Enviar para e-commerce
              </label>
            </div>
          </div>
        )}

        {/* CONFIRMAR */}
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() =>
              updateItem(item.tempId, { isConfirmed: true })
            }
            style={{
              ...styles.button,
              backgroundColor: '#16a34a',
              color: '#fff'
            }}
          >
            ✔ Confirmar item
          </button>
        </div>
      </div>
    ))}
  </div>
)}

      <button style={styles.saveButton} onClick={salvarProduto}>
        💾 Salvar Produto
      </button>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: 20,
    maxWidth: 800,
    margin: '0 auto',
  },
  tabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    padding: 10,
    background: '#eee',
    border: 'none',
    cursor: 'pointer',
  },
  tabActive: {
    padding: 10,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  card: {
    border: '1px solid #ccc',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  saveButton: {
    padding: 15,
    background: 'green',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
  },
}
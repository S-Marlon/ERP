import { useEffect, useState, useCallback, useMemo } from "react";
import { saveProductMapping } from '../../../api/productsApi';
import CategoryTree from "../../../Components/CategoryTree";
import Swal from 'sweetalert2';
import FormControl from "../../../../../components/ui/FormControl/FormControl";
import Badge from "../../../../../components/ui/Badge/Badge";
import Button from "../../../../../components/ui/Button/Button";
import { ProdutoNF } from "../../../utils/nfeParser";
import FlexGridContainer from "../../../../../components/Layout/FlexGridContainer/FlexGridContainer";
/* ======================================================
   INTERFACES (Alinhadas com o novo Parser)
====================================================== */

interface ProductEntry extends ProdutoNF {
    tempId: number;
    // ✅ Herda DIRETO do ProdutoNF (codigo, gtin, descricao, etc.)

    // ... todos os outros campos ProdutoNF
    isMapped?: boolean;
    isConfirmed?: boolean;

}

interface ProdutoPersistencia extends ProdutoNF {

    CodInterno: string;

    name: string;
    Categorias: string;
    Marca?: string;
    Descrição?: string;
    Margem_Lucro?: number;
    Preço_Final_de_Venda?: number;
    individualUnit: string;
    unitsPerPackage?: number | null; // ✅ Alinha com estado inicial

}


interface MappingModalProps {
    item: ProductEntry;
    supplierCnpj: string;
    onMap: (tempId: number, data: ProdutoPersistencia) => void;
    onClose: () => void;
}

const PACKAGING_UNITS = ["CX", "CXA", "CAIXA", "PCT", "PACOTE", "FD", "FARDO", "KIT", "RL"];

/* ======================================================
   Estilos
====================================================== */

// --- Estilos do Modal Principal ---
const modalStyles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        backdropFilter: 'blur(5px)'
    },
    modal: {
        backgroundColor: '#ffffff', borderRadius: '16px',
        width: '100%', maxWidth: '1900px', // Aumentado para acomodar a árvore lateral
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
    },
    header: {
        padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 3fr 1fr 2fr', // NF | Cadastro | Árvore | Margem e preço de venda
        gap: '5px',
        flex: 1,
        overflow: 'hidden'
    },
    sectionColumn: {
        padding: '24px',
        overflowY: 'auto',
        height: '100%',
        borderRight: '1px solid #f1f5f9'
    },
    footer: {
        padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
        display: 'flex', justifyContent: 'flex-end', gap: '12px'
    },
    inputLabel: {
        display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b',
        marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.025em'
    },
    modernInput: {
        width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
        fontSize: '0.9rem', marginBottom: '16px', outline: 'none', transition: 'all 0.2s'
    }
};

/* ======================================================
   COMPONENTE
====================================================== */

const ProductMappingModal: React.FC<MappingModalProps> = ({
    item, supplierCnpj, onMap, onClose
}) => {


    if (!item || !item.sku) {
        return <div>Carregando dados do produto...</div>;
    }


    /* ======================================================
           ESTADOS
        ====================================================== */


    // ✅ ESTADO PRINCIPAL: ProdutoPersistencia sincronizado
    const [produtoPersistencia, setProdutoPersistencia] = useState<ProdutoPersistencia>({
        ...item,
        CodInterno: "",
        sku: "",
        gtin: (item.gtin && item.gtin.trim() !== "" && !item.gtin.toUpperCase().includes("SEM GTIN"))
            ? item.gtin
            : "SEM GTIN",
        name: item.gtin,
        name: item.descricao || "",
        Categorias: "",
        Marca: "",
        Descrição: "",
        Margem_Lucro: 0,
        Preço_Final_de_Venda: 0,
        individualUnit: "",
        unitsPerPackage: null
    });

    // const [products, setProducts] = useState<ProductEntry[]>(() =>
    //   produtosNF.map((p, index) => ({
    //     tempId: index,
    //     produtoNF: p,
    //     sku: '',
    //     name: p.descricao,
    //     unitOfMeasure: p.unidadeMedida,
    //   }))
    // );


    // Se tiver GTIN, o padrão é ser ESPECÍFICO (false). Se não, GENÉRICO (true).


    // Estados necessários no seu componente pai
    const [categoriaPrefixo, setCategoriaPrefixo] = useState(""); // Ex: "MH"
    const [referencia, setReferencia] = useState(""); // Ex: "R1AT-04"
    const [marca, setMarca] = useState(""); // Ex: "GATES"


    const [isGeneric, setIsGeneric] = useState("");

    const [newProductId, setNewProductId] = useState("");
    const [newGtin, setNewGtin] = useState("");
    const [newProductSku, setNewProductSku] = useState("");
    const [newProductName, setNewProductName] = useState(item.descricao);
    const [newProductUnit, setNewProductUnit] = useState(item.unidadeMedida || "UN");

    const [newProductCategory, setNewProductCategory] = useState<string | null>(null);
    const [selectedCategoryShortName, setSelectedCategoryShortName] = useState<string | null>(null);

    const [inconsistencyError, setInconsistencyError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [individualUnit, setIndividualUnit] = useState<string>("");
    const [unitsPerPackage, setUnitsPerPackage] = useState<number | null>(null);

    const [descricaoDetalhada, setDescricaoDetalhada] = useState("");

    const isPackagingUnit = useMemo(() =>
        PACKAGING_UNITS.includes((item.unidadeMedida || item.unidadeMedida).toUpperCase()),
        [item]
    );

    const [margin, setMargin] = useState<number>(0); // Em porcentagem
    const [salePrice, setSalePrice] = useState<number>(0);



    // 1. Lógica para calcular a sugestão sem afetar o valor do input ainda
    const sugestaoCalculada = useMemo(() => {
        const ref = item.sku.trim().toUpperCase(); // Supondo que você tenha esse estado para a referência técnica
        const sigla = 'Lenz'//selectedSupplierSigla.trim().toUpperCase(); // A sigla do fornecedor que discutimos

        if (!ref) return "";

        // Se tiver sigla, monta REF/SIGLA. Se não, apenas REF.
        return sigla ? `${ref}/${sigla}` : ref;
    }, [item.sku,]); // Atualiza quando o SKU ou a Sigla mudarem


    // 2. Função para aplicar a sugestão ao campo
    const aplicarSugestao = () => {
        setNewProductSku(sugestaoCalculada);
    };


    /* ======================================================
       ESTADOS DE PRECIFICAÇÃO E MARCA
    ====================================================== */

    // Estados para Margem e Preço

    // Estados para Gestão de Marcas
    const [existingBrands, setExistingBrands] = useState<{ id: string, name: string }[]>([]); // Carregar da API se necessário
    const [selectedBrandId, setSelectedBrandId] = useState<string>("");
    const [newBrandName, setNewBrandName] = useState<string>("");



    /* ======================================================
       EFEITO PARA CARREGAR DADOS INICIAIS (OPCIONAL)
    ====================================================== */
    useEffect(() => {
        // Exemplo: Buscar marcas cadastradas ao abrir o modal
        // const fetchBrands = async () => { ... }
        // fetchBrands();
    }, []);

    /* ======================================================
       CÁLCULO FISCAL CENTRALIZADO (CRÍTICO)
    ====================================================== */

    const unitCostWithTaxes = useMemo(() => {
        const nf = item;  // ✅
        return nf.valorCustoReal ?? /* cálculo */ 0;
    }, [item]);


    /* ======================================================
         SINCRONIZAÇÃO DE CÓDIGO
      ====================================================== */
    // ✅ SINCRONIZA TODOS OS CAMPOS → ProdutoPersistencia
    useEffect(() => {
        setProdutoPersistencia({
            ...item, // ✅ Sempre mantém dados da NF
            CodInterno: newProductId || "",
            sku: newProductSku || "",
            gtin: newGtin || (item.gtin && item.gtin.trim() !== "" && !item.gtin.toUpperCase().includes("SEM GTIN"))
                ? item.gtin
                : "SEM GTIN",
            
            name: newProductName || item.descricao || "",
            Categorias: selectedCategoryShortName || newProductCategory || "Sem categoria",
            Marca: selectedBrandId === 'new' ? newBrandName :
                existingBrands.find(b => b.id === selectedBrandId)?.name || "",
            Descrição: descricaoDetalhada || item.descricao || "",
            Margem_Lucro: margin,
            Preço_Final_de_Venda: salePrice,
            individualUnit: individualUnit || "",
            unitsPerPackage: unitsPerPackage ?? null
        });
    }, [
        item, newProductId, newProductName, selectedCategoryShortName, newProductCategory,
        selectedBrandId, newBrandName, descricaoDetalhada, margin, salePrice,
        individualUnit, unitsPerPackage
    ]);

    useEffect(() => {
        if (!isGeneric) {
            // Prioriza GTIN no modo específico, se não houver, usa o SKU do fornecedor
            setNewBrandName(item.gtin || "SEM GTIN");
            setNewProductId(item.gtin || item.sku);
            setNewProductSku(item.sku);
        } else {
            setNewProductId(item.gtin || item.sku);
             setNewBrandName(item.gtin || "SEM GTIN");
            setNewProductId(item.gtin || item.sku);
            setNewProductSku(item.sku);

        }
    }, [isGeneric, item.sku, item.gtin]);


    useEffect(() => {
        if (!categoriaPrefixo || !referencia) return;

        const clean = (txt: string) => txt.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();

        const p = clean(categoriaPrefixo);
        const r = clean(referencia);
        const m = clean(marca);

        // Regra: Genérico (P-R) | Marca-Específico (P-R-M)
        const sugestao = isGeneric ? `${p}-${r}` : `${p}-${r}-${m}`;

        setNewProductSku(sugestao);
    }, [categoriaPrefixo, referencia, marca, isGeneric]);

    /* ======================================================
       VALIDAÇÃO DE CONSISTÊNCIA
    ====================================================== */

    // SE ean  campos são preenchidos automaticamente

    //   2-  Vínculo Direto (Histórico): CNPJ Fornecedor + Código do Produto no Fornecedor (SKU).

    //       3- Referência do Fabricante: Código de Fábrica. / criação primaria do produto

    useEffect(() => {
        // Regra de Ouro: Se possui GTIN/EAN, não pode ser genérico
        if (item.gtin && isGeneric) {
            setIsGeneric(false);
            return;
        }

        if (!newProductId) {
            setInconsistencyError(null);
            return;
        }

        

    }, [newProductId, isGeneric, item.sku, item.gtin]);

    /* ======================================================
         CONFIRMAÇÃO E SALVAMENTO
      ====================================================== */
    const handleFinalizeMapping = useCallback(async () => {
        if (!newProductId) {
            setInconsistencyError("O código do produto interno é obrigatório.");
            return;
        }

        const category = selectedCategoryShortName || newProductCategory || "Sem categoria";





        setIsSaving(true);

        if (!item) {
            Swal.fire("Erro", "Produto sem dados da NF.", "error");
            return;
        }

        try {
            const result = await Swal.fire({
                title: "Confirmar Vínculo de Produto",
                html: `<div style="font-family:Inter, Arial, sans-serif; font-size:1.1rem; color:#111827; text-align:left;">

  <p style="margin-bottom:14px;">
    Você está prestes a criar o seguinte vínculo:
  </p>

  <!-- ================= PRODUTO DA NOTA ================= -->
  <h3 style="margin-bottom:10px;">🧾 Produto da Nota Fiscal</h3>

  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px;">

    <!-- IDENTIFICAÇÃO -->
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:14px;">
      <div style="background:#dbeafe; color:#1e40af; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        Identificação
      </div>

      <small>SKU Do Fornecedor</small>
      <div>${item.sku || '—'}</div>

      <small>GTIN / EAN</small>
      <div>${item.gtin || 'SEM GTIN'}</div>

      <small>Descrição</small>
      <div>${item.descricao || '—'}</div>

      <small>NCM / CEST</small>
      <div>${item.ncm || '—'} / ${item.cest || '—'}</div>

      <small>CFOP / Origem</small>
      <div>${item.cfop || '—'} / ${item.origem || '—'}</div>
    </div>

    <!-- QUANTIDADES E VALORES -->
    <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:12px; padding:14px;">
      <div style="background:#ede9fe; color:#5b21b6; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        Quantidades & Valores
      </div>

      <small>Unidade</small>
      <div>${item.unidadeMedida || '—'}</div>

      <small>Quantidade</small>
      <div>${item.quantidade || '—'}</div>

      <small>Custo Unitário</small>
      <div>R$ ${item.valorUnitario?.toFixed(2) || '—'}</div>

      <small>Subtotal</small>
      <div>R$ ${item.valorProdutos?.toFixed(2) || '—'}</div>

      <small>Desconto</small>
      <div>R$ ${item.valorDesconto?.toFixed(2) || '—'}</div>

      <small>Frete / Outras</small>
      <div>
        R$ ${item.valorFrete?.toFixed(2) || '0,00'} /
        R$ ${item.valorOutrasDespesas?.toFixed(2) || '0,00'}
      </div>
    </div>

    <!-- TRIBUTOS -->
    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:14px;">
      <div style="background:#ffedd5; color:#9a3412; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        Tributos
      </div>

      <small>ICMS</small>
      <div>R$ ${item.valorIcms?.toFixed(2) || '—'}</div>

      <small>IPI</small>
      <div>R$ ${item.valorIpi?.toFixed(2) || '—'}</div>

      <small>ICMS ST</small>
      <div>R$ ${item.valorIcmsST?.toFixed(2) || '—'}</div>

      <small>PIS / COFINS</small>
      <div>
        R$ ${item.valorPis?.toFixed(2) || '—'} /
        R$ ${item.valorCofins?.toFixed(2) || '—'}
      </div>

      <small>IBS / CBS</small>
      <div>
        R$ ${item.valorIBS?.toFixed(2) || '0,00'} /
        R$ ${item.valorCBS?.toFixed(2) || '0,00'}
      </div>

      <small>Imposto Seletivo</small>
      <div>R$ ${item.valorImpostoSeletivo?.toFixed(2) || '0,00'}</div>
    </div>

    <!-- TOTAIS -->
    <div style="background:#f0fdf4; border:2px solid #86efac; border-radius:12px; padding:14px;">
      <div style="background:#dcfce7; color:#166534; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        Totais do Item
      </div>

      <small>Total de Tributos</small>
      <div style="font-weight:600;">
        R$ ${item.valorTotalTributos?.toFixed(2) || '—'}
      </div>

      <small>Total do Item</small>
      <div style="font-weight:800; font-size:1.05rem;">
        R$ ${item.valorTotalItem?.toFixed(2) || '—'}
      </div>

      <small>Custo Real</small>
      <div>
        R$ ${item.valorCustoReal?.toFixed(2) || '—'}
      </div>
    </div>

  </div>

  <!-- ================= VINCULO ================= -->
  <div style="
    text-align:center;
    margin:12px 0;
    font-weight:700;
    color:#4f46e5;
    font-size:0.95rem;
  ">
    🔗 VINCULAR AO PRODUTO INTERNO
  </div>

  <!-- ================= PRODUTO INTERNO ================= -->
<h3 style="margin-bottom:10px;">🏷️ Produto Interno</h3>

<div style="
  background:#f8fafc;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:16px;
">

  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px;">

    <!-- IDENTIFICAÇÃO -->
    <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:12px; padding:14px;">
      <div style="background:#e2e8f0; color:#334155; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        🧾 Identificação
      </div>

      <small>Gtin / EAN</small>
      <div style="font-weight:700;">${produtoPersistencia.gtin || '—aa'}</div>

      <small>Código Interno Gerado</small>
      <div style="font-weight:700;">${produtoPersistencia.CodInterno || '—'}</div>

      <small>Nome do Produto</small>
      <div>${produtoPersistencia.name || '—'}</div>

      <small>Categoria</small>
      <div>${produtoPersistencia.Categorias || '—'}</div>
    </div>

    <!-- UNIDADES -->
    <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:12px; padding:14px;">
      <div style="background:#e0e7ff; color:#3730a3; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        📦 Unidades
      </div>

      <small>Unidade Comercial</small>
      <div>${newProductUnit || '—'}</div>

      <small>Unidade Individual</small>
      <div>${produtoPersistencia.individualUnit || '—'}</div>

      <small>Qtd. por Embalagem</small>
      <div>${produtoPersistencia.unitsPerPackage || 1}</div>
    </div>

    <!-- MARCA & PREÇO -->
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:14px;">
      <div style="background:#dcfce7; color:#166534; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        💲 Marca & Preço
      </div>

      <small>Marca</small>
      <div>${produtoPersistencia.Marca || '—'}</div>

      <small>Margem de Lucro</small>
      <div>${produtoPersistencia.Margem_Lucro?.toFixed(1) || '10.0'}%</div>

      <small>Preço Final de Venda</small>
      <div style="font-weight:800; font-size:1rem;">
        R$ ${produtoPersistencia.Preço_Final_de_Venda?.toFixed(2) || '—'}
      </div>
    </div>

    <!-- STATUS -->
    <div style="background:#ecfeff; border:2px solid #67e8f9; border-radius:12px; padding:14px;">
      <div style="background:#cffafe; color:#155e75; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        ✔ Status do Produto
      </div>

      <div style="margin-top:6px; color:#16a34a; font-weight:800;">
        Produto Ativo
      </div>

      <div>Tipo: Produto Comercial</div>

      <div style="margin-top:6px; color:#166534;">
        Pronto para Venda
      </div>
    </div>

  </div>
</div>
`,
                icon: "info",
                showCancelButton: true,
                confirmButtonText: "Confirmar e Salvar",
                cancelButtonText: "Corrigir",
                confirmButtonColor: "#4f46e5",
                cancelButtonColor: "#6b7280",
                width: '2200px' // Um pouco mais largo para caber a tabela
            });

            if (result.isConfirmed) {
                // Montamos o payload esperado pela API
                const payload = {
                    original: item,               // Dados vindos da NF
                    mapped: produtoPersistencia,  // O seu estado com "p" minúsculo
                    supplierCnpj: supplierCnpj    // CNPJ do fornecedor
                };

                // Enviamos o payload (objeto) e não a Interface (tipo)
                console.log("Enviando payload:", payload); // Adicione este log para conferir
                await saveProductMapping(payload);

                // Notificamos o componente pai usando o estado atualizado
                onMap(item.tempId, payload);
                onClose();
            }
        } catch (error: any) {
            Swal.fire("Erro", error.message || "Falha ao salvar mapeamento", "error");
        } finally {
            setIsSaving(false);
        }
    }, [newProductId, newProductName, newProductUnit, newProductCategory, selectedCategoryShortName, item, supplierCnpj, individualUnit, unitsPerPackage, onMap, onClose]);
    /* ======================================================
       FINALIZAR NOVO PRODUTO
    ====================================================== */

    const handleFinalizeNewProductCreation = useCallback(() => {
        if (inconsistencyError) return;

        const category =
            selectedCategoryShortName ||
            newProductCategory ||
            "Sem categoria";

        confirmAndSend({
            original: {
                sku: item.sku,
                name: item.name,
                unitCost: unitCostWithTaxes
            },
            mapped: {
                id: newProductId.trim(),
                name: newProductName.trim(),
                category,
                unitOfMeasure: newProductUnit
            },
            supplierCnpj
        });
    }, [
        inconsistencyError,
        item,
        newProductId,
        newProductName,
        newProductUnit,
        newProductCategory,
        selectedCategoryShortName,
        supplierCnpj,
        unitCostWithTaxes
    ]);


    /* ======================================================
   CONTEÚDO DO MODAL (ESTRUTURA DE GRID)
====================================================== */

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>

                <header style={modalStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Mapeamento de Novo Produto</h3>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setIsGeneric(true)}
                                style={{
                                    ...tabButtonStyle,
                                    backgroundColor: isGeneric ? '#fff' : 'transparent',
                                    color: isGeneric ? '#f97316' : '#64748b',
                                    boxShadow: isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >Genérico/Misturável</button>
                            <button
                                onClick={() => setIsGeneric(false)}
                                style={{
                                    ...tabButtonStyle,
                                    backgroundColor: !isGeneric ? '#fff' : 'transparent',
                                    color: !isGeneric ? '#3b82f6' : '#64748b',
                                    boxShadow: !isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >Marca-Específico</button>
                        </div>
                    </div>
                    {inconsistencyError && (
                        <Badge color="danger">⚠️ {inconsistencyError}</Badge>
                    )}


                </header>

                <div style={modalStyles.contentGrid}>

                    {/* COLUNA 1: REFERÊNCIA NOTA FISCAL */}
                    <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#fcfcfd', width: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626' }}>📄</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Dados da Nota Fiscal</h4>
                        </div>

                        {/* Informações Básicas */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <FormControl label="GTIN / EAN" readOnlyDisplay value={item.gtin || 'SEM GTIN'} />
                            <FormControl label="SKU / Cód. Fornecedor" readOnlyDisplay value={item.sku || "---"} />
                            <FormControl label="Nome do Item na NF" readOnlyDisplay value={item.descricao} />
                        </div>

                        <hr style={{ border: '0', borderTop: '1px dashed #e2e8f0', margin: '16px 0' }} />

                        {/* Financeiro e Quantidade */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <FormControl label="Qtd. na NF" readOnlyDisplay value={item.quantidade || 0} />
                            <FormControl label="Unidade NF" readOnlyDisplay value={item.unidadeMedida || "---"} />
                        </div>

                        <FormControl
                            label="Preço Unit. Bruto"
                            readOnlyDisplay
                            value={`R$ ${item.valorUnitario.toFixed(2)}`}
                        />

                        {isPackagingUnit && (
                            <FormControl
                                label="Preço Unit. Bruto (Fracionado) "
                                readOnlyDisplay
                                value={`R$ ${(item.valorUnitario / item.quantidade).toFixed(2)}`}
                            />
                        )}


                        <hr style={{ border: '0', borderTop: '1px dashed #e2e8f0', margin: '16px 0' }} />

                        {/* Detalhamento de Impostos e Custo Real */}
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>IPI Unitário:</span>
                                <span style={{ fontWeight: 600 }}>R$ {(item.valorIpi || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>ICMS ST Unit.:</span>
                                <span style={{ fontWeight: 600 }}>R$ {(item.valorIcmsST || 0).toFixed(2)}</span>
                            </div>

                            {/* Alerta de Impostos Reforma 2026 */}
                            {(item.valorIBS > 0 || item.valorCBS > 0) && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#4338ca' }}>
                                        <span>IBS (Reforma):</span>
                                        <span style={{ fontWeight: 700 }}>R$ {item.valorIBS?.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#4338ca' }}>
                                        <span>CBS (Reforma):</span>
                                        <span style={{ fontWeight: 700 }}>R$ {item.valorCBS?.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '2px solid #fff' }}>
                                <FormControl
                                    label="Custo Unit. Real Final"
                                    readOnlyDisplay
                                    value={`R$ ${item.valorUnitario.toFixed(2)}`}
                                    style={{ marginBottom: 0 }}
                                />
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                    * Inclui impostos e rateio de despesas.
                                </p>
                            </div>
                        </div>

                        {/* Conversão de Embalagem */}

                    </aside>

                    {/* COLUNA 2: CADASTRO DO PRODUTO (SISTEMA) */}
                    <main style={modalStyles.sectionColumn}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#dcfce7', borderRadius: '6px', color: '#16a34a' }}>✏️</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Cadastro no Sistema</h4>
                        </div>

                        <FlexGridContainer layout="grid" template="1fr 1fr" gap="15px">

                            <FormControl
                                label={"Código de Barras (GTIN/EAN)"}
                                value={!item.gtin || item.gtin === "SEM GTIN" ? "SEM GTIN" : item.gtin}
                                readOnlyDisplay
                                onChange={(e) => setNewGtin(e.target.value)}
                            />

                            {/* ✅ CÓDIGO INTERNO */}
                            <div>

                                <span style={{ color: "black" }}>
                                    SKU do Fornecedor
                                </span>
                                <div className="sku-input-group">
                                    {/* Input da Referência Técnica */}
                                    <input
                                        type="text"
                                        className="sku-field"
                                        value={item.sku+'marca'}
                                        placeholder="Ex: R1AT-06"
                                    />

                                    {/* Sufixo Fixo e Visual */}
                                    <div className="sku-suffix">
                                        /{marca || "MutliConex"}
                                    </div>
                                </div>
                            </div>


                            <style>{`
       

      

        .sku-input-group {
          display: flex;
          align-items: stretch;
          border: 2px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          background: white;
          transition: border-color 0.2s;
        }

        .sku-input-group:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .sku-field {
          flex: 1;
          border: none;
          padding: 8px 12px;
          font-family: monospace;
          font-weight: bold;
          outline: none;
          font-size: 1rem;
          min-width: 0; /* Evita que o input quebre o flex */
        }

        .sku-suffix {
          display: flex;
          align-items: center;
          background-color: #f3f4f6;
          padding: 0 12px;
          color: #6b7280;
          font-family: monospace;
          font-weight: bold;
          border-left: 1px solid #d1d5db;
          user-select: none; /* Impede que o usuário selecione o sufixo como texto */
          white-space: nowrap;
        }

        
      `}</style>


                            <span>  </span>

                            <FormControl
                                label={"Código Interno / ID do Produto"}
                                value={item.sku}
                                placeholder={"Ex: PA-001"}
                                onChange={(e) => setNewSku(e.target.value)}
                            />


                            <div className="flex flex-col gap-1">


                            </div>
                        </FlexGridContainer>


                        {/* ✅ NOME PADRÃO */}
                        <FormControl
                            label="Nome Padrão em Estoque:"
                            value={newProductName}
                            onChange={e => setNewProductName(e.target.value)}
                            placeholder="Ex: Parafuso Sextavado Zincado 1/4"
                        />

                        {/* ✅ NCM/CEST (somente leitura) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <FormControl label="NCM" readOnlyDisplay value={item.ncm || "---"} />
                            <FormControl label="CEST" readOnlyDisplay value={item.cest || "---"} />
                        </div>

                        {/* ✅ DESCRIÇÃO DETALHADA (COM ESTADO) */}
                        <FormControl
                            label="Descrição Detalhada / Observações:"
                            control="textarea"
                            value={descricaoDetalhada}
                            onChange={(e) => setDescricaoDetalhada(e.target.value)}
                            placeholder="Informações técnicas para o time de vendas/estoque..."
                        />

                        {/* ✅ CONVERSÃO EMBALAGEM (CORRIGIDO) */}
                        {isPackagingUnit && (
                            <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '10px' }}>
                                    📦 Fator de Conversão
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <FormControl
                                        label="Qtd na Embalagem:"
                                        type="number"
                                        value={unitsPerPackage ?? ""}
                                        onChange={(e) => setUnitsPerPackage(e.target.value ? Number(e.target.value) : null)}
                                        placeholder="Ex: 12"
                                    />
                                    <FormControl
                                        label="Vender como:"
                                        control="select"
                                        value={individualUnit}
                                        onChange={(e) => setIndividualUnit(e.target.value)}
                                        options={[
                                            { label: "Unidade (UN)", value: "UN" },
                                            { label: "Quilo (KG)", value: "KG" },
                                            { label: "Metro (MT)", value: "MT" },
                                        ]}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ✅ MARCA (MANTER COMO ESTÁ) */}
                        <div style={{ marginTop: '16px', padding: '12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {/* ... código da marca igual ao original ... */}
                        </div>

                        {/* ✅ RESUMO VISUAL (NOVO) */}
                        <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '12px', border: '2px solid #0ea5e9' }}>
                            <h5 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>📋 Resumo Persistência</h5>
                            <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: '#1e293b' }}>
                                <div><strong>Gtin:</strong> {produtoPersistencia.gtin}</div>
                                <div><strong>Cód Interno:</strong> {produtoPersistencia.CodInterno}</div>
                                <div><strong>Cód Fornecedor:</strong> {produtoPersistencia.sku}</div>
                                <div><strong>Nome:</strong> {produtoPersistencia.name}</div>
                                <div><strong>Categoria:</strong> {produtoPersistencia.Categorias}</div>
                                <div><strong>Marca:</strong> {produtoPersistencia.Marca || '—'}</div>
                                <div><strong>Preço:</strong> R$ {produtoPersistencia.Preço_Final_de_Venda?.toFixed(2)}</div>
                                <div><strong>Margem:</strong> {produtoPersistencia.Margem_Lucro?.toFixed(2)}%</div>
                                <div><strong>Descrição:</strong> {produtoPersistencia.Descrição}</div>
                            </div>
                        </div>
                    </main>

                    {/* COLUNA 3: CATEGORIA */}
                    <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#0284c7' }}>🌳</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Classificação</h4>
                        </div>

                        <CategoryTree
                            selectedCategoryId={newProductCategory}
                            onSelectCategory={setNewProductCategory}
                            onCategoryNameChange={setSelectedCategoryShortName}
                        />
                    </aside>


                    {/* COLUNA 4: margem e preço de venda */}


                    <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#02c71cff' }}>🌳</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Precificação Unitária</h4>
                        </div>

                        {/* Simulador Principal: Unidade */}
                        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Venda por Unidade (Ex: Metro/Peça)
                            </div>

                            <FormControl
                                label="Margem de Lucro (%)"
                                type="number"
                                step={0.01}
                                value={margin}
                                onChange={(e) => {
                                    const m = Number(e.target.value);
                                    setMargin(m);
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage!) : item.valorCustoReal;
                                    setSalePrice(unitCost * (1 + m / 100));
                                }}
                                placeholder="Ex: 50"
                            />

                            <FormControl
                                label="Preço Final de Venda"
                                type="number"
                                step={0.01}
                                style={{ fontWeight: 'bold', color: '#1e293b' }}
                                value={salePrice.toFixed(2)}
                                onChange={(e) => {
                                    const p = Number(e.target.value);
                                    setSalePrice(p);
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage!) : item.valorCustoReal;
                                    if (unitCost > 0) {
                                        const rawMarkup = ((p - unitCost) / unitCost) * 100;
                                        setMargin(Number(rawMarkup.toFixed(2)));
                                    }
                                }}
                            />

                            <div style={{ margin: '15px 0', padding: '10px', background: '#000000ff', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '5px' }}>
                                    <span>Custo Unit. Base:</span>
                                    <span style={{ fontWeight: 600 }}>
                                        R$ {(unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal).toFixed(2)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#29d19cff' }}>
                                    <span>Lucro Bruto/Unid:</span>
                                    <span style={{ fontWeight: 600 }}>
                                        R$ {(salePrice - (unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal)).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <FormControl
                                label="Preço Final de Venda"
                                step={0.01}
                                type="number"
                                style={{ fontWeight: 'bold', color: '#1e293b' }}
                                value={salePrice.toFixed(2)}
                                onChange={(e: any) => {
                                    const p = Number(e.target.value);
                                    setSalePrice(p);

                                    // Calculate per-unit cost based on package size
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal;

                                    if (unitCost > 0) {
                                        // 1. Calculate the raw markup
                                        const rawMarkup = ((p - unitCost) / unitCost) * 100;

                                        // 2. Format to 2 decimals (returns string) and convert back to number
                                        const formattedMarkup = Number(rawMarkup.toFixed(2));

                                        setMargin(formattedMarkup);
                                    }
                                }}
                            />

                            {/* NOTA DINÂMICA: Projeção do Conjunto */}
                            <div style={{ marginTop: '15px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.1rem' }}>💡</span>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', lineHeight: '1.4' }}>
                                        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            Projeção para o Conjunto ({unitsPerPackage || 1} un):
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Valor total do pacote: <strong>R$ {(salePrice * (unitsPerPackage || 1)).toFixed(2)}</strong>
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Lucro total no pacote: <strong>R$ {((salePrice - (unitsPerPackage ? (item.valorUnitario / unitsPerPackage) : item.valorUnitario)) * (unitsPerPackage || 1)).toFixed(2)}</strong>
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', fontSize: '0.65rem', borderTop: '1px solid #fde68a', paddingTop: '4px' }}>
                                            O cálculo considera o custo real processado com impostos da NF.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </aside>
                </div>

                <footer style={modalStyles.footer}>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleFinalizeMapping}
                        disabled={!!inconsistencyError || !newProductId}
                        loading={isSaving}
                        variant="primary"
                        style={{ backgroundColor: '#4f46e5' }}
                    >
                        Salvar e Mapear Produto
                    </Button>
                </footer>
            </div>
        </div>
    );
};

const tabButtonStyle: React.CSSProperties = {
    padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s'
};

export default ProductMappingModal;
// TO-DO LISTA DE MELHORIAS FUTURAS:

// depois implementar o fluxo de criação de nova categoria hierárquica

// seletora de quantidade precisa ter medida (PC, UN, KG, LT, MT) e não só número, junto de padronização de acordo com a NF, ex: PC numero inteiros, MT com 2 casas decimais, KG com 3 casas decimais, LT com 3 casas decimais

// se Unidade de Medida for igual a cx (caixa), implementar lógica para quando adicionar ao estoque, perguntar quantas unidades vêm na caixa, e assim calcular o estoque corretamente

// implementar lógica para quando o usuário tentar criar um código que já existe no sistema, avisar que já existe e pedir para corrigir

// identificar Cód. EAN (13 dígitos numéricos) vs Código Genérico (outros formatos)

// melhorar a usabilidade da árvore de categorias, talvez com busca, e com scroll melhorado

import { useEffect, useState, useCallback, useMemo } from "react";
import { buscarProdutosExistentes, buscarSiglaNoBanco, saveProductMapping } from '../../../api/productsApi';
import CategoryTree from "../../../Components/CategoryTree";
import Swal from 'sweetalert2';
import FormControl from "../../../../../components/ui/FormControl/FormControl";
import Badge from "../../../../../components/ui/Badge/Badge";
import Button from "../../../../../components/ui/Button/Button";
import { ProdutoNF } from "../../../utils/nfeParser";
import FlexGridContainer from "../../../../../components/Layout/FlexGridContainer/FlexGridContainer";
import EcommerceGallery from "../../../../../components/ui/ImageGallery/EcommerceGallery";
import UrlManager from "../../../../../components/forms/UrlManager/UrlManager"
import PricingCalculator from "../../../../../components/Layout/PricingCalculator/PricingCalculator";
import StockDecomposition from "./StockDecomposition";
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
    pictureUrl?: string;
    // pictureUrls: string[]

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
        width: '100%', maxWidth: '2100px', // Aumentado para acomodar a árvore lateral
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
    },
    header: {
        padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff',
        display: 'grid', justifyContent: 'space-between', alignItems: 'center',
        gridTemplateColumns: '2fr 2fr 4fr 2fr', // NF | Cadastro | Árvore | Margem e preço de venda
        gap: '0px'
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 5fr 2fr', // NF | Cadastro | Árvore | Margem e preço de venda
        gap: '0px',
        justifyContent: 'space-between',
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
    headerContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
        padding: '24px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        borderRadius: '12px 12px 0 0',
    },
    topRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        margin: 0,
        color: '#0f172a',
        fontSize: '1.25rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
    },
    tabsWrapper: {
        display: 'flex',
        backgroundColor: '#f1f5f9',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content',
    },

    searchSection: {
        backgroundColor: '#f8fafc',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
    },
    fieldset: {
        border: 'none',
        padding: 0,
        margin: 0,
    },
    legend: {
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#475569',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    badgeContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginTop: '8px',
    },
    removeLinkBtn: {
        padding: '4px 8px',
        fontSize: '0.75rem',
        color: '#ef4444',
        background: '#fef2f2',
        border: '1px solid #fee2e2',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 600,
        transition: 'all 0.2s',
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
        name: item.descricao || "",
        Categorias: "",
        Marca: "",
        Descrição: "",
        Margem_Lucro: 0,
        Preço_Final_de_Venda: 0,
        individualUnit: "",
        unitsPerPackage: null,
        pictureUrl: "" // ✅ ADICIONE ISSO
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



const [imageList, setImageList] = useState<string[]>([]);
    const [showUrlManager, setShowUrlManager] = useState<boolean>(false);


    // Estados necessários no seu componente pai
    const [categoriaPrefixo, setCategoriaPrefixo] = useState(""); // Ex: "MH"
    const [referencia, setReferencia] = useState(""); // Ex: "R1AT-04"
    const [sigla, setSigla] = useState(""); // Aqui vai morar o "9AC5"

    const [ProdutoVinculado, setProdutoVinculado] = useState<object | null>(null); // Aqui vai morar o "9AC5"

const [decomposition, setDecomposition] = useState<DecompositionData>({
  mode: "NONE"
});

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

    const [newMargin, setNewMargin] = useState<number>(0); // Em porcentagem
    const [newSalePrice, setNewSalePrice] = useState<number>(item.valorUnitario);



    /* Estados para a busca */
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async (term: string) => {
        setSearchTerm(term);

        if (term.length > 2) {
            setIsLoading(true);
            const resultados = await buscarProdutosExistentes(term);
            setSearchResults(resultados);
            setShowDropdown(true);
            setIsLoading(false);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    };

    const handleSelectExisting = (prod: any) => {
        setProdutoVinculado(prod);

        // Opcional: Preencher os campos de input com os dados do produto selecionado
        // setNewProductId(prod.codigo_interno || prod.CodInterno);
        // setNewProductName(prod.descricao || prod.name);
        // setNewGtin(prod.codigo_barras || prod.gtin || "");

        setShowDropdown(false);
        setSearchTerm("");
    };



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
        if (supplierCnpj) {
            buscarSiglaNoBanco(supplierCnpj).then(siglaRecebida => {
                console.log("Sigla recebida via POST:", siglaRecebida);
                setSigla(siglaRecebida);
            });
        }
    }, [supplierCnpj]);

    useEffect(() => {
        if (produtoPersistencia.pictureUrl) {
            setImageList(produtoPersistencia.pictureUrl.split(","));
        }
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
            sku: `${newProductSku}/${sigla}`,
            gtin: newGtin || (item.gtin && item.gtin.trim() !== "" && !item.gtin.toUpperCase().includes("SEM GTIN"))
                ? item.gtin
                : "SEM GTIN",

            name: newProductName || item.descricao || "",
            Categorias: selectedCategoryShortName || newProductCategory || "Sem categoria",
            Marca: selectedBrandId === 'new' ? newBrandName :
                existingBrands.find(b => b.id === selectedBrandId)?.name || "",
            Descrição: descricaoDetalhada || item.descricao || "",
            Margem_Lucro: newMargin,
            Preço_Final_de_Venda: newSalePrice,
            individualUnit: individualUnit || "",
            unitsPerPackage: unitsPerPackage ?? null
        });
    }, [
        item, newProductId, newProductName, selectedCategoryShortName, newProductCategory,
        selectedBrandId, newBrandName, descricaoDetalhada, newMargin, newSalePrice,
        individualUnit, unitsPerPackage, sigla
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
        if (ProdutoVinculado != null) {
            setNewProductId((ProdutoVinculado as any).codigo_interno);
            setNewProductCategory((ProdutoVinculado as any).categoria);
        }
        else {
            setNewProductId(item.gtin || item.sku);
        }
    }, [ProdutoVinculado]);


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

        // ✅ CONSTRUIR LATEST PERSISTENCE ANTES DE CHAMAR MODAL
        // Isso garante que o modal sempre mostra os valores ATUAIS
        const latestPersistencia: ProdutoPersistencia = {
            ...item,
            CodInterno: newProductId || "",
            sku: `${newProductSku}/${sigla}`,
            gtin: newGtin || (item.gtin && item.gtin.trim() !== "" && !item.gtin.toUpperCase().includes("SEM GTIN"))
                ? item.gtin
                : "SEM GTIN",
            name: newProductName || item.descricao || "",
            Categorias: selectedCategoryShortName || newProductCategory || "Sem categoria",
            Marca: selectedBrandId === 'new' ? newBrandName :
                existingBrands.find(b => b.id === selectedBrandId)?.name || "",
            Descrição: descricaoDetalhada || item.descricao || "",
            Margem_Lucro: newMargin,
            Preço_Final_de_Venda: newSalePrice,
            individualUnit: individualUnit || "",
            unitsPerPackage: unitsPerPackage ?? null,
            pictureUrl: produtoPersistencia.pictureUrl || ""
        };

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
      <div style="font-weight:700;">${item.sku || '—'}</div>

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
      <div style="font-weight:700;">${latestPersistencia.gtin || '—'}</div>

      <small>Código Interno Gerado</small>
      <div style="font-weight:700;">${latestPersistencia.CodInterno || '—'}</div>

      <small>Código SKU fornecedor Armazenada</small>
      <div style="font-weight:700;">${latestPersistencia.sku || '—'}</div>

      <small>Nome do Produto</small>
      <div>${latestPersistencia.name || '—'}</div>

      <small>Categoria</small>
      <div>${latestPersistencia.Categorias || '—'}</div>
    </div>

    <!-- UNIDADES -->
    <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:12px; padding:14px;">
      <div style="background:#e0e7ff; color:#3730a3; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        📦 Unidades
      </div>

      <small>Unidade Comercial</small>
      <div>${newProductUnit || '—'}</div>

      <small>Unidade Individual</small>
      <div>${latestPersistencia.individualUnit || '—'}</div>

      <small>Qtd. por Embalagem</small>
      <div>${latestPersistencia.unitsPerPackage || 1}</div>
    </div>

    <!-- MARCA & PREÇO -->
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:14px;">
      <div style="background:#dcfce7; color:#166534; padding:6px 10px; border-radius:8px; font-weight:600; margin-bottom:10px;">
        💲 Marca & Preço
      </div>

      <small>Marca</small>
      <div>${latestPersistencia.Marca || '—'}</div>

      <small>Margem de Lucro</small>
      <div>${latestPersistencia.Margem_Lucro?.toFixed(2)}%</div>
     
      <small>Preço Final de Venda</small>
      <div style="font-weight:800; font-size:1rem;">
        R$ ${latestPersistencia.Preço_Final_de_Venda?.toFixed(2) || '—'}
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
                // ✅ Normaliza GTIN: "SEM GTIN" → vazio para evitar erro de constraint UNIQUE
                const mappedData = {
                    ...latestPersistencia,
                    gtin: latestPersistencia.gtin === "SEM GTIN" ? "" : latestPersistencia.gtin
                };

                // ✅ Montamos o payload esperado pela API
                const payload = {
                    original: item,
                    mapped: mappedData,
                    supplierCnpj: supplierCnpj
                };

                console.log("Enviando payload:", payload);
                await saveProductMapping(payload);

                // ✅ Notificamos o componente pai usando o objeto normalizado
                onMap(item.tempId, mappedData);
                onClose();
            }
        } catch (error: any) {
            Swal.fire("Erro", error.message || "Falha ao salvar mapeamento", "error");
        } finally {
            setIsSaving(false);
        }
    }, [
        newProductId,
        newProductName,
        newMargin,
        newSalePrice,
        newProductUnit,
        newProductCategory,
        selectedCategoryShortName,
        newProductSku,
        sigla,
        newGtin,
        selectedBrandId,
        newBrandName,
        existingBrands,
        descricaoDetalhada,
        individualUnit,
        unitsPerPackage,
        item,
        supplierCnpj,
        onMap,
        onClose
    ]);
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


    function handleSuggestedCode(): void {
        setNewProductId(item.sku);
    }

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>

                <header style={modalStyles.headerContainer}>
                    {/* Linha Superior: Título e Alternador de Tipo */}
                    <div style={modalStyles.topRow}>
                        <h3 style={modalStyles.title}>Mapeamento de Novo Produto</h3>


                        <fieldset style={modalStyles.fieldset}>
                            <legend style={modalStyles.legend}>
                                <span>🔍</span> Relacionar com Produto Existente
                            </legend>

                            <div style={{ position: 'relative' }}>
                                <FormControl
                                    value={searchTerm}
                                    placeholder="Pesquisar por Nome, ID ou GTIN..."
                                    onChange={(e) => handleSearch(e.target.value)}
                                // Adicione um estilo interno ao seu FormControl se puder
                                />

                                {isLoading && (
                                    <div style={{ position: 'absolute', right: '12px', top: '10px' }}>
                                        <small style={{ color: '#64748b' }}>Buscando...</small>
                                    </div>
                                )}

                                {showDropdown && searchResults.length > 0 && (
                                    <ul style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 5px)',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        zIndex: 1000,
                                        maxHeight: '280px',
                                        overflowY: 'auto',
                                        listStyle: 'none',
                                        padding: '4px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    }}>
                                        {searchResults.map((prod) => (
                                            <li
                                                key={prod.CodInterno}
                                                onClick={() => handleSelectExisting(prod)}
                                                style={{
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                                                    {prod.codigo_interno} - {prod.descricao}
                                                </span>
                                                <small style={{ color: '#64748b', marginTop: '2px' }}>
                                                    EAN: {prod.codigo_barras || 'N/A'} • Categoria: {prod.id_categoria || 'Geral'}
                                                </small>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </fieldset>
                        {/* Seção de Busca */}
                        <div style={modalStyles.searchSection}>


                            {/* Status do Vínculo */}
                            <div style={modalStyles.badgeContainer}>
                                {ProdutoVinculado ? (
                                    <>
                                        <Badge color="success">
                                            ✅ Vinculado: {(ProdutoVinculado as any).descricao}
                                        </Badge>
                                        <button
                                            onClick={() => setProdutoVinculado(null)}
                                            style={modalStyles.removeLinkBtn}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fef2f2')}
                                        >
                                            Remover vínculo
                                        </button>
                                    </>
                                ) : (
                                    <Badge color="warning">
                                        ⚠️ Aguardando seleção ou novo cadastro
                                    </Badge>
                                )}

                                {inconsistencyError && (
                                    <Badge color="danger">🚨 {inconsistencyError}</Badge>
                                )}
                            </div>
                        </div>
                    </div>


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

                        <hr style={{ border: '0', borderTop: '1px dashed #e2e8f0', margin: '8px 0' }} />

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


                    {/* COLUNA 2: CATEGORIA */}
                    <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#0284c7' }}>🌳</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Classificação</h4>
                        </div>

                        


<StockDecomposition
  value={decomposition}
  onChange={setDecomposition}
  nfQuantity={item.quantidade}
/>


                        <CategoryTree
                            selectedCategoryId={newProductCategory}
                            onSelectCategory={setNewProductCategory}
                            onCategoryNameChange={setSelectedCategoryShortName}
                        />

                        <div>
                            <h4>Afcionar Tags</h4>

                            
                        </div>
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
                                        value={newProductSku}
                                        onChange={(e) => setNewProductSku(e.target.value)}
                                        placeholder="Ex: R1AT-06"
                                    />

                                    {/* Sufixo Fixo e Visual */}
                                    <div className="sku-suffix">
                                        /{sigla}
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



                            {/* <fieldset>
    <legend style={{ marginBottom: '8px', fontWeight: '600', color: '#111827' }}>
        🔍 Relacionar com Produto Existente no Sistema
    </legend>

<div className="search-container" style={{ position: 'relative', marginBottom: '20px' }}>
    <FormControl
        label="Buscar Produto Existente (Nome, ID ou GTIN)"
        value={searchTerm}
        placeholder="Digite para pesquisar e apontar para um produto..."
        onChange={(e) => handleSearch(e.target.value)}
    />
    
    {isLoading && <small style={{color:'black'}}>Buscando no banco...</small>}

    {showDropdown && searchResults.length > 0 && (
        <ul style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            listStyle: 'none',
            padding: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            {searchResults.map((prod) => (
                <li 
                    key={prod.CodInterno}
                    onClick={() => selectProduct(prod)}
                    style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'black'
                    }}
                    className="search-item"
                >
                    <span style={{ fontWeight: 'bold' }}>{prod.codigo_interno} - {prod.descricao}</span>
                    <small style={{ color: '#666' }}>Categoria: {prod.id_categoria} | EAN: {prod.codigo_barras}</small>
                </li>
            ))}
        </ul>
    )}
</div>
</fieldset> */}


                            {/* Abaixo, o campo que recebe o valor final */}
                            <FormControl
                                label={"Código Interno / ID do Produto"}
                                value={newProductId}
                                readOnlyDisplay={ProdutoVinculado != null ? true : false}
                                placeholder={"Ex: PA-001"}
                                onChange={(e) => setNewProductId(e.target.value)}
                            />



                            {/* Criar logica para atribuir codigo interno do sistema */}

                            {/* Se o produto for novo apenas reeber o sku do fornecedor ou criar logica própia */}

                            {/* Se o produto existir fazer a busca no Banco de dados  */}

                            {/* <button className="btn btn-primary" onClick={() => handleSuggestedCode()}>
                                Receber Codigo Sugerido  ¬
                            </button> */}



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
                                <div><strong>pictureUrl:</strong> {produtoPersistencia.pictureUrl}</div>
                                <div><strong>Categoria:</strong> {produtoPersistencia.Categorias}</div>
                                <div><strong>Marca:</strong> {produtoPersistencia.Marca || '—'}</div>
                                <div><strong>Preço:</strong> R$ {produtoPersistencia.Preço_Final_de_Venda?.toFixed(2)}</div>
                                <div><strong>Margem:</strong> {produtoPersistencia.Margem_Lucro?.toFixed(2)}%</div>
                                <div><strong>Descrição:</strong> {produtoPersistencia.Descrição}</div>
                            </div>
                        </div>
                    </main>


                    {/* COLUNA 4: margem e preço de venda */}

                     <div>
                         <EcommerceGallery
  images={imageList}
  onValidationError={() => console.log('falha')}
/>

                        <UrlManager
                            imageList={imageList}
                            setImageList={setImageList}
                            formData={produtoPersistencia}
                            setFormData={setProdutoPersistencia}
                            show={showUrlManager}
                            setShow={setShowUrlManager}
                            styles={{
                                label: { fontSize: "12px", fontWeight: 600 },
                                input: {
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    padding: "4px 8px"
                                }
                            }}
                        />

                        <PricingCalculator
  initialData={{
    costPrice: item.valorCustoReal,
    salePrice: item.valorUnitario,
    unitsPerPackage: unitsPerPackage || 1
  }}
  onChange={(data) => {
    setNewMargin((data.markup - 1) * 100);
    setNewSalePrice(data.salePrice);

    setProdutoPersistencia(prev => ({
      ...prev,
      Margem_Lucro: (data.markup - 1) * 100,
      Preço_Final_de_Venda: data.salePrice,
      unitsPerPackage: data.unitsPerPackage
    }));
  }}
/>

                        
                     </div>

{/* 
                    <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#02c71cff' }}>🌳</div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Precificação Unitária</h4>
                        </div>

                        {/* Simulador Principal: Unidade 
                        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Venda por Unidade (Ex: Metro/Peça)
                            </div>



                            <FormControl
                                label="Margem de Lucro (%)"
                                type="number"
                                step={0.01}
                                value={newMargin}
                                onChange={(e) => {
                                    const m = Number(e.target.value);
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage!) : item.valorCustoReal;
                                    const newSale = unitCost * (1 + m / 100);
                                    setNewMargin(m);
                                    setNewSalePrice(newSale);
                                    setProdutoPersistencia(prev => ({
                                        ...prev,
                                        Margem_Lucro: m,
                                        Preço_Final_de_Venda: newSale
                                    }));
                                }}
                                placeholder="Ex: 50"
                            />


                            <FormControl
                                label="Markup (Fator)"
                                type="number"
                                step={0.01}
                                value={newMargin ? (1 + newMargin / 100).toFixed(2) : ''} // Exibe 1.50 se a margem for 50
                                onChange={(e) => {
                                    const f = Number(e.target.value); // Ex: 1.5
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal;

                                    // 1. Converte Markup para Margem Percentual: (Fator - 1) * 100
                                    const equivalentMargin = (f - 1) * 100;

                                    // 2. Calcula o novo preço de venda
                                    const newSale = unitCost * f;

                                    // 3. Atualiza todos os estados
                                    setNewMargin(Number(equivalentMargin.toFixed(2)));
                                    setNewSalePrice(newSale);
                                    setProdutoPersistencia(prev => ({
                                        ...prev,
                                        Margem_Lucro: equivalentMargin,
                                        Preço_Final_de_Venda: newSale
                                    }));
                                }}
                                placeholder="Ex: 1.5"
                            />

                            <FormControl
                                label="Preço Final de Venda"
                                step={0.01}
                                type="number"
                                style={{ fontWeight: 'bold', color: '#1e293b' }}
                                value={newSalePrice === null || newSalePrice === undefined ? '' : newSalePrice}
                                onChange={(e: any) => {
                                    const raw = e.target.value;
                                    const p = raw === '' ? 0 : Number(raw);
                                    // Calculate per-unit cost based on package size
                                    const unitCost = unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal;
                                    let formattedMarkup = newMargin;

                                    if (unitCost > 0 && raw !== '') {
                                        const rawMarkup = ((p - unitCost) / unitCost) * 100;
                                        formattedMarkup = Number(rawMarkup.toFixed(2));
                                        setNewMargin(formattedMarkup);
                                    }

                                    setNewSalePrice(p);
                                    setProdutoPersistencia(prev => ({
                                        ...prev,
                                        Margem_Lucro: formattedMarkup,
                                        Preço_Final_de_Venda: p
                                    }));
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
                                        R$ {(newSalePrice - (unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal)).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* NOTA DINÂMICA: Projeção do Conjunto *
                            <div style={{ marginTop: '15px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.1rem' }}>💡</span>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', lineHeight: '1.4' }}>
                                        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            Projeção para o Conjunto ({unitsPerPackage || 1} un):
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Valor total do pacote: <strong>R$ {(newSalePrice * (unitsPerPackage || 1)).toFixed(2)}</strong>
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Lucro total no pacote: <strong>R$ {((newSalePrice - (unitsPerPackage ? (item.valorCustoReal / unitsPerPackage) : item.valorCustoReal)) * (unitsPerPackage || 1)).toFixed(2)}</strong>
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', fontSize: '0.65rem', borderTop: '1px solid #fde68a', paddingTop: '4px' }}>
                                            O cálculo considera o custo real processado com impostos da NF.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </aside> */}
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

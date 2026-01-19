import { useEffect, useState, useCallback, useMemo } from "react";
import { searchProducts, fetchCategoriesRaw, saveProductMapping } from '../../../api/productsApi';
import CategoryTree from "../../../Components/CategoryTree";
import Swal from 'sweetalert2';
import FormControl from "../../../../../components/ui/FormControl/FormControl";
import SKUGenerator from "../../StockInventory/_components/SKUGenerator";
import Badge from "../../../../../components/ui/Badge/Badge";
import FlexGridContainer from "../../../../../components/Layout/FlexGridContainer/FlexGridContainer";
import Button from "../../../../../components/ui/Button/Button";



/* ======================================================
   INTERFACES
====================================================== */

interface ProductEntry {
    tempId: number;
    sku: string;
    name: string;
    unitOfMeasure: string;

    unitCost: number;
    unitCostWithRateio?: number;

    ipiValue?: number;
    icmsSTValue?: number;
    valorIBS?: number;
    valorCBS?: number;

    individualUnit?: string;
unitsPerPackage?: number;

}

interface InternalProductData {
    id: string;
    name: string;
    category: string;
    unitOfMeasure: string;
}

interface CategoryNode {
    name: string;
    fullName: string;
    parentId?: string;
}

export interface MappingPayload {
    original: {
        sku: string;
        name: string;
        unitCost: number;
    };
    mapped: {
         id: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  individualUnit?: string;
  unitsPerPackage?: number;

    };
    supplierCnpj: string;
}

interface MappingModalProps {
    item: ProductEntry;
    supplierCnpj: string;
    onMap: (tempId: number, data: MappingPayload) => void;
    onClose: () => void;
}


/* ======================================================
   Estilos
====================================================== */

// const tableThStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; color: black; font-size: 0.85rem;';
// const tableCellStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left; color: #333; font-size: 0.85rem;';
// const tableHeadStyleNF = 'background-color: #5a67d8; color: white;'; 
// const tableHeadStyleSys = 'background-color: #38a169; color: white;';


const PACKAGING_UNITS = [
  "CX", "CXA", "CAIXA",
  "PCT", "PACOTE",
  "FD", "FARDO",
  "KIT"
];






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
        width: '98%', maxWidth: '1400px', // Aumentado para acomodar a árvore lateral
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
        height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' 
    },
    header: {
        padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 3fr 2fr', // NF | Cadastro | Árvore
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
    item,
    supplierCnpj,
    onMap,
    onClose
}) => {

    /* ======================================================
       ESTADOS
    ====================================================== */

    const [isGeneric, setIsGeneric] = useState(true);
    const [newProductId, setNewProductId] = useState("");
    const [newProductName, setNewProductName] = useState(item.name);
    const [newProductUnit, setNewProductUnit] = useState(item.unitOfMeasure || "UN");

    const [newProductCategory, setNewProductCategory] = useState<string | null>(null);
    const [selectedCategoryShortName, setSelectedCategoryShortName] = useState<string | null>(null);

    const [inconsistencyError, setInconsistencyError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [individualUnit, setIndividualUnit] = useState<string>("");
const [unitsPerPackage, setUnitsPerPackage] = useState<number | null>(null);



    const isPackagingUnit = useMemo(() => {
  return PACKAGING_UNITS.includes(
    item.unitOfMeasure?.toUpperCase()
  );
}, [item.unitOfMeasure]);

    /* ======================================================
       CÁLCULO FISCAL CENTRALIZADO (CRÍTICO)
    ====================================================== */

    const unitCostWithTaxes = useMemo(() => {
        return (
            (item.unitCostWithRateio ?? item.unitCost ?? 0) +
            (item.ipiValue ?? 0) +
            (item.icmsSTValue ?? 0) +
            (item.valorIBS ?? 0) +
            (item.valorCBS ?? 0)
        );
    }, [item]);

    /* ======================================================
       SINCRONIZA SKU (GENÉRICO vs ESPECÍFICO)
    ====================================================== */

    useEffect(() => {
        if (!isGeneric) {
            setNewProductId(item.sku);
        } else {
            setNewProductId("");
        }
    }, [isGeneric, item.sku]);

    /* ======================================================
       VALIDAÇÃO DE CONSISTÊNCIA
    ====================================================== */

    useEffect(() => {
        if (!newProductId) {
            setInconsistencyError(null);
            return;
        }

        if (isGeneric && newProductId === item.sku) {
            setInconsistencyError(
                "Código genérico não pode ser igual ao SKU da NF."
            );
            return;
        }

        if (!isGeneric && newProductId !== item.sku) {
            setInconsistencyError(
                "Em modo específico, o código deve ser o SKU da NF."
            );
            return;
        }

        setInconsistencyError(null);
    }, [newProductId, isGeneric, item.sku]);

    /* ======================================================
       CONFIRMAÇÃO E SALVAMENTO
    ====================================================== */

    const confirmAndSend = async (payload: MappingPayload) => {
        const result = await Swal.fire({
            title: "Confirmar Mapeamento",
            icon: "info",
            width: 820,
            showCancelButton: true,
            confirmButtonText: "Salvar",
            cancelButtonText: "Revisar",
            confirmButtonColor: "#16a34a",
            preConfirm: async () => {
                try {
                    return await saveProductMapping(payload);
                } catch (err: any) {
                    Swal.showValidationMessage(err.message);
                }
            }
        });

        if (result.isConfirmed) {
            onMap(item.tempId, payload);
            await Swal.fire({
                icon: "success",
                title: "Mapeamento salvo!",
                timer: 1400,
                showConfirmButton: false
            });
            onClose();
        }
    };

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
    // --- RENDERS ---
    const renderNewProductForm = () => (
        <div style={modalStyles.contentGrid}>
            
            {/* COLUNA 1: REFERÊNCIA NOTA FISCAL */}
            <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#fcfcfd', width: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626' }}>📄</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Dados da Nota Fiscal</h4>
                </div>
                
                <FormControl label="SKU Original" readOnlyDisplay value={item.sku} />
                <FormControl label="Nome na NF" readOnlyDisplay value={item.name} />
                <FormControl label="Custo Unitário" readOnlyDisplay value={`R$ ${unitCostWithTaxes.toFixed(4)}`} />
                <FormControl label="Unidade de Medida" readOnlyDisplay value={item.unitOfMeasure} />

                {isPackagingUnit && (
  <>
    <FormControl
      label="Unidade do Item Individual"
      type="select"
      value={individualUnit}
      onChange={(e: any) => setIndividualUnit(e.target.value)}
      options={[
        { label: "Selecione", value: "" },
        { label: "Unidade (UN)", value: "UN" },
        { label: "Quilo (KG)", value: "KG" },
        { label: "Metro (M)", value: "M" },
        { label: "Litro (L)", value: "L" },
      ]}
    />

    <FormControl
      label="Quantidade por Embalagem"
      type="number"
      min={1}
      value={unitsPerPackage ?? ""}
      onChange={(e: any) =>
        setUnitsPerPackage(Number(e.target.value))
      }
      placeholder="Ex: 12"
    />
  </>
)}

                
                
                <div style={{ marginTop: '20px', padding: '15px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: '1.4' }}>
                        <strong>Nota:</strong> Estes dados são apenas para referência e não serão alterados no seu sistema.
                    </p>
                </div>
            </aside>

            {/* COLUNA 2: CADASTRO DO PRODUTO (EDIÇÃO) */}
            <main style={modalStyles.sectionColumn}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#dcfce7', borderRadius: '6px', color: '#16a34a' }}>✏️</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Informações do Produto no Sistema</h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
                    

                    
                    <div>
                        <FormControl 
                            label={isGeneric ? "Código Genérico (Interno)" : "Código Específico (EAN)"} 
                            readOnlyDisplay={!isGeneric}
                            value={isGeneric ? newProductId : item.sku} 
                            placeholder={isGeneric ? "Ex: PA-001" : "Ex: 1234567890123"} 
                            onChange={(e) => isGeneric && setNewProductId(e.target.value)}
                        />
                    </div>
                    
                </div>

                <FormControl label="Nome Padrão (Como aparecerá no seu estoque):"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    placeholder="Ex: Parafuso Sextavado Zincado 1/4"
                />

                <FormControl label="Descrição Detalhada / Observações:" control="textarea"
                    placeholder="Adicione informações técnicas adicionais..."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                    <FormControl label="NCM" readOnlyDisplay value="8481.80.19" />
                    <FormControl label="CEST" readOnlyDisplay value="01.001.00" />
                    <FormControl label="Origem" readOnlyDisplay value="0 - Nacional" />
                </div>
            </main>

            {/* COLUNA 3: CATEGORIA (ÁRVORE DEDICADA) */}
            <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#0284c7' }}>🌳</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Classificação Fiscal</h4>
                </div>
                
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '12px' }}>
                    Selecione a categoria hierárquica abaixo:
                </p>

                <div style={{ 
                    background: '#fff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    overflowY: 'auto'
                }}>
                    <CategoryTree 
                        selectedCategoryId={newProductCategory} 
                        onSelectCategory={setNewProductCategory} 
                        onCategoryNameChange={setSelectedCategoryShortName} 
                    />
                </div>
            </aside>
        </div>
    );

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
                                    padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                    backgroundColor: isGeneric ? '#fff' : 'transparent', color: isGeneric ? '#f97316' : '#64748b',
                                    boxShadow: isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >GENÉRICO</button>
                            <button 
                                onClick={() => setIsGeneric(false)}
                                style={{ 
                                    padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                    backgroundColor: !isGeneric ? '#fff' : 'transparent', color: !isGeneric ? '#3b82f6' : '#64748b',
                                    boxShadow: !isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >ESPECÍFICO</button>
                        </div>
                    </div>
                    {inconsistencyError && (
                         <Badge color="danger">⚠️ {inconsistencyError}</Badge>
                    )}
                </header>

                {renderNewProductForm()}

                <footer style={modalStyles.footer}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleFinalizeNewProductCreation}
                        disabled={!!inconsistencyError}
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

export default ProductMappingModal;
// TO-DO LISTA DE MELHORIAS FUTURAS:

// depois implementar o fluxo de criação de nova categoria hierárquica

// seletora de quantidade precisa ter medida (PC, UN, KG, LT, MT) e não só número, junto de padronização de acordo com a NF, ex: PC numero inteiros, MT com 2 casas decimais, KG com 3 casas decimais, LT com 3 casas decimais

// se Unidade de Medida for igual a cx (caixa), implementar lógica para quando adicionar ao estoque, perguntar quantas unidades vêm na caixa, e assim calcular o estoque corretamente

// implementar lógica para quando o usuário tentar criar um código que já existe no sistema, avisar que já existe e pedir para corrigir

// identificar Cód. EAN (13 dígitos numéricos) vs Código Genérico (outros formatos)

// melhorar a usabilidade da árvore de categorias, talvez com busca, e com scroll melhorado
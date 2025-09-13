import React from "react";
import { Product } from "../../../types/types";
import { FilterState } from "../../../types/types";
import ProductFilter from "./ProductFilter";
import ProductTable from "./ProductTable";
import ProductInfo from "./ProductInfo";

interface ProductContentProps {
  filters: FilterState;
  products: Product[];
  onFilterChange: (key: keyof FilterState, value: string | number | boolean) => void;
  onApplyFilter: () => void;
  selectedProduct?: Product;
  onSelectProduct: (product: Product) => void; // 🔹 novo
  onCloseInfo: () => void;
}

const ProductContent: React.FC<ProductContentProps> = ({
  filters,
  products,
  onFilterChange,
  onApplyFilter,
  selectedProduct,
  onSelectProduct,
  onCloseInfo,
}) => {

    

  return (
    <div className={selectedProduct ? `content-grid` : `content-grid-hide`}>
      <div className="product-filter">
        <ProductFilter
          filters={filters}
          onFilterChange={onFilterChange}
          onApply={onApplyFilter}
        />
      </div>

      <div className="product-table-wrapper">
        <ProductTable products={products} onSelectProduct={onSelectProduct} />

      </div>

      {selectedProduct && (
        <div className="product-info">
          <ProductInfo product={selectedProduct} onClose={onCloseInfo} />
        </div>
      )}
    </div>
  );
};

export default ProductContent;

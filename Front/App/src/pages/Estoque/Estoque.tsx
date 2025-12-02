// src/pages/EstoquePage.tsx
import React, { useState, useContext } from "react";
import ProductHeader from "./Components/ProductHeader";
import ProductFooter from "./Components/ProductFooter";
import ProductContent from "./Components/ProductContent";
import { Product, FilterState } from "../../types/types";
import "./Estoque.css";

import { ProductContext } from "../../context/ProductContext";
import EstoqueDashboard from "./pages/EstoqueDashboard";

const EstoquePage: React.FC = () => {
  const { products,  } = useContext(ProductContext)!;
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);

  const [filters, setFilters] = useState<FilterState>({
    status: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    minStock: "",
    maxStock: "",
    clientName: "",
    clientEmail: "",
    clientCpf: "",
    clientPhone: "",
    orderNumber: "",
    serviceType: "",
    date: "",
    paymentMethod: "",
  });

  const handleAddProduct = () => {
    console.log("Adicionar produto!");
    // Exemplo: setProducts([...products, novoProduto]);
  };

  const handleFilterChange = (
    key: keyof FilterState,
    value: string | number | boolean
  ) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
  };

  return (
    <div>
      <div className="page-header">

      <ProductHeader 
        totalProducts={products.length}
        foundProducts={products.length}
        onAddProduct={handleAddProduct}
        
      />

        
      </div>

<EstoqueDashboard />

      {/* <ProductContent
        filters={filters}
        products={products}
        onFilterChange={handleFilterChange}
        onApplyFilter={() => console.log("Aplicar filtros")}
        selectedProduct={selectedProduct}
        onCloseInfo={() => setSelectedProduct(undefined)}
        onSelectProduct={setSelectedProduct}
      /> */}

      <div className="page-footer">
      <ProductFooter
        totalProducts={products.length}
        foundProducts={products.length}
        onAddProduct={handleAddProduct}
      />
    </div>
    </div>
  );
};

export default EstoquePage;

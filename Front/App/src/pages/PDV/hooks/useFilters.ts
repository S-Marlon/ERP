// hooks/useFilters.ts
import { useState, useMemo } from 'react';

export interface FilterState {
  searchTerm: string;
  selectedCategory: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  status: string;
  brand: string;
  sortOrder: string;
  onlyInStock: boolean;
  onlyActive: boolean;
  currentPage: number;
  itemsPerPage: number;
}

export const useFilters = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [minPrice, setMinPrice] = useState('0');
  const [maxPrice, setMaxPrice] = useState('999999');
  const [minStock, setMinStock] = useState('');
  const [status, setStatus] = useState('Todos');
  const [brand, setBrand] = useState('Todos');
  const [sortOrder, setSortOrder] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const filters = useMemo(() => ({
    searchTerm: searchTerm || undefined,
    category: selectedCategory !== 'Todas' ? selectedCategory : undefined,
    page: currentPage,
    limit: itemsPerPage,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    minStock: minStock ? parseInt(minStock) : undefined,
    status: status !== 'Todos' ? status : undefined,
    brand: brand !== 'Todos' ? brand : undefined,
    sort: sortOrder || undefined,
    onlyInStock,
    onlyActive
  }), [
    searchTerm,
    selectedCategory,
    currentPage,
    itemsPerPage,
    minPrice,
    maxPrice,
    minStock,
    status,
    brand,
    sortOrder,
    onlyInStock,
    onlyActive
  ]);

  const handleResetFilters = () => {
    setMinPrice('0');
    setMaxPrice('999999');
    setMinStock('');
    setStatus('Todos');
    setBrand('Todos');
    setSelectedCategory('Todas');
    setSearchTerm('');
    setCurrentPage(1);
    setOnlyInStock(true);
    setOnlyActive(true);
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    minStock,
    setMinStock,
    status,
    setStatus,
    brand,
    setBrand,
    sortOrder,
    setSortOrder,
    onlyInStock,
    setOnlyInStock,
    onlyActive,
    setOnlyActive,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    filters,
    handleResetFilters
  };
};
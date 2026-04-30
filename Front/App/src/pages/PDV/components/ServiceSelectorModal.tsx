/**
 * ServiceSelectorModal
 * Modal profissional para seleção de serviços
 * Substitui o modal broken anterior com SweetAlert2 + DOM manipulation
 * - Organizado por categoria
 * - Com busca
 * - Com preview de preço
 * - UX consistente com resto do sistema
 */

import React, { useMemo, useState } from 'react';
import { CartItem } from '../types/cart.types';
import { SERVICE_CATALOG, groupServicesByCategory, ServiceItem } from '../constants/services';
import Modal from './Modal/Modal';
import styles from './ServiceSelectorModal.module.css';

interface ServiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (service: CartItem) => void;
  title?: string;
}

/**
 * Modal para seleção de serviços da OS
 * - Componente puro e testável
 * - Sem dependência de bibliotecas externas
 * - Busca integrada
 * - Filtro por categoria
 */
export const ServiceSelectorModal: React.FC<ServiceSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Adicionar Serviço',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoriesGrouped = useMemo(() => groupServicesByCategory(), []);
  const categories = Object.keys(categoriesGrouped);

  /**
   * Filtra serviços por busca e categoria
   */
  const filteredServices = useMemo(() => {
    let result = SERVICE_CATALOG;

    // Filtrar por categoria se selecionada
    if (selectedCategory) {
      result = result.filter(s => s.category === selectedCategory);
    }

    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term)
      );
    }

    return result;
  }, [searchTerm, selectedCategory]);

  /**
   * Converte ServiceItem para CartItem
   */
  const handleSelectService = (service: ServiceItem) => {
    const cartItem: CartItem = {
      id: service.id,
      name: service.name,
      price: service.price,
      quantity: 1,
      category: 'service',
      type: 'service',
      description: service.description,
    };

    onSelect(cartItem);
    onClose();
  };

  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      closeOnBackdrop
      closeOnEscape
    >
      <div className={styles.container}>
        {/* BUSCA */}
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="🔍 Buscar serviço..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
            autoFocus
          />
        </div>

        {/* CATEGORIAS (FILTRO) */}
        {categories.length > 1 && (
          <div className={styles.categoriesFilter}>
            <button
              className={`${styles.categoryButton} ${
                selectedCategory === null ? styles.categoryButtonActive : ''
              }`}
              onClick={() => setSelectedCategory(null)}
            >
              Todos ({SERVICE_CATALOG.length})
            </button>

            {categories.map(cat => (
              <button
                key={cat}
                className={`${styles.categoryButton} ${
                  selectedCategory === cat ? styles.categoryButtonActive : ''
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} ({categoriesGrouped[cat].length})
              </button>
            ))}
          </div>
        )}

        {/* LISTA DE SERVIÇOS */}
        <div className={styles.servicesList}>
          {filteredServices.length > 0 ? (
            filteredServices.map(service => (
              <button
                key={service.id}
                className={styles.serviceItem}
                onClick={() => handleSelectService(service)}
                type="button"
              >
                <div className={styles.serviceInfo}>
                  <div className={styles.serviceName}>{service.name}</div>
                  <div className={styles.serviceDescription}>{service.description}</div>
                  <div className={styles.serviceCategory}>{service.category}</div>
                </div>

                <div className={styles.servicePrice}>{money.format(service.price)}</div>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>Nenhum serviço encontrado</p>
              <small>Tente usar termos diferentes na busca</small>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ServiceSelectorModal;

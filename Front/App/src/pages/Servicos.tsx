import React, { useState } from 'react';
import ServiceFilter from '../components/ServiceFilter';
import ServiceItem from '../components/ServiceItem';
import { FilterState, ServiceItem as ServiceItemType } from '../types';
import './Servicos.css'; // Estilos específicos para a página

// Seus dados de exemplo ou a lógica para buscar dados de uma API
const mockServices: ServiceItemType[] = [
    {
        orderNumber: '01',
        clientName: 'Watson Johnson',
        clientDetails: 'tiua mae',
        status: 'Completo',
        day: 'Quarta',
        time: '16:48',
        date: '28/08/2025',
        items: [
            { quantity: 1, name: 'Item A', price: 5.00 },
            { quantity: 2, name: 'Item B', price: 5.99 },
        ],
        total: 16.98,
        tags: ['Lapis', 'Pssssai bill'],
        responsible: 'cleonardones',
    }, {
        orderNumber: '01',
        clientName: 'Watson Johnson',
        clientDetails: 'tiua mae',
        status: 'Completo',
        day: 'Quarta',
        time: '16:48',
        date: '28/08/2025',
        items: [
            { quantity: 1, name: 'Item A', price: 5.00 },
            { quantity: 2, name: 'Item B', price: 5.99 },
        ],
        total: 16.98,
        tags: ['Lapis', 'Pssssai bill'],
        responsible: 'cleonardones',
    }, {
        orderNumber: '01',
        clientName: 'Watson Johnson',
        clientDetails: 'tiua mae',
        status: 'Completo',
        day: 'Quarta',
        time: '16:48',
        date: '28/08/2025',
        items: [
            { quantity: 1, name: 'Item A', price: 5.00 },
            { quantity: 2, name: 'Item B', price: 5.99 },
        ],
        total: 16.98,
        tags: ['Lapis', 'Pssssai bill'],
        responsible: 'thgtrghbgr',
    },
    // ... mais serviços
];

// O componente Serv
// icesPage não precisa de props, a menos que você
// queira passar algo do layout principal.
const ServicesPage: React.FC = () => {
    const [filters, setFilters] = useState<FilterState>({
        clientName: '',
        clientEmail: '',
        clientCpf: '',
        clientPhone: '',
        orderNumber: '',
        status: '',
        serviceType: '',
        date: '',
        paymentMethod: '',
    });

    const [services, setServices] = useState<ServiceItemType[]>(mockServices);

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        setFilters(prevFilters => ({ ...prevFilters, [key]: value }));
    };

    const handleApplyFilter = () => {
        const filteredList = mockServices.filter(service => {
            return (
                service.clientName.toLowerCase().includes(filters.clientName.toLowerCase())
            );
        });
        setServices(filteredList);
    };

    const handleClearFilters = () => {
        setFilters({
            clientName: '',
            clientEmail: '',
            clientCpf: '',
            clientPhone: '',
            orderNumber: '',
            status: '',
            serviceType: '',
            date: '',
            paymentMethod: '',
        });
        setServices(mockServices);
    };

    return  (
        // Este é o container principal
        <div className="main-grid-container">
            {/* Coluna da esquerda: Filtro */}
            <div className="filter-sidebar">
                <ServiceFilter
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClear={handleClearFilters}
                    onApply={handleApplyFilter}
                />
            </div>

            {/* Coluna da direita: Lista de serviços */}
            <div className="services-container">
                {services.length > 0 ? (
                    services.map((service, index) => (
                        <ServiceItem key={index} service={service} />
                    ))
                ) : (
                    <p>Nenhum serviço encontrado com os filtros aplicados.</p>
                )}
            </div>
        </div>
    );

};

export default ServicesPage;
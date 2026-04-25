/**
 * EXPORTAÇÃO CENTRALIZADA DE TIPOS
 * Importar tudo daqui para manter consistência
 */

// Order Service
export type { OrderService, OSStatus, LaborCalculationType, HydraulicAssemblyConfig, OSLineItem, LaborCalculation, CreateOrderServiceInput, UpdateOrderServiceInput } from './order-service.types';

// Customer
export type { Customer, CustomerType, Address, Contact, CreateCustomerInput, UpdateCustomerInput } from './customer.types';

// Technician
export type { Technician, TechnicianRole, CreateTechnicianInput, UpdateTechnicianInput } from './technician.types';

// Payment
export type { Payment, PaymentMethod, PaymentStatus, SaleFinancialSummary, CreatePaymentInput, UpdatePaymentInput } from './payment.types';

// Sale
export type { Sale, SaleStatus, CreateSaleFromOrderInput, UpdateSaleInput } from './sale.types';

// Common
export type { ApiResponse, Result, PaginationParams, PaginatedResponse, DateRange, SortOrder, Notification, ValidationError, ValidationResult } from './common.types';

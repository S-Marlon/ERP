/**
 * types/models.ts
 * Modelos complexos e entidades de domínio
 * Use este arquivo para estruturas que não são primitivas
 */

// ========== ORDEM DE SERVIÇO MODELO ==========
export interface OSModel {
  number: string;
  config: {
    equipment: string;
    application?: string;
    gauge: string;
    layers?: string;
    finalLength: number;
  };
  items: any[];
  services: any[];
  montagens?: MontagemOS[];
  labor?: {
    type: 'fixed' | 'percent' | 'service' | 'per_point' | 'table';
    value: number;
  };
  totalAmount: number;
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}

export interface MontagemOS {
  name: string;
  items: any[];
  services: any[];
}

// ========== PDV CONTEXTO MODELO ==========
export interface OSDataModel {
  equipment?: string;
  application?: string;
  gauge?: string;
  layers?: string;
  finalLength?: string;
  laborType?: 'fixed' | 'percent' | 'service' | 'per_point' | 'table';
  laborValue?: number;
  selectedServiceId?: string;
}

// ========== PAGAMENTO MODELO ==========
export interface PaymentProcessor {
  id: string;
  name: string;
  handler: (payment: any) => Promise<any>;
}

// ========== CONFIGURAÇÃO PDV ==========
export interface PDVConfig {
  storeId: string;
  terminal: string;
  environment: 'development' | 'staging' | 'production';
  apiUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

// ========== VALIDAÇÃO ==========
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

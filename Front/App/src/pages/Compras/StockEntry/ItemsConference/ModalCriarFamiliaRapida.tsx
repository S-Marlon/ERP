import React, { useState } from "react";
import { Modal, Form, Input, Select, TreeSelect, message } from "antd";

interface ModalCriarFamiliaRapidaProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (novaFamilia: any) => void;
  dadosArvoreAntd: any[]; // Árvore de categorias globais para o TreeSelect
}

export const ModalCriarFamiliaRapida: React.FC<ModalCriarFamiliaRapidaProps> = ({
  visible,
  onCancel,
  onSuccess,
  dadosArvoreAntd,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Simulação de salvamento/requisição API
      // Substitua pelo seu método real de criação (ex: api.post('/familias', values))
      setTimeout(() => {
        setLoading(false);
        message.success(" Família criada com sucesso!");
        
        // Retorna os dados criados para atualizar o componente pai
        onSuccess({
          id: Date.now(), // ID temporário ou retornado pelo backend
          ...values,
        });

        form.resetFields();
        onCancel();
      }, 500);
    } catch (error) {
      console.error("Validação falhou:", error);
    }
  };

  return (
    <Modal
      title={
        <span style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>
          Criar Nova Família de Produtos
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      okText="Criar Família"
      cancelText="Cancelar"
      confirmLoading={loading}
      destroyOnClose
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "16px" },
        footer: { borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginTop: "16px" }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          unidadeMedidaBase: "PC",
          tipoItem: "PA",
        }}
      >
        {/* Nome da Família */}
        <Form.Item
          name="nome"
          label={<span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>Nome da Família</span>}
          rules={[{ required: true, message: "Por favor, informe o nome da família!" }]}
        >
          <Input 
            size="middle" 
            placeholder="Ex: Parafusos Sextavados Inox" 
            style={{ borderRadius: 8 }} 
          />
        </Form.Item>

        {/* Categoria de Vínculo */}
        <Form.Item
          name="categoriaPai"
          label={<span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>Categoria de Vínculo (Árvore Global)</span>}
        >
          <TreeSelect
            size="middle"
            style={{ width: "100%" }}
            treeData={dadosArvoreAntd}
            dropdownStyle={{ maxHeight: 300, overflow: "auto" }}
            placeholder="Selecione a categoria..."
            showSearch
            treeNodeFilterProp="title"
            allowClear
          />
        </Form.Item>

        {/* Linha dupla: Unidade Base e Tipo SPED */}
        <div style={{ display: "flex", gap: "12px" }}>
          <Form.Item
            name="unidadeMedidaBase"
            label={<span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>Unidade Base</span>}
            style={{ flex: 1 }}
          >
            <Select
              size="middle"
              options={[
                { value: "PC", label: "PC - Peça" },
                { value: "UN", label: "UN - Unidade" },
                { value: "MM", label: "MM - Milímetro" },
                { value: "MT", label: "MT - Metro" },
                { value: "KG", label: "KG - Quilograma" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="tipoItem"
            label={<span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>Tipo SPED</span>}
            style={{ flex: 1 }}
          >
            <Select
              size="middle"
              options={[
                { value: "PA", label: "PA - Acabado" },
                { value: "MP", label: "MP - Matéria-Prima" },
                { value: "KT", label: "KT - Kit / Combo" },
              ]}
            />
          </Form.Item>
        </div>

        {/* NCM Padrão */}
        <Form.Item
          name="ncmPadrao"
          label={<span style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>NCM Padrão (Opcional)</span>}
        >
          <Input 
            size="middle" 
            placeholder="0000.00.00" 
            style={{ borderRadius: 8 }} 
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
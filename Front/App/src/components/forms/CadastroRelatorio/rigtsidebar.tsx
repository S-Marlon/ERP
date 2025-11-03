import React, { useState } from 'react';
import Card from '../../ui/Card/Card';
import Typography from '../../ui/Typography/Typography';
import Button from '../../ui/Button/Button';
import FormControl from '../../ui/FormControl/FormControl';
const Column: React.FC = () => {

    const [showBombeamento, setShowBombeamento] = useState(false);


    return (
       <div className="coluna-secundaria">

                    {/* COLUNA SECUNDÁRIA (3fr) */}
                    <div className="coluna-secundaria">

                        {/* CARD 1: AÇÕES PRINCIPAIS E EDIÇÃO DE METADADOS */}
                        <Card >
                            <Typography variant="h2Alt">Ações Essenciais</Typography>

                            
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📊 Registrar Testes Hidráulicos de Campo {/* Ação de registro de dados */}
                            </Button>

                            <Typography variant="h3" >Documentação e Mídia</Typography>

                            
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📁 Anexar Documentos/Laudos
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📸 Adicionar Fotos/Mídias
                            </Button>
                        </Card>


                        {/* CARD 3: INFORMAÇÕES TÉCNICAS E MONITORAMENTO (Menos Frequentes) */}
                        <Card>
                            <Typography variant="h2Alt">Dados Técnicos e Históricos</Typography>

                            {/* DADOS DETALHADOS E HISTÓRICOS */}
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                Perfil geológico detalhado
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                documentação técnica do poço
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                análises de qualidade da água
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                monitoramento de níveis e vazões
                            </Button>

                           
                            
                            
                           
                        </Card>

                        {/* AÇÕES DE RISCO (MANTIDAS FORA DO CARD PRINCIPAL OU COM VISUAL DIFERENCIADO) */}
                        <Card style={{ marginTop: 20, backgroundColor: '#ffe6e6', border: '1px solid #ff4d4f' }}>
                            <Typography variant="h2Alt" style={{ color: '#ff4d4f' }}>Zona de Risco</Typography>
                            <Button type="button" variant="danger" style={{ width: '100%', marginBottom: 10 }}>
                                🗑️ Excluir Relatório do Poço
                            </Button>
                        </Card>

                    </div>




                    {/* CARD DE BOMBEAMENTO E TESTES (toggle) */}
                    <Card>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setShowBombeamento(!showBombeamento)}
                            style={{ width: "100%", marginBottom: showBombeamento ? 15 : 0 }}
                        >
                            {showBombeamento ? '➖ Ocultar' : '➕ Adicionar'} Conjunto de Bombeamento
                        </Button>
                        {showBombeamento && (
                            <fieldset style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                                <legend style={{ fontWeight: 'bold', padding: '0 10px' }}>Detalhes da Instalação</legend>
                                <Typography variant="h4" >Detalhes da Bomba</Typography>
                                <div className="form-row">
                                    <FormControl label="Marca" name="marcaBomba" value={formData.marcaBomba} onChange={handleChange} placeholder="Grundfos, Leão" />
                                    <FormControl label="Modelo" name="modeloBomba" value={formData.modeloBomba} onChange={handleChange} placeholder="SP 5A-18" />
                                </div>
                                <div className="form-row">
                                    <FormControl label="Profundidade (m)" name="profundidadeBombaMetros" type="number" value={formData.profundidadeBombaMetros} onChange={handleChange} placeholder="60.00" min={0} />
                                    <FormControl label="Data Instalação" name="dataInstalacaoBomba" type="date" value={formData.dataInstalacaoBomba} onChange={handleChange} />
                                </div>
                                <Typography variant="h4" >Testes de Campo</Typography>
                                <div className="form-row">
                                    <FormControl label="Vazão (m³/h)" name="vazaoTesteM3Hora" type="number" value={formData.vazaoTesteM3Hora} onChange={handleChange} placeholder="5.2" min={0} />
                                    <FormControl label="Nível Estático (m)" name="nivelEstaticoTesteMetros" type="number" value={formData.nivelEstaticoTesteMetros} onChange={handleChange} placeholder="45.00" min={0} />
                                    <FormControl label="Nível Dinâmico (m)" name="nivelDinamicoTesteMetros" type="number" value={formData.nivelDinamicoTesteMetros} onChange={handleChange} placeholder="55.50" min={0} />
                                </div>
                            </fieldset>
                        )}
                    </Card>
                </div>
    );
};
export default Column;
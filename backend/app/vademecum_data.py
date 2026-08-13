# backend/app/vademecum_data.py
"""
Base de datos prefijada de Vademécum de uso frecuente en Argentina (ANMAT/Kairos).
Contiene Monodroga, Nombre Comercial, Presentación y Dosis Sugerida.
"""

VADEMECUM_BASE = [
    # Analgésicos / Antiinflamatorios / Antipiréticos
    {
        "id": 1,
        "nombre_comercial": "Tafirol 500mg / 1g",
        "monodroga": "Paracetamol",
        "presentacion": "Comprimidos 500mg / 1000mg",
        "dosis_sugerida": "1 comprimido cada 8 horas según dolor o fiebre"
    },
    {
        "id": 2,
        "nombre_comercial": "Ibupirac 400mg / 600mg",
        "monodroga": "Ibuprofeno",
        "presentacion": "Comprimidos / Cápsulas blandas 400mg / 600mg",
        "dosis_sugerida": "1 comprimido cada 8 horas con alimentos"
    },
    {
        "id": 3,
        "nombre_comercial": "Actron 600 Rapid",
        "monodroga": "Ibuprofeno",
        "presentacion": "Cápsulas blandas 600mg",
        "dosis_sugerida": "1 cápsula cada 8 horas tras las comidas"
    },
    {
        "id": 4,
        "nombre_comercial": "Voltaren 50mg / 75mg",
        "monodroga": "Diclofenac Sódico",
        "presentacion": "Comprimidos 50mg / Ampollas 75mg",
        "dosis_sugerida": "1 comprimido cada 12 horas"
    },
    {
        "id": 5,
        "nombre_comercial": "Sertal Compuesto",
        "monodroga": "Propinoxilato + Clonixinato de Lisina",
        "presentacion": "Comprimidos / Gotas",
        "dosis_sugerida": "1 comprimido cada 8 horas en dolor espasmódico"
    },
    {
        "id": 6,
        "nombre_comercial": "Buscapina Fem / Buscapina Compositum",
        "monodroga": "Hioscina N-Butilbromuro + Paracetamol",
        "presentacion": "Comprimidos recubiertos",
        "dosis_sugerida": "1-2 comprimidos cada 8 horas"
    },
    {
        "id": 7,
        "nombre_comercial": "Ketorolac 10mg / 20mg (Sublingual)",
        "monodroga": "Ketorolac",
        "presentacion": "Comprimidos sublinguales 10mg / 20mg",
        "dosis_sugerida": "1 comprimido sublingual cada 6-8 horas (máx 5 días)"
    },
    {
        "id": 8,
        "nombre_comercial": "Nolotil / Novalgina",
        "monodroga": "Dipirona (Metamizol)",
        "presentacion": "Comprimidos 500mg / Jarabe / Ampollas",
        "dosis_sugerida": "1 comprimido o 20-40 gotas cada 6-8 horas"
    },
    {
        "id": 9,
        "nombre_comercial": "Tramal 50mg",
        "monodroga": "Tramadol Clorhidrato",
        "presentacion": "Cápsulas 50mg / Gotas",
        "dosis_sugerida": "1 cápsula cada 8-12 horas según dolor severo"
    },

    # Antibióticos / Antimicrobianos
    {
        "id": 10,
        "nombre_comercial": "Amoxidal 500mg / 875mg / 1g",
        "monodroga": "Amoxicilina",
        "presentacion": "Comprimidos 500mg / 875mg / Suspensión 90ml",
        "dosis_sugerida": "1 comprimido 875mg cada 12 horas por 7-10 días"
    },
    {
        "id": 11,
        "nombre_comercial": "Amoxidal Duo 875/125",
        "monodroga": "Amoxicilina + Ácido Clavulánico",
        "presentacion": "Comprimidos 875mg/125mg / Suspensión",
        "dosis_sugerida": "1 comprimido cada 12 horas por 7-10 días"
    },
    {
        "id": 12,
        "nombre_comercial": "Optamox Duo 1g",
        "monodroga": "Amoxicilina + Ácido Clavulánico",
        "presentacion": "Comprimidos recubiertos 875mg/125mg",
        "dosis_sugerida": "1 comprimido cada 12 horas por 7 días"
    },
    {
        "id": 13,
        "nombre_comercial": "Ciriax 500mg",
        "monodroga": "Ciprofloxacina",
        "presentacion": "Comprimidos 500mg",
        "dosis_sugerida": "1 comprimido cada 12 horas por 7-14 días"
    },
    {
        "id": 14,
        "nombre_comercial": "Azitromicina 500mg (Tri-Azit / Azitrin)",
        "monodroga": "Azitromicina",
        "presentacion": "Comprimidos 500mg (caja x 3 comp)",
        "dosis_sugerida": "1 comprimido diario por 3 días en ayunas"
    },
    {
        "id": 15,
        "nombre_comercial": "Cefalexina 500mg / 1g (Keflex)",
        "monodroga": "Cefalexina",
        "presentacion": "Comprimidos 500mg / 1g / Jarabe",
        "dosis_sugerida": "1 comprimido 500mg cada 6 horas por 7-10 días"
    },
    {
        "id": 16,
        "nombre_comercial": "Bactrim Forte",
        "monodroga": "Sulfametoxazol + Trimetoprima",
        "presentacion": "Comprimidos 800mg/160mg",
        "dosis_sugerida": "1 comprimido cada 12 horas por 7-10 días"
    },
    {
        "id": 17,
        "nombre_comercial": "Macrodantina 100mg",
        "monodroga": "Nitrofurantoína",
        "presentacion": "Cápsulas 100mg",
        "dosis_sugerida": "1 cápsula cada 6 horas con alimentos por 7 días"
    },
    {
        "id": 18,
        "nombre_comercial": "Flagyl 500mg",
        "monodroga": "Metronidazol",
        "presentacion": "Comprimidos 500mg / Óvulos",
        "dosis_sugerida": "1 comprimido cada 8-12 horas por 7 días"
    },

    # Gastrointestinales / Antiácidos / Antiulcerosos
    {
        "id": 19,
        "nombre_comercial": "Gastrec / Taural 20mg / 40mg",
        "monodroga": "Omeprazol",
        "presentacion": "Cápsulas 20mg / 40mg",
        "dosis_sugerida": "1 cápsula en ayunas 30 minutos antes del desayuno"
    },
    {
        "id": 20,
        "nombre_comercial": "Pantoprazol 20mg / 40mg (Pantus)",
        "monodroga": "Pantoprazol",
        "presentacion": "Comprimidos gastrorresistentes 20mg / 40mg",
        "dosis_sugerida": "1 comprimido diario en ayunas"
    },
    {
        "id": 21,
        "nombre_comercial": "Reliveran 10mg / Sinvogan",
        "monodroga": "Metoclopramida Clorhidrato",
        "presentacion": "Comprimidos 10mg / Gotas",
        "dosis_sugerida": "1 comprimido o 20 gotas 15 min antes de las comidas"
    },
    {
        "id": 22,
        "nombre_comercial": "Factor AG 200 / 400",
        "monodroga": "Simeticona",
        "presentacion": "Comprimidos masticables / Gotas",
        "dosis_sugerida": "1-2 comprimidos masticables tras las comidas"
    },
    {
        "id": 23,
        "nombre_comercial": "Mylanta II / Rennie",
        "monodroga": "Hidróxido de Aluminio + Magnesio / Calcio",
        "presentacion": "Masticables / Suspensión oral",
        "dosis_sugerida": "10-20ml o 2 masticables tras ingerir alimentos"
    },
    {
        "id": 24,
        "nombre_comercial": "Floratil 200mg / Lacteol",
        "monodroga": "Saccharomyces boulardii",
        "presentacion": "Cápsulas 200mg / Sobres",
        "dosis_sugerida": "1 cápsula cada 12 horas por 5 días"
    },

    # Cardiovasculares / Antihipertensivos
    {
        "id": 25,
        "nombre_comercial": "Lotrial 5mg / 10mg / 20mg",
        "monodroga": "Enalapril Maleato",
        "presentacion": "Comprimidos 5mg / 10mg / 20mg",
        "dosis_sugerida": "1 comprimido por la mañana"
    },
    {
        "id": 26,
        "nombre_comercial": "Losartan 50mg / 100mg (Diovan)",
        "monodroga": "Losartán Potásico",
        "presentacion": "Comprimidos recubiertos 50mg / 100mg",
        "dosis_sugerida": "1 comprimido de 50mg cada 24 horas"
    },
    {
        "id": 27,
        "nombre_comercial": "Amloc 5mg / 10mg",
        "monodroga": "Amlodipina",
        "presentacion": "Comprimidos 5mg / 10mg",
        "dosis_sugerida": "1 comprimido diario por la mañana"
    },
    {
        "id": 28,
        "nombre_comercial": "Concor 2.5mg / 5mg / 10mg",
        "monodroga": "Bisoprolol Fumarato",
        "presentacion": "Comprimidos recubiertos",
        "dosis_sugerida": "1 comprimido diario por la mañana"
    },
    {
        "id": 29,
        "nombre_comercial": "Atenolol 50mg / 100mg",
        "monodroga": "Atenolol",
        "presentacion": "Comprimidos 50mg / 100mg",
        "dosis_sugerida": "1 comprimido diario"
    },
    {
        "id": 30,
        "nombre_comercial": "Hidroclorotiazida 25mg (Diurex)",
        "monodroga": "Hidroclorotiazida",
        "presentacion": "Comprimidos 12.5mg / 25mg",
        "dosis_sugerida": "1 comprimido diario con el desayuno"
    },
    {
        "id": 31,
        "nombre_comercial": "Lasix 40mg",
        "monodroga": "Furosemida",
        "presentacion": "Comprimidos 40mg",
        "dosis_sugerida": "1 comprimido por la mañana"
    },
    {
        "id": 32,
        "nombre_comercial": "Rosuvastatina 10mg / 20mg",
        "monodroga": "Rosuvastatina",
        "presentacion": "Comprimidos 10mg / 20mg",
        "dosis_sugerida": "1 comprimido diario por la noche"
    },
    {
        "id": 33,
        "nombre_comercial": "Lipitor 10mg / 20mg / 40mg",
        "monodroga": "Atorvastatina",
        "presentacion": "Comprimidos recubiertos 10mg / 20mg / 40mg",
        "dosis_sugerida": "1 comprimido diario antes de acostarse"
    },

    # Antidiabéticos / Endocrinológicos
    {
        "id": 34,
        "nombre_comercial": "Metformina 500mg / 850mg / 1000mg AP",
        "monodroga": "Metformina Clorhidrato",
        "presentacion": "Comprimidos 500mg / 850mg / 1000mg AP",
        "dosis_sugerida": "1 comprimido con el almuerzo o cena"
    },
    {
        "id": 35,
        "nombre_comercial": "Levotiroxina T4 50/75/100/125/150",
        "monodroga": "Levotiroxina Sódica",
        "presentacion": "Comprimidos 25mcg a 200mcg",
        "dosis_sugerida": "1 comprimido diario en ayunas estricto con agua"
    },

    # Respiratorio / Antihistamínicos
    {
        "id": 36,
        "nombre_comercial": "Aerotina / Loratadina 10mg",
        "monodroga": "Loratadina",
        "presentacion": "Comprimidos 10mg / Jarabe",
        "dosis_sugerida": "1 comprimido por día"
    },
    {
        "id": 37,
        "nombre_comercial": "Zyrtec / Cetirizina 10mg",
        "monodroga": "Cetirizina Clorhidrato",
        "presentacion": "Comprimidos 10mg / Gotas",
        "dosis_sugerida": "1 comprimido diario por la noche"
    },
    {
        "id": 38,
        "nombre_comercial": "Allegra 120mg / 180mg",
        "monodroga": "Fexofenadina",
        "presentacion": "Comprimidos recubiertos 120mg / 180mg",
        "dosis_sugerida": "1 comprimido diario"
    },
    {
        "id": 39,
        "nombre_comercial": "Ventolin / Salbutamol Aerosol",
        "monodroga": "Salbutamol",
        "presentacion": "Aerosol 100mcg/dosis",
        "dosis_sugerida": "2 disparos con aerocámara cada 6-8 horas según crisis"
    },
    {
        "id": 40,
        "nombre_comercial": "Seretide Diskus / Aerosol",
        "monodroga": "Fluticasona + Salmeterol",
        "presentacion": "Polvo para inhalación 250/50, 500/50",
        "dosis_sugerida": "1 inhalación cada 12 horas en forma preventiva"
    },
    {
        "id": 41,
        "nombre_comercial": "Budesonide Nasal / Aerosol",
        "monodroga": "Budesonida",
        "presentacion": "Aerosol 200mcg / Spray Nasal 50mcg",
        "dosis_sugerida": "2 disparos nasales por narina cada 12 horas"
    },
    {
        "id": 42,
        "nombre_comercial": "Ambroxol / Muxol Jarabe",
        "monodroga": "Ambroxol Clorhidrato",
        "presentacion": "Jarabe 30mg/5ml",
        "dosis_sugerida": "10ml cada 8 horas"
    },

    # Corticoides
    {
        "id": 43,
        "nombre_comercial": "Deltisona B 5mg / 20mg / 50mg",
        "monodroga": "Meprednisona",
        "presentacion": "Comprimidos 5mg / 20mg / 40mg / 50mg",
        "dosis_sugerida": "1 comprimido por la mañana con el desayuno"
    },
    {
        "id": 44,
        "nombre_comercial": "Decadron 0.5mg / 4mg",
        "monodroga": "Dexametasona",
        "presentacion": "Comprimidos / Ampollas 4mg",
        "dosis_sugerida": "1 comprimido por la mañana"
    },
    {
        "id": 45,
        "nombre_comercial": "Diprospan / Cronocorteroid",
        "monodroga": "Betametasona Dipropionato + Fosfato Disódico",
        "presentacion": "Ampolla inyectable de depósito",
        "dosis_sugerida": "1 ampolla intramuscular profunda única dosis"
    },

    # Psiquiatría / Neurología / Sedantes
    {
        "id": 46,
        "nombre_comercial": "Rivotril 0.5mg / 2mg",
        "monodroga": "Clonazepam",
        "presentacion": "Comprimidos 0.5mg / 2mg / Gotas",
        "dosis_sugerida": "0.5mg por la noche antes de dormir"
    },
    {
        "id": 47,
        "nombre_comercial": "Alplax 0.25mg / 0.5mg / 1mg / 2mg",
        "monodroga": "Alprazolam",
        "presentacion": "Comprimidos 0.25mg / 0.5mg / 1mg / 2mg",
        "dosis_sugerida": "0.5mg según indicación médica"
    },
    {
        "id": 48,
        "nombre_comercial": "Valium 5mg / 10mg",
        "monodroga": "Diazepam",
        "presentacion": "Comprimidos 5mg / 10mg",
        "dosis_sugerida": "1 comprimido por la noche"
    },
    {
        "id": 49,
        "nombre_comercial": "Zoloft 50mg / 100mg",
        "monodroga": "Sertralina",
        "presentacion": "Comprimidos recubiertos 50mg / 100mg",
        "dosis_sugerida": "1 comprimido diario por la mañana"
    },
    {
        "id": 50,
        "nombre_comercial": "Lexapro 10mg / 20mg",
        "monodroga": "Escitalopram",
        "presentacion": "Comprimidos 10mg / 20mg",
        "dosis_sugerida": "1 comprimido diario por la mañana"
    },

    # Dermatológicos / Tópicos
    {
        "id": 51,
        "nombre_comercial": "Platsul A Crema",
        "monodroga": "Sulfadiazina de Plata + Vitamina A",
        "presentacion": "Crema 200g / 400g",
        "dosis_sugerida": "Aplicar en la zona afectada 1 a 2 veces al día"
    },
    {
        "id": 52,
        "nombre_comercial": "Macril Crema",
        "monodroga": "Betametasona + Gentamicina + Miconazol",
        "presentacion": "Crema tubo 20g / 30g",
        "dosis_sugerida": "Aplicar en la zona afectada cada 12 horas por 7 días"
    },
    {
        "id": 53,
        "nombre_comercial": "Bactroban Pomada",
        "monodroga": "Mupirocina 2%",
        "presentacion": "Pomada 15g",
        "dosis_sugerida": "Aplicar en la zona 3 veces al día por 7-10 días"
    }
]

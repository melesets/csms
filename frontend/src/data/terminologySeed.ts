// Terminology seed data - default medical codes for initial setup
import { CodedValue } from '../types/formBuilder';

export const ICD11_COMMON: CodedValue[] = [
    // --- Infectious Diseases ---
    { system: 'http://id.who.int/icd/release/11/mms', code: '1C62.1', display: 'Lyme borreliosis' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1D01', display: 'Dengue fever' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1E30', display: 'Influenza due to identified seasonal influenza virus' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1E31', display: 'Influenza due to unidentified virus' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1F00', display: 'Measles' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'RA01', display: 'COVID-19' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1B20', display: 'Tuberculosis of respiratory system' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'XT9T', display: 'Malaria' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1A00', display: 'Cholera' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '1A03', display: 'Intestinal infections due to Escherichia coli' },

    // --- Endocrine & Metabolic ---
    { system: 'http://id.who.int/icd/release/11/mms', code: '5A10', display: 'Type 1 diabetes mellitus' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '5A11', display: 'Type 2 diabetes mellitus' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '5A43', display: 'Hypoglycaemia' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '5B81', display: 'Obesity' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '5C80', display: 'Iron deficiency anaemia' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '5D00', display: 'Hypothyroidism' },

    // --- Cardiovascular ---
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BA00', display: 'Essential hypertension' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BA41', display: 'Acute myocardial infarction' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BA42', display: 'Old myocardial infarction' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BB60', display: 'Heart failure' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BC03', display: 'Atrial fibrillation' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '8B60', display: 'Cerebrovascular accident' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'BA80', display: 'Atherosclerosis' },

    // --- Respiratory ---
    { system: 'http://id.who.int/icd/release/11/mms', code: 'CA20', display: 'Allergic rhinitis' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'CA23', display: 'Bronchial asthma' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'CA40', display: 'Pneumonia' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'CA81', display: 'Chronic obstructive pulmonary disease' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'CB00', display: 'Pulmonary oedema' },

    // --- Gastrointestinal ---
    { system: 'http://id.who.int/icd/release/11/mms', code: 'DA20', display: 'Gastro-oesophageal reflux disease' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'DA42', display: 'Gastritis' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'DA54', display: 'Acute appendicitis' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'DB31', display: 'Inguinal hernia' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'DB90', display: 'Haemorrhoids' },

    // --- Musculoskeletal ---
    { system: 'http://id.who.int/icd/release/11/mms', code: 'FB00', display: 'Rheumatoid arthritis' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'FA00', display: 'Osteoarthritis of hip' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'FA01', display: 'Osteoarthritis of knee' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'NC72', display: 'Fracture of femur' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'ME24.9', display: 'Upper limb injury, unspecified' },
    { system: 'http://id.who.int/icd/release/11/mms', code: 'FC01', display: 'Low back pain' },

    // --- Mental Health ---
    { system: 'http://id.who.int/icd/release/11/mms', code: '6A02', display: 'Autism spectrum disorder' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '6A70', display: 'Single episode depressive disorder' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '6A71', display: 'Recurrent depressive disorder' },
    { system: 'http://id.who.int/icd/release/11/mms', code: '6B00', display: 'Generalised anxiety disorder' },
];

export const LOINC_VITALS: CodedValue[] = [
    { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
    { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
    { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
    { system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' },
    { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
    { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
    { system: 'http://loinc.org', code: '29463-7', display: 'Body weight' },
    { system: 'http://loinc.org', code: '8302-2', display: 'Body height' },
    { system: 'http://loinc.org', code: '39156-5', display: 'Body mass index (BMI)' },
    { system: 'http://loinc.org', code: '31044-1', display: 'Mean arterial pressure' },
    { system: 'http://loinc.org', code: '59408-5', display: 'Oxygen saturation in Pulse oximetry' },
];

export const LOINC_LABS: CodedValue[] = [
    // --- Chemistry / BMP ---
    { system: 'http://loinc.org', code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2075-0', display: 'Chloride [Moles/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2028-9', display: 'Carbon dioxide [Moles/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '3094-0', display: 'Urea nitrogen [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma' },

    // --- Hematology / CBC ---
    { system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' },
    { system: 'http://loinc.org', code: '4544-3', display: 'Hematocrit [Volume Fraction] of Blood' },
    { system: 'http://loinc.org', code: '6690-2', display: 'Leukocytes [#/volume] in Blood' },
    { system: 'http://loinc.org', code: '777-3', display: 'Platelets [#/volume] in Blood' },
    { system: 'http://loinc.org', code: '789-8', display: 'Erythrocytes [#/volume] in Blood' },
    { system: 'http://loinc.org', code: '787-2', display: 'MCV [Entitic volume] by Automated count' },
    { system: 'http://loinc.org', code: '751-8', display: 'Neutrophils [#/volume] in Blood' },
    { system: 'http://loinc.org', code: '731-0', display: 'Lymphocytes [#/volume] in Blood' },

    // --- Diabetes / Endocrine ---
    { system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
    { system: 'http://loinc.org', code: '1558-6', display: 'Fasting glucose [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },

    // --- Liver Function ---
    { system: 'http://loinc.org', code: '1742-6', display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '1920-8', display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '1975-2', display: 'Bilirubin.total [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '6768-6', display: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '2885-2', display: 'Protein [Mass/volume] in Serum or Plasma' },
    { system: 'http://loinc.org', code: '1751-7', display: 'Albumin [Mass/volume] in Serum or Plasma' },
];

export const UCUM_UNITS: CodedValue[] = [
    // --- Length ---
    { system: 'http://unitsofmeasure.org', code: 'm', display: 'm' },
    { system: 'http://unitsofmeasure.org', code: 'cm', display: 'cm' },
    { system: 'http://unitsofmeasure.org', code: 'mm', display: 'mm' },
    { system: 'http://unitsofmeasure.org', code: 'in_i', display: 'in' },
    { system: 'http://unitsofmeasure.org', code: 'ft_i', display: 'ft' },

    // --- Mass ---
    { system: 'http://unitsofmeasure.org', code: 'kg', display: 'kg' },
    { system: 'http://unitsofmeasure.org', code: 'g', display: 'g' },
    { system: 'http://unitsofmeasure.org', code: 'mg', display: 'mg' },
    { system: 'http://unitsofmeasure.org', code: 'ug', display: 'µg' },
    { system: 'http://unitsofmeasure.org', code: 'lb_av', display: 'lb' },

    // --- Time ---
    { system: 'http://unitsofmeasure.org', code: 's', display: 's' },
    { system: 'http://unitsofmeasure.org', code: 'min', display: 'min' },
    { system: 'http://unitsofmeasure.org', code: 'h', display: 'h' },
    { system: 'http://unitsofmeasure.org', code: 'd', display: 'd' },
    { system: 'http://unitsofmeasure.org', code: 'wk', display: 'wk' },
    { system: 'http://unitsofmeasure.org', code: 'mo', display: 'mo' },
    { system: 'http://unitsofmeasure.org', code: 'a', display: 'yr' },

    // --- Clinical Measures ---
    { system: 'http://unitsofmeasure.org', code: 'mm[Hg]', display: 'mmHg' },
    { system: 'http://unitsofmeasure.org', code: '/min', display: '/min' },
    { system: 'http://unitsofmeasure.org', code: 'Cel', display: '°C' },
    { system: 'http://unitsofmeasure.org', code: 'degF', display: '°F' },
    { system: 'http://unitsofmeasure.org', code: '%', display: '%' },
    { system: 'http://unitsofmeasure.org', code: 'kg/m2', display: 'kg/m²' },
    { system: 'http://unitsofmeasure.org', code: 'mg/dL', display: 'mg/dL' },
    { system: 'http://unitsofmeasure.org', code: 'g/dL', display: 'g/dL' },
    { system: 'http://unitsofmeasure.org', code: 'mmol/L', display: 'mmol/L' },
    { system: 'http://unitsofmeasure.org', code: 'mEq/L', display: 'mEq/L' },
    { system: 'http://unitsofmeasure.org', code: '10*3/uL', display: '10³/µL' },
    { system: 'http://unitsofmeasure.org', code: 'mL', display: 'mL' },
    { system: 'http://unitsofmeasure.org', code: 'L', display: 'L' },
    { system: 'http://unitsofmeasure.org', code: 'U/L', display: 'U/L' },
    { system: 'http://unitsofmeasure.org', code: 'IU/L', display: 'IU/L' },
];

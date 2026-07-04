import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

function generateCodes() {
    const codes = [];

    // --- ICD-11 (Common Diagnoses) ---
    // No specific category needed (falls under general)
    const categories = [
        { prefix: '1A', name: 'Infectious', count: 50 },
        { prefix: 'BA', name: 'Circulatory', count: 60 },
        { prefix: 'CA', name: 'Respiratory', count: 50 },
        { prefix: 'DA', name: 'Digestive', count: 50 },
        // ... (keep it simple for update)
    ];

    categories.forEach(cat => {
        for (let i = 0; i < cat.count; i++) {
            codes.push({
                system: 'ICD-11',
                code: `${cat.prefix}${String(i).padStart(2, '0')}`,
                display: `${cat.name} Disorder Type ${i + 1}`,
                category: null // General
            });
        }
    });

    // Real ICD
    const realIcd = [
        { c: 'RA01', d: 'COVID-19' }, { c: 'BA00', d: 'Essential Hypertension' },
        { c: '5A11', d: 'Type 2 Diabetes Mellitus' }, { c: 'CA40', d: 'Pneumonia' }
    ];
    realIcd.forEach(item => codes.push({ system: 'ICD-11', code: item.c, display: item.d, category: null }));

    // --- LOINC (Labs & Vitals) ---
    // KEY FIX: Add Categories
    const loincCats = [
        { prefix: '100', name: 'Chemistry', count: 50, cat: 'Labs' },
        { prefix: '400', name: 'Vitals', count: 50, cat: 'Vital Signs' }
    ];

    loincCats.forEach(cat => {
        for (let i = 0; i < cat.count; i++) {
            codes.push({
                system: 'LOINC',
                code: `${cat.prefix}-${i}`,
                display: `${cat.name} Parameter ${i}`,
                category: cat.cat
            });
        }
    });

    // Real LOINC - Categorized
    const realLoincVitals = [
        { c: '8867-4', d: 'Heart rate' }, { c: '8480-6', d: 'Systolic blood pressure' },
        { c: '8462-4', d: 'Diastolic blood pressure' }, { c: '8310-5', d: 'Body temperature' },
        { c: '9279-1', d: 'Respiratory rate' }, { c: '29463-7', d: 'Body weight' },
        { c: '8302-2', d: 'Body height' }, { c: '39156-5', d: 'BMI' },
        { c: '59408-5', d: 'Oxygen saturation' }
    ];
    realLoincVitals.forEach(item => codes.push({ system: 'LOINC', code: item.c, display: item.d, category: 'Vital Signs' }));

    const realLoincLabs = [
        { c: '2345-7', d: 'Glucose' }, { c: '4548-4', d: 'HbA1c' },
        { c: '718-7', d: 'Hemoglobin' }, { c: '4544-3', d: 'Hematocrit' },
        { c: '1742-6', d: 'ALT' }, { c: '1920-8', d: 'AST' },
        { c: '6690-2', d: 'WBC Count' }, { c: '777-3', d: 'Platelet Count' }
    ];
    realLoincLabs.forEach(item => codes.push({ system: 'LOINC', code: item.c, display: item.d, category: 'Labs' }));

    return codes;
}

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Updating Terminology with Categories...');

        const codes = generateCodes();

        // Batch Insert with UPDATE
        const BATCH_SIZE = 500;
        for (let i = 0; i < codes.length; i += BATCH_SIZE) {
            const batch = codes.slice(i, i + BATCH_SIZE);

            await client.query('BEGIN');
            const statement = `
                INSERT INTO terminology_codes (system, code, display, category)
                SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(system text, code text, display text, category text)
                ON CONFLICT (system, code) 
                DO UPDATE SET category = EXCLUDED.category, display = EXCLUDED.display
            `;
            await client.query(statement, [JSON.stringify(batch)]);
            await client.query('COMMIT');
            console.log(`Updated batch ${i} - ${i + batch.length}`);
        }

        console.log('✅ Terminology updated successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Update failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();

// Terminology service - medical code search and import API calls
import { CodedValue, TerminologyConfig } from '../types/formBuilder';
import { ICD11_COMMON, LOINC_LABS, LOINC_VITALS, UCUM_UNITS } from '../data/terminologySeed';

// API Base URL
// In development, this points to the local backend
const API_BASE_URL = 'http://localhost:4000/api';

export class TerminologyService {
    private static instance: TerminologyService;

    private constructor() { }

    public static getInstance(): TerminologyService {
        if (!TerminologyService.instance) {
            TerminologyService.instance = new TerminologyService();
        }
        return TerminologyService.instance;
    }

    public async seedBahmni(): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/terminology/seed-bahmni`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error('Failed to seed Bahmni data');
        }
    }

    /**
     * Search for clinical concepts using the backend API
     * Falls back to local seed data if API fails or is unreachable
     */
    public async search(query: string, config: TerminologyConfig): Promise<CodedValue[]> {
        const searchTerm = query.toLowerCase();

        try {
            // 1. Try Backend API
            const params = new URLSearchParams({
                q: query,
                limit: '1000'
            });

            if (config.system !== 'All' && config.system !== 'Custom') {
                params.append('system', config.system);
            }

            if (config.subset) {
                params.append('subset', config.subset);
            }

            const response = await fetch(`${API_BASE_URL}/terminology/search?${params.toString()}`);
            if (response.ok) {
                const results = await response.json();
                // If API returns results, use them. If empty, maybe fallback? 
                // Usually empty means no match, but let's return it.
                // Unless connection failed, which goes to catch.
                return results;
            }
        } catch (error) {
            console.warn('Terminology API unreachable, falling back to local data:', error);
        }

        // 2. Fallback to Local Seed Data (Offline Mode)
        let sourceData: CodedValue[] = [];

        switch (config.system) {
            case 'ICD-11':
                sourceData = ICD11_COMMON;
                break;
            case 'LOINC':
                // Combine labs and vitals for general LOINC search, or filter by subset
                if (config.subset === 'Vital Signs') {
                    sourceData = LOINC_VITALS;
                } else if (config.subset === 'Labs') {
                    sourceData = LOINC_LABS;
                } else {
                    sourceData = [...LOINC_VITALS, ...LOINC_LABS];
                }
                break;
            case 'UCUM':
                sourceData = UCUM_UNITS;
                break;
            default:
                sourceData = [];
        }

        return sourceData.filter(item =>
            item.display.toLowerCase().includes(searchTerm) ||
            item.code.toLowerCase().includes(searchTerm)
        );
    }
}

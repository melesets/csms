// Departments hook - fetches and caches department list from API
import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch unique departments from the backend.
 * Returns the list of departments and a refresh function.
 */
export const useDepartments = () => {
    const [departments, setDepartments] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/departments');
            if (!response.ok) {
                throw new Error('Failed to fetch departments');
            }
            const data = await response.json();
            setDepartments(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching departments:', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    return { departments, loading, error, refreshDepartments: fetchDepartments };
};

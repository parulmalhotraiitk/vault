import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { entriesApi, categoriesApi } from '../api';

const VaultContext = createContext(null);

export function VaultProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await entriesApi.list();
      setEntries(res.data.data || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesApi.list();
      setCategories(res.data.data || []);
    } catch {}
  }, []);

  const createEntry = async (data) => {
    const res = await entriesApi.create(data);
    await loadEntries();
    await loadCategories();
    return res.data;
  };

  const updateEntry = async (id, data) => {
    const res = await entriesApi.update(id, data);
    await loadEntries();
    return res.data;
  };

  const deleteEntry = async (id) => {
    await entriesApi.delete(id);
    await loadEntries();
    await loadCategories();
  };

  const getEntry = async (id) => {
    const res = await entriesApi.get(id);
    return res.data.data;
  };

  const filteredEntries = entries.filter(e => {
    if (showFavoritesOnly && !e.favorite) return false;
    if (selectedCategory && e.category !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title?.toLowerCase().includes(q) ||
      e.username?.toLowerCase().includes(q) ||
      e.url?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  });

  return (
    <VaultContext.Provider value={{
      entries, categories, loading, filteredEntries,
      searchQuery, setSearchQuery,
      selectedCategory, setSelectedCategory,
      showFavoritesOnly, setShowFavoritesOnly,
      loadEntries, loadCategories, createEntry, updateEntry, deleteEntry, getEntry,
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export const useVault = () => useContext(VaultContext);

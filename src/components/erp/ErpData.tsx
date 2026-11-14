import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ErpEmployee, ErpExpense } from '../../types';
import {
  fetchEmployeesRemote,
  saveEmployeeRemote,
  deleteEmployeeRemote,
  fetchExpensesRemote,
  saveExpenseRemote,
  deleteExpenseRemote
} from '../../lib/drive';
import { useStudio } from '../../context/StudioContext';

interface ErpDataCtx {
  employees: ErpEmployee[];
  expenses: ErpExpense[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  saveEmployee: (e: Partial<ErpEmployee>, password?: string) => Promise<boolean>;
  removeEmployee: (id: string) => Promise<boolean>;
  saveExpense: (e: Omit<ErpExpense, 'id' | 'createdAt' | 'createdBy'>) => Promise<boolean>;
  removeExpense: (id: string) => Promise<boolean>;
}

const Ctx = createContext<ErpDataCtx | null>(null);
export const useErpData = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('ErpDataProvider missing');
  return c;
};

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full */
  }
};

export const ErpDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, showToast } = useStudio();
  const isOwner = session.role === 'owner';
  const [employees, setEmployees] = useState<ErpEmployee[]>(() => load('erp_employees', []));
  const [expenses, setExpenses] = useState<ErpExpense[]>(() => load('erp_expenses', []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => save('erp_employees', employees), [employees]);
  useEffect(() => save('erp_expenses', expenses), [expenses]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Staff ko Employees list chahiye (Customers mein staff dropdown); Expenses sirf Owner ko
      setEmployees(await fetchEmployeesRemote());
      if (isOwner) setExpenses(await fetchExpensesRemote());
    } catch (err: any) {
      setError(
        (err?.message || 'Internet check karein') +
          ' — Agar naya Code.gs paste karke "New version" deploy nahi kiya hai to pehle wo karein (SETUP_GUIDE dekho).'
      );
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveEmployee = async (e: Partial<ErpEmployee>, password?: string) => {
    try {
      const id = await saveEmployeeRemote(e, password);
      // Turant list mein dikhao, phir Sheet se pakka kar lo
      const rec = { ...(e as ErpEmployee), id, hasPassword: true, active: e.active || 'yes', createdAt: e.createdAt || new Date().toISOString().slice(0, 10) };
      setEmployees(prev => (prev.some(x => x.id === id) ? prev.map(x => (x.id === id ? { ...x, ...rec } : x)) : [rec, ...prev]));
      reload();
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Employee save nahi hua');
      return false;
    }
  };

  const removeEmployee = async (id: string) => {
    try {
      await deleteEmployeeRemote(id);
      setEmployees(prev => prev.filter(x => x.id !== id));
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Employee delete nahi hua');
      return false;
    }
  };

  const saveExpense = async (e: Omit<ErpExpense, 'id' | 'createdAt' | 'createdBy'>) => {
    const rec: ErpExpense = {
      ...e,
      id: `X-${Date.now().toString().slice(-9)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: session.name
    };
    setExpenses(prev => [rec, ...prev]);
    try {
      await saveExpenseRemote(rec);
      showToast('Expense Google Sheet mein save ho gaya.');
      return true;
    } catch (err: any) {
      setExpenses(prev => prev.filter(x => x.id !== rec.id));
      showToast('Expense save nahi hua: ' + (err?.message || 'internet check karein'));
      return false;
    }
  };

  const removeExpense = async (id: string) => {
    const old = expenses;
    setExpenses(prev => prev.filter(x => x.id !== id));
    try {
      await deleteExpenseRemote(id);
      return true;
    } catch (err: any) {
      setExpenses(old);
      showToast(err?.message || 'Expense delete nahi hua');
      return false;
    }
  };

  return (
    <Ctx.Provider value={{ employees, expenses, loading, error, reload, saveEmployee, removeEmployee, saveExpense, removeExpense }}>{children}</Ctx.Provider>
  );
};

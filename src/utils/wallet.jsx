import { createContext, useContext, useState, useCallback } from 'react';
import { FEES } from '../data/tokenConfig';

const WalletContext = createContext();

const INITIAL_BALANCE = 0; // Starting $MATCH balance (real stats)

export function WalletProvider({ children }) {
    const [balance, setBalance] = useState(INITIAL_BALANCE);
    const [transactions, setTransactions] = useState([]);
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((event) => {
        const id = Date.now() + Math.random();
        const toast = { id, ...event, timestamp: Date.now() };
        setToasts(prev => [...prev, toast]);
        // Auto-remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const spend = useCallback((eventType, customAmount) => {
        const amount = customAmount || Math.abs(eventType.amount);
        if (balance < amount) return false;
        setBalance(prev => prev - amount);
        setTransactions(prev => [...prev, {
            type: 'spend',
            label: eventType.label,
            amount: -amount,
            timestamp: Date.now(),
        }]);
        addToast({ ...eventType, amount: -amount });
        return true;
    }, [balance, addToast]);

    const earn = useCallback((eventType, customAmount) => {
        const amount = customAmount || Math.abs(eventType.amount);
        setBalance(prev => prev + amount);
        setTransactions(prev => [...prev, {
            type: 'earn',
            label: eventType.label,
            amount: +amount,
            timestamp: Date.now(),
        }]);
        addToast({ ...eventType, amount: +amount });
    }, [addToast]);

    return (
        <WalletContext.Provider value={{ balance, setBalance, transactions, toasts, spend, earn, INITIAL_BALANCE }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWallet must be used within WalletProvider');
    return ctx;
}

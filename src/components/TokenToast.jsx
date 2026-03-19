import { useWallet } from '../utils/wallet';

export default function TokenToast() {
    const { toasts } = useWallet();

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`token-toast ${toast.amount < 0 ? 'spend' : 'earn'}`}
                >
                    <span className="toast-icon">{toast.icon}</span>
                    <div className="toast-info">
                        <div className="toast-label">{toast.label}</div>
                        <div className={`toast-amount ${toast.amount < 0 ? 'negative' : 'positive'}`}>
                            {toast.amount > 0 ? '+' : ''}{toast.amount.toLocaleString()} $MATCH
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

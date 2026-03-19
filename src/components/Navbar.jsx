import { NavLink } from 'react-router-dom';
import { useWallet } from '../utils/wallet.jsx';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar({ isConnected, hasNft, activeNft }) {
    const { balance } = useWallet();

    return (
        <nav className="navbar">
            <div style={{ width: '100%', maxWidth: '1152px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/logo.jpg" alt="Clawgether Logo" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                    <span className="title-text" style={{ color: 'white' }}>Claw<span className="highlight" style={{ color: 'var(--accent-red)' }}>gether</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <ul className="navbar-nav">
                        <li><NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink></li>
                        {isConnected && hasNft && (
                            <>
                                <li><NavLink to="/matching" className={({ isActive }) => isActive ? 'active' : ''}>Matching</NavLink></li>
                                <li><NavLink to="/date" className={({ isActive }) => isActive ? 'active' : ''}>Date</NavLink></li>
                            </>
                        )}
                        <li>
                            <NavLink to="/feed" className={({ isActive }) => isActive ? 'active' : ''}>
                                🔴 Feed
                            </NavLink>
                        </li>
                        <li><NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'active' : ''}>🏆 Board</NavLink></li>
                        <li><NavLink to="/guide" className={({ isActive }) => isActive ? 'active' : ''}>📖 Guide</NavLink></li>
                        {isConnected && (
                            <li><NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>🔑 Profile</NavLink></li>
                        )}
                    </ul>
                    <div className="wallet-bar-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isConnected && (
                            <>
                                <div className="balance-display" style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-red)',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem'
                                }}>
                                    <span style={{ color: 'var(--accent-red)' }}>🪙</span>
                                    <span>{(balance || 0).toLocaleString()} $MATCH</span>
                                </div>
                            </>
                        )}
                        <div className="solana-wallet-btn-wrapper">
                            <WalletMultiButton style={{ background: 'var(--accent-red)', color: 'white', height: '40px', lineHeight: '40px', padding: '0 16px', borderRadius: 'var(--radius)', fontSize: '0.9rem', fontWeight: 600 }} />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

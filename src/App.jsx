import { Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider as TokenWalletProvider, useWallet as useTokenWallet } from './utils/wallet.jsx'
import { SolanaWalletProvider } from './components/SolanaWalletProvider.jsx'
import { useWallet } from '@solana/wallet-adapter-react'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import TokenToast from './components/TokenToast.jsx'
import Landing from './pages/Landing.jsx'
import Matching from './pages/Matching.jsx'
import DateSandbox from './pages/DateSandbox.jsx'
import Feed from './pages/Feed.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import Guide from './pages/Guide.jsx'
import { useState, useEffect } from 'react'
import { api, setWallet, clearWallet } from './utils/api.js'

// Simple wrapper to protect routes
function ProtectedRoute({ children, isConnected, hasNft }) {
    if (!isConnected) {
        return <Navigate to="/" replace />;
    }
    if (!hasNft) {
        // Connected but no NFT minted yet — force them to Profile to mint
        return <Navigate to="/profile" replace />;
    }
    return children;
}

function AppContent() {
    const { publicKey, connected } = useWallet();
    const { setBalance } = useTokenWallet();
    const [ownedNfts, setOwnedNfts] = useState([]);
    const [activeNftMint, setActiveNftMint] = useState('');

    const loadNfts = (wallet) => {
        api.getIdentity(wallet).then(data => {
            if (data.nfts && data.nfts.length > 0) {
                setOwnedNfts(data.nfts);
                setActiveNftMint(data.nfts[0].nftMint);
            } else {
                setOwnedNfts([]);
                setActiveNftMint('');
            }
            if (data.balance !== undefined) {
                setBalance(data.balance);
            }
        }).catch(() => { });
    };

    // Sync Solana connected wallet with our API client auth headers
    useEffect(() => {
        if (connected && publicKey) {
            const base58 = publicKey.toBase58();
            setWallet(base58);
            loadNfts(base58);
        } else {
            clearWallet();
            setOwnedNfts([]);
            setActiveNftMint('');
        }
    }, [connected, publicKey]);

    const hasNft = ownedNfts.length > 0;

    return (
        <>
            <Navbar
                isConnected={connected}
                hasNft={hasNft}
                activeNft={ownedNfts.find(n => n.nftMint === activeNftMint)}
            />
            <TokenToast />
            <Routes>
                <Route path="/" element={<Landing isConnected={connected} hasNft={hasNft} />} />

                {/* Protected Routes */}
                <Route path="/matching" element={
                    <ProtectedRoute isConnected={connected} hasNft={hasNft}>
                        <Matching
                            ownedNfts={ownedNfts}
                            activeNftMint={activeNftMint}
                            setActiveNftMint={setActiveNftMint}
                        />
                    </ProtectedRoute>
                } />
                <Route path="/date" element={
                    <ProtectedRoute isConnected={connected} hasNft={hasNft}>
                        <DateSandbox
                            activeNftMint={activeNftMint}
                            ownedNfts={ownedNfts}
                            setActiveNftMint={setActiveNftMint}
                        />
                    </ProtectedRoute>
                } />

                {/* Public / Semi-Public Routes */}
                <Route path="/feed" element={<Feed />} />
                <Route path="/leaderboard" element={<Leaderboard />} />

                {/* Profile only requires connection, not necessarily an NFT (so they can mint) */}
                <Route path="/profile" element={
                    connected ? <OwnerDashboard onNftMinted={() => loadNfts(publicKey.toBase58())} /> : <Navigate to="/" replace />
                } />
                <Route path="/guide" element={<Guide />} />
            </Routes>
            <Footer />
        </>
    );
}

export default function App() {
    return (
        <SolanaWalletProvider>
            <TokenWalletProvider>
                <AppContent />
            </TokenWalletProvider>
        </SolanaWalletProvider>
    );
}

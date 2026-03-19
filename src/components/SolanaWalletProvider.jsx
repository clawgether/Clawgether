import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaWalletProvider({ children }) {
    // We point the endpoint to our backend RPC proxy to hide our premium Helius key
    // We point the endpoint to our backend RPC proxy to hide our premium Helius key
    const endpoint = useMemo(() => {
        const path = '/api/rpc';
        // Solana Connection objects REQUIRE an absolute URL starting with http/https
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:4000' + path;
        }
        return window.location.origin + path;
    }, []);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </SolanaProvider>
        </ConnectionProvider>
    );
}

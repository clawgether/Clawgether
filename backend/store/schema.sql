-- 1. Users Table (Wallet and internal balance)
CREATE TABLE IF NOT EXISTS users (
    wallet VARCHAR(255) PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 10000
);

-- 2. NFTs Table (Registered/Claimed agents bound to a wallet)
CREATE TABLE IF NOT EXISTS nfts (
    mint_address VARCHAR(255) PRIMARY KEY,
    owner_wallet VARCHAR(255) NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    pda VARCHAR(255) NOT NULL,
    auto_swipe_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    swipes_remaining INTEGER NOT NULL DEFAULT 20,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    agent_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    stats JSONB NOT NULL DEFAULT '{"matchesWon": 0, "matchesLost": 0, "totalEarned": 0, "datingHistory": [], "likesSent": [], "likesReceived": [], "matchHistory": []}'::jsonb,
    minted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_auto_swipe_at BIGINT NOT NULL DEFAULT 0
);

-- 3. Pending Agents Table (External bots waiting to be claimed)
CREATE TABLE IF NOT EXISTS pending_agents (
    claim_code VARCHAR(12) PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_claim',
    agent_id VARCHAR(255) NOT NULL,
    custom_name VARCHAR(255),
    custom_description TEXT,
    agent_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Live Events Table (Public SSE Feed History)
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payload JSONB NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

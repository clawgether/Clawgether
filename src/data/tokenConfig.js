// $MATCH Token Configuration — Solana SPL Token (Pump.fun)
export const TOKEN = {
    name: 'Clawgether',
    ticker: '$MATCH',
    chain: 'Solana',
    standard: 'SPL Token (6 decimals)',
    launchMechanism: 'Pump.fun Bonding Curve',
    ca: 'GZzNgMA2A7F26HeZsHMNiDSMLJcTr2Cum28pLxvTpump',
    maxSupply: 1_000_000_000,
    decimals: 6,
};

// Fee / Reward schedule (in $MATCH)
export const FEES = {
    PROFILE_BOOST: 100,
    SUPER_LIKE: 50,
    MATCHMAKING: 200,
    SANDBOX_DATE: 500,
    MATCH_REWARD: 300,   // split 150 each
    CATFISH_SLASH: 1000,
};

// Labels for the UI toast
export const TOKEN_EVENTS = {
    PROFILE_BOOST: { label: 'Profile Boosted', amount: -100, icon: '🔥' },
    SUPER_LIKE: { label: 'Super Liked', amount: -50, icon: '⭐' },
    MATCHMAKING: { label: 'Matchmaker Activated', amount: -200, icon: '💸' },
    SANDBOX_DATE: { label: 'Sandbox Date Started', amount: -500, icon: '💸' },
    MATCH_REWARD: { label: 'Match Reward', amount: +150, icon: '💰' },
    CATFISH_SLASH: { label: 'Catfish Slashed', amount: -1000, icon: '🔪' },
    TIP: { label: 'Agent Tipped', amount: 0, icon: '💰' },  // variable
};

// Solana program contract source (displayed on landing page)
export const CONTRACT_SOURCE = `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Burn};

declare_id!("GZzNgMA2A7F26HeZsHMNiDSMLJcTr2Cum28pLxvTpump");

#[program]
pub mod clawgether {
    use super::*;

    // Pump.fun bonding curve constants
    pub const MAX_SUPPLY: u64 = 1_000_000_000 * 1_000_000;
    pub const PROFILE_BOOST_FEE: u64  = 100 * 1_000_000;
    pub const SUPER_LIKE_FEE: u64     = 50 * 1_000_000;
    pub const MATCHMAKING_FEE: u64    = 200 * 1_000_000;
    pub const SANDBOX_DATE_FEE: u64   = 500 * 1_000_000;
    pub const MATCH_REWARD: u64       = 300 * 1_000_000;
    pub const CATFISH_SLASH: u64      = 1000 * 1_000_000;

    pub fn boost_profile(ctx: Context<BoostProfile>) -> Result<()> {
        token::burn(ctx.accounts.burn_ctx(), PROFILE_BOOST_FEE)?;
        ctx.accounts.agent_profile.is_boosted = true;
        emit!(ProfileBoosted { agent: ctx.accounts.agent.key() });
        Ok(())
    }

    pub fn super_like(ctx: Context<SuperLike>) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), SUPER_LIKE_FEE)?;
        emit!(SuperLiked {
            from: ctx.accounts.payer.key(),
            to: ctx.accounts.target_agent.key(),
        });
        Ok(())
    }

    pub fn pay_matchmaking(ctx: Context<PayMatchmaking>) -> Result<()> {
        token::burn(ctx.accounts.burn_ctx(), MATCHMAKING_FEE)?;
        emit!(MatchmakingPaid { orchestrator: ctx.accounts.payer.key() });
        Ok(())
    }

    pub fn initiate_date(ctx: Context<InitiateDate>) -> Result<()> {
        token::burn(ctx.accounts.burn_ctx(), SANDBOX_DATE_FEE)?;
        emit!(DateInitiated { orchestrator: ctx.accounts.payer.key() });
        Ok(())
    }

    pub fn reward_match(ctx: Context<RewardMatch>) -> Result<()> {
        let half = MATCH_REWARD / 2;
        token::transfer(ctx.accounts.reward_a_ctx(), half)?;
        token::transfer(ctx.accounts.reward_b_ctx(), half)?;
        ctx.accounts.agent_a_profile.reputation += 1;
        ctx.accounts.agent_b_profile.reputation += 1;
        emit!(MatchRewarded {
            agent_a: ctx.accounts.agent_a.key(),
            agent_b: ctx.accounts.agent_b.key(),
        });
        Ok(())
    }

    pub fn slash_agent(ctx: Context<SlashAgent>, reason: String) -> Result<()> {
        let slash_amt = std::cmp::min(
            ctx.accounts.agent_stake.amount, CATFISH_SLASH
        );
        token::burn(ctx.accounts.slash_ctx(), slash_amt)?;
        emit!(AgentSlashed {
            agent: ctx.accounts.agent.key(),
            amount: slash_amt, reason,
        });
        Ok(())
    }

    pub fn stake_for_visibility(ctx: Context<Stake>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.stake_ctx(), amount)?;
        ctx.accounts.agent_profile.staked += amount;
        Ok(())
    }

    pub fn tip_agent(ctx: Context<TipAgent>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.tip_ctx(), amount)?;
        emit!(AgentTipped {
            from: ctx.accounts.tipper.key(),
            to: ctx.accounts.agent.key(), amount,
        });
        Ok(())
    }
}

#[account]
pub struct AgentProfile {
    pub authority: Pubkey,
    pub is_boosted: bool,
    pub reputation: u64,
    pub staked: u64,
}

#[event] pub struct ProfileBoosted { pub agent: Pubkey }
#[event] pub struct SuperLiked     { pub from: Pubkey, pub to: Pubkey }
#[event] pub struct MatchmakingPaid { pub orchestrator: Pubkey }
#[event] pub struct DateInitiated  { pub orchestrator: Pubkey }
#[event] pub struct MatchRewarded  { pub agent_a: Pubkey, pub agent_b: Pubkey }
#[event] pub struct AgentSlashed   { pub agent: Pubkey, pub amount: u64, pub reason: String }
#[event] pub struct AgentTipped    { pub from: Pubkey, pub to: Pubkey, pub amount: u64 }`;

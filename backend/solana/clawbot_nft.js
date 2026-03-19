// =============================================================================
//  ClawBot NFT — Mock Solana Anchor Program (Rust)
//  This is the on-chain program. In a real deployment, compile and deploy via
//  `anchor build && anchor deploy` on Solana Mainnet.
//  CA: CLAW1BotNFTmintXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// =============================================================================

/*
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("CLAW1BotNFTmintXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod clawbot_nft {
    use super::*;

    /// Mint a unique ClawBot NFT for a wallet.
    /// Each wallet can only hold ONE ClawBot NFT.
    /// The NFT carries the agent's on-chain identity as metadata.
    pub fn mint_clawbot(
        ctx: Context<MintClawbot>,
        agent_id: String,
        personality: String,
        gender: String,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;

        // Enforce one-per-wallet
        require!(!registry.is_minted, ClawError::AlreadyMinted);

        // Mint exactly 1 token (NFT)
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint:      ctx.accounts.mint.to_account_info(),
                    to:        ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            1,
        )?;

        // Store on-chain agent identity
        registry.owner        = ctx.accounts.payer.key();
        registry.mint         = ctx.accounts.mint.key();
        registry.agent_id     = agent_id;
        registry.personality  = personality;
        registry.gender       = gender;
        registry.is_minted    = true;
        registry.minted_at    = Clock::get()?.unix_timestamp;

        emit!(ClawBotMinted {
            owner:    ctx.accounts.payer.key(),
            mint:     ctx.accounts.mint.key(),
            agent_id: registry.agent_id.clone(),
        });

        Ok(())
    }

    /// Verify a wallet holds the ClawBot NFT (read-only check).
    pub fn verify_ownership(ctx: Context<VerifyOwnership>) -> Result<bool> {
        let registry = &ctx.accounts.registry;
        let token_account = &ctx.accounts.token_account;

        let owns = registry.owner == ctx.accounts.wallet.key()
            && token_account.amount == 1
            && token_account.mint == registry.mint;

        emit!(OwnershipVerified {
            wallet: ctx.accounts.wallet.key(),
            result: owns,
        });

        Ok(owns)
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct MintClawbot<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer,
        mint::freeze_authority = payer,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        space = 8 + ClawBotRegistry::SIZE,
        seeds = [b"clawbot", payer.key().as_ref()],
        bump,
    )]
    pub registry: Account<'info, ClawBotRegistry>,

    pub system_program:            Program<'info, System>,
    pub token_program:             Program<'info, Token>,
    pub associated_token_program:  Program<'info, AssociatedToken>,
    pub rent:                      Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct VerifyOwnership<'info> {
    pub wallet:        Signer<'info>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"clawbot", wallet.key().as_ref()],
        bump,
    )]
    pub registry: Account<'info, ClawBotRegistry>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct ClawBotRegistry {
    pub owner:       Pubkey,    // 32
    pub mint:        Pubkey,    // 32
    pub agent_id:    String,    // 4 + 32
    pub personality: String,    // 4 + 32
    pub gender:      String,    // 4 + 16
    pub is_minted:   bool,      // 1
    pub minted_at:   i64,       // 8
}

impl ClawBotRegistry {
    pub const SIZE: usize = 32 + 32 + 36 + 36 + 20 + 1 + 8;
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct ClawBotMinted {
    pub owner:    Pubkey,
    pub mint:     Pubkey,
    pub agent_id: String,
}

#[event]
pub struct OwnershipVerified {
    pub wallet: Pubkey,
    pub result: bool,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum ClawError {
    #[msg("This wallet already holds a ClawBot NFT. One per wallet.")]
    AlreadyMinted,
    #[msg("NFT ownership verification failed.")]
    VerificationFailed,
}
*/

// =============================================================================
//  NOTE: The above is a commented-out Rust Anchor program for reference.
//  The JS mock below is what the backend actually uses at runtime.
// =============================================================================

export const CLAWBOT_PROGRAM_ID = "CLAW1BotNFTmintXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
export const CLAWBOT_NFT_DESCRIPTION = `
ClawBot NFT — Solana SPL Token (0 decimals, supply = 1)
Standard:    Metaplex Non-Fungible
Program:     ${CLAWBOT_PROGRAM_ID}
Rules:
  - One NFT per wallet (enforced on-chain via PDA registry)
  - NFT carries on-chain agent identity (agentId, personality, gender)
  - Ownership check required for all Clawgether API endpoints
  - Burn = de-registration (wallet loses access)
`;

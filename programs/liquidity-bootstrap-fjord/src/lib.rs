
#![cfg_attr(feature = "no-entrypoint", allow(dead_code))]

use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;
pub mod utils;

use instructions::*;
use state::*;

declare_id!("CP9AxdoRRY2Rmi9ZDRUqsvZJSwzJ6iZRa3WWajH3YGqf");

#[program]
pub mod liquidity_bootstrap_fjord {
    use solana_program::pubkey;

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>, 
        id: u64,
        fee_recipient: Pubkey,
        platform_fee: u64,
        referrer_fee: u64,
        swap_fee: u64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, id, fee_recipient, platform_fee, referrer_fee, swap_fee)
    }

    pub fn set_swap_fee(ctx: Context<SetSwapFee>, new_fee: u64) -> Result<()> {
        instructions::set_swap_fee::handler(ctx, new_fee)
    }

    pub fn set_referrer_fee(ctx: Context<SetReferrerFee>, new_fee: u64) -> Result<()> {
        instructions::set_referrer_fee::handler(ctx, new_fee)
    }

    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, recipient: Pubkey) -> Result<()> {
        instructions::set_fee_recipient::handler(ctx, recipient)
    }

    pub fn set_platform_fee(ctx: Context<SetPlatformFee>, new_fee: u64) -> Result<()> {
        instructions::set_platform_fee::handler(ctx, new_fee)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
        instructions::transfer_ownership::handler(ctx, new_owner)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>, 
        settings: PoolSettings, 
        id: u64, 
        shares: u64, 
        assets: u64,
    ) -> Result<()> {
        instructions::create_pool::handler(ctx, settings, id, shares, assets)
    }

    pub fn preview_assets_in(ctx: Context<PreviewAssetsIn>, shares_out: u64) -> Result<u64> {
        instructions::preview_assets_in::handler(ctx, shares_out)
    }

    pub fn swap_assets_for_exact_shares(ctx: Context<SwapAssetsForExactShares>, recipient: Pubkey, shares_out: u64, max_assets_in: u64) -> Result<u64> {
        instructions::swap_assets_for_exact_shares::handler(ctx, recipient, shares_out, max_assets_in)
    }

    pub fn preview_shares_out(ctx: Context<PreviewSharesOut>, assets_in: u64) -> Result<u64> {
        instructions::preview_shares_out::handler(ctx, assets_in)
    }

    pub fn swap_exact_assets_for_shares(ctx: Context<SwapExactAssetsForShares>, recipient: Pubkey, assets_in: u64, min_shares_out: u64) -> Result<u64> {
        instructions::swap_exact_assets_for_shares::handler(ctx, recipient, assets_in, min_shares_out)
    }

    pub fn preview_assets_out(ctx: Context<PreviewAssetsOut>, shares_in: u64) -> Result<u64> {
        instructions::preview_assets_out::handler(ctx, shares_in)
    }

    pub fn swap_exact_shares_for_assets(ctx: Context<SwapExactSharesForAssets>, recipient: Pubkey, shares_in: u64, min_assets_out: u64) -> Result<u64> {
        instructions::swap_exact_shares_for_assets::handler(ctx, recipient, shares_in, min_assets_out)
    }

    pub fn preview_shares_in(ctx: Context<PreviewSharesIn>, assets_out: u64) -> Result<u64> {
        instructions::preview_shares_in::handler(ctx, assets_out)
    }

    pub fn swap_shares_for_exact_assets(ctx: Context<SwapSharesForExactAssets>, recipient: Pubkey, assets_out: u64, max_shares_in: u64) -> Result<u64> {
        instructions::swap_shares_for_exact_assets::handler(ctx, recipient, assets_out, max_shares_in)
    }

    pub fn redeem(ctx: Context<Redeem>, recipient: Pubkey) -> Result<()> {
        instructions::redeem::handler(ctx, recipient)
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        instructions::close::handler(ctx)
    }
}


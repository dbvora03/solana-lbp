
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

    pub fn set_platform_fee(ctx: Context<SetPlatformFee>, new_fee: u64) -> Result<()> {
        instructions::set_platform_fee::handler(ctx, new_fee)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
        instructions::transfer_ownership::handler(ctx, new_owner)
    }

    pub fn create_pool(ctx: Context<CreatePool>, settings: PoolSettings, id: u64, shares: u64, assets: u64) -> Result<()> {
        instructions::create_pool::handler(ctx, settings, id, shares, assets)
    }

    pub fn create_pool_dupe(ctx: Context<CreatePoolDupe>, shares: u64, assets: u64, id: u64) -> Result<()> {
        instructions::create_pool_dupe::handler(ctx, shares, assets)
    }

    pub fn preview_assets_in(ctx: Context<PreviewAssetsIn>, shares_out: u64) -> Result<u64> {
        instructions::preview_assets_in::handler(ctx, shares_out)
    }
}


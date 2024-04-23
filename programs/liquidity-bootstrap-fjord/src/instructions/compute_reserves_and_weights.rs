use std::process::Output;

use anchor_lang::prelude::{borsh::{BorshDeserialize, BorshSerialize}, *};
use crate::state::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{TokenAccount};
use crate::utils::*;

#[derive(Accounts)]
pub struct ComputeReservesAndWeights<'info> {
  pub pool: Account<'info, Pool>,

  pub pool_asset_vault: Account<'info, TokenAccount>,

  pub pool_share_vault: Account<'info, TokenAccount>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ComputeReservesAndWeightsOutput {
  pub asset_reserve: u64,
  pub share_reserve: u64,
  pub asset_weight: u64,
  pub share_weight: u64
}

pub fn handler(ctx: Context<ComputeReservesAndWeights>) -> Result<ComputeReservesAndWeightsOutput> {
    let pool = &mut ctx.accounts.pool;
    let assets: u64 = ctx.accounts.pool_asset_vault.amount;
    let shares: u64 = ctx.accounts.pool_share_vault.amount;
    let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
    // Ok((asset_reserve, share_reserve, asset_weight, share_weight))
    Ok(ComputeReservesAndWeightsOutput {
      asset_reserve,
      share_reserve,
      asset_weight,
      share_weight
    })
}
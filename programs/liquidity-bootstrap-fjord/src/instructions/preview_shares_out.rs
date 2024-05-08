use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{Mint, TokenAccount};
use crate::utils::*;

#[derive(Accounts)]
pub struct PreviewSharesOut<'info> {
  pub pool: Account<'info, Pool>,

  pub pool_assets_account: Account<'info, TokenAccount>,

  pub pool_shares_account: Account<'info, TokenAccount>,

  #[account(
    constraint = pool_assets_mint.key() == pool.settings.asset,
  )]
  pub pool_assets_mint: Account<'info, Mint>,

  #[account(
    constraint = pool_shares_mint.key() == pool.settings.share,
  )]
  pub pool_shares_mint: Account<'info, Mint>,

  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,
}

pub fn handler(ctx: Context<PreviewSharesOut>, assets_in: u64) -> Result<u64> {

  let pool = &mut ctx.accounts.pool;
  let lbp_factory_setting = &mut ctx.accounts.lbp_factory_setting;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  let assets_decimals = ctx.accounts.pool_assets_mint.decimals;
  let shares_decimals = ctx.accounts.pool_shares_mint.decimals;
  let shares_out_result = preview_shares_out(pool, assets_in, assets, shares, assets_decimals, shares_decimals);
  if shares_out_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let mut shares_out: u64 = shares_out_result.unwrap();

  Ok(shares_out)
}
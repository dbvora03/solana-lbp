use anchor_lang::prelude::*;
use crate::state::*;
use anchor_spl::token::{TokenAccount};
use crate::utils::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Math Error")]
  MathError,
}

#[derive(Accounts)]
pub struct PreviewAssetsIn<'info> {
  #[account(mut)]
  pub pool: Account<'info, Pool>,

  #[account(mut)]
  pub pool_assets_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub pool_shares_account: Account<'info, TokenAccount>,

  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
}

pub fn handler(ctx: Context<PreviewAssetsIn>, shares_out: u64) -> Result<u64> {

  let pool = &mut ctx.accounts.pool;
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  let mut assets_in_result = preview_assets_in(pool, shares_out, shares, assets);
  if assets_in_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let mut assets_in: u64 = assets_in_result.unwrap();

  assets_in = assets_in * (1_000_000_000 + lbp_manager_info.swap_fee);

  Ok(assets_in)
}
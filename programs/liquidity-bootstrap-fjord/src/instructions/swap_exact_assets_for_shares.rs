use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Transfer};
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

use anchor_lang::error_code;


#[event]
pub struct Buy {
  pub caller: Pubkey,
  pub assets: u64,
  pub shares: u64,
  pub swap_fee: u64,
}

#[derive(Accounts)]
#[instruction(referrer: Pubkey)]
pub struct SwapExactAssetsForShares<'info> {
  #[account(mut)]
  pub depositor: Signer<'info>,

  #[account(mut)]
  pub pool: Account<'info, Pool>,

  #[account(mut)]
  pub pool_assets_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub pool_shares_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub depositor_asset_account: Account<'info, TokenAccount>,

  #[account(
    init,
    seeds = [
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &depositor.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump
  )]
  pub buyer_stats: Box<Account<'info, UserStats>>,

  #[account(
    init,
    seeds = [
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &referrer.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump,
  )]
  pub referrer_stats: Box<Account<'info, UserStats>>,

  pub lbp_manager_info: Account<'info, LBPManagerInfo>,

  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}


pub fn handler(
  ctx: Context<SwapExactAssetsForShares>,
  assets_in: u64,
  min_shares_out: u64,
  recipient: Pubkey,
  referrer: Pubkey  
) -> Result<u64> {

  let pool = &mut ctx.accounts.pool;
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;

  let swap_fee: u64 = assets_in * (lbp_manager_info.swap_fee);
  pool.total_swap_fees_asset += swap_fee;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;
  let buyer_stats = &mut ctx.accounts.buyer_stats;
  let referrer_stats = &mut ctx.accounts.referrer_stats;


  let shares_out_result = preview_shares_out(pool, assets_in, assets, shares);
  if shares_out_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let mut shares_out = shares_out_result.unwrap();

  if shares_out < min_shares_out {
    return err!(ErrorCode::SlippageExceeded);
  }

  if assets + assets_in - swap_fee >= pool.settings.max_assets_in {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_asset_account.to_account_info(),
            to: ctx.accounts.pool_assets_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    ),
    assets_in,
  )?;

  let total_purchased_after = pool.total_purchased + shares_out;

  if total_purchased_after >= pool.settings.max_shares_out || total_purchased_after > shares {
    return err!(ErrorCode::MaxSharesExceeded);
  }

  pool.total_purchased = total_purchased_after;
  buyer_stats.purchased += shares_out;

  if recipient != Pubkey::default() && lbp_manager_info.referrer_fee > 0 {
    let assets_referred: u64 = assets_in * lbp_manager_info.referrer_fee;
    referrer_stats.referred_amount += assets_referred;
  }

  Ok(assets_in) 
}
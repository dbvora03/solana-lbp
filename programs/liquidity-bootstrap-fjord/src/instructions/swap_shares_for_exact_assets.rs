use anchor_spl::token::{self, TokenAccount, Transfer, Token};
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::*;
use crate::state::*;

#[derive(Accounts)]
pub struct SwapSharesForExactAssets<'info> {
  #[account(mut)]
  pub depositor: Signer<'info>,

  #[account(
    mut,
    constraint = pool.lbp_manager == lbp_manager_info.key()
  )]
  pub pool: Account<'info, Pool>,

  #[account(
    mut,
    constraint = pool_assets_account.mint == pool.settings.asset,
    constraint = pool_assets_account.owner == pool.to_account_info().key(),
  )]
  pub pool_assets_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = pool_shares_account.mint == pool.settings.share,
    constraint = pool_shares_account.owner == pool.to_account_info().key(),
  )]
  pub pool_shares_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_assets_account.mint == pool.settings.asset,
    constraint = depositor_assets_account.owner == depositor.key(),
  )]
  pub depositor_assets_account: Account<'info, TokenAccount>,

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

  #[account(mut)]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,

  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}

pub fn handler(
  ctx: Context<SwapSharesForExactAssets>,
  assets_out: u64,
  max_shares_in: u64,
  recipient: Pubkey,
) -> Result<u64> {

  let pool = &mut ctx.accounts.pool;
  let manager = &mut ctx.accounts.lbp_manager_info;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;
  let buyer_stats = &mut ctx.accounts.buyer_stats;

  let mut shares_in_result = preview_shares_in(pool, assets_out, assets, shares);

  if shares_in_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let mut shares_in: u64 = shares_in_result.unwrap();

  let swap_fee = shares_in * manager.swap_fee;
  shares_in += swap_fee;

  if shares_in > max_shares_in {
    return err!(ErrorCode::SlippageExceeded);
  }

  if assets >= pool.settings.max_assets_in {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  let total_purchased_before = pool.total_purchased;

  if total_purchased_before >= pool.settings.max_shares_out || total_purchased_before > shares {
    return err!(ErrorCode::MaxSharesExceeded);
  }

  buyer_stats.purchased -= shares_in;

  pool.total_purchased = total_purchased_before - shares_in;

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_assets_account.to_account_info(),
            to: ctx.accounts.depositor_assets_account.to_account_info(),
            authority: ctx.accounts.pool_shares_account.to_account_info(),
        },
    ),
    assets_out,
  )?;

  emit!(Sell {
    caller: *ctx.accounts.depositor.to_account_info().key,
    shares: shares_in,
    assets: assets_out,
    swap_fee: swap_fee
  });

  Ok(shares_in)
}
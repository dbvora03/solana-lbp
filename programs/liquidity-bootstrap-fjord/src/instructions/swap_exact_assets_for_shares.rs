use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Transfer};
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;


#[event]
pub struct Buy {
  pub caller: Pubkey,
  pub assets: u64,
  pub shares: u64,
  pub swap_fee: u64,
}

#[derive(Accounts)]
#[instruction(referrer: Pubkey, recipient: Pubkey)]
pub struct SwapExactAssetsForShares<'info> {

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
    constraint = depositor_asset_account.mint == pool.settings.asset,
    constraint = depositor_asset_account.owner == depositor.key(),
  )]
  pub depositor_asset_account: Account<'info, TokenAccount>,

  #[account(
    init_if_needed,
    seeds = [
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &recipient.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump
  )]
  pub buyer_stats: Box<Account<'info, UserStats>>,

  #[account(
    init_if_needed,
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
  referrer: Pubkey,
  recipient: Pubkey,
  depositor: Pubkey,
  assets_in: u64,
  min_shares_out: u64,
) -> Result<u64> {
  let pool = &mut ctx.accounts.pool;
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;
  let buyer_stats = &mut ctx.accounts.buyer_stats;
  let referrer_stats = &mut ctx.accounts.referrer_stats;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;
  
  let swap_fee: u64 = assets_in * (lbp_manager_info.swap_fee / 1_000_000_000);
  pool.total_swap_fees_asset += swap_fee;

  let shares_out_result = preview_shares_out(pool, assets_in, assets, shares);
  if shares_out_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let shares_out = shares_out_result.unwrap();

  if shares_out < min_shares_out {
    return err!(ErrorCode::SlippageExceeded);
  }

  if assets + assets_in - swap_fee >= pool.settings.max_assets_in {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  let from = ctx.accounts.depositor_asset_account.to_account_info();
  let to = ctx.accounts.pool_assets_account.to_account_info();

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

  // let total_purchased_after = pool.total_purchased + shares_out;

  // if total_purchased_after >= pool.settings.max_shares_out || total_purchased_after > shares {
  //   return err!(ErrorCode::MaxSharesExceeded);
  // }

  // pool.total_purchased = total_purchased_after;
  // buyer_stats.purchased += shares_out;

  // if referrer != Pubkey::default() && lbp_manager_info.referrer_fee > 0 {
  //   let assets_referred: u64 = assets_in * lbp_manager_info.referrer_fee;
  //   pool.total_referred += assets_referred;
  //   referrer_stats.referred_amount += assets_referred;
  // }

  // emit!(Buy {
  //   caller: *ctx.accounts.depositor.key,
  //   assets: assets_in,
  //   shares: shares_out,
  //   swap_fee: swap_fee,
  // });

  let assets_in = 0;
  Ok(assets_in) 
}
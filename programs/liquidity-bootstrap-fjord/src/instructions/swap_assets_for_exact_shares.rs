use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};
use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::*;
#[derive(Accounts)]
#[instruction(recipient: Pubkey)]
pub struct SwapAssetsForExactShares<'info> {
  #[account(mut)]
  pub depositor: Signer<'info>,

  #[account(
    mut,
    constraint = pool.lbp_factory == lbp_factory_setting.key()
  )]
  pub pool: Account<'info, Pool>,

  #[account(
    mut,
    constraint = pool_assets_account.mint == pool.settings.asset,
    constraint = pool_assets_account.owner == pool.asset_vault_authority,
  )]
  pub pool_assets_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = pool_shares_account.mint == pool.settings.share,
    constraint = pool_shares_account.owner == pool.share_vault_authority,
  )]
  pub pool_shares_account: Account<'info, TokenAccount>,

  #[account(
    constraint = pool_assets_mint.key() == pool.settings.asset,
  )]
  pub pool_assets_mint: Account<'info, Mint>,

  #[account(
    constraint = pool_shares_mint.key() == pool.settings.share,
  )]
  pub pool_shares_mint: Account<'info, Mint>,
  
  #[account(
    mut,
    constraint = depositor_assets_account.mint == pool.settings.asset,
    constraint = depositor_assets_account.owner == depositor.key(),
  )]
  pub depositor_assets_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    seeds = [b"user_stats".as_ref(), pool.key().as_ref(), recipient.as_ref()],
    bump = recipient_user_stats.bump,
  )]
  pub recipient_user_stats: Box<Account<'info, UserStats>>,

  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,
  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}
pub fn handler (
  ctx: Context<SwapAssetsForExactShares>,
  recipient: Pubkey,
  shares_out: u64,
  max_assets_in: u64,
) -> Result<u64> {
  // Get the pool and manager
  let pool = &mut ctx.accounts.pool;
  let factory_setting = &mut ctx.accounts.lbp_factory_setting;
  let recipient_user_stats = &mut ctx.accounts.recipient_user_stats;
  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  if pool.closed {
    return err!(ErrorCode::PoolIsClosed);
  }

  if pool.paused {
    return err!(ErrorCode::PoolIsPaused);
  }
  
  // Preview the assets in
  let assets_decimals = ctx.accounts.pool_assets_mint.decimals;
  let shares_decimals = ctx.accounts.pool_shares_mint.decimals;
  let assets_in_result = preview_assets_in(pool, shares_out, assets, shares, assets_decimals, shares_decimals);
  if assets_in_result.is_err() {
    return err!(ErrorCode::MathError);
  }
  let mut assets_in = assets_in_result.unwrap();

  let swap_fees: u64 = (assets_in * factory_setting.swap_fee) / 1_000_000_000;
  assets_in += swap_fees;
  pool.total_swap_fees_asset += swap_fees;

  // Add slippage error function
  if assets_in > max_assets_in {
    return err!(ErrorCode::SlippageExceeded);
  }

  // Call the swapAssetsForExactShares function 
  if assets + assets_in - swap_fees >= pool.settings.max_assets_in {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_assets_account.to_account_info(),
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
  recipient_user_stats.purchased += shares_out;

  emit!(Buy {
    caller: *ctx.accounts.depositor.key,
    recipient: recipient,
    assets: assets_in,
    shares: shares_out,
    swap_fee: swap_fees,
  });
  Ok(assets_in)
}
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, TokenAccount, Token, Transfer};
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(recipient: Pubkey)]
pub struct SwapExactAssetsForShares<'info> {

  #[account(mut)]
  pub depositor: Signer<'info>,

  #[account(
    mut,
    constraint = pool.lbp_factory == lbp_factory_setting.key()
  )]
  pub pool: Account<'info, Pool>,

  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,

  #[account(
    mut,
    constraint = pool_share_vault.mint == pool.settings.share,
    constraint = pool_share_vault.owner == pool.share_vault_authority,
  )]
  pub pool_share_vault: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = pool_asset_vault.mint == pool.settings.asset,
    constraint = pool_asset_vault.owner == pool.asset_vault_authority,
  )]
  pub pool_asset_vault: Account<'info, TokenAccount>,

  #[account(
    constraint = pool_assets_mint.key() == pool.settings.asset,
  )]
  pub pool_assets_mint: Account<'info, Mint>,

  #[account(
    constraint = pool_shares_mint.key() == pool.settings.share,
  )]
  pub pool_shares_mint: Account<'info, Mint>,

  /// CHECK: This is not dangerous because we don't read or write from this account
  #[account(
    mut,
    constraint = depositor_asset_vault.mint == pool.settings.asset,
    constraint = depositor_asset_vault.owner == depositor.key(),
  )]
  pub depositor_asset_vault: Account<'info, TokenAccount>,

  #[account(   
    mut,
    seeds = [b"user_stats".as_ref(), pool.key().as_ref(), recipient.as_ref()],
    bump = recipient_user_stats.bump,
  )]
  pub recipient_user_stats: Box<Account<'info, UserStats>>,

  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}


pub fn handler(
  ctx: Context<SwapExactAssetsForShares>,
  recipient: Pubkey,
  assets_in: u64,
  min_shares_out: u64,
) -> Result<u64> {
  let pool = &mut ctx.accounts.pool;
  let lbp_factory_setting = &mut ctx.accounts.lbp_factory_setting;
  let recipient_user_stats = &mut ctx.accounts.recipient_user_stats;

  let assets: u64 = ctx.accounts.pool_asset_vault.amount;
  let shares: u64 = ctx.accounts.pool_share_vault.amount;

  if pool.closed {
    return err!(ErrorCode::PoolIsClosed);
  }

  if pool.paused {
    return err!(ErrorCode::PoolIsPaused);
  }
  
  let swap_fee: u64 = (assets_in * lbp_factory_setting.swap_fee) / 1_000_000_000;
  pool.total_swap_fees_asset += swap_fee;

  let assets_decimals = ctx.accounts.pool_assets_mint.decimals;
  let shares_decimals = ctx.accounts.pool_shares_mint.decimals;
  let shares_out_result = preview_shares_out(pool, assets_in, assets, shares, assets_decimals, shares_decimals);
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

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_asset_vault.to_account_info(),
            to: ctx.accounts.pool_asset_vault.to_account_info(),
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
    swap_fee: swap_fee,
  });

  Ok(assets_in) 
}
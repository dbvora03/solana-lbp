use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};

#[derive(Accounts)]
pub struct Close<'info> {

  #[account(mut)]
  pub pool: Box<Account<'info, Pool>>,

  #[account(mut)]
  pub asset_vault: Account<'info, TokenAccount>,

  /// CHECK: This is not dangerous because we don't read or write from this account
  #[account(
    seeds = [
      b"asset".as_ref(), 
      pool.to_account_info().key.as_ref()
    ],
    bump = pool.asset_vault_nonce,
  )]
  pub asset_vault_authority: AccountInfo<'info>,

  #[account(mut)]
  pub share_vault: Account<'info, TokenAccount>,

  /// CHECK: This is not dangerous because we don't read or write from this account
  #[account(
    seeds = [
      b"share".as_ref(), 
      pool.to_account_info().key.as_ref()
    ],
    bump = pool.share_vault_nonce,
  )]
  pub share_vault_authority: AccountInfo<'info>,

  #[account(
    mut,
    constraint = pool_owner_asset_vault.owner == pool.owner
  )]
  pub pool_owner_asset_vault: Account<'info, TokenAccount>,
  
  #[account(
    mut,
    constraint = pool_owner_share_vault.owner == pool.owner
  )]
  pub pool_owner_share_vault: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = fee_recipient_asset_vault.owner == lbp_manager_info.fee_recipient
  )]
  pub fee_recipient_asset_vault: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = fee_recipient_share_vault.owner == lbp_manager_info.fee_recipient
  )]
  pub fee_recipient_share_vault: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = pool.lbp_manager == lbp_manager_info.key()
  )]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Close>) -> Result<()> {
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;
  let assets: u64 = ctx.accounts.asset_vault.amount;
  let shares: u64 = ctx.accounts.share_vault.amount;

  if ctx.accounts.pool.closed {
    return err!(ErrorCode::ClosingDisallowed);
  }

  let unix_timestamp = match Clock::get() {
    Ok(clock) => clock.unix_timestamp,
    Err(_) => return err!(ErrorCode::ClockError),
  };

  // if (unix_timestamp as i128) < (ctx.accounts.pool.settings.sale_end as i128) {
  //   return err!(ErrorCode::ClosingDisallowed);
  // }

  // 1. Calculation
  let total_assets = assets - ctx.accounts.pool.total_swap_fees_asset;
  let platform_fees = total_assets * (lbp_manager_info.platform_fee / 1_000_000_000);
  let total_assets_minus_fees = total_assets - platform_fees;

  // 2. Transfer fees to fee recipient
  let asset_seeds = &[
      b"asset".as_ref(),
      ctx.accounts.pool.to_account_info().key.as_ref(),
      &[ctx.accounts.pool.asset_vault_nonce],
    ];
  let asset_signer = &[&asset_seeds[..]];

  let share_seeds = &[
      b"share".as_ref(),
      ctx.accounts.pool.to_account_info().key.as_ref(),
      &[ctx.accounts.pool.share_vault_nonce],
    ];
  let share_signer = &[&share_seeds[..]];

  token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {  
            from: ctx.accounts.asset_vault.to_account_info(),
            to: ctx.accounts.fee_recipient_asset_vault.to_account_info(),
            authority: ctx.accounts.asset_vault_authority.to_account_info(),
        },
        asset_signer,
    ),
    platform_fees + ctx.accounts.pool.total_swap_fees_asset,
  )?;

  token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {  
            from: ctx.accounts.share_vault.to_account_info(),
            to: ctx.accounts.fee_recipient_share_vault.to_account_info(), // fee reciever
            authority: ctx.accounts.share_vault_authority.to_account_info(),
        },
        share_signer
    ),
    ctx.accounts.pool.total_swap_fees_share 
  )?;

  // 3. Transfer assets and unsold shares to pool owner
  token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {  
            from: ctx.accounts.asset_vault.to_account_info(),
            to: ctx.accounts.pool_owner_asset_vault.to_account_info(), // fee reciever
            authority: ctx.accounts.asset_vault_authority.to_account_info(),
        },
        asset_signer
    ),
    total_assets_minus_fees,
  )?;

  let unsold_shares = shares - ctx.accounts.pool.total_purchased;

  if unsold_shares != 0 {

    token::transfer(
      CpiContext::new_with_signer(
          ctx.accounts.token_program.to_account_info(),
          Transfer {  
              from: ctx.accounts.share_vault.to_account_info(),
              to: ctx.accounts.pool_owner_share_vault.to_account_info(),
              authority: ctx.accounts.share_vault_authority.to_account_info(),
          },
          share_signer,
      ),
      unsold_shares,
    )?;

  }

  ctx.accounts.pool.closed = true;

  emit!(ClosePool {
    platform_fees: platform_fees,
    swap_fees_asset: ctx.accounts.pool.total_swap_fees_asset,
    swap_fees_share: ctx.accounts.pool.total_swap_fees_share,
  });

  Ok(())
}
use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Mint, Token};

#[derive(Accounts)]
#[instruction(settings: PoolSettings, id: u64)]
pub struct CreatePool<'info> {

  #[account(zero)]
  pub pool: Box<Account<'info, Pool>>,

  #[account(mut)]
  pub asset_vault: Account<'info, TokenAccount>,
  #[account(mut)]
  pub share_vault: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_asset_vault.mint == asset_vault.mint,
    constraint = depositor_asset_vault.owner == depositor.key(),
  )]
  pub depositor_asset_vault: Account<'info, TokenAccount>,

  #[account(mut)]
  pub depositor_share_vault: Account<'info, TokenAccount>,
  
  #[account(mut)]
  pub depositor: Signer<'info>,

  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,

  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}


pub fn handler(
  ctx: Context<CreatePool>, 
  settings: PoolSettings, 
  id: u64, 
  shares: u64, 
  assets: u64,
  share_vault_nonce: u8,
  asset_vault_nonce: u8,
) -> Result<()> {
  let pool = &mut ctx.accounts.pool;
  if pool.initialized {
    return err!(ErrorCode::AlreadyInitialized);
  }
  
  if settings.share == settings.asset || settings.share == Pubkey::default() || settings.asset == Pubkey::default() {
    return err!(ErrorCode::InvalidAssetOrShare);
  }

  if settings.sale_end < settings.vest_end {
    if settings.sale_end > settings.vest_cliff {
      return err!(ErrorCode::InvalidVestCliff);
    }
    if settings.vest_cliff >= settings.vest_end {
      return err!(ErrorCode::InvalidVestEnd);
    }
  }

  if settings.weight_start < (0.01 * 1_000_000_000.0) as u64 || settings.weight_start > (0.99 * 1_000_000_000.0) as u64
    || settings.weight_end < (0.01 * 1_000_000_000.0) as u64 || settings.weight_end > (0.99 * 1_000_000_000.0) as u64 {
    return err!(ErrorCode::InvalidWeightConfig);
  }

  if assets == 0 && settings.virtual_assets == 0 {
    return err!(ErrorCode::InvalidAssetValue);
  }

  pool.id = id;
  pool.owner = *ctx.accounts.depositor.to_account_info().key;
  pool.lbp_factory = *ctx.accounts.lbp_factory_setting.to_account_info().key;
  pool.settings = settings;
  pool.initialized = true;
  pool.closed = false;
  pool.total_swap_fees_asset = 0;
  pool.total_swap_fees_share = 0;
  pool.total_purchased = 0;
  pool.share_vault_nonce = share_vault_nonce;
  pool.asset_vault_nonce = asset_vault_nonce;
  pool.share_vault_authority = ctx.accounts.share_vault.owner;
  pool.asset_vault_authority = ctx.accounts.asset_vault.owner;
  pool.share_vault = *ctx.accounts.share_vault.to_account_info().key;
  pool.asset_vault = *ctx.accounts.asset_vault.to_account_info().key;

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_asset_vault.to_account_info(),
            to: ctx.accounts.asset_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    ),
    assets,
  )?;

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_share_vault.to_account_info(),
            to: ctx.accounts.share_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info().clone(),
        },
    ),
    shares,
  )?;

  emit!(PoolCreated {
    pool: *ctx.accounts.pool.to_account_info().key,
  });

  Ok(())
}
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Mint, Token};


#[derive(Accounts)]
#[instruction(settings: PoolSettings, id: u64)]
pub struct CreatePool<'info> {

    #[account(mut)]
    pub depositor: Signer<'info>,

    asset_mint: Account<'info, Mint>,
    share_mint: Account<'info, Mint>,

    #[account(
      mut,
      constraint = depositor_account_asset.mint == settings.asset,
      constraint = depositor_account_asset.mint == asset_mint.key(),
      constraint = depositor_account_asset.owner == depositor.key()
    )]
    pub depositor_account_asset:  Account<'info, TokenAccount>,

    #[account(
      mut, 
      constraint = depositor_account_share.mint == settings.share,
      constraint = depositor_account_share.mint == share_mint.key(),
      constraint = depositor_account_share.owner == depositor.key()
    )]
    pub depositor_account_share:  Account<'info, TokenAccount>,

    // The liquidity pool manager info account
    pub lbp_manager_info: Account<'info, LBPManagerInfo>,
    #[account(
      init,
      seeds = [
        b"pool".as_ref(),
        &lbp_manager_info.to_account_info().key().to_bytes(),
        &asset_mint.key().as_ref(),
        &share_mint.key().as_ref()
      ],
      payer = depositor,
      space = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + (1 + 8 + 8 + 1),
      bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
      init,
      payer = depositor,
      token::mint = asset_mint,
      token::authority = pool,
    )]
    pub pool_account_asset:  Account<'info, TokenAccount>,

    #[account(
      init,
      payer = depositor,
      token::mint = share_mint,
      token::authority = pool,
    )]
    pub pool_account_share:  Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}


pub fn handler(ctx: Context<CreatePool>, settings: PoolSettings, shares: u64, assets: u64) -> Result<()> {
  let pool = &mut ctx.accounts.pool;
  if pool.initialized {
    return err!(ErrorCode::AlreadyInitialized);
  }

  // if settings.share.to_string() == settings.asset.to_string() {
  //   return err!(ErrorCode::AlreadyInitialized);
  // }

  // TODO: Do all the validation in here
  pool.settings = settings;
  pool.initialized = true;
  pool.bump = ctx.bumps.pool;

  token::transfer(
      CpiContext::new(
          ctx.accounts.token_program.to_account_info(),
          Transfer {
              from: ctx.accounts.depositor_account_asset.to_account_info(),
              to: ctx.accounts.pool_account_asset.to_account_info(),
              authority: ctx.accounts.depositor.to_account_info(),
          },
      ),
      assets,
  )?;

  token::transfer(
      CpiContext::new(
          ctx.accounts.token_program.to_account_info(),
          Transfer {
              from: ctx.accounts.depositor_account_share.to_account_info(),
              to: ctx.accounts.pool_account_share.to_account_info(),
              authority: ctx.accounts.depositor.to_account_info(),
          },
      ),
      shares,
  )?;

  Ok(())
}
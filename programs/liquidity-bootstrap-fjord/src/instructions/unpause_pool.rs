use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};

#[derive(Accounts)]
pub struct UnpausePool<'info> {

  #[account(mut)]
  pub pool: Box<Account<'info, Pool>>,

  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UnpausePool>) -> Result<()> {
  let pool = &mut ctx.accounts.pool;

  if pool.owner != *ctx.accounts.authority.key {
    return err!(ErrorCode::Unauthorized);
  }

  if pool.closed {
    return err!(ErrorCode::PoolIsClosed);
  }

  if ctx.accounts.pool.paused {
    ctx.accounts.pool.paused = false;
  }

  Ok(())
}
use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction()]
pub struct CreateUserStats<'info> {
  #[account(zero)]
  pub user_stats: Box<Account<'info, UserStats>>,

  #[account(mut)]
  pub pool: Account<'info, Pool>,

  pub system_program: Program<'info, System>,
}

pub fn handler(
  ctx: Context<CreateUserStats>,
  depositor: Pubkey,
) -> Result<()> {

  let user_stats = &mut ctx.accounts.user_stats;

  user_stats.depositor = depositor;
  user_stats.pool = ctx.accounts.pool.key();
  user_stats.purchased = 0;
  user_stats.claimed = 0;

  Ok(())
}
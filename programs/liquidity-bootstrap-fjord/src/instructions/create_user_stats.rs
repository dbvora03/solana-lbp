use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct CreateUserStats<'info> {
  #[account(mut)]
  pub user: Signer<'info>,

  pub pool: Account<'info, Pool>,

  #[account(
    init,
    seeds = [b"user_stats".as_ref(), pool.key().as_ref(), user.key().as_ref()],
    bump,
    payer = user,
    space = 32 + 8 + 8 + 1,
  )]
  pub user_stats: Box<Account<'info, UserStats>>,

  pub system_program: Program<'info, System>,
}

pub fn handler(
  ctx: Context<CreateUserStats>
) -> Result<()> {

  let user_stats = &mut ctx.accounts.user_stats;

  user_stats.purchased = 0;
  user_stats.claimed = 0;
  user_stats.bump = ctx.bumps.user_stats;

  Ok(())
}
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateUserStats<'info> {

  #[account(mut)]
  pub signer: Signer<'info>,

  #[account(
    init,
    seeds = [
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &signer.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump
  )]
  pub user_stats: Box<Account<'info, UserStats>>,
  pub pool: Account<'info, Pool>,
}

pub fn handler(
  ctx: Context<CreateUserStats>,
) {

  let user_stats = &mut ctx.accounts.user_stats;

  user_stats.depositor = *ctx.accounts.signer.key;
  user_stats.pool = *ctx.accounts.pool.key;
  user_stats.purchased = 0;
  user_stats.claimed = 0;
  user_stats.bump = ctx.bumps.user_stats
}
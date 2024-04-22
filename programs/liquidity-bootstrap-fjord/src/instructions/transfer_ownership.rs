use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
  let lbp_factory_setting = &mut ctx.accounts.lbp_factory_setting;
  lbp_factory_setting.authority = new_owner;
  Ok(())
}
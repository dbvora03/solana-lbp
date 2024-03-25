use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;
  lbp_manager_info.authority = new_owner;
  Ok(())
}
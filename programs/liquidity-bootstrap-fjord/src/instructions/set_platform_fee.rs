use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct SetPlatformFee<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetPlatformFee>, new_fee: u64) -> Result<()> {
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;
  lbp_manager_info.platform_fee = new_fee;
  Ok(())
}
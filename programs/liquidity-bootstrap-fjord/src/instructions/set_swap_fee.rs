use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::*;

const MAX_FEE_BIPS: f64 = 0.1 * 10_000.0;

#[derive(Accounts)]
pub struct SetSwapFee<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetSwapFee>, new_fee: u64) -> Result<()> {
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;

  if new_fee > MAX_FEE_BIPS as u64 {
    return err!(ErrorCode::MaxFeeExceeded);
  }

  lbp_manager_info.swap_fee = new_fee;

  emit!(SwapFeeSet {
    swap_fee: new_fee,
  });

  Ok(())
}
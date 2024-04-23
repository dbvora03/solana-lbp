use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::*;

const MAX_FEE_BIPS: f64 = 0.1 * 10_000.0;

#[derive(Accounts)]
pub struct SetReferrerFee<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetReferrerFee>, new_fee: u64) -> Result<()> {
  let lbp_factory_setting = &mut ctx.accounts.lbp_factory_setting;

  if new_fee > MAX_FEE_BIPS as u64 {
    return err!(ErrorCode::MaxFeeExceeded);
  }

  lbp_factory_setting.referrer_fee = new_fee;

  emit!(ReferrerFeeSet {
    referrer_fee: new_fee,
  });

  Ok(())
}
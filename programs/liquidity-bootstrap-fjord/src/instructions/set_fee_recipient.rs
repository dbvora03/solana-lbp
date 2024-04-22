use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_factory_setting: Account<'info, LBPFactorySetting>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetFeeRecipient>, recipient: Pubkey) -> Result<()> {
  let lbp_factory_setting = &mut ctx.accounts.lbp_factory_setting;

  lbp_factory_setting.fee_recipient = recipient;

  emit!(FeeRecipientSet {
    fee_recipient: recipient,
  });

  Ok(())
}
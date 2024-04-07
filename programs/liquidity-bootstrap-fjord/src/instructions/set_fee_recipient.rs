use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
  #[account(mut, has_one = authority)]
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetFeeRecipient>, recipient: Pubkey) -> Result<()> {
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;

  lbp_manager_info.fee_recipient = recipient;

  emit!(FeeRecipientSet {
    fee_recipient: recipient,
  });

  Ok(())
}
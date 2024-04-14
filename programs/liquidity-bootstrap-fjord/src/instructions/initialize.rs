use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

const MAX_FEE_BIPS: f64 = 0.1 * 10_000.0;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct Initialize<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init,
    payer = authority,
    seeds = [b"lbp-manager".as_ref(), &id.to_le_bytes()],
    space = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 1,
    bump,
  )]
  pub lbp_manager_info: Box<Account<'info, LBPManagerInfo>>,
  pub system_program: Program<'info, System>,
}

pub fn handler(
  ctx: Context<Initialize>,
  id: u64,
  fee_recipient: Pubkey,
  platform_fee: u64,
  referrer_fee: u64,
  swap_fee: u64,
) -> Result<()> {
  let factory_settings = &mut ctx.accounts.lbp_manager_info;

  if 
    platform_fee > MAX_FEE_BIPS as u64 ||
    referrer_fee > MAX_FEE_BIPS as u64 ||
    swap_fee > MAX_FEE_BIPS as u64
  {
    return err!(ErrorCode::MaxFeeExceeded);
  }

  factory_settings.id = id;
  factory_settings.bump = ctx.bumps.lbp_manager_info;
  factory_settings.authority = *ctx.accounts.authority.key;
  factory_settings.fee_recipient = fee_recipient;
  factory_settings.platform_fee = platform_fee;
  factory_settings.referrer_fee = referrer_fee;
  factory_settings.swap_fee = swap_fee;

  emit!(FeeRecipientSet {
    fee_recipient,
  });

  emit!(PlatformFeeSet {
    platform_fee,
  });

  emit!(ReferrerFeeSet {
    referrer_fee,
  });

  emit!(SwapFeeSet {
    swap_fee,
  });

  msg!("LBP Manager initialized");

  Ok(())
}
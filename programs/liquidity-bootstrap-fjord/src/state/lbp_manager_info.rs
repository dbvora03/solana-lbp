use anchor_lang::prelude::*;

#[account]
pub struct LBPManagerInfo {
  pub id: u64, // 8
  pub authority: Pubkey, // 32
  pub fee_recipient: Pubkey, // 32
  pub platform_fee: u64, // 8
  pub referrer_fee: u64, // 8
  pub swap_fee: u64, // 8
  pub bump: u8, // 1
}
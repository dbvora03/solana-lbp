use anchor_lang::prelude::*;

#[account]
pub struct UserStats {
  pub depositor: Pubkey, // 32
  pub pool: Pubkey, // 32
  pub purchased: u64, // 8 -> this is the purchased shares
  pub claimed: u64, // 8
  pub bump: u8, // 1
}
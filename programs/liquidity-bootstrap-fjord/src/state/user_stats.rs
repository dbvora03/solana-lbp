use anchor_lang::prelude::*;

#[account]
pub struct UserStats {
  pub depositor: Pubkey, // 32
  pub pool: Pubkey, // 32
  pub purchased: u64, // 8
  pub referred_amount: u64, // 8
  pub bump: u8, // 1
}
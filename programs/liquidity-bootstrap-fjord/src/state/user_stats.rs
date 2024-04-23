use anchor_lang::prelude::*;

#[account]
pub struct UserStats {
  // Note that we don't need to store user and pool because they already in pda, including this allows attackers set them arbitrarily
  pub purchased: u64, // 8 -> this is the purchased shares
  pub claimed: u64, // 8
  pub bump: u8, // 1
}
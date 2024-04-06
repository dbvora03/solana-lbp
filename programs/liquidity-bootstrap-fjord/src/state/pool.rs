use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolSettings {
  pub asset: Pubkey, // 32
  pub share: Pubkey, // 32
  pub creator: Pubkey, // 32
  pub virtual_assets: u64, // 8
  pub virtual_shares: u64, // 8
  pub max_share_price: u64, // 8
  pub max_shares_out: u64, // 8
  pub max_assets_in: u64, // 8
  pub weight_start: u64, // 8
  pub weight_end: u64, // 8
  pub sale_start: u64, // 8
  pub sale_end: u64, // 8
  pub vest_cliff: u64, // 8
  pub vest_end: u64, // 8
  pub selling_allowed: bool, // 1
}

#[account]
pub struct Pool {
  pub settings: PoolSettings,
  pub initialized: bool,
  pub total_swap_fees_asset: u64;
  pub total_purchased: u64;
  pub bump: u8, // 1
}
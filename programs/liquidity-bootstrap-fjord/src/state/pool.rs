use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PoolSettings {
  pub asset: Pubkey, // 32
  pub share: Pubkey, // 32
  pub creator: Pubkey, // 32
  pub virtualAssets: u64, // 8
  pub virtualShares: u64, // 8
  pub maxSharePrice: u64, // 8
  pub maxSharesOut: u64, // 8
  pub maxAssetsIn: u64, // 8
  pub weightStart: u64, // 8
  pub weightEnd: u64, // 8
  pub saleStart: u64, // 8
  pub saleEnd: u64, // 8
  pub vestCliff: u64, // 8
  pub vestEnd: u64, // 8
  pub sellingAllowed: bool, // 1
  pub whitelistMerkleRoot: Pubkey, // 32
}

#[account]
pub struct Pool {
  pub settings: PoolSettings,
  pub initialized: bool,
  pub bump: u8, // 1
}
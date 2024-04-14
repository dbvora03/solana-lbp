use anchor_lang::prelude::*;

// Factory related Events

#[event]
pub struct PoolCreated {
  pub pool: Pubkey
}

#[event]
pub struct SwapFeeSet {
  pub swap_fee: u64
}

#[event]
pub struct ReferrerFeeSet {
  pub referrer_fee: u64
}

#[event]
pub struct PlatformFeeSet {
  pub platform_fee: u64
}

#[event]
pub struct FeeRecipientSet {
  pub fee_recipient: Pubkey
}


// Pool related Events
#[event]
pub struct Buy {
  pub caller: Pubkey,
  pub assets: u64,
  pub shares: u64,
  pub swap_fee: u64,
}

#[event]
pub struct Sell {
  pub caller: Pubkey,
  pub shares: u64,
  pub assets: u64,
  pub swap_fee: u64,
}

#[event]
pub struct ClosePool {
  pub platform_fees: u64,
  pub swap_fees_asset: u64,
  pub swap_fees_share: u64,
}

#[event]
pub struct Redeemed {
  pub recipient: Pubkey,
  pub shares: u64,
  pub total_claimed: u64,
}
use anchor_lang::error_code;

#[error_code]
pub enum ErrorCode {

  #[msg("Max Fee Exceeded")]
  MaxFeeExceeded,

  #[msg("The pool has already been initialized.")]
  AlreadyInitialized,

  #[msg("Math Error")]
  MathError,

  #[msg("Slippage Exceeded")]
  SlippageExceeded,

  #[msg("Max Assets In Exceeded")]
  MaxAssetsInExceeded,

  #[msg("Max Shares Exceeded")]
  MaxSharesExceeded,

  #[msg("Invalid Vest Cliff")]
  InvalidVestCliff,

  #[msg("Invalid Vest End")]
  InvalidVestEnd,

  #[msg("Invalid Weight Config")]
  InvalidWeightConfig,

  #[msg("Invalid Asset Value")]
  InvalidAssetValue,

  #[msg("Invalid Asset Or Share")]
  InvalidAssetOrShare,

  #[msg("Sale Period Low")]
  SalePeriodLow,

  #[msg("Closing disallowed")]
  ClosingDisallowed,

  #[msg("Clock error")]
  ClockError,

  #[msg("Redeeming disallowed")]
  RedeemingDisallowed,

  #[msg("No Shares To Claim")]
  NoSharesToClaim,

  #[msg("Unauthorized")]
  Unauthorized,

  #[msg("Pool is paused")]
  PoolIsPaused,

  #[msg("Pool is closed")]
  PoolIsClosed,
}
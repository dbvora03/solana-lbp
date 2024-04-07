use anchor_lang::error_code;

#[error_code]
pub enum ErrorCode {
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
}
use anchor_lang::error_code;

#[error_code]
pub enum ErrorCode {
  #[msg("The pool has already been initialized.")]
  AlreadyInitialized,
}
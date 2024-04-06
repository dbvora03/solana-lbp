
#[derive(Accounts)]
pub struct SwapExactSharesForAssets<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
}

pub fn handler(
  ctx: Context<SwapExactSharesForAssets>,
  shares_in: u64,
  min_assets_out: u64,
  recipient: Pubkey,
) -> Result<()> {

  Ok(())
}
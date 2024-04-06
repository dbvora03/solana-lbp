#[derive(Accounts)]
pub struct SwapSharesForExactAssets<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
}

pub fn handler(
  ctx: Context<SwapSharesForExactAssets>,
  assest_out: u64,
  max_shares_in: u64,
  recipient: Pubkey,
) -> Result<()> {
  
    Ok(())
}
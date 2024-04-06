
#[derive(Accounts)]
pub struct SwapExactAssetsForShares<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut)]
  pub pool: Account<'info, Pool>,
  #[account(mut)]
  pub pool_account_asset: Account<'info, TokenAccount>,
  #[account(mut)]
  pub pool_account_share: Account<'info, TokenAccount>,
  #[account(mut)]
  pub depositor_account_asset: Account<'info, TokenAccount>,
  #[account(mut)]
  pub depositor_account_share: Account<'info, TokenAccount>,
  #[account(mut)]
  pub token_program: Account<'info, Token>,
  pub system_program: Program<'info, System>,
}


pub fn handler(
  ctx: Context<SwapExactAssetsForShares>,
  assetsIn: u64,
  minSharesOut: u64,
  recipient: Pubkey,
  referrer: Pubkey  
) -> Result<()> {

  let pool = &mut ctx.accounts.pool;
  let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;

  u64 swap_fee = assetsIn * (lbp_manager_info.swap_fee);
  pool.total_swap_fees_asset += swap_fee;

  u64 shares_out = (assetsIn - swap_fee) * (1_000_000_000 - swap_fee);

  if (shares_out < minSharesOut) {
    return Err(ErrorCode::MinSharesNotMet.into());
  }

  u64 assets = 10 // TODO: Do the math here with the accounts

  if (assets + assetsIn - swap_fee >= pool.settings.max_assets_in) {
    return Err(ErrorCode::MaxAssetsInExceeded.into());
  }

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_account_asset.to_account_info(),
            to: ctx.accounts.pool_account_asset.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    ),
    assetsIn,
  )?;

  u64 total_purchased_after = total_purchased + shares_out;

  pool.total_purchased = total_purchased_after;

  // TODO: Create PDA if it doesnt exist and add shares to it
  

  
}
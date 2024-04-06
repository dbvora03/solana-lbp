
#[derive(Accounts)]
pub struct SwapExactSharesForAssets<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,

  #[account(mut)]
  pub pool: Account<'info, Pool>,
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
  pub system_program: Program<'info, System>,
}

pub fn handler(
  ctx: Context<SwapExactSharesForAssets>,
  shares_in: u64,
  min_assets_out: u64,
  recipient: Pubkey,
) -> Result<u64> {

  let pool = &mut ctx.accounts.pool;
  let manager = &mut ctx.accounts.lbp_manager_info;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  let swap_fees = shares_in * manager.swap_fee;
  pool.total_swap_fees_share += swap_fees;

  let assets_out_result = pool.preview_assets_out(pool, shares_in - swap_fees);

  if assets_out_result.is_err() {
    return err!(ErrorCode::MathError);
  }

  let mut assets_out = assets_out_result.unwrap();

  if (assets_out < min_assets_out) {
    return err!(ErrorCode::SlippageExceeded);
  }

  if (assets >= pool.settings.max_assets_in) {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  total_purchased_before = pool.total_purchased;

  if (total_purchased_before >= pool.settings.max_shares_out || total_purchased_before > shares) {
    return err!(ErrorCode::MaxSharesExceeded);
  }

  buyer_stats.purchased -= shares_in;
  pool.total_purchased = total_purchased_before - shares_in;

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_assets_account.to_account_info(),
            to: ctx.accounts.depositor_asset_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    ),
    assets_out,
  )?;


  Ok(())
}
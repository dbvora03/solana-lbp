#[derive(Accounts)]
pub struct SwapSharesForExactAssets<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
}

pub fn handler(
  ctx: Context<SwapSharesForExactAssets>,
  assets_out: u64,
  max_shares_in: u64,
  recipient: Pubkey,
) -> Result<()> {

  let pool = &mut ctx.accounts.pool;
  let manager = &mut ctx.accounts.lbp_manager_info;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  let mut shares_in = preview_shares_in(pool, assets_out, assets, shares);
  let swap_fees = shares_in * manager.swap_fee;
  shares_in += swap_fees;

  if (shares_in > max_shares_in) {
    return err!(ErrorCode::SlippageExceeded);
  }

  if (assets >= pool.settings.max_assets_in) {
    return err!(ErrorCode::MaxAssetsInExceeded);
  }

  total_purchased_before = pool.total_purchased;

  if (total_purchased_before >= pool.settings.max_shares_out || total_purchased_before > shares) {
    return err!(ErrorCode::MaxSharesExceeded);
  }

  user_stats.purchased -= shares_in;

  pool.total_purchased = total_purchased_before - shares_in;

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_assets_account.to_account_info(),
            to: ctx.accounts.depositor_assets_account.to_account_info(),
            authority: ctx.accounts.pool_shares_account.to_account_info(),
        },
    ),
    assets_out,
  )?;

  // TODO: Emit an event here
  
  Ok(())
}
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer, Mint};
use crate::state::*;

#[derive(Accounts)]
pub struct SwapAssetsForExactShares<'info> {
  #[account(mut)]
  pub depositor: Signer<'info>,

  #[account(mut)]
  pub pool: Account<'info, Pool>,

  #[account(mut)]
  pub pool_assets_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub pool_shares_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub depositor_asset_account: Account<'info, TokenAccount>,

  #[account(
    init,
    seeds = [
      b"pool".as_ref(),
      &lbp_manager_info.to_account_info().key().to_bytes(),
      &asset_mint.key().as_ref(),
      &share_mint.key().as_ref()
    ],
    payer = depositor,
    space = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + (1 + 8 + 8 + 1),
    bump,
  )]
  pub pool: Box<Account<'info, Pool>>,
}

pub fn handler (
  ctx: Context<SwapAssetsForExactShares>,
  shares_out: u64,
  max_assets_in: u64,
  recipient: Pubkey,
) -> Result<()> {



  // Get the pool and manager
  let pool = &mut ctx.accounts.pool;
  let manager = &mut ctx.accounts.lbp_manager;

  let assets: u64 = ctx.accounts.pool_assets_account.amount;
  let shares: u64 = ctx.accounts.pool_shares_account.amount;

  // Preview the assets in
  let mut assets_in = crate::utils::preview_assets_in(pool, 0, 0);

  // Calculate the swap fee
  let swap_fees: u64 = assets_in * pool.swap_fee;

  // Add to Assets In
  assets_in += swap_fees;

  // Increment totalSwapFeesAsset
  pool.total_swap_fees_asset += swap_fees;

  // Add slippage error function

  // Call the swapAssetsForExactShares function 
  if (assets + assets_in - swap_fees >= pool.settings.max_assets_in) {
    return Err(ErrorCode::MaxAssetsInExceeded.into());
  }

  token::transfer(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_asset_account.to_account_info(),
            to: ctx.accounts.pool_account_asset.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    ),
    assetsIn,
  )?;

  let total_purchased_after = total_purchased + shares_out;

  if (total_purchased_after >= pool.settings.max_shares || total_purchased_after > shares) {
    return Err(ErrorCode::MaxSharesExceeded.into());
  }

  pool.total_purchased = total_purchased_after;




  Ok(())
}
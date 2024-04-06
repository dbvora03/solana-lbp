use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer, Mint};
use crate::state::*;

#[derive(Accounts)]
#[instruction(referrer: Pubkey)]
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
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &depositor.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump,
  )]
  pub buyer_stats: Box<Account<'info, UserStats>>,

  #[account(
    init,
    seeds = [
      b"user_stats".as_ref(),
      &pool.key().as_ref(),
      &referrer.key().as_ref(),
    ],
    payer = depositor,
    space = 8 + 32 + 32 + 8 + 8 + 1,
    bump,
  )]
  pub referrer_stats: Box<Account<'info, UserStats>>,
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
  let buyer_stats = &mut ctx.accounts.buyer_stats;
  let referrer_stats = &mut ctx.accounts.referrer_stats;

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
  buyer_stats.purchased += shares_out;

  if (recipient != Pubkey::default() && manager.referrer_fee > 0) {
    //             uint256 assetsReferred = assetsIn.mulWad(referrerFee());
    let assets_referred: u64 = assets_in * manager.referrer_fee;
    referred_stats.referred_amount += assets_referred;
  }


  // TODO: Emit an event here

  Ok(())
}
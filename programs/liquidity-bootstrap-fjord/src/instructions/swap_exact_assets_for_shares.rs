use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Transfer};
use crate::state::*;

#[derive(Accounts)]
pub struct SwapExactAssetsForShares<'info> {
  #[account(mut)]
  pub depositor: Signer<'info>,
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

  // The liquidity pool manager info account
  pub lbp_manager_info: Account<'info, LBPManagerInfo>,
  
  pub token_program: Program<'info, Token>,
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

  let swap_fee: u64 = assetsIn * (lbp_manager_info.swap_fee);
  pool.total_swap_fees_asset += swap_fee;

  let shares_out: u64 = (assetsIn - swap_fee) * (1_000_000_000 - swap_fee);

  // if (shares_out < minSharesOut) {
  //   return Err(ErrorCode::MinSharesNotMet.into());
  // }

  let assets: u64 = 10; // TODO: Do the math here with the accounts

  // if (assets + assetsIn - swap_fee >= pool.settings.max_assets_in) {
  //   return Err(ErrorCode::MaxAssetsInExceeded.into());
  // }

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

  let total_purchased_after: u64 = pool.total_purchased + shares_out;

  pool.total_purchased = total_purchased_after;

  // TODO: Create PDA if it doesnt exist and add shares to it
  

  
}
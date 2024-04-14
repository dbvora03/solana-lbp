use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};

#[derive(Accounts)]
pub struct Close<'info> {

  #[account(mut)]
  pub pool: Box<Account<'info, Pool>>,

  #[account(mut)]
  pub asset_vault: Account<'info, TokenAccount>,

  #[account(mut)]
  pub share_vault: Account<'info, TokenAccount>,

  /// CHECK: This is not dangerous because we don't read or write from this account
  #[account(
    seeds = [
      b"share".as_ref(), 
      pool.to_account_info().key.as_ref()
    ],
    bump = pool.share_vault_nonce,
  )]
  pub share_vault_authority: AccountInfo<'info>,
  

  #[account(mut)]
  pub manager_share_vault: Account<'info, TokenAccount>,

  // #[account(mut)]
  // pub signer: Signer<'info>,

  // #[account(
  //   mut,
  //   constraint = pool_assets_account.mint == pool.settings.asset,
  //   constraint = pool_assets_account.owner == pool.to_account_info().key(),
  // )]
  // pub pool_assets_account: Account<'info, TokenAccount>,

  // #[account(
  //   mut,
  //   constraint = pool_shares_account.mint == pool.settings.share,
  //   constraint = pool_shares_account.owner == pool.to_account_info().key(),
  // )]
  // pub pool_shares_account: Account<'info, TokenAccount>,


  // #[account(
  //   mut,
  //   constraint = fee_asset_rec_account.mint == pool.settings.asset,
  //   constraint = fee_asset_rec_account.owner == lbp_manager_info.fee_recipient,
  // )]
  // pub fee_asset_rec_account: Account<'info, TokenAccount>,

  // #[account(
  //   mut,
  //   constraint = fee_share_rec_account.mint == pool.settings.share,
  //   constraint = fee_share_rec_account.owner == lbp_manager_info.fee_recipient,
  // )]
  // pub fee_share_rec_account: Account<'info, TokenAccount>,

  // #[account(
  //   mut,
  //   constraint = manager_share_token_account.mint == pool.settings.share,
  //   constraint = manager_share_token_account.owner == lbp_manager_info.authority,
  // )]
  // pub manager_share_token_account: Account<'info, TokenAccount>,

  // #[account(
  //   mut,
  //   constraint = manager_asset_token_account.mint == pool.settings.asset,
  //   constraint = manager_asset_token_account.owner == lbp_manager_info.authority,
  // )]
  // pub manager_asset_token_account: Account<'info, TokenAccount>,

  // #[account(mut)]
  // pub lbp_manager_info: Account<'info, LBPManagerInfo>,

  // #[account(
  //   mut,
  //   constraint = pool.lbp_manager == lbp_manager_info.key()
  // )]
  // pub pool: Account<'info, Pool>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Close>) -> Result<()> {
  // let lbp_manager_info = &mut ctx.accounts.lbp_manager_info;
  let assets: u64 = ctx.accounts.asset_vault.amount;
  let shares: u64 = ctx.accounts.share_vault.amount;

  // if pool.closed {
  //   return err!(ErrorCode::ClosingDisallowed);
  // }

  // let unix_timestamp = match Clock::get() {
  //   Ok(clock) => clock.unix_timestamp,
  //   Err(_) => return err!(ErrorCode::ClockError),
  // };

  // if (unix_timestamp as i128) < (pool.settings.sale_end as i128) {
  //   return err!(ErrorCode::ClosingDisallowed);
  // }

  // let pool_assets = assets - pool.total_swap_fees_asset;
  // let platform_fees = pool_assets * lbp_manager_info.platform_fee;

  // let total_assets_minus_fees = pool_assets - platform_fees - pool.total_referred;

  // if pool_assets != 0 {

    // token::transfer(
    //   CpiContext::new(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.pool_assets_account.to_account_info(),
    //           to: ctx.accounts.fee_asset_rec_account.to_account_info(),
    //           authority: ctx.accounts.signer.to_account_info(),
    //       },
    //   ),
    //   platform_fees + 2 * pool.total_swap_fees_asset,
    // )?;

    // token::transfer(
    //   CpiContext::new(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.pool_shares_account.to_account_info(),
    //           to: ctx.accounts.fee_asset_rec_account.to_account_info(), // fee reciever
    //           authority: ctx.accounts.signer.to_account_info(),
    //       },
    //   ),
    //   2 * pool.total_swap_fees_share // This is covering the overlap 
    // )?;



    // // This can be split up to use the percentage based allocation
    // // AKA the for loop in distributeFee
    // token::transfer(
    //   CpiContext::new(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.pool_assets_account.to_account_info(),
    //           to: ctx.accounts.fee_asset_rec_account.to_account_info(),
    //           authority: ctx.accounts.signer.to_account_info(),
    //       },
    //   ),
    //   platform_fees,
    // )?;


    // token::transfer(
    //   CpiContext::new(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.pool_assets_account.to_account_info(),
    //           to: ctx.accounts.fee_asset_rec_account.to_account_info(),
    //           authority: ctx.accounts.signer.to_account_info(),
    //       },
    //   ),
    //   platform_fees,
    // )?;


    // Transfer the rest to the owner of the LBP manager
    // token::transfer(
    //   CpiContext::new(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.pool_assets_account.to_account_info(),
    //           to: ctx.accounts.manager_asset_token_account.to_account_info(),
    //           authority: ctx.accounts.signer.to_account_info(),
    //       },
    //   ),
    //   total_assets_minus_fees,
    // )?;
  // }

  // let unsold_shares = shares - ctx.accounts.pool.total_purchased;
  let unsold_shares = shares - 10;

  if shares != 0 {
    // let seeds = &[
    //   b"share".as_ref(),
    //   ctx.accounts.pool.to_account_info().key.as_ref(),
    //   &[ctx.accounts.pool.share_vault_nonce],
    // ];
    // let signer = &[&seeds[..]];

    // token::transfer(
    //   CpiContext::new_with_signer(
    //       ctx.accounts.token_program.to_account_info(),
    //       Transfer {  
    //           from: ctx.accounts.share_vault.to_account_info(),
    //           to: ctx.accounts.manager_share_vault.to_account_info(),
    //           authority: ctx.accounts.share_vault_authority.to_account_info(),
    //       },
    //       signer,
    //   ),
    //   unsold_shares,
    // )?;

    // ctx.accounts.pool.share_vault_nonce = ctx.accounts.pool.share_vault_nonce.checked_add(1).unwrap();
  }

  ctx.accounts.pool.closed = true;

  // emit!(ClosePool {
  //   caller: *ctx.accounts.signer.to_account_info().key,
  //   platform_fees: platform_fees,
  //   swap_fees_asset: pool.total_swap_fees_asset,
  //   swap_fees_share: pool.total_swap_fees_share,
  // });


  Ok(())
}
use anchor_lang::prelude::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};

#[derive(Accounts)]
pub struct Redeem<'info> {

    #[account(
        mut
    )]
    pub pool: Box<Account<'info, Pool>>,

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

    pub lbp_manager_info: Account<'info, LBPManagerInfo>,

    #[account(mut)]
    pub buyer_stats: Box<Account<'info, UserStats>>,

    #[account(mut)]
    pub recipient_share_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,

}

pub fn handler(
    ctx: Context<Redeem>,
) -> Result<()> {
    let buyer_stats = &mut ctx.accounts.buyer_stats;

    if !ctx.accounts.pool.closed {
        return err!(ErrorCode::RedeemingDisallowed);
    }

    let vest_end = ctx.accounts.pool.settings.vest_end;
    let vest_cliff = ctx.accounts.pool.settings.vest_cliff;
    let sale_end = ctx.accounts.pool.settings.sale_end;
    let vest_shares = sale_end < vest_end;

    let curr_timestamp = Clock::get()?.unix_timestamp as u64;
    
    let mut claimable: u64;
    let claimed = buyer_stats.claimed;
    
    if vest_shares && vest_end > curr_timestamp {
        let shares = buyer_stats.purchased;
        // if not reached vest cliff, no shares can be claimed
        if curr_timestamp < vest_cliff {
            claimable = 0;
        // other wise distribute shares linearly
        } else {
            claimable = shares * (curr_timestamp - vest_cliff) / (vest_end - vest_cliff);
            claimable -= claimed;
        }
    } else {
        claimable = buyer_stats.purchased - claimed;
    }

    if claimable == 0 {
        return err!(ErrorCode::NoSharesToClaim);
    }

    let seeds = &[
      b"share".as_ref(),
      ctx.accounts.pool.to_account_info().key.as_ref(),
      &[ctx.accounts.pool.share_vault_nonce],
    ];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.share_vault.to_account_info(),
                to: ctx.accounts.recipient_share_vault.to_account_info(),
                authority: ctx.accounts.share_vault_authority.to_account_info()
            },
            signer,
        ),
        claimable,
    )?;
    
    buyer_stats.claimed += claimable;

    emit!(Redeemed {
        recipient: ctx.accounts.recipient_share_vault.to_account_info().key().clone(),
        shares: claimable,
        total_claimed: buyer_stats.claimed
    });

    Ok(())
}
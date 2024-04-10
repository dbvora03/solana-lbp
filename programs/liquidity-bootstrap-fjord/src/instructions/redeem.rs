use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer, Token};
use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
#[instruction(recipient: Pubkey)]
pub struct Redeem<'info> {

    #[account(
        mut,
        constraint = pool.lbp_manager == lbp_manager_info.key()
    )]
    pub pool: Account<'info, Pool>,

    pub lbp_manager_info: Account<'info, LBPManagerInfo>,

    pub buyer_stats: Box<Account<'info, UserStats>>,

    #[account(
        mut,
        constraint = pool_shares_account.mint == pool.settings.share,
        constraint = pool_shares_account.owner == pool.to_account_info().key(),
    )]
    pub pool_shares_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_shares_account.mint == pool.settings.share,
        constraint = recipient_shares_account.owner == recipient,
    )]
    pub recipient_shares_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Redeem>, 
    recipient: Pubkey,
) -> Result<()> {  
    let pool = &mut ctx.accounts.pool;
    let buyer_stats = &mut ctx.accounts.buyer_stats;

    if !pool.closed {
        return err!(ErrorCode::RedeemingDisallowed);
    }

    let vest_end = pool.settings.vest_end;
    let vest_cliff = pool.settings.vest_cliff;
    let sale_end = pool.settings.sale_end;
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

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_shares_account.to_account_info(),
                to: ctx.accounts.recipient_shares_account.to_account_info(),
                authority: ctx.accounts.pool_shares_account.to_account_info()
            },
        ),
        claimable,
    )?;
    
    buyer_stats.claimed += claimable;

    emit!(Redeemed {
        recipient: recipient,
        shares: claimable,
        total_claimed: buyer_stats.claimed
    });

    Ok(())
}
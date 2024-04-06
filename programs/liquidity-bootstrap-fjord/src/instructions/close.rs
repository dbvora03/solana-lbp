use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, TokenAccount, Transfer, Mint, Token};


#[derive(Accounts)]
pub struct ClosePool<'info> {

}


pub fn handler(ctx: Context<ClosePool>) -> Result<()> {
  let pool = &mut ctx.accounts.pool;

  

  Ok(())
}
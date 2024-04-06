use anchor_lang::prelude::*;
use crate::state::*;

pub struct Pool {
    asset: Pubkey,
    share: Pubkey,
    assets: u64,
    shares: u64,
    virtual_assets: u64,
    virtual_shares: u64,
    weight_start: u64,
    weight_end: u64,
    sale_start: u64,
    sale_end: u64,
    total_purchased: u64,
    max_share_price: u64,
}

pub fn handler(ctx: Context<PreviewAssetsIn>, new_fee: u64) -> Result<()> {
    let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool);

}

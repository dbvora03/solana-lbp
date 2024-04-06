use anchor_lang::prelude::*;
use crate::state::*;

pub const SOL: f64 = 1_000_000_000.0;

#[error_code]
pub enum ErrorCode {
  #[msg("Amount out too large")]
  AmountOutTooLarge,
  #[msg("Rust Pow needs u32")]
  NotSafeForPow,
}

pub fn linear_interpolation(x: u64, y: u64, i: u64, n: u64) -> u64 {
  if x > y {
    return x - (((x - y) * i) / n);
  } else {
    return x + (((y - x) * i) / n);
  }
}

pub fn compute_reserves_and_weights(
  pool: &Pool,
  assets: u64, // These are calculated as asset().balanceOf(address(this)).rawSub(totalSwapFeesAsset), TODO
  shares: u64,
) -> (u64, u64, u64, u64) {

  let asset_reserve: u64 = assets + pool.settings.virtual_assets;
  let share_reserve: u64 = shares + pool.settings.virtual_shares - pool.total_purchased;

  let total_seconds: u64 = pool.settings.sale_end - pool.settings.sale_start;

  let mut seconds_elapsed: u64 = 0;
  let unix_timestamp = match Clock::get() {
    Ok(clock) => clock.unix_timestamp,
    Err(_) => return (0, 0, 0, 0),
  };

  if unix_timestamp as i128 > pool.settings.sale_start as i128 {
    seconds_elapsed = (unix_timestamp as i128 - pool.settings.sale_start as i128) as u64;
  }

  let asset_weight: u64 = linear_interpolation(
    pool.settings.weight_start,
    pool.settings.weight_end,
    seconds_elapsed,
    total_seconds
  );

  let share_weight: u64 = 1_000_000_000 - asset_weight;

  return (asset_reserve, share_reserve, asset_weight, share_weight);
}

pub fn scaled_reserves(
  pool: &Pool,
  asset_reserve: u64,
  share_reserve: u64,
) -> (u64, u64) {
  let asset = pool.settings.asset;
  let share = pool.settings.share;
  let scaled_asset_token = scale_token_before(asset, asset_reserve);
  let scaled_share_token = scale_token_before(share, share_reserve);
  (scaled_asset_token, scaled_share_token)
}

pub fn scale_token_before(
  token: Pubkey,
  amount: u64
) -> u64 {
  // TODO: hardcode now, figure out later
  let decimals: u32 = 9;
  let base_decimals: u32 = 9;
  let mut scaled_amount: u64 = amount;
  if decimals < base_decimals {
    let decDiff: u32 = base_decimals - decimals;
    scaled_amount = amount * 10_u64.pow(decDiff);
  } else if decimals > base_decimals {
    let decDiff: u32 = decimals - base_decimals;
    scaled_amount = amount / 10_u64.pow(decDiff);
  }
  scaled_amount
}

pub fn scale_token_after(
  token: Pubkey,
  amount: u64
) -> u64 {
  // TODO: hardcode now, figure out later
  let decimals: u32 = 9;
  let base_decimals: u32 = 9;
  let mut scaled_amount: u64 = amount;
  if decimals < base_decimals {
    let decDiff: u32 = base_decimals - decimals;
    scaled_amount = amount / 10_u64.pow(decDiff);
  } else if decimals > base_decimals {
    let decDiff: u32 = decimals - base_decimals;
    scaled_amount = amount * 10_u64.pow(decDiff);
  }
  scaled_amount
}

pub fn get_amount_in(amount_out: u64, reserve_in: u64, reserve_out: u64, weight_in: u64, weight_out: u64) -> Result<u64> {
  let MAX_PERCENTAGE_OUT: u64 = (0.3 * 1_000_000_000.0) as u64;
  if amount_out > reserve_out * MAX_PERCENTAGE_OUT {
    return err!(ErrorCode::AmountOutTooLarge);
  }
  // TODO: check if this can be a problem, u32 required for rust pow
  let div_result = weight_in / weight_out;
  if div_result > u32::MAX as u64 {
    return err!(ErrorCode::NotSafeForPow);
  }
  let div_result_u32 = div_result as u32;
  let res: u64 = reserve_in * ((reserve_out / (reserve_out - amount_out)).pow(div_result_u32) - (SOL as u64));
  Ok(res)
}

pub fn preview_assets_in(pool: &Pool, shares_out: u64, assets:u64, shares: u64) -> Result<u64> {
  let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
  let (asset_reserve_scaled, share_reserve_scaled) = scaled_reserves(pool, asset_reserve, share_reserve);
  let shares_out_scaled = scale_token_before(pool.settings.share, shares_out);
  let assets_in_result = get_amount_in(shares_out_scaled, asset_reserve_scaled, share_reserve_scaled, asset_weight, share_weight);
  if assets_in_result.is_err() {
    return Err(assets_in_result.unwrap_err());
  }
  let mut assets_in = assets_in_result.unwrap();
  let max_share_price = pool.settings.max_share_price;
  if assets_in / shares_out_scaled > max_share_price {
    assets_in = shares_out_scaled / max_share_price;
  }
  assets_in = scale_token_after(pool.settings.asset, assets_in);
  Ok(assets_in)
}

pub fn preview_shares_out(pool: &Pool, assets_in: u64, assets: u64, shares: u64) -> Result<u64> {

  // TODO: Implement this function
  Ok(assets_out)
}


pub fn preview_assets_out(pool: &Pool, shares_in: u64, assets: u64, shares: u64) -> Result<u64> {

  // TODO: Implement this function
  Ok(assets_out)
}

pub fn preview_shares_in(pool: &Pool, shares_in: u64, assets: u64, shares: u64) -> Result<u64> {

  // TODO: Implement this function
  Ok(assets_out)
}

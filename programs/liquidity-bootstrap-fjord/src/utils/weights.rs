use anchor_lang::prelude::*;
use crate::state::*;

pub const SOL: f64 = 1_000_000_000.0;

#[error_code]
pub enum ErrorCode {
  #[msg("Amount out too large")]
  AmountOutTooLarge,
  #[msg("Amount in too large")]
  AmountInTooLarge,
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
  // TODO: hardcode now
  let decimals: u32 = 6;
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
  // TODO: hardcode now
  let decimals: u32 = 6;
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

pub fn get_amount_in(amount_out: f64, reserve_in: f64, reserve_out: f64, weight_in: f64, weight_out: f64) -> Result<u64> {
  let MAX_PERCENTAGE_OUT = 0.3;
  if amount_out > (reserve_out  * MAX_PERCENTAGE_OUT) {
    return err!(ErrorCode::AmountOutTooLarge);
  }
  let div_result = weight_out / weight_in;
  let res: f64 = reserve_in * ((reserve_out / (reserve_out - amount_out)).powf(div_result) - 1.0);
  Ok(res as u64)
}

pub fn get_amount_out(amount_in: f64, reserve_in: f64, reserve_out: f64, weight_in: f64, weight_out: f64) -> Result<u64> {
  let MAX_PERCENTAGE_IN = 0.3;
  if amount_in > (reserve_in * MAX_PERCENTAGE_IN) {
    return err!(ErrorCode::AmountInTooLarge);
  }
  let div_result = weight_in / weight_out;
  let res: f64 = reserve_out * (1.0 - (reserve_in / (reserve_in + amount_in)).powf(div_result));
  Ok(res as u64)
}

pub fn preview_assets_in(pool: &Pool, shares_out: u64, assets:u64, shares: u64) -> Result<u64> {
  let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
  let (asset_reserve_scaled, share_reserve_scaled) = scaled_reserves(pool, asset_reserve, share_reserve);
  let shares_out_scaled = scale_token_before(pool.settings.share, shares_out);
  let assets_in_result = get_amount_in(
    shares_out_scaled as f64, 
    asset_reserve_scaled as f64, 
    share_reserve_scaled as f64, 
    asset_weight as f64, 
    share_weight as f64
  );
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
  let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
  let (asset_reserve_scaled, share_reserve_scaled) = scaled_reserves(pool, asset_reserve, share_reserve);
  let assets_in_scaled = scale_token_before(pool.settings.asset, assets_in);
  let shares_out_result = get_amount_out(
    assets_in_scaled as f64, 
    asset_reserve_scaled as f64, 
    share_reserve_scaled as f64,
     asset_weight as f64, 
    share_weight as f64
  );
  if shares_out_result.is_err() {
    return Err(shares_out_result.unwrap_err());
  }
  let mut shares_out = shares_out_result.unwrap();
  if assets_in_scaled / shares_out > pool.settings.max_share_price {
    shares_out = assets_in_scaled * pool.settings.max_share_price;
  }
  shares_out = scale_token_after(pool.settings.share, shares_out);
  Ok(shares_out)
}


pub fn preview_assets_out(pool: &Pool, shares_in: u64, assets: u64, shares: u64) -> Result<u64> {
  let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
  let (asset_reserve_scaled, share_reserve_scaled) = scaled_reserves(pool, asset_reserve, share_reserve);
  let shares_in_scaled = scale_token_before(pool.settings.share, shares_in);
  let assets_out_result = get_amount_out(
    shares_in_scaled as f64, 
    share_reserve_scaled as f64, 
    asset_reserve_scaled as f64, 
    share_weight as f64, 
    asset_weight as f64
  );
  if assets_out_result.is_err() {
    return Err(assets_out_result.unwrap_err());
  }
  let mut assets_out = assets_out_result.unwrap();
  if assets_out / shares_in_scaled > pool.settings.max_share_price {
    assets_out = shares_in_scaled * pool.settings.max_share_price;
  }
  assets_out = scale_token_after(pool.settings.asset, assets_out);
  Ok(assets_out)
}

pub fn preview_shares_in(pool: &Pool, assets_out: u64, assets: u64, shares: u64) -> Result<u64> {
  let (asset_reserve, share_reserve, asset_weight, share_weight) = compute_reserves_and_weights(&pool, assets, shares);
  let (asset_reserve_scaled, share_reserve_scaled) = scaled_reserves(pool, asset_reserve, share_reserve);
  let assets_out_scaled = scale_token_before(pool.settings.asset, assets_out);
  let shares_in_result = get_amount_in(
    assets_out_scaled as f64, 
    share_reserve_scaled as f64, 
    asset_reserve_scaled as f64, 
    share_weight as f64, 
    asset_weight as f64
  );
  if shares_in_result.is_err() {
    return Err(shares_in_result.unwrap_err());
  }
  let mut shares_in = shares_in_result.unwrap();
  if assets_out_scaled / shares_in > pool.settings.max_share_price {
    shares_in = assets_out_scaled / pool.settings.max_share_price;
  }
  shares_in = scale_token_after(pool.settings.share, shares_in);
  Ok(shares_in)
}

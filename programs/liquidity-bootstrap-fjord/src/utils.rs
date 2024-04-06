use anchor_lang::prelude::Clock;

pub fn linear_interpolation(x: u64, y: u64, i: u64, n: u64) -> u64 {
  if x > y {
    return x - (((x - y) * i) / n);
  } else {
    return x + (((y - x) * i) / n);
  }
}

pub fn compute_reservers_and_weights(
  pool: Pool,
  assets: u64, // These are calculated as asset().balanceOf(address(this)).rawSub(totalSwapFeesAsset), TODO
  shares: u64,
) -> (u64, u64, u64, u64) {

  u64 asset_reserve = assets + pool.settings.virtual_assets;
  u64 share_reserve = shares + pool.settings.virtual_shares - pool.total_purchased;

  u64 total_seconds = pool.settings.sale_end - pool.settings.sale_start;

  let mut seconds_elapsed: u64 = 0;
  let clock = Clock::get()?;
  if (clock.unix_timestamp > pool.settings.sale_start) {
    seconds_elapsed = clock.unix_timestamp - pool.settings.sale_start;
  }

  asset_weight = linear_interpolation(
    pool.settings.weight_start,
    pool.settings.weight_end,
    seconds_elapsed,
    total_seconds
  )

  u64 share_weight = 1_000_000_000 - asset_weight;

  return (asset_reserve, share_reserve, asset_weight, share_weight);
}
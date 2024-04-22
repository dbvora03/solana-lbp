import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  ONE_DAY,
  SOL,
  TWO_DAYS,
  closePool,
  createMintAndVault,
  createPool,
  createUser,
  createUserStats,
  createVault,
  defaultInitialAssetAmount,
  defaultInitialShareAmount,
  fund,
  getDefaultPoolSettings,
  getNow,
  initialize,
  program,
  provider,
  swapExactAssetsForShares,
  getVaultBalance,
  getAccountInfo
} from "./utils";

describe.only("Redeem And Close Tests", () => {
  /* Settings */
  const managerId = new anchor.BN(200);
  const decimals = 6; // mint decimals

  /* Global Variables */
  let assetMint;
  let shareMint;
  let assetGod;
  let shareGod;

  let buyer;
  let buyerAssetVault;
  let buyerShareVault;

  let lbpManagerPda;

  let feeRecipient;
  let feeAssetVault;
  let feeShareVault;
  let redeemRecipientShareVault;

  let depositor;
  let depositorAssetVault;
  let depositorShareVault;

  let lbpFactorySettingsAuthority;

  let poolId = managerId.clone();

  before(async () => {
    // funds users
    await fund(provider.wallet.publicKey);

    // prepare mints
    [assetMint, assetGod] = await createMintAndVault(
      defaultInitialAssetAmount,
      provider.wallet.publicKey,
      decimals
    );
    [shareMint, shareGod] = await createMintAndVault(
      defaultInitialShareAmount,
      provider.wallet.publicKey,
      decimals
    );

    // prepare factory settings authority
    lbpFactorySettingsAuthority = anchor.web3.Keypair.generate();
    await fund(lbpFactorySettingsAuthority.publicKey);

    // prepare fee recipient
    const {
      user: _feeRecipient,
      userAssetVault: _feeAssetVault,
      userShareVault: _feeShareVault,
    } = await createUser(assetMint, shareMint);
    feeRecipient = _feeRecipient;
    feeAssetVault = _feeAssetVault;
    feeShareVault = _feeShareVault;

    // init manager
    lbpManagerPda = await initialize(managerId, feeRecipient.publicKey, lbpFactorySettingsAuthority);
  });

  beforeEach(async () => {
    // use a new pool id
    poolId = poolId.add(new anchor.BN(1));

    // prepare buyer account
    const {
      user: _buyer,
      userAssetVault: _buyerAssetVault,
      userShareVault: _buyerShareVault,
    } = await createUser(assetMint, shareMint);
    buyer = _buyer;
    buyerAssetVault = _buyerAssetVault;
    buyerShareVault = _buyerShareVault;

    // prepare vaults
    redeemRecipientShareVault = await createVault(shareMint); // ?

    // prepare depositor account
    const { 
      user: _depositor, 
      userAssetVault: _depositorAssetVault, 
      userShareVault: _depositorShareVault 
    } = await createUser(assetMint, shareMint);
    depositor = _depositor;
    depositorAssetVault = _depositorAssetVault;
    depositorShareVault = _depositorShareVault;
  });

  it("should close and transfer assets and fees", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    
    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);

    // swap
    const { userStats: buyerStats } = await createUserStats(
      pool.publicKey,
      buyer
    );
    const assetsIn = SOL;
    const { sharesOut } = await swapExactAssetsForShares(
      assetsIn,
      pool,
      buyer,
      shareVault.publicKey,
      assetVault.publicKey,
      buyerAssetVault,
      lbpManagerPda,
      buyerStats
    );

    const poolStateAccountBeforeClose = await program.account.pool.fetch(pool.publicKey);

    const shares = await getVaultBalance(shareVault.publicKey);
    const assets = await getVaultBalance(assetVault.publicKey);
    const total_purchased = poolStateAccountBeforeClose.totalPurchased;
    const unsold_shares = shares.sub(total_purchased);

    const total_swap_fees_asset = poolStateAccountBeforeClose.totalSwapFeesAsset;
    const total_swap_fees_share = poolStateAccountBeforeClose.totalSwapFeesShare;

    const total_assets = assets.sub(total_swap_fees_asset);
    const platform_fee = (await program.account.lbpManagerInfo.fetch(lbpManagerPda)).platformFee;
    const platform_fees = total_assets.mul(platform_fee).div(new anchor.BN(1_000_000_000));
    const total_assets_minus_fees = total_assets.sub(platform_fees);

    const poolOwnerAssetVaultBalanceBeforeClose = await getVaultBalance(depositorAssetVault);
    const poolOwnerShareVaultBalanceBeforeClose = await getVaultBalance(depositorShareVault);
    const feeRecipientAssetVaultBalanceBeforeClose = await getVaultBalance(feeAssetVault);
    const feeRecipientShareVaultBalanceBeforeClose = await getVaultBalance(feeShareVault);

    // close the pool
    await closePool(
      pool.publicKey,
      assetVault.publicKey,
      assetVaultAuthority,
      shareVault.publicKey,
      shareVaultAuthority,
      depositorAssetVault, // now the pool onwer is the depositor
      depositorShareVault, // now the pool onwer is the depositor
      feeShareVault,
      feeAssetVault,
      lbpManagerPda
    );

    const poolOwnerAssetVaultBalanceAfterClose = await getVaultBalance(depositorAssetVault);
    assert.ok(poolOwnerAssetVaultBalanceBeforeClose.add(total_assets_minus_fees).eq(poolOwnerAssetVaultBalanceAfterClose), "total assets minus fees should be transferred to pool owner");

    const poolOwnerShareVaultBalanceAfterClose = await getVaultBalance(depositorShareVault);
    assert.ok(poolOwnerShareVaultBalanceBeforeClose.add(unsold_shares).eq(poolOwnerShareVaultBalanceAfterClose), "unsold shares should be transferred to pool owner");

    const feeRecipientAssetVaultBalanceAfterClose = await getVaultBalance(feeAssetVault);
    assert.ok(feeRecipientAssetVaultBalanceBeforeClose.add(platform_fees).add(total_swap_fees_asset).eq(feeRecipientAssetVaultBalanceAfterClose), "platform fees and total swap fees asset should be transferred to fee recipient");

    const feeRecipientShareVaultBalanceAfterClose = await getVaultBalance(feeShareVault);
    assert.ok(feeRecipientShareVaultBalanceBeforeClose.add(total_swap_fees_share).eq(feeRecipientShareVaultBalanceAfterClose), "total swap fees share should be transferred to fee recipient");
  });

  it("should revert when pool not closed", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const now = await getNow();
    poolSettings.vestCliff = now.sub(ONE_DAY);
    poolSettings.vestEnd = now; // vest end just passed

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);

    const { userStats: buyerStats } = await createUserStats(
      pool.publicKey,
      buyer
    );

    try {
      await program.methods
        .redeem()
        .accounts({
          pool: pool.publicKey,
          shareVault: shareVault.publicKey,
          shareVaultAuthority: shareVaultAuthority,
          lbpManagerInfo: lbpManagerPda,
          buyerStats: buyerStats,
          recipientShareVault: buyerShareVault,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Redeeming disallowed");
    }
  });

  it("should redeem all after vest end", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const now = await getNow();
    poolSettings.vestCliff = now.sub(TWO_DAYS).sub(TWO_DAYS);
    poolSettings.vestEnd = now.sub(TWO_DAYS); // vest end just passed
    poolSettings.saleStart = now.sub(TWO_DAYS).sub(TWO_DAYS).sub(TWO_DAYS);
    poolSettings.saleEnd = now.sub(TWO_DAYS).sub(TWO_DAYS).sub(ONE_DAY);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);

    // swap
    const { userStats: buyerStats } = await createUserStats(
      pool.publicKey,
      buyer
    );
    const assetsIn = SOL;
    const { sharesOut } = await swapExactAssetsForShares(
      assetsIn,
      pool,
      buyer,
      shareVault.publicKey,
      assetVault.publicKey,
      buyerAssetVault,
      lbpManagerPda,
      buyerStats
    );

    // close the pool
    await closePool(
      pool.publicKey,
      assetVault.publicKey,
      assetVaultAuthority,
      shareVault.publicKey,
      shareVaultAuthority,
      depositorAssetVault, // now the pool onwer is the depositor
      depositorShareVault, // now the pool onwer is the depositor
      feeShareVault,
      feeAssetVault,
      lbpManagerPda
    );

    let buyerStatsAccount = await program.account.userStats.fetch(buyerStats);
    const userClaimedBefore = buyerStatsAccount.claimed;

    await program.methods
      .redeem()
      .accounts({
        pool: pool.publicKey,
        shareVault: shareVault.publicKey,
        shareVaultAuthority: shareVaultAuthority,
        lbpManagerInfo: lbpManagerPda,
        buyerStats: buyerStats,
        recipientShareVault: buyerShareVault,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    buyerStatsAccount = await program.account.userStats.fetch(buyerStats);
    const userClaimedAfter = buyerStatsAccount.purchased;

    assert.ok(userClaimedBefore.toString() == "0", "user claimed before");
    assert.ok(
      userClaimedAfter.toString() == sharesOut.toString(),
      "user claimed after"
    );
  });
});


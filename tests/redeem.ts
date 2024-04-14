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

  let managerShareVault;
  let feeAssetVault;
  let feeShareVault;
  let redeemRecipientShareVault;

  let poolId = managerId.clone();

  before(async () => {
    // funds users
    await fund(provider.wallet.publicKey);

    // init manager
    lbpManagerPda = await initialize(managerId);
  });

  beforeEach(async () => {
    // use a new pool id
    poolId = poolId.add(new anchor.BN(1));

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
    managerShareVault = await createVault(shareMint);
    feeAssetVault = await createVault(assetMint);
    feeShareVault = await createVault(shareMint);
    redeemRecipientShareVault = await createVault(shareMint);
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
    } = await createPool(
      poolId,
      poolSettings,
      assetGod,
      shareGod,
      lbpManagerPda,
      assetMint,
      shareMint
    );

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
          recipientShareVault: managerShareVault,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Redeeming disallowed");
    }
  });

  // To make this test work, comment out the closing disallowed check in the program
  // Test validator doesnt allow warping time, need to move this test to
  it("should redeem all after vest end", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const now = await getNow();
    poolSettings.vestCliff = now.sub(ONE_DAY);
    poolSettings.vestEnd = now; // vest end just passed
    poolSettings.saleStart = now.sub(TWO_DAYS);
    poolSettings.saleEnd = now.add(new anchor.BN(2));


    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(
      poolId,
      poolSettings,
      assetGod,
      shareGod,
      lbpManagerPda,
      assetMint,
      shareMint
    );

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
      managerShareVault,
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
        recipientShareVault: managerShareVault,
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

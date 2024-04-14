import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ONE_DAY, SOL, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, getSwapFees, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("swap assets for exact shares", () => {
  /* Settings */
  const managerId = new anchor.BN(300);
  const decimals = 6; // mint decimals
  
  /* Global Variables */
  let assetMint;
  let shareMint;
  let assetGod;
  let shareGod;

  let buyer;
  let buyerAssetVault;
  let buyerShareVault;

  let depositor;
  let depositorAssetVault;
  let depositorShareVault;

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
          userShareVault: _buyerShareVault 
      } = await createUser(assetMint, shareMint);
      buyer = _buyer;
      buyerAssetVault = _buyerAssetVault;
      buyerShareVault = _buyerShareVault;

      // prepare vaults
      managerShareVault = await createVault(shareMint);
      feeAssetVault = await createVault(assetMint);
      feeShareVault = await createVault(shareMint);
      redeemRecipientShareVault = await createVault(shareMint);

      const { 
        user: _depositor, 
        userAssetVault: _depositorAssetVault, 
        userShareVault: _depositorShareVault 
      } = await createUser(assetMint, shareMint);
      depositor = _depositor;
      depositorAssetVault = _depositorAssetVault;
      depositorShareVault = _depositorShareVault;
  });
  
  it("test swap assets for exact shares 5", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);

    const sharesOut = SOL;
    let maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    ).accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpManagerInfo: lbpManagerPda,
    }).view();

    let swapFees = await getSwapFees(lbpManagerPda);
    swapFees = maxAssetsIn.mul(swapFees);
    maxAssetsIn = maxAssetsIn.add(swapFees);

    let buyEvent = null;
    const id = program.addEventListener('Buy', (event, slot) => {
      buyEvent = event;
    });

    const { userStats: buyerStats } = await createUserStats(pool.publicKey, buyer);

    await program.methods.swapAssetsForExactShares(
      buyer.publicKey,
      sharesOut,
      maxAssetsIn,
    ).accounts({
      depositor: buyer.publicKey,
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      depositorAssetsAccount: buyerAssetVault,
      buyerStats: buyerStats,
      lbpManagerInfo: lbpManagerPda,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();

    if (buyEvent) {
      const assetsIn = buyEvent.assets;
      const sharesOut = buyEvent.shares;

      const poolAssetAmount = (await provider.connection.getTokenAccountBalance(assetVault.publicKey)).value.amount;
      assert.ok(poolAssetAmount == new anchor.BN(assetsIn).add(defaultInitialAssetAmount).toString(), "assetsIn");
      assert.ok(maxAssetsIn.toString() == assetsIn, "assetsIn");
      const lbpAccount = await program.account.pool.fetch(pool.publicKey);
      assert.ok(lbpAccount.totalPurchased.toString() == sharesOut.toString(), "totalPurchased");
      const buyerStatsAccount = await program.account.userStats.fetch(buyerStats);
      assert.ok(buyerStatsAccount.purchased.toString() == sharesOut.toString(), "purchased");
    } else {
      expect.fail('Buy event not emitted');
    }

    program.removeEventListener(id);

  });

  it("test second swap", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);

    const sharesOut = SOL;
    let maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .view();

    let buyEvent = null;
    const id = program.addEventListener('Buy', (event, slot) => {
      buyEvent = event;
    });

    let swapFees = await getSwapFees(lbpManagerPda);
    swapFees = maxAssetsIn.mul(swapFees);
    maxAssetsIn = maxAssetsIn.add(swapFees);

    const { userStats: buyerStats } = await createUserStats(pool.publicKey, buyer);

    await program.methods.swapAssetsForExactShares(
      buyer.publicKey,
      sharesOut,
      maxAssetsIn,
    ).accounts({
      depositor: buyer.publicKey,
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      depositorAssetsAccount: buyerAssetVault,
      buyerStats: buyerStats,
      lbpManagerInfo: lbpManagerPda,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();

    let assetsIn1;
    let sharesOut1;

    if (buyEvent) {
      assetsIn1 = buyEvent.assets;
      sharesOut1 = buyEvent.shares;
    } else {
      expect.fail('Buy event not emitted');
    }

    let maxAssetsIn2 = await program.methods.previewAssetsIn(
      sharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .view();

    let swapFees2 = await getSwapFees(lbpManagerPda);
    swapFees2 = maxAssetsIn2.mul(swapFees2);
    maxAssetsIn2 = maxAssetsIn2.add(swapFees2);
    

    await program.methods.swapAssetsForExactShares(
      buyer.publicKey,
      sharesOut,
      maxAssetsIn2,
    ).accounts({
      depositor: buyer.publicKey,
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      depositorAssetsAccount: buyerAssetVault,
      buyerStats: buyerStats,
      lbpManagerInfo: lbpManagerPda,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();

    if (buyEvent) {
      const assetsIn2 = buyEvent.assets;
      const sharesOut2 = buyEvent.shares;

      const poolAssetAmount = (await provider.connection.getTokenAccountBalance(assetVault.publicKey)).value.amount;
      assert.ok(poolAssetAmount == new anchor.BN(assetsIn1).add(defaultInitialAssetAmount).add(assetsIn2).toString(), "assetsIn");
      assert.ok(maxAssetsIn2.toString() == assetsIn2, "assetsIn");

      const lbpAccount = await program.account.pool.fetch(pool.publicKey);
      assert.ok(lbpAccount.totalPurchased.toString() == sharesOut1.add(sharesOut2).toString(), "totalPurchased");

      const buyerStatsAccount = await program.account.userStats.fetch(buyerStats);
      assert.ok(buyerStatsAccount.purchased.toString() == sharesOut1.add(sharesOut2).toString(), "purchased");
    } else {
      expect.fail('Buy event not emitted');
    }

    program.removeEventListener(id);
  });

});
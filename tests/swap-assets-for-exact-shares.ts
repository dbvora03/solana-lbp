import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ONE_DAY, SOL, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, getSwapFees, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("swap assets for exact shares", () => {
  /* Settings */
  const factoryId = new anchor.BN(300);
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

  let lbpFactoryPda;

  let feeRecipient;
  let feeAssetVault;
  let feeShareVault;

  let lbpFactorySettingsAuthority;

  let poolId = factoryId.clone();

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
    lbpFactoryPda = await initialize(factoryId, feeRecipient.publicKey, lbpFactorySettingsAuthority);
  });

  beforeEach(async () => {
      // use a new pool id 
      poolId = poolId.add(new anchor.BN(1));

      // prepare buyer account
      const { 
          user: _buyer, 
          userAssetVault: _buyerAssetVault, 
          userShareVault: _buyerShareVault 
      } = await createUser(assetMint, shareMint);
      buyer = _buyer;
      buyerAssetVault = _buyerAssetVault;
      buyerShareVault = _buyerShareVault;

      const { 
        user: _depositor, 
        userAssetVault: _depositorAssetVault, 
        userShareVault: _depositorShareVault 
      } = await createUser(assetMint, shareMint);
      depositor = _depositor;
      depositorAssetVault = _depositorAssetVault;
      depositorShareVault = _depositorShareVault;
  });
  
  it("test swap assets for exact shares with recipient = depositor", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);

    const sharesOut = SOL;
    let maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    ).accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      lbpFactorySetting: lbpFactoryPda,
    }).view();

    let swapFees = await getSwapFees(lbpFactoryPda);
    swapFees = maxAssetsIn.mul(swapFees).div(SOL);
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
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      depositorAssetsAccount: buyerAssetVault,
      recipientUserStats: buyerStats,
      lbpFactorySetting:lbpFactoryPda,
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
      assert.ok(poolAssetAmount == new anchor.BN(assetsIn).add(defaultInitialAssetAmount).toString(), "pool asset amount");
      assert.ok(maxAssetsIn.toString() == assetsIn, "max assets in");
      const lbpAccount = await program.account.pool.fetch(pool.publicKey);
      assert.ok(lbpAccount.totalPurchased.toString() == sharesOut.toString(), "total purchased");
      const buyerStatsAccount = await program.account.userStats.fetch(buyerStats);
      assert.ok(buyerStatsAccount.purchased.toString() == sharesOut.toString(), "purchased");
    } else {
      expect.fail('Buy event not emitted');
    }

    program.removeEventListener(id);

  });

  it("test swap assets for exact shares with recipient != depositor", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);

    const sharesOut = SOL;
    let maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    ).accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      lbpFactorySetting: lbpFactoryPda,
    }).view();

    let swapFees = await getSwapFees(lbpFactoryPda);
    swapFees = maxAssetsIn.mul(swapFees).div(SOL);
    maxAssetsIn = maxAssetsIn.add(swapFees);

    let buyEvent = null;
    const id = program.addEventListener('Buy', (event, slot) => {
      buyEvent = event;
    });

    const {
      user: sharesRecipient,
    } = await createUser(assetMint, shareMint);

    const { userStats: sharesRecipientUserStats } = await createUserStats(pool.publicKey, sharesRecipient);
    
    await program.methods.swapAssetsForExactShares(
      sharesRecipient.publicKey,
      sharesOut,
      maxAssetsIn,
    ).accounts({
      depositor: buyer.publicKey,
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      depositorAssetsAccount: buyerAssetVault,
      recipientUserStats: sharesRecipientUserStats,
      lbpFactorySetting:lbpFactoryPda,
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
      assert.ok(poolAssetAmount == new anchor.BN(assetsIn).add(defaultInitialAssetAmount).toString(), "pool asset amount");
      assert.ok(maxAssetsIn.toString() == assetsIn, "max assets in");
      const lbpAccount = await program.account.pool.fetch(pool.publicKey);
      assert.ok(lbpAccount.totalPurchased.toString() == sharesOut.toString(), "total purchased");
      const sharesRecipientUserStatsInfo = await program.account.userStats.fetch(sharesRecipientUserStats);
      assert.ok(sharesRecipientUserStatsInfo.purchased.toString() == sharesOut.toString(), "purchased");
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
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);

    const sharesOut = SOL;
    let maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();

    let buyEvent = null;
    const id = program.addEventListener('Buy', (event, slot) => {
      buyEvent = event;
    });

    let swapFees = await getSwapFees(lbpFactoryPda);
    swapFees = maxAssetsIn.mul(swapFees).div(SOL);
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
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      depositorAssetsAccount: buyerAssetVault,
      recipientUserStats: buyerStats,
      lbpFactorySetting:lbpFactoryPda,
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
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();

    let swapFees2 = await getSwapFees(lbpFactoryPda);
    swapFees2 = maxAssetsIn2.mul(swapFees2).div(SOL);
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
      poolAssetsMint: assetMint,
      poolSharesMint: shareMint,
      depositorAssetsAccount: buyerAssetVault,
      recipientUserStats: buyerStats,
      lbpFactorySetting:lbpFactoryPda,
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
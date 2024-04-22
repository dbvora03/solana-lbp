import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { ONE_DAY, SOL, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("Weight Calculations", () => {
  /* Settings */
  const factoryId = new anchor.BN(700);
  const decimals = 6; // mint decimals

  /* Global Variables */
  let assetMint;
  let shareMint;
  let assetGod;
  let shareGod;

  let buyer;
  let buyerAssetVault;
  let buyerShareVault;

  let lbpFactoryPda;

  let managerShareVault;
  let feeAssetVault;
  let feeShareVault;
  let redeemRecipientShareVault;

  let poolId = factoryId.clone();
  
  before(async () => {
      // init manager
      lbpFactoryPda = await initialize(factoryId);
  });

  beforeEach(async () => {
    // funds users
    await fund(provider.wallet.publicKey);

      // use a new pool id 
      poolId = poolId.add(new anchor.BN(1));

      // prepare mints
      [assetMint, assetGod] = await createMintAndVault(
          SOL.mul(new anchor.BN(10_000_000)),
          provider.wallet.publicKey,
          decimals
      );
      [shareMint, shareGod] = await createMintAndVault(
          SOL.mul(new anchor.BN(10_000_000)),
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
  });

  it("test normal weight", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
        
    const {
        pool,
        assetVault,
        assetVaultAuthority,
        shareVault,
        shareVaultAuthority,
    } = await createPool(poolId, poolSettings, assetGod, shareGod, lbpFactoryPda, assetMint, shareMint);

    const defaultSharesOut = new anchor.BN(10).mul(SOL);
    const expectedAssetsIn = 10;

    // in this example the assetWeight and shareWeight would be equal
    let assetsIn = await program.methods.previewAssetsIn(
      defaultSharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();
    assert.ok(assetsIn.div(SOL).eq(new anchor.BN(expectedAssetsIn)), "assetsIn should be 10");
  });

  it("test max weight", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const now = await getNow()
    poolSettings.weightStart = SOL.div(new anchor.BN(100)).mul(new anchor.BN(99)); // 0.99 sol
    poolSettings.weightEnd = SOL.div(new anchor.BN(100)).mul(new anchor.BN(99)); // 0.99 sol
    
    const {
        pool,
        assetVault,
        assetVaultAuthority,
        shareVault,
        shareVaultAuthority,
    } = await createPool(poolId, poolSettings, assetGod, shareGod, lbpFactoryPda, assetMint, shareMint);

    const defaultSharesOut = new anchor.BN(100).mul(SOL);
    const expectedAssetsIn = 1;

    // in this example the assetWeight and shareWeight would be equal
    let assetsIn = await program.methods.previewAssetsIn(
      defaultSharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();
    assert.ok(assetsIn.div(SOL).eq(new anchor.BN(expectedAssetsIn)), "assetsIn should be 1");
  });

  it("test min weight", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const initialShareAmount = SOL.mul(new anchor.BN(10_000_000));
    const initialAssetAmount = SOL.mul(new anchor.BN(10_000_000));
    poolSettings.weightStart = SOL.div(new anchor.BN(100)); // 1%
    poolSettings.weightEnd = SOL.div(new anchor.BN(100)); // 1%
    
    const {
        pool,
        assetVault,
        assetVaultAuthority,
        shareVault,
        shareVaultAuthority,
    } = await createPool(poolId, poolSettings, assetGod, shareGod, lbpFactoryPda, assetMint, shareMint, initialShareAmount, initialAssetAmount);
    
    const defaultSharesOut = new anchor.BN(10).mul(SOL);
    const expectedAssetsIn = 990;
    
    // in this example the assetWeight and shareWeight would be equal
    let assetsIn = await program.methods.previewAssetsIn(
      defaultSharesOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();
    assert.ok(assetsIn.div(SOL).eq(new anchor.BN(expectedAssetsIn)), "assetsIn should be 990");
  });
});

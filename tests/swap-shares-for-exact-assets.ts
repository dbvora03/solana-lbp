import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ONE_DAY, SOL, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, getSwapFees, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("swap shares for exact assets", () => {
  /* Settings */
  const factoryId = new anchor.BN(600);
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

  let depositor;
  let depositorAssetVault;
  let depositorShareVault;

  let poolId = factoryId.clone();

  before(async () => {
    // funds users
    await fund(provider.wallet.publicKey);

    // init manager
    lbpFactoryPda = await initialize(factoryId);
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


  it("test slippage too high", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);

    const assetsOut = SOL;
    let maxShares = await program.methods.previewSharesIn(
      assetsOut
    )
    .accounts({
      pool: pool.publicKey,
      poolAssetsAccount: assetVault.publicKey,
      poolSharesAccount: shareVault.publicKey,
      lbpFactorySetting:lbpFactoryPda,
    })
    .view();

    maxShares = maxShares.sub(new anchor.BN(1));
    const { userStats: buyerStats } = await createUserStats(pool.publicKey, buyer);

    try {
      await program.methods.swapSharesForExactAssets(
        buyer.publicKey,
        assetsOut,
        maxShares
      ).accounts({
        depositor: buyer.publicKey,
        pool: pool.publicKey,
        poolAssetsAccount: assetVault.publicKey,
        assetVaultAuthority: assetVaultAuthority,
        poolSharesAccount: shareVault.publicKey,
        depositorAssetsAccount: buyerAssetVault,
        buyerStats: buyerStats,
        lbpFactorySetting:lbpFactoryPda,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Slippage Exceeded");
    }

  });
  

});
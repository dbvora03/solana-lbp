import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN_0, BN_1, ONE_DAY, SOL, TWO_DAYS, ZERO_ADDRESS, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("Pool Creation Tests", () => {
  /* Settings */
  const factoryId = new anchor.BN(100);
  const decimals = 6; // mint decimals

  /* Global Variables */
  let assetMint;
  let shareMint;
  let assetGod;
  let shareGod;

  let feeRecipient;
  let feeAssetVault;
  let feeShareVault;

  let lbpFactorySettingsAuthority;

  let depositor;
  let depositorAssetVault;
  let depositorShareVault;

  let lbpFactoryPda;
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

  it("should create vesting pool", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = poolSettings.saleEnd.add(ONE_DAY);
    poolSettings.vestEnd = poolSettings.saleEnd.add(TWO_DAYS);

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
  });
  
  it("should create no vesting pool", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = BN_0;
    poolSettings.vestEnd = BN_0;

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
  });

  it("should revert vesting pool invalid vest cliff", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = poolSettings.saleEnd.sub(BN_1);
    poolSettings.vestEnd = poolSettings.saleEnd.add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Vest Cliff");
    }
  });

  it("should revert vesting pool invalid vest end", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = poolSettings.saleEnd.add(BN_1);
    poolSettings.vestEnd = poolSettings.saleEnd.add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Vest End");
    }
  });

  it("should success for zero LBP creation", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const initialAssetAmount = BN_0;
    poolSettings.virtualAssets = SOL;

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
  });

  it("should revert for zero LBP creation invalid virtual asset", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const initialAssetAmount = BN_0;
    const virtualAssetAmount = BN_0;
    poolSettings.virtualAssets = virtualAssetAmount;

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint, defaultInitialShareAmount, initialAssetAmount);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Value");
    }
  });

  it("should revert invalid weight end max", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightEnd = SOL.mul(new anchor.BN(0.99)).add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });
  
  it("should revert invalid weight start max", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightStart = SOL.mul(new anchor.BN(0.99)).add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid weight start min", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightStart = SOL.mul(new anchor.BN(0.01)).sub(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid weight end min", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightEnd = SOL.mul(new anchor.BN(0.01)).sub(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid share zero", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, ZERO_ADDRESS);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Or Share");
    }
  });

  it("should revert invalid asset zero", async () => {
    const poolSettings = await getDefaultPoolSettings(ZERO_ADDRESS, shareMint);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Or Share");
    }
  });

  it("should revert invalid asset", async () => {
    const oldAssetMint = assetMint;
    assetMint = shareMint;
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("A raw constraint was violated");
    } finally {
      assetMint = oldAssetMint;
    }
  });

  it("should gets vault address and vault authority address from pool account", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    const {
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpFactoryPda, assetMint, shareMint);

    const poolAccountAddressStoredInDB = pool.publicKey;
    const poolAccount = await program.account.pool.fetch(poolAccountAddressStoredInDB);
    assert.ok(poolAccount.assetVault.toString() === assetVault.publicKey.toString(), "Asset vault address should be the same");
    assert.ok(poolAccount.assetVaultAuthority.toString() === assetVaultAuthority.toString(), "Asset vault authority address should be the same");
    assert.ok(poolAccount.shareVault.toString() === shareVault.publicKey.toString(), "Share vault address should be the same");
    assert.ok(poolAccount.shareVaultAuthority.toString() === shareVaultAuthority.toString(), "Share vault authority address should be the same");
  });
});

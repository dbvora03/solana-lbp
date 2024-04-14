import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN_0, BN_1, ONE_DAY, SOL, TWO_DAYS, ZERO_ADDRESS, closePool, createMintAndVault, createPool, createUser, createUserStats, createVault, defaultInitialAssetAmount, defaultInitialShareAmount, fund, getDefaultPoolSettings, getNow, initialize, program, provider, swapExactAssetsForShares } from "./utils";

describe("Pool Creation Tests", () => {
  /* Settings */
  const managerId = new anchor.BN(100);
  const decimals = 6; // mint decimals

  /* Global Variables */
  let assetMint;
  let shareMint;
  let assetGod;
  let shareGod;

  let depositor;
  let depositorAssetVault;
  let depositorShareVault;

  let lbpManagerPda;
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

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
  });
  
  it("should create no vesting pool", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = BN_0;
    poolSettings.vestEnd = BN_0;

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
  });

  it("should revert vesting pool invalid vest cliff", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.vestCliff = poolSettings.saleEnd.sub(BN_1);
    poolSettings.vestEnd = poolSettings.saleEnd.add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
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
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Vest End");
    }
  });

  it("should success for zero LBP creation", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const initialAssetAmount = BN_0;
    poolSettings.virtualAssets = SOL;

    await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
  });

  it("should revert for zero LBP creation invalid virtual asset", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const initialAssetAmount = BN_0;
    const virtualAssetAmount = BN_0;
    poolSettings.virtualAssets = virtualAssetAmount;

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint, defaultInitialShareAmount, initialAssetAmount);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Value");
    }
  });

  it("should revert invalid weight end max", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightEnd = SOL.mul(new anchor.BN(0.99)).add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });
  
  it("should revert invalid weight start max", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightStart = SOL.mul(new anchor.BN(0.99)).add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid weight start min", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightStart = SOL.mul(new anchor.BN(0.01)).sub(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid weight end min", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.weightEnd = SOL.mul(new anchor.BN(0.01)).sub(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Weight Config");
    }
  });

  it("should revert invalid start date", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    poolSettings.saleEnd = (await getNow()).add(TWO_DAYS);
    poolSettings.saleStart = poolSettings.saleEnd.sub(ONE_DAY).add(BN_1);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Sale Period Low");
    }
  });

  it("should revert invalid end date", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);
    const now = await getNow();
    poolSettings.saleEnd = now.sub(ONE_DAY);
    poolSettings.saleStart = poolSettings.saleEnd.sub(ONE_DAY);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Sale Period Low");
    }
  });

  it("should revert invalid share zero", async () => {
    const poolSettings = await getDefaultPoolSettings(assetMint, ZERO_ADDRESS);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Or Share");
    }
  });

  it("should revert invalid asset zero", async () => {
    const poolSettings = await getDefaultPoolSettings(ZERO_ADDRESS, shareMint);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Invalid Asset Or Share");
    }
  });

  it("should revert invalid asset", async () => {
    assetMint = shareMint;
    const poolSettings = await getDefaultPoolSettings(assetMint, shareMint);

    try {
      await createPool(poolId, poolSettings, depositorAssetVault, depositorShareVault, depositor, lbpManagerPda, assetMint, shareMint);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("A raw constraint was violated");
    }
  });
});

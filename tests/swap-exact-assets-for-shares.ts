import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("swap exact assets for shares", () => {
  // constants
  const SOL = new anchor.BN(1_000_000_000);
  const ONE_DAY = new anchor.BN(86400);
  const TWO_DAYS = new anchor.BN(172800);
  const TEN_DAYS = new anchor.BN(864000);
  const BN_0 = new anchor.BN(0);
  const defaultInitialShareAmount = SOL.mul(new anchor.BN(1000));
  const defaultInitialAssetAmount = SOL.mul(new anchor.BN(1000));

  const managerId = new anchor.BN(4);

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
  
  const depositor = anchor.web3.Keypair.generate();
  const bob = anchor.web3.Keypair.generate();

  let lbpManagerPda;
  let assetMint;
  let shareMint;
  let depositorAssetTokenAccount;
  let depositorShareTokenAccount;
  let poolAssetKp;
  let poolShareKp;
  let buyerStatsPda;
  let referrerStatsPda;

  const totalSwapFeesAsset = new anchor.BN(0);
  const totalSwapFeesShare = new anchor.BN(0);
  const totalPurchased = new anchor.BN(0);
  const totalReferred = new anchor.BN(0);

  const fund = async (pubkey) => {
    const airdropSignature = await provider.connection.requestAirdrop(
      pubkey,
      100_000 * SOL.toNumber()
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
  };

  const getDefaultPoolSettings = async () => {
    let now = new anchor.BN(await provider.connection.getBlockTime(await provider.connection.getSlot()))
    const weightStart = SOL.div(new anchor.BN(2));
    const weightEnd = SOL.div(new anchor.BN(2));
    const saleStart = now.add(ONE_DAY);
    const saleEnd = now.add(TWO_DAYS);
    const sellingAllowed = true;
    const maxSharePrice = new anchor.BN(SOL.mul(new anchor.BN(10_000)));
    const maxSharesOut = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const maxAssetsIn = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const vestCliff = BN_0;
    const vestEnd = BN_0;
    const virtualAssets = BN_0;
    const virtualShares = BN_0;

    const poolSettings = {
        asset: assetMint,
        share: shareMint,
        creator: depositor.publicKey,
        virtualAssets,
        virtualShares,
        maxSharePrice,
        maxSharesOut,
        maxAssetsIn,
        weightStart,
        weightEnd,
        saleStart,
        saleEnd,
        vestCliff,
        vestEnd,
        sellingAllowed,
    };

    return poolSettings;
  }

  const create_pool = async (
    poolSettings, 
    poolId,
    initialShareAmount = defaultInitialShareAmount,
    initialAssetAmount = defaultInitialAssetAmount,
  ) => {
    const pool_account_address = await get_pool_account_address(poolId);
    await program.methods.createPool(
        poolSettings,
        poolId,
        initialShareAmount,
        initialAssetAmount,
    ).accounts({
        depositor: depositor.publicKey,
        assetMint,
        shareMint,
        depositorAccountAsset: depositorAssetTokenAccount,
        depositorAccountShare: depositorShareTokenAccount,
        lbpManagerInfo: lbpManagerPda,
        pool: pool_account_address,
        poolAccountAsset: poolAssetKp.publicKey,
        poolAccountShare: poolShareKp.publicKey,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([depositor, poolAssetKp, poolShareKp])
    .rpc();
  }

  const setUp = async (poolAccountAddress) => {
    [buyerStatsPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("user_stats"),
        poolAccountAddress.toBuffer(),
        depositor.publicKey.toBuffer(),  
      ],
      program.programId
    );

    [referrerStatsPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("user_stats"),
        poolAccountAddress.toBuffer(),
        bob.publicKey.toBuffer(),  
      ],
      program.programId
    );
  }

  const get_pool_account_address = async (poolId) => {
    let [pool_account_address] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("pool"),
            lbpManagerPda.toBuffer(),
            assetMint.toBuffer(),
            shareMint.toBuffer(),
            poolId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
    );
    return pool_account_address;
  }

  before(async () => {
    await fund(depositor.publicKey);
    await fund(bob.publicKey);

    [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("lbp-manager"),
        managerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    
    // initialize pool factory
    const fee_recipient = provider.wallet.publicKey;
    
    let tx = await program.methods
      .initialize(
        managerId,
        fee_recipient,
        new anchor.BN(1000),
        new anchor.BN(1000),
        new anchor.BN(1000)
      )
      .accounts({
        authority: fee_recipient,
        lbpManagerInfo: lbpManagerPda,
      })
      .rpc();

  });

  beforeEach(async () => {
    assetMint = await splToken.createMint(
      provider.connection,
      depositor,
      depositor.publicKey,
      null,
      6
    );
    shareMint = await splToken.createMint(
        provider.connection,
        depositor,
        depositor.publicKey,
        depositor.publicKey,
        6
    );

    depositorAssetTokenAccount =
      await splToken.createAssociatedTokenAccount(
          provider.connection,
          depositor,
          assetMint,
          depositor.publicKey
      );
    depositorShareTokenAccount =
      await splToken.createAssociatedTokenAccount(
          provider.connection,
          depositor,
          shareMint,
          depositor.publicKey
      );
    
    await splToken.mintTo(
      provider.connection,
      depositor,
      assetMint,
      depositorAssetTokenAccount,
      depositor.publicKey,
      20_000_000 * SOL.toNumber()
    );
    await splToken.mintTo(
      provider.connection,
      depositor,
      shareMint,
      depositorShareTokenAccount,
      depositor.publicKey,
      20_000_000 * SOL.toNumber()
    );
    
    poolAssetKp = anchor.web3.Keypair.generate();
    poolShareKp = anchor.web3.Keypair.generate();
  });

  const getSwapFees = async () => {
    const lbpManagerInfoAccount = await program.account.lbpManagerInfo.fetch(lbpManagerPda);
    return lbpManagerInfoAccount.swapFee;
  }

  it("test swap exact assets for shares", async () => {
    const poolId = new anchor.BN(301);
    const poolAccountAddress = await get_pool_account_address(poolId);
    const poolSettings = await getDefaultPoolSettings();
    await create_pool(poolSettings, poolId);
    await setUp(poolAccountAddress);

    const assetsIn = SOL;
    let minSharesOut = await program.methods.previewSharesOut(
        assetsIn
    )
    .accounts({
        pool: poolAccountAddress,
        poolAssetsAccount: poolAssetKp.publicKey,
        poolSharesAccount: poolShareKp.publicKey,
        lbpManagerInfo: lbpManagerPda,
    })
    .view();

    console.log("here", minSharesOut.toString());

    let buyEvent = null;
    const id = program.addEventListener('Buy', (event, slot) => {
      buyEvent = event;
    });

    console.log("here", depositor.publicKey.toString());

    await program.methods.swapExactAssetsForShares(
        bob.publicKey,
        depositor.publicKey,
        depositor.publicKey,
        assetsIn,
        minSharesOut,
    ).accounts({
        depositor: depositor.publicKey,
        pool: poolAccountAddress,
        poolAssetsAccount: poolAssetKp.publicKey,
        poolSharesAccount: poolShareKp.publicKey,
        depositorAssetAccount: depositorAssetTokenAccount,
        buyerStats: buyerStatsPda,
        referrerStats: referrerStatsPda,
        lbpManagerInfo: lbpManagerPda,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([depositor])
    .rpc();

    // if (buyEvent) {
    //   const assetsIn = buyEvent.assets;
    //   const sharesOut = buyEvent.shares;

    //   const poolAssetAmount = (await provider.connection.getTokenAccountBalance(poolAssetKp.publicKey)).value.amount;
    //   assert.ok(poolAssetAmount == new anchor.BN(assetsIn).add(defaultInitialAssetAmount).toString(), "assetsIn");
    //   assert.ok(sharesOut == minSharesOut.toString(), "sharesOut"); 

    //   const lbpAccount = await program.account.pool.fetch(poolAccountAddress);
    //   assert.ok(lbpAccount.totalPurchased.toString() == sharesOut.toString(), "totalPurchased");

    //   const buyerStats = await program.account.userStats.fetch(buyerStatsPda);
    //   assert.ok(buyerStats.purchased.toString() == sharesOut.toString(), "purchased");
    // } else {
    //   expect.fail('Buy event not emitted');
    // }

    program.removeEventListener(id);
  });

  it("test second swap", async () => {
    // const poolId = new anchor.BN(302);
    // const poolAccountAddress = await get_pool_account_address(poolId);
    // const poolSettings = await getDefaultPoolSettings();
    // await create_pool(poolSettings, poolId);
    // await setUp(poolAccountAddress);

    // const assetsIn = SOL;
    // let minSharesOut = await program.methods.previewSharesOut(
    //     assetsIn
    // )
    // .accounts({
    //     pool: poolAccountAddress,
    //     poolAssetsAccount: poolAssetKp.publicKey,
    //     poolSharesAccount: poolShareKp.publicKey,
    //     lbpManagerInfo: lbpManagerPda,
    // })
    // .view();

    // let buyEvent = null;
    // const id = program.addEventListener('Buy', (event, slot) => {
    //   buyEvent = event;
    // });

    // await program.methods.swapExactAssetsForShares(
    //     bob.publicKey,
    //     depositor.publicKey,
    //     assetsIn,
    //     minSharesOut,
    // ).accounts({
    //     depositor: depositor.publicKey,
    //     pool: poolAccountAddress,
    //     poolAssetsAccount: poolAssetKp.publicKey,
    //     poolSharesAccount: poolShareKp.publicKey,
    //     depositorAssetAccount: depositorAssetTokenAccount,
    //     buyerStats: buyerStatsPda,
    //     referrerStats: referrerStatsPda,
    //     lbpManagerInfo: lbpManagerPda,
    //     tokenProgram: splToken.TOKEN_PROGRAM_ID,
    //     rent: SYSVAR_RENT_PUBKEY,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    // })
    // .signers([depositor])
    // .rpc();

    // let assetsIn1;
    // let sharesOut1;

    // if (buyEvent) {
    //   assetsIn1 = buyEvent.assets;
    //   sharesOut1 = buyEvent.shares;
    // } else {
    //   expect.fail('Buy event not emitted');
    // }

    // let minSharesOut2 = await program.methods.previewSharesOut(
    //     assetsIn
    // )
    //   .accounts({
    //     pool: poolAccountAddress,
    //     poolAssetsAccount: poolAssetKp.publicKey,
    //     poolSharesAccount: poolShareKp.publicKey,
    //     lbpManagerInfo: lbpManagerPda,
    //   })
    //   .view();

    //   console.log("minSharesOut2", minSharesOut2.toString());
  
    //   await program.methods.swapExactAssetsForShares(
    //     bob.publicKey,
    //     assetsIn,
    //     minSharesOut2,
    //     depositor.publicKey
    //   ).accounts({
    //     depositor: depositor.publicKey,
    //     pool: poolAccountAddress,
    //     poolAssetsAccount: poolAssetKp.publicKey,
    //     poolSharesAccount: poolShareKp.publicKey,
    //     depositorAssetAccount: depositorAssetTokenAccount,
    //     buyerStats: buyerStatsPda,
    //     referrerStats: referrerStatsPda,
    //     lbpManagerInfo: lbpManagerPda,
    //     tokenProgram: splToken.TOKEN_PROGRAM_ID,
    //     rent: SYSVAR_RENT_PUBKEY,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    //   })
    //   .signers([depositor])
    //   .rpc();
  
    //   if (buyEvent) {
    //     const assetsIn2 = buyEvent.assets;
    //     const sharesOut2 = buyEvent.shares;
    //     console.log("here", assetsIn2.toString(), sharesOut2.toString());
  
    //     const poolAssetAmount = (await provider.connection.getTokenAccountBalance(poolAssetKp.publicKey)).value.amount;
    //     assert.ok(poolAssetAmount == new anchor.BN(assetsIn1).add(defaultInitialAssetAmount).add(assetsIn2).toString(), "assetsIn");
    //     assert.ok(minSharesOut2.toString() == sharesOut2, "sharesOut");
  
    //     const lbpAccount = await program.account.pool.fetch(poolAccountAddress);
    //     assert.ok(lbpAccount.totalPurchased.toString() == sharesOut1.add(sharesOut2).toString(), "totalPurchased");
  
    //     const buyerStats = await program.account.userStats.fetch(buyerStatsPda);
    //     assert.ok(buyerStats.purchased.toString() == sharesOut1.add(sharesOut2).toString(), "purchased");
    //   } else {
    //     expect.fail('Buy event not emitted');
    //   }
  
    // program.removeEventListener(id);

  });
  
});

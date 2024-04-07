import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe.only("swap", () => {
  const SOL = new anchor.BN(1_000_000_000);
  const ONE_DAY = new anchor.BN(86400);
  const TWO_DAYS = new anchor.BN(172800);
  const BN_2 = new anchor.BN(2);
  const BN_256 = new anchor.BN(256);
  const BN_0 = new anchor.BN(0);
  const BN_1 = new anchor.BN(1);
  const ZERO_ADDRESS = new anchor.web3.PublicKey("11111111111111111111111111111111");

  const managerId = new anchor.BN(2);

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
  
  const creator = anchor.web3.Keypair.generate();
  const alice = anchor.web3.Keypair.generate();
  const bob = anchor.web3.Keypair.generate();
  const sharesOut = BN_0;
  const maxAssetsIn = BN_0;

  let lbpManagerPda;
  let assetMint;
  let shareMint;
  let depositorAssetTokenAccount;
  let poolAccountAddress;
  let poolAssetKp;
  let poolShareKp;

  let buyerStatsPda;
  let referrerStatsPda;

  let creatorAssetTokenAccount;
  let creatorShareTokenAccount;

  const fund = async (pubkey) => {
    const airdropSignature = await provider.connection.requestAirdrop(
      pubkey,
      2000 * 1_000_000_000
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
};

  const create_pool = async () => {
    let now = new anchor.BN(await provider.connection.getBlockTime(await provider.connection.getSlot()))
    const saleStart = now.add(ONE_DAY);
    const saleEnd = now.add(TWO_DAYS);
    const vestCliff = now.add(ONE_DAY).add(TWO_DAYS);
    const vestEnd = now.add(TWO_DAYS).add(TWO_DAYS);
    const virtualAssets = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const virtualShares = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const maxSharePrice = new anchor.BN(SOL.mul(new anchor.BN(10_000)));
    // const maxSharesOut = BN_2.pow(BN_256).sub(new anchor.BN(1)); // type(uint256).max
    const maxSharesOut = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const maxAssetsIn = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const weightStart = SOL.div(new anchor.BN(2));
    const weightEnd = SOL.div(new anchor.BN(2));
    const sellingAllowed = true;
    const initialShareAmount = SOL.mul(new anchor.BN(1000));
    const initialAssetAmount = SOL.mul(new anchor.BN(1000));

    const poolId = new anchor.BN(1000);
    const pool_account_address = await get_pool_account_address(poolId);
        const poolSettings = {
            asset: assetMint,
            share: shareMint,
            creator: creator.publicKey,
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
        await program.methods.createPool(
            poolSettings,
            poolId,
            initialShareAmount,
            initialAssetAmount,
        ).accounts({
            depositor: creator.publicKey,
            assetMint,
            shareMint,
            depositorAccountAsset: creatorAssetTokenAccount,
            depositorAccountShare: creatorShareTokenAccount,
            lbpManagerInfo: lbpManagerPda,
            pool: pool_account_address,
            poolAccountAsset: poolAssetKp.publicKey,
            poolAccountShare: poolShareKp.publicKey,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator, poolAssetKp, poolShareKp])
        .rpc();
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
    await fund(creator.publicKey);
    await fund(alice.publicKey);
    await fund(bob.publicKey);

    [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("lbp-manager"),
        managerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    assetMint = await splToken.createMint(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      provider.wallet.publicKey,
      null,
      6
    );
    shareMint = await splToken.createMint(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        provider.wallet.publicKey,
        provider.wallet.publicKey,
        6
    );

    depositorAssetTokenAccount =
      await splToken.createAssociatedTokenAccount(
          provider.connection,
          (provider.wallet as NodeWallet).payer,
          assetMint,
          alice.publicKey
      );
      creatorAssetTokenAccount =
      await splToken.createAssociatedTokenAccount(
          provider.connection,
          (provider.wallet as NodeWallet).payer,
          assetMint,
          creator.publicKey
      );
    creatorShareTokenAccount =
      await splToken.createAssociatedTokenAccount(
          provider.connection,
          (provider.wallet as NodeWallet).payer,
          shareMint,
          creator.publicKey
      );
    
      await splToken.mintTo(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        assetMint,
        creatorAssetTokenAccount,
        (provider.wallet as NodeWallet).payer.publicKey,
        1000_000_000_000
      );
    await splToken.mintTo(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        shareMint,
        creatorShareTokenAccount,
        (provider.wallet as NodeWallet).payer.publicKey,
        1000_000_000_000
    );
    await splToken.mintTo(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      assetMint,
      depositorAssetTokenAccount,
      (provider.wallet as NodeWallet).payer.publicKey,
      1000_000_000_000
  );
    
    poolAssetKp = anchor.web3.Keypair.generate();
    poolShareKp = anchor.web3.Keypair.generate();

    // initialize pool
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

    await create_pool();
    const poolId = new anchor.BN(1000);
    poolAccountAddress = await get_pool_account_address(poolId);

    [buyerStatsPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("user_stats"),
        poolAccountAddress.toBuffer(),
        alice.publicKey.toBuffer(),  
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

  });

  it("should revert pre slae start", async () => {
    const sharesOut = SOL;
    const maxAssetsIn = await program.methods.previewAssetsIn(
      sharesOut
    )
    .accounts({
      pool: poolAccountAddress,
      poolAssetsAccount: poolAssetKp.publicKey,
      poolSharesAccount: poolShareKp.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .view();
    console.log(maxAssetsIn);
    await program.methods.swapAssetsForExactShares(
      bob.publicKey,
      sharesOut,
      maxAssetsIn,
      alice.publicKey
    ).accounts({
      depositor: alice.publicKey,
      pool: poolAccountAddress,
      poolAssetsAccount: poolAssetKp.publicKey,
      poolSharesAccount: poolShareKp.publicKey,
      depositorAssetsAccount: depositorAssetTokenAccount,
      buyerStats: buyerStatsPda,
      referrerStats: referrerStatsPda,
      lbpManagerInfo: lbpManagerPda,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([alice])
    .rpc()
  });
});

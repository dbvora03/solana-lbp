import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
describe("swap shares for exact assets", () => {
  // constants
  const SOL = new anchor.BN(1_000_000_000);
  const ONE_DAY = new anchor.BN(86400);
  const TWO_DAYS = new anchor.BN(172800);
  const TEN_DAYS = new anchor.BN(864000);
  const BN_0 = new anchor.BN(0);
  const defaultInitialShareAmount = SOL.mul(new anchor.BN(1000));
  const defaultInitialAssetAmount = SOL.mul(new anchor.BN(1000));
  const managerId = new anchor.BN(5);
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
  
  const creator = anchor.web3.Keypair.generate();
  const alice = anchor.web3.Keypair.generate();
  const bob = anchor.web3.Keypair.generate();
  let lbpManagerPda;
  let assetMint;
  let shareMint;
  let depositorAssetTokenAccount;
  let poolAssetKp;
  let poolShareKp;
  let creatorAssetTokenAccount;
  let creatorShareTokenAccount;
  let buyerStatsPda;

  const fund = async (pubkey) => {
    const airdropSignature = await provider.connection.requestAirdrop(
      pubkey,
      1000 * SOL.toNumber()
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
        initialAssetAmount
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

  const setUp = async (poolAccountAddress) => {
    [buyerStatsPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("user_stats"),
        poolAccountAddress.toBuffer(), 
        alice.publicKey.toBuffer(),
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
      20_000_000 * SOL.toNumber()
    );
    await splToken.mintTo(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      shareMint,
      creatorShareTokenAccount,
      (provider.wallet as NodeWallet).payer.publicKey,
      20_000_000 * SOL.toNumber()
    );
    await splToken.mintTo(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      assetMint,
      depositorAssetTokenAccount,
      (provider.wallet as NodeWallet).payer.publicKey,
      20_000_000 * SOL.toNumber()
    );
    
    poolAssetKp = anchor.web3.Keypair.generate();
    poolShareKp = anchor.web3.Keypair.generate();
  });

  const getSwapFees = async () => {
    const lbpManagerInfoAccount = await program.account.lbpManagerInfo.fetch(lbpManagerPda);
    return lbpManagerInfoAccount.swapFee;
  }

  it("test slippage too high", async () => {
    const poolId = new anchor.BN(501);
    const poolAccountAddress = await get_pool_account_address(poolId);
    const poolSettings = await getDefaultPoolSettings();
    await create_pool(poolSettings, poolId);
    await setUp(poolAccountAddress);
    
    const assetsOut = SOL;
    let maxShares = await program.methods.previewSharesIn(
      assetsOut
    )
    .accounts({
      pool: poolAccountAddress,
      poolAssetsAccount: poolAssetKp.publicKey,
      poolSharesAccount: poolShareKp.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .view();

    maxShares = maxShares.sub(new anchor.BN(1));

    try {
      await program.methods.swapSharesForExactAssets(
        alice.publicKey,
        assetsOut,
        maxShares
      ).accounts({
        depositor: alice.publicKey,
        pool: poolAccountAddress,
        poolAssetsAccount: poolAssetKp.publicKey,
        poolSharesAccount: poolShareKp.publicKey,
        depositorAssetsAccount: depositorAssetTokenAccount,
        buyerStats: buyerStatsPda,
        lbpManagerInfo: lbpManagerPda,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();
    } catch (error) {
      expect(error.error.errorMessage).to.equal("Slippage Exceeded");
    }

  });
  

});
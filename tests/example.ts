import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { describe } from "mocha";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

interface PoolSettings {
  asset: anchor.web3.PublicKey;
  share: anchor.web3.PublicKey;
  mint: anchor.web3.PublicKey;
  creator: anchor.web3.PublicKey;
  virtualAssets: anchor.BN;
  virtualShares: anchor.BN;
  maxSharePrice: anchor.BN;
  maxSharesOut: anchor.BN;
  maxAssetsIn: anchor.BN;
  weightStart: anchor.BN;
  weightEnd: anchor.BN;
  saleStart: anchor.BN;
  saleEnd: anchor.BN;
  vestCliff: anchor.BN;
  vestEnd: anchor.BN;
  sellingAllowed: boolean;
}

const createLBPManager = async ({
  program,
  managerId,
  feeReciever,
  platformFee,
  referrerFee,
  swapFee,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  managerId: number;
  feeReciever: anchor.web3.PublicKey;
  platformFee: anchor.BN;
  referrerFee: anchor.BN;
  swapFee: anchor.BN;
}) => {
  // This is the account for the LBP manager
  // You need to pass this address in whenever the account references it
  const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("lbp-manager"),
      new anchor.BN(1).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  await program.methods
    .initialize(
      new anchor.BN(managerId),
      feeReciever,
      platformFee,
      referrerFee,
      swapFee
    )
    .accounts({
      authority: feeReciever,
      lbpManagerInfo: lbpManagerPda,
    })
    .rpc();

  return lbpManagerPda;
};

const getLBPManager = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  id: number
) => {
  const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("lbp-manager"),
      new anchor.BN(id).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  const lbpManagerInfoAccount = await program.account.lbpManagerInfo.fetch(
    lbpManagerPda
  );

  return lbpManagerInfoAccount;
};

const setPlatformFee = async ({
  program,
  signer,
  newFee,
  lbpManagerPda,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  signer: anchor.web3.Keypair;
  newFee: anchor.BN;
  lbpManagerPda: anchor.web3.PublicKey;
}) => {
  return await program.methods
    .setPlatformFee(newFee)
    .accounts({
      authority: signer.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .signers([signer])
    .rpc();
};

const setReferrerFee = async ({
  program,
  signer,
  newFee,
  lbpManagerPda,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  signer: anchor.web3.Keypair;
  newFee: anchor.BN;
  lbpManagerPda: anchor.web3.PublicKey;
}) => {
  return await program.methods
    .setReferrerFee(newFee)
    .accounts({
      authority: signer.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .signers([signer])
    .rpc();
};

const setSwapFee = async ({
  program,
  signer,
  newFee,
  lbpManagerPda,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  signer: anchor.web3.Keypair;
  newFee: anchor.BN;
  lbpManagerPda: anchor.web3.PublicKey;
}) => {
  return await program.methods
    .setSwapFee(newFee)
    .accounts({
      authority: signer.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .signers([signer])
    .rpc();
};

const setFeeRecipient = async ({
  program,
  signer,
  feeRecipient,
  lbpManagerPda,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  signer: anchor.web3.Keypair;
  feeRecipient: anchor.web3.PublicKey;
  lbpManagerPda: anchor.web3.PublicKey;
}) => {
  return await program.methods
    .setFeeRecipient(feeRecipient)
    .accounts({
      authority: signer.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .signers([signer])
    .rpc();
};

const transferOwnership = async ({
  program,
  signer,
  newOwner,
  lbpManagerId,
}) => {
  const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("lbp-manager"),
      new anchor.BN(lbpManagerId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  return await program.methods
    .transferOwnership(newOwner)
    .accounts({
      authority: signer.publicKey,
      lbpManagerInfo: lbpManagerPda,
    })
    .signers([signer])
    .rpc();
};

const get_pool_account_address = async ({
  program,
  poolId,
  lbpManagerPda,
  assetMint,
  shareMint,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  poolId: anchor.BN;
  lbpManagerPda: anchor.web3.PublicKey;
  assetMint: anchor.web3.PublicKey;
  shareMint: anchor.web3.PublicKey;
}) => {
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
};

const createPool = async ({
  initialShareAmount,
  initialAssetAmount,
  poolId,
  settings,
  program,
  lbpManagerPda,
  assetMint,
  shareMint,
  depositor,
  depositorAccountAsset,
  depositorAccountShare,
  poolAssetKp,
  poolShareKp,
}: {
  initialShareAmount: anchor.BN;
  initialAssetAmount: anchor.BN;
  poolId: number;
  settings: PoolSettings;
  program: anchor.Program<LiquidityBootstrapFjord>;
  lbpManagerPda: anchor.web3.PublicKey;
  assetMint: anchor.web3.PublicKey;
  shareMint: anchor.web3.PublicKey;
  depositor: anchor.web3.Keypair;
  depositorAccountAsset: anchor.web3.PublicKey;
  depositorAccountShare: anchor.web3.PublicKey;
  poolAssetKp: anchor.web3.Keypair;
  poolShareKp: anchor.web3.Keypair;
}) => {
  const pool_account_address = await get_pool_account_address({
    program,
    poolId: new anchor.BN(poolId),
    lbpManagerPda,
    assetMint,
    shareMint,
  });

  await program.methods
    .createPool(
      settings as PoolSettings,
      new anchor.BN(poolId),
      initialShareAmount,
      initialAssetAmount
    )
    .accounts({
      assetMint,
      shareMint,
      depositorAccountAsset,
      depositorAccountShare,
      poolAccountAsset: poolAssetKp.publicKey,
      poolAccountShare: poolShareKp.publicKey,
      lbpManagerInfo: lbpManagerPda,
      pool: pool_account_address,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([depositor, poolAssetKp, poolShareKp])
    .rpc();

  return pool_account_address;
};

const getPool = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  lbpManagerId: number,
  poolId: number,
  assetMint: anchor.web3.PublicKey,
  shareMint: anchor.web3.PublicKey
) => {
  const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("lbp-manager"),
      new anchor.BN(lbpManagerId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  const [poolPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool"),
      lbpManagerPda.toBuffer(),
      assetMint.toBuffer(),
      shareMint.toBuffer(),
      new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  const poolInfoAccount = await program.account.pool.fetch(poolPda);

  return poolInfoAccount;
};

const getUserStats = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  poolAddress: anchor.web3.PublicKey,
  referrer: anchor.web3.PublicKey
) => {
  const [userStats] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("user_stats"),
      poolAddress.toBuffer(),
      referrer.toBuffer(),
    ],
    program.programId
  );

  const userInfo = await program.account.userStats.fetch(userStats);
  return userInfo;
};

const swapAssetsForExactShares = async ({
  program,
  referrer,
  recipient,
  sharesOut,
  maxAssetsIn,

  depositor,
  poolPda,
  lbpManagerPda,
  poolAssetsAccount,
  poolSharesAccount,
  depositorAssetsAccount,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  referrer: anchor.web3.PublicKey;
  recipient: anchor.web3.PublicKey;
  sharesOut: anchor.BN;
  maxAssetsIn: anchor.BN;

  depositor: anchor.web3.Keypair;
  poolPda: anchor.web3.PublicKey;
  lbpManagerPda: anchor.web3.PublicKey;
  poolAssetsAccount: anchor.web3.PublicKey;
  poolSharesAccount: anchor.web3.PublicKey;
  depositorAssetsAccount: anchor.web3.PublicKey;
}) => {
  let [buyer_stats] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("user_stats"),
      poolPda.toBuffer(),
      recipient.toBuffer(),
    ],
    program.programId
  );

  let [referrer_stats] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("user_stats"),
      poolPda.toBuffer(),
      referrer.toBuffer(),
    ],
    program.programId
  );

  return await program.methods
    .swapAssetsForExactShares(referrer, recipient, sharesOut, maxAssetsIn)
    .accounts({
      depositor: depositor.publicKey,
      pool: poolPda,
      lbpManagerInfo: lbpManagerPda,
      poolAssetsAccount: poolAssetsAccount,
      poolSharesAccount: poolSharesAccount,
      depositorAssetsAccount: depositorAssetsAccount,
      buyerStats: buyer_stats,
      referrerStats: referrer_stats,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([depositor]);
};

describe("lbp-examples", async () => {
  // Code to get Provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program instance
  const program = anchor.workspace
    .LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

  const depositor = anchor.web3.Keypair.generate();

  // You can use this on a forntend to get the program:
  // IDL is whatever is in the target/types/liquidity_bootstrap_fjord.ts
  // const program = new Program<LiquidityBootstrapFjord>(IDL, programId, {
  //   connection,
  // });

  // This is just a sample token
  const assetMint = await splToken.createMint(
    provider.connection,
    (provider.wallet as NodeWallet).payer,
    provider.wallet.publicKey,
    null,
    6
  );

  // This is just a sample token
  const shareMint = await splToken.createMint(
    provider.connection,
    (provider.wallet as NodeWallet).payer,
    provider.wallet.publicKey,
    provider.wallet.publicKey,
    6
  );

  // This is the token account for the depositor for the token
  const depositorAccountAsset =
    await splToken.getOrCreateAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      assetMint,
      depositor.publicKey
    );

  // Same for this
  const depositorAccountShare =
    await splToken.getOrCreateAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      shareMint,
      depositor.publicKey
    );

  const fee_recipient = provider.wallet.publicKey;

  const poolAssetKp = anchor.web3.Keypair.generate();
  const poolShareKp = anchor.web3.Keypair.generate();

  it("Example", async () => {
    // Create an LBP Manager
    const lbpManagerPda = await createLBPManager({
      program,
      managerId: 1,
      feeReciever: fee_recipient,
      platformFee: new anchor.BN(1000),
      referrerFee: new anchor.BN(1000),
      swapFee: new anchor.BN(1000),
    });

    // Use this to get info about the LBP Manager
    const lbpManagerInfo = await getLBPManager(program, 1);

    // Set platform fee
    setPlatformFee({
      program,
      signer: depositor,
      newFee: new anchor.BN(1000),
      lbpManagerPda,
    });

    // Set Referrer fee
    setReferrerFee({
      program,
      signer: depositor,
      newFee: new anchor.BN(1000),
      lbpManagerPda,
    });

    // Set Swap fee
    setSwapFee({
      program,
      signer: depositor,
      newFee: new anchor.BN(1000),
      lbpManagerPda,
    });

    setFeeRecipient({
      program,
      signer: depositor,
      feeRecipient: fee_recipient,
      lbpManagerPda,
    });

    transferOwnership({
      program,
      signer: depositor,
      newOwner: fee_recipient,
      lbpManagerId: 1,
    });

    // Create a pool
    const settings: PoolSettings = {
      asset: assetMint,
      share: shareMint,
      mint: shareMint,
      creator: fee_recipient,
      virtualAssets: new anchor.BN(1000),
      virtualShares: new anchor.BN(1000),
      maxSharePrice: new anchor.BN(1000),
      maxSharesOut: new anchor.BN(1000),
      maxAssetsIn: new anchor.BN(1000),
      weightStart: new anchor.BN(1000),
      weightEnd: new anchor.BN(1000),
      saleStart: new anchor.BN(1000),
      saleEnd: new anchor.BN(1000),
      vestCliff: new anchor.BN(1000),
      vestEnd: new anchor.BN(1000),
      sellingAllowed: true,
    };

    const initialAssetAmount = new anchor.BN(1000);
    const initialShareAmount = new anchor.BN(1000);

    const poolPda = await createPool({
      initialAssetAmount,
      initialShareAmount,
      poolId: 1,
      settings,
      program,
      lbpManagerPda,
      assetMint,
      shareMint,
      depositor,
      depositorAccountAsset: depositorAccountAsset.address,
      depositorAccountShare: depositorAccountShare.address,
      poolAssetKp,
      poolShareKp,
    });

    // Get pool info
    const pool = await getPool(program, 1, 1, assetMint, shareMint);

    // Swap Assets for Exact Shares
    const txSAES = await swapAssetsForExactShares({
      program,
      referrer: fee_recipient,
      recipient: fee_recipient,
      sharesOut: new anchor.BN(1000),
      maxAssetsIn: new anchor.BN(1000),
      depositor,
      poolPda,
      lbpManagerPda,
      poolAssetsAccount: poolAssetKp.publicKey,
      poolSharesAccount: poolShareKp.publicKey,
      depositorAssetsAccount: depositorAccountAsset.address,
    });

    // Swap Shares for Exact Assets

    // Swap Assets for Exact Shares

    // Swap Shares for Exact Assets

    // Get User stats
    const userStats = await getUserStats(program, poolPda, fee_recipient);
  });
});

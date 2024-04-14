import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { describe } from "mocha";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { SOL, createMintAndVault, createUser, createUserStats } from "./utils";

interface PoolSettings {
  asset: anchor.web3.PublicKey;
  share: anchor.web3.PublicKey;
  mint: anchor.web3.PublicKey;
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

async function createTokenAccountInstrs(
  provider: anchor.AnchorProvider,
  newAccountPubkey: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  lamports?: number

): Promise<anchor.web3.TransactionInstruction[]> {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: splToken.TOKEN_PROGRAM_ID,
    }),
    splToken.createInitializeAccountInstruction(newAccountPubkey, mint, owner),
  ];
}

const createPool = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  provider: anchor.AnchorProvider,
  poolId: anchor.BN,
  poolSettings: any,
  assetGod: anchor.web3.PublicKey,
  shareGod: anchor.web3.PublicKey,
  lbpManagerPda: anchor.web3.PublicKey,
  assetMint: anchor.web3.PublicKey,
  shareMint: anchor.web3.PublicKey,
  initialShareAmount: anchor.BN,
  initialAssetAmount: anchor.BN,
) => {

  const pool = anchor.web3.Keypair.generate();
  const assetVault = anchor.web3.Keypair.generate();
  const shareVault = anchor.web3.Keypair.generate();

  const [assetVaultAuthority, assetVaultNonce] =
      anchor.web3.PublicKey.findProgramAddressSync(
          [anchor.utils.bytes.utf8.encode("asset"), pool.publicKey.toBuffer()],
          program.programId
      );
  const [shareVaultAuthority, shareVaultNonce] =
      anchor.web3.PublicKey.findProgramAddressSync(
          [anchor.utils.bytes.utf8.encode("share"), pool.publicKey.toBuffer()],
          program.programId
  );

  await program.methods
      .createPool(
          poolSettings, 
          poolId, 
          initialShareAmount, 
          initialAssetAmount,
          shareVaultNonce,
          assetVaultNonce,
      )
      .accounts({
          pool: pool.publicKey,
          assetVault: assetVault.publicKey,
          shareVault: shareVault.publicKey,
          assetDepositor: assetGod,
          assetDepositorAuthority: provider.wallet.publicKey,
          shareDepositor: shareGod,
          shareDepositorAuthority: provider.wallet.publicKey,
          lbpManagerInfo: lbpManagerPda,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([pool, assetVault, shareVault])
      .preInstructions([
          await program.account.pool.createInstruction(pool),
          ...(await createTokenAccountInstrs(
              provider,
              assetVault.publicKey,
              assetMint,
              assetVaultAuthority
          )),
          ...(await createTokenAccountInstrs(
              provider,
              shareVault.publicKey,
              shareMint,
              shareVaultAuthority
          )),
      ])
      .rpc();
  
  return {
      pool,
      assetVault,
      shareVault,
      assetVaultAuthority,
      shareVaultAuthority,
  }
}

const getPool = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  pool: anchor.web3.PublicKey,
) => {
  const poolInfoAccount = await program.account.pool.fetch(pool);
  return poolInfoAccount;
};

const getUserStats = async (
  program: anchor.Program<LiquidityBootstrapFjord>,
  userStats: anchor.web3.PublicKey,
) => {
  const userInfo = await program.account.userStats.fetch(userStats);
  return userInfo;
};

const swapAssetsForExactShares = async ({
  program,
  recipient,
  sharesOut,
  maxAssetsIn,

  depositor,
  pool,
  lbpManagerPda,
  poolAssetsAccount,
  poolSharesAccount,
  depositorAssetsAccount,
  depositorUserStats,
}: {
  program: anchor.Program<LiquidityBootstrapFjord>;
  recipient: anchor.web3.PublicKey;
  sharesOut: anchor.BN;
  maxAssetsIn: anchor.BN;

  depositor: anchor.web3.Keypair;
  pool: anchor.web3.PublicKey;
  lbpManagerPda: anchor.web3.PublicKey;
  poolAssetsAccount: anchor.web3.PublicKey;
  poolSharesAccount: anchor.web3.PublicKey;
  depositorAssetsAccount: anchor.web3.PublicKey;
  depositorUserStats: anchor.web3.PublicKey;
}) => {
  await program.methods.swapAssetsForExactShares(
    depositor.publicKey,
    sharesOut,
    maxAssetsIn,
  ).accounts({
    depositor: depositor.publicKey,
    pool: pool,
    poolAssetsAccount: poolAssetsAccount,
    poolSharesAccount: poolSharesAccount,
    depositorAssetsAccount: depositorAssetsAccount,
    buyerStats: depositorUserStats,
    lbpManagerInfo: lbpManagerPda,
    tokenProgram: splToken.TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([depositor])
  .rpc();
};

describe.only("lbp-examples", async () => {
  // Code to get Provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program instance
  const program = anchor.workspace
    .LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

  // You can use this on a forntend to get the program:
  // IDL is whatever is in the target/types/liquidity_bootstrap_fjord.ts
  // const program = new Program<LiquidityBootstrapFjord>(IDL, programId, {
  //   connection,
  // });

  // This is just a sample token
  const defaultInitialAssetAmount = SOL.mul(new anchor.BN(1000));
  const defaultInitialShareAmount = SOL.mul(new anchor.BN(1000));
  const [assetMint, assetGod] = await createMintAndVault(
    defaultInitialAssetAmount,
    provider.wallet.publicKey,
    6
  );
  const [shareMint, shareGod] = await createMintAndVault(
    defaultInitialShareAmount,
    provider.wallet.publicKey,
    6
  );

  // This is the token account for the depositor for the token
  const { 
    user: _depositor, 
    userAssetVault: _depositorAssetVault, 
    userShareVault: _depositorShareVault 
  } = await createUser(assetMint, shareMint);
  const depositor = _depositor;
  const depositorAccountAsset = _depositorAssetVault;
  const depositorAccountShare = _depositorShareVault;

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

    const { 
      pool,
      assetVault,
      assetVaultAuthority,
      shareVault,
      shareVaultAuthority,
    } = await createPool(
      program,
      provider,
      new anchor.BN(1),
      settings,
      assetGod,
      shareGod,
      lbpManagerPda,
      assetMint,
      shareMint,
      initialShareAmount,
      initialAssetAmount
    );

    // Create User Stats
    const { userStats: depositorUserStats } = await createUserStats(pool.publicKey, depositor);

    // Get pool info
    const poolInfo = await getPool(program, pool.publicKey);

    // Swap Assets for Exact Shares
    const txSAES = await swapAssetsForExactShares({
      program,
      recipient: fee_recipient,
      sharesOut: new anchor.BN(1000),
      maxAssetsIn: new anchor.BN(1000),
      depositor,
      pool: pool.publicKey,
      lbpManagerPda,
      poolAssetsAccount: poolAssetKp.publicKey,
      poolSharesAccount: poolShareKp.publicKey,
      depositorAssetsAccount: depositorAccountAsset,
      depositorUserStats,
    });

    // Swap Shares for Exact Assets

    // Swap Assets for Exact Shares

    // Swap Shares for Exact Assets

    

    // Get User stats
    const depositorUserStatsInfo = await getUserStats(program, depositorUserStats);
  });
});
